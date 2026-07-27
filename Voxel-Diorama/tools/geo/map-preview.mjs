#!/usr/bin/env node
// geo-truth.kyoto.json 의 정답 레이어만으로 대조용 SVG 3장(광역/도시/코어)을 그린다.
// 게임 데이터 레이어(city.js)는 G3에서 추가 — 외부 의존성 0, Node 표준 모듈만 사용.
//
// 실행: node tools/geo/map-preview.mjs --out <dir>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRUTH_FILE = path.join(__dirname, 'geo-truth.kyoto.json');

function parseArgs(argv) {
  const args = { out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') args.out = argv[++i];
  }
  return args;
}

const { out } = parseArgs(process.argv.slice(2));
const OUT_DIR = out ? path.resolve(out) : path.join(__dirname, 'preview');

const SCALES = [
  { file: 'map-wide.svg', radiusKm: 12, title: '광역 ±12km' },
  { file: 'map-city.svg', radiusKm: 6, title: '도시 ±6km' },
  { file: 'map-core.svg', radiusKm: 2, title: '코어 ±2km' },
];

const CANVAS = 900;
const MARGIN = 40;
const COLORS = {
  bg: '#0b1220',
  grid: '#1e2a3d',
  axis: '#3a4a63',
  river: '#3f8ef0',
  road: '#c7cdd6',
  landmark: '#f2b544',
  landmarkText: '#f2e6c9',
  origin: '#ff5a5a',
  title: '#e8edf5',
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderScale(features, scale) {
  const px = (CANVAS - MARGIN * 2) / (scale.radiusKm * 2);
  const cx = CANVAS / 2;
  const cy = CANVAS / 2;
  // 화면 좌표: x = e(east) 방향 그대로, y = -n(north) 방향(북=위)
  const toXY = ([e, n]) => [cx + e * px, cy - n * px];

  const withinRadius = ([e, n]) => Math.hypot(e, n) <= scale.radiusKm * 1.05;
  const lineVisible = (pts) => pts.some(withinRadius);

  const rivers = features.filter((f) => f.zone === 'C' && f.kind === 'line' && lineVisible(f.path));
  const roads = features.filter((f) => f.zone === 'B' && f.kind === 'line' && lineVisible(f.path));
  const landmarks = features.filter((f) => f.zone === 'A' && f.kind === 'point' && withinRadius(f.at));

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">`
  );
  parts.push(`<rect width="${CANVAS}" height="${CANVAS}" fill="${COLORS.bg}"/>`);

  // 격자 (1km 또는 5km 간격, 배율에 맞춰)
  const gridStep = scale.radiusKm <= 2 ? 0.5 : scale.radiusKm <= 6 ? 1 : 2;
  parts.push(`<g stroke="${COLORS.grid}" stroke-width="1">`);
  for (let k = -scale.radiusKm; k <= scale.radiusKm; k += gridStep) {
    const [x1, y1] = toXY([k, -scale.radiusKm]);
    const [x2, y2] = toXY([k, scale.radiusKm]);
    parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`);
    const [x3, y3] = toXY([-scale.radiusKm, k]);
    const [x4, y4] = toXY([scale.radiusKm, k]);
    parts.push(`<line x1="${x3.toFixed(1)}" y1="${y3.toFixed(1)}" x2="${x4.toFixed(1)}" y2="${y4.toFixed(1)}"/>`);
  }
  parts.push('</g>');

  // 축 (동/북 0선)
  parts.push(`<g stroke="${COLORS.axis}" stroke-width="1.5">`);
  {
    const [x1, y1] = toXY([-scale.radiusKm, 0]);
    const [x2, y2] = toXY([scale.radiusKm, 0]);
    parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`);
    const [x3, y3] = toXY([0, -scale.radiusKm]);
    const [x4, y4] = toXY([0, scale.radiusKm]);
    parts.push(`<line x1="${x3.toFixed(1)}" y1="${y3.toFixed(1)}" x2="${x4.toFixed(1)}" y2="${y4.toFixed(1)}"/>`);
  }
  parts.push('</g>');

  // 강 (zone C)
  parts.push(`<g stroke="${COLORS.river}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">`);
  for (const f of rivers) {
    const d = f.path.map(toXY).map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    parts.push(`<path d="${d}"><title>${esc(f.osmName)}</title></path>`);
  }
  parts.push('</g>');

  // 도로 (zone B)
  parts.push(`<g stroke="${COLORS.road}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.85">`);
  for (const f of roads) {
    const d = f.path.map(toXY).map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    parts.push(`<path d="${d}"><title>${esc(f.osmName)}</title></path>`);
  }
  parts.push('</g>');

  // 랜드마크 (zone A)
  for (const f of landmarks) {
    const [x, y] = toXY(f.at);
    parts.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${COLORS.landmark}" stroke="#00000055"><title>${esc(f.osmName)}</title></circle>`
    );
    if (scale.radiusKm <= 6) {
      parts.push(
        `<text x="${(x + 6).toFixed(1)}" y="${(y - 6).toFixed(1)}" font-size="10" font-family="sans-serif" fill="${COLORS.landmarkText}">${esc(f.osmName)}</text>`
      );
    }
  }

  // 원점(교토역)
  {
    const [x, y] = toXY([0, 0]);
    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="none" stroke="${COLORS.origin}" stroke-width="2"/>`);
    parts.push(
      `<text x="${(x + 8).toFixed(1)}" y="${(y + 16).toFixed(1)}" font-size="11" font-family="sans-serif" fill="${COLORS.origin}">京都駅</text>`
    );
  }

  // 제목 + 범례
  parts.push(
    `<text x="${MARGIN}" y="24" font-size="16" font-family="sans-serif" fill="${COLORS.title}">Kyoto Geo-Truth — ${esc(scale.title)}</text>`
  );
  parts.push(
    `<text x="${MARGIN}" y="${CANVAS - 16}" font-size="11" font-family="sans-serif" fill="${COLORS.title}">landmarks=${landmarks.length} roads=${roads.length} rivers=${rivers.length} · OpenStreetMap via Overpass API (ODbL)</text>`
  );
  const legendY = CANVAS - 40;
  parts.push(
    `<circle cx="${MARGIN + 4}" cy="${legendY}" r="4" fill="${COLORS.landmark}"/><text x="${MARGIN + 14}" y="${legendY + 4}" font-size="11" font-family="sans-serif" fill="${COLORS.title}">landmark</text>`
  );
  parts.push(
    `<line x1="${MARGIN + 90}" y1="${legendY}" x2="${MARGIN + 110}" y2="${legendY}" stroke="${COLORS.road}" stroke-width="2"/><text x="${MARGIN + 116}" y="${legendY + 4}" font-size="11" font-family="sans-serif" fill="${COLORS.title}">road</text>`
  );
  parts.push(
    `<line x1="${MARGIN + 170}" y1="${legendY}" x2="${MARGIN + 190}" y2="${legendY}" stroke="${COLORS.river}" stroke-width="2.5"/><text x="${MARGIN + 196}" y="${legendY + 4}" font-size="11" font-family="sans-serif" fill="${COLORS.title}">river</text>`
  );

  parts.push('</svg>');
  return parts.join('\n');
}

function main() {
  if (!fs.existsSync(TRUTH_FILE)) {
    console.error(`[오류] ${TRUTH_FILE} 없음 — 먼저 fetch-geo-truth.mjs 를 실행하세요.`);
    process.exit(1);
  }
  const truth = JSON.parse(fs.readFileSync(TRUTH_FILE, 'utf8'));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const scale of SCALES) {
    const svg = renderScale(truth.features, scale);
    const outPath = path.join(OUT_DIR, scale.file);
    fs.writeFileSync(outPath, svg);
    console.log(`[ok] ${outPath}`);
  }
}

main();
