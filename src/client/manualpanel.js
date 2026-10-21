// Ruchy reczne (#143) jak ekrany HMI: "MPG" (121, STEROWANIE RECZNE) i "MANUAL INTERPOLATION" (125, RUCHY
// INTERPOLOWANE). Elementy w ukladzie ekranu HMI 1652 x 773 (x, y, w, h jak w projekcie DIAScreen), skalowane do okna.
// t: panel - biale pole, title - napis, label - opis, btn - przycisk (pomaranczowy jak w HMI), dark - ciemnoniebieski,
// stop - czerwony STOP, link - przycisk przejscia, laser - przycisk lasera, val - odczyt, inp - pole liczbowe;
// act - akcja (main.js), hold - dziala tylko trzymany, toggle - wlacz / wylacz jak przelacznik w HMI.

export const HMI_W = 1652;
export const HMI_H = 773;

const row = (y, w, h, items) => items.map(([x, text, act]) => ({ t: 'btn', x, y, w, h, text, act }));
const A_ROW = [[-180, '-180°'], [-90, '-90°'], [0, '0°'], [90, '+90°'], [180, '+180°']];
const B_ROW = [[0, '0°'], [30, '+30°'], [45, '+45°'], [60, '+60°'], [90, '+90°']];

export const MANUAL_SCREENS = {
  mpg: [
    { t: 'title', x: 24, y: 69, w: 505, h: 34, text: 'RUCHY RĘCZNE' },
    // XY 3 x 3: skosy, Y+ / Y- (gora / dol), X- / X+ (lewo / prawo)
    { t: 'btn', x: 24, y: 104, w: 161, h: 120, text: '↖', arrow: true, act: 'diag:lu', hold: true, big: true, title: 'XY w lewo do góry (bManualXYLeftUp, 135°)' },
    { t: 'btn', x: 196, y: 104, w: 161, h: 120, text: 'Y+', act: 'jog:y:1', hold: true, big: true },
    { t: 'btn', x: 369, y: 104, w: 161, h: 120, text: '↗', arrow: true, act: 'diag:ru', hold: true, big: true, title: 'XY w prawo do góry (bManualXYRightUp, 45°)' },
    { t: 'btn', x: 24, y: 234, w: 161, h: 120, text: 'X-', act: 'jog:x:-1', hold: true, big: true },
    { t: 'btn', x: 369, y: 234, w: 161, h: 120, text: 'X+', act: 'jog:x:1', hold: true, big: true },
    { t: 'btn', x: 24, y: 364, w: 161, h: 120, text: '↙', arrow: true, act: 'diag:ld', hold: true, big: true, title: 'XY w lewo w dół (bManualXYLeftDown, 225°)' },
    { t: 'btn', x: 196, y: 364, w: 161, h: 120, text: 'Y-', act: 'jog:y:-1', hold: true, big: true },
    { t: 'btn', x: 369, y: 364, w: 161, h: 120, text: '↘', arrow: true, act: 'diag:rd', hold: true, big: true, title: 'XY w prawo w dół (bManualXYRightDown, 315°)' },
    // Z- w gore (bManualZJogUp), Z+ w dol (bManualZJogDown)
    { t: 'btn', x: 561, y: 69, w: 159, h: 119, text: 'Z-', act: 'jog:z:-1', hold: true, big: true, title: 'Z w górę (bManualZJogUp)' },
    { t: 'btn', x: 561, y: 205, w: 159, h: 119, text: 'Z+', act: 'jog:z:1', hold: true, big: true, title: 'Z w dół (bManualZJogDown)' },
    { t: 'laser', x: 741, y: 190, w: 168, h: 134, text: 'LASER', act: 'laser', title: 'Laser (bLaser)' },
    { t: 'link', x: 540, y: 326, w: 291, h: 78, text: 'SERWIS<br>PRĘDKOŚĆ JOG', act: 'tab:par', level: 2, title: 'Parametry (prędkości jog)' },
    { t: 'link', x: 540, y: 406, w: 291, h: 78, text: 'USTAWIENIA<br>POZYCJI', act: 'tab:pos', title: 'Pozycja (zapis punktów A, B, C)' },
    // pozycje osi
    { t: 'title', x: 984, y: 79, w: 293, h: 35, text: 'POZYCJE OSI' },
    ...['x', 'y', 'z'].map((ax, i) => ({ t: 'val', x: 921, y: 127 + i * 88.5, w: 356, h: 84, label: ax.toUpperCase(), id: `manPos_${ax}` })),
    // tryb pracy: ciagly / skok (bManualContinousMode), skok fManualJumpDist
    { t: 'title', x: 1334, y: 79, w: 286, h: 35, text: 'TRYB PRACY' },
    { t: 'dark', x: 1315, y: 114, w: 305, h: 84, text: 'TRYB CIĄGŁY', act: 'continuous', id: 'manContinuous',
      title: 'bManualContinousMode: ciągły – ruch, dopóki przycisk jest wciśnięty; skok – o SKOK [mm]' },
    { t: 'title', x: 1334, y: 206, w: 286, h: 35, text: 'SKOK [mm]' },
    { t: 'inp', x: 1315, y: 240, w: 323, h: 84, id: 'manJump', min: 0, max: 500, value: 10 },
    // przejazd na punkty A, B, C (zapisane w Pozycja), nad material, STOP
    { t: 'dark', x: 834, y: 392, w: 128, h: 92, text: 'A', act: 'point:A', big: true, title: 'Jedź na punkt A (bManualMovePointA)' },
    { t: 'dark', x: 984, y: 392, w: 128, h: 92, text: 'B', act: 'point:B', big: true, title: 'Jedź na punkt B (bManualMovePointB)' },
    { t: 'dark', x: 1113, y: 392, w: 128, h: 92, text: 'C', act: 'point:C', big: true, title: 'Jedź na punkt C (bManualMovePointC)' },
    { t: 'dark', x: 1253, y: 392, w: 128, h: 92, text: 'NAD<br>MATERIAŁ', act: 'point:D', title: 'Z nad materiał w aktualnym miejscu (bManualMovePointD)' },
    { t: 'stop', x: 1394, y: 392, w: 244, h: 92, text: 'STOP', act: 'stop', title: 'bManualMovePointStop' },
    // obrot (C w HMI = os A w PLC) i wychyl B
    { t: 'panel', x: 3, y: 499, w: 806, h: 142 },
    { t: 'title', x: 24, y: 499, w: 530, h: 34, text: 'USTAWIENIE OSI OBROTU (C)' },
    ...row(534, 128, 92, A_ROW.map(([v, s], i) => [[24, 186, 345, 495, 651][i], s, `a:${v}`])),
    { t: 'panel', x: 834, y: 499, w: 804, h: 142 },
    { t: 'title', x: 894, y: 499, w: 565, h: 34, text: 'USTAWIENIE OSI WYCHYLU (B)' },
    ...row(534, 128, 92, B_ROW.map(([v, s], i) => [[872, 1037, 1193, 1352, 1508][i], s, `b:${v}`])),
    // predkosci jog X / Y / Z [m/min]
    { t: 'title', x: 24, y: 648, w: 250, h: 30, text: 'pr. JOG [m/min]', left: true },
    ...[['X', 54], ['Y', 404], ['Z', 794]].map(([ax, x]) => ({ t: 'inp', x, y: 693, w: 285, h: 51, label: ax, jogvel: `jog${ax}Vel`, min: 0.001 })),
  ],
  interp: [
    { t: 'panel', x: 15, y: 82, w: 1635, h: 323 },
    { t: 'title', x: 62, y: 86, w: 528, h: 34, text: 'USTAWIENIE OSI OBROTU (C)' },
    { t: 'label', x: 41, y: 123, w: 300, h: 56, text: 'POZYCJA OBROTU' },
    { t: 'val', x: 360, y: 120, w: 255, h: 56, id: 'manPos_a', blue: true },
    { t: 'label', x: 41, y: 182, w: 300, h: 56, text: 'ZADAJ KĄT OBR.' },
    { t: 'inp', x: 360, y: 182, w: 255, h: 56, id: 'aSet', min: -180, max: 180, value: 45 },
    { t: 'label', x: 636, y: 96, w: 152, h: 52, text: 'USTAW<br>GŁOWICĘ', center: true },
    { t: 'btn', x: 659, y: 159, w: 106, h: 81, text: '⚙', act: 'goto:a', big: true, title: 'Jedź na zadany kąt obrotu (bManualAMoveToPosAbs)' },
    { t: 'panel', x: 41, y: 266, w: 807, h: 129, inner: true },
    ...row(291, 129, 86, A_ROW.map(([v, s], i) => [[71, 226, 381, 537, 692][i], s, `a:${v}`])),
    { t: 'label', x: 861, y: 96, w: 334, h: 47, text: 'RUCH NA ZADANĄ<br>POZYCJĘ', center: true },
    { t: 'btn', x: 861, y: 144, w: 334, h: 75, text: 'RUCH W KIERUNKU<br>LASERA', act: 'interp:along', toggle: true,
      title: 'bManualXYSetAngle: ruch trwa do STOP albo ponownego naciśnięcia' },
    { t: 'btn', x: 861, y: 224, w: 334, h: 75, text: 'RUCH W KIERUNKU<br>PRZECIWNYM LASER', act: 'interp:back', toggle: true, title: 'bManualXYSetAngle180' },
    { t: 'label', x: 1209, y: 93, w: 334, h: 50, text: 'RUCH PROSTOPADLE<br>DO AKTUALNEGO KĄTA', center: true },
    { t: 'btn', x: 1209, y: 144, w: 334, h: 75, text: 'RUCH PROSTOPADLE<br>DO KĄTA +', act: 'interp:perp', toggle: true, title: 'bManualXYSetAngle90' },
    { t: 'btn', x: 1209, y: 224, w: 334, h: 75, text: 'RUCH PROSTOPADLE<br>DO KĄTA -', act: 'interp:perpBack', toggle: true, title: 'bManualXYSetAngle270' },
    { t: 'stop', x: 1365, y: 305, w: 240, h: 92, text: 'STOP', act: 'stop', title: 'bManualXYAngleStop' },
    { t: 'panel', x: 24, y: 428, w: 1616, h: 323 },
    { t: 'title', x: 71, y: 432, w: 488, h: 33, text: 'USTAWIENIE WYCHYŁU (B)' },
    { t: 'label', x: 41, y: 464, w: 300, h: 56, text: 'POZYCJA<br>AKTUALNA [°]' },
    { t: 'val', x: 368, y: 464, w: 255, h: 56, id: 'manPos_b', blue: true },
    { t: 'label', x: 41, y: 523, w: 300, h: 56, text: 'ZADAJ KĄT' },
    { t: 'inp', x: 368, y: 523, w: 255, h: 56, id: 'bSet', min: -2.5, max: 90, value: 15 },
    { t: 'label', x: 636, y: 437, w: 152, h: 58, text: 'USTAW<br>GŁOWICĘ', center: true },
    { t: 'btn', x: 659, y: 501, w: 106, h: 81, text: '⚙', act: 'goto:b', big: true, title: 'Jedź na zadany wychył (bManualBMoveToPosAbs)' },
    { t: 'panel', x: 41, y: 605, w: 807, h: 132, inner: true },
    ...row(638, 127, 92, B_ROW.map(([v, s], i) => [[73, 239, 394, 549, 704][i], s, `b:${v}`])),
    { t: 'label', x: 1020, y: 447, w: 326, h: 51, text: 'RUCH WZDŁUŻ<br>WYCHYLONEJ TARCZY', center: true },
    { t: 'btn', x: 1020, y: 506, w: 159, h: 118, text: '↙', arrow: true, act: 'tilt:down', hold: true, big: true, title: 'W dół wzdłuż pochylonej tarczy (bManualMoveWithTiltDown)' },
    { t: 'btn', x: 1190, y: 506, w: 156, h: 118, text: '↗', arrow: true, act: 'tilt:up', hold: true, big: true, title: 'W górę wzdłuż pochylonej tarczy (bManualMoveWithTiltUp)' },
    { t: 'laser', x: 1421, y: 458, w: 169, h: 134, text: 'LASER', act: 'laser', title: 'Laser (bLaser)' },
    { t: 'stop', x: 1365, y: 639, w: 240, h: 92, text: 'STOP', act: 'stop', title: 'bManualMoveWithTiltStop' },
  ],
};

// HTML ekranu: pozycje w procentach ukladu HMI (okno dowolnej szerokosci zachowuje proporcje ekranu)
export function manualScreenHtml(items) {
  const pc = (v, n) => `${(v / n * 100).toFixed(3)}%`;
  const pos = (e) => `left:${pc(e.x, HMI_W)};top:${pc(e.y, HMI_H)};width:${pc(e.w, HMI_W)};height:${pc(e.h, HMI_H)}`;
  return items.map((e) => {
    const tip = e.title ? ` title="${e.title}"` : '';
    switch (e.t) {
      case 'panel': return `<div class="hmiPanel${e.inner ? ' inner' : ''}" style="${pos(e)}"></div>`;
      case 'title': return `<div class="hmiTitle${e.left ? ' left' : ''}" style="${pos(e)}">${e.text}</div>`;
      case 'label': return `<div class="hmiLabel${e.center ? ' center' : ''}" style="${pos(e)}">${e.text}</div>`;
      case 'val': return `<div class="hmiVal${e.blue ? ' blue' : ''}" style="${pos(e)}">${e.label ? `<b>${e.label}</b>` : ''}<output id="${e.id}"></output></div>`;
      case 'inp': {
        const attrs = [e.id && `id="${e.id}"`, e.jogvel && `data-jogvel="${e.jogvel}"`, e.min !== undefined && `min="${e.min}"`,
          e.max !== undefined && `max="${e.max}"`, e.value !== undefined && `value="${e.value}"`].filter(Boolean).join(' ');
        return `<div class="hmiInp" style="${pos(e)}">${e.label ? `<b>${e.label}</b>` : ''}<input type="number" step="any" ${attrs}></div>`;
      }
      default: {
        const cls = { btn: 'hmiBtn', dark: 'hmiBtn dark', stop: 'hmiBtn stop', link: 'hmiBtn link', laser: 'hmiBtn laser' }[e.t];
        const data = `data-hmi="${e.act}"${e.hold ? ' data-hold' : ''}${e.toggle ? ' data-toggle' : ''}${e.level ? ` data-level="${e.level}"` : ''}`;
        return `<button type="button" class="${cls}${e.big ? ' big' : ''}${e.arrow ? ' arrow' : ''}"${e.id ? ` id="${e.id}"` : ''} ${data}${tip} style="${pos(e)}">${e.text}</button>`;
      }
    }
  }).join('');
}
