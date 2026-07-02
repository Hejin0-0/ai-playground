'use strict';
// Canvas renderer: cream backdrop + soft vignette, the floating tile platform
// (back-to-front so front tiles occlude interior dirt walls), optional grid
// overlay, and the hover highlight. Browser global JTV.Renderer.

(function () {
  class Renderer {
    constructor(canvas, config, grid, camera, assets) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.config = config;
      this.grid = grid;
      this.camera = camera;
      this.assets = assets;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.viewW = 0;
      this.viewH = 0;
      // terrain layer: cols x rows, defaults to grass (Task 4 makes it editable)
      const { cols, rows } = config.grid;
      this.terrain = [];
      for (let r = 0; r < rows; r++) {
        this.terrain.push(new Array(cols).fill('tile-grass'));
      }
      this.hover = null; // {col, row}
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.viewW = rect.width;
      this.viewH = rect.height;
      this.canvas.width = Math.round(rect.width * this.dpr);
      this.canvas.height = Math.round(rect.height * this.dpr);
    }

    setHover(cell) { this.hover = cell; }

    drawSprite(id, anchorWorld) {
      const a = this.assets.get(id);
      if (!a) return;
      const s = this.camera.worldToScreen(anchorWorld);
      const z = this.camera.zoom;
      this.ctx.drawImage(
        a.img,
        s.x - a.meta.ax * z,
        s.y - a.meta.ay * z,
        a.meta.w * z,
        a.meta.h * z,
      );
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
      // outline each cell's top diamond
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
      // back-to-front: increasing (col+row) means lower on screen / in front
      for (let d = 0; d <= cols + rows - 2; d++) {
        for (let col = 0; col < cols; col++) {
          const r = d - col;
          if (r < 0 || r >= rows) continue;
          this.drawSprite(this.terrain[r][col], this.grid.cellToAnchor(col, r));
        }
      }
    }

    // Highlights are symmetric flat diamonds; center them on the tile-top face
    // so they overlay the picked cell exactly (independent of sprite anchor).
    drawCentered(id, centerWorld) {
      const a = this.assets.get(id);
      if (!a) return;
      const s = this.camera.worldToScreen(centerWorld);
      const z = this.camera.zoom;
      this.ctx.drawImage(
        a.img,
        s.x - (a.meta.w / 2) * z,
        s.y - (a.meta.h / 2) * z,
        a.meta.w * z,
        a.meta.h * z,
      );
    }

    drawHover() {
      if (!this.hover) return;
      const { col, row } = this.hover;
      if (!this.grid.inBounds(col, row, this.config.grid.cols, this.config.grid.rows)) return;
      this.drawCentered('ui-highlight-hover', this.grid.cellCenter(col, row));
    }

    render() {
      const { ctx } = this;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      this.drawBackground();
      if (this.config.ui.showGrid) this.drawGridOverlay();
      this.drawTerrain();
      this.drawHover();
    }
  }

  window.JTV = window.JTV || {};
  window.JTV.Renderer = Renderer;
})();
