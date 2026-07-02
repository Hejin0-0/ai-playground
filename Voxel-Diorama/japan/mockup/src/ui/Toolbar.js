'use strict';
// Left toolbar: Place / Erase / Pan / Grid / Save / Reset, each an icon PNG +
// label. Buttons call the injected handlers; refreshState() lights the active
// tool and grid state. JTV.Toolbar.

(function () {
  const BUTTONS = [
    { key: 'place', label: 'Place', icon: 'ui-icon-place', tool: 'place' },
    { key: 'erase', label: 'Erase', icon: 'ui-icon-erase', tool: 'erase' },
    { key: 'pan', label: 'Pan', icon: 'ui-icon-pan', tool: 'pan' },
    { key: 'grid', label: 'Grid', icon: 'ui-icon-grid' },
    { key: 'save', label: 'Save', icon: 'ui-icon-save' },
    { key: 'reset', label: 'Reset', icon: 'ui-icon-reset' },
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
        const img = document.createElement('img');
        img.src = config.assetPath + def.icon + '.png';
        img.alt = def.label;
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

    // reflect current tool + grid visibility on the buttons
    refreshState(tool, gridOn) {
      for (const def of BUTTONS) {
        const active = def.tool ? def.tool === tool : (def.key === 'grid' && gridOn);
        this.buttons[def.key].classList.toggle('active', !!active);
      }
    }
  }

  window.JTV = window.JTV || {};
  window.JTV.Toolbar = Toolbar;
})();
