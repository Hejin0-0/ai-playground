# 🏝️ Voxel-Diorama — AI Workforce Island · 최종 마스터 플랜

> **한 문장 정의**: 내가 AI 직원에게 맡긴 실제 업무의 성공과 실패가, 국가 테마 3D 섬의 건물과 폐허로 영구히 남는다.
>
> **문서 상태**: 설계 확정본 (2026-07-20) — Claude v0.2 · Codex 상세안 · Gemini v0.3 3안 최종 통합 · 2026-07-21 적대적 리뷰 HIGH 8 + MEDIUM 10 + LOW 3 = 21건 전부 반영 · Codex-Final / Gemini-Final 최종안 3자 대조 통합 · **2026-07-21 Phase 1 Paperclip API 실사 반영** (§3.4 상태 enum·D10 우선순위 실측 정정, M9/M10/L3 해소 — PAPERCLIP-RECON.md) (기존 문제점·통합 근거는 각 위치의 HTML 주석에 기록)
> **제품 목표**: v0.1 (macOS 로컬 개인 도구, 1인 사용자) · **개발 체제**: 나(CEO/최종 검수자) + Paperclip AI 워크포스
> **원칙**: 시각적 완성도보다 반복 가능한 업무 루프를 먼저 증명한다. 이 문서가 유일한 기준이며, 변경은 §2 결정 로그에 기록한다.

---

## 1. v0.1 성공 조건

다음 흐름을 **실제 Voxel-Diorama 개발 업무**로 한 번 이상 완주해야 한다 (도그푸딩 내장 → Phase 1 구현 발주 게이트):

1. 여행을 시작하고 개발 업무를 생성한다.
2. Design & Planning Lead가 업무를 분해하고 Senior Developer가 수행한다.
3. 사용자가 결과물과 테스트 증거를 검수한다.
4. 첫 시도를 거절하면 해당 부지에 영구 폐허가 남는다.
5. 재작업을 승인하면 새 부지에 완성 건물이 세워진다.
6. 여행을 종료하고 섬을 보관한다.
7. 다음 업무에서도 이 흐름을 다시 사용하고 싶다고 판단한다.
8. jp-kyoto 테마로 여행을 시작할 때, 버튼 클릭 한 번으로 §5의 4단계 전환 파이프라인이 실행되어 3D 세계와 Astryx UI 토큰이 하나의 연속된 연출(마스크 → 동시 공개)로 전환됨을 눈으로 확인한다.

<!-- 2026-07-21 MEDIUM 리뷰 반영 (PLAN-REVIEW.md):
# M5(제품 비전): 기존 §1은 7단계 전부 업무 루프만 다뤄 테마 전환 연출(비전 b)이 성공 조건 어디에도 없었음 → 교토 없이도 v0.1 '성공' 선언이 가능해 비전의 세 기둥 중 하나가 조용히 밀림. 8번 항목으로 전환 '경험'을 성공 조건에 못박음. §7 수동 검증도 '8단계'로 갱신.
# M7(통합 충실도): 기존 '(도그푸딩 내장)' 표기만 있고 Phase 2~5 작업을 언제부터 Paperclip 업무로 발주하는지 없었음 → v0.2의 '0.4 구현 발주 게이트'가 소실. Phase 1에 5번 게이트 복원 + 여기서 상호 참조.
-->


## 2. 확정 결정 로그 (Decision Log)

| # | 결정 | 내용 |
|---|---|---|
| D1 | 제품 성격 | 개인 로컬 도구 (Mac 1인). 배포·계정·원격 서버 없음. 공개 전환은 별도 게이트 |
| D2 | 단일 원본 | **Paperclip** = 에이전트·업무·비용·승인·감사 로그의 유일한 원본. 별도 DB·이벤트 소싱 없음. **Voxel-Diorama = 상태 투영(Projection)**. GitHub = 커밋·diff·PR·테스트 결과 등 **검수 증거만** |
| D3 | 세계 구조 | 행성 로비(보관 섬 선택·열람 전용, 구면 보행 게임 아님) → 국가 테마 → 여행별 새 섬, 과거 섬 영구 보존. **v0.1 로비는 국가 마커 없는 보관 섬 평면 목록** — L3 '국가별 스프린트 군도 뷰'는 구조 유지하되 v1.1로 시점 이연 (v0.1은 테마가 base 1개뿐이라 국가 그룹핑 무의미, §9 참조) |
| D4 | 인간 전용 권한 | 승인·거절·여행 종료는 사용자만. AI 금지 목록은 §4.1. **검수 전 정지(B) 강제(2026-07-22 실사·검증)**: 에이전트는 기본적으로 승인 없이 자율 진행 → **린 B(v0.1)** = 사원에 `canAssignTasks: false`(자율 하위작업 폭주 차단, 검증됨) + 게임 층 §3.4-4('검수 우회 done→조정 필요', *인간 승인한 것만 건물*)로 게이트 근사. **완전 격리 B**(`low_trust_review` quarantine→인간 promote)는 격리 워크스페이스 인프라 필요 → **Phase 2로 이연**. 상세는 PAPERCLIP-RECON.md 게이팅 절 |
| D5 | 0.1 제외 범위 | §9 목록 (멀티플레이어·보행·HLS·Slack·수동 배치 등) |
| D6 | 주 화면 | Voxel-Diorama가 일상 운영 화면 (발주·검수 인게임, Paperclip API 호출). Paperclip UI는 관리자·감사·비상용 |
| D7 | 에셋 정책 | **Kenney CC0 원본을 kenney.nl에서 직접 다운로드** + `ASSETS.md`에 팩 이름·버전·URL 기록. task-arcade는 게임 규칙 참고만, 코드·파일 복사 금지 (AGPL clean-room) |
| D8 | 건물 배치 | **자동·결정론**: 건물 = `hash(issueId + attemptNumber)`로 티어 내 선택, 부지 = 섬 중앙→바깥 결정적 나선. 수동 배치 편집기는 v1.1 후보 |
| D9 | 반려 규칙 | 반려 = 해당 시도의 **영구 폐허**. 재작업 재제출 = 새 시도(Attempt)·새 부지, 기존 폐허 불변. 수정 요청(코멘트) ≠ 반려 — 단, **§3.2 완료 조건 중 하나라도 미충족이면 반드시 반려로 처리**하고, 수정 요청은 완료 조건을 모두 충족한 결과물의 마이너 조정에만 허용. 한 업무에 폐허 여러 개 가능, 완성 건물은 최대 1개 |
| D10 | 점수 | **고정 점수만**: Low 15 · Medium 30 · High 45 · **Critical 60** (Paperclip 우선순위 `critical/high/medium/low`에서 자동 도출 — Phase 1 실사 확정, 점수 직접 입력 없음. priority는 null 가능하므로 **발주 창에서 우선순위 선택 필수 — No priority 금지**). 섬별 + 평생 누적 표시. 점수 소비 경제 없음. 효율 보너스는 v1.1 백로그(§9)에 공식 보존 |
| D11 | 테마 순서 | **`base` 테마(Kenney)로 루프 먼저 완성 → `jp-kyoto` 버티컬 슬라이스**. 한 여행 = 고정 테마 1개(도중 변경 불가). 테마 미보유 자산 역할은 base로 fallback |
| D12 | AI 조직 | **의사결정 다양성 원칙**: 시니어급 판단을 한 모델에 몰지 않고 Claude/Codex 두 독립 계통으로 둔다. **Claude팀**(`claude_local`): Senior Developer(개발+시니어 판단) · Doc Writer(개발/플랜 문서, 저토큰). **Codex팀**(`codex_local`): Design & Planning Lead(분해·배정·넛지·리캡+UI/UX 방향+기획, Claude와 독립된 관점) · QA & Test Engineer · Doc Writer(디자인/기획 문서, 저토큰). 문서 작성 사원은 저토큰 모델. **조직도**: 두 팀장(Senior Developer·Design & Planning Lead)은 CEO 직속 독립, 팀원(각 Doc Writer·QA)은 팀장에게 `reportsTo`(조율만, 결정권은 인간 전용 D4). **v0.1은 활성 3명(두 리드+QA)만 가동, Developer·Doc Writer는 pause 대기 — 단계적 활성화 정책·트리거는 §3.1 참고.** 전담 UI/UX 디자이너·VoxelArtist는 필요 시(교토 Phase 5) 추가 고용. 어댑터별 role·보고 구조는 PAPERCLIP-RECON.md 워크포스 표 참조 |
| D13 | 브리지 | 별도 Node 앱 대신 **Vite 서버 미들웨어**로 구현 — 단일 프로세스로 Codex 요구사항(127.0.0.1 전용, 자격 증명 서버 측 보관, idempotency, 파일 원자적 쓰기) 전부 충족. 커지면 그때 분리 |
| D14 | 기존 사찰 묵업 | `plan/japanese-temple-voxels` 브랜치의 코드·PNG·복셀 모델은 **v0.1에 반입 금지** (새 파이프라인 무결성). **브랜치는 폐기 확정** (2026-07-21 사용자 결정, Codex·Gemini 최종안 일치) — 로컬+원격 삭제, main 기준 25커밋 폐기. 단 `stash@{0}`은 별도 내용이 섞여 있어 보존. 실제 삭제는 Phase 0에서 실행(되돌리기 어려워 실행 직전 확인). **반입 금지는 코드·PNG·복셀 모델에 한정** — 기존 아트 바이블 등 텍스트 문서는 검토 후 계승 가능 (M8) |
| D15 | 카메라 | 고정 아이소메트릭 + 이동·확대/축소만. 로비 행성은 스핀·선택만 |

<!-- 2026-07-21 적대적 리뷰(PLAN-REVIEW.md) 반영 — 기존 내용과 문제점 기록:
D3 기존: "행성 로비 → 국가 테마 → 여행별 새 섬"까지만. 문제: L3 잠금 결정(행성→국가→스프린트 군도)의 국가 계층이 삭제인지 이연인지 판단 불가, ThemeManifest anchor 필드도 소실 → 구조 유지 + v1.1 이연으로 확정.
D9 기존: "수정 요청(코멘트) ≠ 반려"에 사용 기준·경계 없음. 문제: 손실 회피 심리상 폐허를 피하려 수정 요청만 쓰게 되어 '반려=영구 폐허' 긴장감이 실전에서 발동하지 않음 → 완료 조건 미충족 = 강제 반려 경계 추가.
D10 이력: 리뷰(미검증 판정)가 "실제 스케일은 Urgent/High/Medium/Low + No priority"라 주장해 한때 Urgent로 바꿨으나, **Phase 1 실사(2026.720.0)에서 실제 enum은 `critical/high/medium/low`로 확인 → Critical 복원**. priority가 null 가능한 점만 실사와 일치하므로 "발주 시 선택 필수(No priority 금지)"는 우리 앱 강제 규칙으로 유지. (교훈: 실사 전 문서 인용 기반 지적은 실측으로 뒤집힐 수 있음.)
D12 기존: "초기 2명(TD+Developer), VoxelArtist는 Phase 5". 변경(2026-07-21 사용자 지시): 단일 모델(Claude) 판단에만 회사 방향을 맡기는 위험을 피하려 Claude/Codex 시니어 2계통 + 저토큰 문서 사원 구조로 확장. Claude=Senior Developer, Codex=Design & Planning Lead(구 TD 진화, 분해·배정·기획·UI/UX)+QA. 문서는 저토큰 전담 사원 2명(Claude/Codex 관점). 실제 워크포스는 Paperclip에 구성 완료(PAPERCLIP-RECON.md).
D12 ORG v4 (2026-07-27, 사용자 지시 — 외부 3안 채택): 반복되는 Opus 세션 한도 소진 대응으로 Meta-Loop 재편. **Opus=Board Advisor(온디맨드 크리틱, 핫패스 밖 — 자문은 CLI 크로스-리뷰가 수행, ThreeJSDev paused)**, **Codex(sol/terra)=Chief Operator/Senior(핫패스 주력)**, **Workers=Sonnet 5/Haiku 4.5**(구 Gemini 대체, 유료 API 미사용). 모델 라우터=복잡도+비용. **오케스트레이션은 CLI+CEO 유지**(Lean B가 에이전트 간 배정을 막으므로 에이전트 오케스트레이터 불가). 상세·라우터·Graph-of-Loops 개념 매핑은 PAPERCLIP-RECON.md "ORG v4" 참조.
-->

지휘 체계:

```
나 — CEO / 최종 검수자 (승인·거절·여행 종료 유일 권한)
│
├─ Paperclip — AI 직원·업무·예산·실행·감사 단일 원본 (승인 권한 없음)
│    │  ※ 팀장 2명은 CEO 직속 독립 시니어(다양성) · 팀원은 팀장에게 보고(조율만, 결정권 아님)
│    │  ※ v0.1은 활성 3명(●)만 가동 · 나머지(○)는 성장 트리거 시 활성화 — §3.1 참고
│    ├─ ● Engineering Lead (Claude — 아키텍처·기술 방향, v0.1 구현 겸임)
│    │    ├─ ○ Developer (Claude — 구현)
│    │    └─ ○ Doc Writer (Claude — 개발/플랜 문서, 저토큰)
│    └─ ● Product & Design Lead (Codex — 기획·UX·분해·배정, Claude와 다른 관점)
│         ├─ ● QA Engineer (Codex — 검증·증거, 교차 모델 체크)
│         └─ ○ Doc Writer (Codex — 디자인/기획 문서, 저토큰)
│
└─ Voxel-Diorama — 주 운영 화면 (본 프로젝트)
     ├─ Astryx 2D HUD: 발주 창·리뷰 큐·에이전트 패널·여행기
     └─ R3F 3D: 행성 로비 → 국가 테마 → 여행별 섬
         ├─ 승인된 업무 → 영구 건물
         └─ 반려된 시도 → 영구 폐허
```

## 3. 도메인 규칙 (Core Rules)

### 3.1 AI 조직과 권한

AI 직원이 **할 수 없는** 것: 업무 최종 승인·거절 / 여행 종료·섬 보관 / 예산 변경 / 사용자 피드백 삭제 / 완료 기록·폐허 삭제.

- Design & Planning Lead가 만든 하위 업무는 실행 구조로만 사용한다. **건물과 점수는 여행 루트 바로 아래의 최상위 결과물 업무에만** 부여해 비용·점수 중복 집계를 막는다.
- Quartermaster 규범 (task-arcade 계승): Design & Planning Lead가 넛지·스탠드업·리캡을 담당하되 검수에는 관여하지 않는다.
- 거절 피드백 제출 후 에이전트가 자동으로 재시도하지 않으면 Design & Planning Lead가 해당 피드백을 인용해 넛지하여 재작업을 시작시킨다 — 자동 여부는 Phase 1 실사에서 확정.
- 에이전트별 예산은 Paperclip 내장 기능을 사용한다 (월 단위·토큰 단위 지원 여부는 Phase 1 실사로 확정, 미지원 시 기간·단위는 실제 지원 범위에 맞춰 조정).

<!-- 2026-07-21 LOW 리뷰 반영:
# L3(기술 타당성): Paperclip SPEC.md는 에이전트 예산·토큰/달러 이중 표기·soft alert(80%)·hard ceiling(자동 일시정지)을 기술하지만 '월 단위 토큰 예산'이 명명된 기능으로 구현됐는지는 미확인(SPEC은 설계 문서) → 확정 사실처럼 기술돼 있었음. 지원 범위를 Phase 1 실사로 미룸(4번 항목에 동작 확인 추가).
-->

- **에이전트 패널** = 직원별 이름·역할·현재 작업·누적 승인/반려 전적(PlacementAttempt 집계로 산출, 별도 저장 없음). v0.1은 개발 직원 1명이라 단순 카운트로 충분 — 새 데이터 타입·저장 없음.

<!-- 2026-07-21 MEDIUM 리뷰 반영:
# M3(제품 비전): 고용은 Phase 1의 Paperclip 관리 화면으로만 처리되고 에이전트 패널이 무엇을 보여주는지 명세가 없었음 → 폐허·건물이 담당 직원과 연결되지 않으면 AI가 '직원'이 아니라 익명 배치 파이프라인이 되어 비전 (c)('직원처럼 고용') 감각이 증발. 이름·기록·책임을 지면에 부여(패널 명세 + §3.4 표 담당자 표기 + §9 여행기 서사). 스코프 제로 — 기존 PlacementAttempt 집계 재사용.
-->

> **📌 참고 — 단계적 인력 활성화 (staffing 정책)**
>
> 목표 조직(D12)은 전부 세우되, **v0.1은 활성 3명**(Engineering Lead · Product & Design Lead · QA Engineer)만 가동하고 나머지는 Paperclip `pause`로 대기시킨다. 검증 안 된 워크로드에 미리 인력을 늘리지 않는다(YAGNI). 성장 트리거가 오면 하나씩 활성화(Doc Writer는 저토큰 모델로):
>
> | 활성화 대상 | 트리거 |
> |---|---|
> | Developer (Claude) | 구현 업무가 Engineering Lead 1인으로 안 돌아갈 때(병렬 업무 발생) |
> | Doc Writer (Claude/Codex, 저토큰) | 문서 유지보수가 리드·개발자 시간을 실제로 잡아먹기 시작할 때 |
> | 전담 UI/UX 디자이너 (신규 고용) | 교토 테마(Phase 5) 또는 HUD 디자인이 병목이 될 때 |
> | VoxelArtist (신규 고용) | 교토 복셀 에셋 신규 제작 시 (D12) |

### 3.2 업무 명세 (최상위 업무 필수 필드)

제목 / 목표·배경 / **1~5개의 검증 가능한 완료 조건** / Paperclip 우선순위 (선택 필수 — No priority 금지, D10) / 담당 AI 직원 / 마감일 / 작업 저장소·워크스페이스.

### 3.3 검수 증거 패널

변경 요약 · 커밋/diff/PR 링크 · 실행·테스트 결과 · 알려진 위험과 미완료 항목 · Paperclip 실행 기록 · 비용/토큰/실행 시간.

- 증거가 일부 없어도 사용자가 **예외 사유**를 기록하면 승인 가능.
- 거절에는 **재작업 피드백 필수** — 이 피드백이 에이전트의 다음 시도 입력이 된다.
- 완료 조건(§3.2) 중 하나라도 미충족인 결과물은 반드시 반려로 처리한다. 수정 요청(코멘트)은 완료 조건을 모두 충족한 결과물의 마이너 조정에만 허용한다.

### 3.4 상태 투영 매핑

투영 로직은 Paperclip 이슈 상태(**Phase 1 실사로 확정된 고정 상태명**: `backlog · todo · in_progress · in_review · done · blocked · cancelled`)와 blocker 의존성(`blockedByIssueIds`)을 기준으로 동작한다. 검수는 네이티브 Approval 객체(approve/reject/request-revision/resubmit)로 처리한다 — 매핑 근거는 PAPERCLIP-RECON.md.

| Paperclip 상태 | 3D 세계 표현 | Astryx HUD |
|---|---|---|
| (활성 여행 없음) | 3D 섬 장면 없음 — 행성 로비만 표시. 첫 실행도 이 상태 | '여행 시작' 단일 CTA |
| `backlog`, `todo` | 미건설 (빈 부지) | 대기 중 발주 목록 |
| `in_progress` | 공사 중 마커 | 담당 직원 이름 + 작업·시간 표시 |
| `in_review` | 반투명 미리보기 건물 | [검수 필요] 증거 패널 노출 |
| 사용자 승인 → `done` (approval approve) | 완성 건물 (영구) | 점수 획득 + 담당 직원 표기, 카탈로그 고정 |
| 사용자 거절 → `todo` (approval reject) | 붕괴 연출 → 폐허 (영구) | 반려 사유 필수 + 담당 직원 표기 |
| 수정 요청 (approval request-revision) | 미리보기 → 공사 중 마커로 전환 (`in_progress` 복귀) — 반려 아님, 완료 조건 전부 충족 시에만 (D9). 전이 상세: 규칙 6 | 피드백 전달 |
| Paperclip에서 검수 우회 직접 `done` | 조정 필요 — 자동 건물 없음 | [조정 필요] 표시 |
| `cancelled` | 진행 표식 제거. 신규 건설·폐허 생성 없음 — 이전 거절로 생긴 폐허는 D9대로 영구 보존 | 취소 기록 |
| `blocked` (+ blocker 의존성 `blockedByIssueIds` 폴링 병행 조회) | 경고 표식, 폐허 없음 | 차단 사유 표시 |

<!-- 2026-07-21 리뷰 반영 + Phase 1 실사(PAPERCLIP-RECON.md)로 정정:
# HIGH(유지): (활성 여행 없음) 행 신설. 수정 요청 행 사용 기준(D9). cancelled 폐허 보존(D9 '기존 폐허 불변').
# M3(유지): 작업·승인·거절 행 HUD에 담당 직원 표기 — 직원 감각 복원.
# M9(실사로 정정·되돌림): M9는 "Paperclip이 6개 카테고리 안 커스텀 상태이므로 in_review 미보장·blocked는 관계"라 가정해 표를 카테고리 기반으로 재작성했으나, 실제 API(2026.720.0)의 이슈 상태 enum은 고정 `backlog/todo/in_progress/in_review/done/blocked/cancelled` → in_review·blocked 모두 1급 상태로 실재. 표를 고정 상태명으로 복원. 단 blocker 의존성(blockedByIssueIds)도 별개로 존재하므로 blocked 상태 + 관계 병행 조회는 유지(M9의 이 통찰만 반영). 규칙 1도 'in_review 첫 진입'으로 복원.
-->



**PlacementAttempt 규칙** (멱등성의 핵심):

1. `in_review` 첫 진입 시 열린 `PlacementAttempt` 하나를 만든다.
2. 반복 폴링·앱 재시작은 같은 시도를 중복 생성하지 않는다.
3. 거절할 때마다 현재 시도는 폐허가 되고, 다음 검토는 새 부지를 쓴다.
4. Paperclip 화면에서 검수를 거치지 않고 직접 `done`으로 바뀐 업무는 자동으로 건물을 만들지 않고 **조정 필요** 상태로 표시한다 (검수 우회 방지).
5. 이미 보관된 섬은 수정하지 않는다.
6. 수정 요청(approval request-revision)은 열린 `PlacementAttempt`를 닫지 않고 유지한다 — `in_progress` 복귀, 같은 부지 재사용, 재검수(`in_review`) 진입 시 기존 시도 재사용 (반려 아님, 폐허 없음). resubmit은 새 시도가 아니라 같은 시도의 재제출.

<!-- 2026-07-21 LOW 리뷰 반영:
# L1(내부 일관성): §3.4 '수정 요청' 행이 '공사 중 마커 유지'라 했으나 수정 요청은 검수 중(미리보기 건물) 발생 → 유지할 '공사 중 마커'가 없어 표 내부 모순. 또 수정 요청 후 상태 전이(검수 유지 vs 작업 복귀)가 미정의라 미리보기↔마커 전환 구현이 혼란. 행을 '이벤트'로 명시(M9에서 이미 반영) + 규칙 6으로 전이 확정(작업 복귀·시도 유지·부지 재사용).
-->


### 3.5 여행(Trip = 스프린트) 규칙

- 활성 여행은 한 번에 하나.
- 여행 시작 시 Paperclip에 **여행 루트 업무**를 만들고 실제 업무를 그 하위에 둔다.
- 테마는 여행 시작 때 선택, 도중 변경 불가.
- 여행 도중 최상위 업무 추가는 언제든 가능하다 (종료 조건은 아래 done/cancelled 규칙 그대로).
- 모든 최상위 업무가 `done` 또는 `cancelled`일 때만 종료 가능.
- 재작업을 포기한 거절 업무는 사용자가 `cancelled`로 전환해 여행을 종료할 수 있다. 취소 업무는 점수 0이며, 해당 업무의 폐허는 종료 스냅샷에 포함된다.
- 종료 시 제목·담당자·점수·건물·폐허·피드백·증거 링크를 **불변 스냅샷**으로 저장한다.
- **구현 시점**: 여행 시작(루트 업무 생성 + `POST /api/trips`)은 Phase 2부터, 종료·보관은 Phase 4부터 구현한다. Phase 2~3의 최상위 업무는 base 고정 여행의 루트 아래에 배치된다.
- 권장 관례 (규칙 아님): 프로젝트 ↔ 국가 1:1 — 행성이 프로젝트 지도가 되도록.

<!-- 2026-07-21 MEDIUM 리뷰 반영:
# M1(내부 일관성): §3.1은 건물·점수를 '여행 루트 바로 아래 최상위 업무'로 정의하고 D3·§3.5는 섬을 여행 단위로 생성하는데, 여행 시작·종료가 Phase 4에서야 도입되어 Phase 2~3에는 여행 루트가 없음 → Phase 3 섬이 소속될 여행과 '최상위 업무' 판정 기준이 미정, 비용·점수 중복 방지 규칙이 적용 근거를 잃음(의존성 역전). 여행 '시작'만 Phase 2로 당기고 Phase 4는 종료·보관으로 축소. '암묵적 기본 여행'보다 시작을 앞당기는 쪽이 나중 마이그레이션 비용이 없어 더 단순.
-->


## 4. 기술 구조

### 4.1 구조 원칙

- **Vite + React + TypeScript 단일 앱.** 모노레포·마이크로서비스·별도 DB·이벤트 소싱·WebSocket 없음.
- React Three Fiber = 섬·행성 장면. Astryx = 2D HUD와 테마 토큰만 (버전 고정, 최악 시 일반 CSS 변수 폴백).
- **스택 버전 기준선**: React 19 + react-dom 19 · @react-three/fiber v9 (+@react-three/drei v10 계열) · Astryx(`@astryxdesign/core`)는 정확 버전 pin (캐럿 금지) · `@stylexjs/stylex` peer dependency 명시 설치. Astryx가 React ≥19를 요구하며 이것이 R3F v9을 강제한다.

### 4.2 브리지 (Vite 서버 미들웨어)

브라우저 ↔ Paperclip(localhost:3100) 사이의 얇은 로컬 계층. 별도 프로세스 없이 Vite dev 서버 플러그인으로 구현한다.

> ✅ **Phase 1 실사로 확정** (PAPERCLIP-RECON.md). `/review`의 approve/reject/request_changes는 Paperclip 네이티브 approval(`POST /api/approvals/{id}/approve|reject|request-revision`, `decisionNote`)로, 재작업 재제출은 `resubmit`로 매핑. 트러스트 로컬 loopback에서 브리지는 Board(인간) 권한으로 호출한다(별도 키 불요; 비-신뢰 배포 시 BoardApiKey).

- `GET  /api/bootstrap` — 활성 여행·업무·직원·캐시 상태 (활성 여행 없으면 `trip: null` + 보관 목록만 반환)
- `POST /api/trips` — 여행 시작
- `POST /api/tasks` — 최상위 업무 생성 (활성 여행 없으면 409)
- `POST /api/tasks/:id/review` — 검수 결정 `approve | reject | request_changes` (**idempotency key 필수**) → Paperclip approval `approve`/`reject`/`request-revision` 호출. `request_changes`는 반려 아님 (D9). 재작업 재제출은 approval `resubmit`
- `POST /api/tasks/:id/cancel` — 업무 취소 (§3.5 종료 조건의 `cancelled` 전이 대응, idempotency key 적용)
- `POST /api/trips/:id/archive` — 여행 종료·스냅샷 저장

<!-- 2026-07-21 리뷰 반영 — 기존 문제점:
# HIGH#5: review가 "승인/거절" 2종뿐이라 D9의 '수정 요청(코멘트)' 흐름을 주 화면(D6)에서 수행할 경로가 없었음 → request_changes로 확장. bootstrap/tasks는 활성 여행 없음 상태의 동작이 미정이었음.
# M2(내부 일관성): §3.5 종료에 필요한 cancelled 전이를 인게임(D6)에서 수행할 라우트가 없어 여행 종료가 인게임에서 완결 안 됨 → /cancel 추가. (M2가 함께 제안한 /comment 엔드포인트는 HIGH#5의 request_changes가 이미 커버하므로 별도 생성하지 않음 — 중복 회피.)
# M10(기술 타당성) → ✅ 실사 해소: 네이티브 approval API(approve/reject/request-revision/resubmit) 실재, 트러스트 로컬 loopback = Board(인간) 권한으로 승인 가능. 인간 vs 에이전트 권한이 securitySchemes(BoardApiKey vs AgentBearer)로 분리. 폴백(상태전이+코멘트) 불필요.
-->


규칙: `127.0.0.1` 전용 바인딩 · **same-origin 요청만 허용(`Origin` 헤더 검증)** · Paperclip 자격 증명은 서버 측에만(브라우저 미노출) · 쓰기 도중 앱 종료 시 다음 실행에서 상태 재조회로 미완료 요청 조정.

<!-- 2026-07-21 3자 통합(Codex·Gemini 최종안 대조) 반영:
# Codex 채택: 브리지가 앱을 제공하면서 Paperclip을 프록시하므로 CSRF류 방지를 위해 127.0.0.1 바인딩 외에 Origin 헤더 same-origin 검증을 추가(로컬 도구라도 다른 로컬 페이지의 교차 요청 차단).
-->


### 4.3 폴링 정책

앱이 보이는 동안 5초 간격 폴링, 숨겨지면 중단. 쓰기 직후 즉시 재조회. 폴링 시 상태(카테고리) 외에 blocker 의존성 관계도 함께 조회한다 (§3.4 blocker 행, M9). 웹훅/실시간은 v1.1 검토.

### 4.4 저장

| 데이터 | 위치 | 규칙 |
|---|---|---|
| 라이브 세계 상태 (`world-state.json`) | `~/Library/Application Support/Voxel-Diorama/` | `schemaVersion` 포함 · 임시 파일 작성 후 원자적 rename · 직전 정상본 `.bak` 유지 · Paperclip 오프라인 시 마지막 상태 읽기 전용 표시 · 자격 증명 저장 금지 |
| 동결 스냅샷 (여행 종료) | 저장소 내 `content/sprints/*.json` | 불변 · git으로 이력 보존 가능 |
| Paperclip 업무 본문·실행 로그 | 저장하지 않음 | 원본 중복 금지 (D2) |

### 4.5 주요 데이터 타입

`WorldState`(스키마 버전·활성 여행·평생 점수·보관 목록) · `Trip`(루트 업무 ID·테마 ID·시작일·활성) · `TaskProjection`(Paperclip 업무를 UI·3D가 쓸 형태로 투영한 **읽기 모델** — 원본 복제 아님, D2) · `PlacementAttempt`(업무 ID·시도 번호·부지·자산 ID·결과) · `ReviewDecision`(승인/거절·사유·증거 예외·처리 상태) · `TripArchive`(불변 스냅샷) · `ThemeManifest`(UI 토큰·환경·지형·티어별 건물·폐허 자산·fallback).

<!-- 2026-07-21 3자 통합 반영:
# Codex 채택: TaskProjection 읽기 모델을 명시 — Paperclip 원본 데이터와 UI·3D가 쓰는 투영 형태를 타입으로 분리해 D2('원본 중복 금지')를 구조로 강제. 기존엔 투영 로직만 있고 읽기 모델 타입이 이름으로 없었음.
-->


### 4.6 디렉토리 구조

```
Voxel-Diorama/
  PLAN.md                      # 이 문서
  THIRD_PARTY.md               # clean-room 기록 (task-arcade·TWB=AGPL 참고만, Astryx=MIT)
  ASSETS.md                    # Kenney 팩 이름·버전·다운로드 URL (재현성)
  index.html / vite.config.ts  # 단일 Vite 앱 + 브리지 미들웨어 플러그인
  src/
    lobby/                     # 행성 로비 + 보관 섬 열람
    island/                    # R3F 섬: 그리드·배치·붕괴·폐허·마커
    hud/                       # Astryx: 발주 창·리뷰 큐·에이전트 패널·여행기
    paperclip/                 # REST 어댑터 + 상태 투영 로직
    state/                     # world-state 동기화·스냅샷 동결기
    themes/                    # 테마 레지스트리·로더·4단계 전환 파이프라인
    schema/                    # Zod: ThemeManifest / Snapshot / 브리지 API 계약
  bridge/                      # Vite 미들웨어 구현 (검수·여행·idempotency 로직)
  content/
    themes/base/  themes/jp-kyoto/   # manifest.json · ui-tokens.json · catalogue.json
    sprints/                   # 동결 스냅샷 (불변)
  assets/
    common/kenney/             # CC0 킷 (base 테마)
    themes/jp-kyoto/           # 교토 테마 신규 제작 GLB
```

## 5. 테마·에셋 정책

- **라이선스**: Kenney 에셋은 CC0(상업 이용 가능·출처 표기 불요)이며 원본 팩에서 직접 받는다. Kenney 로고는 사용하지 않는다. task-arcade·Tiny World Builder는 규칙·경험 참고만(코드·파일 복사 금지). 모든 출처는 `THIRD_PARTY.md`/`ASSETS.md`에 기록.
- **base 테마**: Kenney 자산으로 구성한 무국적 기본 섬. 루프 증명 전용이자 모든 테마의 fallback.
- **jp-kyoto 테마**: 기존 사찰 묵업을 재사용하지 않고 신규 제작 — MagicaVoxel→Blender→GLB 자체 제작 + magicpixel.art/GPT Image 생성 트랙 병용. 차분한 녹색·대나무 계열 UI 토큰. 문화 표현은 아트 바이블 do/don't + 검수 기록 규율 적용.
- **테마 전환 (Zero-Leak 4단계 파이프라인)**: ①Astryx 전환 마스크(CSS/WAAPI 우선) → ②이전 테마 청크·텍스처·재질 완전 dispose → ③새 manifest의 GLB·InstancedMesh 로드 + UI 토큰 CSS 커스텀 프로퍼티 주입 → ④마스크 해제, 3D와 UI 동시 공개. 전환 중 오류 시 base 테마로 복구.
- **연출**: 승인 시 건물 솟는 애니메이션, 반려 시 붕괴→폐허 프리셋 1종. 물리 파편 없음. 승인/반려 확정 클릭 시 카메라(D15)가 해당 부지로 자동 이동한 뒤 건물 솟기(승인) 또는 붕괴→폐허(반려) 연출과 점수 카운트업을 재생한다 — HUD에서의 확정이 반드시 3D 연출로 이어진다. `prefers-reduced-motion` 시 카메라 컷 전환 + 즉시 상태 반영으로 대체.

<!-- 2026-07-21 리뷰 반영 — 연출 기존 문제점: 승인 행위(2D HUD 클릭)와 3D 연출을 연결하는 명세가 없어, 건물이 섬 어딘가에서 조용히 솟으면 핵심 재미('업무를 끝내면 섬에 건물을 놓는다')가 로그 갱신 수준으로 죽음 → 클릭→카메라 이동→연출 연결을 명세. -->

## 6. 실행 로드맵 (Phase 0~5)

### Phase 0 — 저장소·환경 기준선
1. `main`으로 전환 후 **`plan/japanese-temple-voxels` 브랜치 폐기** — 로컬+원격 삭제, 25커밋 폐기 (D14). 되돌리기 어려우므로 정확한 삭제 명령을 보이고 확인받은 뒤 실행. `stash@{0}`은 삭제하지 않고 보존.
2. `main`에서 구현 브랜치(`feat/ai-workforce-island-v0.1`) 생성, 이 문서를 기준으로 커밋.
3. Kenney CC0 팩 다운로드 → `assets/common/kenney/` + `ASSETS.md` 기록 (다운로드는 사용자 승인 후).
- ✅ 체크포인트: 묵업 브랜치 폐기 완료 + 깨끗한 구현 브랜치 + 기준 문서 + 플레이스홀더 에셋 확보.

<!-- 2026-07-21 3자 통합 반영 (Phase 0):
# Codex·Gemini 채택 + 사용자 결정: 기존 D14 '보존'을 '폐기 확정'으로 변경. Codex Phase 0("브랜치 삭제, 15커밋 폐기")·Gemini D5/Phase 0("파괴적 폐기/격리")가 모두 삭제였고 사용자가 폐기로 확정. 실제 커밋 수는 25개(Codex 문서의 15는 부정확). 파괴적·원격 영향이라 실행은 Phase 0 착수 시 명령 확인 후.
-->


### Phase 1 — Paperclip 안전 재설치·실사
1. 실행 중 프로세스·기본 데이터 디렉터리·`PAPERCLIP_HOME` 재확인. 사용자 데이터 발견 시 **삭제하지 않고 백업 후 중단·보고**.
2. 최신 안정 태그로 로컬 신뢰 모드 설치, 버전 기록.
3. D12 워크포스 고용 (Claude팀·Codex팀). 승인 권한은 인간에게만. 문서 작성 사원은 저토큰 모델로 지정(LLM 자격 설정 시 확정).
4. **API 실사 — ✅ 완료 (2026-07-21, PAPERCLIP-RECON.md + paperclip-recon/fixtures/)**. 확정: 이슈 상태 고정 enum `backlog/todo/in_progress/in_review/done/blocked/cancelled`(§3.4) · 우선순위 `critical/high/medium/low`(선택, D10) · 검수는 네이티브 approve/reject/request-revision/resubmit · 트러스트 로컬 loopback = Board(인간) 권한(승인 가능, M10 해소) · 고용 `agent-hires`(Developer=engineer, TD=pm/cto) · 예산 `budgetMonthlyCents`+정책+인시던트(L3 해소) · blocker `blockedByIssueIds` 별도 조회 · 비용 `/issues/:id/cost-summary`. openapi.json·주요 스키마 fixture 저장. **남은 라이브 검증은 아래 체크포인트.**
5. **구현 발주 게이트**: 이 시점부터 Phase 2~5의 각 항목을 Paperclip 최상위 업무로 분해·발주해 Design & Planning Lead가 배정하고 Senior Developer가 수행한다 — 첫 스프린트 섬 = 이 게임을 만드는 과정 자체(도그푸딩). Phase 2 새 화면 완성 전까지의 발주·검수는 Paperclip 기본 UI로 수행한다 (Phase 2.3과 연결).
- ✅ 체크포인트: **API 계약 실사 완료**(PAPERCLIP-RECON.md). 남은 라이브 검증 — 실제 업무 1개를 생성·배정할 수 있고, 비용·실행 시간이 조회되며, AI에게 승인 권한이 없다. 거절 피드백 제출 → 에이전트가 재시도를 시작하는 경로를 확인한다 (자동 재배정인지 TD 넛지 필요인지 기록). **브리지(또는 curl 등 외부 클라이언트) 경유로 승인 1회·거절+반려 피드백 1회가 Paperclip에 실제 반영됨을 확인** — 여기서 D6(주 화면 전환) 성립 여부가 판가름 난다.

<!-- 2026-07-21 MEDIUM 리뷰 반영 (Phase 1):
# M7(통합 충실도): v0.2의 '0.4 구현 발주 게이트'(구현 Phase를 Paperclip 티켓으로 분해·발주 = 도그푸딩)가 로드맵에서 소실 → 개발 체제가 "나+AI 워크포스"인데 발주 절차·시점이 없었음. 5번으로 복원. (닭-달걀 문제는 Phase 2.3이 이미 답함.)
# M9(기술 타당성): 4번 '상태명 실사'를 '카테고리·커스텀 상태·blocker 관계 실사 + 검수 상태 보장'으로 확장 — 이름만 바꾸면 되는 문제가 아니라 투영을 카테고리+설정 상태 ID로 설계해야 하므로.
# M10(기술 타당성): 승인/거절 API 존재·권한 모델이 미확인인데 §4.2가 확정 어조 → Phase 1 체크포인트에서 '외부 클라이언트 경유 승인/거절 실제 반영'을 D6 성립 판정 기준으로 못박아 Phase 2 착수 전에 검증되게 함.
-->


### Phase 2 — 부트스트랩 관리 화면 (3D 없음)
1. 브리지 미들웨어 + Astryx로 업무 목록·생성·증거 조회·승인/거절 화면 구현.
2. Paperclip 오프라인·인증 실패·조정 필요 상태를 명시적으로 표시.
3. 이 단계까지는 Paperclip 기본 UI를 병행 사용, 새 화면에서 발주·검수가 가능해지면 주 화면 전환.
4. **여행 시작 최소 구현**: `POST /api/trips`로 여행 루트 업무 생성(테마 base 고정). 이후 최상위 업무는 이 루트 바로 아래에 배치 — §3.1의 최상위 판정과 비용·점수 중복 방지 규칙이 Phase 2부터 유효.
- ✅ 체크포인트: §1 루프의 **1~5단계를 3D 표현 없이 완주** 가능 — 업무 생성 → 에이전트 수행 → 증거 확인 → 거절(재작업 피드백 기록) → 재제출 → 승인, 각 단계가 Paperclip 상태에 반영됨. 여행 시작/종료·건물/폐허 렌더는 각각 Phase 4·3 범위로 제외. 중복 요청·재시작으로 Paperclip 상태가 두 번 변경되지 않는다. Astryx HUD와 R3F Canvas(빈 씬)를 동일 앱에서 렌더해 peer 의존성 충돌 없음을 1회 실증.

<!-- 2026-07-21 MEDIUM 리뷰 반영 (Phase 2):
# M1(내부 일관성): '여행 시작 최소 구현'(4번)을 Phase 2로 당겨 최상위 업무 판정 근거 확보(§3.5 주석 참조).
# M6(1인 범위): 기존 체크포인트 '3D 없이 전체 업무 루프 수행 가능'은 §1 7단계에 폐허·건물(3D)·여행 종료가 포함돼 어떤 부분집합이 통과인지 열거되지 않음 → 완료 판정이 그때그때 해석에 달림. §1 대비 제외 항목(3D 렌더=Phase 3, 여행 시작/종료=Phase 4)을 명시해 해석 없이 체크 가능하게 함.
-->


### Phase 3 — 기본 3D 업무 루프 (base 테마)
1. 활성 여행의 평면 아이소메트릭 섬 구현, §3.4 투영 렌더 — 필요 시 회색 프리미티브로 루프를 먼저 검증한 뒤 같은 Phase 안에서 Kenney 자산으로 교체 (Codex greybox-first 절충).
2. 결정적 건물 선택 + 나선 부지 배치 (D8).
3. 거절→폐허 보존, 재작업→새 부지. 점수 표시.
4. 활성 섬의 건물/폐허 클릭 → HUD에 업무 카드 표시(제목·담당 직원·시도 번호·승인 기록 또는 반려 사유·증거 링크). 신규 데이터 없음 — PlacementAttempt·ReviewDecision 조회 + 리뷰 큐 기존 카드 컴포넌트 재사용. (Phase 4 보관 섬 재열람은 이 클릭 동선을 읽기 전용으로 재사용.)
- ✅ 체크포인트: 실제 업무 1개를 거절 후 재작업 승인했을 때 폐허 1 + 건물 1이며, **각각 클릭 시 해당 시도의 반려 사유/승인 기록이 표시된다**. 재시작·반복 폴링 후에도 결과 동일. 승인/반려 클릭이 해당 부지 카메라 이동·연출로 이어지는 것을 확인.

<!-- 2026-07-21 MEDIUM 리뷰 반영 (Phase 3):
# M1(내부 일관성): 1번을 '활성 여행의 섬'으로 명시 — Phase 2에서 당겨온 여행에 섬이 소속되게.
# M4(제품 비전): 기존엔 '건물·폐허·검수 사유·증거 확인'이 Phase 4 보관 섬 재열람에만 있고, 지금 일하는 활성 섬에서 폐허를 클릭해 '누가·왜 실패했나'를 보는 동선이 없었음 → 폐허가 이야기 없는 회색 덩어리면 '영원히 남아 모두가 본다'의 무게가 사라짐. 활성 섬 클릭 카드를 Phase 3로. 신규 데이터·컴포넌트 없이 기존 것 재사용.
-->


### Phase 4 — 여행 종료와 보관
1. 여행 종료 규칙(§3.5) 적용 (`POST /api/trips/:id/archive`), 종료 시 불변 스냅샷. (여행 시작은 Phase 2에서 이미 구현.)
2. 섬 점수 + 평생 점수 표시.
3. 최소 행성 로비: 보관된 섬 선택·재열람 (보행 없음). 보관 섬은 평면 목록 — 국가 그룹핑 없음, 군도 뷰는 v1.1 (D3). 재열람은 Phase 3의 건물/폐허 클릭 카드 동선을 읽기 전용으로 재사용.
- ✅ 체크포인트: 종료된 섬을 행성에서 다시 열어 건물·폐허·검수 사유·증거 링크 확인 가능. 새 여행은 빈 섬에서 시작.

<!-- 2026-07-21 MEDIUM 리뷰 반영 (Phase 4):
# M1(내부 일관성): 여행 '시작'을 Phase 2로 옮겼으므로 Phase 4는 '종료와 보관'으로 제목·범위 축소 — 시작/종료가 한 Phase에 몰려 의존성이 역전되던 문제 해소.
# M4(제품 비전): 보관 섬 재열람이 Phase 3 클릭 카드 동선을 읽기 전용 재사용한다고 명시 — 중복 구현 방지.
-->


### Phase 5 — jp-kyoto 테마 버티컬 슬라이스
1. **교토 아트 바이블(do/don't 목록 + 검수 기록 양식) 작성 → 이를 기준으로** 교토 테마 자산 신규 제작 (필요 시 VoxelArtist 고용 검토 — D12).
2. 대나무/녹색 Astryx 토큰 + 3D 환경 연결, 여행 시작 시 base/kyoto 선택.
3. 4단계 전환 파이프라인 적용, 오류 시 base 복구.
- ✅ 체크포인트: 두 테마로 각각 여행 시작 가능. 교토 자산이 아트 바이블 기준으로 검수 기록을 남김. 테마 10회 왕복 전환에도 메모리·GPU 자원이 증가하지 않는다(기술). 전환이 중간 상태 노출 없이 하나의 연출로 체감됨 — 마스크 중 이전 테마 잔상·UI 토큰 불일치 프레임이 보이면 미완료(경험, §1-8).

<!-- 2026-07-21 MEDIUM 리뷰 반영 (Phase 5):
# M8(통합 충실도): §5·§8이 아트 바이블을 리스크 대응책으로 두 번 참조하지만 이를 작성·확보하는 단계가 로드맵 어디에도 없었음(v0.2는 '0.3 교토 아트 바이블'을 명시 산출물로 뒀음) → 1번을 아트 바이블 선행 산출물로 수정, 체크포인트에 검수 기록 추가. 기존 문서 계승 여부는 D14 주석에서 확정.
# M5(제품 비전): 체크포인트가 '10회 왕복 메모리 무증가'라는 기술 검증뿐이라 전환 연출의 감흥(비전 b)이 어느 게이트에서도 확인 안 됨 → Phase 5가 기술 부채 정리처럼 소화될 위험. 경험 기준(중간 상태 노출 없는 연속 전환)을 기술 기준과 병기. §1-8 성공 조건과 짝.
-->


## 7. 검증·품질 기준

**자동 검증** (각 항목이 실패하면 루프의 신뢰가 깨지는 지점):
모든 Paperclip 상태↔세계 상태 매핑 · 반복 폴링 시 시도/건물/폐허 중복 방지 · 거절 후 새 시도 생성 · 승인/거절 중 앱 종료 후 조정 · 점수 경계값(우선순위 매핑·집계) · 원자적 저장과 `.bak` 복구 · 보관 여행 불변성 · 테마 fallback과 자원 해제 · (선택) 시도당 수정 요청 2회 초과 시 승인/반려 강제.

**수동 종단간 검증** = §1 성공 조건 8단계 그대로 (8번 테마 전환 연출 포함, M5).

**품질**:
- 건물·폐허·장식 합계 100개 기준 60fps (사용자 Mac). 부족하면 그림자·후처리부터 줄이고 구조를 복잡하게 만들지 않는다.
- 참고 상한 (기존 플랜 계승): draw call ≤ 150 · visible triangle ≤ 300k · active texture ≤ 128MB.
- 키보드로 주요 검수 기능 사용 가능 · `prefers-reduced-motion` 지원.
- 완료 정의: 런타임 검증 + 테스트 + 문서 갱신 + 사용자 검수 통과.

## 8. 리스크 표

| 리스크 | 대응 |
|---|---|
| Paperclip API 계약 (상태·우선순위·승인·인증·예산) — ✅ Phase 1 실사 확정 (PAPERCLIP-RECON.md). 남은 미확정: 웹훅 유무·거절→재작업 자동 여부 | 고정 상태 enum·네이티브 approval·Board 권한 확인. 라이브 승인/거절 실증은 Phase 1 체크포인트. 폴링 폴백 항상 유효 |
| `~/.paperclip` 잔존 데이터 | 백업 우선 절차 (Phase 1.1) — 발견 시 중단·보고 |
| Astryx beta API 변동 · React 19/R3F v9 강결합 | 정확 버전 pin + 토큰 계약 자체 소유 → CSS 변수 폴백. 스택 교체 시 연쇄 영향 함께 기록 |
| 에이전트 산출물 품질 | 인간 전용 검수 + 증거 패널 + "반려=영구 폐허" 규칙 |
| 상태 동기화 중복·유실 | PlacementAttempt 멱등 규칙 + idempotency key + 원자적 쓰기 + 자동 검증 목록 |
| 붕괴 연출·아트 스코프 크리프 | 프리셋 1종 · base 테마 먼저 · 교토는 Phase 5 격리 |
| 문화적 고정관념 (교토 테마) | 아트 바이블 do/don't + 검수 기록 |

## 9. v0.1에서 하지 않는 것 → 백로그

**하지 않는 것**: 기존 사찰 묵업 재사용 · task-arcade 코드 복사 · Slack/외부 메신저 연동 · 멀티플레이어·관전 · 자유 보행·구면 중력·BVH 충돌 · 물리 붕괴 애니메이션 · 수동 배치 편집기 · WebSocket 실시간 동기화 · HLS/음악 스트리밍 · 점수 소비 경제 · KR/GR 등 추가 국가 · 원격 배포.

**v1.1 후보** (우선순위 순):
1. 수동 배치 — 승인 모달에서 부지 1클릭 선택 (원작의 "직접 놓는 재미" 복원)
2. 효율 보너스 점수 — Codex 공식 전문 보존: 동일 프로젝트·우선순위 승인 이력 5개 이상 시, 비용·시간 중앙값 대비 효율로 `clamp((효율−1)×0.2, 0, 0.2)` 보너스 (최대 20%, 페널티 없음). **엣지 규칙**: (a) 누락되거나 0 이하인 측정값은 제외 (b) 사용 가능한 측정값이 없으면 보너스 0 (c) 비용·시간이 모두 있을 때만 기하평균, 하나만 있으면 그 값 사용 (d) 최종 점수 = 기본 점수 + round(기본 점수 × 보너스율). **검증**: 데이터 부족·누락·0값·20% 상한
   <!-- L2(통합 충실도): '(Codex 공식 보존)'이라 적고 5개 이력 조건 + clamp만 남겨 엣지 규칙 4개(누락/0값 제외·측정값 없으면 0·둘 다 있을 때만 기하평균·round 합산)가 소실 → v1.1에 이 항목만 보고 구현하면 미명세. 이 문서가 유일 기준(서문)이므로 외부 참조 대신 본문에 규칙 병기. -->
3. 에이전트 제안 배치 마커 · 여행기(리캡) 자동 생성 고도화(직원별 서사 포함 — MVP는 담당자 표기만, M3) · 웹훅 실시간화
4. KR(서울) 테마 — 데이터 팩 계약 검증 겸용 · 행성 국가 마커 + 국가별 군도 뷰(L3 이연분) 함께 도입 — 이때 ThemeManifest에 `anchor`(행성 위 국가 위치) 필드 복원
5. BGM 루프 (HLS 아님)
6. world-state 저장 **파일 경로 단위 공유 직렬화** — 현재 저장 큐가 `WorldStateStore` 인스턴스별(private queue)이라, 같은 `world-state.json` 경로를 가리키는 인스턴스가 2개 이상 동시에 save하면 직전 정상본(.bak) 상태가 유실됨(VOX-20 QA 반례: main tick 0→1→2 중 1이 보존 안 됨). v0.1은 단일 로컬 Vite 프로세스·단일 스토어 인스턴스 전제(§4.4)라 무관 → §3.3 예외 승인(VOX-12). 개선안: 경로당 모듈 레벨 싱글턴 락(같은 경로 큐 공유) 또는 경로당 스토어 인스턴스 재사용 가드. 회귀 테스트로 위 반례 추가 후 재검증 필요
   <!-- VOX-20(Codex Terra QA)이 잡은 유일 FAIL. 단일 인스턴스 완료 조건은 전부 PASS. 다중 인스턴스는 v0.1 런타임 시나리오가 아니라 코드 실수 경로 → 지금 파일 락을 넣는 것은 v0.1 과설계(YAGNI). 구현자(Codex Sol)도 '알려진 위험'으로 선명시. -->
7. 업무 생성 **재시도 멱등키 유실 → 드문 중복** — 단일 슬롯 retry 메모리라, A제출 실패→다른 draft B 제출→A 재제출 시 A의 원래 멱등키가 유실되고 새 UUID가 발급됨. A의 첫 요청이 서버엔 도달·성공했으나 클라가 네트워크 오류로 본 경우, 재시도가 새 키라 서버 멱등 backstop이 안 걸려 중복 생성 가능. 개선안: 미해결 제출의 멱등키를 draft별로 보존(키 맵). 회귀 테스트로 위 인터리빙 추가.
   <!-- VOX-21(Claude 교차 QA)이 잡은 비블로커. 완료 조건 '재시도 중복 없음'의 핵심 약속을 건드리나, v0.1은 loopback(127.0.0.1) 통신이라 '서버 성공+클라 네트워크 오류' 트리거가 사실상 발생 안 함 → 백로그. 흔한 경합(동시 제출·지연 GET)은 실측 PASS. -->
8. 업무 생성 **companyId 빈 값 시 발주 폼 미비활성** — `PAPERCLIP_COMPANY_ID` 누락 시 목록은 명시 에러를 내지만 우측 발주 폼은 살아 있어 제출하면 `/api/companies//issues`로 POST됨. 개선안: companyId 없을 때 발주 폼 disable/제출 가드. 트러스트 경계(설정 누락) 입력 검증 일관성.
   <!-- VOX-21(Claude 교차 QA) 비블로커. 트리거가 빌드 설정 누락(이미 목록 에러 표시)이라 무해에 가깝고 malformed POST는 실패할 뿐 → 백로그. 폼 2줄 가드로 해소 가능. -->
9. 여행 시작 **save 실패→동일 key 회복 영구 회귀 테스트 부재 (test debt)** — `tripsApi`의 save 1회 실패 후 동일 idempotency-key 재시도 회복(업스트림 `trip:K` 멱등 의존)은 scratch 재현·Claude 크로스-리뷰로 PASS 확인됐으나 영구 테스트가 없음. `tripsApi.test.ts` mock이 같은 업스트림 key 재시도에 새 이슈를 생성(Paperclip 멱등 미모델링). 개선안: mock에 업스트림 멱등 반영 + 위 인터리빙 회귀 테스트 추가.
   <!-- VOX-23(Codex Terra QA) 후속. 기능은 동작하나 리팩터 시 회복이 깨져도 잡을 테스트가 없음 → v0.1 허용 test debt. -->
10. 여행 시작 **`tripsApi.ts` readBody 크기 상한 없음** — 빠른 경로(201 멱등 replay / 409 active 존재)로 응답한 뒤에도 `readBody`가 백그라운드에서 body를 계속 소비, 큰 느린 본문이 응답 후에도 최대 10초 버퍼/타이머 유지. 로컬 가용성/자원 위험. 개선안: readBody에 최대 바이트 상한(초과 시 413) + 빠른 경로에서 미사용 body 조기 파기.
   <!-- VOX-23(Codex Terra QA) 후속. loopback·단일 사용자 v0.1에선 실위험 낮음 → 백로그. -->
11. 승인 액션 **인간 vs 에이전트 인증 게이트 (Phase 2 하드닝)** — `/api/tasks/:id/review` 브리지는 same-origin을 요구하나 `isSameOrigin`이 Origin 헤더 없는 요청을 신뢰(비브라우저 호출 허용 설계) → 로컬 비브라우저 프로세스가 approve/reject를 구동 가능. D4(승인=인간 전용)의 기술 게이트가 없음. **단 새 공격면 아님**: 에이전트는 이미 Paperclip 네이티브 `/api/approvals/{id}/approve`에 직접 접근 가능 → local_trusted 모드의 내재 속성. 개선안: 게임 UI만 보유하는 로컬 세션 토큰을 `/review`(및 승인 액션)에 요구. 격리 워크스페이스·low_trust_review와 같은 Phase 2 트러스트 하드닝 티어.
   <!-- VOX-14 승인 시 Claude 크로스-리뷰가 발견(구현자·Terra 미명시). v0.1 D4 집행은 거버넌스(AGENTS.md 자가승인 금지)+인간이 실제 조작자라는 사실 → 기록만, 지금 블로커 아님. -->
12. **`/favicon.ico` 정적 제공 (legacy fallback)** — 현재 `<link rel="icon" href="/favicon.svg">` 명시 선언으로 브라우저가 `/favicon.ico`를 요청하지 않아 완료 조건('콘솔 오류 0')은 충족되나, 해당 경로를 직접 요청하면 여전히 404(VOX-29 QA). SVG favicon 미지원 구형 브라우저(구 Safari 등)는 `.ico`로 폴백하므로 배포 대상이 넓어지면 `public/favicon.ico` 추가.
   <!-- VOX-29(Codex Terra) 유일 FAIL. 원 결함(자동 요청→404→콘솔 오류)은 해소됨. 로컬 macOS v0.1 단일 브라우저 환경에선 무의미 → 재작업 1사이클(토큰) 대비 이득 없어 백로그. 반려 지시를 '404 제거'로 문자대로 쓴 CEO 측 문구 모호성이 FAIL 판정의 직접 원인 — 향후 반려 지시는 '완료 조건' 기준으로 표현할 것. -->


**v2 후보**: 관광 모드(섬·행성 보행) · 스냅샷 공개 퍼블리시(관전) · Slack 지시 채널 · GR 테마 · 물리 파편 붕괴.

## 10. 남은 열린 항목

1. **Paperclip 상태·승인·인증** — ✅ Phase 1 실사 확정 (PAPERCLIP-RECON.md): 고정 상태 enum(§3.4), 네이티브 approval(approve/reject/request-revision/resubmit), 트러스트 로컬 loopback = Board(인간) 권한. 남은 것: 웹훅 실시간 유무·거절→재작업 자동 트리거 여부(폴링 폴백은 항상 유효)·LLM 어댑터 설정.
2. **`plan/japanese-temple-voxels` 최종 처분** — ✅ 폐기 확정 (2026-07-21 사용자 결정). Phase 0에서 로컬+원격 삭제 실행(명령 확인 후). `stash@{0}`은 보존.
3. **프로젝트↔국가 1:1 관례** — v1.1 KR 테마 추가 전까지 실사용 경험으로 판단.

<!-- 2026-07-21 MEDIUM 리뷰 반영 (§10):
# M9(기술 타당성): 항목 1의 '상태명·API 필드' 표현이 커스텀 상태·카테고리·blocker 관계라는 구조적 차이를 못 드러냄 → 카테고리 모델 명시.
# M10(기술 타당성): 승인/거절 API 존재 여부·권한 모델이라는 핵심 의존성이 'API 필드'로 뭉뚱그려짐 → D6 전체가 막힐 수 있는 지점이므로 명시적 항목으로 격상 + 폴백(상태 전이+코멘트 조합) 명문화.
-->


---

*참조: [task-arcade](https://github.com/wineforyourplate/task-arcade) (AGPL-3.0 — 규칙 참고만) · [paperclip](https://github.com/paperclipai/paperclip) (MIT) · [astryx](https://github.com/facebook/astryx) (MIT beta) · [Kenney](https://kenney.nl/assets) (CC0) · 통합 이력: Claude v0.1→v0.2 → Codex 상세안 · Gemini v0.3 → 본 확정본*
