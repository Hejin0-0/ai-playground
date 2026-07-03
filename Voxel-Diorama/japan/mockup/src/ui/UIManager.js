'use strict';
// Builds the DOM UI and keeps it in sync with the Game. Owns the #ui root and
// wires toolbar/palette actions to game + renderer. JTV.UIManager.

(function () {
  class UIManager {
    constructor(config, game, renderer) {
      this.config = config;
      this.game = game;
      this.renderer = renderer;

      const root = document.createElement('div');
      root.id = 'ui';
      document.body.appendChild(root);
      this.root = root;

      this.hud = new window.JTV.HUD(root);

      this.handlers = {};           // save/reset injected by main

      this.toolbar = new window.JTV.Toolbar(root, config, {
        place: () => this.setTool('place'),
        erase: () => this.setTool('erase'),
        pan: () => this.setTool('pan'),
        grid: () => this.toggleGrid(),
        save: () => this.save(),
        reset: () => this.reset(),
      });

      this.palette = new window.JTV.AssetPalette(root, config, window.ASSET_MANIFEST, (id) => {
        game.selectAsset(id); // switches tool to 'place'
        this.sync();
      });

      this.palette.setSelected(game.selectedId);
      this.sync();
    }

    on(name, fn) { this.handlers[name] = fn; }

    // --- action layer: toolbar clicks AND keyboard shortcuts route here ---
    setTool(tool) { this.game.setTool(tool); this.sync(); }
    toggleGrid() { this.config.ui.showGrid = !this.config.ui.showGrid; this.sync(); }
    selectCategory(key) { this.palette.showCategory(key); }
    save() {
      if (this.handlers.save) this.handlers.save();
      this.flashSaved();
    }
    reset() { if (this.handlers.reset) this.handlers.reset(); }

    // brief visual confirmation on save (buttons give no other feedback)
    flashSaved() {
      const btn = this.toolbar.buttons.save;
      btn.classList.add('active');
      clearTimeout(this._flash);
      this._flash = setTimeout(() => btn.classList.remove('active'), 350);
    }

    // push current game state onto the toolbar/palette highlights + cursor
    sync() {
      this.toolbar.refreshState(this.game.tool, this.config.ui.showGrid);
      this.palette.setSelected(this.game.selectedId);
      const canvas = document.getElementById('game');
      if (canvas) canvas.dataset.tool = this.game.tool;
    }
  }

  window.JTV = window.JTV || {};
  window.JTV.UIManager = UIManager;
})();
