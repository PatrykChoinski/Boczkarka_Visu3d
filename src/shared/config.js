// Konfiguracja wspolna (serwer, strona, testy): zmienne PLC boczkarki, kroki automatu, wartosci domyslne.

// Zmienne PLC (GVL dziedzin z PLC/src, symbol config): klucz w aplikacji -> "GVL.zmienna" / "GVL.struktura.pole".
export const VARIABLES = {
  // osie (Axes): X [mm], B [deg]
  x: 'Axes.StatusX.Position',
  b: 'Axes.StatusB.Position',
  xVelocity: 'Axes.StatusX.Velocity',
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
  activeSpindleFrequency: 'RecipeStore.Active.SpindleFrequency',
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
  'Recipes.Index': { level: 1, kind: 'set' },
  'Recipes.Load': { level: 1, kind: 'set' },
  'Manual.JogXPositive': { level: 1, kind: 'mom' },
  'Manual.JogXNegative': { level: 1, kind: 'mom' },
  'Manual.JogBPositive': { level: 1, kind: 'mom' },
  'Manual.JogBNegative': { level: 1, kind: 'mom' },
  'Manual.JogFast': { level: 1, kind: 'set' },
  'Manual.GotoX': { level: 1, kind: 'set' },
  'Manual.GotoXTarget': { level: 1, kind: 'set', type: 'lreal', min: -100, max: 3500 },
  'Manual.GotoB': { level: 1, kind: 'set' },
  'Manual.GotoBTarget': { level: 1, kind: 'set', type: 'lreal', min: -95, max: 95 },
  'Manual.SpindleToggle': { level: 1, kind: 'set' },
  'Manual.SpindleFrequency': { level: 1, kind: 'set', type: 'real', min: 0, max: 120 },
  // obroty aktywnej receptury - PLC bierze je na biezaco, takze w trakcie cyklu
  'RecipeStore.Active.SpindleFrequency': { level: 1, kind: 'set', type: 'real', min: 0, max: 120 },
  'Manual.WaterToggle': { level: 1, kind: 'set' },
  'Manual.ClampToggle': { level: 1, kind: 'set' },
};

// Poziomy dostepu (auth.js): 0 - bez logowania (podglad, STOP / PAUZA), 1 - Operator, 2 - Serwis, 3 - Admin
export const LEVEL_NAMES = { 0: 'Podgląd', 1: 'Operator', 2: 'Serwis', 3: 'Admin' };

// Ustawienia serwisowe (karta Serwis, poziom 2): parametry trwale PLC z zakresem. type: lreal / real / int - liczba,
// time - TIME (w PLC ms, na stronie s), bool, enum (options). sim - odpowiednik w symulatorze offline (EdgeSimulator.o;
// 'limits.xMin' - pole limits), bez sim - parametr tylko online.
const sp = (v, label, unit, type, min, max, sim, options) => ({ v, label, unit, type, min, max, sim, options });
export const SERVICE_PARAMS = [
  { group: 'Oś X', items: [
    sp('AxesConfig.ParamsX.SoftLimits', 'Softlimity', '', 'bool'),
    sp('AxesConfig.ParamsX.SoftLimitNegative', 'Softlimit −', 'mm', 'lreal', -500, 3500, 'limits.xMin'),
    sp('AxesConfig.ParamsX.SoftLimitPositive', 'Softlimit +', 'mm', 'lreal', -500, 3500, 'limits.xMax'),
    sp('AxesConfig.ParamsX.MaxVelocity', 'Prędkość max', 'mm/s', 'lreal', 1, 1000, 'xMaxVelocity'),
    sp('AxesConfig.ParamsX.MaxAcceleration', 'Przyspieszenie', 'mm/s²', 'lreal', 10, 10000, 'xAcceleration'),
    sp('AxesConfig.ParamsX.StopDeceleration', 'Hamowanie STOP', 'mm/s²', 'lreal', 10, 20000),
    sp('AxesConfig.ParamsX.MaxJerk', 'Jerk', 'mm/s³', 'lreal', 100, 1000000),
    sp('AxesConfig.JogSlowX', 'Jog wolno', 'mm/s', 'lreal', 1, 200, 'jogSlowX'),
    sp('AxesConfig.JogFastX', 'Jog szybko', 'mm/s', 'lreal', 1, 600, 'jogFastX'),
    sp('AxesConfig.ReturnVelocityX', 'Dojazdy i powrót', 'mm/s', 'lreal', 1, 1000, 'returnVelocity'),
    sp('AxesConfig.LoadPositionX', 'Pozycja załadunku', 'mm', 'lreal', -500, 3500, 'loadPositionX'),
  ] },
  { group: 'Oś B', items: [
    sp('AxesConfig.ParamsB.SoftLimits', 'Softlimity', '', 'bool'),
    sp('AxesConfig.ParamsB.SoftLimitNegative', 'Softlimit −', '°', 'lreal', -120, 120, 'limits.bMin'),
    sp('AxesConfig.ParamsB.SoftLimitPositive', 'Softlimit +', '°', 'lreal', -120, 120, 'limits.bMax'),
    sp('AxesConfig.ParamsB.MaxVelocity', 'Prędkość max', '°/s', 'lreal', 1, 360),
    sp('AxesConfig.ParamsB.MaxAcceleration', 'Przyspieszenie', '°/s²', 'lreal', 1, 5000, 'bAcceleration'),
    sp('AxesConfig.ParamsB.StopDeceleration', 'Hamowanie STOP', '°/s²', 'lreal', 1, 10000),
    sp('AxesConfig.ParamsB.MaxJerk', 'Jerk', '°/s³', 'lreal', 10, 100000),
    sp('AxesConfig.VelocityB', 'Zmiana kąta', '°/s', 'lreal', 1, 360, 'bVelocity'),
    sp('AxesConfig.JogSlowB', 'Jog wolno', '°/s', 'lreal', 0.1, 60, 'jogSlowB'),
    sp('AxesConfig.JogFastB', 'Jog szybko', '°/s', 'lreal', 0.1, 180, 'jogFastB'),
    sp('AxesConfig.ParkAngleB', 'Kąt po autopowrocie', '°', 'lreal', -95, 95, 'parkAngleB'),
  ] },
  { group: 'Wrzeciono (MS300)', items: [
    sp('SpindleConfig.Poles', 'Liczba biegunów', '', 'int', 2, 12),
    sp('SpindleConfig.MinFrequency', 'Częstotliwość min', 'Hz', 'real', 0, 120),
    sp('SpindleConfig.MaxFrequency', 'Częstotliwość max', 'Hz', 'real', 1, 120),
    sp('SpindleConfig.AtSpeedTolerance', 'Tolerancja obrotów', '%', 'real', 0.5, 20),
    sp('SpindleConfig.StartTimeout', 'Czas rozruchu max', 's', 'time', 1, 120),
    sp('SpindleConfig.RampHzPerSecond', 'Rampa (symulacja)', 'Hz/s', 'real', 1, 200, 'spindleRamp'),
    sp('SpindleConfig.CurrentScale', 'Skala prądu', 'A/j', 'real', 0.001, 10),
    sp('SpindleConfig.RatedCurrent', 'Prąd znamionowy', 'A', 'real', 1, 200),
    sp('SpindleConfig.OverloadCurrent', 'Prąd przeciążenia', 'A', 'real', 1, 250),
    sp('SpindleConfig.OverloadTime', 'Czas przeciążenia', 's', 'time', 0.1, 60),
  ] },
  { group: 'Automat', items: [
    sp('EdgeProfileConfig.ClampDelay', 'Ustalenie docisku', 's', 'time', 0, 10, 'clampDelay'),
    sp('EdgeProfileConfig.WaterOffDelay', 'Woda po zatrzymaniu', 's', 'time', 0, 60, 'waterOffDelay'),
    sp('EdgeProfileConfig.AutoReturn', 'Autopowrót', '', 'bool', undefined, undefined, 'autoReturn'),
    sp('EdgeProfileConfig.FeedMin', 'Posuw min', 'm/min', 'lreal', 0.01, 20),
    sp('EdgeProfileConfig.FeedMax', 'Posuw max', 'm/min', 'lreal', 0.01, 20),
  ] },
  { group: 'Maszyna', items: [
    sp('MachineConfig.GuardInstalled', 'Osłona z czujnikiem', '', 'bool'),
    sp('MachineConfig.WaterSensorInstalled', 'Czujnik wody', '', 'bool'),
    sp('MachineConfig.AirSensorInstalled', 'Czujnik powietrza', '', 'bool'),
    sp('MachineConfig.OverridePotInstalled', 'Potencjometr posuwu', '', 'bool'),
    sp('MachineConfig.OverrideAnalogMax', 'AI dla 10 V', '', 'int', 1000, 32767),
    sp('MachineConfig.OverrideMaxPercent', 'Posuw max z potencjometru', '%', 'real', 100, 200),
    sp('MachineConfig.Simulation', 'Symulacja (po restarcie PLC)', '', 'bool'),
  ] },
];
export const SERVICE_ITEMS = SERVICE_PARAMS.flatMap((g) => g.items);
for (const it of SERVICE_ITEMS) PLC_WRITES[it.v] = { level: 2, kind: 'set', param: true, type: it.type, min: it.min, max: it.max };

// Wartosc parametru ze strony: null - poprawna, tekst - blad (typ / zakres); time w s
export function checkParam(w, value) {
  if (!w?.type) return null;
  if (w.type === 'bool') return typeof value === 'boolean' ? null : 'oczekiwano TAK / NIE';
  const n = Number(value);
  if (value === '' || value === null || typeof value === 'boolean' || !Number.isFinite(n)) return 'oczekiwano liczby';
  if ((w.type === 'int' || w.type === 'enum') && !Number.isInteger(n)) return 'oczekiwano liczby całkowitej';
  if (w.min !== undefined && n < w.min) return `poniżej ${w.min}`;
  if (w.max !== undefined && n > w.max) return `powyżej ${w.max}`;
  return null;
}
// Strona <-> PLC: TIME w PLC w ms
export const toPlc = (w, value) => (w?.type === 'time' ? Math.round(Number(value) * 1000) : w?.type === 'bool' ? Boolean(value) : Number(value));
export const fromPlc = (w, value) => (w?.type === 'time' ? Number(value) / 1000 : value);

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
// MachineMode w PLC (bez bazowania - enkodery absolutne)
export const MODES = { 0: 'Ręczny', 1: 'Automat' };

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
    tableLength: 3000,
    tableWidth: 900,
    tableHeight: 820,
    stoneThickness: 30,
    stoneWidth: 650,			// glebokosc plyty (od krawedzi w glab stolu)
    stoneOverhang: 150,			// wysiegniecie krawedzi poza stol (tarcza z oslona pod krawedzia przy B = -90)
    wheelDiameter: 220,			// tarcza w oslonie
    wheelHeight: 40,
    motorDiameter: 170,
    motorLength: 330,
    railHeight: 1400,			// os belki nad posadzka
  },
  // Wielkosc profilu na rysunku (w PLC glebokosc ustala mechanika / docisk) [mm]
  shape: { quarterRadius: 20, chamferSize: 8, straightDepth: 1 },
  // Tryb offline: dynamika jak parametry PLC (AxesConfig / SpindleConfig / EdgeProfileConfig)
  offline: {
    xMaxVelocity: 400, xAcceleration: 1500, returnVelocity: 300,
    bVelocity: 45, bAcceleration: 360,
    clampDelay: 1.0, spindleRamp: 25, waterOffDelay: 3,
    loadPositionX: 0, parkAngleB: 0, autoReturn: true,
    jogSlowX: 20, jogFastX: 150, jogSlowB: 5, jogFastB: 30,
  },
};
