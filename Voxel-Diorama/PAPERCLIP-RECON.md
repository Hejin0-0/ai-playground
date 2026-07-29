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

**⚠️ 위 표의 "세계 표현" 열은 우리가 구현할 결과지 API의 동작이 아니다** (2026-07-28 probe 이슈 VOX-37로 실측):

- **승인/거절해도 이슈 `status`는 자동 전이되지 않는다.** 거절 후에도 이슈는 원래 상태(`backlog`) 그대로였다. `승인→done` · `거절→todo` 는 **별도 `PATCH /api/issues/{id}`** 로 우리가 직접 해야 한다. 표를 읽고 자동 전이를 기대하면 조용히 어긋난다.
- **결정 이력은 영구 보존된다.** `GET /api/issues/{id}/approvals` 는 `rejected` · `revision_requested` · `approved` 레코드를 **나란히** 돌려준다 — 최신 결정이 이전 레코드를 덮어쓰지 않는다. 각 레코드에 `decisionNote`(사유)와 `decidedAt`이 붙는다.
  → **시도 이력(attemptNumber)·폐허 목록·반려 사유는 전부 서버에서 파생 가능하다. 로컬 영속화 불필요** (VOX-26 설계 근거).
  → 반대로 `src/hud/tasks.ts:hasApprovedReview()` 처럼 "승인됐나"만 볼 때는 **반드시 최신 1건만** 봐야 한다. 목록에 `approved`가 있다는 이유로 true를 돌려주면 철회된 승인이 건물을 세운 채로 남는다.

## 📖 OpenAPI 스펙이 있다 (2026-07-28)

`GET /api/openapi.json` (= `/openapi.json`) 이 **475개 경로의 전체 스펙**을 돌려준다. 요청/응답 스키마·required 필드·enum 전부 포함.

이걸 모르고 Phase 1 내내 엔드포인트를 하나씩 찔러가며 존재 여부를 추측했다. `/api/models`·`/api/project-workspaces` 부재 판정도, 승인 3단계 경로 발견도 전부 이 파일 한 번이면 끝날 일이었다.

**API 관련 질문이 생기면 probe보다 먼저 이 스펙을 조회한다.**

```bash
curl -s http://127.0.0.1:3100/api/openapi.json | python3 -c "import json,sys; d=json.load(sys.stdin); [print(m.upper(), p) for p in sorted(d['paths']) for m in d['paths'][p] if m in ('get','post','patch','delete') and 'approval' in p]"
```

⚠️ 단 스펙은 **경로의 존재**만 보증한다. 위의 "거절해도 status 자동 전이 없음" 같은 **런타임 동작은 스펙에 없다** — 그건 여전히 실측해야 한다.

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

## 🛡️ ORG v5 — 최상위 모델을 검수 게이트로 (2026-07-28)

**계기 2가지.** (1) 내가 만든 모델 드리프트 — `gpt-5.6-pro`가 런타임에 `gpt-5.3-codex-spark`로 폴백돼 이슈가 `blocked`, 이어 Developer를 `claude-opus-4-8`로 올려 **세션 한도 소진**. ORG v4가 끝내려던 "Opus 먹통 → 대체자" 사이클을 그대로 재현했다. (2) 사용자 정정 — **`gpt-5.6` 계열 서열은 sol(최상위) > terra(중간) > luna(하위)** 이며, 이를 역할 중요도에 맞게 재분배하라는 지시.

**핵심 판단 — 최상위 모델은 구현이 아니라 검수에 둔다.** 근거는 이 프로젝트의 실측 기록이다. sol이 구현한 VOX-25는 1·2라운드 연속으로 결함을 남겼고, terra의 검수 1회가 실제 결함 4건(승인 철회 무효화 포함)을 찾았다. 게다가 **D9 때문에 오판이 영구적이다** — 잘못된 반려는 멀쩡한 작업 위에 영구 폐허를 세운다. 되돌릴 수 없는 쪽은 검수다.

| 자리 | 모델 | 소재 | 상태 |
|---|---|---|---|
| **적대 검수 게이트** | `gpt-5.6-sol` | **CLI 플러그인** (Paperclip 에이전트 아님) | 신설 |
| **B — 복잡 구현** | `gpt-5.6-terra` | CodexDev | 활성 |
| **A — 단순·반복** | `gpt-5.6-luna` | DocWriter-Codex | paused (필요 시) |
| **C — QA 기본 / 구현 겸업** | `claude-sonnet-5` | Developer | 활성 |
| 체크포인트 QA | `gpt-5.6-terra` | CodexQA | 활성 |
| 핵심 에스컬레이션 | `claude-opus-4-8` | ThreeJSDev | paused |
| **Advisor / CEO 대리** | `claude-opus-5` | CLI 세션 | 상시 |
| 기획·분해 | `gpt-5.6-sol` | Technical Director | **paused** |

Technical Director를 내린 이유: sol 자리를 검수 게이트가 가져갔고, 분해·배정은 Lean B 아래서 CLI+CEO가 수행하며, 실제로 한 번도 돌지 않았다. 노는 활성 에이전트는 설정 표면만 늘린다(v0.1 활성 3명 YAGNI). 분해가 병목이 될 때 되살린다.

> **R-1. 한 업무에서 구현자와 QA는 반드시 다른 provider.**
> 구현 luna/terra(Codex) → QA Developer(sonnet5) · 구현 sonnet5/opus(Claude) → QA CodexQA(terra).
> terra 자리가 둘이지만 이 규칙 때문에 terra가 자기 작업을 검수하는 일은 없다. **크로스-프로바이더 QA가 처음으로 실제 복원된다** — 종전은 구현 sol · QA terra로 둘 다 Codex였다.

> **R-2. 모델 변경 후에는 실제 런 1회의 로그에서 모델명을 눈으로 확인한다.**
> `GET /api/agents/{id}`가 설정값을 그대로 돌려줘도 런타임은 다른 모델로 폴백할 수 있다. **설정 리드백은 검증이 아니다.**
> 확인 위치: `~/.paperclip/instances/default/data/run-logs/{companyId}/{agentId}/{runId}.ndjson`. runId는 `GET /api/issues/{id}/runs`. (이 응답 자체에는 모델 필드가 없다.)

**R-1 일시 중단 — VOX-26 (2026-07-28).** Codex 계통 전원이 쿼터 소진으로 정지해 구현·검수를 둘 다 Claude로 편성했다(구현 Developer `claude-sonnet-5` · 적대 검수 CLI Advisor `claude-opus-5`). R-1의 provider 분리는 깨지지만 "구현자 ≠ 검수자"와 "가장 강한 가용 모델을 되돌릴 수 없는 쪽에 둔다"는 ORG v5 본지는 유지된다. Codex 복구 시 원상 복귀. **이탈은 기록으로만 허용하고 기본값으로 굳히지 않는다.**

> **R-3. 스냅샷 단언으로는 시간축 위반을 잡을 수 없다** (2026-07-28, VOX-26 시도 1에서 확립).
> VOX-26 제출물은 게이트 3종을 통과했고 R-A 변이 로그도 **정직했다** — CLI가 변이를 재현하니 테스트가 실제로 깨졌다. VOX-25와 달리 이빨이 있었다. 그런데도 결함을 놓쳤다: C3 단언 3개가 전부 **하나의 투영 스냅샷 안**에서만 평가됐는데, 위반은 **스냅샷 사이**에서 일어났다(무관한 업무가 완료될 때마다 모든 폐허의 부지가 밀림 → D9 "영구" 붕괴).
> **판정 기준: 요구사항이 "영구히"·"바뀌지 않는다"·"다음 번에는" 같은 시간 서술을 담고 있으면, 서로 다른 두 시점의 산출물을 비교하는 단언이 없는 한 그 조건은 미검증이다.** 같은 입력을 두 번 넣어 같은 결과가 나오는 것(결정론·멱등성)은 이걸 대신하지 못한다.
> 뿌리 원인 패턴도 재사용 가능하다 — **위치를 현재 개수에서 계산하면 어떤 위치도 영구적일 수 없다.** 영구 배치는 단조 증가하는 시간순 이벤트 스트림에 붙여야 한다(새 이벤트는 항상 끝에 붙으므로 기존 것을 밀지 않는다).

> **R-4. 판정은 코멘트가 아니라 승인 레코드로 먼저 기록한다** (2026-07-28, VOX-26에서 실제 발생).
> CLI가 반려 판정을 **이슈 코멘트로만** 올리고 승인 레코드를 남기지 않은 채 3분이 지나자, 사원이 그 코멘트를 읽고 스스로 고쳐 `495960a`를 푸시한 뒤 **"시도 2"라고 자칭**했다. 코드는 실제로 옳게 고쳐졌지만 문제는 기록이다 — **거절 레코드가 0건이므로 시스템 정의상 이건 여전히 시도 1이다**(`attemptNumber = 1 + rejected 레코드 수`). 이대로 승인하면 섬에는 건물 1개만 서고 **실패는 흔적 없이 사라진다.** D9("거절은 영구 폐허")가 장식이 된다.
> **규칙: 제출된 해시에 대한 판정을 승인 레코드로 먼저 확정하고, 그 다음에 새 제출물을 본다.** 반대 순서면 사원이 판정 전에 역사를 덮어쓸 수 있다. 이건 사원의 악의가 아니라 **검수자가 만든 창구**다 — 이번 건은 CLI 잘못이다.
> 배경: 사원은 `in_review` 상태에서도 코멘트에 반응해 커밋·푸시할 수 있다. 상태 전이가 사원의 쓰기를 막지 않는다.

### Codex 플러그인 게이트 (`openai/codex-plugin-cc` v1.0.6)

`/codex:adversarial-review` — 조종 가능한 도전 리뷰. **읽기 전용이라 승인·커밋·자가배정이 구조적으로 불가능** → D4/Lean B를 어길 수단 자체가 없다. 이것이 Paperclip 에이전트 오케스트레이터를 금지하면서도 이 게이트는 허용하는 이유다.

**이건 Orchestrator가 아니다.** 프로젝트를 분해해 여러 워커에 배정하는 기능은 없다. 리뷰 + 단건 위임(`rescue`) + 세션 이관(`transfer`)이다. 그렇게 부르면 없는 기능을 기대하게 된다.

- ⚠️ **`review`·`adversarial-review`는 `--model`을 받지 않는다** (`rescue`만 받는다). 검수 게이트의 모델은 **`~/.codex/config.toml`의 전역 `model`** 로만 정해진다. 그래서 이 값을 `gpt-5.6-luna` → `gpt-5.6-sol`로 바꿨다 (백업: `~/.codex/config.toml.bak-*`). **부작용**: Codex 데스크톱·CLI 전체의 기본 모델도 sol이 된다. 위임 시에는 `rescue --model gpt-5.6-terra|luna`로 명시 오버라이드한다.
- 운영 이득: Paperclip QA 이슈 발주 경로에서 나던 사고 3종(워크스페이스 null → 빈 마운트 오판정 · dispatch 미발화 · 커밋 미push)이 게이트 검수에는 존재하지 않는다. **일상 검수는 게이트로, Paperclip QA 이슈는 Phase 체크포인트급에만.** 판정문은 이슈 코멘트로 붙여 기록을 남긴다.
- ⚠️ **Codex 계통 전체가 `~/.codex/auth.json` 하나를 공유한다.** 이 토큰이 revoke되면 게이트와 Paperclip codex_local 사원(CodexDev·CodexQA)이 **동시에** 죽는다. 증상: `Your access token could not be refreshed because your refresh token was revoked`. 주의 — `codex login status`는 이 상태에서도 "Logged in"이라고 답한다(신뢰 불가). 복구는 인간이 `codex login`. 이때 Claude 계통(Developer/ThreeJSDev)은 무관하게 살아 있으므로 **provider 이중화가 실제로 값을 한다**.
- ⚠️ **`codex login`에는 ChatGPT 로그인과 API 키 두 모드가 있고, 실패 증상이 서로 다르다** (2026-07-28). API 키 모드로 로그인하면 `auth.json`이 `{auth_mode, OPENAI_API_KEY}` 형태가 되고(`tokens`가 사라진다), 그 키에 크레딧이 없으면 **모든 모델에서** `ERROR: Quota exceeded. Check your plan and billing details.` 가 난다 — sol도 luna도 똑같이 죽으므로 모델 문제로 오진하기 쉽다. ChatGPT 구독 쿼터를 쓰려면 재로그인 시 **"Sign in with ChatGPT"** 를 골라야 한다. 판별법: `auth.json`에 `tokens.id_token`이 있으면 ChatGPT 모드, `OPENAI_API_KEY`만 있으면 키 모드.
  ⚠️ `auth.json`을 통째로 출력하지 말 것 — 키 모드에서는 평문 API 키가 그대로 찍혀 세션 로그에 남는다. 필요한 건 모드 판별뿐이므로 키 존재 여부만 확인한다.

**gotcha (운영)**:
- **서버 기동은 RTK 우회 필수**: `npx paperclipai run`을 RTK 훅이 `rtk npx …`로 감싸면 상주 서버 출력을 버퍼링하며 기동 방해. 런처 스크립트(`bash <script>`)로 감싸 내부 npx가 훅에 안 걸리게 실행. 기동 후 `/api/health`로 확인.
- 에이전트 pause/resume은 `POST /api/agents/{id}/pause|resume` (회사 스코프 경로 아님 — v722 기준).
- codex_local은 지원 모델 명시 필수(`gpt-5.6-sol` 등) — 미지정 시 Paperclip이 미지원 모델을 골라 런이 죽음.
- `authorizationPolicy.trustBoundary.mode=low_trust_review`는 **trustPreset=standard여도** 저신뢰 실행(격리 워크스페이스)을 강제 → setup_failed/blocked. 게이트 끌 땐 boundary도 함께 제거(`authorizationPolicy:{trustPreset:standard}`).
- **🚨 API로 이슈 생성 시 `projectWorkspaceId` 필수** (2026-07-27 사고). UI 발주 이슈는 워크스페이스가 붙지만 `POST /api/companies/{cid}/issues`로 만들면 `projectWorkspaceId: null`이 되어 사원이 **빈 마운트**를 받는다. QA 사원이 `.git` 없는 빈 마운트에서 **옛 트리**를 읽고 전 조건 FAIL을 냈다가 무효 처리한 사고가 실제로 발생했다. 개발 이슈의 값을 복사해 넣을 것 (`GET /api/issues/{devIssueId}` → `projectWorkspaceId`).
- **QA 발주문에 '0단계 대상 검증 게이트'를 넣을 것**. 위 사고에서 QA는 *"this harness mount is empty and has no .git … the target commit identity cannot be independently verified"* 라고 스스로 적고도 판정을 강행했다. 발주문에 `git rev-parse --verify <sha>` 확인 실패 시 **판정 금지·보고 후 정지**를 명시하고, 코멘트 첫 줄에 `git log --oneline -1` 결과를 적게 하면 무효 판정을 조기에 걸러낼 수 있다.
- **🚨 사원은 Paperclip 관리 클론에서 일한다 — 커밋해도 push가 안 될 수 있다** (2026-07-28 사고). 사원의 실제 작업 경로는 에이전트 워크스페이스(`workspaces/{agentId}/`, 여긴 `.claude`만 있다)가 아니라 **`~/.paperclip/instances/default/projects/{companyId}/{projectId}/ai-playground/`** 다. VOX-25 3차에서 사원이 `8944a4a`를 여기에 커밋하고 **push를 빠뜨려**, 제출 코멘트의 해시가 origin·주 저장소·워크트리 어디에도 없었다. 산출물이 조작인지 유실인지 20분간 추적했다. **검수 첫 단계는 `git cat-file -t <제출해시>`로 origin 도달 가능성을 확인하는 것**이고, 없으면 위 경로에서 `git fetch <path> <branch>` 후 체리픽해 회수한다. 발주 템플릿에 "제출 전 push 확인"을 넣을 것.
- **🚨 재발주는 `assigneeAgentId` *변경*에만 걸린다** (2026-07-28 사고). `PATCH /api/issues/{id}`로 `status:"todo"`와 함께 **같은** 담당자를 다시 써넣으면 dispatch 트리거가 안 돈다 — 이슈는 `todo`에 그대로 앉아 있고 사원은 `idle`, 에러도 로그도 없다. 실제로 이 상태로 **18시간을 날렸다**. 반드시 두 번 PATCH 할 것: `{"assigneeAgentId":null}` → (1~2초) → `{"assigneeAgentId":"<id>"}`. 픽업까지 최대 1분 걸리므로 8초만 보고 실패로 판단하지 말 것.
- **🚨 `gpt-5.6-pro`는 쓸 수 없다 — 게다가 조용히 실패한다** (2026-07-28). 설정은 받아들여지고 `GET /api/agents/{id}`도 `model: "gpt-5.6-pro"`를 그대로 되돌려주지만, 런타임에서 `gpt-5.3-codex-spark`로 폴백되고 ChatGPT 계정 Codex는 그 모델을 거부한다 → `400 invalid_request_error: The 'gpt-5.3-codex-spark' model is not supported when using Codex with a ChatGPT account` → 이슈 `blocked`. **설정 리드백은 검증이 아니다.** 실제 런 코멘트를 봐야 안다. 확인된 사용 가능 상한: codex_local = `gpt-5.6-sol`/`terra`/`luna`, claude_local = `claude-opus-4-8`. 모델 상향이 필요하면 codex 안에서 올리지 말고 **claude_local(`claude-opus-4-8`)로 담당을 옮기는 것이 유일한 실질 업그레이드 경로**다.
- **✅ 검수 API 실체 — CLI에서 승인까지 집행 가능** (2026-07-28 실측, v2026.722.0). `POST /api/tasks/{id}/review` 는 **없다(404)**. 실제 경로는 **생성 → 이슈 링크 → 결정** 3단계다:
  1. `POST /api/companies/{cid}/approvals` `{"type":"request_board_approval","issueIds":["<issueId>"],"payload":{...}}` → `id` 반환. `issueIds`를 여기서 주면 링크까지 한 번에 끝난다(별도 `POST /api/issues/{id}/approvals {approvalId}` 도 가능).
  2. `POST /api/approvals/{approvalId}/approve` `{"decisionNote":"..."}` (또는 `/reject`, `/request-revision`, `/resubmit`)
  3. `PATCH /api/issues/{id}` `{"status":"done"}`

  결과: `GET /api/issues/{id}/approvals` → `status:"approved"`, `decidedByUserId:"local-board"`. **순서를 지켜야 한다** — 승인 레코드 없이 `done`으로만 밀면 `hasApprovedReview`가 false라 건물이 아니라 **[조정 필요] 마커**가 된다(PLAN §3.4-4 검수 우회 규칙이 그대로 발동).

  ⚠️ 세 엔드포인트 모두 `AgentBearerAuth`를 허용한다 → **사원이 자기 승인을 위조할 수 있다**. D4가 API 층에서는 강제되지 않는다는 뜻이고, v0.1은 이를 수용 부채로 둔다(PLAN §9-11).

- **🚨 "엔드포인트가 없다"고 단정하기 전에 어느 포트에 쐈는지 확인할 것** (2026-07-28 오진). 위의 "`POST /api/tasks/{id}/review` 404"는 Paperclip 본체(`127.0.0.1:3100`)에 직접 쏜 결과다. **게임은 본체가 아니라 Vite 개발 서버를 거치고, 그 경로는 우리 브리지에 이미 구현돼 있다** — `bridge/paperclipProxy.ts:151` `forwardReview()`가 `/api/tasks/{id}/review`를 받아 `GET /api/issues/{id}/approvals` → `POST /api/approvals/{id}/{action}` 으로 번역한다. 이 오진으로 **이미 존재하는 3단계 흐름을 처음부터 만들라는 이슈(VOX-38)를 발주할 뻔했다.** 발주 직전 소스를 읽고 잡았다.
  교훈 둘: (1) 404는 "라우트 없음"이 아니라 "**이 서버에** 라우트 없음"이다. 우리 스택은 2층(브리지 + 본체)이므로 층을 명시하지 않은 probe 결과는 결론이 아니다. (2) **자기 발주서의 전제도 적대 검수 대상이다.** 사원 제출물만 의심하고 내 이슈 본문은 액면가로 읽으면 사원이 없는 걸 만든다.
  VOX-38의 실제 결함은 훨씬 작고 다르다 — ⓐ pending 승인 레코드를 **아무도 만들지 않아** 실제 검수는 항상 409(`linked_pending_approval_not_found`)이고, ⓑ 결정 후 `PATCH /api/issues/{id}` 상태 전이가 없어 승인이 건물이 되지 않는다. `bridge/reviewProxy.e2e.test.ts:59`가 스텁에 pending 승인을 **미리 심어** 해피 패스를 통과시키고 `:154`는 409를 **정상으로 단언**해, 테스트가 결함을 고정해 놓고 있었다.
- **`acpx_session_init_failed`는 증상이지 원인이 아니다** (2026-07-27). "Claude ACP session creation timed out"으로 이슈가 `blocked`이 되지만, 사원 레코드의 `errorReason`을 보면 실제 사유는 `You've hit your session limit · resets <시각>`인 경우가 있다. 어댑터를 직접 stdio로 때려 `session/new`가 정상 응답하면(실측 2.5초) CLI·어댑터는 무고하고 **한도 리셋만 기다리면 된다**. `GET /api/agents/{id}` → `status`/`errorReason` 를 먼저 볼 것. 리셋 후에는 이슈를 `todo`로 되돌리고 재배정하면 즉시 재가동된다(`errorReason` 문자열은 잔여물이라 남아 있어도 무방).

## 🏝️ 첫 여행 · 섬 최초 렌더링 (2026-07-29)

**Phase 3 코드를 세 이슈째 만드는 동안 앱을 한 번도 띄운 적이 없었다.** 모든 테스트가 `trip-root` 합성 픽스처였고, 그 탓에 아래 두 단절이 보이지 않았다.

1. **여행이 한 번도 시작된 적 없었다.** `~/Library/Application Support/Voxel-Diorama/world-state.json` 자체가 없었다 → 화면은 영구히 "활성 여행이 없습니다".
2. **업무가 전부 고아였다.** 38개 중 24개가 `parentId: null`. 투영은 여행 루트의 **직속 자식**만 집계하므로 여행을 시작해도 아무것도 안 올라온다.

**해소**: 여행 1(`1e5d3ee3-e05b-4275-82a5-120263473090`) 시작 후 VOX-26·VOX-38을 그 아래로 재부모화. 섬이 **30점 · 1동**으로 렌더 — 중앙 (0,0) 폐허(시도 1) + (1,0) 계단식 건물. 승인 원장이 실제로 3D가 된 첫 사례이며, VOX-26의 부지 규칙이 합성 데이터가 아닌 우리 자신의 기록으로 실증됐다.

### 실행 방법 (⚠️ `.claude/`는 gitignore라 설정이 저장소에 남지 않는다)

```
cd Voxel-Diorama && \
PAPERCLIP_COMPANY_ID=edcdbd03-885e-47db-b446-e301e8cff300 \
PAPERCLIP_PROJECT_ID=9beb4f72-2882-4566-8562-bab6250da351 \
PAPERCLIP_PROXY_TARGET=http://127.0.0.1:3100 npm run dev
```

env 없이 띄우면 `tripsApi`가 `503 paperclip_not_configured`를 내고 여행을 시작할 수 없다.

### 여기서 나온 발견 2건

- **여행 시작 UI가 없다.** VOX-15가 `POST /api/trips` API만 만들고 화면을 붙이지 않아, 인게임에서 여행을 시작할 방법이 없다. 현재는 curl로만 가능하다(same-origin 헤더 + `idempotency-key` 필요). 백로그.
- **초기 렌더에서 승인된 업무가 `[조정 필요]`로 보인다.** 첫 페인트는 `0점 / 0동 / 조정 필요`, 잠시 뒤 `30점 / 1동`으로 정정된다. `App.tsx:205`의 `rootIssueId`가 첫 렌더에 `undefined`라 `tasks.ts:195`가 승인 조회를 건너뛰고 `approved: null`이 되기 때문. **로딩 중인 상태와 "검수를 우회했다"는 판정이 같은 화면으로 표현되고 있다** — 영구성이 핵심 약속인 제품에서 승인된 결과물이 한 순간이라도 미검수로 보이면 화면 전체의 신뢰가 깨진다. VOX-27에 C7로 편입.

> **R-5. 투영 로직은 합성 픽스처만으로 완성됐다고 판정하지 않는다.** VOX-24·25·26 세 이슈가 전부 게이트를 통과하고 승인됐는데도 화면에는 아무것도 뜨지 않았다. 픽스처는 "루트 아래 자식이 있다"를 가정하고 시작하므로 **부모가 없다는 상태 자체를 표현하지 못한다.** 배치·투영 계열 업무는 승인 전에 실 인스턴스에서 한 번 렌더해 볼 것.
