'use strict';
// Applies the placement rules to a TileMap. Terrain category paints the terrain
// layer (1x1, keeps objects on top); every other category places a footprint
// object (blocked if any cell is occupied). Browser global JTV.PlacementSystem.

(function () {
  class PlacementSystem {
    constructor(tileMap, manifestIndex) {
      this.map = tileMap;
      this.manifest = manifestIndex; // id -> { category, footprint:[w,h] }
    }

    entry(id) { return this.manifest[id]; }
    isTerrain(id) { const e = this.entry(id); return !!e && e.category === 'terrain'; }
    footprint(id) { const e = this.entry(id); return e ? e.footprint : [1, 1]; }

    // Would placing `id` at (col,row) succeed? Terrain is always allowed in-bounds.
    canPlace(id, col, row) {
      const e = this.entry(id);
      if (!e) return false;
      if (e.category === 'terrain') return this.map.inBounds(col, row);
      const [w, h] = e.footprint;
      return this.map.canPlace(col, row, w, h);
    }

    // Place/paint at (col,row). Returns 'terrain' | PlacedObject | null.
    apply(id, col, row) {
      const e = this.entry(id);
      if (!e || !this.canPlace(id, col, row)) return null;
      if (e.category === 'terrain') {
        this.map.setTerrain(col, row, id);
        return 'terrain';
      }
      const [w, h] = e.footprint;
      return this.map.addObject(id, col, row, w, h);
    }

    // Erase the object at (col,row) — objects only, never terrain.
    erase(col, row) {
      return this.map.removeObjectAt(col, row);
    }
  }

  window.JTV = window.JTV || {};
  window.JTV.PlacementSystem = PlacementSystem;
})();
