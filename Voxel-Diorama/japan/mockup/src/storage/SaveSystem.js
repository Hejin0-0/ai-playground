'use strict';
// Serializes the world to/from localStorage. Pure serialize/deserialize (node-
// testable) wrapped by save/load. localStorage is user-controlled, so load
// validates and skips anything malformed. Dual-module + node self-check.

(function () {
  function getTileMap() {
    if (typeof module !== 'undefined' && module.exports) return require('../grid/TileMap').TileMap;
    return window.JTV.TileMap;
  }

  const VERSION = 1;

  class SaveSystem {
    constructor(key) { this.key = key || 'jtv-save'; }

    serialize(map) {
      return {
        version: VERSION,
        cols: map.cols,
        rows: map.rows,
        terrain: map.terrain.map((row) => row.slice()),
        objects: map.objects.map((o) => ({ id: o.id, col: o.col, row: o.row, w: o.w, h: o.h })),
      };
    }

    // Build a fresh TileMap from parsed data. Returns null if data is unusable.
    deserialize(data) {
      if (!data || data.version !== VERSION) return null;
      const cols = data.cols, rows = data.rows;
      if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) return null;
      if (!Array.isArray(data.terrain) || data.terrain.length !== rows) return null;

      const TileMap = getTileMap();
      const map = new TileMap(cols, rows, 'tile-grass');
      for (let r = 0; r < rows; r++) {
        const srcRow = data.terrain[r];
        if (!Array.isArray(srcRow) || srcRow.length !== cols) continue;
        for (let c = 0; c < cols; c++) {
          if (typeof srcRow[c] === 'string') map.terrain[r][c] = srcRow[c];
        }
      }
      if (Array.isArray(data.objects)) {
        for (const o of data.objects) {
          if (!o || typeof o.id !== 'string') continue;
          if (![o.col, o.row, o.w, o.h].every(Number.isInteger)) continue;
          map.addObject(o.id, o.col, o.row, o.w, o.h); // no-ops on overlap / out-of-bounds
        }
      }
      return map;
    }

    save(map) {
      try { localStorage.setItem(this.key, JSON.stringify(this.serialize(map))); return true; }
      catch (e) { return false; }
    }

    load() {
      try {
        const raw = localStorage.getItem(this.key);
        return raw ? this.deserialize(JSON.parse(raw)) : null;
      } catch (e) { return null; }
    }

    clear() {
      try { localStorage.removeItem(this.key); } catch (e) { /* ignore */ }
    }
  }

  const api = { SaveSystem };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.JTV = window.JTV || {};
    window.JTV.SaveSystem = SaveSystem;
  }

  // --- self-check: node src/storage/SaveSystem.js ---
  if (typeof require !== 'undefined' && require.main === module) {
    const assert = require('assert');
    const { TileMap } = require('../grid/TileMap');
    const ss = new SaveSystem();

    const map = new TileMap(12, 12, 'tile-grass');
    map.setTerrain(3, 4, 'tile-path');
    map.setTerrain(7, 2, 'tile-water');
    map.addObject('building-temple', 5, 5, 3, 3);
    map.addObject('prop-stone-lantern', 1, 1, 1, 1);
    map.addObject('prop-torii-gate', 8, 8, 2, 1);

    const round = ss.deserialize(JSON.parse(JSON.stringify(ss.serialize(map))));
    assert(round, 'deserialize returned a map');

    // terrain identical
    for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) {
      assert.strictEqual(round.terrain[r][c], map.terrain[r][c], `terrain ${c},${r}`);
    }
    // objects identical (count + placement + occupancy rebuilt)
    assert.strictEqual(round.objects.length, map.objects.length, 'object count');
    assert.strictEqual(round.objectAt(6, 6) && round.objectAt(6, 6).id, 'building-temple', 'temple rebuilt');
    assert.strictEqual(round.objectAt(9, 8) && round.objectAt(9, 8).id, 'prop-torii-gate', 'torii footprint rebuilt');
    assert.strictEqual(round.canPlace(5, 5, 1, 1), false, 'occupancy index rebuilt');

    // robustness: malformed input never throws, just yields null / skips
    assert.strictEqual(ss.deserialize(null), null, 'null data');
    assert.strictEqual(ss.deserialize({ version: 99 }), null, 'wrong version');
    const grassRows = Array.from({ length: 4 }, () => new Array(4).fill('tile-grass'));
    const partial = ss.deserialize({ version: 1, cols: 4, rows: 4, terrain: grassRows, objects: 'nope' });
    assert(partial, 'tolerates junk objects field');
    assert.strictEqual(partial.objects.length, 0, 'junk objects ignored');

    console.log('SaveSystem self-check OK');
  }
})();
