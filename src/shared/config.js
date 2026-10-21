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
  // tryb offline: wartosci poczatkowe formularzy (mm, mm/s, mm/s2, deg/s, deg/s2)
  offline: {
    machine: { discDiameter: 625, bladeWidth: 4, cutTiltDiameter: 200, headRotationDiameter: 100, materialHeight: 450, materialThickness: 40 },
    dynamics: { cutVel: 30, cutAcc: 60, cutDec: 60, fastVel: 150, fastAcc: 300, zVel: 20, zAcc: 40, aVel: 30, aAcc: 60, bVel: 10, bAcc: 20 },
    cut: { x0: 200, y0: 300, x1: 1000, y1: 300, b: 0, depth: 30, passes: 3, above: 20 },
    start: { x: 0, y: 0, z: 0, a: 0, b: 0 },
  },
};
