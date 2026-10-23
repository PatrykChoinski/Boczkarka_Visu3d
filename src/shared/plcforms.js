// Formularze Manual w trybie PLC: pole operacji Visu3D -> zmienna PLC (jak pola ekranow HMI manual_*), bit START.
// W trybie PLC formularz pokazuje wartosci z PLC, zmiana pola zapisuje zmienna (jak pole liczbowe w HMI), START - bit
// startu operacji (jak przycisk START PRACY; PLC kasuje go po cyklu). Zrodla: kod PLC (GetPositions operacji) i ekrany HMI.
//
// Pole: {v} - ta sama wartosc; {v, inv} - BOOL odwrocony; {v, map: [[pole, plc]]} - lista; {v, scale} - PLC = pole * scale
// (predkosci: PLC mm/s, pole m/min); {arr, n, from, full} - lista liczb -> elementy tablicy [from..from+n-1] (brakujace 0;
// "{i}" w nazwie - indeks w srodku sciezki), odczyt do pierwszego 0 (full - wszystkie); {flag, num} - liczba > 0 wlacza
// dodatkowa wartosc (bit + liczba); {cmd: {opcja: bit}} - polecenie (PLC przelicza i kasuje bit; odczyt niemozliwy -
// zostaje wartosc z formularza); {ro} - tylko odczyt (PLC liczy sam); {pulse, ro, mod} - wartosc zmieniana impulsami
// (bit +1 co cykl PLC, modulo mod - jak przycisk w HMI). lvl - poziom zapisu wyzszy niz Operator (pole zablokowane, START
// go nie wysyla).
// pre - zapisy przed START (Visu3D liczy operacje z takimi wartosciami); null - pole bez odpowiednika w PLC.
// Zmienne wspolne kilku operacji (np. HMI.iManualInternal, HMI.bManualToLaser) - jedna wartosc w PLC, jak w HMI.

export const PLC_OPS = {
  // CutST (ekran 52 manual_ciecie); kat + dlugosc: rozny kat glowicy - popup 305 (potwierdzenie)
  cut: {
    start: 'HMI2.bCutStart',
    fields: {
      twoPoint: { v: 'HMI.bManualTwoPoint' },
      x0: { v: 'HMI.fManualXZeroPosition' }, y0: { v: 'HMI.fManualYZeroPosition' },
      x1: { v: 'HMI.fManualXEndPosition' }, y1: { v: 'HMI.fManualYEndPosition' },
      angle: { v: 'HMI.fManualASetPosition' }, length: { v: 'HMI.fManualLenght' },
      toLaser: { v: 'HMI.bManualToLaser' },
      internal: { v: 'HMI.iManualInternal' },
      reverse: { v: 'HMI.bManualReverse' },
      tilt: { v: 'HMI.bManualBAngle' }, b: { v: 'HMI.fManualBSetPosition' },
    },
  },
  // CutStripesST (ekrany 54, 55); popup 313 - potwierdzenie kata glowicy
  stripes: {
    start: 'HMI2.bCutStripesStart',
    pre: [['HMI.iManualInternal', 0], ['HMI.bManualBAngle', false]],
    fields: {
      xs: { v: 'HMI.fManualStripesXStartPosition' }, ys: { v: 'HMI.fManualStripesYStartPosition' },
      xCut: { v: 'HMI.bManualStripesXCut' },
      twoPoint: { v: 'HMI.bManualStripesTwoPoint' },
      xe: { v: 'HMI.fManualStripesXEndPosition' }, ye: { v: 'HMI.fManualStripesYEndPosition' },
      length: { v: 'HMI.fManualStripesLength' },
      angleCut: { v: 'HMI.bManualStripesAngleCut' }, angle: { v: 'HMI.fManualStripesAngleSet' },
      constant: { v: 'HMI.bManualStripesConstantWidth' },
      width: { v: 'HMI.fManualStripesWidthSet' }, number: { v: 'HMI.iManualStripesNumberSet' },
      widths: { arr: 'HMI.aManualStripesWidths', n: 10 }, numbers: { arr: 'HMI.aManualStripesNumbers', n: 10 },
      repeating: { v: 'HMI2.bCutStripesRepeating' },
      reverse: { v: 'HMI.bManualStripesReverse' },
      toLaser: { v: 'HMI.bManualToLaser' },
    },
  },
  // CutBlocksST (ekran 51); tablice w PLC [0..10], zapisywalne [0..9]
  blocks: {
    start: 'HMI2.bCutBlocksStart',
    pre: [['HMI.iManualInternal', 0], ['HMI.bManualBAngle', false]],
    fields: {
      xs: { v: 'HMI.fManualBlocksXStartPosition' }, ys: { v: 'HMI.fManualBlocksYStartPosition' },
      lengths: { arr: 'HMI.aManualBlocksLengths', n: 10 }, widths: { arr: 'HMI.aManualBlocksWidths', n: 10 },
      additional: { flag: 'HMI.bManualAdditionalDistance', num: 'HMI.fManualAdditionalDistance' },
    },
  },
  // EdgesST (ekran 100 krawedzie)
  edges: {
    start: 'HMI2.bEdgesStart',
    fields: {
      xs: { v: 'HMI.fEdgesXStartPosition' }, ys: { v: 'HMI.fEdgesYStartPosition' },
      length: { v: 'HMI.fEdgesLength' }, width: { v: 'HMI.fEdgesWidth' }, angle: { v: 'HMI.fEdgesAngle' },
      internal: { v: 'HMI.iManualInternal' },
      additional: { flag: 'HMI.bManualAdditionalDistance', num: 'HMI.fManualAdditionalDistance' },
    },
  },
  // MowingST (ekran 128 Test Zakoszenia)
  mowing: {
    start: 'HMI2.bMowingStart',
    fields: {
      xs: { v: 'HMI2.fMowingStartPositionX' }, ys: { v: 'HMI2.fMowingStartPositionY' },
      distance: { v: 'HMI2.fMowingDistance' }, depth: { v: 'HMI2.fMowingDepth' },
    },
  },
  // CutArcST (ekran 53 manual_luk); typ: ArcType Radius 0, ThreePoints 1, Chord 2. Luk zewnetrzny - popup 304
  arc: {
    start: 'HMI2.bCutArcStart',
    fields: {
      x0: { v: 'HMI.fManualArcXZeroPosition' }, y0: { v: 'HMI.fManualArcYZeroPosition' },
      x1: { v: 'HMI.fManualArcXEndPosition' }, y1: { v: 'HMI.fManualArcYEndPosition' },
      type: { v: 'HMI.iManualArcType' },
      r: { v: 'HMI.fManualArcRadius' },
      cw: { v: 'HMI.bManualArcClockwise' },
      xm: { v: 'HMI.fManualArcXMiddlePosition' }, ym: { v: 'HMI.fManualArcYMiddlePosition' },
      sagitta: { v: 'HMI.fManualArcChord' },
    },
  },
  // CutCircleST (ekran 58 manual_okrag) - zmienne luku
  circle: {
    start: 'HMI2.bCutCircleStart',
    fields: {
      x: { v: 'HMI.fManualArcXZeroPosition' }, y: { v: 'HMI.fManualArcYZeroPosition' },
      center: { v: 'HMI.bManualCircleCenter' }, r: { v: 'HMI.fManualArcRadius' },
      inner: { v: 'HMI.bManualArcInner' },
    },
  },
  // CutElipseST (ekran 59 manual_elipsa); Visu3D - ciecie zewnetrzne
  ellipse: {
    start: 'HMI2.bCutElipseStart',
    pre: [['HMI.iManualInternal', 0]],
    fields: {
      xs: { v: 'HMI.fManualElipseXStartPosition' }, ys: { v: 'HMI.fManualElipseYStartPosition' },
      length: { v: 'HMI.fManualElipseLength' }, width: { v: 'HMI.fManualElipseWidth' },
    },
  },
  // profil - w PLC tylko jako kroki programu profili (ProgramAutoProfileST), bez recznego startu
  profile: null,

  // --- frez (ekrany 62, 53, 58, 59, 54 / 64, 51, 100 w trybie frezu); wychyl wylaczony (MillST - frezowanie pod katem)
  millLine: {
    start: 'HMI2.bMillStart',
    pre: [['HMI.bManualBAngle', false]],
    fields: {
      twoPoint: { v: 'HMI.bManualTwoPoint' },
      x0: { v: 'HMI.fManualXZeroPosition' }, y0: { v: 'HMI.fManualYZeroPosition' },
      x1: { v: 'HMI.fManualXEndPosition' }, y1: { v: 'HMI.fManualYEndPosition' },
      angle: { v: 'HMI.fManualASetPosition' }, length: { v: 'HMI.fManualLenght' },
    },
  },
  // MillArcST: cieciwa tylko z HMI.bServiceArcChord (inaczej PLC zmienia typ na promien); luk zewnetrzny - popup 304
  millArc: {
    start: 'HMI2.bMillArcStart',
    pre: [['HMI.bManualBAngle', false]],
    fields: {
      x0: { v: 'HMI.fManualArcXZeroPosition' }, y0: { v: 'HMI.fManualArcYZeroPosition' },
      x1: { v: 'HMI.fManualArcXEndPosition' }, y1: { v: 'HMI.fManualArcYEndPosition' },
      type: { v: 'HMI.iManualArcType' }, r: { v: 'HMI.fManualArcRadius' }, cw: { v: 'HMI.bManualArcClockwise' },
      xm: { v: 'HMI.fManualArcXMiddlePosition' }, ym: { v: 'HMI.fManualArcYMiddlePosition' },
      sagitta: { v: 'HMI.fManualArcChord' },
      includeTool: { v: 'HMI.bManualArcIncludeToolDiameter' },
    },
  },
  // MillCircleST: iManualInternal 0 - R + frez/2, 1 - R - frez/2, 2 - po linii (PLC zeruje po pracy - zapis przy START)
  millCircle: {
    start: 'HMI2.bMillCircleStart',
    pre: [['HMI.bManualBAngle', false]],
    fields: {
      x: { v: 'HMI.fManualArcXZeroPosition' }, y: { v: 'HMI.fManualArcYZeroPosition' },
      center: { v: 'HMI.bManualCircleCenter' }, r: { v: 'HMI.fManualArcRadius' },
      internal: { v: 'HMI.iManualInternal' },
    },
  },
  millEllipse: {
    start: 'HMI2.bMillElipseStart',
    fields: {
      xs: { v: 'HMI.fManualElipseXStartPosition' }, ys: { v: 'HMI.fManualElipseYStartPosition' },
      length: { v: 'HMI.fManualElipseLength' }, width: { v: 'HMI.fManualElipseWidth' },
      internal: { v: 'HMI.iManualInternal' },
    },
  },
  // MillStripesST: Visu3D - stala szerokosc; frezowanie stolu (bMillTableStart) nie jest zapisywane przez HMI - tylko z HMI
  millStripes: {
    start: 'HMI2.bMillStripesStart',
    pre: [['HMI.bManualStripesConstantWidth', true]],
    noStart: (v) => (v.table ? 'Frezowanie stołu (bMillTableStart) – w PLC brak startu z ekranów; uruchom z panelu maszyny' : null),
    fields: {
      table: null,
      xs: { v: 'HMI.fManualStripesXStartPosition' }, ys: { v: 'HMI.fManualStripesYStartPosition' },
      xCut: { v: 'HMI.bManualStripesXCut' }, twoPoint: { v: 'HMI.bManualStripesTwoPoint' },
      xe: { v: 'HMI.fManualStripesXEndPosition' }, ye: { v: 'HMI.fManualStripesYEndPosition' },
      angleCut: { v: 'HMI.bManualStripesAngleCut' }, angle: { v: 'HMI.fManualStripesAngleSet' },
      length: { v: 'HMI.fManualStripesLength' },
      width: { v: 'HMI.fManualStripesWidthSet' }, number: { v: 'HMI.iManualStripesNumberSet' },
      tableLength: { v: 'HMI.fManualTableLength' }, tableWidth: { v: 'HMI.fManualTableWidth' },
    },
  },
  // MillBlocksST: dlugosci linii liczy PLC (Status) z list i srednicy frezu
  millBlocks: {
    start: 'HMI2.bMillBlocksStart',
    fields: {
      xs: { v: 'HMI.fManualBlocksXStartPosition' }, ys: { v: 'HMI.fManualBlocksYStartPosition' },
      xLast: { ro: 'HMI.fManualBlocksXLastPosition' }, yLast: { ro: 'HMI.fManualBlocksYLastPosition' },
      widths: { arr: 'HMI.aManualBlocksWidths', n: 10 }, lengths: { arr: 'HMI.aManualBlocksLengths', n: 10 },
    },
  },
  // EdgesST w trybie frezu (bMillStart na kazda krawedz); Visu3D - bez dodatkowej drogi
  millEdges: {
    start: 'HMI2.bEdgesStart',
    pre: [['HMI.bManualAdditionalDistance', false]],
    fields: {
      xs: { v: 'HMI.fEdgesXStartPosition' }, ys: { v: 'HMI.fEdgesYStartPosition' },
      length: { v: 'HMI.fEdgesLength' }, width: { v: 'HMI.fEdgesWidth' }, angle: { v: 'HMI.fEdgesAngle' },
      internal: { v: 'HMI.iManualInternal' },
    },
  },
  // --- wiercenie (ekrany 262, 261): predkosc Z w PLC mm/s, pole m/min
  drill: {
    start: 'HMI2.bDrillStart',
    fields: {
      x: { v: 'HMI.fManualXZeroPosition' }, y: { v: 'HMI.fManualYZeroPosition' },
      depth: { v: 'HMI2.fDrillDepth' }, zVel: { v: 'HMI.fVelocityAxisZDrill', scale: 1 / 0.06 },
      above: { v: 'HMI.fParameterZMoveAboveMaterial' },
    },
  },
  drillSimple: {
    start: 'HMI2.bDrillSimpleStart',
    fields: {
      depth: { v: 'HMI2.fDrillDepth' }, zVel: { v: 'HMI.fVelocityAxisZDrill', scale: 1 / 0.06 },
      above: { v: 'HMI.fParameterZMoveAboveMaterial' },
    },
  },
  // --- polerowanie (ekrany 251, 255): rodzaj - impulsy bPolishingIncrease (+1, modulo 4); predkosc - wspolna predkosc frezu
  polishing: {
    start: 'PolishingGVL.bStart',
    fields: {
      xs: { v: 'PolishingGVL.fXStartPosition' }, ys: { v: 'PolishingGVL.fYStartPosition' },
      width: { v: 'PolishingGVL.fWidth' }, length: { v: 'PolishingGVL.fLength' }, jump: { v: 'PolishingGVL.fJump' },
      type: { ro: 'PolishingGVL.PolishingType', pulse: 'PolishingGVL.bPolishingIncrease', mod: 4 },
      vel: { v: 'HMI.fVelocityMillMode', scale: 1 / 0.06 },
      heightMode: { v: 'PolishingGVL.bMaterialHeightMode' }, height: { v: 'PolishingGVL.fHeightPosition' },
      queue: { v: 'PolishingGVL.bQueue' },
      reps: { arr: 'PolishingGVL.aToolRepetitions', n: 10, from: 1, full: true },
      qXY: { arr: 'PolishingGVL.aQueueTools[{i}].Actions[0]', n: 10, from: 1, full: true },
      qYX: { arr: 'PolishingGVL.aQueueTools[{i}].Actions[1]', n: 10, from: 1, full: true },
      qCCW: { arr: 'PolishingGVL.aQueueTools[{i}].Actions[2]', n: 10, from: 1, full: true },
      qCW: { arr: 'PolishingGVL.aQueueTools[{i}].Actions[3]', n: 10, from: 1, full: true },
      change: null,
      above: { v: 'HMI.fParameterAboveMaterialPosition' },
    },
  },
};

// Wspolne parametry ciecia pily (ekran 40 glebokosci_ciecia): tablica glebokosci - polecenie (Depths przelicza tablice)
export const PLC_COMMON = {
  saw: {
    thickness: { v: 'HMI.fParameterMaterialThickness' },
    reserve: { v: 'HMI.fCutDepthCutReserve' },
    depthMode: { cmd: { same: 'HMI.bCutDepthSameSize', step: 'HMI.bCutDepthConstantJumpDist', one: 'HMI.bCutDepthOneCut' } },
    passes: { v: 'HMI.iCutDepthPrimaryNumber' },
    maxJump: { v: 'HMI.fCutDepthMaxJumpDistance' },
    step: { v: 'HMI.fCutDepthCutHeight' },
    minLast: { v: 'HMI.fCutDepthMinLastJumpDistance' },
    above: { v: 'HMI.fParameterZMoveAboveMaterial' },
    lastCutWithDirection: { v: 'HMI.bManualLastCutWithDirection' },
    innerCorr: { v: 'HMI.fParameterInnerCutCorrection', lvl: 2 },   // ekran serwisowy - zapis od poziomu Serwis
  },
  // tablica glebokosci frezu (ekran 42 glebokosci_frez)
  mill: {
    reserve: { v: 'HMI.fMillDepthMillReserve' },
    depthMode: { cmd: { same: 'HMI.bMillDepthSameSize', step: 'HMI.bMillDepthConstantJumpDist', one: 'HMI.bMillDepthOneMill' } },
    passes: { v: 'HMI.iMillDepthPrimaryNumber' },
    step: { v: 'HMI.fMillDepthMillHeight' },
    minLast: { v: 'HMI.fMillDepthMinLastJumpDistance' },
    overtaking: { v: 'HMI.fCutOvertakingPrecent' },
    above: { v: 'HMI.fParameterZMoveAboveMaterial' },
  },
};

// Nazwa elementu tablicy (i - indeks listy od 0)
const elem = (m, i) => (m.arr.includes('{i}') ? m.arr.replace('{i}', i + (m.from ?? 0)) : `${m.arr}[${i + (m.from ?? 0)}]`);

// Zapisy jednego pola (wartosc z formularza Visu3D)
export function fieldWrites(m, value) {
  if (!m) return [];
  if (m.v) {
    let x = value;
    if (m.inv) x = !x;
    if (m.map) x = (m.map.find(([a]) => a === value) ?? [null, value])[1];
    if (m.scale) x = Number(x) * m.scale;
    return [{ v: m.v, value: x }];
  }
  if (m.arr) {
    const list = Array.isArray(value) ? value : [];
    return Array.from({ length: m.n }, (_, i) => ({ v: elem(m, i), value: Number(list[i]) || 0 }));
  }
  if (m.flag) {
    const n = Number(value) || 0;
    return [{ v: m.flag, value: n > 0 }, ...(n > 0 ? [{ v: m.num, value: n }] : [])];
  }
  if (m.cmd) return m.cmd[value] ? [{ v: m.cmd[value], value: true }] : [];
  return [];
}

// Impulsy pola {pulse}: ile razy bit +1, zeby z wartosci w PLC dojsc do wartosci pola (null - bez odczytu)
export function pulseCount(m, value, vals) {
  const cur = Number(vals[m.ro]);
  if (!m.pulse || !Number.isFinite(cur)) return null;
  return ((Math.round(Number(value)) - cur) % m.mod + m.mod) % m.mod;
}

// Wartosc pola z wartosci PLC (undefined - brak / nieczytelne: zostaje wartosc formularza)
export function fieldRead(m, vals) {
  if (!m) return undefined;
  if (m.v) {
    let x = vals[m.v];
    if (x === undefined) return undefined;
    if (m.scale) x = Number(x) / m.scale;
    if (m.map) x = (m.map.find(([, b]) => b === x) ?? [x])[0];
    if (m.inv) x = !x;
    return x;
  }
  if (m.ro) return vals[m.ro];
  if (m.arr) {
    const xs = Array.from({ length: m.n }, (_, i) => vals[elem(m, i)]);
    if (xs.some((x) => x === undefined)) return undefined;
    if (m.full) return xs.map(Number);
    // jak HMI / PLC (GetNumber): do pierwszego wiersza 0
    const end = xs.findIndex((x) => !(Number(x) > 0));
    return xs.slice(0, end < 0 ? xs.length : end).map(Number);
  }
  if (m.flag) {
    if (vals[m.flag] === undefined) return undefined;
    return vals[m.flag] ? Number(vals[m.num]) || 0 : 0;
  }
  return undefined;
}

// Zmienne do odczytu (watch) dla mapy pol
export function mapVars(fields) {
  const out = [];
  for (const m of Object.values(fields || {})) {
    if (!m) continue;
    if (m.v) out.push(m.v);
    if (m.ro) out.push(m.ro);
    if (m.arr) for (let i = 0; i < m.n; i++) out.push(elem(m, i));
    if (m.flag) out.push(m.flag, m.num);
  }
  return out;
}
