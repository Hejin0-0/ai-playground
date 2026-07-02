'use strict';
// Loads every manifest PNG as an Image and pairs it with its meta (w/h/anchor).
// Works from file:// — plain Image().src, no fetch, no getImageData at runtime.
// Browser global JTV.loadAssets(config) -> Promise<{ get, has, all }>.

(function () {
  function loadAssets(config) {
    const manifest = window.ASSET_MANIFEST;
    const spriteMeta = window.JTV_SPRITE_META;
    if (!manifest || !spriteMeta) {
      return Promise.reject(new Error('assetManifest.js / meta.js must load before assetLoader'));
    }

    const store = {};
    const jobs = manifest.map((entry) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        store[entry.id] = { id: entry.id, img, meta: spriteMeta[entry.id], entry };
        resolve();
      };
      img.onerror = () => reject(new Error(`failed to load asset: ${entry.id}.png`));
      img.src = config.assetPath + entry.id + '.png';
    }));

    return Promise.all(jobs).then(() => ({
      get: (id) => store[id],
      has: (id) => Object.prototype.hasOwnProperty.call(store, id),
      all: () => store,
    }));
  }

  window.JTV = window.JTV || {};
  window.JTV.loadAssets = loadAssets;
})();
