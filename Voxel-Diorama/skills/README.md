# skills/ — 사원 교육용 스킬 라이브러리

`/Documents/git-clone` 창고에서 선별한 **21개 스킬** (전부 MIT — 각 `<source>/LICENSE` 참조). Paperclip 회사 스킬로 등록돼 있고, 각 사원의 `desiredSkills`로 직무별 장착됨(런 시점 주입). 이 폴더는 스킬 전문(참조 파일 포함)의 원본 사본이다.

## 직무별 장착 매핑

| 사원 | 장착 스킬 | 의도 |
|---|---|---|
| **Engineering Lead · Developer** (Claude) | test-driven-development · debugging-and-error-recovery · incremental-implementation · mp-implement · ponytail · waza-check | TDD로 증명, 근본원인 디버깅, 점진 구현, YAGNI 최소주의, 셀프 리뷰 후 제출 |
| **QA Engineer** (Codex) | doubt-driven-development · code-review-and-quality · mp-code-review · ponytail-review · waza-hunt | 적대적 신선-문맥 검증, 다축 리뷰, 근본원인 사냥 — 틀에 박힌 검증 탈피 |
| **Product & Design Lead** (Codex) | planning-and-task-breakdown · spec-driven-development · mp-to-spec · mp-to-tickets · waza-design · frontend-ui-engineering | 스펙 우선, 검증 가능한 분해, 프로덕션급 UI 감각 |
| **Doc Writer ×2** (Claude/Codex) | documentation-and-adrs · do-decisions · waza-write · do-short | ADR·결정 기록, 명확하고 짧은 문서 |

## 출처

| source | 원본 | 라이선스 |
|---|---|---|
| agent-skills | github.com/(agent-skills) — 엔지니어링 프랙티스 24종 | MIT |
| waza | github.com/tw93/Waza — 엔지니어링 습관 8종 | MIT |
| mattpocock | github.com/mattpocock/skills — TS 엔지니어링 워크플로 | MIT |
| ponytail | ponytail — 게으른(최소주의) 시니어 개발 모드 | MIT |
| davidondrej | davidondrej-skills — 사고·문서 스킬 | MIT |

- 스킬 추가/변경 시: 이 폴더에 사본 추가 → Paperclip 스킬 등록 → 해당 사원 `skills/sync` → 이 표 갱신.
- 창고의 나머지(0~13번 폴더)는 필요할 때 추가 선별.
