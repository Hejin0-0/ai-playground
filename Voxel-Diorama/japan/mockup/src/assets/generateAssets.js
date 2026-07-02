'use strict';
// Asset generator: renders every voxel model to a transparent PNG in /assets.
// Run: node src/assets/generateAssets.js
// ponytail: Task 1 proof models live inline; Task 2 moves them to assetModels.js

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { renderSprite } = require('./voxelPainter');
const { encodePNG } = require('./pngEncoder');

const MODELS = [
  {
    id: 'tile-grass',
    shadow: false,
    build(v) {
      v.box(0, 0, 0, 8, 8, 3, '#a97c50', { jitter: 0.05 }); // dirt body
      v.box(0, 0, 3, 8, 8, 1, '#9fd05e', { jitter: 0.06 }); // grass cap
      // grass fringe dripping onto the two visible sides
      for (let i = 0; i < 8; i++) {
        if (v.rand() < 0.45) v.set(7, i, 2, '#8cbf50', { jitter: 0.05 });
        if (v.rand() < 0.45) v.set(i, 7, 2, '#8cbf50', { jitter: 0.05 });
      }
    },
  },
  {
    id: 'prop-stone-lantern',
    shadow: true,
    build(v) {
      const stone = '#b3aea4';
      const stoneDark = '#8f8a80';
      const glow = '#ffc978';
      v.box(0, 0, 0, 4, 4, 1, stone, { jitter: 0.04 });   // base slab
      v.box(1, 1, 1, 2, 2, 3, stone, { jitter: 0.04 });   // pillar
      v.box(0, 0, 4, 4, 4, 1, stone, { jitter: 0.04 });   // chamber platform
      v.box(0, 0, 5, 4, 4, 2, stoneDark, { jitter: 0.03 }); // light chamber
      // glowing window voxels on both visible faces
      v.set(3, 1, 5, glow); v.set(3, 2, 5, glow);
      v.set(3, 1, 6, glow); v.set(3, 2, 6, glow);
      v.set(1, 3, 5, glow); v.set(2, 3, 5, glow);
      v.set(1, 3, 6, glow); v.set(2, 3, 6, glow);
      v.box(-1, -1, 7, 6, 6, 1, '#7d7568', { jitter: 0.03 }); // roof overhang
      v.box(0, 0, 8, 4, 4, 1, '#7d7568', { jitter: 0.03 });   // roof step
      v.box(1, 1, 9, 2, 2, 1, stone);                          // cap knob
    },
  },
  {
    id: 'nature-sakura-tree',
    shadow: true,
    build(v) {
      const pink = '#f6b8cd';
      const pinkDeep = '#eda0bd';
      const pinkLight = '#fcdae7';
      v.box(2, 2, 0, 2, 2, 6, '#8a5f42', { jitter: 0.04 }); // trunk
      v.box(-1, -1, 6, 8, 8, 2, pink, { jitter: 0.05 });    // canopy body
      // round the canopy corners
      v.clear(-1, -1, 6, 1, 1, 2); v.clear(6, -1, 6, 1, 1, 2);
      v.clear(-1, 6, 6, 1, 1, 2); v.clear(6, 6, 6, 1, 1, 2);
      v.box(0, 0, 8, 6, 6, 1, pink, { jitter: 0.05 });      // upper tier
      v.box(0, 1, 9, 4, 4, 1, pinkDeep, { jitter: 0.05 }); // top tuft, offset off-center
      // asymmetric side tufts
      v.box(7, 2, 6, 1, 2, 1, pinkDeep, { jitter: 0.05 });
      v.box(1, 7, 6, 2, 1, 1, pinkDeep, { jitter: 0.05 });
      // near-white blossom highlights over the canopy surfaces
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(v.rand() * 8) - 1;
        const y = Math.floor(v.rand() * 8) - 1;
        if (v.has(x, y, 7)) v.set(x, y, 7, pinkLight, { jitter: 0.03 });
      }
      for (let i = 0; i < 7; i++) {
        const x = Math.floor(v.rand() * 6);
        const y = Math.floor(v.rand() * 6);
        if (v.has(x, y, 8)) v.set(x, y, 8, pinkLight, { jitter: 0.03 });
      }
    },
  },
];

const OUT_DIR = path.resolve(__dirname, '../../assets');

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const model of MODELS) {
    const { width, height, pixels } = renderSprite(model);

    // sanity: sprite has content and nothing clipped at the canvas edge
    let opaque = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] === 255) opaque++;
    assert(opaque > 0, `${model.id}: no opaque pixels`);
    for (let x = 0; x < width; x++) {
      assert.strictEqual(pixels[x * 4 + 3], 0, `${model.id}: clipped at top edge`);
      assert.strictEqual(pixels[((height - 1) * width + x) * 4 + 3], 0,
        `${model.id}: clipped at bottom edge`);
    }
    for (let y = 0; y < height; y++) {
      assert.strictEqual(pixels[y * width * 4 + 3], 0, `${model.id}: clipped at left edge`);
      assert.strictEqual(pixels[(y * width + width - 1) * 4 + 3], 0,
        `${model.id}: clipped at right edge`);
    }

    const file = path.join(OUT_DIR, `${model.id}.png`);
    fs.writeFileSync(file, encodePNG(width, height, pixels));
    console.log(`wrote ${path.relative(process.cwd(), file)} (${width}x${height})`);
  }
  console.log(`generated ${MODELS.length} assets`);
}

main();
