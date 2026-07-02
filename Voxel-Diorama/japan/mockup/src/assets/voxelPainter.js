'use strict';
// Node-only: renders a voxel model (list of colored unit cubes) to an RGBA
// sprite using a fixed 2:1 pixel-isometric projection. One painter + one
// shading rule = every generated asset shares the same style.

const S = 8;        // top-face diamond: 2S px wide, S px tall
const FACE_H = 8;   // vertical face height per voxel, px
const PAD = 2;      // transparent border around every sprite

// Face brightness relative to base color (light from upper-left)
const SHADE_TOP = 1.14;
const SHADE_LEFT = 0.88;  // +y face, screen lower-left
const SHADE_RIGHT = 0.68; // +x face, screen lower-right

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function parseColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function shade([r, g, b], f) {
  return [
    Math.max(0, Math.min(255, Math.round(r * f))),
    Math.max(0, Math.min(255, Math.round(g * f))),
    Math.max(0, Math.min(255, Math.round(b * f))),
  ];
}

// Diamond row half-widths for the top face: rows 0..S-1, widths tessellate
// when neighbors step by (S, S/2).
function rowHalfWidth(i) {
  return i < S / 2 ? 2 * (i + 1) : 2 * (S - i);
}

// Lowest diamond row index containing column offset o (o in [-S, S-1]).
function bottomRowForColumn(o) {
  const m = o >= 0 ? o : -o - 1; // 0-indexed distance from center pair
  return S - Math.ceil((m + 1) / 2) ;
}

class VoxelModelBuilder {
  constructor(rand) {
    this.voxels = new Map(); // "x,y,z" -> {color:[r,g,b], jitter:number}
    this.rand = rand;
  }
  set(x, y, z, color, opts = {}) {
    this.voxels.set(`${x},${y},${z}`, {
      x, y, z,
      color: typeof color === 'string' ? parseColor(color) : color,
      jitter: opts.jitter ?? 0,
    });
  }
  box(x, y, z, w, d, h, color, opts = {}) {
    for (let ix = x; ix < x + w; ix++)
      for (let iy = y; iy < y + d; iy++)
        for (let iz = z; iz < z + h; iz++)
          this.set(ix, iy, iz, color, opts);
  }
  has(x, y, z) {
    return this.voxels.has(`${x},${y},${z}`);
  }
  clear(x, y, z, w = 1, d = 1, h = 1) {
    for (let ix = x; ix < x + w; ix++)
      for (let iy = y; iy < y + d; iy++)
        for (let iz = z; iz < z + h; iz++)
          this.voxels.delete(`${ix},${iy},${iz}`);
  }
}

// model: { id, shadow?: boolean, build(v) }
// Returns { width, height, pixels: Buffer(RGBA) }.
function renderSprite(model) {
  const rand = mulberry32(hashString(model.id));
  const v = new VoxelModelBuilder(rand);
  model.build(v);
  const voxels = [...v.voxels.values()];
  if (!voxels.length) throw new Error(`${model.id}: empty model`);

  // Screen anchor per voxel: center of its top diamond.
  const px = (vx, vy) => (vx - vy) * S;
  const py = (vx, vy, vz) => Math.round((vx + vy) * (S / 2)) - vz * FACE_H;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let fMinX = Infinity, fMaxX = -Infinity, fMinY = Infinity, fMaxY = -Infinity;
  for (const vox of voxels) {
    const cx = px(vox.x, vox.y);
    const cy = py(vox.x, vox.y, vox.z);
    minX = Math.min(minX, cx - S);
    maxX = Math.max(maxX, cx + S - 1);
    minY = Math.min(minY, cy - S / 2);
    maxY = Math.max(maxY, cy + S / 2 + FACE_H - 1);
    fMinX = Math.min(fMinX, vox.x); fMaxX = Math.max(fMaxX, vox.x);
    fMinY = Math.min(fMinY, vox.y); fMaxY = Math.max(fMaxY, vox.y);
  }

  // Ground shadow ellipse (projected footprint at z=0)
  let shadowGeom = null;
  if (model.shadow) {
    const cfx = (fMinX + fMaxX + 1) / 2;
    const cfy = (fMinY + fMaxY + 1) / 2;
    const scx = (cfx - cfy) * S;
    const scy = (cfx + cfy) * (S / 2) + FACE_H; // ground contact, not top of z=0 voxels
    const rx = ((fMaxX - fMinX + 1) + (fMaxY - fMinY + 1)) * S * 0.42 + 3;
    const ry = rx / 2;
    shadowGeom = { scx, scy, rx, ry };
    minX = Math.min(minX, Math.floor(scx - rx));
    maxX = Math.max(maxX, Math.ceil(scx + rx));
    minY = Math.min(minY, Math.floor(scy - ry));
    maxY = Math.max(maxY, Math.ceil(scy + ry));
  }

  const width = maxX - minX + 1 + PAD * 2;
  const height = maxY - minY + 1 + PAD * 2;
  const ox = PAD - minX;
  const oy = PAD - minY;
  const pixels = Buffer.alloc(width * height * 4);

  const putOpaque = (x, y, [r, g, b]) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 255;
  };

  if (shadowGeom) {
    const { scx, scy, rx, ry } = shadowGeom;
    for (let y = Math.floor(scy - ry); y <= Math.ceil(scy + ry); y++) {
      for (let x = Math.floor(scx - rx); x <= Math.ceil(scx + rx); x++) {
        const dx = (x - scx) / rx;
        const dy = (y - scy) / ry;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 1) continue;
        const a = Math.round(64 * Math.pow(1 - d2, 1.4));
        const i = ((y + oy) * width + (x + ox)) * 4;
        if (i < 0 || i + 3 >= pixels.length) continue;
        pixels[i] = 66; pixels[i + 1] = 58; pixels[i + 2] = 52;
        pixels[i + 3] = Math.max(pixels[i + 3], a);
      }
    }
  }

  // Painter's algorithm: farther voxels first. depth = x+y+z is a valid
  // occlusion order for unit cubes in this projection.
  voxels.sort((a, b) =>
    (a.x + a.y + a.z) - (b.x + b.y + b.z) || a.z - b.z || a.y - b.y || a.x - b.x);

  const has = (x, y, z) => v.voxels.has(`${x},${y},${z}`);

  for (const vox of voxels) {
    const cx = px(vox.x, vox.y) + ox;
    const cy = py(vox.x, vox.y, vox.z) + oy;
    const jit = vox.jitter ? 1 + (rand() - 0.5) * 2 * vox.jitter : 1;
    const base = shade(vox.color, jit);

    if (!has(vox.x, vox.y, vox.z + 1)) {
      const c = shade(base, SHADE_TOP);
      for (let i = 0; i < S; i++) {
        const hw = rowHalfWidth(i);
        const y = cy - S / 2 + i;
        for (let x = cx - hw; x < cx + hw; x++) putOpaque(x, y, c);
      }
    }
    const leftVisible = !has(vox.x, vox.y + 1, vox.z);
    const rightVisible = !has(vox.x + 1, vox.y, vox.z);
    if (leftVisible || rightVisible) {
      const cl = shade(base, SHADE_LEFT);
      const cr = shade(base, SHADE_RIGHT);
      for (let o = -S; o < S; o++) {
        if (o < 0 && !leftVisible) continue;
        if (o >= 0 && !rightVisible) continue;
        const top = cy - S / 2 + bottomRowForColumn(o) + 1;
        const c = o < 0 ? cl : cr;
        for (let y = top; y < top + FACE_H; y++) putOpaque(cx + o, y, c);
      }
    }
  }

  return { width, height, pixels };
}

module.exports = { renderSprite, S, FACE_H };

// ---------------------------------------------------------------------------
// Self-check: `node src/assets/voxelPainter.js`. Box projections are convex
// hexagons, so any transparent pixel between the first and last opaque pixel
// of a row is a seam bug (diamond tessellation or face stacking gap).
// ---------------------------------------------------------------------------
if (require.main === module) {
  const assert = require('assert');

  function checkSolid(id, boxArgs) {
    const { width, height, pixels } = renderSprite({
      id,
      shadow: false,
      build(v) { v.box(...boxArgs, '#a0a0a0'); },
    });
    for (let y = 0; y < height; y++) {
      let first = -1, last = -1;
      for (let x = 0; x < width; x++) {
        const a = pixels[(y * width + x) * 4 + 3];
        assert(a === 0 || a === 255, `${id}: unexpected alpha ${a} at ${x},${y}`);
        if (a === 255) { if (first < 0) first = x; last = x; }
      }
      for (let x = first; x >= 0 && x <= last; x++) {
        assert.strictEqual(pixels[(y * width + x) * 4 + 3], 255,
          `${id}: transparent hole inside silhouette at ${x},${y}`);
      }
    }
    return { width, height, pixels };
  }

  // single voxel: exact canvas size and mirror-symmetric alpha coverage
  const one = checkSolid('probe-one', [0, 0, 0, 1, 1, 1]);
  assert.strictEqual(one.width, 2 * S + 2 * PAD, 'single voxel width');
  assert.strictEqual(one.height, S + FACE_H + 2 * PAD, 'single voxel height');
  for (let y = 0; y < one.height; y++) {
    for (let x = 0; x < one.width; x++) {
      const a = one.pixels[(y * one.width + x) * 4 + 3];
      const m = one.pixels[(y * one.width + (one.width - 1 - x)) * 4 + 3];
      assert.strictEqual(a, m, `probe-one: asymmetric alpha at ${x},${y}`);
    }
  }

  checkSolid('probe-slab', [0, 0, 0, 2, 2, 1]);   // diamond tessellation
  checkSolid('probe-tower', [0, 0, 0, 1, 1, 3]);  // vertical face stacking
  checkSolid('probe-block', [0, 0, 0, 3, 3, 2]);  // both combined

  console.log('voxelPainter self-check OK');
}
