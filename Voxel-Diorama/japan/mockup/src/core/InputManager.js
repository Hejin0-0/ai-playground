'use strict';
// Mouse input -> camera pan (left-drag), zoom (wheel, cursor-anchored), hover
// tracking, and edits: left-click places/paints, right-click erases. A press
// only counts as a place if it didn't cross the drag threshold. Global JTV.InputManager.

(function () {
  const DRAG_THRESHOLD = 4; // px before a press becomes a pan (not a click)

  class InputManager {
    constructor(canvas, config, grid, camera, game, ui) {
      this.canvas = canvas;
      this.config = config;
      this.grid = grid;
      this.camera = camera;
      this.game = game;
      this.ui = ui;
      this.pressing = false;
      this.dragging = false;
      this.last = { x: 0, y: 0 };
      this.pressStart = { x: 0, y: 0 };
      this._bind();
      this._bindKeys();
    }

    localPos(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    cellAt(pos) {
      const world = this.camera.screenToWorld(pos);
      const cell = this.grid.pointToCell(world.x, world.y);
      const { cols, rows } = this.config.grid;
      return this.grid.inBounds(cell.col, cell.row, cols, rows) ? cell : null;
    }

    updateHover(pos) {
      this.game.setHover(this.cellAt(pos));
    }

    _bind() {
      const c = this.canvas;

      c.addEventListener('mousedown', (e) => {
        const p = this.localPos(e);
        this.updateHover(p);
        if (e.button === 2) {                 // right-click: erase immediately
          e.preventDefault();
          this.game.secondaryAction(this.game.hover);
          return;
        }
        if (e.button === 0) {
          this.pressing = true;
          this.dragging = false;
          this.last = p;
          this.pressStart = p;
        }
      });

      window.addEventListener('mousemove', (e) => {
        const p = this.localPos(e);
        if (this.pressing) {
          if (!this.dragging &&
              Math.hypot(p.x - this.pressStart.x, p.y - this.pressStart.y) > DRAG_THRESHOLD) {
            this.dragging = true;
            c.classList.add('grabbing');
          }
          if (this.dragging) this.camera.panBy(p.x - this.last.x, p.y - this.last.y);
        }
        this.last = p;
        this.updateHover(p);
      });

      window.addEventListener('mouseup', (e) => {
        if (e.button === 0 && this.pressing) {
          if (!this.dragging) {
            this.updateHover(this.localPos(e));
            this.game.primaryAction(this.game.hover);
          }
          this.pressing = false;
          this.dragging = false;
          c.classList.remove('grabbing');
        }
      });

      c.addEventListener('mouseleave', () => this.game.setHover(null));

      c.addEventListener('wheel', (e) => {
        e.preventDefault();
        const p = this.localPos(e);
        const step = this.config.camera.zoomStep;
        this.camera.zoomAt(p.x, p.y, e.deltaY < 0 ? step : 1 / step);
        this.updateHover(p);
      }, { passive: false });

      c.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // keyboard shortcuts: 1-5 categories, E erase, G grid, S save, R reset
    _bindKeys() {
      const cats = ['terrain', 'nature', 'props', 'water', 'buildings'];
      window.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser combos alone
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        let handled = true;
        if (e.key >= '1' && e.key <= '5') this.ui.selectCategory(cats[+e.key - 1]);
        else switch (e.key.toLowerCase()) {
          case 'e': this.ui.setTool('erase'); break;
          case 'g': this.ui.toggleGrid(); break;
          case 's': this.ui.save(); break;
          case 'r': this.ui.reset(); break;
          default: handled = false;
        }
        if (handled) e.preventDefault();
      });
    }
  }

  window.JTV = window.JTV || {};
  window.JTV.InputManager = InputManager;
})();
