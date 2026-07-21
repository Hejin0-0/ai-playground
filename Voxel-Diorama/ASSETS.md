# ASSETS.md — 에셋 출처·라이선스·재현성 기록

> 정책: **Kenney CC0 원본을 kenney.nl에서 직접 다운로드**하고, 팩 이름·버전·다운로드 URL을 여기에 기록한다 (PLAN.md D7). task-arcade·Tiny World Builder에서는 코드·에셋 파일을 복사하지 않는다. Kenney 로고는 사용하지 않는다.

## 라이선스

모든 Kenney 팩은 **Creative Commons Zero (CC0 1.0)** — 퍼블릭 도메인, 상업 이용·수정 가능, 출처 표기 불요. 각 팩의 `License.txt`에서 확인함. 원문: <https://creativecommons.org/publicdomain/zero/1.0/>

## base 테마 팩 (assets/common/kenney/)

다운로드 일자: 2026-07-21

| 팩 | 버전 | 팩 생성일 | 역할 (base 테마) | 소스 페이지 | 다운로드 URL |
|---|---|---|---|---|---|
| City Kit Commercial | 2.1 | 2025-07-21 | 건물 고티어 (상업·고층) | <https://kenney.nl/assets/city-kit-commercial> | `https://kenney.nl/media/pages/assets/city-kit-commercial/a742d900eb-1753115042/kenney_city-kit-commercial_2.1.zip` |
| City Kit Suburban | 2.0 | 2025-04-23 | 건물 저티어 (주택) | <https://kenney.nl/assets/city-kit-suburban> | `https://kenney.nl/media/pages/assets/city-kit-suburban/2c871b7af2-1745479373/kenney_city-kit-suburban_20.zip` |
| Nature Kit | 2.1 | 2020-04-29 | 지형·자연 장식 (나무·바위·풀·길) | <https://kenney.nl/assets/nature-kit> | `https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip` |
| Graveyard Kit | 5.0 | 2025-10-17 | 폐허(Rubble) — 반려 시도 표현 | <https://kenney.nl/assets/graveyard-kit> | `https://kenney.nl/media/pages/assets/graveyard-kit/ba8d4b4517-1760691807/kenney_graveyard-kit_5.0.zip` |

> 다운로드 URL의 해시 경로는 kenney.nl 배포 시점마다 바뀔 수 있다. 링크가 끊기면 소스 페이지에서 최신 URL을 다시 받고 이 표를 갱신한다.

## 포함 포맷·모델 수 (추출 후 실측)

각 팩은 동일 모델을 여러 포맷으로 제공한다. **이 프로젝트(R3F)는 GLB만 사용**한다 (`Models/GLTF format/*.glb`).

| 팩 | GLB 모델 수 | 함께 포함된 포맷 | 아카이브 크기 |
|---|---:|---|---:|
| City Kit Commercial 2.1 | 41 | OBJ·FBX·MTL·PNG 프리뷰 | 3.9 MB |
| City Kit Suburban 2.0 | 40 | OBJ·FBX·MTL·PNG 프리뷰 | 2.9 MB |
| Nature Kit 2.1 | 329 | OBJ·FBX·DAE·STL·MTL·아이소메트릭 PNG | 10.0 MB |
| Graveyard Kit 5.0 | 91 | OBJ·FBX·MTL·PNG 프리뷰 | 3.5 MB |

- GLB 경로 예: `kenney_nature-kit/Models/GLTF format/grass.glb`
- 무결성: 4개 `.zip` 모두 `unzip -t` 통과.

## 저장 정책

- 원본 `.zip`과 추출본은 **git에 커밋하지 않는다** (`.gitignore` — 위 URL·버전으로 재현 가능). 로컬 `assets/common/kenney/`에만 둔다.
- 앱이 실제 로드하는 것은 GLB뿐이다. **git에 커밋할 GLB 서브셋(어떤 모델을 base 카탈로그 티어·폐허·장식에 쓸지)은 Phase 3 착수 시 확정**하고 이 문서에 매핑을 추가한다.
