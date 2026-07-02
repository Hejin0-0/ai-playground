'use strict';
// Bottom palette: five category tabs + a scrolling row of asset thumbnails
// (icons are the generated PNGs). Clicking an item selects it. JTV.AssetPalette.

(function () {
  const CATEGORIES = [
    { key: 'terrain', label: 'Terrain' },
    { key: 'nature', label: 'Nature' },
    { key: 'props', label: 'Props' },
    { key: 'water', label: 'Water' },
    { key: 'buildings', label: 'Buildings' },
  ];

  class AssetPalette {
    constructor(root, config, manifest, onSelect) {
      this.config = config;
      this.onSelect = onSelect;
      this.activeCategory = 'terrain';
      this.selectedId = null;
      this.itemButtons = {};

      // group placeable assets by category (skip terrain-variant + ui)
      this.byCategory = {};
      for (const c of CATEGORIES) this.byCategory[c.key] = [];
      for (const e of manifest) {
        if (this.byCategory[e.category]) this.byCategory[e.category].push(e);
      }

      const panel = document.createElement('div');
      panel.id = 'palette';
      panel.className = 'panel-surface jtv-panel';

      this.tabsEl = document.createElement('div');
      this.tabsEl.id = 'tabs';
      this.tabButtons = {};
      for (const c of CATEGORIES) {
        const t = document.createElement('button');
        t.className = 'tab';
        t.type = 'button';
        t.textContent = c.label;
        t.addEventListener('click', () => this.showCategory(c.key));
        this.tabButtons[c.key] = t;
        this.tabsEl.appendChild(t);
      }
      panel.appendChild(this.tabsEl);

      this.itemsEl = document.createElement('div');
      this.itemsEl.id = 'items';
      panel.appendChild(this.itemsEl);

      root.appendChild(panel);
      this.showCategory('terrain');
    }

    showCategory(key) {
      this.activeCategory = key;
      for (const c of CATEGORIES) this.tabButtons[c.key].classList.toggle('active', c.key === key);

      this.itemsEl.innerHTML = '';
      this.itemButtons = {};
      for (const entry of this.byCategory[key]) {
        const btn = document.createElement('button');
        btn.className = 'jtv-btn item';
        btn.type = 'button';
        const thumb = document.createElement('div');
        thumb.className = 'thumb';
        const img = document.createElement('img');
        img.src = this.config.assetPath + entry.id + '.png';
        img.alt = entry.name;
        thumb.appendChild(img);
        const span = document.createElement('span');
        span.textContent = entry.name;
        btn.appendChild(thumb);
        btn.appendChild(span);
        btn.addEventListener('click', () => {
          this.setSelected(entry.id);
          this.onSelect(entry.id);
        });
        this.itemButtons[entry.id] = btn;
        this.itemsEl.appendChild(btn);
      }
      // keep the selected item highlighted when returning to its category
      if (this.itemButtons[this.selectedId]) {
        this.itemButtons[this.selectedId].classList.add('active');
      }
    }

    setSelected(id) {
      this.selectedId = id;
      for (const key in this.itemButtons) {
        this.itemButtons[key].classList.toggle('active', key === id);
      }
    }
  }

  window.JTV = window.JTV || {};
  window.JTV.AssetPalette = AssetPalette;
})();
