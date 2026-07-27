# skills/ — 사원 교육용 스킬 라이브러리

`/Documents/git-clone` 창고에서 선별한 **32개 스킬** (라이선스: 각 `<source>/LICENSE`). Paperclip 회사 스킬로 등록돼 있고, 각 사원의 `desiredSkills`로 직무별 장착됨(런 시점 주입). 이 폴더는 스킬 전문(참조 파일 포함)의 원본 사본이다.

## 직무별 장착 매핑 (v2 — 게임·디자인 보강)

| 사원 | 장착 스킬 (9·9·8·9·5·5) | 의도 |
|---|---|---|
| **Engineering Lead · Developer** (Claude) | test-driven-development · debugging-and-error-recovery · incremental-implementation · mp-implement · ponytail · waza-check · **ccgs-perf-profile** · **threejs-object-sculptor** · **ek-improve-animations** | TDD·근본원인·점진·YAGNI·셀프리뷰 + §7 성능 예산 프로파일링, 절차적 Three.js 모델, 연출 코드 개선 |
| **QA Engineer** (Codex) | doubt-driven-development · code-review-and-quality · mp-code-review · ponytail-review · waza-hunt · **ccgs-playtest-report** · **ccgs-test-evidence-review** · **security-audit** | 적대적 검증·근본원인 사냥 + 플레이테스트 리포트(§1 도그푸딩 판정), 증거 검수(§3.3), 브리지 보안 감사 |
| **Product & Design Lead** (Codex) | planning-and-task-breakdown · spec-driven-development · mp-to-spec · mp-to-tickets · waza-design · frontend-ui-engineering · **ccgs-art-bible** · **ccgs-vertical-slice** · **ek-animation-vocabulary** | 스펙·분해·UI + 아트 바이블(Phase 5 산출물!), 버티컬 슬라이스 방법론, 연출 어휘("한 호흡" 전환 설계) |
| **Doc Writer ×2** (Claude/Codex) | documentation-and-adrs · do-decisions · waza-write · do-short · **kami-write-doc** | ADR·결정 기록·짧은 문서 + Kami(tw93 3부작의 문서 담당) |

## 출처 (전부 사본 + LICENSE 동봉)

| source | 원본 | 라이선스 |
|---|---|---|
| agent-skills | 엔지니어링 프랙티스 | MIT |
| waza | tw93/Waza — 엔지니어링 습관 | MIT |
| mattpocock | mattpocock/skills | MIT |
| ponytail | 최소주의 시니어 모드 | MIT |
| davidondrej | 사고·문서 스킬 | MIT |
| **ccgs** | Claude-Code-Game-Studios — 게임 스튜디오 워크플로 73종 중 6종 선별 | MIT |
| **emilkowalski** | Emil Kowalski — UI/애니메이션 감각 | MIT |
| **threejs-sculptor** | Three.js Object Sculptor — 절차적 모델 제작 | MIT |
| **kami** | tw93/Kami — 문서 산출 (assets 등 대형 파일 제외, 스킬 본체만) | MIT |
| **security-audit** | 6단계 병렬 보안 감사 | MIT |

## 토큰 효율 (전 직무 공통, 신규 2026-07-27)

토큰 소모가 운영 최대 병목이라(ORG v4 계기), `/Documents/git-clone/3. 에이전트 프레임워크 & 오케스트레이션`에서 선별. **전 직무 공통 적용** — 어느 사원이든 큰 출력·로그·컨텍스트를 다룰 때.

| skill | 무엇 | 상태 |
|---|---|---|
| **token-efficiency/headroom** | 에이전트가 읽는 모든 것(툴 출력·로그·RAG·파일·대화이력)을 LLM 도달 전 압축 (60–95%↓, 가역). `headroom wrap claude\|codex`로 워커 감싸기·proxy·MCP·`headroom learn`(→AGENTS.md) | **미설치** — 도입 플레이북(스킬). 설치·측정 후 D4 검증 경로 밖부터 적용 |
| **token-efficiency/rtk** | Rust CLI 프록시 — 셸 명령 출력을 LLM 도달 전 필터·압축 (60–90%↓). **글로벌 설치됨**. per-agent 훅(claude/codex) 연동 | 사용 중. **주의: 상주 데몬(paperclipai run 등) 감싸면 기동 멈춤 → 래퍼 스크립트로 우회** |

> 출처(둘 다): headroom `chopratejas/headroom` (Apache-2.0) · rtk `Rust Token Killer`. 상세·경고는 각 SKILL.md.

## 창고 잔여 자원 (미복사 — 필요 시 선별)

`/Documents/git-clone` 로컬 창고에만 있음. **에이전트는 관리형 클론에서 작업하므로 이 경로에 접근하지 못한다** — 쓰려면 이 폴더로 선별 복사 후 등록할 것.

| 자원 | 라이선스 | 언제 |
|---|---|---|
| **TRELLIS** (Microsoft, 이미지→3D 생성) | MIT | Phase 5 교토 에셋 생성 트랙 후보 (§5의 magicpixel/GPT Image와 병용 검토) |
| Claude-Code-Game-Studios 잔여 67종 (design-system·playtest·localize·live-ops 등) | MIT | 필요 시 추가 선별 |
| MengTo_Skills (디자이너 스킬 91종) | MIT | HUD 디자인 병목 시 |
| animal-island-ui (동물의숲풍 React UI) | MIT | HUD 미감 참고 (코드는 Astryx 우선 — D 결정 준수) |
| gsap-skills | MIT | ⚠️ 보류 — 플랜은 CSS/WAAPI 우선(§5), GSAP 의존 추가 유도 위험 |
| Front-End-Checklist · transitions.dev · GameDev-Resources | 라이선스 없음/미확인 | 복사 금지, 사람 참고용만 |
| meshflow | ⚠️ FAIR **비상업** | 복사·사용 금지에 준함 — 라이선스 재확인 전 참고도 신중히 |
| GDevelop · OpenGame · lore | 각자 확인 | 현재 무관 (우리는 R3F 자체 구현) |

- 스킬 추가/변경 절차: 이 폴더에 사본 추가 → Paperclip 스킬 등록 → 해당 사원 `skills/sync` → 이 표 갱신.
