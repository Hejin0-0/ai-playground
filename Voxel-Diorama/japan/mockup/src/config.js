'use strict';
// Global game config. Browser-only (no node self-check needed — pure data).

window.JTV = window.JTV || {};
window.JTV.config = {
  grid: { cols: 12, rows: 12 },

  colors: {
    background: '#f1e9d9',   // warm cream backdrop
    backgroundEdge: '#e7dcc4', // vignette edge
    gridLine: 'rgba(120, 104, 80, 0.28)',
    gridLineSoft: 'rgba(120, 104, 80, 0.10)',
  },

  camera: {
    minZoom: 0.45,
    maxZoom: 2.4,
    zoomStep: 1.1,       // multiplier per wheel notch
    initialZoom: 1,
  },

  ui: {
    showGrid: true,
  },

  assetPath: 'assets/',
};
