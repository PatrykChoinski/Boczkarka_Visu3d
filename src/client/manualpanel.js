// Ruchy reczne (#143) jak ekrany HMI: "MPG" (121, STEROWANIE RECZNE) i "MANUAL INTERPOLATION" (125, RUCHY
// INTERPOLOWANE). Elementy w ukladzie ekranu HMI 1652 x 773 (x, y, w, h jak w projekcie DIAScreen), skalowane do okna.
// Napisy HMI zastapione piktogramami (ic - ikona z icons.js, text - tylko litery osi / jednostki), opis w title.
// t: panel - pole, title - naglowek pola, btn - przycisk, dark - ciemny, stop - STOP, link - przejscie do ekranu,
// laser - laser, val - odczyt, inp - pole liczbowe; act - akcja (main.js), hold - dziala tylko trzymany,
// toggle - wlacz / wylacz jak przelacznik w HMI.

import { icon } from './icons.js';

export const HMI_W = 1652;
export const HMI_H = 773;

const row = (y, w, h, items) => items.map(([x, text, act]) => ({ t: 'btn', x, y, w, h, text, act }));
const A_ROW = [[-180, '-180°'], [-90, '-90°'], [0, '0°'], [90, '+90°'], [180, '+180°']];
const B_ROW = [[0, '0°'], [30, '30°'], [45, '45°'], [60, '60°'], [90, '90°']];
const ROT = 'Oś obrotu (C w HMI, A w PLC)';
const TILT = 'Oś wychyłu B';

export const MANUAL_SCREENS = {
  mpg: [
    { t: 'panel', x: 10, y: 60, w: 530, h: 430 },
    // XY 3 x 3: skosy, Y+ / Y- (gora / dol), X- / X+ (lewo / prawo)
    { t: 'btn', x: 24, y: 74, w: 161, h: 128, ic: 'arrowUL', act: 'diag:lu', hold: true, title: 'XY w lewo do góry (bManualXYLeftUp, 135°)' },
    { t: 'btn', x: 196, y: 74, w: 161, h: 128, ic: 'arrowUp', text: 'Y', act: 'jog:y:1', hold: true, title: 'Y+ (bManualYJogUp)' },
    { t: 'btn', x: 369, y: 74, w: 161, h: 128, ic: 'arrowUR', act: 'diag:ru', hold: true, title: 'XY w prawo do góry (bManualXYRightUp, 45°)' },
    { t: 'btn', x: 24, y: 212, w: 161, h: 128, ic: 'arrowLeft', text: 'X', act: 'jog:x:-1', hold: true, title: 'X- (bManualXJogLeft)' },
    { t: 'btn', x: 369, y: 212, w: 161, h: 128, ic: 'arrowRight', text: 'X', act: 'jog:x:1', hold: true, title: 'X+ (bManualXJogRight)' },
    { t: 'btn', x: 24, y: 350, w: 161, h: 128, ic: 'arrowDL', act: 'diag:ld', hold: true, title: 'XY w lewo w dół (bManualXYLeftDown, 225°)' },
    { t: 'btn', x: 196, y: 350, w: 161, h: 128, ic: 'arrowDown', text: 'Y', act: 'jog:y:-1', hold: true, title: 'Y- (bManualYJogDown)' },
    { t: 'btn', x: 369, y: 350, w: 161, h: 128, ic: 'arrowDR', act: 'diag:rd', hold: true, title: 'XY w prawo w dół (bManualXYRightDown, 315°)' },
    { t: 'mid', x: 196, y: 212, w: 161, h: 128, ic: 'hand' },
    // Z- w gore (bManualZJogUp), Z+ w dol (bManualZJogDown)
    { t: 'panel', x: 552, y: 60, w: 178, h: 290 },
    { t: 'btn', x: 561, y: 74, w: 159, h: 128, ic: 'arrowUp', text: 'Z', act: 'jog:z:-1', hold: true, title: 'Z- w górę (bManualZJogUp)' },
    { t: 'btn', x: 561, y: 212, w: 159, h: 128, ic: 'arrowDown', text: 'Z', act: 'jog:z:1', hold: true, title: 'Z+ w dół (bManualZJogDown)' },
    { t: 'laser', x: 741, y: 74, w: 168, h: 128, ic: 'laser', act: 'laser', title: 'Laser (bLaser)' },
    { t: 'link', x: 741, y: 212, w: 168, h: 128, ic: 'pinList', act: 'tab:pos', title: 'Ustawienia pozycji – zapis punktów A, B, C (Pozycja)' },
    { t: 'link', x: 561, y: 360, w: 348, h: 118, ic: 'speed', act: 'tab:par', level: 2, title: 'Serwis – prędkości jog (Parametry)' },
    // pozycje osi
    { t: 'panel', x: 921, y: 60, w: 380, h: 300 },
    ...['x', 'y', 'z'].map((ax, i) => ({ t: 'val', x: 935, y: 74 + i * 94, w: 352, h: 84, label: ax.toUpperCase(), id: `manPos_${ax}`, title: `Pozycja osi ${ax.toUpperCase()} [mm]` })),
    // tryb pracy: ciagly / skok (bManualContinousMode), skok fManualJumpDist
    { t: 'panel', x: 1313, y: 60, w: 330, h: 300 },
    { t: 'dark', x: 1327, y: 74, w: 302, h: 120, ic: 'continuous', act: 'continuous', id: 'manContinuous', title: 'Tryb ciągły / skok (bManualContinousMode)' },
    { t: 'title', x: 1327, y: 206, w: 302, h: 44, ic: 'step', text: 'mm', title: 'Skok [mm] (fManualJumpDist)' },
    { t: 'inp', x: 1327, y: 252, w: 302, h: 94, id: 'manJump', min: 0, max: 500, value: 10, title: 'Skok [mm] (fManualJumpDist)' },
    // przejazd na punkty A, B, C (zapisane w Pozycja), nad material, STOP
    { t: 'dark', x: 921, y: 374, w: 108, h: 104, ic: 'pin', text: 'A', act: 'point:A', title: 'Jedź na punkt A (bManualMovePointA)' },
    { t: 'dark', x: 1039, y: 374, w: 108, h: 104, ic: 'pin', text: 'B', act: 'point:B', title: 'Jedź na punkt B (bManualMovePointB)' },
    { t: 'dark', x: 1157, y: 374, w: 108, h: 104, ic: 'pin', text: 'C', act: 'point:C', title: 'Jedź na punkt C (bManualMovePointC)' },
    { t: 'dark', x: 1275, y: 374, w: 118, h: 104, ic: 'above', act: 'point:D', title: 'Nad materiał – Z nad materiał w aktualnym miejscu (bManualMovePointD)' },
    { t: 'stop', x: 1403, y: 374, w: 240, h: 104, ic: 'stop', act: 'stop', title: 'Stop (bManualMovePointStop)' },
    // obrot (C w HMI = os A w PLC) i wychyl B
    { t: 'panel', x: 10, y: 496, w: 800, h: 150 },
    { t: 'title', x: 24, y: 502, w: 200, h: 34, ic: 'rotate', text: 'C', title: ROT },
    ...row(538, 142, 96, A_ROW.map(([v, s], i) => [[24, 180, 336, 492, 648][i], s, `a:${v}`])),
    { t: 'panel', x: 834, y: 496, w: 809, h: 150 },
    { t: 'title', x: 848, y: 502, w: 200, h: 34, ic: 'tilt', text: 'B', title: TILT },
    ...row(538, 142, 96, B_ROW.map(([v, s], i) => [[848, 1006, 1164, 1322, 1480][i], s, `b:${v}`])),
    // predkosci jog X / Y / Z [m/min]
    { t: 'panel', x: 10, y: 656, w: 1633, h: 104 },
    { t: 'title', x: 24, y: 680, w: 210, h: 56, ic: 'speed', text: 'm/min', left: true, title: 'Prędkości jog [m/min] (fJogXVelocity …)' },
    ...[['X', 330], ['Y', 780], ['Z', 1230]].map(([ax, x]) => ({ t: 'inp', x, y: 680, w: 380, h: 56, label: ax, jogvel: `jog${ax}Vel`, min: 0.001, title: `Prędkość jog ${ax} [m/min]` })),
  ],
  interp: [
    { t: 'panel', x: 10, y: 60, w: 838, h: 345 },
    { t: 'title', x: 24, y: 70, w: 200, h: 40, ic: 'rotate', text: 'C', left: true, title: ROT },
    { t: 'val', x: 24, y: 116, w: 300, h: 70, id: 'manPos_a', blue: true, ic: 'rotate', title: 'Pozycja obrotu [°] (fAActualPositionFixed)' },
    { t: 'inp', x: 340, y: 116, w: 300, h: 70, id: 'aSet', min: -180, max: 180, value: 45, ic: 'target', title: 'Zadany kąt obrotu [°] (fManualASetPosition)' },
    { t: 'btn', x: 656, y: 116, w: 178, h: 70, ic: 'play', act: 'goto:a', title: 'Ustaw głowicę na zadany kąt (bManualAMoveToPosAbs)' },
    ...row(276, 150, 100, A_ROW.map(([v, s], i) => [[24, 187, 350, 513, 676][i], s, `a:${v}`])),
    { t: 'panel', x: 860, y: 60, w: 783, h: 345 },
    { t: 'btn', x: 874, y: 74, w: 360, h: 100, ic: 'alongLaser', act: 'interp:along', toggle: true, title: 'Ruch w kierunku lasera (bManualXYSetAngle) – do STOP albo ponownego naciśnięcia' },
    { t: 'btn', x: 874, y: 184, w: 360, h: 100, ic: 'backLaser', act: 'interp:back', toggle: true, title: 'Ruch w kierunku przeciwnym do lasera (bManualXYSetAngle180)' },
    { t: 'btn', x: 1246, y: 74, w: 383, h: 100, ic: 'perpPlus', act: 'interp:perp', toggle: true, title: 'Ruch prostopadle do kąta + (bManualXYSetAngle90)' },
    { t: 'btn', x: 1246, y: 184, w: 383, h: 100, ic: 'perpMinus', act: 'interp:perpBack', toggle: true, title: 'Ruch prostopadle do kąta - (bManualXYSetAngle270)' },
    { t: 'stop', x: 1389, y: 294, w: 240, h: 98, ic: 'stop', act: 'stop', title: 'Stop (bManualXYAngleStop)' },
    { t: 'panel', x: 10, y: 416, w: 838, h: 345 },
    { t: 'title', x: 24, y: 426, w: 200, h: 40, ic: 'tilt', text: 'B', left: true, title: TILT },
    { t: 'val', x: 24, y: 472, w: 300, h: 70, id: 'manPos_b', blue: true, ic: 'tilt', title: 'Pozycja wychyłu [°] (fBActualPosition)' },
    { t: 'inp', x: 340, y: 472, w: 300, h: 70, id: 'bSet', min: -2.5, max: 90, value: 15, ic: 'target', title: 'Zadany wychył [°] (fManualBSetPosition, 0–90)' },
    { t: 'btn', x: 656, y: 472, w: 178, h: 70, ic: 'play', act: 'goto:b', title: 'Ustaw głowicę na zadany wychył (bManualBMoveToPosAbs)' },
    ...row(632, 150, 100, B_ROW.map(([v, s], i) => [[24, 187, 350, 513, 676][i], s, `b:${v}`])),
    { t: 'panel', x: 860, y: 416, w: 783, h: 345 },
    { t: 'title', x: 874, y: 426, w: 200, h: 40, ic: 'tilt', left: true, title: 'Ruch wzdłuż wychylonej tarczy' },
    { t: 'btn', x: 874, y: 472, w: 170, h: 150, ic: 'tiltDown', act: 'tilt:down', hold: true, title: 'W dół wzdłuż wychylonej tarczy (bManualMoveWithTiltDown)' },
    { t: 'btn', x: 1054, y: 472, w: 170, h: 150, ic: 'tiltUp', act: 'tilt:up', hold: true, title: 'W górę wzdłuż wychylonej tarczy (bManualMoveWithTiltUp)' },
    { t: 'laser', x: 1246, y: 472, w: 170, h: 150, ic: 'laser', act: 'laser', title: 'Laser (bLaser)' },
    { t: 'stop', x: 1389, y: 650, w: 240, h: 98, ic: 'stop', act: 'stop', title: 'Stop (bManualMoveWithTiltStop)' },
  ],
};

// HTML ekranu: pozycje w procentach ukladu HMI (okno dowolnej szerokosci zachowuje proporcje ekranu)
export function manualScreenHtml(items) {
  const pc = (v, n) => `${(v / n * 100).toFixed(3)}%`;
  const pos = (e) => `left:${pc(e.x, HMI_W)};top:${pc(e.y, HMI_H)};width:${pc(e.w, HMI_W)};height:${pc(e.h, HMI_H)}`;
  const body = (e) => `${e.ic ? icon(e.ic) : ''}${e.text ? `<span>${e.text}</span>` : ''}`;
  return items.map((e) => {
    const tip = e.title ? ` title="${e.title}"` : '';
    switch (e.t) {
      case 'panel': return `<div class="hmiPanel" style="${pos(e)}"></div>`;
      case 'mid': return `<div class="hmiMid" style="${pos(e)}">${icon(e.ic)}</div>`;
      case 'title': return `<div class="hmiTitle${e.left ? ' left' : ''}"${tip} style="${pos(e)}">${body(e)}</div>`;
      case 'val': return `<div class="hmiVal${e.blue ? ' blue' : ''}"${tip} style="${pos(e)}">${e.label ? `<b>${e.label}</b>` : ''}${e.ic ? icon(e.ic) : ''}<output id="${e.id}"></output></div>`;
      case 'inp': {
        const attrs = [e.id && `id="${e.id}"`, e.jogvel && `data-jogvel="${e.jogvel}"`, e.min !== undefined && `min="${e.min}"`,
          e.max !== undefined && `max="${e.max}"`, e.value !== undefined && `value="${e.value}"`].filter(Boolean).join(' ');
        return `<label class="hmiInp"${tip} style="${pos(e)}">${e.label ? `<b>${e.label}</b>` : ''}${e.ic ? icon(e.ic) : ''}<input type="number" step="any" ${attrs}></label>`;
      }
      default: {
        const cls = { btn: 'hmiBtn', dark: 'hmiBtn dark', stop: 'hmiBtn stop', link: 'hmiBtn link', laser: 'hmiBtn laser' }[e.t];
        const data = `data-hmi="${e.act}"${e.hold ? ' data-hold' : ''}${e.toggle ? ' data-toggle' : ''}${e.level ? ` data-level="${e.level}"` : ''}`;
        return `<button type="button" class="${cls}"${e.id ? ` id="${e.id}"` : ''} ${data}${tip} style="${pos(e)}">${body(e)}</button>`;
      }
    }
  }).join('');
}
