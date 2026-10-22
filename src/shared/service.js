// Bity serwisowe (HMI.bService...) uzywane przez programy Visu3D - jeden stan dla wszystkich programow; na ekranie Serwis
// (strona Ustawienia jak serwis_3 w HMI, bity bez ekranu HMI w grupie dodatkowej), od poziomu Serwis.
// Pola formularzy z svc (ops.js, common.js, millops.js, figury) nie sa pokazywane w formularzach - ich wartosc
// czytana jest z ustawien (ten sam bit w kilku programach, np. bServiceRectangleACBD - krawedzie i figury).
// group - grupa na ekranie, modes - tryby, ktorych bit dotyczy (ikona grupy).

export const SERVICE_BITS = [
  { k: 'bServiceBlocksReverse', group: 'saw', d: true, label: 'Linie Y bloków / krawędzi z odwróconą głowicą' },
  { k: 'bServiceLastCutSlower', group: 'saw', d: true, label: 'Wolniejsza końcówka ostatniego przejścia' },
  { k: 'bServiceBlockSwap', group: 'saw', d: false, label: 'Bloki: najpierw linie Y' },
  { k: 'bServiceRectangleACBD', group: 'saw', d: false, label: 'Prostokąt / krawędzie w kolejności AB, CD, BC, DA' },
  { k: 'bServiceBookMinimalRadius', group: 'saw', d: false, label: 'Książki: promień minimalny' },
  { k: 'bServiceCutProgramOuterInner', group: 'auto', d: false, label: 'Automat: przesunięcie we / zew o szerokość tarczy' },
  { k: 'bServiceSmoothingArrays', group: 'auto', d: false, label: 'Profile: wygładzanie łańcuchem wierszy' },
  { k: 'bServiceMillZFirst', group: 'mill', d: false, label: 'Frez: najpierw Z, potem przejście (bez zjazdu w ruchu)' },
  { k: 'bServiceMillCircleReverse', group: 'mill', d: false, label: 'Frez: okrąg przeciwnie do zegara' },
  { k: 'bServiceAllowSwap', group: 'mill', d: false, label: 'Frez: pasy – zamiana kierunku co drugiej linii' },
  { k: 'bServiceMillProgramNewStartPoints', group: 'mill', d: false, label: 'Frez: nowe punkty startu programu (figury)' },
  { k: 'bServiceManualRewriteJogSpeed', group: 'man', d: false, label: 'Ruchy ręczne: przy pile jog X / Y z prędkością cięcia, Z roboczą' },
];

export const SERVICE_GROUPS = { saw: 'Piła', auto: 'Automat', mill: 'Frez', man: 'Ruchy ręczne' };

export const serviceDefaults = () => Object.fromEntries(SERVICE_BITS.map((b) => [b.k, b.d]));
