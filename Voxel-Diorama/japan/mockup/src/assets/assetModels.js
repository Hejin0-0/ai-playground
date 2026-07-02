'use strict';
// Node-only: one voxel model (or flat UI drawing) per manifest entry.
// Grid convention: 1 placement cell = 8x8 voxels; terrain tiles are 4 voxels
// tall; props/buildings are modeled from z=0 (they sit on top of tiles).

const { S, FACE_H } = require('./voxelPainter');

// --- shared palette --------------------------------------------------------
const C = {
  grass: '#9fd05e', grassDark: '#8cbf50', dirt: '#a97c50', dirtDark: '#8a5f42',
  pathTop: '#e2d3ae', pathStone: '#cbb98f',
  water: '#5db3e8', waterTop: '#7ecbf0',
  stone: '#b3aea4', stoneDark: '#8f8a80', slab: '#b5b1a8',
  wood: '#b5854f', woodDark: '#8a5f42', woodLight: '#cda56b', woodPale: '#c99e6a',
  leaf: '#7cc561', leafDark: '#5fa848', bambooGreen: '#7fc25c', bambooDark: '#5da03e',
  pink: '#f6b8cd', pinkDeep: '#eda0bd', pinkLight: '#fcdae7',
  red: '#c9524e', redBright: '#d9534a', banner: '#cf4f4a',
  roof: '#4e5a6e', roofDark: '#3a4354', gold: '#e8b84b',
  wall: '#f2e8d8', white: '#f5eee0', glow: '#ffc978',
  hay: '#ddc06a', hayDark: '#b89a4e',
};

// --- flat UI drawing helpers ----------------------------------------------
function uiCanvas(width, height) {
  const pixels = Buffer.alloc(width * height * 4);
  const put = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = a;
  };
  return { width, height, pixels, put };
}

function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

// Rounded rect via corner-circle distance test. radii: [tl, tr, br, bl].
function roundRect(w, h, radii, fill, border, borderW, fillAlpha = 255) {
  const c = uiCanvas(w, h);
  const [tl, tr, br, bl] = radii;
  const inside = (x, y, inset) => {
    const x0 = inset, y0 = inset, x1 = w - 1 - inset, y1 = h - 1 - inset;
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const corners = [
      [x0 + tl, y0 + tl, tl], [x1 - tr, y0 + tr, tr],
      [x1 - br, y1 - br, br], [x0 + bl, y1 - bl, bl],
    ];
    for (const [cx, cy, r] of corners) {
      const rr = Math.max(0, r - inset);
      const inCornerBox =
        (cx === x0 + tl || cx === x0 + bl ? x < cx : x > cx) &&
        (cy === y0 + tl || cy === y0 + tr ? y < cy : y > cy);
      if (inCornerBox && (x - cx) ** 2 + (y - cy) ** 2 > rr * rr) return false;
    }
    return true;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!inside(x, y, 0)) continue;
      c.put(x, y, inside(x, y, borderW) ? hex(fill) : hex(border),
        inside(x, y, borderW) ? fillAlpha : 255);
    }
  return c;
}

// Cell-sized iso diamond (matches one 8x8-voxel tile top: 2*8*S wide, 8*S tall)
function diamondHighlight(fill, edge) {
  const T = 8 * S; // diamond height in px (64); width is 2T
  const pad = 2;
  const c = uiCanvas(2 * T + pad * 2, T + pad * 2);
  const cx = pad + T;
  for (let i = 0; i < T; i++) {
    const hw = i < T / 2 ? 2 * (i + 1) : 2 * (T - i);
    const y = pad + i;
    for (let x = cx - hw; x < cx + hw; x++) {
      const nearEdge = x < cx - hw + 5 || x >= cx + hw - 5;
      c.put(x, y, hex(nearEdge ? edge : fill), nearEdge ? 255 : 95);
    }
  }
  // The renderer center-draws highlights (Renderer.drawCentered) onto the
  // tile-top face, so anchor = bitmap center of this symmetric diamond.
  c.ax = cx;
  c.ay = pad + T / 2;
  return c;
}

// --- world models ----------------------------------------------------------
// Terrain tiles: 8x8 footprint, exactly 4 voxels tall (top surface plane z=4).
function dirtBody(v, h = 3) {
  v.box(0, 0, 0, 8, 8, h, C.dirt, { jitter: 0.05 });
}

const MODELS = {
  // ===== terrain =====
  'tile-grass': {
    shadow: false,
    build(v) {
      dirtBody(v);
      v.box(0, 0, 3, 8, 8, 1, C.grass, { jitter: 0.06 });
      for (let i = 0; i < 8; i++) {
        if (v.rand() < 0.45) v.set(7, i, 2, C.grassDark, { jitter: 0.05 });
        if (v.rand() < 0.45) v.set(i, 7, 2, C.grassDark, { jitter: 0.05 });
      }
    },
  },
  'tile-path': {
    shadow: false,
    build(v) {
      dirtBody(v);
      v.box(0, 0, 3, 8, 8, 1, C.pathTop, { jitter: 0.05 });
      for (let i = 0; i < 10; i++) {
        v.set(Math.floor(v.rand() * 8), Math.floor(v.rand() * 8), 3, C.pathStone,
          { jitter: 0.04 });
      }
    },
  },
  'tile-dirt': {
    shadow: false,
    build(v) { v.box(0, 0, 0, 8, 8, 4, C.dirt, { jitter: 0.06 }); },
  },
  'tile-water': {
    shadow: false,
    build(v) {
      v.box(0, 0, 0, 8, 8, 3, C.water, { jitter: 0.03 });
      v.box(0, 0, 2, 8, 8, 1, C.waterTop, { jitter: 0.06 }); // recessed 1 below grass
    },
  },
  'tile-stone': {
    shadow: false,
    build(v) {
      dirtBody(v);
      v.box(0, 0, 3, 8, 8, 1, C.slab, { jitter: 0.07 });
    },
  },
  'tile-stairs': {
    shadow: false,
    build(v) {
      for (let k = 0; k < 4; k++) {
        v.box(k * 2, 0, 0, 2, 8, 4 - k, C.stone, { jitter: 0.05 });
      }
    },
  },
  'tile-canal-edge': {
    shadow: false,
    build(v) {
      dirtBody(v, 2);
      v.box(0, 0, 2, 8, 1, 2, C.stone, { jitter: 0.05 }); // stone bank y=0
      v.box(0, 7, 2, 8, 1, 2, C.stone, { jitter: 0.05 }); // stone bank y=7
      v.box(0, 1, 2, 8, 6, 1, C.waterTop, { jitter: 0.06 }); // channel along x
    },
  },

  // ===== nature =====
  'nature-bamboo': {
    shadow: true,
    build(v) {
      const stalks = [[1, 2, 10], [4, 1, 8], [6, 4, 9], [3, 5, 7]];
      for (const [x, y, h] of stalks) {
        v.box(x, y, 0, 1, 1, h, C.bambooGreen, { jitter: 0.04 });
        for (let z = 2; z < h; z += 3) v.set(x, y, z, C.bambooDark);
        v.set(x + 1, y, h - 1, C.leaf, { jitter: 0.05 });
        v.set(x, y + 1, h - 2, C.leaf, { jitter: 0.05 });
      }
    },
  },
  'nature-sakura-tree': {
    shadow: true,
    build(v) {
      v.box(2, 2, 0, 2, 2, 6, C.dirtDark, { jitter: 0.04 });
      v.box(-1, -1, 6, 8, 8, 2, C.pink, { jitter: 0.05 });
      v.clear(-1, -1, 6, 1, 1, 2); v.clear(6, -1, 6, 1, 1, 2);
      v.clear(-1, 6, 6, 1, 1, 2); v.clear(6, 6, 6, 1, 1, 2);
      v.box(0, 0, 8, 6, 6, 1, C.pink, { jitter: 0.05 });
      v.box(0, 1, 9, 4, 4, 1, C.pinkDeep, { jitter: 0.05 });
      v.box(7, 2, 6, 1, 2, 1, C.pinkDeep, { jitter: 0.05 });
      v.box(1, 7, 6, 2, 1, 1, C.pinkDeep, { jitter: 0.05 });
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(v.rand() * 8) - 1, y = Math.floor(v.rand() * 8) - 1;
        if (v.has(x, y, 7)) v.set(x, y, 7, C.pinkLight, { jitter: 0.03 });
      }
      for (let i = 0; i < 7; i++) {
        const x = Math.floor(v.rand() * 6), y = Math.floor(v.rand() * 6);
        if (v.has(x, y, 8)) v.set(x, y, 8, C.pinkLight, { jitter: 0.03 });
      }
    },
  },
  'nature-small-tree': {
    shadow: true,
    build(v) {
      v.box(3, 3, 0, 2, 2, 3, C.dirtDark, { jitter: 0.04 });
      v.box(1, 1, 3, 6, 6, 2, C.leaf, { jitter: 0.06 });
      v.clear(1, 1, 3, 1, 1, 2); v.clear(6, 1, 3, 1, 1, 2);
      v.clear(1, 6, 3, 1, 1, 2); v.clear(6, 6, 3, 1, 1, 2);
      v.box(2, 2, 5, 4, 4, 1, C.leaf, { jitter: 0.06 });
      v.box(3, 3, 6, 2, 2, 1, C.leafDark, { jitter: 0.05 });
    },
  },
  'nature-grass-tuft': {
    shadow: false,
    build(v) {
      v.box(2, 3, 0, 1, 1, 2, C.grassDark, { jitter: 0.06 });
      v.box(4, 2, 0, 1, 1, 1, C.grass, { jitter: 0.06 });
      v.box(5, 5, 0, 1, 1, 2, C.leaf, { jitter: 0.06 });
      v.box(3, 5, 0, 1, 1, 1, C.grass, { jitter: 0.06 });
    },
  },
  'nature-flower-bush': {
    shadow: true,
    build(v) {
      v.box(1, 1, 0, 5, 5, 2, C.leaf, { jitter: 0.06 });
      v.clear(1, 1, 1); v.clear(5, 1, 1); v.clear(1, 5, 1); v.clear(5, 5, 1);
      const petals = [C.pink, C.white, C.pinkDeep];
      for (let i = 0; i < 6; i++) {
        const x = 1 + Math.floor(v.rand() * 5), y = 1 + Math.floor(v.rand() * 5);
        if (v.has(x, y, 1)) v.set(x, y, 1, petals[i % 3], { jitter: 0.03 });
      }
    },
  },

  // ===== props: borders =====
  'prop-fence-straight': {
    shadow: true,
    build(v) {
      v.box(0, 3, 0, 2, 2, 5, C.woodDark, { jitter: 0.04 });
      v.box(6, 3, 0, 2, 2, 5, C.woodDark, { jitter: 0.04 });
      v.box(2, 3, 1, 4, 1, 1, C.wood, { jitter: 0.04 });
      v.box(2, 3, 3, 4, 1, 1, C.wood, { jitter: 0.04 });
    },
  },
  'prop-fence-corner': {
    shadow: true,
    build(v) {
      v.box(0, 0, 0, 2, 2, 5, C.woodDark, { jitter: 0.04 });
      v.box(2, 0, 1, 6, 2, 1, C.wood, { jitter: 0.04 });
      v.box(2, 0, 3, 6, 2, 1, C.wood, { jitter: 0.04 });
      v.box(0, 2, 1, 2, 6, 1, C.wood, { jitter: 0.04 });
      v.box(0, 2, 3, 2, 6, 1, C.wood, { jitter: 0.04 });
    },
  },
  'prop-fence-gate': {
    shadow: true,
    build(v) {
      v.box(0, 3, 0, 2, 2, 6, C.woodDark, { jitter: 0.04 });
      v.box(6, 3, 0, 2, 2, 6, C.woodDark, { jitter: 0.04 });
      v.box(-1, 3, 5, 10, 2, 1, C.wood, { jitter: 0.04 }); // top beam overhang
    },
  },
  'prop-stone-post': {
    shadow: true,
    build(v) {
      v.box(2, 2, 0, 4, 4, 1, C.stone, { jitter: 0.05 });
      v.box(3, 3, 1, 2, 2, 3, C.stone, { jitter: 0.05 });
      v.box(2, 2, 4, 4, 4, 1, C.stoneDark, { jitter: 0.04 });
    },
  },

  // ===== props: lighting & shrine =====
  'prop-stone-lantern': {
    shadow: true,
    build(v) {
      v.box(0, 0, 0, 4, 4, 1, C.stone, { jitter: 0.04 });
      v.box(1, 1, 1, 2, 2, 3, C.stone, { jitter: 0.04 });
      v.box(0, 0, 4, 4, 4, 1, C.stone, { jitter: 0.04 });
      v.box(0, 0, 5, 4, 4, 2, C.stoneDark, { jitter: 0.03 });
      v.set(3, 1, 5, C.glow); v.set(3, 2, 5, C.glow);
      v.set(3, 1, 6, C.glow); v.set(3, 2, 6, C.glow);
      v.set(1, 3, 5, C.glow); v.set(2, 3, 5, C.glow);
      v.set(1, 3, 6, C.glow); v.set(2, 3, 6, C.glow);
      v.box(-1, -1, 7, 6, 6, 1, '#7d7568', { jitter: 0.03 });
      v.box(0, 0, 8, 4, 4, 1, '#7d7568', { jitter: 0.03 });
      v.box(1, 1, 9, 2, 2, 1, C.stone);
    },
  },
  'prop-hanging-lantern': {
    shadow: true,
    build(v) {
      v.box(2, 3, 0, 2, 2, 8, C.woodDark, { jitter: 0.04 }); // post
      v.box(4, 3, 7, 3, 2, 1, C.woodDark, { jitter: 0.04 }); // arm
      v.set(6, 3, 6, '#5a5148'); v.set(6, 4, 6, '#5a5148');   // chain
      v.box(5, 3, 5, 2, 2, 1, C.roofDark);                     // lantern cap
      v.box(5, 3, 3, 2, 2, 2, C.glow, { jitter: 0.03 });      // glowing body
      v.box(5, 3, 2, 2, 2, 1, C.roofDark);                     // lantern base
    },
  },
  'prop-torii-gate': {
    shadow: true,
    build(v) {
      v.box(1, 3, 0, 2, 2, 9, C.redBright, { jitter: 0.03 });   // left pillar
      v.box(13, 3, 0, 2, 2, 9, C.redBright, { jitter: 0.03 });  // right pillar
      v.box(0, 3, 6, 16, 2, 1, C.redBright, { jitter: 0.03 });  // tie beam
      v.box(-1, 2, 9, 18, 4, 1, C.redBright, { jitter: 0.03 }); // top lintel
      v.box(-1, 2, 10, 18, 4, 1, '#a33d3a', { jitter: 0.03 });  // dark-red kasagi
    },
  },
  'prop-shrine-box': {
    shadow: true,
    build(v) {
      v.box(1, 1, 0, 6, 6, 1, C.stone, { jitter: 0.05 });
      v.box(2, 2, 1, 4, 4, 3, C.red, { jitter: 0.04 });
      v.set(5, 3, 1, C.roofDark); v.set(5, 4, 1, C.roofDark); // dark opening
      v.set(5, 3, 2, C.roofDark); v.set(5, 4, 2, C.roofDark);
      v.box(1, 1, 4, 6, 6, 1, C.roof, { jitter: 0.04 });
      v.box(2, 2, 5, 4, 4, 1, C.roofDark, { jitter: 0.04 });
      v.box(3, 3, 6, 2, 2, 1, C.gold);
    },
  },
  'prop-signpost': {
    shadow: true,
    build(v) {
      v.box(3, 4, 0, 1, 1, 6, C.woodDark, { jitter: 0.04 });
      v.box(4, 2, 3, 1, 4, 2, C.woodLight, { jitter: 0.04 }); // board faces +x
      v.set(4, 2, 5, C.woodDark); v.set(4, 5, 5, C.woodDark); // board frame hints
    },
  },
  'prop-banner-flag': {
    shadow: true,
    build(v) {
      v.box(3, 4, 0, 1, 1, 10, C.woodDark, { jitter: 0.04 });
      v.box(4, 2, 9, 1, 4, 1, C.woodDark, { jitter: 0.04 }); // top arm
      v.box(4, 2, 3, 1, 4, 6, C.banner, { jitter: 0.03 });   // hanging banner
      v.set(4, 3, 6, C.white); v.set(4, 4, 5, C.white);       // white emblem
    },
  },

  // ===== props: decorative =====
  'prop-crate': {
    shadow: true,
    build(v) {
      v.box(2, 2, 0, 4, 4, 4, C.wood, { jitter: 0.05 });
      for (const [x, y] of [[2, 2], [5, 2], [2, 5], [5, 5]]) {
        v.box(x, y, 0, 1, 1, 4, C.woodDark, { jitter: 0.03 });
      }
    },
  },
  'prop-bench': {
    shadow: true,
    build(v) {
      v.box(1, 3, 0, 1, 2, 2, C.woodDark, { jitter: 0.04 });
      v.box(6, 3, 0, 1, 2, 2, C.woodDark, { jitter: 0.04 });
      v.box(0, 2, 2, 8, 3, 1, C.woodPale, { jitter: 0.04 });
    },
  },
  'prop-hay-bale': {
    shadow: true,
    build(v) {
      v.box(1, 2, 0, 6, 4, 3, C.hay, { jitter: 0.08 });
      v.box(3, 2, 0, 1, 4, 3, C.hayDark, { jitter: 0.04 });
    },
  },
  'prop-rock-cluster': {
    shadow: true,
    build(v) {
      v.box(1, 2, 0, 3, 3, 2, C.stone, { jitter: 0.06 });
      v.box(4, 4, 0, 2, 2, 1, C.stoneDark, { jitter: 0.06 });
      v.box(4, 1, 0, 2, 2, 1, C.slab, { jitter: 0.06 });
    },
  },
  'prop-large-rock': {
    shadow: true,
    build(v) {
      v.box(1, 1, 0, 5, 4, 3, C.stone, { jitter: 0.06 });
      v.clear(1, 1, 2); v.clear(5, 1, 2); v.clear(1, 4, 2); v.clear(5, 4, 2);
    },
  },
  'prop-mossy-rock': {
    shadow: true,
    build(v) {
      v.box(1, 1, 0, 5, 4, 3, C.stoneDark, { jitter: 0.06 });
      v.clear(1, 1, 2); v.clear(5, 1, 2); v.clear(1, 4, 2); v.clear(5, 4, 2);
      for (let i = 0; i < 7; i++) {
        const x = 1 + Math.floor(v.rand() * 5), y = 1 + Math.floor(v.rand() * 4);
        if (v.has(x, y, 2)) v.set(x, y, 2, C.leafDark, { jitter: 0.05 });
        else if (v.has(x, y, 1)) v.set(x, y, 1, C.leafDark, { jitter: 0.05 });
      }
    },
  },
  'prop-flat-stone': {
    shadow: false,
    build(v) { v.box(2, 2, 0, 4, 4, 1, C.slab, { jitter: 0.06 }); },
  },
  'prop-pebbles': {
    shadow: false,
    build(v) {
      const spots = [[2, 3], [3, 5], [5, 2], [4, 4], [6, 5]];
      const tones = [C.stone, C.slab, C.stoneDark];
      spots.forEach(([x, y], i) => v.set(x, y, 0, tones[i % 3], { jitter: 0.05 }));
    },
  },
  'prop-stone-pile': {
    shadow: true,
    build(v) {
      v.box(1, 1, 0, 5, 5, 1, C.stone, { jitter: 0.06 });
      v.box(2, 2, 1, 3, 3, 1, C.slab, { jitter: 0.06 });
      v.set(3, 3, 2, C.stoneDark, { jitter: 0.05 });
    },
  },
  'prop-boulder': {
    shadow: true,
    build(v) {
      v.box(1, 1, 0, 6, 5, 4, C.stone, { jitter: 0.06 });
      v.clear(1, 1, 3); v.clear(6, 1, 3); v.clear(1, 5, 3); v.clear(6, 5, 3);
      v.clear(1, 1, 0); v.clear(6, 5, 0);
    },
  },
  'prop-wood-pile': {
    shadow: true,
    build(v) {
      for (const [y, z] of [[1, 0], [3, 0], [5, 0], [2, 2], [4, 2]]) {
        v.box(1, y, z, 6, 2, 2, C.woodDark, { jitter: 0.05 });
        v.set(6, y, z, C.woodLight, { jitter: 0.04 });      // cut log ends (+x)
        v.set(6, y + 1, z + 1, C.woodLight, { jitter: 0.04 });
      }
    },
  },
  'prop-storage-box': {
    shadow: true,
    build(v) {
      v.box(1, 1, 0, 6, 4, 3, C.wood, { jitter: 0.04 });
      v.box(2, 1, 0, 1, 4, 3, '#6e4a28', { jitter: 0.03 }); // straps
      v.box(5, 1, 0, 1, 4, 3, '#6e4a28', { jitter: 0.03 });
      v.box(1, 1, 2, 6, 4, 1, C.woodLight, { jitter: 0.04 }); // lid
    },
  },
  'prop-stone-basin': {
    shadow: true,
    build(v) {
      v.box(2, 2, 0, 4, 4, 2, C.stone, { jitter: 0.05 });
      v.clear(3, 3, 1, 2, 2, 1);
      v.box(3, 3, 1, 2, 2, 1, C.waterTop, { jitter: 0.04 });
      v.box(0, 3, 1, 2, 1, 1, C.bambooGreen, { jitter: 0.04 }); // bamboo spout
    },
  },

  // ===== water features & farming =====
  'prop-bridge': {
    shadow: true,
    build(v) {
      const arc = [0, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 2, 2, 1, 1, 0];
      for (let x = 0; x < 16; x++) {
        v.box(x, 1, arc[x], 1, 6, 1, C.woodPale, { jitter: 0.05 }); // deck
        v.box(x, 0, arc[x] + 1, 1, 1, 1, C.woodDark, { jitter: 0.04 }); // rails
        v.box(x, 7, arc[x] + 1, 1, 1, 1, C.woodDark, { jitter: 0.04 });
      }
    },
  },
  'prop-well': {
    shadow: true,
    build(v) {
      v.box(1, 1, 0, 6, 6, 2, C.stone, { jitter: 0.06 });
      v.clear(2, 2, 0, 4, 4, 2);
      v.box(2, 2, 0, 4, 4, 1, '#4f9fd4', { jitter: 0.04 }); // water inside
      v.box(0, 3, 2, 1, 2, 4, C.woodDark, { jitter: 0.04 });
      v.box(7, 3, 2, 1, 2, 4, C.woodDark, { jitter: 0.04 });
      v.box(-1, 2, 6, 10, 4, 1, C.roof, { jitter: 0.04 });
      v.box(1, 3, 7, 6, 2, 1, C.roofDark, { jitter: 0.04 });
    },
  },
  'prop-rice-paddy': {
    shadow: false,
    build(v) {
      v.box(0, 0, 0, 8, 8, 2, C.dirt, { jitter: 0.05 });
      v.clear(1, 1, 1, 6, 6, 1);
      v.box(1, 1, 1, 6, 6, 1, C.water, { jitter: 0.04 });
      for (let x = 2; x <= 6; x += 2)
        for (let y = 2; y <= 6; y += 2)
          if (v.rand() < 0.8) v.box(x, y, 1, 1, 1, 2, C.bambooGreen, { jitter: 0.06 });
    },
  },
  'prop-crop-patch': {
    shadow: false,
    build(v) {
      v.box(0, 0, 0, 8, 8, 2, C.dirtDark, { jitter: 0.06 });
      for (let y = 1; y <= 6; y += 2)
        for (let x = 1; x <= 6; x++)
          if (v.rand() < 0.6) v.set(x, y, 2, C.leaf, { jitter: 0.08 });
    },
  },
  'prop-vegetable-garden': {
    shadow: false,
    build(v) {
      v.box(0, 0, 0, 8, 8, 2, C.dirtDark, { jitter: 0.05 });
      v.box(0, 0, 2, 8, 1, 1, C.woodDark, { jitter: 0.04 }); // raised-bed frame
      v.box(0, 7, 2, 8, 1, 1, C.woodDark, { jitter: 0.04 });
      v.box(0, 1, 2, 1, 6, 1, C.woodDark, { jitter: 0.04 });
      v.box(7, 1, 2, 1, 6, 1, C.woodDark, { jitter: 0.04 });
      for (const [x, y] of [[1, 1], [4, 1], [1, 4], [4, 4]]) {
        v.box(x + 1, y + 1, 2, 2, 2, 1, '#a4d977', { jitter: 0.07 });
      }
    },
  },
  'prop-water-bucket': {
    shadow: true,
    build(v) {
      v.box(2, 2, 0, 3, 3, 2, '#9a6b45', { jitter: 0.05 });
      v.set(3, 3, 1, '#6fb9e2');
    },
  },

  // ===== buildings =====
  // Building rule learned from contact-sheet QA: walls must be tall (7+) and
  // roof overhang tight (1 voxel past walls), or iso view hides the walls.
  'building-hut': {
    shadow: true,
    build(v) {
      v.box(2, 2, 0, 12, 12, 7, C.wall, { jitter: 0.03 });
      for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) {
        v.box(x, y, 0, 1, 1, 7, C.woodDark, { jitter: 0.03 });
      }
      v.box(13, 6, 0, 1, 4, 4, '#5a4a3a');                     // door on +x face
      v.box(13, 11, 3, 1, 2, 2, C.white);                       // window
      v.box(6, 13, 3, 3, 1, 2, C.white);
      v.box(1, 1, 7, 14, 14, 1, C.roof, { jitter: 0.05 });
      v.box(3, 3, 8, 10, 10, 1, C.roof, { jitter: 0.05 });
      v.box(5, 5, 9, 6, 6, 1, C.roofDark, { jitter: 0.05 });
      v.box(7, 7, 10, 2, 2, 1, C.roofDark, { jitter: 0.05 });
    },
  },
  'building-main-house': {
    shadow: true,
    build(v) {
      v.box(2, 2, 0, 20, 12, 7, C.wall, { jitter: 0.03 });
      for (const x of [2, 11, 21]) v.box(x, 2, 0, 1, 1, 7, C.woodDark);
      for (const x of [2, 11, 21]) v.box(x, 13, 0, 1, 1, 7, C.woodDark);
      v.box(21, 6, 0, 1, 4, 4, '#5a4a3a');                    // door
      v.box(21, 3, 3, 1, 2, 2, C.white); v.box(21, 11, 3, 1, 2, 2, C.white); // windows
      v.box(5, 13, 3, 3, 1, 2, C.white); v.box(15, 13, 3, 3, 1, 2, C.white);
      v.box(1, 1, 7, 22, 14, 1, C.roof, { jitter: 0.05 });
      v.box(2, 3, 8, 20, 10, 1, C.roof, { jitter: 0.05 });
      v.box(3, 5, 9, 18, 6, 1, C.roofDark, { jitter: 0.05 });
      v.box(4, 7, 10, 16, 2, 1, C.roofDark, { jitter: 0.05 }); // ridge along x
    },
  },
  'building-pagoda': {
    shadow: true,
    build(v) {
      v.box(0, 0, 0, 16, 16, 1, C.stone, { jitter: 0.05 });
      v.box(3, 3, 1, 10, 10, 5, C.red, { jitter: 0.03 });      // story 1
      v.box(13, 6, 2, 1, 4, 3, '#5a4a3a');                      // doorway
      v.box(1, 1, 6, 14, 14, 1, C.roofDark, { jitter: 0.05 });
      v.box(4, 4, 7, 8, 8, 4, C.red, { jitter: 0.03 });        // story 2
      v.box(11, 6, 8, 1, 3, 2, C.white);                        // window band
      v.box(2, 2, 11, 12, 12, 1, C.roofDark, { jitter: 0.05 });
      v.box(5, 5, 12, 6, 6, 3, C.red, { jitter: 0.03 });       // story 3
      v.box(3, 3, 15, 10, 10, 1, C.roofDark, { jitter: 0.05 });
      v.box(6, 6, 16, 4, 4, 1, C.roofDark, { jitter: 0.04 });
      v.box(7, 7, 17, 2, 2, 3, C.gold);                         // spire
    },
  },
  'building-watchtower': {
    shadow: true,
    build(v) {
      v.box(2, 2, 0, 12, 12, 2, C.stone, { jitter: 0.05 });
      v.box(4, 4, 2, 8, 8, 8, C.white, { jitter: 0.03 });
      for (const [x, y] of [[4, 4], [11, 4], [4, 11], [11, 11]]) {
        v.box(x, y, 2, 1, 1, 8, C.woodDark, { jitter: 0.03 });
      }
      v.box(11, 7, 4, 1, 2, 2, C.roofDark);                     // arrow slit
      v.box(3, 3, 10, 10, 10, 1, C.woodPale, { jitter: 0.04 }); // balcony
      v.box(4, 4, 11, 8, 8, 4, C.white, { jitter: 0.03 });
      v.box(11, 6, 12, 1, 4, 2, C.roofDark);                    // lookout window
      v.box(6, 11, 12, 4, 1, 2, C.roofDark);
      v.box(3, 3, 15, 10, 10, 1, C.roofDark, { jitter: 0.05 });
      v.box(5, 5, 16, 6, 6, 1, C.roofDark, { jitter: 0.05 });
      v.box(7, 7, 17, 2, 2, 1, C.gold);
    },
  },
  'building-temple': {
    shadow: true,
    build(v) {
      v.box(0, 0, 0, 24, 24, 2, C.stone, { jitter: 0.05 });   // platform
      v.box(20, 9, 0, 4, 6, 1, C.slab, { jitter: 0.04 });     // entry step
      v.box(3, 3, 2, 18, 18, 8, C.wall, { jitter: 0.03 });    // hall
      for (const y of [3, 8, 13, 20]) v.box(20, y, 2, 1, 1, 8, C.red);
      for (const x of [3, 8, 13, 20]) v.box(x, 20, 2, 1, 1, 8, C.red);
      v.box(20, 10, 2, 1, 4, 5, '#5a4a3a');                    // doorway
      v.box(20, 5, 5, 1, 2, 2, C.white); v.box(20, 16, 5, 1, 2, 2, C.white);
      v.box(2, 2, 10, 20, 20, 1, C.roof, { jitter: 0.05 });
      v.box(4, 4, 11, 16, 16, 1, C.roof, { jitter: 0.05 });
      v.box(6, 6, 12, 12, 12, 1, C.roofDark, { jitter: 0.05 });
      v.box(8, 8, 13, 8, 8, 1, C.roofDark, { jitter: 0.05 });
      v.box(10, 10, 14, 4, 4, 1, C.gold);                       // gold ridge
    },
  },

  // ===== UI: flat chrome =====
  'ui-button': {
    kind: 'ui',
    draw: () => roundRect(64, 64, [12, 12, 12, 12], '#f7f0e3', '#d9cbb4', 2),
  },
  'ui-button-hover': {
    kind: 'ui',
    draw: () => roundRect(64, 64, [12, 12, 12, 12], '#f3e7d2', '#c9b691', 2),
  },
  'ui-button-active': {
    kind: 'ui',
    draw: () => roundRect(64, 64, [12, 12, 12, 12], '#fdf3e0', '#e8934a', 3),
  },
  'ui-panel': {
    kind: 'ui',
    draw: () => roundRect(96, 96, [14, 14, 14, 14], '#f9f3e7', '#e2d6bf', 2, 250),
  },
  'ui-tab': {
    kind: 'ui',
    draw: () => roundRect(72, 44, [10, 10, 0, 0], '#f3ead7', '#ddcfb4', 2),
  },
  'ui-highlight-hover': {
    kind: 'ui',
    draw: () => diamondHighlight('#f5d76b', '#e8b73a'),
  },
  'ui-highlight-valid': {
    kind: 'ui',
    draw: () => diamondHighlight('#8fd964', '#5fae3a'),
  },
  'ui-highlight-invalid': {
    kind: 'ui',
    draw: () => diamondHighlight('#f08a8a', '#d95555'),
  },

  // ===== UI: toolbar icons (tiny voxel glyphs, same style as the world) =====
  'ui-icon-place': {
    shadow: false,
    build(v) { v.box(0, 0, 0, 2, 2, 2, '#e8934a', { jitter: 0.04 }); },
  },
  'ui-icon-erase': {
    shadow: false,
    build(v) { v.box(0, 0, 0, 3, 3, 1, '#ef8fa4', { jitter: 0.04 }); },
  },
  'ui-icon-pan': {
    shadow: false,
    build(v) {
      for (const [x, y] of [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]) {
        v.set(x, y, 0, '#8ea2c0', { jitter: 0.04 });
      }
    },
  },
  'ui-icon-grid': {
    shadow: false,
    build(v) {
      for (const [x, y] of [[0, 0], [2, 0], [0, 2], [2, 2]]) {
        v.set(x, y, 0, '#9aa4ae', { jitter: 0.04 });
      }
    },
  },
  'ui-icon-save': {
    shadow: false,
    build(v) {
      v.box(1, 1, 2, 1, 1, 2, '#7cb85c'); // arrow shaft
      v.box(0, 0, 1, 3, 3, 1, '#7cb85c'); // arrow head
      v.set(1, 1, 0, '#5fa848');           // tip
    },
  },
  'ui-icon-reset': {
    shadow: false,
    build(v) {
      for (const [x, y] of [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2]]) {
        v.set(x, y, 0, '#c0654f', { jitter: 0.04 }); // broken ring
      }
    },
  },
};

module.exports = { MODELS };
