'use strict';
// Asset generator, stage 2 of 2.
//   Stage 1 (world sprites): tools/render-assets/render.js — Three.js scenes
//     shot offline through headless Chrome, writes the 46 world PNGs plus
//     meta-world.json (anchors + tile metrics).
//   Stage 2 (this file): renders the 14 UI sprites with the 2D painter,
//     merges assets/meta.js, writes the contact sheet, and runs the
//     manifest<->model<->file completeness asserts over all 60 assets.
// Run: node src/assets/generateAssets.js   (after stage 1)

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { renderSprite } = require('./voxelPainter');
const { encodePNG } = require('./pngEncoder');
const { ASSET_MANIFEST } = require('./assetManifest');
const { MODELS } = require('./assetModels');

const OUT_DIR = path.resolve(__dirname, '../../assets');
const WORLD_META = path.resolve(__dirname, '../../tools/render-assets/meta-world.json');

function checkVoxelSprite(id, sprite) {
  const { width, height, pixels } = sprite;
  let opaque = 0;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] === 255) opaque++;
  assert(opaque > 0, `${id}: no opaque pixels`);
  for (let x = 0; x < width; x++) {
    assert.strictEqual(pixels[x * 4 + 3], 0, `${id}: clipped at top edge`);
    assert.strictEqual(pixels[((height - 1) * width + x) * 4 + 3], 0,
      `${id}: clipped at bottom edge`);
  }
  for (let y = 0; y < height; y++) {
    assert.strictEqual(pixels[y * width * 4 + 3], 0, `${id}: clipped at left edge`);
    assert.strictEqual(pixels[(y * width + width - 1) * 4 + 3], 0,
      `${id}: clipped at right edge`);
  }
}

function writeContactSheet(entries) {
  const groups = {};
  for (const e of entries) (groups[e.category] ??= []).push(e);
  const sections = Object.entries(groups).map(([cat, items]) => `
    <h2>${cat}</h2>
    <div class="grid">${items.map(e => `
      <figure><img src="${e.id}.png" alt="${e.name}"><figcaption>${e.name}<br><code>${e.id}</code></figcaption></figure>`).join('')}
    </div>`).join('\n');
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Japanese Temple Voxels — Asset Contact Sheet</title>
<style>
  body { background: #f6efe2; font-family: -apple-system, sans-serif; color: #5a4f42; padding: 24px; }
  h1 { font-weight: 600; } h2 { text-transform: capitalize; margin-top: 32px; }
  .grid { display: flex; flex-wrap: wrap; gap: 16px; }
  figure { background: #fdf8ee; border: 1px solid #e2d6bf; border-radius: 10px;
           padding: 12px; margin: 0; text-align: center; min-width: 120px; }
  img { max-width: 160px; } /* smooth scaling: sprites are antialiased 3D renders */
  figcaption { font-size: 12px; margin-top: 8px; } code { color: #a08c6a; font-size: 10px; }
</style></head>
<body><h1>Japanese Temple Voxels — generated asset pack (${entries.length})</h1>
${sections}
</body></html>`;
  fs.writeFileSync(path.join(OUT_DIR, 'contact-sheet.html'), html);
}

function main() {
  // manifest <-> models must match exactly; fail loudly on any drift
  const manifestIds = new Set(ASSET_MANIFEST.map(e => e.id));
  for (const e of ASSET_MANIFEST) {
    assert(MODELS[e.id], `manifest entry "${e.id}" has no model in assetModels.js`);
  }
  for (const id of Object.keys(MODELS)) {
    assert(manifestIds.has(id), `model "${id}" has no manifest entry`);
  }
  assert.strictEqual(manifestIds.size, ASSET_MANIFEST.length, 'duplicate manifest ids');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // stage-1 output: world sprites already rendered by Three.js
  assert(fs.existsSync(WORLD_META),
    'world sprites not rendered yet — run: cd tools/render-assets && npm install && node render.js');
  const world = JSON.parse(fs.readFileSync(WORLD_META, 'utf8'));

  const meta = {};
  for (const entry of ASSET_MANIFEST) {
    const model = MODELS[entry.id];
    if (entry.category !== 'ui') {
      assert(world.sprites[entry.id],
        `${entry.id}: missing from meta-world.json — re-run tools/render-assets`);
      assert(fs.existsSync(path.join(OUT_DIR, `${entry.id}.png`)),
        `${entry.id}.png missing — re-run tools/render-assets`);
      meta[entry.id] = world.sprites[entry.id];
      continue;
    }
    let sprite;
    if (model.kind === 'ui') {
      sprite = model.draw();
      let visible = 0;
      for (let i = 3; i < sprite.pixels.length; i += 4) if (sprite.pixels[i] > 0) visible++;
      assert(visible > 0, `${entry.id}: empty UI sprite`);
    } else {
      sprite = renderSprite({ id: entry.id, ...model }); // voxel toolbar icons stay 2D
      checkVoxelSprite(entry.id, sprite);
    }
    meta[entry.id] = {
      w: sprite.width, h: sprite.height,
      ax: sprite.ax ?? 0, ay: sprite.ay ?? 0,
    };
    fs.writeFileSync(path.join(OUT_DIR, `${entry.id}.png`),
      encodePNG(sprite.width, sprite.height, sprite.pixels));
  }

  // sprite anchors + tile metrics for the browser renderer (script tag, no fetch)
  fs.writeFileSync(path.join(OUT_DIR, 'meta.js'),
    `// generated by src/assets/generateAssets.js — do not edit\n` +
    `var JTV_SPRITE_META = ${JSON.stringify(meta, null, 1)};\n` +
    `var JTV_TILE_METRICS = ${JSON.stringify(world.tileMetrics)};\n`);

  writeContactSheet(ASSET_MANIFEST);

  for (const entry of ASSET_MANIFEST) {
    assert(fs.existsSync(path.join(OUT_DIR, `${entry.id}.png`)), `${entry.id}.png missing`);
  }
  console.log(`generated ${ASSET_MANIFEST.length} assets + meta.js + contact-sheet.html`);
}

main();
