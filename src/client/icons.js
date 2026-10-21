// Ikony / piktogramy interfejsu (zamiast napisow - latwiejsze tlumaczenie na inne jezyki; opis zostaje w podpowiedzi
// title). Wlasne rysunki 24 x 24, linie w kolorze tekstu (currentColor). W HTML: <svg class="ic"><use href="#i-nazwa"/></svg>,
// w JS: icon('nazwa'). Arkusz symboli wstawia installIcons() przy starcie strony.

const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const ICONS = {
  // tryb pracy wizualizacji
  plc: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  sim: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><path d="M10 7.5v5l4-2.5z" fill="currentColor"/>',
  // widok 3D
  iso: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  top: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M12 8v8M8 12h8"/><path d="M12 1.5v2M12 20.5v2" opacity=".5"/>',
  front: '<rect x="4" y="7" width="16" height="12" rx="1"/><path d="M4 11h16"/><path d="M8 3l4 3 4-3"/>',
  side: '<path d="M7 19V9l5-4h6v14z"/><path d="M3 9l3 3-3 3"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="9" y="9" width="6" height="6"/>',
  zoomIn: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6"/>',
  zoomOut: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M7.5 10.5h6"/>',
  eraser: '<path d="M16 3l5 5-10 10H6l-3-3z"/><path d="M10 9l5 5M11 18h10"/>',
  // warstwy widoku
  blade: '<path d="M22.0 12.0 L19.2 14.3 L21.0 16.3 L17.5 17.3 L18.2 19.8 L14.7 19.1 L14.2 21.7 L11.3 19.6 L9.8 21.7 L8.1 18.5 L5.8 19.8 L5.7 16.2 L3.0 16.3 L4.5 13.0 L2.0 12.0 L4.8 9.7 L3.0 7.7 L6.5 6.7 L5.8 4.2 L9.3 4.9 L9.8 2.3 L12.7 4.4 L14.2 2.3 L15.9 5.5 L18.2 4.2 L18.3 7.8 L21.0 7.7 L19.5 11.0Z"/><circle cx="12" cy="12" r="2.2"/>',
  frame: '<path d="M3 20V8h18v12"/><path d="M3 8l2-4h14l2 4"/><rect x="10" y="8" width="4" height="7"/>',
  plan: '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h5a3 3 0 000-6H9a3 3 0 010-6h8" stroke-dasharray="3 2.5"/>',
  marks: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  ruler: '<path d="M3 16L16 3l5 5L8 21z"/><path d="M7 12l2 2M10 9l2 2M13 6l2 2"/>',
  laser: '<path d="M3 8h7v8H3z"/><path d="M10 12h11" stroke-dasharray="2.5 2"/><path d="M17 8l2-2M17 16l2 2"/>',
  speed: '<path d="M4 18a9 9 0 1116 0"/><path d="M12 15l4-6"/><circle cx="12" cy="15" r="1.4" fill="currentColor"/>',
  // uzytkownik
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.5-6.5 8-6.5s7 2 8 6.5"/>',
  login: '<path d="M14 4h5a1 1 0 011 1v14a1 1 0 01-1 1h-5"/><path d="M3 12h11M10 8l4 4-4 4"/>',
  logout: '<path d="M10 4H5a1 1 0 00-1 1v14a1 1 0 001 1h5"/><path d="M9 12h12M17 8l4 4-4 4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M18 5l2 2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  // ekrany (lewe menu)
  stone: '<path d="M3 15l9 5 9-5-9-5z"/><path d="M3 15v-3l9-5 9 5v3"/><path d="M12 10V7"/>',
  cut: '<circle cx="9" cy="9" r="6"/><circle cx="9" cy="9" r="1.5"/><path d="M3 20h18" stroke-dasharray="3 2"/><path d="M15 13l3 7"/>',
  auto: '<path d="M4 6h10M4 12h10M4 18h7"/><path d="M15 15v6l5-3z" fill="currentColor"/>',
  gcode: '<path d="M8 6l-5 6 5 6M16 6l5 6-5 6M14 4l-4 16"/>',
  pos: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  par: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 013 0V11M11 10V4.5a1.5 1.5 0 013 0V11M14 10.5V6a1.5 1.5 0 013 0v7c0 4.5-2.5 8-7 8-3 0-4.5-1.5-6-4l-2-3.5a1.5 1.5 0 012.5-1.6L8 15"/>',
  // akcje
  play: '<path d="M7 4v16l13-8z" fill="currentColor"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>',
  stop: '<path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z" fill="currentColor" stroke="none"/><rect x="8" y="8" width="8" height="8" fill="#fff" stroke="none" rx="1"/>',
  save: '<path d="M5 3h11l3 3v13a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/><path d="M7 3v5h8V3M7 21v-7h10v7"/>',
  here: '<circle cx="12" cy="10" r="3"/><path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  fill: '<path d="M4 6h10M4 12h10M4 18h10"/><path d="M18 8v8M15 13l3 3 3-3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  demo: '<path d="M5 3l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" transform="translate(3 2)"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v4h16v-4"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  reset: '<path d="M4 12a8 8 0 102.3-5.6"/><path d="M4 4v5h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  // ruchy reczne
  arrowUp: '<path d="M12 20V5M5 12l7-7 7 7"/>',
  arrowDown: '<path d="M12 4v15M5 12l7 7 7-7"/>',
  arrowLeft: '<path d="M20 12H5M12 5l-7 7 7 7"/>',
  arrowRight: '<path d="M4 12h15M12 5l7 7-7 7"/>',
  arrowUL: '<path d="M18 18L6 6M6 15V6h9"/>',
  arrowUR: '<path d="M6 18L18 6M9 6h9v9"/>',
  arrowDL: '<path d="M18 6L6 18M6 9v9h9"/>',
  arrowDR: '<path d="M6 6l12 12M18 9v9H9"/>',
  rotate: '<path d="M20 12a8 8 0 11-2.3-5.6"/><path d="M20 4v5h-5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  tilt: '<path d="M12 21V4" stroke-dasharray="2 2.5"/><path d="M12 21L19 6"/><path d="M12 9a6 6 0 013.4 1.2"/><path d="M5 21h14"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>',
  continuous: '<path d="M3 12h16M15 8l4 4-4 4"/><path d="M3 8v8" opacity=".4"/>',
  step: '<path d="M3 7v10M21 7v10"/><path d="M6 12h12M14 9l3 3-3 3"/>',
  above: '<rect x="3" y="15" width="18" height="6" rx="1"/><path d="M12 12V3M8 7l4-4 4 4"/>',
  pin: '<path d="M12 21s-6.5-5.8-6.5-10.5a6.5 6.5 0 0113 0C18.5 15.2 12 21 12 21z"/>',
  pinList: '<path d="M7 17s-3.5-3.1-3.5-5.6a3.5 3.5 0 017 0C10.5 13.9 7 17 7 17z"/><path d="M13 7h8M13 12h8M13 17h5"/>',
  alongLaser: '<path d="M2 15h20" stroke-dasharray="2.5 2"/><path d="M4 9h13M14 6l3 3-3 3"/>',
  backLaser: '<path d="M2 15h20" stroke-dasharray="2.5 2"/><path d="M20 9H7M10 6L7 9l3 3"/>',
  perpPlus: '<path d="M3 19h18" stroke-dasharray="2.5 2"/><path d="M12 16V4M8 8l4-4 4 4"/>',
  perpMinus: '<path d="M3 5h18" stroke-dasharray="2.5 2"/><path d="M12 8v12M8 16l4 4 4-4"/>',
  tiltDown: '<path d="M18 4L8 18"/><path d="M8 11v7h7"/><path d="M4 21h16" opacity=".5"/>',
  tiltUp: '<path d="M8 18L18 4"/><path d="M11 4h7v7"/><path d="M4 21h16" opacity=".5"/>',
  fwd: '<path d="M19 12a7 7 0 11-2-4.9"/><path d="M19 4v4h-4"/>',
  rev: '<path d="M5 12a7 7 0 102-4.9"/><path d="M5 4v4h4"/>',
  wave: '<path d="M2 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0 2 4 2 0"/>',
  // narzedzia (tryby po bazowaniu)
  saw: '<path d="M22.0 12.0 L19.2 14.3 L21.0 16.3 L17.5 17.3 L18.2 19.8 L14.7 19.1 L14.2 21.7 L11.3 19.6 L9.8 21.7 L8.1 18.5 L5.8 19.8 L5.7 16.2 L3.0 16.3 L4.5 13.0 L2.0 12.0 L4.8 9.7 L3.0 7.7 L6.5 6.7 L5.8 4.2 L9.3 4.9 L9.8 2.3 L12.7 4.4 L14.2 2.3 L15.9 5.5 L18.2 4.2 L18.3 7.8 L21.0 7.7 L19.5 11.0Z"/><circle cx="12" cy="12" r="2.2"/>',
  mill: '<path d="M9 2h6v6H9z"/><path d="M10 8h4v13l-2 1-2-1z"/><path d="M10 11l4 2M10 15l4 2"/>',
  drill: '<path d="M8 2h8v5H8z"/><path d="M10 7h4v9l-2 5-2-5z"/><path d="M10 10l4 2M10 13l4 2"/>',
  polish: '<path d="M10 2h4v8h-4z"/><ellipse cx="12" cy="16" rx="9" ry="3"/><path d="M3 16v2c0 1.7 4 3 9 3s9-1.3 9-3v-2"/>',
};

export function installIcons() {
  if (document.getElementById('iconSprite')) return;
  const symbols = Object.entries(ICONS).map(([k, d]) => `<symbol id="i-${k}" viewBox="0 0 24 24" ${S}>${d}</symbol>`).join('');
  document.body.insertAdjacentHTML('afterbegin', `<svg id="iconSprite" style="display:none" aria-hidden="true">${symbols}</svg>`);
}

export const icon = (name, cls = '') => `<svg class="ic${cls ? ` ${cls}` : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
export const ICON_NAMES = Object.keys(ICONS);
