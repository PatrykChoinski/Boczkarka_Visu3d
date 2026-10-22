// Opisy zmiennych PLC tylko dla Admina (DOM): fragmenty tekstow z nazwami zmiennych (nawiasy, dopiski, <code>, szare
// dopiski naglowkow) dostaja klase plcName - bez klasy admin na <body> sa ukryte (style.css); podpowiedzi (title)
// bez nazw zmiennych i opisow dzialania w PLC. Nowe i zmienione elementy - MutationObserver.

import { hasPlcName, plcNameRanges, stripPlcNames } from '../shared/plcnames.js';

const SKIP = new Set(['SCRIPT', 'STYLE', 'INPUT', 'SELECT', 'OPTION', 'TEXTAREA', 'CODE', 'OUTPUT']);
// czesto odswiezane obszary bez opisow zmiennych (widok 3D, stopka, napisy na widoku)
const IGNORE = '#view, footer, #hud';
let admin = false;

function markText(node) {
  const ranges = plcNameRanges(node.data);
  if (!ranges.length) return;
  const frag = document.createDocumentFragment();
  let pos = 0;
  for (const r of ranges) {
    if (r.start > pos) frag.append(node.data.slice(pos, r.start));
    const span = document.createElement('span');
    span.className = 'plcName';
    span.textContent = node.data.slice(r.start, r.end);
    frag.append(span);
    pos = r.end;
  }
  if (pos < node.data.length) frag.append(node.data.slice(pos));
  node.replaceWith(frag);
}

function markTitle(el) {
  const t = el.getAttribute('title');
  if (!t) return;
  // tytul ustawiony na nowo przez aplikacje (nie przez nas) - pelny opis do data-title-full
  if (t !== el.dataset.titleFull && t !== stripPlcNames(el.dataset.titleFull)) {
    if (!hasPlcName(t) && !/^\s*HMI:/m.test(t)) { delete el.dataset.titleFull; return; }
    el.dataset.titleFull = t;
  }
  const want = admin ? el.dataset.titleFull : stripPlcNames(el.dataset.titleFull);
  if (el.getAttribute('title') !== want) {
    if (want) el.setAttribute('title', want);
    else el.removeAttribute('title');
  }
}

export function markPlcNames(root = document.body) {
  if (!root || root.nodeType !== 1 || root.closest?.(IGNORE)) return;
  for (const el of root.querySelectorAll('code, .muted')) if (hasPlcName(el.textContent)) el.classList.add('plcName');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const p = n.parentElement;
      if (!p || SKIP.has(p.tagName) || p.closest('.plcName, svg') || p.closest(IGNORE)) return NodeFilter.FILTER_REJECT;
      return hasPlcName(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) markText(n);
  for (const el of [root, ...root.querySelectorAll('[title], [data-title-full]')]) if (el.getAttribute?.('title') || el.dataset?.titleFull) markTitle(el);
}

// Admin: opisy zmiennych widoczne, inaczej schowane (klasa na <body>, podpowiedzi przepisane)
export function setPlcNamesAdmin(on) {
  admin = Boolean(on);
  document.body.classList.toggle('admin', admin);
  for (const el of document.querySelectorAll('[data-title-full]')) {
    const want = admin ? el.dataset.titleFull : stripPlcNames(el.dataset.titleFull);
    if (want) el.setAttribute('title', want);
    else el.removeAttribute('title');
  }
}

export function watchPlcNames() {
  markPlcNames(document.body);
  let pending = new Set();
  const flush = () => {
    const roots = pending;
    pending = new Set();
    for (const r of roots) if (r.isConnected) markPlcNames(r);
  };
  new MutationObserver((list) => {
    for (const m of list) {
      const el = m.type === 'characterData' ? m.target.parentElement : m.target;
      if (!el || el.nodeType !== 1 || el.closest(IGNORE)) continue;
      if (m.type === 'attributes') { markTitle(el); continue; }
      if (!pending.size) requestAnimationFrame(flush);
      pending.add(el);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title'] });
}
