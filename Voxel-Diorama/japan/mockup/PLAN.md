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

## Task 1: PNG encoder + voxel sprite painter + generator harness

**Description:** Build the pipeline: pure-JS PNG encoder (zlib-based), iso voxel painter
(voxel model → shaded 2D sprite with transparency + baked drop shadow), and the generator
entry that writes PNGs to `/assets/`. Prove it end-to-end with 3 assets: grass tile,
stone lantern, sakura tree.

**Acceptance criteria:**
- [ ] `node src/assets/generateAssets.js` writes valid transparent PNGs into `/assets/`
- [ ] The 3 proof sprites read as pastel Japanese-voxel style in an image viewer
- [ ] Encoder has an assert-based self-check (encode → decode header/CRC round-trip)

**Verification:** run the generator; open the PNGs; `node src/assets/pngEncoder.js`
self-check exits 0.

**Dependencies:** None
**Files likely touched:** `src/assets/pngEncoder.js`, `src/assets/voxelPainter.js`,
`src/assets/generateAssets.js`
**Estimated scope:** M

## Task 2: Full asset pack — all models + manifest + contact sheet

**Description:** Define all ~58 voxel models and the shared manifest (id, file, category,
footprint, palette icon flag). Generator also emits `assets/contact-sheet.html` that
displays every PNG on a cream background for visual QA in one glance.

**Acceptance criteria:**
- [ ] Every manifest entry has a generated PNG; generator fails loudly on any mismatch
- [ ] Contact sheet shows a coherent set: consistent iso angle, palette, shadows
- [ ] UI assets (buttons, panel, tab, 6 toolbar icons, highlights) included — no emoji,
      no external icons

**Verification:** run generator; count files vs manifest; eyeball contact sheet.

**Dependencies:** Task 1
**Files likely touched:** `src/assets/assetManifest.js`, `src/assets/assetModels.js`,
`src/assets/generateAssets.js`
**Estimated scope:** L (many small models, one mechanical pattern — split into two
sittings if fatigue shows: world assets, then UI assets)

### Checkpoint: Asset pack complete
- [ ] Generator runs clean; contact sheet reviewed; style matches the two references

### Phase 2: Core Game

## Task 3: Canvas shell — loader, camera, grid render, hover

**Description:** `index.html` + config + asset loader (reads the same manifest) + render
loop. Draw the floating 12×12 grass platform on a cream backdrop with soft editor fog,
grid overlay, hovered-cell highlight (using the generated highlight sprite), mouse-drag
pan and wheel zoom.

**Acceptance criteria:**
- [ ] Double-clicking `index.html` shows the platform; no console errors on `file://`
- [ ] Pan (drag) and zoom (wheel, cursor-anchored) are smooth
- [ ] Hover highlight tracks the correct cell at any pan/zoom

**Verification:** manual in browser; screen-to-grid math has an assert self-check
(round-trips a few known points).

**Dependencies:** Task 2
**Files likely touched:** `index.html`, `src/config.js`, `src/assets/assetLoader.js`,
`src/core/Camera.js`, `src/core/Renderer.js`, `src/core/InputManager.js` (thin),
`src/grid/IsoGrid.js`
**Estimated scope:** M

## Task 4: Placement, erase, layers, depth sort

**Description:** TileMap with terrain + object layers, PlacementSystem with footprint
occupancy checks, placement preview (valid/invalid sprites), left-click place,
right-click erase. Terrain paint replaces terrain under existing props; erase removes
objects only; multi-cell buildings refuse to overlap anything.

**Acceptance criteria:**
- [ ] Sprites depth-sort correctly (walk a lantern "behind" a temple visually)
- [ ] 3×3 temple can't be placed over any occupied cell; preview turns invalid
- [ ] Painting path under a placed lantern keeps the lantern

**Verification:** manual; TileMap occupancy logic gets one `node` assert self-check.

**Dependencies:** Task 3
**Files likely touched:** `src/grid/TileMap.js`, `src/building/PlacementSystem.js`,
`src/building/PlacedObject.js`, `src/core/Game.js`
**Estimated scope:** M

## Task 5: Water auto-connection

**Description:** Water and canal-edge tiles select edge variants from the 4-neighbor
water bitmask at render time so adjacent water reads as one body with clean banks.

**Acceptance criteria:**
- [ ] A painted 2×3 water pool shows edges only on its outer border
- [ ] Single water tile shows all four edges

**Verification:** manual paint test; bitmask→variant function assert self-check.

**Dependencies:** Task 4
**Files likely touched:** `src/grid/TileMap.js`, `src/core/Renderer.js`
**Estimated scope:** S

### Checkpoint: Core building works
- [ ] Place/erase/pan/zoom/water all correct in browser from `file://`, zero console errors

### Phase 3: UI & Persistence

## Task 6: Toolbar, palette, HUD from generated UI assets

**Description:** DOM-based UI skinned exclusively with generated PNGs: left toolbar
(Place/Erase/Pan/Grid/Save/Reset with generated icons), bottom palette with 5 category
tabs whose entries use the asset PNGs as icons, clear selected state, title header
"Japanese Temple Voxels", instruction panel (place / erase / pan / zoom).

**Acceptance criteria:**
- [ ] All visible chrome comes from `/assets/` PNGs — zero emoji, zero icon fonts
- [ ] Selecting a palette item + tool mode is visually unambiguous
- [ ] Layout matches reference mood: cream background, floating rounded panels

**Verification:** manual visual pass against the reference screenshot.

**Dependencies:** Task 4 (works in parallel with Task 5)
**Files likely touched:** `src/ui/UIManager.js`, `src/ui/Toolbar.js`,
`src/ui/AssetPalette.js`, `src/ui/HUD.js`, `styles.css`
**Estimated scope:** M

## Task 7: Shortcuts, save/load, reset, grid toggle

**Description:** Keyboard map (1–5 categories, E erase, G grid, S save, R reset),
SaveSystem serializing `{version, terrain, objects}` to localStorage with auto-load on
start, reset with confirm, grid visibility toggle wired to toolbar + key.

**Acceptance criteria:**
- [ ] Save → reload page → identical world
- [ ] Reset clears to all-grass and wipes the save only after confirm
- [ ] Every shortcut in the spec works and matches its toolbar button state

**Verification:** manual reload test; serialize→deserialize round-trip assert self-check.

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
