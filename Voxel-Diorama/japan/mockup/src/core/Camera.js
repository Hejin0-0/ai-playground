'use strict';
// Pan/zoom transform between grid-space pixels and screen pixels.
// screen = world * zoom + pan.  Browser global JTV.Camera.

(function () {
  class Camera {
    constructor(config) {
      this.zoom = config.camera.initialZoom;
      this.minZoom = config.camera.minZoom;
      this.maxZoom = config.camera.maxZoom;
      this.panX = 0;
      this.panY = 0;
    }

    worldToScreen(p) {
      return { x: p.x * this.zoom + this.panX, y: p.y * this.zoom + this.panY };
    }

    screenToWorld(p) {
      return { x: (p.x - this.panX) / this.zoom, y: (p.y - this.panY) / this.zoom };
    }

    panBy(dx, dy) {
      this.panX += dx;
      this.panY += dy;
    }

    // Zoom by a factor while keeping the world point under (sx, sy) fixed.
    zoomAt(sx, sy, factor) {
      const next = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
      if (next === this.zoom) return;
      const world = this.screenToWorld({ x: sx, y: sy });
      this.zoom = next;
      this.panX = sx - world.x * this.zoom;
      this.panY = sy - world.y * this.zoom;
    }

    // Center the view on a grid-space point within a viewport of given size.
    centerOn(worldPoint, viewW, viewH) {
      this.panX = viewW / 2 - worldPoint.x * this.zoom;
      this.panY = viewH / 2 - worldPoint.y * this.zoom;
    }
  }

  window.JTV = window.JTV || {};
  window.JTV.Camera = Camera;
})();
