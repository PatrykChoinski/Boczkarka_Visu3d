// Wspolne parametry ciecia (Depths, CutST, serwis) dla operacji offline i automatu.

// Pola: k - klucz, t - 'num' | 'int' | 'bool' | 'sel' | 'list' (liczby po przecinku), d - domyslna, o - opcje sel,
// show(v) - pole widoczne tylko przy danych wartosciach innych pol (np. tylko przy "dwa punkty");
// svc - bit serwisowy HMI.bService... (service.js): pole nie jest w formularzu, wartosc z ekranu Ustawienia
export const INTERNAL = [[0, 'zewnętrzne'], [1, 'wewnętrzne (oba końce)'], [2, 'wewn. początek'], [3, 'wewn. koniec']];

// Wspolne parametry ciecia (Depths, CutST, serwis)
export const COMMON_FIELDS = [
  { k: 'thickness', label: 'Głębokość cięcia (grubość) [mm]', t: 'num', d: 30 },
  { k: 'reserve', label: 'Zapas głębokości [mm]', t: 'num', d: 0 },
  { k: 'depthMode', label: 'Tablica głębokości', t: 'sel', d: 'same', o: [['same', 'równe przejścia'], ['step', 'stały skok'], ['one', 'jedno przejście']] },
  { k: 'passes', label: 'Przejścia (tablica główna)', t: 'int', d: 3, show: (v) => v.depthMode === 'same' },
  { k: 'maxJump', label: 'Max skok tablicy 2 [%]', t: 'num', d: 0, show: (v) => v.depthMode === 'same' },
  { k: 'step', label: 'Skok głębokości [mm]', t: 'num', d: 10, show: (v) => v.depthMode === 'step' },
  { k: 'minLast', label: 'Min. ostatni skok [mm]', t: 'num', d: 2, show: (v) => v.depthMode === 'step' },
  { k: 'above', label: 'Wyjazd nad materiał [mm]', t: 'num', d: 20 },
  { k: 'lastCutWithDirection', label: 'Ostatnie cięcie z kierunkiem', t: 'bool', d: false },
  { k: 'slower', label: 'Wolniejsza końcówka ostatniego przejścia', t: 'bool', d: true, svc: 'bServiceLastCutSlower' },
  { k: 'blocksReverse', label: 'Linie Y z odwróconą głowicą', t: 'bool', d: true, svc: 'bServiceBlocksReverse' },
  { k: 'innerCorr', label: 'Korekta cięcia wewn. [mm]', t: 'num', d: 0 },
];

// Parametry CutST z wartosci wspolnych + linia; wychyl (common.tilt, common.b) tylko gdy podany przez wywolujacego -
// w PLC tylko ciecie proste (CutST, bManualBAngle) i skosy automatu; pasy, bloki, krawedzie, luk, okrag go zeruja (#142)
export function cutParams(line, common, extra = {}) {
  const { total, ...rest } = extra;
  return {
    x0: line.x0, y0: line.y0, x1: line.x1, y1: line.y1,
    angle: line.angle,          // kat glowicy zadany (kat + dlugosc); bez - z punktow (GetAngleFun)
    reverse: Boolean(line.reverse),
    internal: line.internal ?? 0,
    b: common.tilt ? common.b : 0,
    depth: {
      mode: common.depthMode, total: (total ?? common.thickness) + (common.reserve || 0),
      passes: common.passes, maxJump: common.maxJump, step: common.step, minLast: common.minLast,
    },
    thickness: common.thickness,
    lastCutWithDirection: common.lastCutWithDirection,
    innerCorr: common.innerCorr,
    above: common.above,
    slower: { on: common.slower, pct: 20, speedPct: 90 },
    ...rest,
  };
}

