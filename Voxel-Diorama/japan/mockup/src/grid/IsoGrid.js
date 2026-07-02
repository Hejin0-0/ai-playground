'use strict';
// Isometric grid geometry: converts between grid cells and grid-space pixels
// (pre-camera), and picks the cell under a point. Dual-module: browser global
// JTV.IsoGrid, plus a `node src/grid/IsoGrid.js` round-trip self-check.
//
// Coordinate note: cellToAnchor returns the lattice point where a sprite's
// anchor (voxel 0,0,0 top-diamond-center, per assets/meta.js) is placed, so
// tiles and props share one alignment. The visible tile diamond's CENTER sits
// ANCHOR_TO_CENTER below that lattice point — picking works in that centered
// frame so the hovered cell matches the tile under the cursor.

(function () {
  class IsoGrid {
    constructor(metrics) {
      this.tileW = metrics.tileW;
      this.tileH = metrics.tileH;
      this.cellVoxels = metrics.cellVoxels;
      this.halfW = this.tileW / 2;
      this.halfH = this.tileH / 2;
      // The pickable surface is a terrain tile's TOP face. Relative to the
      // anchor lattice point (sprite anchor = voxel 0,0,0 top, 1 voxel up), the
      // top-face center is the horizontal-plane center shift minus the tile's
      // extra height. With 4-tall tiles this nets to ~-1.4px (essentially the
      // lattice point itself) — using the ground-plane center instead would put
      // hover a half-tile low.
      const horizCenterY = this.halfH * (this.cellVoxels - 1) / this.cellVoxels;
      this.tileTopVoxels = metrics.tileTopVoxels || 4;
      const heightY = (this.tileTopVoxels - 1) * metrics.zStepPx;
      this.surfaceOffsetY = horizCenterY - heightY;
      // objects are modeled from z=0; lift their anchor by the full tile height
      // so their base rests on the tile's top surface (grid-space px, up).
      this.objectLift = this.tileTopVoxels * metrics.zStepPx;
    }

    // grid cell -> anchor lattice point in grid-space pixels (pre-camera)
    cellToAnchor(col, row) {
      return {
        x: (col - row) * this.halfW,
        y: (col + row) * this.halfH,
      };
    }

    // grid cell -> visible tile-top-face center in grid-space pixels
    cellCenter(col, row) {
      const a = this.cellToAnchor(col, row);
      return { x: a.x, y: a.y + this.surfaceOffsetY };
    }

    // grid-space point -> fractional cell coords (round for nearest cell)
    pointToCellFloat(x, y) {
      const dx = x;
      const dy = y - this.surfaceOffsetY;
      return {
        col: (dx / this.halfW + dy / this.halfH) / 2,
        row: (dy / this.halfH - dx / this.halfW) / 2,
      };
    }

    // grid-space point -> integer cell (which diamond contains the point)
    pointToCell(x, y) {
      const f = this.pointToCellFloat(x, y);
      return { col: Math.round(f.col), row: Math.round(f.row) };
    }

    inBounds(col, row, cols, rows) {
      return col >= 0 && row >= 0 && col < cols && row < rows;
    }
  }

  const api = { IsoGrid };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.JTV = window.JTV || {};
    window.JTV.IsoGrid = IsoGrid;
  }

  // --- self-check: node src/grid/IsoGrid.js ---
  if (typeof require !== 'undefined' && require.main === module) {
    const assert = require('assert');
    const g = new IsoGrid({ tileW: 128, tileH: 64, cellVoxels: 8, zStepPx: 9.798, tileTopVoxels: 4 });

    // every cell center round-trips back to that exact cell
    for (let c = -3; c <= 15; c++) {
      for (let r = -3; r <= 15; r++) {
        const ctr = g.cellCenter(c, r);
        const back = g.pointToCell(ctr.x, ctr.y);
        assert.strictEqual(back.col, c, `col round-trip ${c},${r}`);
        assert.strictEqual(back.row, r, `row round-trip ${c},${r}`);
      }
    }

    // adjacent cells are exactly one tile apart on the lattice
    const o = g.cellToAnchor(0, 0);
    assert.deepStrictEqual(g.cellToAnchor(1, 0), { x: 64, y: 32 }, '+col basis');
    assert.deepStrictEqual(g.cellToAnchor(0, 1), { x: -64, y: 32 }, '+row basis');
    assert.strictEqual(o.x, 0);

    // tile-top surface is essentially at the lattice point (not the ground plane)
    assert(Math.abs(g.surfaceOffsetY + 1.394) < 0.01, `surfaceOffsetY ${g.surfaceOffsetY}`);

    // points inside a diamond pick that cell; a far-diagonal point does not
    const ctr55 = g.cellCenter(5, 5);
    assert.deepStrictEqual(g.pointToCell(ctr55.x, ctr55.y + g.halfH - 3), { col: 5, row: 5 });
    assert.deepStrictEqual(g.pointToCell(ctr55.x + g.halfW - 3, ctr55.y), { col: 5, row: 5 });
    const diag = g.pointToCell(ctr55.x + g.halfW * 0.7, ctr55.y + g.halfH * 0.7);
    assert(!(diag.col === 5 && diag.row === 5), 'far-diagonal tips to a neighbor');

    console.log('IsoGrid self-check OK');
  }
})();
