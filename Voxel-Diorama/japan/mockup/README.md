# Japanese Temple Voxels

A small isometric voxel temple-village builder that runs entirely in the browser.
Build with terrain, nature, props, water features, and buildings on a 12×12 floating
platform; pan, zoom, save, and reset. Every visible pixel comes from an asset pack this
project generates itself — no external images, icon fonts, or emoji.

## Run

Open `index.html` in a browser. No build step, no server — it works from `file://`
(classic `<script>` tags, no modules or `fetch`).

## Controls

| Action | Input |
| --- | --- |
| Place / paint | Left click |
| Remove object | Right click, or Erase tool |
| Pan | Drag |
| Zoom | Mouse wheel |
| Categories | `1`–`5` |
| Erase / Grid / Save / Reset | `E` / `G` / `S` / `R` |

The world auto-saves to `localStorage` on **Save** and reloads on start. **Reset** clears
everything (after a confirm) and wipes the save.

## Regenerate the asset pack

The 76 PNGs in `assets/` are committed, so you only need this to change the art.
World sprites are real 3D voxel scenes rendered offline through headless Chrome; UI
chrome and the water variants are drawn procedurally.

```sh
cd tools/render-assets
npm install          # three + puppeteer-core — build-time only, never shipped
npm run render       # renders world sprites, then runs the stage-2 generator
```

`three` and `puppeteer-core` are devDependencies of `tools/render-assets/` only; the game
runtime has zero dependencies.

## Layout

```
index.html            entry — loads modules in dependency order
styles.css
src/
  config.js           grid size, colours, camera limits
  main.js             bootstrap: load assets, wire modules, RAF loop
  assets/             PNG encoder, voxel painter, models, manifest, generator, loader
  grid/               IsoGrid (projection + picking), TileMap (world state + depth sort)
  building/           PlacedObject, PlacementSystem
  core/               Game, Camera, Renderer, InputManager
  ui/                 UIManager, Toolbar, AssetPalette, HUD
  storage/            SaveSystem
tools/render-assets/  build-time Three.js → PNG pipeline (not part of the game)
assets/               generated pack (PNGs + meta.js + contact-sheet.html)
```

Several modules carry a runnable self-check (`node src/grid/TileMap.js`, etc.) covering
the load-bearing logic: isometric projection round-trips, occupancy + depth ordering,
save/load serialization, and PNG encoding.
