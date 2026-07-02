'use strict';
// One placed non-terrain object. (col,row) is the back/anchor corner (smallest
// col+row); the footprint extends toward +col/+row (front). Global JTV.PlacedObject.

(function () {
  class PlacedObject {
    constructor(id, col, row, w, h) {
      this.id = id;
      this.col = col;
      this.row = row;
      this.w = w;
      this.h = h;
    }

    // footprint bounds (inclusive)
    get c0() { return this.col; }
    get r0() { return this.row; }
    get c1() { return this.col + this.w - 1; }
    get r1() { return this.row + this.h - 1; }

    cells() {
      const out = [];
      for (let r = this.row; r < this.row + this.h; r++) {
        for (let c = this.col; c < this.col + this.w; c++) out.push({ col: c, row: r });
      }
      return out;
    }
  }

  const api = { PlacedObject };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.JTV = window.JTV || {};
    window.JTV.PlacedObject = PlacedObject;
  }
})();
