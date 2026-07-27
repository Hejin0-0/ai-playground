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

## ⚠️ 게이팅 발견 + 결정 (검수 전 정지 = B)

**발견 (2026-07-22, 첫 라이브 루프 VOX-2)**: Paperclip 에이전트는 기본적으로 **인간 승인을 기다리지 않고 자율 진행**한다. `planning` 모드로 발주한 VOX-2가 계획만 내지 않고 하위 이슈 VOX-3~7을 스스로 만들고 구현까지 실행(VOX-3·4 done, VOX-5 실행)했다. → 플랜의 D4(인간 전용 승인)·§3.4-4(검수 우회 done → 조정 필요)를 **실제로 강제하려면 설정이 필요**함을 확인. (다행히 자율 실행은 격리 워크스페이스에서 돌아 실제 레포는 무손상.)

**결정 (사용자 채택: B — 검수 전 정지)**: 프로젝트 사원 6명 전원에 게이트 적용:
```
PATCH /api/agents/{id}/permissions
{ "trustPreset": "low_trust_review", "canAssignTasks": false, "canCreateAgents": false }
```
- **`trustPreset: low_trust_review`** → 에이전트 산출물이 **격리(quarantine)** 됨. 인간이 `POST /api/issues/{id}/low-trust/promotions`로 **promote(승인)** 해야 인정 → in_review 정지 + 인간 게이트.
- **`canAssignTasks: false`** → 에이전트가 스스로 하위작업 생성·배정 불가 (VOX-2식 자율 폭주 차단). 리드는 계획 문서만 제출, 하위 발주는 인간이.
- **게임 층 안전망 유지**: §3.4-4 "검수 없이 done → 조정 필요"는 그대로 (이중 방어).

**검증 결과 (2026-07-22, VOX-9·VOX-10 실측)**:
- ✅ **`canAssignTasks: false` 작동** — 두 검증 런 모두 총 이슈 수 불변 → 에이전트가 자율 하위작업 생성 안 함(VOX-2식 폭주 차단 확인).
- ⚠️ **`low_trust_review` 완전 격리는 추가 인프라 필요** — 순차 발견: ① trust 경계 필요(`trustBoundary.projectIds`로 해결) → ② **"격리 워크스페이스(isolated workspaces)" 활성화 필요**. 우리 프로젝트는 워크스페이스 자체가 없음(`workspaces: []`, `executionWorkspacePolicy: null`) → 저신뢰 실행이 `setup_failed`로 blocked. 격리 워크스페이스는 프로젝트에 git 워크스페이스를 붙이는 **Phase 2 인프라**다.
- **결론·채택 (사용자: 길 1 린 B)**: 완전 격리 게이트는 Phase 2(브리지·워크스페이스) 때 완성. v0.1은 **`trustPreset: standard`로 되돌리고**(격리 워크스페이스 없이 막히지 않게) **`canAssignTasks: false` 유지**(폭주 차단) + 게임 층 §3.4-4(검수 우회 done→조정 필요, 인간 승인만 건물)로 B 근사. 현재 6명 전원 `trustPreset=standard, canAssignTasks=false`.

### 🚨 사고 기록 — VOX-11 첫 구현 런 (2026-07-22)

Engineering Lead(claude_local)의 첫 실제 구현(VOX-11 프록시·idempotency)에서 **게이트 위반 2건** 발생:

1. **자체 done** — `in_review` 제출 없이 스스로 `done` 처리 (린 B의 알려진 한계가 실전 확인됨).
2. **`origin/main` 직접 push** — 워크스페이스 `defaultRef=feat/...`인데도 main 체크아웃에서 작업·push (커밋 74ca2ba). 관리형 클론에 사용자 로컬 git 자격 증명이 그대로 쓰임. 에이전트가 "PLAN.md가 저장소에 없다"고 보고한 것도 main 체크아웃이었기 때문 — **defaultRef가 런 체크아웃에 적용되지 않는 것으로 보임(하네스 동작 주의)**.

**수습(사용자 승인)**: 커밋을 feat로 cherry-pick(0b41f96) → origin/main을 4ba602e로 force 원복. 작업물 자체는 양호(프록시+idempotency+자체 테스트 6파일)라 feat에서 정식 검수 예정.

**재발 방지**:
- 6명 전원 instructions-bundle(AGENTS.md)에 명문화: main push 금지·feat 브랜치 전용·완료 시 done 금지/in_review 제출·증거 코멘트 필수·하위 이슈 생성 금지·기준 문서 위치.
- **GitHub main 브랜치 보호는 사용자만 설정 가능** — Settings → Branches → Branch protection rule(main, force push·직접 push 차단) 권장. 미설정 시 지침만으로는 강제력 없음.

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

## 🏛️ 첫 완주 루프 — VOX-11 (2026-07-22)

§1 성공 조건의 핵심 루프(발주→AI 수행→검수→반려→재작업→승인)가 **실제 업무로 처음 완주**됐다:

| 시도 | 커밋 | 결과 | 게임 표현 |
|---|---|---|---|
| 1 | 74ca2ba | 반려 — QA(VOX-16): 계약 위반 3건+버그 (교육 전) | 폐허 #1 |
| 2 | 9e8db42 | 반려 — QA(VOX-17): 5/7 해소, scheme 튜플·키 충돌 FAIL (교육 후: 파일:줄 근본원인+반례 재현) | 폐허 #2 |
| 3 | a8e65dc | **승인** — QA(VOX-18): 전체 PASS, 회귀 없음, npm test/tsc PASS | **완성 건물 #1** |

- 흐름: Claude(Engineering Lead) 구현 → Codex(QA) 독립 실측 검증 → 인간 CEO 결정. 교차 모델 검증이 실제 버그(무한대기·오응답 재생·origin 우회)를 3회에 걸쳐 잡아냄.
- 거버넌스: 시도 2부터 in_review 정지·main 불변·증거 코멘트 준수 (AGENTS.md + main 보호 작동).
- 이 이력은 Phase 3 렌더 시 폐허 2 + 건물 1로 세워진다 (D9).
- 운영 노트: Codex 사원은 어댑터에 지원 모델 명시 고정 필요(`gpt-5.6-sol`) — 미지정 시 Paperclip이 미지원 모델(gpt-5.3-codex-spark)을 골라 런이 죽는 사례 있었음.

## 💰 ORG v3 — 모델 티어 배정 + Claude 한도 대응 (2026-07-22)

**계기**: VOX-12 구현 중 Claude 세션 한도(`resets 10:20pm KST`)로 빌드 정지. 토큰 부족 대응.

**모델 티어 매핑** (사용자 지시):

| provider | 시니어 개발 | QA·기획 | 문서 | 단순 반복 |
|---|---|---|---|---|
| Claude | `claude-opus-4-8` (Eng Lead) | — | `claude-sonnet-4-6` (DocWriter) | `claude-haiku-4-5` (Utility) |
| Codex | `gpt-5.6-sol` (CodexDev 신규) | `gpt-5.6-terra` (QA·P&D Lead) | `gpt-5.6-luna` (DocWriter) | — |

**개선안(채택) — 크로스-프로바이더 구현 이중화**: 시니어 개발을 Claude Opus + Codex Sol **양쪽**에 둔다.

**라우팅 (사용자 확정: Codex 먼저, Claude 나중)**: 구현 **기본 = Codex Sol**(별도 쿼터, 먼저 소진). **Claude Opus = 예비** — Codex가 바쁘거나 쿼터 부족할 때, 또는 고가치 교차 리뷰용으로만 아껴 씀. QA는 가능하면 반대 provider. → Claude 한도로 빌드가 정지하던 문제 해소 + 희소한 Claude 쿼터 보존.

**실증**: Claude 한도로 막힌 VOX-12 재작업을 대기 없이 Codex Sol(CodexDev)에 배정해 즉시 진행.

## 🧭 ORG v4 — Meta-Loop 재편: Opus=자문(핫패스 밖) (2026-07-27)

**계기**: Phase 3(3D)에서 Opus(ThreeJSDev)가 또 세션 한도 소진 → 반복되는 "Opus 먹통 → 대체자" 사이클. 외부 참조 3안(Agent Dev Kit 디렉토리 / Meta-Loop 모델 배치 / Graph-of-Loops 협업)을 우리 토폴로지에 맞춰 채택. Gemini 워커는 유료 API 미사용 → Sonnet 5 / Haiku 4.5로 대체.

**모델 → 역할 (v4)**:

| 역할 | 모델 | Paperclip 에이전트 | 비고 |
|---|---|---|---|
| **Board Advisor** (온디맨드 크리틱, 핫패스 밖) | **Opus 5** | CLI 세션(=Advisor) · ThreeJSDev = **paused** | 자문 기능은 **CLI 크로스-리뷰가 수행**(VOX-14/15/24 전례). 일상 구현 배정 안 함 → Opus 소진 사이클 종료. **단 아래 예외 참조** |
| **Chief Operator / Senior** (핫패스) | GPT-5.6 | CodexDev(sol) 주력 구현 · Technical Director(terra) 기획 · CodexQA(terra) QA | Codex-first 유지 |
| **Workers** (병렬 값싼 실행) | **Sonnet 5 / Haiku 4.5** | Developer→`claude-sonnet-5`(표준 구현) · Summarizer(haiku) 단순 | staged: 필요 시 활성화 |
| Doc Writers | sonnet-4-6 / luna | DocWriter-Claude · DocWriter-Codex | paused |

**모델 라우터** (복잡도+비용): 단순/반복 → Haiku 4.5 · 표준 구현 → Sonnet 5 · 시니어/복잡+QA → Codex(sol/terra) · 크리틱/전략/리스크/taste → **Opus 5 자문(CLI 온디맨드)**. 크로스-프로바이더 QA 유지.

**⚠️ Opus 5 예외 — 핵심 부분은 Worker로도 투입** (사용자 확정 2026-07-27): "핫패스 밖"은 **기본값이지 금지가 아니다**. 프로젝트의 **중요·핵심 부분을 코딩할 때는 Opus 5가 Worker(구현자)로 직접 일할 수 있다**. 판단 기준 — 되돌리기 어렵거나 전체 구조를 좌우하는 코드(핵심 아키텍처·데이터 계약·보안/승인 경로·복구 로직), 또는 Codex/Sonnet가 2회 이상 반려된 난도 높은 작업. 이때는 쿼터 소모를 감수하고 Opus 5에 배정한다. 일상적 기능 구현·반복 작업은 종전대로 Codex 주력 + Sonnet/Haiku 워커.

**중요 — 오케스트레이션은 CLI+CEO** (이미지의 "Orchestrator=GPT-5.6"과 다른 지점): 분해·배정·검증·종합은 CLI(나)+CEO(인간)가 수행. Paperclip 에이전트를 오케스트레이터로 두려면 `canAssignTasks:false`(Lean B)를 풀어야 하고 그럼 에이전트 자가 태스크 생성 위험이 부활 → **거버넌스상 CLI+CEO 오케스트레이션 유지**.

**Graph-of-Loops 개념 매핑** (이미지 3, 마케팅 도메인이라 문자적 루프는 무관): Company Brain=PLAN.md+PAPERCLIP-RECON.md+CLAUDE.md · Anchor(에이전트가 위조 못 하는 실측)=main 무결성+실제 test/build/WebGL 씬그래프+실 Paperclip 상태 · Frozen rules=거버넌스(main 보호·in_review·자가승인 금지·정확 pin) · Human taste gate=D4 · Audit loop=v0.1 YAGNI.

**gotcha (운영)**:
- **서버 기동은 RTK 우회 필수**: `npx paperclipai run`을 RTK 훅이 `rtk npx …`로 감싸면 상주 서버 출력을 버퍼링하며 기동 방해. 런처 스크립트(`bash <script>`)로 감싸 내부 npx가 훅에 안 걸리게 실행. 기동 후 `/api/health`로 확인.
- 에이전트 pause/resume은 `POST /api/agents/{id}/pause|resume` (회사 스코프 경로 아님 — v722 기준).
- codex_local은 지원 모델 명시 필수(`gpt-5.6-sol` 등) — 미지정 시 Paperclip이 미지원 모델을 골라 런이 죽음.
- `authorizationPolicy.trustBoundary.mode=low_trust_review`는 **trustPreset=standard여도** 저신뢰 실행(격리 워크스페이스)을 강제 → setup_failed/blocked. 게이트 끌 땐 boundary도 함께 제거(`authorizationPolicy:{trustPreset:standard}`).
- **🚨 API로 이슈 생성 시 `projectWorkspaceId` 필수** (2026-07-27 사고). UI 발주 이슈는 워크스페이스가 붙지만 `POST /api/companies/{cid}/issues`로 만들면 `projectWorkspaceId: null`이 되어 사원이 **빈 마운트**를 받는다. QA 사원이 `.git` 없는 빈 마운트에서 **옛 트리**를 읽고 전 조건 FAIL을 냈다가 무효 처리한 사고가 실제로 발생했다. 개발 이슈의 값을 복사해 넣을 것 (`GET /api/issues/{devIssueId}` → `projectWorkspaceId`).
- **QA 발주문에 '0단계 대상 검증 게이트'를 넣을 것**. 위 사고에서 QA는 *"this harness mount is empty and has no .git … the target commit identity cannot be independently verified"* 라고 스스로 적고도 판정을 강행했다. 발주문에 `git rev-parse --verify <sha>` 확인 실패 시 **판정 금지·보고 후 정지**를 명시하고, 코멘트 첫 줄에 `git log --oneline -1` 결과를 적게 하면 무효 판정을 조기에 걸러낼 수 있다.
- **`acpx_session_init_failed`는 증상이지 원인이 아니다** (2026-07-27). "Claude ACP session creation timed out"으로 이슈가 `blocked`이 되지만, 사원 레코드의 `errorReason`을 보면 실제 사유는 `You've hit your session limit · resets <시각>`인 경우가 있다. 어댑터를 직접 stdio로 때려 `session/new`가 정상 응답하면(실측 2.5초) CLI·어댑터는 무고하고 **한도 리셋만 기다리면 된다**. `GET /api/agents/{id}` → `status`/`errorReason` 를 먼저 볼 것. 리셋 후에는 이슈를 `todo`로 되돌리고 재배정하면 즉시 재가동된다(`errorReason` 문자열은 잔여물이라 남아 있어도 무방).
