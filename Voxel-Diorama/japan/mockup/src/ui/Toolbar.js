'use strict';
// Left toolbar: Place / Erase / Pan / Grid / Save / Reset, each an icon PNG +
// label. Buttons call the injected handlers; refreshState() lights the active
// tool and grid state. JTV.Toolbar.

(function () {
  const BUTTONS = [
    { key: 'place', label: 'Place', icon: 'ui-icon-place', tool: 'place' },
    { key: 'erase', label: 'Erase', icon: 'ui-icon-erase', tool: 'erase', shortcut: 'E' },
    { key: 'pan', label: 'Pan', icon: 'ui-icon-pan', tool: 'pan' },
    { key: 'grid', label: 'Grid', icon: 'ui-icon-grid', shortcut: 'G' },
    { key: 'save', label: 'Save', icon: 'ui-icon-save', shortcut: 'S' },
    { key: 'reset', label: 'Reset', icon: 'ui-icon-reset', shortcut: 'R' },
  ];

  class Toolbar {
    constructor(root, config, handlers) {
      this.config = config;
      this.handlers = handlers;
      this.buttons = {};

      const bar = document.createElement('div');
      bar.id = 'toolbar';
      bar.className = 'panel-surface jtv-panel';

      for (const def of BUTTONS) {
        const btn = document.createElement('button');
        btn.className = 'jtv-btn tool-btn';
        btn.type = 'button';
        btn.title = def.shortcut ? `${def.label} (${def.shortcut})` : def.label;
        btn.setAttribute('aria-label', btn.title);
        // tool + grid buttons are toggles; save/reset are actions
        if (def.tool || def.key === 'grid') btn.setAttribute('aria-pressed', 'false');
        const img = document.createElement('img');
        img.src = config.assetPath + def.icon + '.png';
        img.alt = '';               // decorative; the button is already labelled
        img.setAttribute('aria-hidden', 'true');
        const span = document.createElement('span');
        span.textContent = def.label;
        btn.appendChild(img);
        btn.appendChild(span);
        btn.addEventListener('click', () => handlers[def.key] && handlers[def.key]());
        this.buttons[def.key] = btn;
        bar.appendChild(btn);
      }
      root.appendChild(bar);
    }

    // reflect current tool + grid visibility on the buttons (class + ARIA)
    refreshState(tool, gridOn) {
      for (const def of BUTTONS) {
        if (!def.tool && def.key !== 'grid') continue;
        const active = def.tool ? def.tool === tool : gridOn;
        const btn = this.buttons[def.key];
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
      }
    }
  }

  window.JTV = window.JTV || {};
  window.JTV.Toolbar = Toolbar;
})();
