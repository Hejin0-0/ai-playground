# THIRD_PARTY.md — 서드파티 자산·코드 기록 (PLAN.md D7 clean-room 규율)

## 참고만 (코드·파일 복사 금지 — AGPL clean-room)

| 프로젝트 | 라이선스 | 용도 |
|---|---|---|
| [task-arcade](https://github.com/wineforyourplate/task-arcade) | AGPL-3.0 | 게임 규칙·경험 참고만 |
| Tiny World Builder | AGPL-3.0 | 경험 참고만 |

## 에셋 (복사 사용)

| 자산 | 라이선스 | 위치 |
|---|---|---|
| Kenney 팩 4종 (City Commercial/Suburban·Nature·Graveyard) | CC0 1.0 | `assets/common/kenney/` (git 미커밋, ASSETS.md로 재현) |

## 사원 교육 스킬 (복사 사용)

| 소스 | 라이선스 | 위치 |
|---|---|---|
| Waza (tw93) · agent-skills · skills_mattpocock · ponytail · davidondrej-skills | 전부 MIT | `skills/<source>/` (각 폴더에 LICENSE 동봉) |
| Claude-Code-Game-Studios(6종) · emilkowalski_skills(2종) · Three.js-Object-Sculptor · Kami(tw93) · security-audit-skill | 전부 MIT | `skills/<source>/` (각 폴더에 LICENSE 동봉) |

> 미복사 창고 자원 카탈로그(TRELLIS 등)와 라이선스 주의 항목(meshflow 비상업 등)은 `skills/README.md` 참조.

## 지오-데이터 (복사 사용 — 데이터, 코드 아님)

| 소스 | 라이선스 | 위치 |
|---|---|---|
| OpenStreetMap (Overpass API 경유) | ODbL 1.0 — © OpenStreetMap contributors | `tools/geo/geo-truth.kyoto.json` (교토 랜드마크·간선·하천 좌표) |

> ODbL은 배포 시 저작자 표시(© OpenStreetMap contributors)와 동일 라이선스 공유 의무(share-alike)가 있다. 원시 데이터는 `tools/geo/fetch-geo-truth.mjs` 로 재현 가능 — `tools/geo/.cache/`(git 미커밋)에 원시 Overpass 응답을 캐시.

## 런타임 의존성 (주요)

| 패키지 | 라이선스 |
|---|---|
| React 19 · React Three Fiber v9 · Three.js · Vite | MIT |
| Astryx (`@astryxdesign/core`) · StyleX | MIT (beta) |
| Paperclip (자체 호스팅, 코드 미포함) | MIT |
