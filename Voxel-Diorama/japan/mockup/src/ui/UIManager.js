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

      this.toolbar = new window.JTV.Toolbar(root, config, {
        place: () => { game.setTool('place'); this.sync(); },
        erase: () => { game.setTool('erase'); this.sync(); },
        pan: () => { game.setTool('pan'); this.sync(); },
        grid: () => { config.ui.showGrid = !config.ui.showGrid; this.sync(); },
        save: () => this.handlers.save && this.handlers.save(),
        reset: () => this.handlers.reset && this.handlers.reset(),
      });

      this.palette = new window.JTV.AssetPalette(root, config, window.ASSET_MANIFEST, (id) => {
        game.selectAsset(id); // switches tool to 'place'
        this.sync();
      });

      this.handlers = {};           // save/reset injected by main (Task 7 formalizes)
      this.palette.setSelected(game.selectedId);
      this.sync();
    }

    on(name, fn) { this.handlers[name] = fn; }

    // push current game state onto the toolbar/palette highlights
    sync() {
      this.toolbar.refreshState(this.game.tool, this.config.ui.showGrid);
      this.palette.setSelected(this.game.selectedId);
    }
  }

  window.JTV = window.JTV || {};
  window.JTV.UIManager = UIManager;
})();
