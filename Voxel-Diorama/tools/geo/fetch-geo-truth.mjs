#!/usr/bin/env node
// G1 지오-트루스 수집 도구 — Overpass API에서 교토 대량 질의 3건을 받아
// 로컬 매칭(이름 + bbox 판별)으로 geo-truth.kyoto.json 을 만든다.
//
// 실행: node tools/geo/fetch-geo-truth.mjs
// 재실행 시 tools/geo/.cache/*.json 원시 응답을 재사용한다 (--fresh 로 무시 가능).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '.cache');
const OUT_FILE = path.join(__dirname, 'geo-truth.kyoto.json');
const FRESH = process.argv.includes('--fresh');

const ORIGIN = { lat: 34.9858, lon: 135.7588, note: '京都駅' };
const KM_LAT = 110.574;
const KM_LON = 111.320 * Math.cos((ORIGIN.lat * Math.PI) / 180);

function proj(lat, lon) {
  return [round3((lon - ORIGIN.lon) * KM_LON), round3((lat - ORIGIN.lat) * KM_LAT)];
}
function round3(n) {
  return Math.round(n * 1000) / 1000;
}

// 광역 질의 bbox — 미리보기 최대 반경(±12km)보다 여유 있게 잡는다.
const BBOX = { south: 34.865, west: 135.60, north: 35.105, east: 135.92 };
const BBOX_STR = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const MAX_RETRIES = 4;
const CLIENT_TIMEOUT_MS = 110_000; // >=100s
const QUERY_TIMEOUT_S = 120; // >=100

// ---- 정답 후보 목록 (필수 + 선택) ----------------------------------------
// near: 육안 참고용 disambiguation bbox 중심(동명 피처 오매칭 방지, 완료조건 4).
// 최종 좌표는 항상 Overpass 실측값을 proj()한 값 — near 는 매칭 필터로만 쓰인다.
const LANDMARKS = [
  { id: 'kinkakuji', name: '金閣寺', near: [35.0394, 135.7292] },
  { id: 'ginkakuji', name: '銀閣寺', near: [35.0270, 135.7982] },
  { id: 'kiyomizudera', name: '清水寺', near: [34.9949, 135.7850] },
  { id: 'nijojo', name: '二条城', near: [35.0142, 135.7481] },
  { id: 'toji', name: '東寺', near: [34.9810, 135.7477] },
  { id: 'fushimiinaritaisha', name: '伏見稲荷大社', near: [34.9671, 135.7727] },
  { id: 'yasakajinja', name: '八坂神社', near: [35.0037, 135.7784] },
  { id: 'heianjingu', name: '平安神宮', near: [35.0163, 135.7822] },
  { id: 'sanjusangendo', name: '三十三間堂', near: [34.9877, 135.7717] },
  { id: 'nanzenji', name: '南禅寺', near: [35.0107, 135.7935] },
  { id: 'kitanotenmangu', name: '北野天満宮', near: [35.0294, 135.7358] },
  { id: 'shimogamojinja', name: '下鴨神社', near: [35.0393, 135.7727] },
  // 완료조건 4의 검증 대상(오매칭 사례) — 본원(本院)만 채택, 후시미 별원과 구분.
  { id: 'higashihonganji', name: '東本願寺', near: [34.9914, 135.7565] },
];
const REQUIRED_ROADS = [
  '烏丸通', '堀川通', '河原町通', '東大路通', '西大路通', '四条通',
  '五条通', '三条通', '今出川通', '丸太町通', '北大路通', '七条通',
];
const REQUIRED_RIVERS = ['鴨川', '桂川', '白川', '高瀬川'];

// 60~80 피처 총량을 맞추기 위해 광역 질의에서 추가로 뽑아올 개수 상한.
const EXTRA_LANDMARKS_MAX = 20;
const EXTRA_ROADS_MAX = 10;
const EXTRA_RIVERS_MAX = 4;

// ---- Overpass 질의 실행 (대량 3건 + 캐시 + 재시도/엔드포인트 순환) --------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function httpQuery(endpoint, ql, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  try {
    let res;
    if (method === 'POST') {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: '*/*',
          'User-Agent': 'voxel-diorama-geo-truth-fetch/1.0 (+internal tool)',
        },
        body: `data=${encodeURIComponent(ql)}`,
        signal: controller.signal,
      });
    } else {
      const url = `${endpoint}?data=${encodeURIComponent(ql)}`;
      res = await fetch(url, {
        method: 'GET',
        headers: { Accept: '*/*', 'User-Agent': 'voxel-diorama-geo-truth-fetch/1.0 (+internal tool)' },
        signal: controller.signal,
      });
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function postThenGet(endpoint, ql) {
  try {
    return await httpQuery(endpoint, ql, 'POST');
  } catch (err) {
    console.warn(`  [fallback->GET] POST 실패(${err.message}) — GET 재시도`);
    return await httpQuery(endpoint, ql, 'GET');
  }
}

async function runOverpassQuery(name, ql) {
  const cacheFile = path.join(CACHE_DIR, `${name}.json`);
  if (!FRESH && fs.existsSync(cacheFile)) {
    console.log(`[cache] ${name} <- ${path.relative(process.cwd(), cacheFile)}`);
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    console.log(`[fetch] ${name} 시도 ${attempt + 1}/${MAX_RETRIES} -> ${endpoint}`);
    try {
      const data = await postThenGet(endpoint, ql);
      fs.writeFileSync(cacheFile, JSON.stringify(data));
      console.log(`  [ok] ${name}: elements=${data.elements?.length ?? 0}`);
      return data;
    } catch (err) {
      lastErr = err;
      console.warn(`  [실패] ${name} 시도 ${attempt + 1}: ${err.message}`);
      if (attempt < MAX_RETRIES - 1) await sleep(3000 * (attempt + 1));
    }
  }
  throw new Error(`${name}: ${MAX_RETRIES}회 모두 실패 (마지막 오류: ${lastErr?.message})`);
}

const QUERIES = {
  landmarks: `[out:json][timeout:${QUERY_TIMEOUT_S}];
(
  node["historic"](${BBOX_STR});
  way["historic"](${BBOX_STR});
  relation["historic"](${BBOX_STR});
  node["tourism"="attraction"](${BBOX_STR});
  way["tourism"="attraction"](${BBOX_STR});
  relation["tourism"="attraction"](${BBOX_STR});
  node["amenity"="place_of_worship"](${BBOX_STR});
  way["amenity"="place_of_worship"](${BBOX_STR});
  relation["amenity"="place_of_worship"](${BBOX_STR});
);
out center tags;`,
  roads: `[out:json][timeout:${QUERY_TIMEOUT_S}];
way["highway"]["name"](${BBOX_STR});
out tags geom;`,
  rivers: `[out:json][timeout:${QUERY_TIMEOUT_S}];
way["waterway"]["name"](${BBOX_STR});
out tags geom;`,
};

// ---- 기하 유틸 -------------------------------------------------------------

function elementCenterLatLon(el) {
  if (el.type === 'node') return [el.lat, el.lon];
  if (el.center) return [el.center.lat, el.center.lon];
  return null;
}

function distKm(a, b) {
  const [ea, na] = proj(a[0], a[1]);
  const [eb, nb] = proj(b[0], b[1]);
  return Math.hypot(ea - eb, na - nb);
}

function distKmProj(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function perpendicularDistance(pt, a, b) {
  const [x, y] = pt, [x1, y1] = a, [x2, y2] = b;
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  const projx = x1 + t * dx, projy = y1 + t * dy;
  return Math.hypot(x - projx, y - projy);
}

function douglasPeucker(points, epsilon) {
  if (points.length < 3) return points;
  let dmax = 0, index = 0;
  const a = points[0], b = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], a, b);
    if (d > dmax) { dmax = d; index = i; }
  }
  if (dmax > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon);
    const right = douglasPeucker(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [a, b];
}

function simplifyToMax(points, maxPoints) {
  let epsilon = 0.01; // km
  let result = points;
  for (let i = 0; i < 40 && result.length > maxPoints; i++) {
    result = douglasPeucker(points, epsilon);
    epsilon *= 1.4;
  }
  return result;
}

// 같은 이름의 way(구간별로 쪼개진 것)들을 로컬에서 체이닝해 하나의 폴리라인으로 만든다.
// 연결이 끊긴 컴포넌트가 여러 개면 총 길이가 가장 긴 것을 대표 경로로 채택한다.
function chainWays(ways, joinThresholdKm = 0.35) {
  const segments = ways
    .map((w) => (w.geometry || []).map((p) => proj(p.lat, p.lon)))
    .filter((s) => s.length >= 2);
  if (!segments.length) return null;

  const remaining = segments.slice();
  const components = [];
  while (remaining.length) {
    let chain = remaining.shift();
    let extended = true;
    while (extended) {
      extended = false;
      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        const cs = chain[0], ce = chain[chain.length - 1];
        const ss = seg[0], se = seg[seg.length - 1];
        if (distKmProj(ce, ss) <= joinThresholdKm) {
          chain = chain.concat(seg.slice(1));
        } else if (distKmProj(ce, se) <= joinThresholdKm) {
          chain = chain.concat(seg.slice(0, -1).reverse());
        } else if (distKmProj(cs, se) <= joinThresholdKm) {
          chain = seg.slice(0, -1).concat(chain);
        } else if (distKmProj(cs, ss) <= joinThresholdKm) {
          chain = seg.slice(1).reverse().concat(chain);
        } else {
          continue;
        }
        remaining.splice(i, 1);
        extended = true;
        break;
      }
    }
    components.push(chain);
  }
  components.sort((a, b) => pathLength(b) - pathLength(a));
  return components[0];
}

function pathLength(pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += distKmProj(pts[i - 1], pts[i]);
  return total;
}

// ---- 매칭 -------------------------------------------------------------

// 표지석·비석·경계석·기념물류는 진짜 시설(神社/寺 본전)이 있어도 같은 이름으로
// 딸려 나온다. CEO 검수(R1): 화강암 표지석 node/11174591021 이 伏見稲荷大社
// 본전에서 900m 떨어진 채 채택돼 회귀가 났다. 후순위가 아니라 **전 단계 제외**한다.
// (historic ∈ 아래 집합) 또는 (memorial=* 존재) 인 요소는 랜드마크 후보에서 배제.
const EXCLUDED_HISTORIC = new Set([
  'memorial',
  'boundary_stone',
  'wayside_shrine',
  'plaque',
  'monument',
]);
function isExcludedMarker(el) {
  const t = el.tags ?? {};
  return (!!t.historic && EXCLUDED_HISTORIC.has(t.historic)) || t.memorial != null;
}

// 남은(제외되지 않은) 후보 사이의 우선순위: 참배지/명소 > 그 외 사적.
function typeScore(el) {
  const t = el.tags ?? {};
  if (t.amenity === 'place_of_worship') return 0;
  if (t.tourism === 'attraction') return 0;
  if (t.historic) return 1;
  return 1;
}

// 우선순위 단계 — 앞 단계에서 결과가 나오면 뒤 단계는 보지 않는다. 후보 풀은
// matchLandmark 에서 이미 표지석/비석/기념물류(isExcludedMarker)를 전부 걸러낸 뒤
// 들어온다. 대형 사찰·신사는 OSM에서 경내 복합체명 노드 없이 건물 단위(楼門/本殿 등)로만
// 개별 태깅된 경우가 흔하므로, 이름 매칭이 실패하면 근접 참배지/명소로 폴백한다.
function landmarkCandidateStages(elements, target, inBbox) {
  const NEAR_RADIUS_KM = 0.25;
  const hasName = (el) => !!el.tags?.name;
  return [
    () => elements.filter((el) => hasName(el) && el.tags.name === target.name && inBbox(elementCenterLatLon(el))),
    () =>
      elements.filter(
        (el) =>
          hasName(el) &&
          (el.tags.name.includes(target.name) || target.name.includes(el.tags.name)) &&
          inBbox(elementCenterLatLon(el))
      ),
    // 최후 수단: 이름 매칭이 전혀 없을 때만 근접 참배지/명소로 폴백.
    () =>
      elements.filter((el) => {
        if (!hasName(el)) return false;
        const ll = elementCenterLatLon(el);
        return ll && distKm(ll, target.near) <= NEAR_RADIUS_KM;
      }),
  ];
}

const STAGE_LABELS = ['정확 이름', '부분 이름', `근접(≤250m) 참배지/명소`];

function matchLandmark(elements, target, warnings) {
  const dlat = 1.5 / KM_LAT;
  const dlon = 1.5 / KM_LON;
  const [nlat, nlon] = target.near;
  const inBbox = (ll) => ll && Math.abs(ll[0] - nlat) <= dlat && Math.abs(ll[1] - nlon) <= dlon;

  // R1 수정: 표지석·비석·기념물류(historic∈EXCLUDED_HISTORIC 또는 memorial=*)는
  // 모든 단계에서 후보 자격을 박탈한다 — 후순위가 아니라 제외.
  const pool = elements.filter((el) => !isExcludedMarker(el));
  const stages = landmarkCandidateStages(pool, target, inBbox);
  let candidates = [];
  let stageUsed = -1;
  for (let i = 0; i < stages.length; i++) {
    candidates = stages[i]();
    if (candidates.length) {
      stageUsed = i;
      break;
    }
  }
  if (!candidates.length) {
    warnings.push(`${target.name}: bbox(${nlat.toFixed(4)},${nlon.toFixed(4)} 반경1.5km) 내 매칭 실패 — 제외`);
    return null;
  }
  candidates.sort((a, b) => {
    const ts = typeScore(a) - typeScore(b);
    if (ts !== 0) return ts;
    const da = distKm(elementCenterLatLon(a), target.near);
    const db = distKm(elementCenterLatLon(b), target.near);
    return da - db;
  });
  if (stageUsed > 0) {
    warnings.push(`${target.name}: [${STAGE_LABELS[stageUsed]}] 단계로 매칭 -> ${candidates[0].tags.name}`);
  }
  const el = candidates[0];
  const ll = elementCenterLatLon(el);
  return {
    id: `landmark-${target.id}`,
    kind: 'point',
    zone: 'A',
    at: proj(ll[0], ll[1]),
    osmName: el.tags.name,
    osmType: `${el.type}/${el.id}`,
  };
}

// typeScore만으로는 못 거르는 저질 후보 — 지엽적 "추정지" 사적 표지판
// (historic=battlefield 등, MARKER_HISTORIC 밖의 값이라 typeScore 1로 통과됨)와
// 관광 스탬프랠리 지점(tourism=attraction으로 오태깅되어 typeScore 0)을 이름 패턴으로 배제.
const JUNK_NAME_PATTERN = /推定地$|^Stamp Point/;

function extraLandmarks(elements, excludeNames, warnings, max) {
  const seen = new Set(excludeNames);
  const byName = new Map();
  for (const el of elements) {
    const nm = el.tags?.name;
    if (!nm || seen.has(nm) || byName.has(nm)) continue;
    // 표지석/비석/경계석/기념물류(isExcludedMarker)는 디오라마 랜드마크로 부적합 — 제외.
    // (수정 전에는 이 필터가 없어 "Stamp Point №2", "往来安全" 같은 표지판까지
    // extra 랜드마크로 딸려 들어왔다.)
    if (isExcludedMarker(el)) continue;
    if (JUNK_NAME_PATTERN.test(nm)) continue;
    const ll = elementCenterLatLon(el);
    if (!ll) continue;
    // 광역 bbox 전체가 아니라 도심 반경(±9km) 안쪽만 — 외곽 노이즈 배제.
    if (distKm(ll, [ORIGIN.lat, ORIGIN.lon]) > 9) continue;
    byName.set(nm, el);
  }
  const picked = [...byName.values()]
    .sort((a, b) => distKm(elementCenterLatLon(a), [ORIGIN.lat, ORIGIN.lon]) - distKm(elementCenterLatLon(b), [ORIGIN.lat, ORIGIN.lon]))
    .slice(0, max);
  return picked.map((el, i) => {
    const ll = elementCenterLatLon(el);
    return {
      id: `landmark-extra-${i + 1}-${slug(el.tags.name)}`,
      kind: 'point',
      zone: 'A',
      at: proj(ll[0], ll[1]),
      osmName: el.tags.name,
      osmType: `${el.type}/${el.id}`,
    };
  });
}

function matchLine(elements, name, zone, idPrefix, maxPoints, warnings) {
  const ways = elements.filter((el) => el.type === 'way' && el.tags?.name === name);
  if (!ways.length) {
    warnings.push(`${name}: 매칭되는 way 없음 — 제외`);
    return null;
  }
  const chained = chainWays(ways);
  if (!chained || chained.length < 2) {
    warnings.push(`${name}: 체이닝 실패 — 제외`);
    return null;
  }
  const simplified = simplifyToMax(chained, maxPoints);
  // 체이닝된 여러 way 중 대표 1개의 참조 — OSM 원본은 노선을 구간별 way로 쪼개 반환하므로
  // 노선 전체를 가리키는 단일 id는 없다(little-taipei geo-truth.json 관례: type/id 참조).
  return {
    id: `${idPrefix}-${slug(name)}`,
    kind: 'line',
    zone,
    path: simplified.map(([e, n]) => [round3(e), round3(n)]),
    osmName: name,
    osmType: `way/${ways[0].id}`,
    _wayCount: ways.length,
  };
}

function extraLines(elements, zone, idPrefix, excludeNames, maxPoints, max) {
  const seen = new Set(excludeNames);
  const groups = new Map();
  for (const el of elements) {
    if (el.type !== 'way') continue;
    const nm = el.tags?.name;
    if (!nm || seen.has(nm)) continue;
    if (!groups.has(nm)) groups.set(nm, []);
    groups.get(nm).push(el);
  }
  const ranked = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, max);
  const out = [];
  for (const [name, ways] of ranked) {
    const chained = chainWays(ways);
    if (!chained || chained.length < 2) continue;
    const simplified = simplifyToMax(chained, maxPoints);
    out.push({
      id: `${idPrefix}-extra-${slug(name)}`,
      kind: 'line',
      zone,
      path: simplified.map(([e, n]) => [round3(e), round3(n)]),
      osmName: name,
      osmType: `way/${ways[0].id}`,
    });
  }
  return out;
}

function slug(name) {
  // 일본어 지명을 파일/ID 안전 문자열로 — 로마자 매핑이 없으면 코드포인트 기반 축약.
  return Buffer.from(name, 'utf8')
    .toString('hex')
    .slice(0, 16);
}

// ---- 메인 -------------------------------------------------------------

async function main() {
  const warnings = [];
  const [landmarksRaw, roadsRaw, riversRaw] = await Promise.all([
    runOverpassQuery('landmarks', QUERIES.landmarks),
    runOverpassQuery('roads', QUERIES.roads),
    runOverpassQuery('rivers', QUERIES.rivers),
  ]);

  const landmarkElements = landmarksRaw.elements ?? [];
  const roadElements = roadsRaw.elements ?? [];
  const riverElements = riversRaw.elements ?? [];

  const features = [];

  for (const target of LANDMARKS) {
    const f = matchLandmark(landmarkElements, target, warnings);
    if (f) features.push(f);
  }
  const usedLandmarkNames = features.filter((f) => f.zone === 'A').map((f) => f.osmName);
  for (const f of extraLandmarks(landmarkElements, usedLandmarkNames, warnings, EXTRA_LANDMARKS_MAX)) {
    features.push(f);
  }

  const roadFeatures = [];
  for (const name of REQUIRED_ROADS) {
    const f = matchLine(roadElements, name, 'B', 'road', 8, warnings);
    if (f) roadFeatures.push(f);
  }
  const usedRoadNames = roadFeatures.map((f) => f.osmName);
  for (const f of extraLines(roadElements, 'B', 'road', usedRoadNames, 8, EXTRA_ROADS_MAX)) {
    roadFeatures.push(f);
  }
  for (const f of roadFeatures) {
    delete f._wayCount;
    features.push(f);
  }

  const riverFeatures = [];
  for (const name of REQUIRED_RIVERS) {
    const f = matchLine(riverElements, name, 'C', 'river', 10, warnings);
    if (f) riverFeatures.push(f);
  }
  const usedRiverNames = riverFeatures.map((f) => f.osmName);
  for (const f of extraLines(riverElements, 'C', 'river', usedRiverNames, 10, EXTRA_RIVERS_MAX)) {
    riverFeatures.push(f);
  }
  for (const f of riverFeatures) {
    delete f._wayCount;
    features.push(f);
  }

  const out = {
    source: 'OpenStreetMap via Overpass API (ODbL)',
    origin: ORIGIN,
    features,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + '\n');

  console.log('\n=== 요약 ===');
  console.log(`총 피처: ${features.length}`);
  console.log(`  Zone A(랜드마크): ${features.filter((f) => f.zone === 'A').length}`);
  console.log(`  Zone B(도로): ${features.filter((f) => f.zone === 'B').length}`);
  console.log(`  Zone C(강): ${features.filter((f) => f.zone === 'C').length}`);
  if (warnings.length) {
    console.log('\n=== 경고 ===');
    for (const w of warnings) console.log(`  - ${w}`);
  }
  console.log(`\n출력: ${OUT_FILE}`);
}

main().catch((err) => {
  console.error('\n[치명적 오류] 지오-트루스 수집 실패:', err.message);
  console.error('임의 좌표 생성 금지 — 실패 로그를 남기고 종료한다.');
  process.exit(1);
});
