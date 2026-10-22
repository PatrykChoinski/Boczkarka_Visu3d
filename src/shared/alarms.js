// Alarmy (#155) - przepisane z projektu HMI (PilaJednosuportowaINNER.dpa, sekcja [Alarm]: HMI/scripts/dpa.py alarms):
// n - numer alarmu w HMI, v - bit PLC (HMI2.bAlarm...), pl / en - tekst jak w HMI (jezyk 0 / 1), off - alarm wylaczony
// w HMI (AlarmEnable = 0). Online bity czytane przez OPC UA (zmienne opcjonalne 'alarm:...' w config.js - moga nie byc
// w konfiguracji symboli PLC), offline symulacja zglasza alarmy, ktore sama wykrywa (SIM_ALARMS).

export const ALARMS = [
  {
   "n": 1,
   "v": "HMI2.bAlarmAxisXError",
   "pl": "Błąd osi X",
   "en": "X axis error"
  },
  {
   "n": 2,
   "v": "HMI2.bAlarmAxisYError",
   "pl": "Błąd osi Y",
   "en": "Y axis error"
  },
  {
   "n": 3,
   "v": "HMI2.bAlarmAxisZError",
   "pl": "Błąd osi Z",
   "en": "Z axis error"
  },
  {
   "n": 4,
   "v": "HMI2.bAlarmAxisAError",
   "pl": "Błąd osi obrotu",
   "en": "Rotation axis error"
  },
  {
   "n": 5,
   "v": "HMI2.bAlarmAxisXHWLimitLeft",
   "pl": "Krańcówka osi X Lewo",
   "en": "X axis limit switch Left"
  },
  {
   "n": 6,
   "v": "HMI2.bAlarmAxisYHWLimitFront",
   "pl": "Krańcówka osi Y Przod",
   "en": "Y axis limit switch Front"
  },
  {
   "n": 7,
   "v": "HMI2.bAlarmAxisZHWLimitTop",
   "pl": "Krańcówka osi Z Gora",
   "en": "Z axis limit switch Top"
  },
  {
   "n": 8,
   "v": "HMI2.bAlarmAirPressure",
   "pl": "Błąd Cisnienie powietrza",
   "en": "Air pressure error"
  },
  {
   "n": 9,
   "v": "HMI2.bAlarmWaterCutPressure",
   "pl": "Błąd Cisnienie wody ciecie",
   "en": "Cutting water pressure error"
  },
  {
   "n": 10,
   "v": "HMI2.bAlarmAxisBError",
   "pl": "Awaria osi wychyłu",
   "en": "Tilt axis failure"
  },
  {
   "n": 11,
   "v": "HMI2.bAlarmGreaseError",
   "pl": "Awaria centralnego smarowania",
   "en": "Central lubrication failure"
  },
  {
   "n": 12,
   "v": "HMI2.bAlarmSaw",
   "pl": "Awaria osi piły",
   "en": "Saw axis failure"
  },
  {
   "n": 13,
   "v": "HMI2.bAlarmWaterMillPressure",
   "pl": "Cisnienie wody frezowanie",
   "en": "Water pressure Mill"
  },
  {
   "n": 14,
   "v": "HMI2.bAlarmAxisAHWLimit",
   "pl": "Oś Obrotowa maksymalna pozycja",
   "en": "Rotary axis maximum position"
  },
  {
   "n": 15,
   "v": "HMI2.bAlarmThermalMainDrive",
   "pl": "Zabezpieczenie Termiczne Napedu Głownego",
   "en": "Main Drive Thermal Protection"
  },
  {
   "n": 16,
   "v": "HMI2.bAlarmEmergencyStop",
   "pl": "Stop awaryjny",
   "en": "Emergency stop"
  },
  {
   "n": 17,
   "v": "HMI2.bAlarmAxisXHWLimitRight",
   "pl": "Krańcówka osi X Prawo",
   "en": "X-axis limit switch Right"
  },
  {
   "n": 18,
   "v": "HMI2.bAlarmAxisYHWLimitBack",
   "pl": "Krańcówka osi Y Tyl",
   "en": "Y axis limit switch Rear"
  },
  {
   "n": 19,
   "v": "HMI2.bAlarmAxisZHWLimitBottom",
   "pl": "Krańcówka osi Z Dol",
   "en": "Lower Z axis end"
  },
  {
   "n": 20,
   "v": "HMI2.bAlarmStopMachine",
   "pl": "Zatrzymanie Maszyny",
   "en": "Stopping the Machine"
  },
  {
   "n": 21,
   "v": "HMI2.bAlarmNotBasedMachine",
   "pl": "Maszyna nie zbazowana",
   "en": "The machine is not databased"
  },
  {
   "n": 22,
   "v": "HMI2.bAlarmInterpolationError",
   "pl": "Błąd ruchu w interpolacji",
   "en": "Motion error in interpolation"
  },
  {
   "n": 23,
   "v": "HMI2.bAlarmCutPositionNotANumber",
   "pl": "Pozycja ciecia wynosi nieskonczonosc",
   "en": "The cutting position is infinity"
  },
  {
   "n": 24,
   "v": "HMI2.bAlarmActive",
   "pl": "Aktywny Alarm",
   "en": "Active Alarm"
  },
  {
   "n": 25,
   "v": "HMI2.bAlarmProgramNotClosedShape",
   "pl": "Obiekt do frezowania nie jest zamkniety",
   "en": "The Mill object is not closed"
  },
  {
   "n": 26,
   "v": "HMI2.bAlarmMillDepthNotReached",
   "pl": "Zaglebianie frezu pozycja nie osiagnieta",
   "en": "Plunge mill position not reached"
  },
  {
   "n": 27,
   "v": "HMI2.bAlarmCutDepthTable",
   "pl": "Żle zdefiniowana glebokosc ciecia",
   "en": "Incorrectly defined cutting depth"
  },
  {
   "n": 28,
   "v": "HMI2.bAlarmMillDepthTable",
   "pl": "Żle zdefiniowana glebokosc frezu",
   "en": "Incorrectly defined mill depth"
  },
  {
   "n": 29,
   "v": "HMI2.bAlarmCutInternalImpossible",
   "pl": "Nie można wykonać cięcia wewnętrznego",
   "en": "Internal cut cannot be made"
  },
  {
   "n": 30,
   "v": "HMI2.bAlarmIndexOutOfBounds",
   "pl": "Index tabeli poza zakresem",
   "en": "Table index out of range"
  },
  {
   "n": 31,
   "v": "HMI2.bAlarmAngleNotInRange",
   "pl": "Kąt dla przejazdu ręcznego musi byc miedzy 0 a 90st",
   "en": "Manual move angle\r\n0-90 deg"
  },
  {
   "n": 32,
   "v": "HMI2.bAlarmInterpolationGroupEnableError",
   "pl": "Nie mozna wejsc do grupy interpolacji",
   "en": "Unable to enter the interpolation group"
  },
  {
   "n": 33,
   "v": "HMI2.bAlarmAxisBAutoTuiningError",
   "pl": "Błąd autotuningu falownika wychyłu (B)",
   "en": "Tilt inverter auto tuning error (B)"
  },
  {
   "n": 34,
   "v": "HMI2.bAlarmMeasureToolReferenceZero",
   "pl": "Zerowa wartość drogi referencyjnej",
   "en": "Zero reference path value"
  },
  {
   "n": 35,
   "v": "HMI2.bAlarmMeasureToolReferenceDiameterZero",
   "pl": "Zerowa wartość średnicy dysku",
   "en": "Zero disk diameter value"
  },
  {
   "n": 36,
   "v": "HMI2.bAlarmErrorWhenChaningAxisParameters",
   "pl": "Błąd w trakcie skalowania osi",
   "en": "Error while scaling axis"
  },
  {
   "n": 38,
   "v": null,
   "pl": "",
   "en": "CollisionWithMaterial",
   "off": true
  },
  {
   "n": 39,
   "v": null,
   "pl": "",
   "en": "CollisionWithBoard",
   "off": true
  },
  {
   "n": 40,
   "v": "HMI2.bAlarmXNoHoming",
   "pl": "Os X Niezbazowana Absolutnie",
   "en": "Os X Unbased Absolutely"
  },
  {
   "n": 41,
   "v": "HMI2.bAlarmYNoHoming",
   "pl": "Os Y Niezbazowana Absolutnie",
   "en": "Y Axis Unbased Absolutely"
  },
  {
   "n": 42,
   "v": "HMI2.bAlarmZNoHoming",
   "pl": "Os Z Niezbazowana Absolutnie",
   "en": "Os Z Absolutely not based"
  },
  {
   "n": 43,
   "v": "HMI2.bAlarmANoHoming",
   "pl": "Os A Niezbazowana Absolutnie",
   "en": "Os A Not based Absolutely"
  },
  {
   "n": 44,
   "v": "HMI2.bAlarmBNoHoming",
   "pl": "Os B Niezbazowana Absolutnie",
   "en": "Os B Not based Absolutely"
  },
  {
   "n": 45,
   "v": "HMI2.bAlarmJogDistanceZero",
   "pl": "Skok wynosi zero",
   "en": "Jump is zero"
  },
  {
   "n": 46,
   "v": "HMI2.bAlarmMainDriveFreqNotAquired",
   "pl": "Predkosc napedu glownego zbyt niska",
   "en": "Main drive speed too low"
  },
  {
   "n": 47,
   "v": "HMI2.bAlarmTimeoutInWork",
   "pl": "Timeout maszyna stoi",
   "en": "Timeout machine stands"
  },
  {
   "n": 48,
   "v": "HMI2.bAlarmEtherCATError",
   "pl": "Brak komunikacji EtherCat",
   "en": "No EtherCat communication"
  },
  {
   "n": 49,
   "v": "HMI2.bAlarmNoLicense",
   "pl": "Brak licencji na kontrolerze",
   "en": "No license on the controller"
  },
  {
   "n": 50,
   "v": "HMI2.bAlarmException",
   "pl": "Program natrafil na wyjatek",
   "en": "The program encountered an exception"
  },
  {
   "n": 51,
   "v": "HMI2.bAlarmAxisBTimeout",
   "pl": "Timeout ruchu wychył",
   "en": "Tilt movement timeout"
  },
  {
   "n": 52,
   "v": "HMI2.bAlarmHMICommunication",
   "pl": "Brak komunikacji HMI-PLC",
   "en": "No HMI-PLC communication"
  },
  {
   "n": 53,
   "v": "HMI2.bAlarmArcRadiusTooSmall",
   "pl": "Zbyt mały promień",
   "en": "Radius too small"
  },
  {
   "n": 54,
   "v": "HMI2.bAlarmTiltPositionError",
   "pl": "Błąd pozycji wychyłu - Zbazuj maszyne ponownie",
   "en": "Tilt position error - Rebase the machine"
  },
  {
   "n": 55,
   "v": "HMI2.bAlarmTableCutsIsTooBig",
   "pl": "Zbyt duza tabela ciec/frezow",
   "en": "Too large table of cuts/mills"
  },
  {
   "n": 56,
   "v": "HMI2.bAlarmAxisAPositionError",
   "pl": "Błąd pozycji osi obrotu",
   "en": "Rotation axis position error"
  },
  {
   "n": 57,
   "v": "HMI2.bAlarmAxisABreakError",
   "pl": "Błąd stycznika hamulca obrotu",
   "en": "Rotation brake contactor error"
  },
  {
   "n": 58,
   "v": "HMI2.bAlarmSetPositionIsOffLimits",
   "pl": "Zadana pozycja jest poza limtami",
   "en": "The set position is outside the limits"
  },
  {
   "n": 59,
   "v": "HMI2.bAlarmRadiusTooSmall",
   "pl": "Promień zbyt mały",
   "en": "Radius too small"
  },
  {
   "n": 60,
   "v": "HMI2.bAlarmLowVoltageEncoderX",
   "pl": "Niskie napiecie bateria os X",
   "en": "Low voltage Axis X battery"
  },
  {
   "n": 61,
   "v": "HMI2.bAlarmLowVoltageEncoderY",
   "pl": "Niskie napiecie bateria os Y",
   "en": "Low voltage Y axis battery"
  },
  {
   "n": 62,
   "v": "HMI2.bAlarmLowVoltageEncoderZ",
   "pl": "Niskie napiecie bateria os Z",
   "en": "Low voltage Z axis battery"
  },
  {
   "n": 63,
   "v": "HMI2.bAlarmLowVoltageEncoderA",
   "pl": "Niskie napiecie bateria os A",
   "en": "Low voltage battery A"
  },
  {
   "n": 64,
   "v": "HMI2.bAlarmLowVoltageEncoderB",
   "pl": "Niskie napiecie bateria os B",
   "en": "Low voltage battery axis B"
  },
  {
   "n": 65,
   "v": "HMI2.bAlarmModbusMainDrive",
   "pl": "Brak komunikacji napęd głowny",
   "en": "No main drive communication"
  },
  {
   "n": 66,
   "v": "HMI2.bAlarmModbusTilt",
   "pl": "Brak komunikacji wychyl",
   "en": "Lack of communication tilt"
  },
  {
   "n": 67,
   "v": "HMI2.bAlarmWrongMotorTypeX",
   "pl": "Zly Typ silnika X",
   "en": "Wrong Engine type X"
  },
  {
   "n": 68,
   "v": "HMI2.bAlarmWrongMotorTypeY",
   "pl": "Zly Typ silnika Y",
   "en": "Wrong Y engine type"
  },
  {
   "n": 69,
   "v": "HMI2.bAlarmWrongMotorTypeZ",
   "pl": "Zly Typ silnika Z",
   "en": "Wrong Z engine type"
  },
  {
   "n": 70,
   "v": "HMI2.bAlarmWrongMotorTypeA",
   "pl": "Zly Typ silnika A",
   "en": "Wrong Engine type A"
  },
  {
   "n": 71,
   "v": "HMI2.bAlarmWrongMotorTypeB",
   "pl": "Zly Typ silnika B",
   "en": "Wrong Engine Type B"
  },
  {
   "n": 72,
   "v": "HMI2.bAlarmAxisAOverRange",
   "pl": "Pozycja osi obrotu za duza",
   "en": "Rotation axis position too large"
  },
  {
   "n": 73,
   "v": "HMI2.bAlarmAxisShiftWhileMoving",
   "pl": "Pozycja X lub Y przesunela sie w trakcie ruchu",
   "en": "The X or Y position has moved during movement"
  },
  {
   "n": 74,
   "v": "HMI2.bAlarmMainDriveMaxLoad",
   "pl": "Zbyt duze obciazenie silnika glownego",
   "en": "Main drive load too high"
  },
  {
   "n": 75,
   "v": "HMI2.bAlarmMainDriveLowSpeed",
   "pl": "Zbyt mala predkosc silnika glowneo",
   "en": "Main drive speed too low"
  },
  {
   "n": 76,
   "v": "HMI2.bAlarmAxisBTop",
   "pl": "Krańcówka osi B Góra",
   "en": "B axis limit switch Top"
  },
  {
   "n": 77,
   "v": "HMI2.bAlarmAxisBBottom",
   "pl": "Krańcówka osi B Dół",
   "en": "B axis limit switch Down"
  },
  {
   "n": 80,
   "v": "HMI2.bAlarmCNC",
   "pl": "Blad Systemu CNC",
   "en": "CNC System Error"
  },
  {
   "n": 81,
   "v": "HMI2.bAlarmCNCPreprocess",
   "pl": "Błąd CNC Preprocess",
   "en": "CNC Preprocessor error"
  },
  {
   "n": 82,
   "v": "HMI2.bAlarmCNCManager",
   "pl": "Błąd CNC Manager",
   "en": "CNC Manager error"
  },
  {
   "n": 83,
   "v": "HMI2.bAlarmToolChange",
   "pl": "Bład w trakcie wymiany narzedzi",
   "en": "Error during tool change"
  },
  {
   "n": 84,
   "v": null,
   "pl": "Błąd Polerowania",
   "en": "Polishing Error"
  }
];

export const alarmByVar = (v) => ALARMS.find((a) => a.v === v) ?? null;
export const alarmByNumber = (n) => ALARMS.find((a) => a.n === n) ?? null;

// Klucz zmiennej opcjonalnej (config.js VARIABLES) dla bitu alarmu
export const alarmKey = (v) => `alarm:${v}`;

// Alarmy wykrywane w symulacji (offline) - bity jak w PLC
export const SIM_ALARMS = {
  notBased: 'HMI2.bAlarmNotBasedMachine',          // start programu bez bazowania (bSystemBased)
  offLimits: 'HMI2.bAlarmSetPositionIsOffLimits',  // #154 zadana pozycja poza krancowkami elektronicznymi
  jogZero: 'HMI2.bAlarmJogDistanceZero',          // skok (tryb SKOK) o zero
  active: 'HMI2.bAlarmActive',                    // jakikolwiek alarm aktywny
};

// Aktywne alarmy z wartosci PLC ({klucz: wartosc}): numery alarmow wlaczonych w HMI z bitem = TRUE
export function activeFromValues(values) {
  return ALARMS.filter((a) => a.v && !a.off && values[alarmKey(a.v)] === true).map((a) => a.n);
}

// Historia alarmow (jak lista alarmow HMI, RecordNumber 500): wpis {n, on (ms), off (ms) | null, ack}
// update(active, now) - nowe aktywne dopisane, te, ktore zniknely - czas ustapienia
export class AlarmLog {
  constructor(max = 500) {
    this.max = max;
    this.entries = [];
    this.version = 0;
  }

  get active() { return this.entries.filter((e) => e.off === null).map((e) => e.n); }

  update(active, now = Date.now()) {
    const set = new Set(active);
    let changed = false;
    for (const e of this.entries) {
      if (e.off === null && !set.has(e.n)) { e.off = now; changed = true; }
    }
    const open = new Set(this.entries.filter((e) => e.off === null).map((e) => e.n));
    for (const n of active) {
      if (open.has(n)) continue;
      this.entries.unshift({ n, on: now, off: null, ack: false });
      changed = true;
    }
    if (this.entries.length > this.max) this.entries.length = this.max;
    if (changed) this.version++;
    return changed;
  }

  // kwitowanie: wszystkie wpisy potwierdzone (aktywne zostaja aktywne)
  ack() {
    let changed = false;
    for (const e of this.entries) if (!e.ack) { e.ack = true; changed = true; }
    if (changed) this.version++;
  }

  get unacked() { return this.entries.filter((e) => !e.ack).length; }

  clear() { this.entries = []; this.version++; }
}
