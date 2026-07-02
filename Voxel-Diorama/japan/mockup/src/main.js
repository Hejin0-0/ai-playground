'use strict';
// Bootstrap: load assets, wire modules, center the platform, run the RAF loop.

(function () {
  const JTV = window.JTV;

  function fitCameraToGrid(camera, grid, config, viewW, viewH) {
    const { cols, rows } = config.grid;
    // grid-space bounding box of all cell anchors
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [c, r] of [[0, 0], [cols - 1, 0], [0, rows - 1], [cols - 1, rows - 1]]) {
      const a = grid.cellToAnchor(c, r);
      minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x);
      minY = Math.min(minY, a.y); maxY = Math.max(maxY, a.y);
    }
    const spanX = maxX - minX + grid.tileW;
    const spanY = maxY - minY + grid.tileH * 2; // headroom for tall sprites
    const fit = Math.min(viewW / spanX, viewH / spanY, config.camera.maxZoom);
    camera.zoom = Math.max(config.camera.minZoom, fit * 0.92);
    camera.centerOn({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, viewW, viewH);
  }

  function boot() {
    const config = JTV.config;
    const canvas = document.getElementById('game');
    const grid = new JTV.IsoGrid(window.JTV_TILE_METRICS);
    const camera = new JTV.Camera(config);

    const status = document.getElementById('status');
    JTV.loadAssets(config).then((assets) => {
      const renderer = new JTV.Renderer(canvas, config, grid, camera, assets);
      renderer.resize();
      fitCameraToGrid(camera, grid, config, renderer.viewW, renderer.viewH);
      // eslint-disable-next-line no-new
      new JTV.InputManager(canvas, config, grid, camera, renderer);

      window.addEventListener('resize', () => renderer.resize());
      if (status) status.remove();

      // expose for later tasks / debugging
      JTV.game = { config, grid, camera, renderer, assets };

      (function loop() {
        renderer.render();
        requestAnimationFrame(loop);
      })();
    }).catch((err) => {
      console.error(err);
      if (status) status.textContent = 'Failed to load assets: ' + err.message;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
