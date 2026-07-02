'use strict';
// Central controller: holds world state (TileMap), the placement rules, the
// current tool + selected asset, and turns input actions into edits. The UI
// (Task 6) and shortcuts/save (Task 7) drive it through this surface. Global JTV.Game.

(function () {
  class Game {
    constructor(config, grid) {
      this.config = config;
      this.grid = grid;
      this.manifest = {};
      for (const e of window.ASSET_MANIFEST) this.manifest[e.id] = e;

      const TileMap = window.JTV.TileMap;
      this.map = new TileMap(config.grid.cols, config.grid.rows, 'tile-grass');
      this.placement = new window.JTV.PlacementSystem(this.map, this.manifest);

      this.tool = 'place';       // 'place' | 'erase'
      this.selectedId = 'tile-grass';
      this.hover = null;         // {col,row}
    }

    selectAsset(id) {
      if (this.manifest[id]) { this.selectedId = id; this.tool = 'place'; }
    }
    setTool(tool) { this.tool = tool; }
    setHover(cell) { this.hover = cell; }

    inBounds(cell) {
      return cell && this.map.inBounds(cell.col, cell.row);
    }

    // left-click: place/paint the selected asset, or erase if in erase mode
    primaryAction(cell) {
      if (!this.inBounds(cell)) return;
      if (this.tool === 'erase') { this.placement.erase(cell.col, cell.row); return; }
      this.placement.apply(this.selectedId, cell.col, cell.row);
    }

    // right-click: always erase the object under the cursor
    secondaryAction(cell) {
      if (this.inBounds(cell)) this.placement.erase(cell.col, cell.row);
    }

    // What the renderer should preview at the hovered cell this frame.
    getPreview() {
      if (!this.inBounds(this.hover)) return null;
      const { col, row } = this.hover;
      if (this.tool === 'erase') {
        const obj = this.map.objectAt(col, row);
        return { mode: 'erase', target: obj };
      }
      const e = this.manifest[this.selectedId];
      if (!e) return null;
      const [w, h] = e.footprint;
      return {
        mode: 'place',
        id: this.selectedId,
        category: e.category,
        col, row, w, h,
        valid: this.placement.canPlace(this.selectedId, col, row),
      };
    }
  }

  window.JTV = window.JTV || {};
  window.JTV.Game = Game;
})();
