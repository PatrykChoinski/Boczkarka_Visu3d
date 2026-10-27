// Konfiguracja wspolna (serwer, strona, testy): zmienne PLC boczkarki, kroki automatu, wartosci domyslne.

// Zmienne PLC (GVL dziedzin z PLC/src, symbol config): klucz w aplikacji -> "GVL.zmienna" / "GVL.struktura.pole".
export const VARIABLES = {
  // osie (Axes): X [mm], B [deg]
  x: 'Axes.StatusX.Position',
  b: 'Axes.StatusB.Position',
  xVelocity: 'Axes.StatusX.Velocity',
  xHomed: 'Axes.StatusX.Homed',
  bHomed: 'Axes.StatusB.Homed',
  // maszyna
  mode: 'Machine.Mode',
  simulation: 'Machine.Simulation',
  safetyOk: 'Machine.SafetyOk',
  // automat (EdgeProfile)
  step: 'EdgeProfile.CurrentStep',
  passIndex: 'EdgeProfile.PassIndex',
  repeatIndex: 'EdgeProfile.RepeatIndex',
  passCount: 'EdgeProfile.PassCount',
  passAngle: 'EdgeProfile.PassAngle',
  directionPositive: 'EdgeProfile.DirectionPositive',
  passTarget: 'EdgeProfile.PassTarget',
  // receptura cyklu (kopia w EdgeProfile) - lista przejsc liczona na stronie tym samym algorytmem co PLC
  cycleName: 'EdgeProfile.CycleProfile.Name',
  cycleKind: 'EdgeProfile.CycleProfile.Kind',
  cycleXStart: 'EdgeProfile.CycleProfile.XStart',
  cycleXEnd: 'EdgeProfile.CycleProfile.XEnd',
  cycleOvertravel: 'EdgeProfile.CycleProfile.Overtravel',
  cycleAngle: 'EdgeProfile.CycleProfile.Angle',
  cycleAngleStart: 'EdgeProfile.CycleProfile.AngleStart',
  cycleAngleEnd: 'EdgeProfile.CycleProfile.AngleEnd',
  cycleAngleStep: 'EdgeProfile.CycleProfile.AngleStep',
  cycleRepeats: 'EdgeProfile.CycleProfile.Repeats',
  cycleBothDirections: 'EdgeProfile.CycleProfile.BothDirections',
  // receptura robocza (poza cyklem: podglad pola i profilu)
  activeName: 'RecipeStore.Active.Name',
  activeKind: 'RecipeStore.Active.Kind',
  activeXStart: 'RecipeStore.Active.XStart',
  activeXEnd: 'RecipeStore.Active.XEnd',
  activeOvertravel: 'RecipeStore.Active.Overtravel',
  activeAngle: 'RecipeStore.Active.Angle',
  activeAngleStart: 'RecipeStore.Active.AngleStart',
  activeAngleEnd: 'RecipeStore.Active.AngleEnd',
  activeAngleStep: 'RecipeStore.Active.AngleStep',
  activeRepeats: 'RecipeStore.Active.Repeats',
  // wrzeciono, media
  spindleRunning: 'Spindle.Status.Running',
  spindleFrequency: 'Spindle.Status.FrequencyActual',
  spindleCurrent: 'Spindle.Status.Current',
  water: 'Io.Outputs.Water',
  clamp: 'Io.Outputs.Clamp',
  // alarmy, czasy, liczniki
  alarms: 'Alarms.Active',
  alarmAny: 'Alarms.AnyActive',
  timeRemaining: 'Times.TimeRemaining',
  cycleTimeEstimate: 'Times.CycleTimeEstimate',
  progress: 'Times.Progress',
  metersTotal: 'MachineCounters.MetersTotal',
  cycles: 'MachineCounters.Cycles',
};

// Bez tych zmiennych polaczenie z PLC nie ma sensu (pozycje osi)
export const REQUIRED = ['x', 'b'];
// Wszystkie zmienne konfiguracji sa subskrybowane przez caly czas polaczenia
export const BACKGROUND_KEYS = Object.keys(VARIABLES);

// Sterowanie z Visu3D w trybie online: zmienne do zapisu i wymagany poziom (0 - zawsze, 1 - Operator, 2 - Serwis).
// kind: 'set' - zapis wartosci, 'mom' - przycisk chwilowy (POST /api/plc/hold, serwer zdejmuje po HOLD_MS).
export const PLC_WRITES = {
  'EdgeProfile.Start': { level: 1, kind: 'set' },
  'EdgeProfile.Stop': { level: 0, kind: 'set' },
  'EdgeProfile.Pause': { level: 0, kind: 'set' },
  'Alarms.Reset': { level: 1, kind: 'set' },
  'Machine.ModeRequest': { level: 1, kind: 'set' },
  'HomingProcess.Start': { level: 1, kind: 'set' },
  'Recipes.Index': { level: 1, kind: 'set' },
  'Recipes.Load': { level: 1, kind: 'set' },
  'Manual.JogXPositive': { level: 1, kind: 'mom' },
  'Manual.JogXNegative': { level: 1, kind: 'mom' },
  'Manual.JogBPositive': { level: 1, kind: 'mom' },
  'Manual.JogBNegative': { level: 1, kind: 'mom' },
  'Manual.JogFast': { level: 1, kind: 'set' },
};

// Kroki automatu (EdgeStep w PLC) - numer -> [nazwa, opis]
export const EDGE_STEPS = {
  0: ['WaitForStart', 'Gotowy - czeka na START'],
  10: ['CheckParams', 'Sprawdzanie receptury'],
  20: ['SpindleStart', 'Rozruch wrzeciona'],
  30: ['MoveToStart', 'Dojazd na start'],
  40: ['MoveBAngle', 'Zmiana kąta B'],
  45: ['ClampOn', 'Docisk'],
  50: ['PassX', 'Przejazd roboczy'],
  60: ['NextPass', 'Następne przejście'],
  65: ['ReturnX', 'Powrót (jeden kierunek)'],
  70: ['AutoReturn', 'Autopowrót B'],
  75: ['AutoReturnX', 'Autopowrót X'],
  80: ['SpindleStop', 'Zatrzymanie wrzeciona'],
  85: ['EndProcedure', 'Koniec cyklu'],
  90: ['Pause', 'PAUZA'],
  99: ['WaitForCommand', 'Zatrzymany - skasuj alarmy'],
};
export const STEP = Object.fromEntries(Object.entries(EDGE_STEPS).map(([n, [name]]) => [name, Number(n)]));
export const MODES = { 0: 'Ręczny', 1: 'Bazowanie', 2: 'Automat' };

export const validEndpoint = (s) => typeof s === 'string' && s.length <= 200 && /^opc\.tcp:\/\/[A-Za-z0-9.-]+(:\d{1,5})?(\/[\w./-]*)?$/.test(s);
// Adres OPC UA z adresu IP (pole na stronie): "192.168.1.10" -> opc.tcp://192.168.1.10:4840
export function endpointFromHost(host, port = 4840) {
  const h = String(host || '').trim();
  if (h.startsWith('opc.tcp://')) return h;
  return h.includes(':') ? `opc.tcp://${h}` : `opc.tcp://${h}:${port}`;
}

export const DEFAULTS = {
  httpPort: 8128,
  httpHost: '127.0.0.1',
  endpoint: 'opc.tcp://localhost:4840',
  username: '',
  password: '',
  nodePrefix: '',
  pollMs: 50,
  variables: {},
  auth: { timeoutMin: 30 },
  // Geometria maszyny do modelu 3D [mm] (B1PK-14.0-2000.2: glowica na ramieniu wychylnym, przejazd wzdluz stolu)
  machine: {
    travelX: [-50, 2350],		// zakres osi X (softlimity)
    tableLength: 2600,
    tableWidth: 1100,
    tableHeight: 820,
    stoneThickness: 30,
    stoneWidth: 650,			// glebokosc plyty (od krawedzi w glab stolu)
    stoneOverhang: 70,			// wysiegniecie krawedzi poza stol (dostep od dolu)
    wheelDiameter: 130,			// tarcza garnkowa
    wheelHeight: 40,
    motorDiameter: 170,
    motorLength: 330,
    railHeight: 1450,			// os belki nad posadzka
  },
  // Wielkosc profilu na rysunku (w PLC glebokosc ustala mechanika / docisk) [mm]
  shape: { quarterRadius: 20, chamferSize: 8, straightDepth: 1 },
  // Tryb offline: dynamika jak parametry PLC (AxesConfig / SpindleConfig / EdgeProfileConfig)
  offline: {
    xMaxVelocity: 400, xAcceleration: 1500, returnVelocity: 300,
    bVelocity: 45, bAcceleration: 360,
    clampDelay: 1.0, spindleRamp: 25, waterOffDelay: 3,
    loadPositionX: 0, parkAngleB: 0, autoReturn: true,
  },
};
