# Implementation Plan: Japanese Temple Voxels

## Overview

A browser-only isometric builder prototype. Phase one generates a complete, self-made
asset pack (~58 transparent PNGs) into `/assets/` via a zero-dependency Node script that
procedurally paints isometric voxel sprites. Phase two builds the game (canvas renderer,
grid, placement, UI, save) that consumes only that pack. Opens via `index.html` with no
build step and no server.

## Architecture Decisions

- **Asset generation = Node script, zero deps.** `node src/assets/generateAssets.js`
  writes PNGs using a tiny pure-JS PNG encoder over Node's built-in `zlib` (PNG is just
  IHDR + deflated scanlines + IEND). No node-canvas, no npm install. This satisfies
  "create assets first, then build the game" and "no external assets".
- **One shared voxel painter.** Every sprite is defined as a small 3D voxel model
  (list of colored boxes) projected to 2D iso with fixed top/left/right face shading and
  a shared pastel palette. One painter ⇒ all ~58 assets automatically style-coherent.
- **(Amended by Task 2b)** World-asset rendering upgrades from the 2D pixel painter to
  real 3D: Three.js voxel scenes rendered offline via Puppeteer, isolated in
  `tools/render-assets/` with its own `package.json` (three + puppeteer are
  devDependencies of the *build tool only* — the game runtime stays zero-dependency and
  `file://`-compatible). The voxel model definitions in `assetModels.js` are reused
  unchanged; only the "painter" swaps. Flat UI chrome and toolbar icons keep the 2D
  zero-dep pipeline. The 60-PNG contract, `meta.js` anchors, and completeness asserts
  all survive.
- **Classic `<script>` tags, not ES modules.** ES modules are blocked on `file://` by
  CORS in Chrome; the spec requires double-clicking `index.html`. Files load in
  dependency order and register on a single `JTV` namespace. `drawImage` and
  `localStorage` both work on `file://`; we never call `getImageData` at runtime, so
  canvas tainting is irrelevant.
- **Single canvas, painter's algorithm.** Depth sort by `(gridX + gridY)` on the object's
  anchor cell, terrain layer under object layer. Camera is a plain `{x, y, zoom}`
  transform. 12×12 grid — no perf tricks needed at this scale.
- **Two layers per cell.** `terrain[y][x]` (always filled, defaults to grass) and an
  object list with footprints. Painting terrain never touches objects; erase targets
  objects only. This directly implements the spec's layering rules.
- **Water connection = 4-neighbor mask.** Water/canal tiles pick edge variants from a
  neighbor bitmask at render time; no extra authored tiles beyond water + canal-edge
  variants the generator emits.

## Asset Manifest (generated, ~58 PNGs)

Terrain ×7, borders ×4, nature ×5, shrine props ×6, water/farming ×6, decorative ×13,
buildings ×5 (hut 2×2, main house 3×2, pagoda 2×2, watchtower 2×2, temple 3×3),
UI ×12 (button normal/hover/active, panel, tab, 6 toolbar icons, hover highlight,
placement preview valid/invalid). Exact list lives in `src/assets/assetManifest.js`,
shared by the generator and the game so they can never drift.

## Task List

### Phase 1: Asset Pipeline

## Task 1: PNG encoder + voxel sprite painter + generator harness ✅ DONE

**Description:** Build the pipeline: pure-JS PNG encoder (zlib-based), iso voxel painter
(voxel model → shaded 2D sprite with transparency + baked drop shadow), and the generator
entry that writes PNGs to `/assets/`. Prove it end-to-end with 3 assets: grass tile,
stone lantern, sakura tree.

**Acceptance criteria:**
- [x] `node src/assets/generateAssets.js` writes valid transparent PNGs into `/assets/`
      (cross-validated against macOS `sips` decoder)
- [x] The 3 proof sprites read as pastel Japanese-voxel style in an image viewer
- [x] Encoder has an assert-based self-check (encode → decode header/CRC round-trip)
      (bonus: painter also has a geometry self-check — seam/hole/symmetry probes)

**Verification:** run the generator; open the PNGs; `node src/assets/pngEncoder.js`
self-check exits 0.

**Dependencies:** None
**Files likely touched:** `src/assets/pngEncoder.js`, `src/assets/voxelPainter.js`,
`src/assets/generateAssets.js`
**Estimated scope:** M

## Task 2: Full asset pack — all models + manifest + contact sheet ✅ DONE

**Description:** Define all ~58 voxel models and the shared manifest (id, file, category,
footprint, palette icon flag). Generator also emits `assets/contact-sheet.html` that
displays every PNG on a cream background for visual QA in one glance.

**Acceptance criteria:**
- [x] Every manifest entry has a generated PNG; generator fails loudly on any mismatch
      (60 entries; manifest↔model↔file completeness asserts)
- [x] Contact sheet shows a coherent set: consistent iso angle, palette, shadows
      (browser-screenshot QA; fixed roof-pancake buildings + dark torii found by it)
- [x] UI assets (buttons, panel, tab, 6 toolbar icons, highlights) included — no emoji,
      no external icons (icons are tiny voxel glyphs in the same style)

**Verification:** run generator; count files vs manifest; eyeball contact sheet.

**Dependencies:** Task 1
**Files likely touched:** `src/assets/assetManifest.js`, `src/assets/assetModels.js`,
`src/assets/generateAssets.js`
**Estimated scope:** L (many small models, one mechanical pattern — split into two
sittings if fatigue shows: world assets, then UI assets)

## Task 2b: Three.js offline rendering upgrade for world assets ✅ DONE

**Description:** Swap the world-asset painter from 2D pixel projection to real 3D.
Each voxel model becomes a Three.js scene (one box per voxel, reusing the existing
`assetModels.js` build functions verbatim — same shapes, same seeded jitter), lit by a
warm rig (HemisphereLight ambient + directional key + low fill) with a shadow-catcher
ground plane so sprites bake *real* soft shadows. Shot with an OrthographicCamera at
the classic game-iso angle (azimuth 45°, elevation 30° → projected tile footprint is
exactly 2:1, keeping Task 3's grid math clean), captured as transparent PNGs via
Puppeteer (`omitBackground`). All tooling lives in `tools/render-assets/` with its own
`package.json` — three + puppeteer are build-time devDependencies only.

**Unchanged contracts (hard constraints):**
- Game runtime stays zero-dependency, classic script tags, opens via `file://`
- 60 PNGs in `/assets` with the same ids and naming
- `assets/meta.js` anchor system stays; anchors now computed by projecting the
  voxel-space origin through the camera; meta additionally exports tile metrics
  (tileW/tileH/zStep) so Task 3 reads projection constants instead of hardcoding
- Manifest↔model↔file completeness asserts unchanged and still green
- UI chrome (buttons/panel/tab/highlights) + 6 toolbar icons stay on the 2D pipeline

**Acceptance criteria:**
- [x] One command regenerates all 46 world PNGs via Three.js and the 14 UI PNGs via
      the 2D path; completeness checks pass (`npm run render` in tools/render-assets)
- [x] Warm key/fill/ambient lighting + real soft ground shadows; buildings and torii
      read visibly more dimensional in a before/after screenshot comparison
      (2D pack backed up for comparison; sRGB double-brightening bug caught and fixed)
- [x] Orthographic 45°/30° camera; projected tile footprint measures exactly 2:1
      (tileMetrics {tileW:128, tileH:64, zStepPx:9.8}; sprite bitmaps carry a ~1px
      antialiasing fringe, which placement ignores — anchors align the geometry)
- [x] No runtime dependency added to the game; three + puppeteer-core live only in
      tools/render-assets/package.json devDependencies

**Verification:** completeness asserts green; contact-sheet re-QA in a real browser
(five buildings + torii against the reference images); side-by-side old/new sprite
comparison for shadow/dimensionality improvement.

**Dependencies:** Task 2
**Files likely touched:** `tools/render-assets/` (new: package.json, camera/lights/
renderer, page harness), `src/assets/generateAssets.js` (route voxel models to the 3D
path, keep UI path), `assets/*`
**Estimated scope:** M–L

**Risks:** Puppeteer's Chromium download is large (one-time, build machine only);
rendered PNG bytes may differ across GPUs/drivers (acceptable — assets are committed,
regeneration is optional); headless-gl rejected as the backend (fragile native builds
on modern macOS/Node).

### Checkpoint: Asset pack complete
- [ ] Generator runs clean; contact sheet reviewed; style matches the two references
      (re-run after Task 2b)

### Phase 2: Core Game

## Task 3: Canvas shell — loader, camera, grid render, hover ✅ DONE

**Description:** `index.html` + config + asset loader (reads the same manifest) + render
loop. Draw the floating 12×12 grass platform on a cream backdrop with soft editor fog,
grid overlay, hovered-cell highlight (using the generated highlight sprite), mouse-drag
pan and wheel zoom.

**Acceptance criteria:**
- [x] Double-clicking `index.html` shows the platform; no console errors on `file://`
      (classic script tags, no fetch/modules; verified in-browser, only a favicon 404)
- [x] Pan (drag) and zoom (wheel, cursor-anchored) are smooth (drag delta 1:1;
      world point under cursor stays fixed across zoom — verified dx=dy=0)
- [x] Hover highlight tracks the correct cell at any pan/zoom (probed at zoom 0.72 and
      1.15; corrected the pick surface from ground-plane to tile-top, IsoGrid self-check)

**Verification:** manual in browser; screen-to-grid math has an assert self-check
(round-trips a few known points).

**Dependencies:** Task 2
**Files likely touched:** `index.html`, `src/config.js`, `src/assets/assetLoader.js`,
`src/core/Camera.js`, `src/core/Renderer.js`, `src/core/InputManager.js` (thin),
`src/grid/IsoGrid.js`
**Estimated scope:** M

## Task 4: Placement, erase, layers, depth sort ✅ DONE

**Description:** TileMap with terrain + object layers, PlacementSystem with footprint
occupancy checks, placement preview (valid/invalid sprites), left-click place,
right-click erase. Terrain paint replaces terrain under existing props; erase removes
objects only; multi-cell buildings refuse to overlap anything.

**Acceptance criteria:**
- [x] Sprites depth-sort correctly (walk a lantern "behind" a temple visually)
      (topological painter's order via a strict "behind" predicate — beats naive
      far-corner sort on the +col-side case; verified in-browser occlusion + node test)
- [x] 3×3 temple can't be placed over any occupied cell; preview turns invalid
      (red 3×3 footprint + dimmed ghost; green valid ghost on free cells)
- [x] Painting path under a placed lantern keeps the lantern (independent layers)

**Notes:** objects lift onto the tile-top surface (objectLift = 4·zStepPx, the geometry
from Task 3); left-drag pans without placing (click/drag threshold); right-click erases
objects only. TileMap has a node self-check for occupancy + depth order.

**Verification:** manual; TileMap occupancy logic gets one `node` assert self-check.

**Dependencies:** Task 3
**Files likely touched:** `src/grid/TileMap.js`, `src/building/PlacementSystem.js`,
`src/building/PlacedObject.js`, `src/core/Game.js`
**Estimated scope:** M

## Task 5: Water auto-connection ✅ DONE

**Description:** Water and canal-edge tiles select edge variants from the 4-neighbor
water bitmask at render time so adjacent water reads as one body with clean banks.

**Acceptance criteria:**
- [x] A painted 2×3 water pool shows edges only on its outer border (verified
      in-browser: interior seams invisible, corner/edge masks correct)
- [x] Single water tile shows all four edges (mask 0 = isolated basin)

**Verification:** manual paint test; bitmask→variant function assert self-check.

**Notes:** 16 generated variants `tile-water-0..15` (category `terrain-variant`,
never in the palette) from one parameterized model; the pack grows 60 → 76 PNGs.
`TileMap.waterMaskAt` computes the mask (canal-edge counts as water so pools feed
canals; out-of-bounds keeps a bank at the platform border); the renderer swaps
`tile-water` for its variant at draw time. Known ceiling: 4-neighbor masks don't
cover inner corners of L-pools (1-voxel notch) — 8-neighbor variants if it ever bothers.

**Dependencies:** Task 4
**Files likely touched:** `src/grid/TileMap.js`, `src/core/Renderer.js`
**Estimated scope:** S

### Checkpoint: Core building works
- [ ] Place/erase/pan/zoom/water all correct in browser from `file://`, zero console errors

### Phase 3: UI & Persistence

## Task 6: Toolbar, palette, HUD from generated UI assets ✅ DONE

**Description:** DOM-based UI skinned exclusively with generated PNGs: left toolbar
(Place/Erase/Pan/Grid/Save/Reset with generated icons), bottom palette with 5 category
tabs whose entries use the asset PNGs as icons, clear selected state, title header
"Japanese Temple Voxels", instruction panel (place / erase / pan / zoom).

**Acceptance criteria:**
- [x] All visible chrome comes from `/assets/` PNGs — zero emoji, zero icon fonts
      (panels/buttons/tabs via border-image; icons + thumbnails via <img>)
- [x] Selecting a palette item + tool mode is visually unambiguous (orange active
      state on the selected item and current tool; verified click-through)
- [x] Layout matches reference mood: cream background, floating rounded panels

**Notes:** #ui root is pointer-events:none so gaps click through to the canvas while
panels capture their own clicks (no accidental placement behind the UI). Pan tool =
no-op primary action. Save/Reset buttons are wired to injected handlers; Reset clears
now, full Save/load + confirm + keyboard shortcuts land in Task 7.

**Verification:** manual visual pass against the reference screenshot.

**Dependencies:** Task 4 (works in parallel with Task 5)
**Files likely touched:** `src/ui/UIManager.js`, `src/ui/Toolbar.js`,
`src/ui/AssetPalette.js`, `src/ui/HUD.js`, `styles.css`
**Estimated scope:** M

## Task 7: Shortcuts, save/load, reset, grid toggle ✅ DONE

**Description:** Keyboard map (1–5 categories, E erase, G grid, S save, R reset),
SaveSystem serializing `{version, terrain, objects}` to localStorage with auto-load on
start, reset with confirm, grid visibility toggle wired to toolbar + key.

**Acceptance criteria:**
- [x] Save → reload page → identical world (objects, terrain, and rebuilt occupancy
      verified after a real page reload)
- [x] Reset clears to all-grass and wipes the save only after confirm (decline = no
      change; accept = clear + localStorage wipe)
- [x] Every shortcut in the spec works and matches its toolbar button state
      (1–5 tabs, E/G/S/R; Ctrl/Cmd+S left to the browser)

**Verification:** browser reload round-trip; SaveSystem node self-check (serialize↔
deserialize, occupancy rebuild, malformed-input tolerance).

**Notes:** keyboard routes through the UIManager action layer so toolbar + palette
stay in sync. SaveSystem validates on load (versioned; skips malformed terrain/objects)
since localStorage is user-controlled. Save flashes the Save button briefly.

**Dependencies:** Task 6
**Files likely touched:** `src/storage/SaveSystem.js`, `src/core/Game.js`,
`src/core/InputManager.js`
**Estimated scope:** S

### Phase 4: Polish

## Task 8: Polish pass + end-to-end QA

**Description:** Subtle drop shadows under objects (baked in sprites — verify they read
well), soft background grid/fog, cursor feedback per tool, then run the full spec
checklist top to bottom as manual QA and fix what falls out.

**Acceptance criteria:**
- [ ] Every interaction and UI requirement in the spec checked off in one QA sweep
- [ ] Feels like the reference: calm, pastel, polished prototype
- [ ] No console errors; smooth at full zoom-out with a fully decorated 12×12 map

**Verification:** scripted manual QA checklist derived from the spec's requirement lists.

**Dependencies:** Tasks 5, 7
**Files likely touched:** `styles.css`, `src/core/Renderer.js`, small fixes anywhere
**Estimated scope:** S

### Checkpoint: Complete
- [ ] Fresh clone test: run generator once, double-click `index.html`, build a village

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Procedural sprites look crude, not "premium" | High | Shared painter + palette; contact-sheet QA gate after Task 2 before any game code; iterate models there, cheaply |
| `file://` restrictions break something late | Med | Decided up front: classic scripts, no fetch for JSON (manifest is a JS file), test on `file://` from Task 3 onward |
| Depth-sort artifacts on multi-cell buildings | Med | Sort by anchor `(x+y)` + footprint max; verified explicitly in Task 4 |
| Asset count (~58 models) balloons Task 2 | Med | Models are data, not code — one box-list pattern; contact sheet makes partial progress reviewable |

## Open Questions

- None blocking. Footprint sizes for buildings are my read of the reference sheet
  (temple 3×3, main house 3×2, others 2×2) — adjustable in one manifest line each.
