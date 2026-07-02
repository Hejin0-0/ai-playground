'use strict';
// Mouse input -> camera pan (drag), zoom (wheel, cursor-anchored), and hover
// cell tracking. Thin for Task 3; place/erase land in Task 4. Global JTV.InputManager.

(function () {
  const DRAG_THRESHOLD = 4; // px before a press counts as a drag (not a click)

  class InputManager {
    constructor(canvas, config, grid, camera, renderer) {
      this.canvas = canvas;
      this.config = config;
      this.grid = grid;
      this.camera = camera;
      this.renderer = renderer;
      this.pressing = false;
      this.dragging = false;
      this.last = { x: 0, y: 0 };
      this.pressStart = { x: 0, y: 0 };
      this._bind();
    }

    localPos(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    updateHover(pos) {
      const world = this.camera.screenToWorld(pos);
      const cell = this.grid.pointToCell(world.x, world.y);
      const { cols, rows } = this.config.grid;
      this.renderer.setHover(this.grid.inBounds(cell.col, cell.row, cols, rows) ? cell : null);
    }

    _bind() {
      const c = this.canvas;
      c.addEventListener('mousedown', (e) => {
        this.pressing = true;
        this.dragging = false;
        const p = this.localPos(e);
        this.last = p;
        this.pressStart = p;
      });

      window.addEventListener('mousemove', (e) => {
        const p = this.localPos(e);
        if (this.pressing) {
          if (!this.dragging &&
              Math.hypot(p.x - this.pressStart.x, p.y - this.pressStart.y) > DRAG_THRESHOLD) {
            this.dragging = true;
            c.classList.add('grabbing');
          }
          if (this.dragging) {
            this.camera.panBy(p.x - this.last.x, p.y - this.last.y);
          }
        }
        this.last = p;
        this.updateHover(p);
      });

      window.addEventListener('mouseup', () => {
        this.pressing = false;
        this.dragging = false;
        c.classList.remove('grabbing');
      });

      c.addEventListener('mouseleave', () => this.renderer.setHover(null));

      c.addEventListener('wheel', (e) => {
        e.preventDefault();
        const p = this.localPos(e);
        const step = this.config.camera.zoomStep;
        this.camera.zoomAt(p.x, p.y, e.deltaY < 0 ? step : 1 / step);
        this.updateHover(p);
      }, { passive: false });

      // reserve right-click for erase (Task 4); never show the browser menu
      c.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  window.JTV = window.JTV || {};
  window.JTV.InputManager = InputManager;
})();
