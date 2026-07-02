'use strict';
// Canvas renderer: cream backdrop + soft vignette, the floating tile platform
// (terrain back-to-front so front tiles occlude interior dirt walls), objects in
// isometric depth order (lifted onto the tile-top surface), grid overlay, hover,
// and the placement/erase preview. Reads world state from the Game. JTV.Renderer.

(function () {
  class Renderer {
    constructor(canvas, config, game, camera, assets) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.config = config;
      this.game = game;
      this.grid = game.grid;
      this.map = game.map;
      this.camera = camera;
      this.assets = assets;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.viewW = 0;
      this.viewH = 0;
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.viewW = rect.width;
      this.viewH = rect.height;
      this.canvas.width = Math.round(rect.width * this.dpr);
      this.canvas.height = Math.round(rect.height * this.dpr);
    }

    // grid-space anchor for an object at (col,row), lifted onto the tile surface
    objectAnchor(col, row) {
      const a = this.grid.cellToAnchor(col, row);
      return { x: a.x, y: a.y - this.grid.objectLift };
    }

    drawSprite(id, anchorWorld, alpha) {
      const a = this.assets.get(id);
      if (!a) return;
      const s = this.camera.worldToScreen(anchorWorld);
      const z = this.camera.zoom;
      if (alpha != null) this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(a.img, s.x - a.meta.ax * z, s.y - a.meta.ay * z, a.meta.w * z, a.meta.h * z);
      if (alpha != null) this.ctx.globalAlpha = 1;
    }

    // symmetric flat diamonds (highlights): center on the tile-top face
    drawCentered(id, centerWorld, alpha) {
      const a = this.assets.get(id);
      if (!a) return;
      const s = this.camera.worldToScreen(centerWorld);
      const z = this.camera.zoom;
      if (alpha != null) this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(a.img, s.x - (a.meta.w / 2) * z, s.y - (a.meta.h / 2) * z, a.meta.w * z, a.meta.h * z);
      if (alpha != null) this.ctx.globalAlpha = 1;
    }

    drawBackground() {
      const { ctx, viewW, viewH } = this;
      const c = this.config.colors;
      ctx.fillStyle = c.background;
      ctx.fillRect(0, 0, viewW, viewH);
      const g = ctx.createRadialGradient(
        viewW / 2, viewH * 0.42, Math.min(viewW, viewH) * 0.2,
        viewW / 2, viewH * 0.5, Math.max(viewW, viewH) * 0.75,
      );
      g.addColorStop(0, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, c.backgroundEdge);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, viewW, viewH);
    }

    drawGridOverlay() {
      const { ctx, grid, camera } = this;
      const { cols, rows } = this.config.grid;
      ctx.lineWidth = 1;
      ctx.strokeStyle = this.config.colors.gridLine;
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          const ctr = grid.cellCenter(col, r);
          const top = camera.worldToScreen({ x: ctr.x, y: ctr.y - grid.halfH });
          const right = camera.worldToScreen({ x: ctr.x + grid.halfW, y: ctr.y });
          const bot = camera.worldToScreen({ x: ctr.x, y: ctr.y + grid.halfH });
          const left = camera.worldToScreen({ x: ctr.x - grid.halfW, y: ctr.y });
          ctx.beginPath();
          ctx.moveTo(top.x, top.y);
          ctx.lineTo(right.x, right.y);
          ctx.lineTo(bot.x, bot.y);
          ctx.lineTo(left.x, left.y);
          ctx.closePath();
          ctx.stroke();
        }
      }
    }

    drawTerrain() {
      const { cols, rows } = this.config.grid;
      for (let d = 0; d <= cols + rows - 2; d++) {
        for (let col = 0; col < cols; col++) {
          const r = d - col;
          if (r < 0 || r >= rows) continue;
          let id = this.map.terrain[r][col];
          // water auto-connects: swap in the 4-neighbor-mask variant
          if (id === 'tile-water') id = 'tile-water-' + this.map.waterMaskAt(col, r);
          this.drawSprite(id, this.grid.cellToAnchor(col, r));
        }
      }
    }

    drawObjects() {
      const order = this.map.objectsInDrawOrder();
      for (const obj of order) this.drawSprite(obj.id, this.objectAnchor(obj.col, obj.row));
    }

    // footprint cells highlighted valid/invalid + a translucent ghost sprite
    drawPreview() {
      const p = this.game.getPreview();
      if (!p) return;

      if (p.mode === 'erase') {
        if (p.target) {
          for (const cell of p.target.cells()) {
            this.drawCentered('ui-highlight-invalid', this.grid.cellCenter(cell.col, cell.row), 0.9);
          }
        } else {
          this.drawCentered('ui-highlight-hover', this.grid.cellCenter(this.game.hover.col, this.game.hover.row));
        }
        return;
      }

      const hl = p.valid ? 'ui-highlight-valid' : 'ui-highlight-invalid';
      for (let r = p.row; r < p.row + p.h; r++) {
        for (let c = p.col; c < p.col + p.w; c++) {
          if (this.grid.inBounds(c, r, this.config.grid.cols, this.config.grid.rows)) {
            this.drawCentered(hl, this.grid.cellCenter(c, r), 0.85);
          }
        }
      }
      // ghost of the asset itself (terrain sits flat, objects lift onto the surface)
      const anchor = p.category === 'terrain'
        ? this.grid.cellToAnchor(p.col, p.row)
        : this.objectAnchor(p.col, p.row);
      this.drawSprite(p.id, anchor, p.valid ? 0.6 : 0.35);
    }

    render() {
      const { ctx } = this;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      this.drawBackground();
      if (this.config.ui.showGrid) this.drawGridOverlay();
      this.drawTerrain();
      this.drawObjects();
      this.drawPreview();
    }
  }

  window.JTV = window.JTV || {};
  window.JTV.Renderer = Renderer;
})();
