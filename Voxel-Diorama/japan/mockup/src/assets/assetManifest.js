'use strict';
// Shared by the Node generator and the browser game (classic script tag).
// One entry per generated PNG: /assets/<id>.png
// footprint: [cellsX, cellsY] on the placement grid. 1 cell = 8 voxels.

var ASSET_MANIFEST = [
  // --- terrain tiles (base layer, always footprint 1x1) ---
  { id: 'tile-grass', name: 'Grass', category: 'terrain', footprint: [1, 1] },
  { id: 'tile-path', name: 'Path', category: 'terrain', footprint: [1, 1] },
  { id: 'tile-dirt', name: 'Dirt', category: 'terrain', footprint: [1, 1] },
  { id: 'tile-water', name: 'Water', category: 'terrain', footprint: [1, 1] },
  { id: 'tile-stone', name: 'Stone', category: 'terrain', footprint: [1, 1] },
  { id: 'tile-stairs', name: 'Stairs', category: 'terrain', footprint: [1, 1] },
  { id: 'tile-canal-edge', name: 'Canal Edge', category: 'terrain', footprint: [1, 1] },

  // --- nature ---
  { id: 'nature-bamboo', name: 'Bamboo', category: 'nature', footprint: [1, 1] },
  { id: 'nature-sakura-tree', name: 'Sakura Tree', category: 'nature', footprint: [1, 1] },
  { id: 'nature-small-tree', name: 'Small Tree', category: 'nature', footprint: [1, 1] },
  { id: 'nature-grass-tuft', name: 'Grass Tuft', category: 'nature', footprint: [1, 1] },
  { id: 'nature-flower-bush', name: 'Flower Bush', category: 'nature', footprint: [1, 1] },

  // --- props: borders & structure helpers ---
  { id: 'prop-fence-straight', name: 'Fence', category: 'props', footprint: [1, 1] },
  { id: 'prop-fence-corner', name: 'Fence Corner', category: 'props', footprint: [1, 1] },
  { id: 'prop-fence-gate', name: 'Gate Fence', category: 'props', footprint: [1, 1] },
  { id: 'prop-stone-post', name: 'Stone Post', category: 'props', footprint: [1, 1] },

  // --- props: lighting & shrine ---
  { id: 'prop-stone-lantern', name: 'Stone Lantern', category: 'props', footprint: [1, 1] },
  { id: 'prop-hanging-lantern', name: 'Hanging Lantern', category: 'props', footprint: [1, 1] },
  { id: 'prop-torii-gate', name: 'Torii Gate', category: 'props', footprint: [2, 1] },
  { id: 'prop-shrine-box', name: 'Shrine Box', category: 'props', footprint: [1, 1] },
  { id: 'prop-signpost', name: 'Signpost', category: 'props', footprint: [1, 1] },
  { id: 'prop-banner-flag', name: 'Banner Flag', category: 'props', footprint: [1, 1] },

  // --- props: decorative ---
  { id: 'prop-crate', name: 'Wooden Crate', category: 'props', footprint: [1, 1] },
  { id: 'prop-bench', name: 'Wooden Bench', category: 'props', footprint: [1, 1] },
  { id: 'prop-hay-bale', name: 'Hay Bale', category: 'props', footprint: [1, 1] },
  { id: 'prop-rock-cluster', name: 'Rock Cluster', category: 'props', footprint: [1, 1] },
  { id: 'prop-large-rock', name: 'Large Rock', category: 'props', footprint: [1, 1] },
  { id: 'prop-mossy-rock', name: 'Mossy Rock', category: 'props', footprint: [1, 1] },
  { id: 'prop-flat-stone', name: 'Flat Stone', category: 'props', footprint: [1, 1] },
  { id: 'prop-pebbles', name: 'Pebbles', category: 'props', footprint: [1, 1] },
  { id: 'prop-stone-pile', name: 'Stone Pile', category: 'props', footprint: [1, 1] },
  { id: 'prop-boulder', name: 'Boulder', category: 'props', footprint: [1, 1] },
  { id: 'prop-wood-pile', name: 'Wood Pile', category: 'props', footprint: [1, 1] },
  { id: 'prop-storage-box', name: 'Storage Box', category: 'props', footprint: [1, 1] },
  { id: 'prop-stone-basin', name: 'Stone Basin', category: 'props', footprint: [1, 1] },

  // --- water features & farming ---
  { id: 'prop-bridge', name: 'Small Bridge', category: 'water', footprint: [2, 1] },
  { id: 'prop-well', name: 'Well', category: 'water', footprint: [1, 1] },
  { id: 'prop-rice-paddy', name: 'Rice Paddy', category: 'water', footprint: [1, 1] },
  { id: 'prop-crop-patch', name: 'Crop Patch', category: 'water', footprint: [1, 1] },
  { id: 'prop-vegetable-garden', name: 'Vegetable Garden', category: 'water', footprint: [1, 1] },
  { id: 'prop-water-bucket', name: 'Water Bucket', category: 'water', footprint: [1, 1] },

  // --- buildings ---
  { id: 'building-hut', name: 'Small Hut', category: 'buildings', footprint: [2, 2] },
  { id: 'building-main-house', name: 'Main House', category: 'buildings', footprint: [3, 2] },
  { id: 'building-pagoda', name: 'Pagoda', category: 'buildings', footprint: [2, 2] },
  { id: 'building-watchtower', name: 'Watchtower', category: 'buildings', footprint: [2, 2] },
  { id: 'building-temple', name: 'Main Temple', category: 'buildings', footprint: [3, 3] },

  // --- water connection variants (render-time only, never in the palette) ---
  // pushed programmatically below the literal: tile-water-0 .. tile-water-15

  // --- UI chrome (not placeable, excluded from the palette) ---
  { id: 'ui-button', name: 'Button', category: 'ui', footprint: [1, 1] },
  { id: 'ui-button-hover', name: 'Button Hover', category: 'ui', footprint: [1, 1] },
  { id: 'ui-button-active', name: 'Button Active', category: 'ui', footprint: [1, 1] },
  { id: 'ui-panel', name: 'Panel', category: 'ui', footprint: [1, 1] },
  { id: 'ui-tab', name: 'Tab', category: 'ui', footprint: [1, 1] },
  { id: 'ui-icon-place', name: 'Place Icon', category: 'ui', footprint: [1, 1] },
  { id: 'ui-icon-erase', name: 'Erase Icon', category: 'ui', footprint: [1, 1] },
  { id: 'ui-icon-pan', name: 'Pan Icon', category: 'ui', footprint: [1, 1] },
  { id: 'ui-icon-grid', name: 'Grid Icon', category: 'ui', footprint: [1, 1] },
  { id: 'ui-icon-save', name: 'Save Icon', category: 'ui', footprint: [1, 1] },
  { id: 'ui-icon-reset', name: 'Reset Icon', category: 'ui', footprint: [1, 1] },
  { id: 'ui-highlight-hover', name: 'Hover Highlight', category: 'ui', footprint: [1, 1] },
  { id: 'ui-highlight-valid', name: 'Valid Placement', category: 'ui', footprint: [1, 1] },
  { id: 'ui-highlight-invalid', name: 'Invalid Placement', category: 'ui', footprint: [1, 1] },
];

for (var wm = 0; wm < 16; wm++) {
  ASSET_MANIFEST.push({
    id: 'tile-water-' + wm,
    name: 'Water Variant ' + wm,
    category: 'terrain-variant',
    footprint: [1, 1],
  });
}

if (typeof module !== 'undefined') module.exports = { ASSET_MANIFEST };
