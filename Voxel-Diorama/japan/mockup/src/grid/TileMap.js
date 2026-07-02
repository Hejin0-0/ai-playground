'use strict';
// World state: an always-filled terrain layer + a list of footprint objects with
// an occupancy index. Provides isometric depth-ordered draw order for objects.
// Dual-module (browser global JTV.TileMap) + `node src/grid/TileMap.js` self-check.

(function () {
  function requirePlacedObject() {
    if (typeof module !== 'undefined' && module.exports) return require('../building/PlacedObject').PlacedObject;
    return window.JTV.PlacedObject;
  }

  class TileMap {
    constructor(cols, rows, defaultTile) {
      this.cols = cols;
      this.rows = rows;
      this.defaultTile = defaultTile;
      this.terrain = [];
      for (let r = 0; r < rows; r++) this.terrain.push(new Array(cols).fill(defaultTile));
      this.objects = [];
      this.occ = new Map(); // "col,row" -> PlacedObject
    }

    inBounds(col, row) {
      return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
    }

    // --- terrain layer (1x1, always present; painting keeps objects on top) ---
    getTerrain(col, row) {
      return this.inBounds(col, row) ? this.terrain[row][col] : null;
    }

    setTerrain(col, row, tileId) {
      if (this.inBounds(col, row)) this.terrain[row][col] = tileId;
    }

    // --- object layer ---
    objectAt(col, row) {
      return this.occ.get(col + ',' + row) || null;
    }

    // Can an object with this footprint occupy (col,row)? All cells must be
    // in-bounds and free of other objects. Terrain never blocks.
    canPlace(col, row, w, h) {
      for (let r = row; r < row + h; r++) {
        for (let c = col; c < col + w; c++) {
          if (!this.inBounds(c, r)) return false;
          if (this.occ.has(c + ',' + r)) return false;
        }
      }
      return true;
    }

    addObject(id, col, row, w, h) {
      if (!this.canPlace(col, row, w, h)) return null;
      const PlacedObject = requirePlacedObject();
      const obj = new PlacedObject(id, col, row, w, h);
      this.objects.push(obj);
      for (const cell of obj.cells()) this.occ.set(cell.col + ',' + cell.row, obj);
      return obj;
    }

    // Remove the object occupying (col,row), clearing its whole footprint.
    removeObjectAt(col, row) {
      const obj = this.objectAt(col, row);
      if (!obj) return null;
      this.objects = this.objects.filter((o) => o !== obj);
      for (const cell of obj.cells()) this.occ.delete(cell.col + ',' + cell.row);
      return obj;
    }

    // Isometric painter's order. Edge a->b means "a is strictly behind b" (a
    // drawn first). For axis-aligned footprints on the ground this relation is a
    // DAG for every pair whose sprites actually overlap on screen; a topological
    // sort yields a correct order. Non-overlapping pairs may form cycles (they
    // don't overlap, so any order is fine) — broken deterministically by key.
    objectsInDrawOrder() {
      const objs = this.objects;
      const n = objs.length;
      const behind = (a, b) => a.c1 < b.c0 || a.r1 < b.r0; // a strictly behind b
      const indeg = new Array(n).fill(0);
      const edges = [];
      for (let i = 0; i < n; i++) edges.push([]);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          if (behind(objs[i], objs[j])) { edges[i].push(j); indeg[j]++; }
        }
      }
      const key = (o) => (o.c0 + o.r0) * 1000 + o.r0; // deterministic tie-break
      const ready = [];
      for (let i = 0; i < n; i++) if (indeg[i] === 0) ready.push(i);
      const order = [];
      const placed = new Array(n).fill(false);
      while (order.length < n) {
        if (ready.length === 0) {
          // cycle among non-overlapping objects: release the lowest-key remainder
          let best = -1;
          for (let i = 0; i < n; i++) {
            if (!placed[i] && (best < 0 || key(objs[i]) < key(objs[best]))) best = i;
          }
          ready.push(best);
        }
        ready.sort((a, b) => key(objs[a]) - key(objs[b]));
        const i = ready.shift();
        if (placed[i]) continue;
        placed[i] = true;
        order.push(objs[i]);
        for (const j of edges[i]) if (--indeg[j] === 0 && !placed[j]) ready.push(j);
      }
      return order;
    }
  }

  const api = { TileMap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.JTV = window.JTV || {};
    window.JTV.TileMap = TileMap;
  }

  // --- self-check: node src/grid/TileMap.js ---
  if (typeof require !== 'undefined' && require.main === module) {
    const assert = require('assert');
    const map = new TileMap(12, 12, 'tile-grass');

    // terrain defaults + painting keeps it independent
    assert.strictEqual(map.getTerrain(0, 0), 'tile-grass');
    map.setTerrain(3, 4, 'tile-path');
    assert.strictEqual(map.getTerrain(3, 4), 'tile-path');

    // place a 3x3 temple at (5,5); it occupies (5..7, 5..7)
    const temple = map.addObject('building-temple', 5, 5, 3, 3);
    assert(temple, 'temple placed');
    assert.strictEqual(map.objectAt(6, 6), temple, 'interior cell occupied');
    assert.strictEqual(map.objectAt(7, 7), temple, 'far corner occupied');

    // overlap rules: nothing may be placed on any occupied cell
    assert.strictEqual(map.canPlace(7, 7, 1, 1), false, '1x1 on temple corner blocked');
    assert.strictEqual(map.canPlace(4, 4, 2, 2), false, '2x2 straddling temple blocked');
    assert.strictEqual(map.canPlace(8, 8, 2, 2), true, 'clear 2x2 allowed');
    assert.strictEqual(map.canPlace(11, 11, 2, 1), false, 'out-of-bounds blocked');

    // painting terrain under an object keeps the object
    map.setTerrain(6, 6, 'tile-stone');
    assert.strictEqual(map.getTerrain(6, 6), 'tile-stone');
    assert.strictEqual(map.objectAt(6, 6), temple, 'temple survives terrain paint');

    // depth sort: a lantern BEHIND the temple draws first; walked in FRONT, last
    const back = map.addObject('prop-stone-lantern', 5, 3, 1, 1); // r1=3 < temple.r0=5
    let order = map.objectsInDrawOrder();
    assert(order.indexOf(back) < order.indexOf(temple), 'back lantern before temple');

    map.removeObjectAt(5, 3);
    const front = map.addObject('prop-stone-lantern', 5, 9, 1, 1); // r0=9 > temple.r1=7
    order = map.objectsInDrawOrder();
    assert(order.indexOf(temple) < order.indexOf(front), 'temple before front lantern');

    // the +col case that a naive far-corner sort gets wrong: a lantern one col
    // past the temple must draw AFTER it (in front), even at a smaller row
    const side = map.addObject('prop-stone-lantern', 8, 5, 1, 1); // c0=8 > temple.c1=7
    order = map.objectsInDrawOrder();
    assert(order.indexOf(temple) < order.indexOf(side), 'temple before +col-side lantern');

    // erase removes the whole footprint and frees its cells
    map.removeObjectAt(6, 6); // any temple cell
    assert.strictEqual(map.objectAt(5, 5), null, 'temple fully removed');
    assert.strictEqual(map.canPlace(5, 5, 3, 3), true, 'cells freed after erase');

    console.log('TileMap self-check OK');
  }
})();
