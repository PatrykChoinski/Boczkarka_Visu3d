// Zmienne PLC (symbol config, jak w HMI): klucz w aplikacji -> "GVL.zmienna".
// Wymagane sa pozycje osi i parametry tarczy / materialu, reszta opcjonalna.
export const VARIABLES = {
  x: 'HMI2.fXActualPosition',
  y: 'HMI2.fYActualPosition',
  z: 'HMI2.fZActualPosition',
  a: 'HMI2.fAActualPosition',
  b: 'HMI2.fBActualPosition',
  discDiameter: 'HMI.fParameterDiscDiameter',
  bladeWidth: 'HMI.fParameterBladeWidth',
  cutTiltDiameter: 'HMI.fParameterCutTiltDiameter',
  headRotationDiameter: 'HMI.fParameterHeadRotationDiameter',
  materialHeight: 'HMI.fCutMaterialHeight',
  materialThickness: 'HMI.fParameterMaterialThickness',
  cutStep: 'HMI2.CutStep',
  cutStart: 'HMI2.bCutStart',
  sawRunning: 'Communication.bMainDriveRunning',
  waterCut: 'IOVars.yWaterCut',
  // stol i kamien (Settings/WorkArea): do 8 wierzcholkow XYZ
  boardX: 'HMI.aCuttingBoardX',
  boardY: 'HMI.aCuttingBoardY',
  boardZ: 'HMI.aCuttingBoardZ',
  boardCount: 'HMI.iCuttingBoardApexNumber',
  rockX: 'HMI.aCuttingRockX',
  rockY: 'HMI.aCuttingRockY',
  rockZ: 'HMI.aCuttingRockZ',
  rockCount: 'HMI.iCuttingRockApexNumber',
  // dynamika (Settings/VelocityAcceleration) - do trybu offline ("Pobierz z PLC")
  cutVel: 'HMI.fVelocitySawMode',
  cutAcc: 'HMI.Acc',
  cutDec: 'HMI.Dec',
  fastVel: 'HMI.fVelocityFast',
  fastAcc: 'HMI.DecX',
  zVel: 'HMI.fVelocityAxisZWork',
  zAcc: 'HMI.DecZ',
  aVel: 'HMI.VelA',
  aAcc: 'HMI.DecA',
  bVel: 'HMI.VelB',
  bAcc: 'HMI.DecB',
};

export const REQUIRED = ['x', 'y', 'z', 'a', 'b', 'discDiameter', 'materialHeight'];

export const MACHINE_KEYS = ['discDiameter', 'bladeWidth', 'cutTiltDiameter', 'headRotationDiameter', 'materialHeight', 'materialThickness'];
export const DYNAMICS_KEYS = ['cutVel', 'cutAcc', 'cutDec', 'fastVel', 'fastAcc', 'zVel', 'zAcc', 'aVel', 'aAcc', 'bVel', 'bAcc'];

// Jednostki dynamiki: w PLC i w obliczeniach mm/s, mm/s2 (deg/s, deg/s2), na ekranie i w config.json
// predkosci liniowe w m/min, przyspieszenia w m/s2 (osie obrotowe bez zmian)
const DISPLAY_FACTOR = { vel: 1000 / 60, acc: 1000, rot: 1 };
const DYNAMICS_UNITS = {
  cutVel: 'vel', cutAcc: 'acc', cutDec: 'acc', fastVel: 'vel', fastAcc: 'acc', zVel: 'vel', zAcc: 'acc',
  aVel: 'rot', aAcc: 'rot', bVel: 'rot', bAcc: 'rot',
};

// ekran (m/min, m/s2) -> obliczenia (mm/s, mm/s2); tylko klucze obecne w d
export function dynamicsToInternal(d) {
  return Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v * (DISPLAY_FACTOR[DYNAMICS_UNITS[k]] ?? 1)]));
}

// obliczenia / PLC (mm/s, mm/s2) -> ekran (m/min, m/s2)
export function dynamicsToDisplay(d) {
  return Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v / (DISPLAY_FACTOR[DYNAMICS_UNITS[k]] ?? 1)]));
}

// CutStepType (PLC) - do paska stanu
export const CUT_STEPS = {
  0: 'WaitForStart', 1: 'ResetInputs', 2: 'CheckPopup', 3: 'PrepareToStart',
  10: 'MoveToStartPosition', 11: 'DoneMoveToStartPosition', 12: 'MoveToBasePosition',
  13: 'DoneMoveToBasePosition', 20: 'StartCutDepth', 21: 'DoneCutDepth', 22: 'CutDepthPrepare',
  30: 'StartManualPass', 31: 'DoneManualPass', 50: 'StartSingleCut', 51: 'WaitForSetVelocity',
  52: 'DoneSetVelocity', 56: 'StartCutOvertaking', 59: 'SingleCutDone', 60: 'StartLastCut',
  61: 'DoneLastCut', 70: 'StartMoveAboveMaterial', 71: 'DoneMoveAboveMaterial', 80: 'CutStop',
  81: 'CutStopReset', 90: 'CutPause', 91: 'CutResume', 100: 'CutFinish',
};

export const DEFAULTS = {
  httpPort: 8128,                       // strona: http://localhost:8128
  endpoint: 'opc.tcp://localhost:4840', // serwer OPC UA sterownika (CODESYS)
  username: '',
  password: '',
  nodePrefix: '',                       // np. "ns=4;s=|var|AX-8.Application." - puste = szukanie w drzewie
  pollMs: 50,
  variables: {},                        // nadpisanie VARIABLES
  autoClearOnStart: true,               // nowe ciecie (bCutStart) czysci poprzednie
  materialMargin: 300,
  materialMinSize: [1200, 800],
  // model maszyny (pila mostowa) w widoku - wg punktow stolu, niezalezny od kamienia: most wzdluz osi
  // bridgeAlong ('x' - most jedzie w Y), sciany margin mm od stolu, spod mostu bridgeZ mm nad Z = 0,
  // dlugosc slupa Z, wysokosc stolu (do podlogi)
  frame: { show: true, bridgeAlong: 'x', margin: 150, bridgeZ: 300, ramLength: 1400, tableHeight: 700 },
  // tryb offline: wartosci poczatkowe formularzy (mm; m/min, m/s2; deg/s, deg/s2)
  offline: {
    machine: { discDiameter: 625, bladeWidth: 4, cutTiltDiameter: 200, headRotationDiameter: 100, materialHeight: 450, materialThickness: 40 },
    // stol i kamien: punkty XYZ jak aCuttingBoard / aCuttingRock (pozycje osi), count = liczba wierzcholkow;
    // gora materialu offline jak w PLC: Z min punktow stolu - grubosc
    board: { count: 4, points: [[0, 0, 490], [3500, 0, 490], [3500, 3000, 490], [0, 3000, 490]] },
    rock: { count: 4, points: [[300, 200, 450], [2800, 200, 450], [2800, 1800, 450], [300, 1800, 450]] },
    dynamics: { cutVel: 1.8, cutAcc: 0.06, cutDec: 0.06, fastVel: 9, fastAcc: 0.3, zVel: 1.2, zAcc: 0.04, aVel: 30, aAcc: 60, bVel: 10, bAcc: 20 },
    cut: { x0: 200, y0: 300, x1: 1000, y1: 300, b: 0, depth: 30, passes: 3, above: 20 },
    start: { x: 0, y: 0, z: 0, a: 0, b: 0 },
  },
};
