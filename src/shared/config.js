import { SERVICE_SCREEN_VARS } from './servicescreens.js';
import { SERVICE_BITS } from './service.js';

// Zmienne PLC (symbol config, jak w HMI): klucz w aplikacji -> "GVL.zmienna".
// Wymagane sa pozycje osi i parametry tarczy / materialu, reszta opcjonalna.
export const VARIABLES = {
  // pozycje OSI (MCActualPosition*.Position, Settings/ActualPosition: fX/Y/ZRealPosition). Nie fX/Y/ZActualPosition -
  // to punkt narzedzia (os - przesuniecie glowicy wg A / B, Z + srednica tarczy / 2 ...), a wizualizacja liczy z osi
  x: 'HMI2.fXRealPosition',
  y: 'HMI2.fYRealPosition',
  z: 'HMI2.fZRealPosition',
  a: 'HMI2.fAActualPosition',       // MCActualPositionA.Position (os)
  // punkt narzedzia jak na ekranach HMI (POZYCJE OSI w sterowaniu recznym, predkosc): okno ruchow recznych
  toolX: 'HMI2.fXActualPosition',
  toolY: 'HMI2.fYActualPosition',
  toolZ: 'HMI2.fZActualPosition',
  b: 'HMI2.fBActualPosition',       // MCActualPositionB.Position albo enkoder (Encoders)
  // aktualne predkosci osi (Settings/VelocityAcceleration): MCActualVelocity*.Velocity * 60 / 1000 - X / Y / Z w m/min,
  // A w °/s * 0.06. fBActualVelocity w PLC liczona z osi A (blad) - predkosc B z roznicy pozycji
  xActVel: 'HMI2.fXActualVelocity',
  yActVel: 'HMI2.fYActualVelocity',
  zActVel: 'HMI2.fZActualVelocity',
  aActVel: 'HMI2.fAActualVelocity',
  discDiameter: 'HMI.fParameterDiscDiameter',
  bladeWidth: 'HMI.fParameterBladeWidth',
  cutTiltDiameter: 'HMI.fParameterCutTiltDiameter',
  headRotationDiameter: 'HMI.fParameterHeadRotationDiameter',
  materialHeight: 'HMI.fCutMaterialHeight',
  materialThickness: 'HMI.fParameterMaterialThickness',
  // narzedzia na wrzecionie (frez / wiertlo - fParameterMillWidth, polerka - ActiveTool.Height)
  millWidth: 'HMI.fParameterMillWidth',
  // CNC (#124): punkt poczatkowy programu G-kodu (CNCInfo: bSetG54_* -> HMI.G54_X / Y / Z)
  g54X: 'HMI.G54_X',
  g54Y: 'HMI.G54_Y',
  g54Z: 'HMI.G54_Z',
  millTiltDiameter: 'HMI.fParameterMillTiltDiameter',
  millLength: 'HMI.fParameterMillLength',
  drillLength: 'HMI.fParameterDrillLength',
  millCorrection: 'HMI.fParameterMillCorrection',
  polishHeight: 'ToolChangeGVL.ActiveTool.Height',
  // bazowanie (BaseHomingST) i tryb pracy
  systemBased: 'HMI2.bSystemBased',
  modeSaw: 'HMI2.bModeSaw',
  modeMill: 'HMI2.bModeMill',
  modeDrill: 'HMI2.bModeDrill',
  modePolishing: 'HMI2.bModePolishing',
  cutStep: 'HMI2.CutStep',
  cutStart: 'HMI2.bCutStart',
  sawRunning: 'Communication.bMainDriveRunning',
  waterCut: 'IOVars.yWaterCut',
  waterMill: 'IOVars.yWaterMill',
  // laser (wyjscie) i naped glowny tarczy: czestotliwosc (falownik, 0.01 Hz), kierunek
  laser: 'IOVars.yLaser',
  sawFreq: 'Communication.iMainDriveFreqAct',
  sawFwd: 'Communication.bMainDriveRunFWD',
  sawRev: 'Communication.bMainDriveRunREV',
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
  zVel: 'HMI.fVelocityAxisZWork',
  zUpVel: 'HMI.fVelocityAxisZApproach',
  aVel: 'HMI.VelA',
  bVel: 'HMI.VelB',
  // przyspieszenia osi jak VelocityAcceleration w PLC (AccX / AccZ / AccA / AccB sa w GVL bez symbol configu):
  //   AccX = fMaxVelocityJogX / fAutoTaccX, AccZ = fMaxVelocityJogZ / fAutoTaccZ, AccA = fMaxVelocityJogA / MAX(TaccA, 5),
  //   AccB = fMaxVelocityJogB / TaccB  (mm/s / s, °/s / s) - plcDynamics()
  maxJogX: 'HMI2.fMaxVelocityJogX',
  maxJogZ: 'HMI2.fMaxVelocityJogZ',
  maxJogA: 'HMI2.fMaxVelocityJogA',
  maxJogB: 'HMI2.fMaxVelocityJogB',
  autoTaccX: 'HMI.fAutoTaccX',
  autoTaccZ: 'HMI.fAutoTaccZ',
  taccA: 'HMI.TaccA',
  taccB: 'HMI.TaccB',
  // ekran Predkosc (#146, HMI predkosc): predkosc pracy frezu, silnik glowny [Hz], maksima (mm/s, Hz), pulpit z potencjometrami,
  // glebokosc ciecia (Status: fZActualPosition - fCutMaterialHeight), kat obrotu glowicy jak na ekranie HMI
  millVel: 'HMI.fVelocityMillMode',
  mainDriveHz: 'HMI.fVelocityMainDrive',
  maxMainDriveHz: 'HMI.fMaxVelocityMainDrive',
  maxFastVel: 'HMI2.fMaxVelocityFast',
  maxSawVel: 'HMI2.fMaxVelocitySawMode',
  maxMillVel: 'HMI2.fMaxVelocityMillMode',
  maxZUpVel: 'HMI2.fMaxVelocityAxisZApproach',
  maxZVel: 'HMI2.fMaxVelocityAxisZWork',
  advancedDesktop: 'HMI.bServiceAdvancedDesktop',
  cutDepth: 'HMI2.fStatusActualCutDepth',
  aFixed: 'HMI2.fAActualPositionFixed',
  // ruchy reczne (Manual): predkosci jog
  jogXVel: 'HMI.fJogXVelocity',
  jogYVel: 'HMI.fJogYVelocity',
  jogZVel: 'HMI.fJogZVelocity',
  jogAVel: 'HMI.fJogAVelocity',
  jogBVel: 'HMI.fJogBVelocity',
  // automat (ProgramAutoCutST / ProgramAutoProfileST): tablice programu [0..249], punkt startowy, licznik krokow
  progX: 'HMI2.aProgramXPosition',
  progY: 'HMI2.aProgramYPosition',
  progStep: 'HMI2.aProgramNextStep',
  progRadius: 'HMI2.aProgramRadius',
  progAngle: 'HMI2.aProgramAngle',
  progDepth: 'HMI2.aProgramDepth',
  progDepthEnd: 'HMI2.aProgramDepthEnd',
  progLength: 'HMI2.aProgramLength',
  progOutIn: 'HMI2.aProgramOutIn',
  progOriginX: 'HMI.fProgramStartPositionX',
  progOriginY: 'HMI.fProgramStartPositionY',
  progCutCount: 'HMI2.iProgramCutNumber',
  progProfCount: 'HMI2.iProgramProfilesNumber',
  progCutIndex: 'HMI2.iActualNumberOfProgramCuts',
  progProfIndex: 'HMI2.iActualNumberOfProgramProfiles',
  progMillCount: 'HMI2.iProgramMillNumber',
  progMillIndex: 'HMI2.iActualNumberOfProgramMills',
  progMillStart: 'HMI2.bProgramMillStart',
  progCutStart: 'HMI2.bProgramCutStart',
  progProfStart: 'HMI2.bProgramProfilesStart',
  progOuterInner: 'HMI.bServiceCutProgramOuterInner',
  profileJump: 'HMI.fProfileJump',
  smoothingJump: 'HMI.fSmoothingJump',
  smoothingArrays: 'HMI.bServiceSmoothingArrays',
  // sterowanie z panelu HMI w trybie PLC: STOP i PAUZA (stan przyciskow w gornym pasku)
  stopMachine: 'HMI.bStopMachine',
  pauseMachine: 'HMI2.bPauseMachine',
  // #155 alarmy jak w HMI: tablica bitow, alarm n = aAlarms[n - 1] (alarms.js)
  alarms: 'HMI2.aAlarms',
};

// Ekrany serwisowe (#147, servicescreens.js): zmienne, ktorych nie ma wyzej - klucz "hmi:GVL.zmienna"
for (const v of [...Object.keys(SERVICE_SCREEN_VARS), ...SERVICE_BITS.map((b) => `HMI.${b.k}`)]) {
  if (!Object.values(VARIABLES).includes(v)) VARIABLES[`hmi:${v}`] = v;
}
// klucz odczytu zmiennej PLC (sciezka GVL.zmienna) w wartosciach z serwera
export const plcKey = (v) => Object.keys(VARIABLES).find((k) => VARIABLES[k] === v) ?? null;

// Subskrypcje OPC UA (wymiana danych tylko przez subskrypcje, bez cyklicznego odczytu):
// SCREEN_KEYS - zmienne ekranu, subskrybowane tylko, gdy ekran / okno jest otwarte (strona zglasza je przy otwarciu,
// zamkniecie - koniec subskrypcji); ekran Serwis - zmienne otwartej strony serwisu (klucze "hmi:..."). Pozostale
// zmienne konfiguracji (BACKGROUND_KEYS: pozycje, tryb, narzedzie, stany, stol i kamien, alarmy, STOP / PAUZA,
// liczniki automatu) - subskrypcja w tle przez caly czas polaczenia.
export const SCREEN_KEYS = {
  speed: ['fastVel', 'cutVel', 'millVel', 'zUpVel', 'zVel', 'mainDriveHz', 'maxMainDriveHz', 'maxFastVel', 'maxSawVel', 'maxMillVel',
    'maxZUpVel', 'maxZVel', 'advancedDesktop'],
  auto: ['progX', 'progY', 'progStep', 'progRadius', 'progAngle', 'progDepth', 'progDepthEnd', 'progLength', 'progOutIn',
    'progOriginX', 'progOriginY', 'progOuterInner', 'profileJump', 'smoothingJump', 'smoothingArrays'],
  cnc: ['g54X', 'g54Y', 'g54Z'],
  // okno Ruchy reczne
  man: ['jogXVel', 'jogYVel', 'jogZVel', 'jogAVel', 'jogBVel'],
  // Parametry (offline): przycisk "Z PLC" - dynamika z PLC
  par: ['cutVel', 'cutAcc', 'cutDec', 'fastVel', 'zVel', 'zUpVel', 'aVel', 'bVel', 'jogXVel', 'jogYVel', 'jogZVel', 'jogAVel', 'jogBVel',
    'maxJogX', 'maxJogZ', 'maxJogA', 'maxJogB', 'autoTaccX', 'autoTaccZ', 'taccA', 'taccB'],
};
const screenOnly = new Set(Object.values(SCREEN_KEYS).flat());
export const BACKGROUND_KEYS = Object.keys(VARIABLES).filter((k) => !k.startsWith('hmi:') && !screenOnly.has(k));

export const REQUIRED = ['x', 'y', 'z', 'a', 'b', 'discDiameter', 'materialHeight'];

export const MACHINE_KEYS = ['discDiameter', 'bladeWidth', 'cutTiltDiameter', 'headRotationDiameter', 'materialHeight', 'materialThickness',
  'millWidth', 'millTiltDiameter', 'millLength', 'drillLength', 'millCorrection', 'polishHeight'];
export const DYNAMICS_KEYS = ['cutVel', 'cutAcc', 'cutDec', 'fastVel', 'fastAcc', 'zVel', 'zAcc', 'zUpVel', 'aVel', 'aAcc', 'bVel', 'bAcc',
  'jogXVel', 'jogYVel', 'jogZVel', 'jogAVel', 'jogBVel'];

// Jednostki dynamiki: w PLC i w obliczeniach mm/s, mm/s2 (deg/s, deg/s2), na ekranie i w config.json
// predkosci liniowe w m/min, przyspieszenia w m/s2 (osie obrotowe bez zmian)
const DISPLAY_FACTOR = { vel: 1000 / 60, acc: 1000, rot: 1 };
const DYNAMICS_UNITS = {
  cutVel: 'vel', cutAcc: 'acc', cutDec: 'acc', fastVel: 'vel', fastAcc: 'acc', zVel: 'vel', zAcc: 'acc', zUpVel: 'vel',
  aVel: 'rot', aAcc: 'rot', bVel: 'rot', bAcc: 'rot',
  jogXVel: 'vel', jogYVel: 'vel', jogZVel: 'vel', jogAVel: 'rot', jogBVel: 'rot',
};

// ekran (m/min, m/s2) -> obliczenia (mm/s, mm/s2); tylko klucze obecne w d
export function dynamicsToInternal(d) {
  return Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v * (DISPLAY_FACTOR[DYNAMICS_UNITS[k]] ?? 1)]));
}

// Dynamika z wartosci PLC (mm/s, mm/s2, °/s, °/s2): predkosci wprost, przyspieszenia X / Z / A / B wzorami PLC
// (VelocityAcceleration); tylko pozycje obecne w odczycie
export function plcDynamics(v) {
  const num = (k) => (typeof v[k] === 'number' && Number.isFinite(v[k]) ? v[k] : null);
  const out = {};
  for (const k of DYNAMICS_KEYS) if (num(k) !== null) out[k] = num(k);
  const ratio = (a, b) => (num(a) !== null && num(b) > 0 ? num(a) / num(b) : null);
  const acc = {
    fastAcc: ratio('maxJogX', 'autoTaccX'),
    zAcc: ratio('maxJogZ', 'autoTaccZ'),
    aAcc: num('maxJogA') !== null && num('taccA') !== null ? num('maxJogA') / Math.max(num('taccA'), 5) : null,
    bAcc: ratio('maxJogB', 'taccB'),
  };
  for (const [k, x] of Object.entries(acc)) if (x !== null && x > 0) out[k] = x;
  return out;
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

// Adres serwera OPC UA (#148): opc.tcp://host[:port][/sciezka]
export const validEndpoint = (s) => typeof s === 'string' && s.length <= 200 && /^opc\.tcp:\/\/[A-Za-z0-9.-]+(:\d{1,5})?(\/[\w./-]*)?$/.test(s);

export const DEFAULTS = {
  httpPort: 8128,                       // strona: http://localhost:8128
  httpHost: '127.0.0.1',                // 127.0.0.1 - tylko ten komputer (maszyna); 0.0.0.0 - tez tablet w sieci (#148)
  endpoint: 'opc.tcp://localhost:4840', // serwer OPC UA sterownika (CODESYS)
  username: '',
  password: '',
  nodePrefix: '',                       // np. "ns=4;s=|var|AX-8.Application." - puste = szukanie w drzewie
  pollMs: 50,                           // subskrypcje OPC UA: interwal publikacji i probkowania (CODESYS zwykle min. 100 ms)
  variables: {},                        // nadpisanie VARIABLES
  autoClearOnStart: true,               // nowe ciecie (bCutStart) czysci poprzednie
  materialMargin: 300,
  materialMinSize: [1200, 800],
  // logowanie (#145): wylogowanie po bezczynnosci [min] (0 - bez limitu); uzytkownicy w users.json (scripts/users.mjs)
  auth: { timeoutMin: 30 },
  // model maszyny (pila mostowa) w widoku - wg punktow stolu, niezalezny od kamienia: most wzdluz osi
  // bridgeAlong ('x' - most jedzie w Y), sciany margin mm od stolu z kazdej strony (#153: 300), spod mostu bridgeZ mm nad Z = 0,
  // dlugosc slupa Z, wysokosc stolu (do podlogi); panel - panel operatorski przed prawym murkiem (#141)
  frame: { show: true, bridgeAlong: 'x', margin: 300, bridgeZ: 300, ramLength: 1400, tableHeight: 700, panel: true },
  // plyta stolu pod kamieniem [mm] - ciecie w stol rysowane na czerwono do tej glebokosci
  tableThickness: 80,
  // laser: linia na powierzchni wzdluz kierunku ciecia; side 1 - w prawa strone (+kierunek ciecia przy A), -1 - w lewa;
  // mountAngle - modul lasera na oslonie tarczy: kat od gory w strone lasera [deg] (#141)
  laser: { side: 1, length: 2500, mountAngle: 40 },     // 40 st. - na gornej krawedzi oslony przy narozniku (zdjecie #141)
  // naped tarczy: czestotliwosc z PLC * freqScale = Hz; obroty na ekranie umowne - visualRps obr/s przy 50 Hz;
  // toolVisualRps - to samo dla frezu / wiertla / polerki (#136); fwdSign - kierunek obrotu dla FWD wzgledem osi wrzeciona
  // (-1: strona -u tarczy schodzi w material - tam celuja dysze wody, jak na zdjeciu w #141)
  saw: { freqScale: 0.01, visualRps: 1.5, toolVisualRps: 3, fwdSign: -1 },
  // tryb offline: wartosci poczatkowe formularzy (mm; m/min, m/s2; deg/s, deg/s2)
  offline: {
    machine: {
      discDiameter: 625, bladeWidth: 4, cutTiltDiameter: 200, headRotationDiameter: 100, materialHeight: 450, materialThickness: 40,
      // narzedzia: MillTiltDiameter ~ CutTiltDiameter - HeadRotationDiameter (ta sama os wychylu co przy tarczy)
      millWidth: 50, millTiltDiameter: 100, millLength: 250, drillLength: 250, millCorrection: 0, polishDiameter: 120, polishHeight: -60,
    },
    // tryb po bazowaniu na starcie (saw | mill | drill | polishing) - ekran Bazowanie
    mode: 'saw',
    // ekran Predkosc (#146): maksima jak HMI2.fMaxVelocityFast / SawMode / MillMode / AxisZApproach / AxisZWork [m/min]
    // i HMI.fMaxVelocityMainDrive [Hz] - w PLC liczone z przekladni osi (VelocityAcceleration)
    speedMax: { fast: 20, saw: 10, mill: 2, zUp: 3, zWork: 3, mainDrive: 200 },
    // stol i kamien: punkty XYZ jak aCuttingBoard / aCuttingRock (pozycje osi), count = liczba wierzcholkow;
    // gora materialu offline jak w PLC: Z min punktow stolu - grubosc
    board: { count: 4, points: [[0, 0, 490], [3500, 0, 490], [3500, 3000, 490], [0, 3000, 490]] },
    rock: { count: 4, points: [[300, 200, 450], [2800, 200, 450], [2800, 1800, 450], [300, 1800, 450]] },
    dynamics: {
      cutVel: 1.8, cutAcc: 0.06, cutDec: 0.06, fastVel: 9, fastAcc: 0.3, zVel: 1.2, zAcc: 0.04, zUpVel: 1.2, aVel: 30, aAcc: 60, bVel: 10, bAcc: 20,
      jogXVel: 6, jogYVel: 6, jogZVel: 1.2, jogAVel: 20, jogBVel: 10,
    },
    // naped tarczy offline (ekran Reczne): czestotliwosc [Hz], kierunek FWD / REV
    saw: { freq: 50, dir: 'FWD' },
    cut: { x0: 200, y0: 300, x1: 1000, y1: 300, b: 0, depth: 30, passes: 3, above: 20 },
    start: { x: 0, y: 0, z: 0, a: 0, b: 0 },
  },
};
