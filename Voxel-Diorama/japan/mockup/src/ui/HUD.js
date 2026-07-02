'use strict';
// Static chrome: the title panel and the controls/instruction panel. JTV.HUD.

(function () {
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  class HUD {
    constructor(root) {
      const title = el('div', 'panel-surface jtv-panel');
      title.id = 'titlebar';
      title.appendChild(el('h1', null, 'Japanese Temple Voxels'));
      title.appendChild(el('p', null, 'Build beautiful voxel worlds'));
      root.appendChild(title);

      const help = el('div', 'panel-surface jtv-panel');
      help.id = 'instructions';
      help.appendChild(el('h2', null, 'Controls'));
      const ul = el('ul');
      const rows = [
        ['Place', 'Left click'],
        ['Remove', 'Right click / Erase'],
        ['Pan', 'Drag'],
        ['Zoom', 'Mouse wheel'],
      ];
      for (const [label, key] of rows) {
        ul.appendChild(el('li', null, `<span>${label}</span><b>${key}</b>`));
      }
      help.appendChild(ul);
      root.appendChild(help);
    }
  }

  window.JTV = window.JTV || {};
  window.JTV.HUD = HUD;
})();
