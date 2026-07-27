#!/usr/bin/env node
// check-geo.mjs — 정답 파일(geo-truth.kyoto.json)의 **점 피처 전수**를 OSM 라이브
// API(api.openstreetmap.org/api/0.6)로 재조회해 기계 판정한다. 외부 의존성 0 (Node 표준 모듈만).
//
// 검사 항목 (CEO 검수 R2):
//   (a) 제외 태그 아님 — historic ∈ {memorial,boundary_stone,wayside_shrine,plaque,monument}
//       또는 memorial=* 이면 위반(표지석·비석을 신사/사찰로 오채택한 회귀를 막는다).
//   (b) 좌표 일치 — 저장된 osmType(node/way/relation)을 라이브 재조회해 실제 위치를
//       proj()한 값이 파일의 at 값과 Zone 허용오차(A=0.15 / B=0.4 / C=1.5 km) 이내인지.
//
// 네트워크 실패는 통과가 아니라 **실패(fail-closed)**로 처리한다.
// 위반 1건이라도 있으면 위반 목록 + exit 1. 전수 통과 시 `N/N OK` 출력 후 exit 0.
//
// 실행: node tools/geo/check-geo.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, 'geo-truth.kyoto.json');

const ORIGIN = { lat: 34.9858, lon: 135.7588 };
const KM_LAT = 110.574;
const KM_LON = 111.320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
function proj(lat, lon) {
  return [(lon - ORIGIN.lon) * KM_LON, (lat - ORIGIN.lat) * KM_LAT];
}

// Zone 허용오차 (km) — fetch 도구의 zone 분류와 일치.
const TOLERANCE_KM = { A: 0.15, B: 0.4, C: 1.5 };

// 제외 태그 집합 — fetch-geo-truth.mjs 의 isExcludedMarker 와 동일 규칙.
const EXCLUDED_HISTORIC = new Set([
  'memorial',
  'boundary_stone',
  'wayside_shrine',
  'plaque',
  'monument',
]);
function isExcludedMarker(tags) {
  const t = tags ?? {};
  return (!!t.historic && EXCLUDED_HISTORIC.has(t.historic)) || t.memorial != null;
}

const OSM_API = 'https://api.openstreetmap.org/api/0.6';
const MAX_RETRIES = 4;
const CLIENT_TIMEOUT_MS = 30_000;
const REQUEST_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'voxel-diorama-geo-check/1.0 (+internal verification tool)',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 재시도/타임아웃 포함 JSON GET. 최종 실패 시 throw → 호출부에서 fail-closed 처리.
async function getJson(url) {
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: REQUEST_HEADERS, signal: controller.signal });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${body.slice(0, 120)}`);
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES - 1) await sleep(1500 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`GET 실패 (${MAX_RETRIES}회): ${url} — ${lastErr?.message}`);
}

// osmType(node/way/relation)별로 라이브 재조회해 { tags, lat, lon } 반환.
// way/relation 은 /full 로 모든 노드를 받아 bbox 중심을 계산한다 (Overpass `out center` 와 동치).
async function resolveElement(osmType) {
  const [type, id] = osmType.split('/');
  if (type === 'node') {
    const data = await getJson(`${OSM_API}/node/${id}.json`);
    const node = (data.elements || []).find((e) => e.type === 'node' && String(e.id) === id);
    if (!node) throw new Error(`node/${id} 응답에 대상 노드 없음`);
    return { tags: node.tags || {}, lat: node.lat, lon: node.lon };
  }
  if (type === 'way' || type === 'relation') {
    const data = await getJson(`${OSM_API}/${type}/${id}/full.json`);
    const els = data.elements || [];
    const target = els.find((e) => e.type === type && String(e.id) === id);
    if (!target) throw new Error(`${osmType} 응답에 대상 요소 없음`);
    const nodes = els.filter((e) => e.type === 'node' && typeof e.lat === 'number');
    if (!nodes.length) throw new Error(`${osmType} 에 좌표 노드 없음`);
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    for (const n of nodes) {
      if (n.lat < minLat) minLat = n.lat;
      if (n.lat > maxLat) maxLat = n.lat;
      if (n.lon < minLon) minLon = n.lon;
      if (n.lon > maxLon) maxLon = n.lon;
    }
    return { tags: target.tags || {}, lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };
  }
  throw new Error(`알 수 없는 osmType: ${osmType}`);
}

async function main() {
  const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const points = (doc.features || []).filter((f) => f.kind === 'point');
  if (!points.length) {
    console.error('점 피처가 없다 — 검사할 대상 없음, 실패 처리.');
    process.exit(1);
  }

  const violations = [];
  let ok = 0;

  for (const f of points) {
    const tol = TOLERANCE_KM[f.zone];
    if (tol == null) {
      violations.push(`${f.id} (${f.osmType}): 알 수 없는 zone '${f.zone}'`);
      continue;
    }
    let live;
    try {
      live = await resolveElement(f.osmType);
    } catch (err) {
      // fail-closed: 네트워크/조회 실패는 통과가 아니라 위반이다.
      violations.push(`${f.id} (${f.osmType}): 라이브 조회 실패 — ${err.message}`);
      continue;
    }

    let bad = false;
    // (a) 제외 태그 검사
    if (isExcludedMarker(live.tags)) {
      violations.push(
        `${f.id} (${f.osmType}, ${f.osmName}): 제외 태그 — historic=${live.tags.historic} memorial=${live.tags.memorial}`
      );
      bad = true;
    }
    // (b) 좌표 일치 검사 (Zone 허용오차)
    const [e, n] = proj(live.lat, live.lon);
    const [fe, fn] = f.at;
    const d = Math.hypot(e - fe, n - fn);
    if (d > tol) {
      violations.push(
        `${f.id} (${f.osmType}, ${f.osmName}): 좌표 불일치 — 파일 [${fe},${fn}] vs 라이브 [${e.toFixed(3)},${n.toFixed(3)}] = ${d.toFixed(3)}km > Zone ${f.zone} 허용 ${tol}km`
      );
      bad = true;
    }
    if (!bad) ok++;

    await sleep(200); // OSM API 예의상 소량 지연
  }

  if (violations.length) {
    console.error(`\n검사 실패 — 위반 ${violations.length}건 / 점 피처 ${points.length}건`);
    for (const v of violations) console.error(`  ✗ ${v}`);
    process.exit(1);
  }
  console.log(`${ok}/${points.length} OK`);
}

main().catch((err) => {
  console.error(`\n[치명적 오류] 검사기 실행 실패 (fail-closed): ${err.message}`);
  process.exit(1);
});
