'use strict';
// Stage 1 of asset generation: renders every non-UI manifest entry as a
// Three.js voxel scene in headless Chrome and writes:
//   ../../assets/<id>.png        (46 world sprites, transparent, cropped)
//   ./meta-world.json            (anchors + tile metrics for stage 2)
// Run: npm install && node render.js   (uses the locally installed Chrome)

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { ASSET_MANIFEST } = require('../../src/assets/assetManifest');
const { MODELS } = require('../../src/assets/assetModels');
const { VoxelModelBuilder, mulberry32, hashString } = require('../../src/assets/voxelPainter');

const OUT_DIR = path.resolve(__dirname, '../../assets');
const CELL = 8;              // voxels per grid cell (shared convention)
const TILE_W = 128;          // projected width of one cell, px (2:1 tiles)
const ELEV = 30, AZIM = 45;  // camera angles; sin(30°)=0.5 gives exactly 2:1
const PPU = TILE_W / (CELL * Math.SQRT2); // pixels per world unit
const PAD = 2;

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));

// Same model -> voxel expansion as the 2D painter, same seeds, same jitter
// order (sorted by x+y+z), so the 3D pack keeps the 2D pack's texture detail.
function buildVoxels(id, model) {
  const rand = mulberry32(hashString(id));
  const v = new VoxelModelBuilder(rand);
  model.build(v);
  const voxels = [...v.voxels.values()];
  voxels.sort((a, b) =>
    (a.x + a.y + a.z) - (b.x + b.y + b.z) || a.z - b.z || a.y - b.y || a.x - b.x);
  return voxels.map((vox) => {
    const jit = vox.jitter ? 1 + (rand() - 0.5) * 2 * vox.jitter : 1;
    const [r, g, b] = vox.color;
    const rgb = (clamp(r * jit) << 16) | (clamp(g * jit) << 8) | clamp(b * jit);
    return [vox.x, vox.y, vox.z, rgb];
  });
}

async function main() {
  const world = ASSET_MANIFEST.filter((e) => e.category !== 'ui');
  const browser = await puppeteer.launch({
    channel: 'chrome',
    headless: 'new',
    args: ['--hide-scrollbars', '--force-color-profile=srgb'],
  });
  try {
    const page = await browser.newPage();
    // path built by hand: three's package "exports" map hides the UMD build
    await page.addScriptTag({ path: path.join(__dirname, 'node_modules/three/build/three.min.js') });
    await page.addScriptTag({ path: path.join(__dirname, 'scene.js') });

    const sprites = {};
    for (const entry of world) {
      const payload = {
        voxels: buildVoxels(entry.id, MODELS[entry.id]),
        shadow: !!MODELS[entry.id].shadow,
        ppu: PPU, elevDeg: ELEV, azimDeg: AZIM, pad: PAD,
      };
      const out = await page.evaluate((p) => window.renderVoxelAsset(p), payload);
      fs.writeFileSync(path.join(OUT_DIR, `${entry.id}.png`),
        Buffer.from(out.dataUrl.split(',')[1], 'base64'));
      sprites[entry.id] = { w: out.w, h: out.h, ax: out.ax, ay: out.ay };
      console.log(`rendered ${entry.id} (${out.w}x${out.h})`);
    }

    const tileMetrics = {
      tileW: TILE_W,
      tileH: TILE_W / 2,
      // screen px per voxel of height: 1 world unit up projects to cos(elev)
      zStepPx: Math.round(Math.cos((ELEV * Math.PI) / 180) * PPU * 100) / 100,
      cellVoxels: CELL,
      tileTopVoxels: 4, // terrain tiles are 4 voxels tall; props sit on that plane
    };
    fs.writeFileSync(path.join(__dirname, 'meta-world.json'),
      JSON.stringify({ tileMetrics, sprites }, null, 1));
    console.log(`rendered ${world.length} world sprites + meta-world.json`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
