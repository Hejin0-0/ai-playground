# PAPERCLIP-RECON.md — Phase 1 API 실사 결과

> 실사일: 2026-07-21 · Paperclip `2026.720.0` · local_trusted/private @ 127.0.0.1:3100 · 임베디드 PostgreSQL
> 목적: PLAN.md §3.4 상태 매핑·D10 점수·§4.2 브리지 계약을 **실제 API로 확정**. fixtures는 `paperclip-recon/fixtures/`.

## 설치·기동

- brew 미지원 → 공식 `npx paperclipai onboard --yes` (신뢰 로컬 모드). Node 22 · pnpm(brew) 11.15.
- 홈 `~/.paperclip/instances/default/`, doctor 9/9 통과, 마이그레이션 180개 적용, 포트 3100.
- **LLM 미설정** — API 계약·상태 전이 실사는 가능, 실제 에이전트 작업 실행은 LLM 설정 후.

## 인증 모델 (M10 해소)

`GET /api/auth/get-session` → `{"userId":"local-board","user":{"name":"Board"}}`. **트러스트 로컬에서 loopback 요청은 자동으로 Board(인간 CEO) 권한으로 인가**된다. 브리지가 서버측(127.0.0.1)에서 그대로 인간 권한 승인/거절을 호출할 수 있다 (D13 "자격 증명 서버측 보관"과 정합).

securitySchemes 3종: `BoardSessionAuth`(세션 쿠키) · `BoardApiKeyAuth`(인간 권한 bearer, 비-신뢰 배포용) · `AgentBearerAuth`(에이전트 키/JWT). → **인간 vs 에이전트 권한이 API에 명확히 분리**. 승인은 Board 권한 전용.

## 이슈(업무) 계약

`POST /api/companies/{companyId}/issues` — 필수 `title`, `status`.

- **상태 enum (확정)**: `backlog · todo · in_progress · in_review · done · blocked · cancelled`
  → **고정 상태명이다** (팀 커스텀 상태가 아님). PLAN 원래 §3.4 매핑이 옳았고, 리뷰 M9의 "카테고리+커스텀 상태" 가정은 이 버전에서 **틀림**.
- **우선순위 enum (확정)**: `critical · high · medium · low` (선택 — 필수 아님, null 가능)
  → **'critical'이 실재하고 'urgent'는 없다**. D10을 "Urgent"로 바꾼 것은 틀렸고 원래 "Critical"이 옳았음. priority가 null 가능하므로 "발주 시 선택 필수(No priority 금지)"는 우리 앱 강제사항으로 유지.
- 계층: `parentId`(하위 업무), `POST /api/issues/{id}/children`. TD 분해 구조에 사용.
- **blocker**: `blockedByIssueIds`(배열) + `GET /api/issues/{id}/diagnostics/blockers`. `blocked` 상태와 **별개로** 의존성 관계도 존재 → §3.4는 blocked 상태 행 유지 + blocker 관계는 폴링 시 함께 조회.
- 멱등성: `idempotencyKey` 필드 기본 제공 (+`allowDuplicate`). PlacementAttempt 멱등과 정합.
- 비용/증거: `GET /api/issues/{id}/cost-summary`, `/runs`, `/activity`, `/comments`. §3.3 증거 패널 충족.

## 검수(승인) 계약 — 플랜 검수 흐름과 직접 매핑

이슈 작업 검수는 **네이티브 Approval 객체**로 처리:

| 브리지 `/review` decision | Paperclip API | 세계 표현 |
|---|---|---|
| approve | `POST /api/approvals/{id}/approve` (`decisionNote`) | 이슈 `done` → 완성 건물 |
| reject | `POST /api/approvals/{id}/reject` (`decisionNote`) | 이슈 `todo` → 영구 폐허 |
| request_changes | `POST /api/approvals/{id}/request-revision` (`decisionNote`) | 수정 요청 — 반려 아님 (D9) |
| (재작업 재제출) | `POST /api/approvals/{id}/resubmit` (`payload`) | 새 시도 → in_review 재진입 |

- `POST /api/issues/{id}/approvals`로 이슈↔승인 연결, `GET/POST /api/approvals/{id}/comments`로 코멘트.
- 회사 governance 승인(`POST /api/companies/{companyId}/approvals`, type `hire_agent|approve_ceo_strategy|budget_override_required|request_board_approval`)은 작업 검수와 **별개** — 혼동 금지.

## 조직·예산 (D12·L3 해소)

- **고용**: `POST /api/companies/{companyId}/agent-hires` — role enum에 `engineer·pm·qa·cto·devops·designer·pm...` 존재. **Developer=role `engineer`(title "ThreeJSDev"), TD=role `pm` 또는 `cto`(title "Technical Director")**. (Paperclip에 "Technical Director"는 title, role은 enum에서 선택.)
- **에이전트 어댑터(LLM 백엔드)**: `adapterType` enum = `process·http·claude_local·codex_local·cursor_cloud·gemini_local·grok_local·hermes_gateway·hermes_local·opencode_local·pi_local·cursor·openclaw_gateway`. → **Claude 사원 = `claude_local`, Codex 사원 = `codex_local`**. 내장 에이전트(Reflection Coach·Summarizer)는 `claude_local`. 고용 시 `adapterType`으로 지정. 실제 실행엔 해당 CLI/자격 설정 필요.
- `POST /api/companies/{companyId}/agents/{id}/approve|pause|resume|terminate`, `GET/POST /api/agents/{id}/keys` (에이전트 키).
- **예산 (L3 해소)**: 회사 `budgetMonthlyCents` + `PATCH /api/agents/{agentId}/budgets` + `/api/companies/{companyId}/budgets/policies` + `budget-incidents/{id}/resolve`. 월 단위 예산(`budgetMonthlyCents`)·정책·초과 인시던트 전부 실재.
- 비용 조회: `/api/companies/{companyId}/costs/*` (by-agent, by-project, summary…).

## 플랜에 반영할 정정 (실사 → 문서)

1. **D10**: "Urgent 60" → **"Critical 60"** 복원 (실제 enum critical/high/medium/low). "선택 필수" 규칙은 유지.
2. **§3.4**: M9의 카테고리 재작성을 **고정 상태명으로 복원** (backlog/todo/in_progress/in_review/done/blocked/cancelled). 단 HIGH/M3 추가분(활성 여행 없음 행·담당 직원 표기·cancelled 폐허 보존·수정 요청 행)은 유지. blocked는 상태 행 유지 + blocker 관계는 폴링 병행.
3. **PlacementAttempt 규칙 1**: "설정된 검수 상태 ID" → **"in_review 첫 진입"** 복원.
4. **§4.2**: 브리지 `/review`를 네이티브 approve/reject/request-revision/resubmit로 매핑. 트러스트 로컬 loopback = Board 권한.
5. **§8·§10**: M9(커스텀 상태 리스크)·M10(승인 API 존재)·L3(예산) **실사로 해소** 표기.

## 라이브 검증 결과 (2026-07-21, 쓰기 실측)

브리지가 할 동작을 curl(Board 권한)로 실행해 확정:

| 검증 | 결과 |
|---|---|
| 회사 생성 `POST /api/companies` | ✅ Voxel-Diorama (prefix VOX, budgetMonthlyCents 반영, 신규 에이전트 승인 불요) |
| 프로젝트 생성 | ✅ "Voxel-Diorama v0.1" |
| 고용 `agent-hires` | ✅ TD(role pm)·ThreeJSDev(role engineer) |
| 이슈 발주 | ✅ VOX-1 (status/priority/assignee/project) |
| **멱등성 키** | ✅ 같은 `idempotencyKey` 재요청 → **동일 이슈 반환(중복 생성 없음)** |
| **§3.4 상태 전이 6종** | ✅ `in_progress·in_review·done·todo·blocked·cancelled` 전부 PATCH 200 |
| 코멘트 | ✅ `POST /api/issues/:id/comments` 201 |
| 비용 요약(증거 패널 §3.3) | ✅ `cost-summary` = {costCents, inputTokens, outputTokens, runCount, runtimeMs} |
| **승인 액션** | ✅ approve→`approved` · reject→`rejected` · request-revision→`revision_requested`, 모두 `decidedByUserId=local-board`(인간) |

**작업 검수 승인 객체는 단순 상태 전이로는 자동 생성되지 않음** — 에이전트가 작업을 제출할 때 생성된다(= LLM 필요). 승인 **액션 엔드포인트** 자체는 governance 승인으로 검증 완료(브리지가 호출할 동일 경로).

### Phase 1 완료까지 남은 것 (LLM 의존)

- LLM 어댑터 미설정 → 이슈 배정 시 에이전트가 자동 실행을 시도하다 `error`(예상됨). **실제 에이전트 코딩 + 작업 검수 승인 생성은 LLM 설정 후** 가능. Paperclip UI(`http://127.0.0.1:3100`)에서 프로바이더·키 설정 필요(키 입력은 사용자 직접).
- 웹훅 실시간 유무·거절→재작업 자동 트리거 여부는 실사용에서 확인(폴링 폴백 항상 유효).

### 워크포스 (2026-07-21 확정)

회사 Voxel-Diorama(`edcdbd03…`) · 프로젝트 "Voxel-Diorama v0.1". **의사결정 다양성 원칙** — 한 모델 판단에만 회사 방향을 맡기지 않도록 Claude/Codex 시니어를 독립적으로 둠. 문서 작성은 저토큰 모델 전담 사원에게.

| 팀 | 사원(name) | title | role | 상태 | 책임 |
|---|---|---|---|---|---|
| **Claude** (`claude_local`) | ThreeJSDev | Engineering Lead | engineer | 🟢 활성 | 아키텍처·기술 방향 + v0.1 구현 겸임 |
| **Claude** | Developer | Developer | engineer | ⏸ 대기 | 구현 (Eng Lead 산하) — 병렬 업무 시 활성화 |
| **Claude** | DocWriter-Claude | Doc Writer (Claude) | general | ⏸ 대기 | 개발/플랜 문서 (저토큰) |
| **Codex** (`codex_local`) | Technical Director | Product & Design Lead | pm | 🟢 활성 | 기획·UX + 분해·배정, Claude와 독립된 관점 |
| **Codex** | CodexQA | QA Engineer | qa | 🟢 활성 | 검증·증거 (교차 모델 체크) |
| **Codex** | DocWriter-Codex | Doc Writer (Codex) | general | ⏸ 대기 | 디자인/기획 문서 (저토큰) |

> **v0.1 활성 3명**(두 리드+QA)만 가동, 나머지는 `pause`. 단계적 활성화 트리거는 PLAN.md §3.1 참고. 목표 조직·설계 근거는 §2 지휘 체계·D12.

내장 Reflection Coach·Summarizer(`claude_local`, paused).

**조직도(reportsTo)** — LLM별 2팀. 팀장은 CEO 직속(독립), 팀원은 팀장에게 보고:
```
CEO
├─ Senior Developer (Claude)        └─ Doc Writer (Claude)
└─ Design & Planning Lead (Codex)   ├─ QA & Test Engineer   └─ Doc Writer (Codex)
```
reportsTo는 조율 구조일 뿐 결정권 아님(승인·거절·방향은 인간 전용, D4) → 위계가 있어도 두 시니어의 독립적 의사결정 다양성 유지.

- **저토큰 모델**: DocWriter 2명은 `metadata.modelTier=low-token`로 표기 — 실제 모델은 LLM 자격 설정 시 UI에서 확정.
- **어댑터 아이콘 주의**: 에이전트 icon enum에 `compass` 없음(프로젝트엔 있음) → PATCH 400 유발. 유효값(radar 등) 사용.

### 정리된 테스트 흔적

이슈 VOX-1은 하드 삭제 불가(런 이력 11개 → DELETE 500)라 `cancelled`+아카이브. governance 테스트 승인 3건은 삭제 엔드포인트 없음(불변 감사 기록).
