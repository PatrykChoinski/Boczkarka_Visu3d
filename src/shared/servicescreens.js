// Ekrany serwisowe HMI (#147): serwis (70), serwis_2 - obszar pracy maszyny (71), serwis_3 - ustawienia serwisowe (75).
// Wygenerowane z projektu HMI (PilaJednosuportowaINNER.dpa) i zrzutu PLC: grupy jak ramki na ekranie, zmienne, opisy,
// jednostki, zakresy, wartosci poczatkowe (init z GVL), dzialanie w PLC (use). k: num - pole, display - odczyt, bit -
// przelacznik (off / on - napisy stanow z HMI), button - przycisk (act), goto - przejscie (page / tab, hmi - ekran HMI),
// dead - przycisk bez dzialania w HMI. gain - mnoznik wyswietlania jak w HMI (0.06: mm/s -> m/min).

export const SERVICE_PAGES = [
 {
  "id": "main",
  "hmi": "serwis (70)",
  "title": "Serwis – ustawienia",
  "groups": [
   {
    "title": "PARAMETRY MASZYNY PIŁA",
    "items": [
     {
      "k": "num",
      "v": "HMI.fParameterHeadRotationDiameter",
      "t": "LREAL",
      "label": "ŚREDNICA OBROTU GŁOWICY [mm]",
      "unit": "mm",
      "dec": 3,
      "min": 0.0,
      "max": 1000.0,
      "init": 198.0,
      "use": "Head rotation diameter; offsets X/Y start/end of saw cuts and arc radius (GetPositions/SetPosition of Cut/Arc/Circle/Stripes)."
     },
     {
      "k": "num",
      "v": "HMI.fParameterCutTiltDiameter",
      "t": "LREAL",
      "label": "ŚREDNICA WYCHYŁU PILA [mm]",
      "unit": "mm",
      "dec": 3,
      "min": 0.0,
      "max": 1000.0,
      "init": 640.0,
      "use": "Saw tilt (B) pivot diameter; in every saw/mill Z-depth and X/Y offset formula and in the saw-mode Z+ soft limit (WorkArea)."
     },
     {
      "k": "num",
      "v": "HMI.fParameterMaxSawVelocity",
      "t": "LREAL",
      "label": "MAX. PRĘDKOŚĆ CIĘCIA [m/min]",
      "gain": 0.06,
      "unit": "m/min",
      "dec": 3,
      "min": 0.0,
      "max": 1000.0,
      "init": 166.6,
      "use": "VelocityAcceleration: caps saw-mode path speed fMaxVelocitySawMode/CircMode = MIN(this, X/Y jog max) [mm/s]."
     },
     {
      "k": "num",
      "v": "HMI.fParameterDiscDiameter",
      "t": "LREAL",
      "label": "ŚREDNICA TARCZY [mm]",
      "unit": "mm",
      "dec": 3,
      "min": 0.0,
      "max": 1000.0,
      "init": 400.0,
      "use": "Saw blade diameter; depth/position formulas and saw-mode Z+ soft limit (WorkArea)."
     },
     {
      "k": "num",
      "v": "HMI.fParameterInnerCutCorrection",
      "t": "LREAL",
      "label": "KOREKTA CIECIE WEW[mm]",
      "unit": "mm",
      "dec": 2,
      "min": -99.0,
      "max": 99.0,
      "init": 0.0,
      "use": "CutST: Z correction for inner cuts (Cut/DepthPrepare/LastCut) when B is not tilted."
     },
     {
      "k": "num",
      "v": "HMI.fParameterInnerCutCorrectionBAngle",
      "t": "LREAL",
      "label": "KOREKTA CIECIE WEW WYCHYŁ",
      "dec": 2,
      "min": -99.0,
      "max": 99.0,
      "init": 15.0,
      "use": "CutST: inner-cut correction used instead of the above when B is tilted."
     }
    ]
   },
   {
    "title": "PARAMETRY MASZYNY FREZ",
    "items": [
     {
      "k": "num",
      "v": "HMI.fParameterMillTiltDiameter",
      "t": "LREAL",
      "label": "Średnica wychyłu frezu [mm]",
      "unit": "mm",
      "dec": 3,
      "min": 0.0,
      "max": 1000.0,
      "init": 450.0,
      "use": "Mill tilt pivot diameter; X/Y offsets of mill positions (Mill GetPositions, ActualPosition)."
     },
     {
      "k": "num",
      "v": "HMI.fParameterMaxMillVelocity",
      "t": "LREAL",
      "label": "MAX. PRĘDKOŚĆ FREZOWANIA [m/min]",
      "gain": 0.06,
      "unit": "m/min",
      "dec": 3,
      "min": 0.0,
      "max": 1000.0,
      "init": 33.3,
      "use": "VelocityAcceleration: caps mill-mode path speed fMaxVelocityMillMode = MIN(this, X/Y jog max) [mm/s]."
     },
     {
      "k": "num",
      "v": "HMI.fParameterMillWidth",
      "t": "LREAL",
      "label": "SREDNICA FREZU [mm]",
      "unit": "mm",
      "dec": 2,
      "min": 0.0,
      "max": 9999.0,
      "init": 50.0,
      "use": "Mill (tool) diameter; half-width offset of mill passes (Mill GetPositions, shapes)."
     },
     {
      "k": "num",
      "v": "HMI.fParameterMillLength",
      "t": "LREAL",
      "label": "WYSOKOSC FREZU OD TARCZY [mm]",
      "unit": "mm",
      "dec": 2,
      "min": 0.0,
      "max": 9999.0,
      "init": 250.0,
      "use": "Mill height from blade (tool length) in mill/drill Z formulas; MillST forces it to 0 when bServiceMillDifferentTable."
     },
     {
      "k": "num",
      "v": "HMI.fParameterMillCorrection",
      "t": "LREAL",
      "label": "KOREKTA FREZ OS Z [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -9999.0,
      "max": 9999.0,
      "init": 0.0,
      "use": "MillST: copied to fParameterCorrection (Z correction) for mill without own table and always for drill mode."
     }
    ]
   },
   {
    "title": "PARAMETRY MASZYNY WIERTŁO",
    "items": [
     {
      "k": "num",
      "v": "HMI.fParameterDrillLength",
      "t": "LREAL",
      "label": "DŁUGOŚĆ WIERTŁA",
      "unit": "mm",
      "dec": 1,
      "min": 0.0,
      "max": 9999.0,
      "init": 250.0,
      "use": "Drill length; DrillST Z positions and ActualPosition Z in drill mode."
     },
     {
      "k": "num",
      "v": "HMI.fParameterMillCorrection",
      "t": "LREAL",
      "label": "KOREKTA WIERTŁO OS Z [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -9999.0,
      "max": 9999.0,
      "init": 0.0,
      "use": "MillST: copied to fParameterCorrection (Z correction) for mill without own table and always for drill mode."
     }
    ]
   },
   {
    "title": "Ekrany",
    "items": [
     {
      "k": "goto",
      "label": "PARAMTERY OSIE",
      "hmi": "Servo Parametry (79)"
     },
     {
      "k": "goto",
      "label": "RECEPTURY PARAMETRY",
      "hmi": "Pliki_Parametry (126)"
     }
    ]
   },
   {
    "title": "Ekrany",
    "items": [
     {
      "k": "goto",
      "label": "OBSZAR PRACY MASZYNY",
      "hmi": "serwis_2 (71)",
      "page": "area"
     },
     {
      "k": "goto",
      "label": "OBSZAR STOŁU",
      "hmi": "wierzcholki_stol (45)",
      "tab": "stone"
     },
     {
      "k": "goto",
      "label": "OBSZAR KAMIENIA",
      "hmi": "wierzcholki_material (44)",
      "tab": "stone"
     },
     {
      "k": "goto",
      "label": "FALOWNIKI",
      "hmi": "falowniki (72)"
     },
     {
      "k": "goto",
      "label": "PREDKOSCI",
      "hmi": "serwis_predkosci (78)",
      "tab": "par"
     },
     {
      "k": "goto",
      "label": "USTAWIENIA SERWISOWE",
      "hmi": "service_3 (75)",
      "page": "settings"
     },
     {
      "k": "goto",
      "label": "OBSZAR STOŁU FREZ / WIERCENIE POLEROWANIE",
      "vis": "HMI.bServiceMillDifferentTable = TRUE",
      "hmi": "wierzcholki_stol (46)",
      "tab": "stone"
     },
     {
      "k": "goto",
      "label": "WEJŚCIA WYJŚCIA",
      "hmi": "system (73)"
     },
     {
      "k": "goto",
      "label": "SKALOWANIE OSI",
      "hmi": "Skalowanie (74)"
     },
     {
      "k": "goto",
      "label": "POMIAR NARZĘDZIA",
      "hmi": "Homing Advanced (66)"
     }
    ]
   }
  ]
 },
 {
  "id": "area",
  "hmi": "serwis_2 (71)",
  "title": "Obszar pracy maszyny",
  "groups": [
   {
    "title": "KRAŃCÓWKI ELEKTRONICZNE",
    "items": [
     {
      "k": "num",
      "v": "HMI.fServiceXLimitNegative",
      "t": "LREAL",
      "label": "Xmin [mm]",
      "unit": "mm",
      "dec": 3,
      "min": -100000.0,
      "max": 100000.0,
      "init": -10.0,
      "use": "WorkArea -> axisX.fSWLimitNegative; LimitDistance clamps moves."
     },
     {
      "k": "button",
      "v": "HMI2.bServiceXLimitNegativeSave",
      "t": "BOOL",
      "label": "Zapisz Xmin",
      "vis": "HMI.bServiceLimitSaveHide = FALSE",
      "use": "WorkArea: one-shot, fServiceXLimitNegative := actual X - 5, reset by PLC.",
      "act": "limit:x:min"
     },
     {
      "k": "num",
      "v": "HMI.fServiceXLimitPositive",
      "t": "LREAL",
      "label": "Xmax [mm]",
      "unit": "mm",
      "dec": 3,
      "min": -100000.0,
      "max": 100000.0,
      "init": 2000.0,
      "use": "WorkArea -> axisX.fSWLimitPositive; LimitDistance, diagonal distance in CutST/StartManualPass."
     },
     {
      "k": "button",
      "v": "HMI2.bServiceXLimitPositiveSave",
      "t": "BOOL",
      "label": "Zapisz Xmax",
      "vis": "HMI.bServiceLimitSaveHide = FALSE",
      "use": "WorkArea: one-shot, fServiceXLimitPositive := actual X + 5, reset by PLC.",
      "act": "limit:x:max"
     },
     {
      "k": "num",
      "v": "HMI.fServiceYLimitNegative",
      "t": "LREAL",
      "label": "Ymin [mm]",
      "unit": "mm",
      "dec": 3,
      "min": -100000.0,
      "max": 100000.0,
      "init": -10.0,
      "use": "WorkArea -> axisY.fSWLimitNegative; LimitDistance."
     },
     {
      "k": "button",
      "v": "HMI2.bServiceYLimitNegativeSave",
      "t": "BOOL",
      "label": "Zapisz Ymin",
      "vis": "HMI.bServiceLimitSaveHide = FALSE",
      "use": "WorkArea: one-shot, fServiceYLimitNegative := actual Y - 5, reset by PLC.",
      "act": "limit:y:min"
     },
     {
      "k": "num",
      "v": "HMI.fServiceYLimitPositive",
      "t": "LREAL",
      "label": "Ymax [mm]",
      "unit": "mm",
      "dec": 3,
      "min": -100000.0,
      "max": 100000.0,
      "init": 200.0,
      "use": "WorkArea -> axisY.fSWLimitPositive; LimitDistance, diagonal distance in CutST/StartManualPass."
     },
     {
      "k": "button",
      "v": "HMI2.bServiceYLimitPositiveSave",
      "t": "BOOL",
      "label": "Zapisz Ymax",
      "vis": "HMI.bServiceLimitSaveHide = FALSE",
      "use": "WorkArea: one-shot, fServiceYLimitPositive := actual Y + 5, reset by PLC.",
      "act": "limit:y:max"
     },
     {
      "k": "num",
      "v": "HMI.fServiceZLimitNegative",
      "t": "LREAL",
      "label": "Zmin [mm]",
      "unit": "mm",
      "dec": 3,
      "min": -100000.0,
      "max": 100000.0,
      "init": -10.0,
      "use": "WorkArea -> axisZ.fSWLimitNegative."
     },
     {
      "k": "button",
      "v": "HMI2.bServiceZLimitNegativeSave",
      "t": "BOOL",
      "label": "Zapisz Zmin",
      "vis": "HMI.bServiceLimitSaveHide = FALSE",
      "use": "WorkArea: one-shot, fServiceZLimitNegative := actual Z - 5, reset by PLC.",
      "act": "limit:z:min"
     },
     {
      "k": "num",
      "v": "HMI.fServiceZLimitPositive",
      "t": "LREAL",
      "label": "Zmax [mm]",
      "unit": "mm",
      "dec": 3,
      "min": -100000.0,
      "max": 100000.0,
      "init": 500.0,
      "use": "WorkArea -> axisZ.fSWLimitPositive only when NOT bModeSaw (saw mode computes Z+ from table/tilt/disc); ManualST Z jog."
     },
     {
      "k": "button",
      "v": "HMI2.bServiceZLimitPositiveSave",
      "t": "BOOL",
      "label": "Zapisz Zmax",
      "vis": "HMI.bServiceLimitSaveHide = FALSE",
      "use": "WorkArea: one-shot, fServiceZLimitPositive := actual Z + 5, reset by PLC.",
      "act": "limit:z:max"
     },
     {
      "k": "num",
      "v": "HMI.fServiceALimitNegative",
      "t": "LREAL",
      "label": "Obrót min [°]",
      "unit": "°",
      "dec": 3,
      "min": -100000.0,
      "max": 100000.0,
      "init": -270.1,
      "use": "WorkArea -> axisA.fSWLimitNegative (rotation)."
     },
     {
      "k": "button",
      "v": "HMI2.bServiceALimitNegativeSave",
      "t": "BOOL",
      "label": "Zapisz obrót min",
      "vis": "HMI.bServiceLimitSaveHide = FALSE",
      "use": "NOT USED in PLC (declared in HMI2 only, WorkArea has no A-axis save branch) - button does nothing and stays TRUE.",
      "act": "limit:a:min"
     },
     {
      "k": "num",
      "v": "HMI.fServiceALimitPositive",
      "t": "LREAL",
      "label": "Obrót max [°]",
      "unit": "°",
      "dec": 3,
      "min": -100000.0,
      "max": 100000.0,
      "init": 270.1,
      "use": "WorkArea -> axisA.fSWLimitPositive (rotation)."
     },
     {
      "k": "button",
      "v": "HMI2.bServiceALimitPositiveSave",
      "t": "BOOL",
      "label": "Zapisz obrót max",
      "vis": "HMI.bServiceLimitSaveHide = FALSE",
      "use": "NOT USED in PLC (declared in HMI2 only, WorkArea has no A-axis save branch) - button does nothing and stays TRUE.",
      "act": "limit:a:max"
     }
    ]
   },
   {
    "title": "AKTUALNE POZYCJE OSI",
    "items": [
     {
      "k": "display",
      "v": "HMI2.fXRealPosition",
      "t": "LREAL",
      "label": "X",
      "unit": "mm",
      "dec": 3,
      "use": "ActualPosition: := MCActualPositionX.Position (raw axis X)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceElectronicLimits",
      "t": "BOOL",
      "off": "KRAŃCÓWKI ELEKTR. NIEAKTYWNE",
      "on": "KRAŃCÓWKI ELEKTR. AKTYWNE",
      "use": "WorkArea: bSWLimitEnable of X/Y/Z/A/B (software limit switches on/off)."
     },
     {
      "k": "display",
      "v": "HMI2.fYRealPosition",
      "t": "LREAL",
      "label": "Y",
      "unit": "mm",
      "dec": 3,
      "use": "ActualPosition: := MCActualPositionY.Position (raw axis Y)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceLimitAllowSave",
      "t": "BOOL",
      "off": "ODBLOKUJ ZAPIS ROZMIARÓW",
      "on": "ZAPIS ROZMIARÓW AKTYWNY",
      "use": "WorkArea: unlocks editing/saving of soft limits (drives bServiceLimitSaveHide)."
     },
     {
      "k": "display",
      "v": "HMI2.fZRealPosition",
      "t": "LREAL",
      "label": "Z",
      "unit": "mm",
      "dec": 3,
      "use": "ActualPosition: := MCActualPositionZ.Position (raw axis Z); used by Z jog protection."
     }
    ]
   },
   {
    "title": "WYPRZEDZANIE",
    "items": [
     {
      "k": "bit",
      "v": "HMI.bCutOvertaking",
      "t": "BOOL",
      "label": "WYPRZEDZANIE wł/wył",
      "init": false,
      "use": "Cut/Arc/Circle/Stripes/Blocks: enables overtaking (blended next move) at fCutOvertakingPrecent of the segment."
     },
     {
      "k": "num",
      "v": "HMI.fCutOvertakingPrecent",
      "t": "LREAL",
      "label": "WYPRZEDZANIE %",
      "unit": "%",
      "dec": 2,
      "min": 0.0,
      "max": 99.0,
      "init": 70.0,
      "use": "GetPositions (cut/arc): percent of segment where the overtaking point (Mid position / fBeta) is placed."
     }
    ]
   },
   {
    "title": "KOREKTA WYCHYŁU",
    "items": [
     {
      "k": "num",
      "v": "HMI.fParameterTiltCorrection",
      "t": "LREAL",
      "label": "Dodatkowa korekta",
      "gain": 0.707107,
      "unit": "°",
      "dec": 3,
      "min": -100.0,
      "max": 100.0,
      "use": "Extra tilt correction: GetNextDepth/GetPositions add SIN(B)*this to B in Z-depth and X/Y offset formulas."
     },
     {
      "k": "dead",
      "label": "-10°",
      "note": "w HMI bez działania (bit wewnętrzny HMI $2.0, bez makra)"
     },
     {
      "k": "dead",
      "label": "-1°",
      "note": "w HMI bez działania (bit wewnętrzny HMI $2.1, bez makra)"
     },
     {
      "k": "dead",
      "label": "+1°",
      "note": "w HMI bez działania (bit wewnętrzny HMI $2.2, bez makra)"
     },
     {
      "k": "dead",
      "label": "+10°",
      "note": "w HMI bez działania (bit wewnętrzny HMI $2.3, bez makra)"
     },
     {
      "k": "button",
      "v": "HMI2.bManualBJogLeft",
      "t": "BOOL",
      "label": "JOG wychył ↓",
      "use": "ManualST: jog B (tilt) forward while held.",
      "act": "jog:b:-1"
     },
     {
      "k": "button",
      "v": "HMI2.bManualBJogRight",
      "t": "BOOL",
      "label": "JOG wychył ↑",
      "use": "ManualST: jog B (tilt) backward while held.",
      "act": "jog:b:1"
     },
     {
      "k": "display",
      "v": "HMI2.fBActualPosition",
      "t": "LREAL",
      "label": "Pozycja wychyłu",
      "unit": "°",
      "dec": 2,
      "use": "Encoders/ActualPosition: tilt (B) angle [deg]; used in all depth formulas."
     },
     {
      "k": "bit",
      "v": "HMI.bBaseBZeroActive",
      "t": "BOOL",
      "off": "ZEROWANIE 0st. WYŁĄCZONE",
      "on": "ZEROWANIE 0st. AKTYWNE",
      "init": true,
      "use": "GoToPositionST/ManualST: move to B=0 is done as homing-to-0 (bBaseBSetZero) instead of a plain move."
     },
     {
      "k": "bit",
      "v": "HMI.bBaseB90Active",
      "t": "BOOL",
      "off": "ZEROWANIE 90st. WYŁĄCZONE",
      "on": "ZEROWANIE 90st. AKTYWNE",
      "init": true,
      "use": "GoToPositionST/ManualST: move to B=90 is done as homing-to-90 (bBaseBSet90) instead of a plain move."
     },
     {
      "k": "bit",
      "v": "HMI.bBreakBOn",
      "t": "BOOL",
      "off": "WŁĄCZ HAMULEC WYCHYŁU",
      "on": "ZAŁĄCZONY HAMULEC WYCHYŁU",
      "use": "BreaksAxisST/Inverters: engage tilt (B) brake (servo or inverter variant); PLC also sets/resets it."
     }
    ]
   },
   {
    "title": "KOREKCJA OBROTU",
    "items": [
     {
      "k": "display",
      "v": "IoConfig_Globals_Mapping.iAActualPositionImp",
      "t": "DINT",
      "label": "POZYCJA [imp]",
      "unit": "imp",
      "dec": 0,
      "use": "IoConfig mapping (%ID17, DINT) of axis A (rotation) encoder impulses - raw read-only position."
     },
     {
      "k": "display",
      "v": "HMI2.fAActualPosition",
      "t": "LREAL",
      "label": "Pozycja [°]",
      "unit": "mm",
      "dec": 2,
      "use": "ActualPosition: := MCActualPositionA.Position (rotation angle); ManualST relative A moves."
     },
     {
      "k": "num",
      "v": "HMI.fJogAVelocity",
      "t": "LREAL",
      "label": "prędkość JOG",
      "unit": "°/s",
      "dec": 3,
      "min": 0.01,
      "max": 100.0,
      "init": 50.0,
      "use": "SingleAxisMotion: velocity of MCJogA / MCRelativeA (rotation jog)."
     },
     {
      "k": "button",
      "v": "HMI2.bManualAJogLeft",
      "t": "BOOL",
      "label": "JOG obrót ↻",
      "use": "ManualST: jog A (rotation) backward while held (blocked if main drive running or bStatusWork).",
      "act": "jog:a:-1"
     },
     {
      "k": "button",
      "v": "HMI2.bManualAJogRight",
      "t": "BOOL",
      "label": "JOG obrót ↺",
      "use": "ManualST: jog A (rotation) forward while held (blocked if main drive running or bStatusWork).",
      "act": "jog:a:1"
     }
    ]
   },
   {
    "title": "ZEROWANIE ABS",
    "items": [
     {
      "k": "bit",
      "v": "HMI2.bBaseXSetZero",
      "t": "BOOL",
      "off": "ZERUJ ABS X",
      "on": "ZEROWANIE...",
      "init": false,
      "use": "AxisHoming: R_TRIG sets X absolute zero, reset by PLC."
     },
     {
      "k": "bit",
      "v": "HMI2.bBaseYSetZero",
      "t": "BOOL",
      "off": "ZERUJ ABS Y",
      "on": "ZEROWANIE...",
      "init": false,
      "use": "AxisHoming: R_TRIG sets Y absolute zero, reset by PLC."
     },
     {
      "k": "bit",
      "v": "HMI2.bBaseZSetZero",
      "t": "BOOL",
      "off": "ZERUJ ABS Z",
      "on": "ZEROWANIE...",
      "init": false,
      "use": "AxisHoming: R_TRIG sets Z absolute zero, reset by PLC."
     },
     {
      "k": "bit",
      "v": "HMI2.bBaseASetZero",
      "t": "BOOL",
      "off": "ZERUJ ABS ORBÓT",
      "on": "ZEROWANIE...",
      "init": false,
      "use": "AxisHoming: R_TRIG sets A (rotation) absolute zero, reset by PLC."
     },
     {
      "k": "bit",
      "v": "HMI2.bBaseBSetZero",
      "t": "BOOL",
      "off": "ZERUJ WYCH",
      "on": "ZERUJ WYCH...",
      "use": "Inverters/AxisHoming: home tilt (B) to 0 deg (inverter or servo), reset by PLC; also set by CutST/GoToPosition."
     }
    ]
   }
  ]
 },
 {
  "id": "settings",
  "hmi": "serwis_3 (75)",
  "title": "Ustawienia serwisowe",
  "groups": [
   {
    "title": "Kierunek piły, prąd, bloki/pasy",
    "items": [
     {
      "k": "bit",
      "v": "HMI.bServiceSawFWD",
      "t": "BOOL",
      "off": "REV",
      "on": "FWD",
      "label": "Kierunek cięcie piła",
      "init": true,
      "use": "SingleAxisMotion/Inverters: main saw spindle rotation direction (FWD/REV)."
     },
     {
      "k": "num",
      "v": "HMI.iMainDriveMaxLoad",
      "t": "WORD",
      "label": "Max Prad Naped Głowny",
      "unit": "A",
      "dec": 2,
      "min": 0.0,
      "max": 50.0,
      "init": 30.0,
      "use": "Alarms: TON_74 alarm when main drive current/100 > this for 2 s (max main drive current)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceBlocksReverse",
      "t": "BOOL",
      "off": "WYŁĄCZONE ZAMIANA 90->-90 BLOKI/KRAWEDZIE",
      "on": "ZEZWOLONE ZAMIANA 90->-90 BLOKI/KRAWEDZIE",
      "init": true,
      "use": "GetPositions/CutBlocksST/CutStripesST: Y cuts reversed (90 -> -90) for blocks/edges."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceAllowSwap",
      "t": "BOOL",
      "off": "WYŁĄCZONA ZMIANA START/KONIEC PASY/BLOKI",
      "on": "ZEZWOLENIE ZMIANA START/KONIEC PASY/BLOKI",
      "init": true,
      "use": "CutBlocks/CutStripes/MillStripes/Blocks/Stripes: alternate start/end on every other pass (zig-zag)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceRectangleACBD",
      "t": "BOOL",
      "off": "Prostokaty ABCD",
      "on": "Prostokaty ACBD",
      "init": false,
      "use": "FiguresGeometric/GetEdgePositions: rectangle cut order ACBD instead of ABCD."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceBlockSwap",
      "t": "BOOL",
      "off": "BLOKI NAJPIERW X POTEM Y",
      "on": "BLOKI NAJPIERW Y POTEM X",
      "init": false,
      "use": "CutBlocksST/Blocks: blocks cut Y first, then X."
     }
    ]
   },
   {
    "title": "Cięcie / ostatnie cięcie",
    "items": [
     {
      "k": "bit",
      "v": "HMI.bServiceCutBackMode",
      "t": "BOOL",
      "off": "Tryb cięcia bez cofania",
      "on": "Tryb cięcia z cofaniem",
      "use": "GetDirection/CutST/CutTime: cut mode with going back (return pass)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceLastCutSlower",
      "t": "BOOL",
      "off": "Ostatnie ciecie bez zmian",
      "on": "Ostatnie ciecie wolniejsze",
      "init": true,
      "use": "CutST/LastCut/CutTime: last pass runs slower over its end part."
     },
     {
      "k": "num",
      "v": "HMI.fServiceLastCutSpeedPrecent",
      "t": "LREAL",
      "label": "Ostatnie ciecie predkosc [%]",
      "unit": "%",
      "dec": 2,
      "min": 0.0,
      "max": 100.0,
      "init": 90.0,
      "use": "CutST: speed override of the slow part of the last pass [%]; CutTime estimate."
     },
     {
      "k": "num",
      "v": "HMI.fServiceLastCutSlowerPartPrecent",
      "t": "LREAL",
      "label": "Ostatnie ciecie wolniejsze na odc [%]",
      "unit": "%",
      "dec": 2,
      "min": 0.0,
      "max": 100.0,
      "init": 20.0,
      "use": "GetPositions/CutTime: length of the slow end part of the last pass [% of segment]."
     },
     {
      "k": "num",
      "v": "HMI.fServiceLastCutSlowerPartMM",
      "t": "LREAL",
      "label": "Ostatnie ciecie wolniejsze na odc [mm]",
      "unit": "mm",
      "dec": 2,
      "min": 0.0,
      "max": 100.0,
      "use": "GetPositions/CutTime: length of the slow end part [mm] (used when bServiceLastCutSlowerMM)."
     },
     {
      "k": "num",
      "v": "HMI.fParameterCutOuterAdditionalDistance",
      "t": "LREAL",
      "label": "Dodatkowa droga [mm]",
      "unit": "mm",
      "dec": 2,
      "min": 0.0,
      "max": 100.0,
      "init": 50.0,
      "use": "CutST: fCutOuterAdditionalDistance - extra lead-in distance [mm]."
     },
     {
      "k": "bit",
      "v": "HMI.bManualCutIdiotsProtection",
      "t": "BOOL",
      "off": "Cięcie ręczne brak zabezpieczenia",
      "on": "Cięcie ręczne zabezpieczenie XY",
      "init": true,
      "use": "ManualST/ManualInterpolation: blocks X/Y moves across the blade while main drive runs (XY protection)."
     }
    ]
   },
   {
    "title": "Tryby cięcia",
    "items": [
     {
      "k": "bit",
      "v": "HMI.bServiceStripesDontTurn",
      "t": "BOOL",
      "off": "PASY Z OBRACANIEM",
      "on": "PASY BEZ OBRACANIA",
      "use": "CutStripesST/Stripes: stripes cut without rotating the head."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceCutUpMode",
      "t": "BOOL",
      "off": "Tryb cięcia zwykły",
      "on": "Tryb cięcia z podnoszeniem",
      "use": "GetDirection/CutST/CutTime: cut mode with lifting (Z up) between passes."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceManualRewriteJogSpeed",
      "t": "BOOL",
      "off": "Normalna predkosc Przesuwu przy cięciu ręcznym",
      "on": "Wolniejsza predkosc Przesuwu przy cięciu ręcznym",
      "init": true,
      "use": "ManualST: slower X/Y/Z jog speed during manual cutting (rewrites jog speeds)."
     },
     {
      "k": "bit",
      "v": "HMI.bServicePartialCut",
      "t": "BOOL",
      "off": "Ciecie zawsze do Konca",
      "on": "Możliwość ciecia czesciowego",
      "init": true,
      "use": "NOT USED in PLC (declared with comment \"Ciecie niepelne\" only)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceOuterAdditionalDistance",
      "t": "BOOL",
      "off": "Dodatkowa droga pozycji początkowej względem zagłebienia wyłączona",
      "on": "Dodatkowa droga pozycji początkowej względem zagłebienia załączona",
      "init": false,
      "use": "GetPositions/CutST: adds fParameterCutOuterAdditionalDistance before the start point (Maszyna 8 Hoder)."
     },
     {
      "k": "bit",
      "v": "HMI.bService100Speed",
      "t": "BOOL",
      "off": "Predkosc 50% max",
      "on": "Predkosc 100% max",
      "init": true,
      "use": "VelocityAcceleration/PathVelocity/CutST/MillST: max speed doubled (100%) vs 50% override limit."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceLastCutSlowerMM",
      "t": "BOOL",
      "off": "Ostatnie ciecie wolniejsze w %",
      "on": "Ostatnie ciecie wolniejsze w MM",
      "use": "GetPositions/CutTime: slow part given in mm instead of percent."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceBladeWidthTilt",
      "t": "BOOL",
      "off": "Nie uwzgledniaj Szerokosci dysku W Wychyle",
      "on": "Uwzgledniaj Szerokosci dysku W Wychyle",
      "use": "ActualPosition: fBladeWidthTilt := SIN(B)*blade width (blade width included when tilted)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceIgnoreSecondaryTable",
      "t": "BOOL",
      "off": "Używaj tabeli Podstawowej i Alternatywnej",
      "on": "Ignoruj tabele Alternatywna",
      "init": false,
      "use": "CutST/PrimaryTable: ignore the alternative depth table (saw)."
     }
    ]
   },
   {
    "title": "Enkodery / woda / opcje",
    "items": [
     {
      "k": "bit",
      "v": "HMI.bServiceBookMinimalRadius",
      "t": "BOOL",
      "off": "Książka Promien Standard",
      "on": "Ksiązka Promien Minimalny",
      "use": "GetBookPositions: book shape uses minimal radius instead of standard working radius."
     },
     {
      "k": "bit",
      "v": "HMI.bWater2",
      "t": "BOOL",
      "off": "DRUGI ZAWÓR WODY WYŁĄCZONY",
      "on": "DRUGI ZAWÓR WODY AKTYWNY",
      "use": "BaseHomingST: IOVars.yWater2 := yWaterCut AND bWater2 (second water valve follows saw water)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceEncoderR1EC",
      "t": "BOOL",
      "off": "Enkoder Wychył Wpiety na AX",
      "on": "Enkoder Wychył Wpiety na R1EC",
      "init": true,
      "use": "Encoders: tilt encoder read via R1-EC module (iR1ECImpulse)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceEncoderDVP",
      "t": "BOOL",
      "off": "Enkoder Wychył Wpiety na AX",
      "on": "Enkoder Wychył Wpiety na DVP",
      "use": "Encoders: tilt encoder read via DVP (WORD_TO_DINT union)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceAxisBEncoderServo",
      "t": "BOOL",
      "off": "Enkoder Wychył Wpiety na AX-8",
      "on": "Enkoder Wychył Wpiety na Servo",
      "use": "Encoders: tilt encoder wired to servo CN5 instead of AX-8 input."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceCheckAxisAError",
      "t": "BOOL",
      "off": "Sprawdzanie błędów Oś obrotu wyłączone",
      "on": "Sprawdzanie błędów Oś obrotu załączone",
      "use": "Alarms: rotation (A) position-deviation alarms while working on position."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceSmoothingArrays",
      "t": "BOOL",
      "off": "Wygładzanie pojedynczych linii",
      "on": "Wygładzanie całości",
      "use": "ProgramAutoProfileST/ProgramSawStepTime: smoothing of the whole profile vs single lines."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceCutProgramOuterInner",
      "t": "BOOL",
      "off": "Brak dodawania średnicydysku programy auto",
      "on": "Dodawanie średnicy dysku programy auto",
      "use": "Auto-program GetPositions: add blade width for inner/outer cuts of auto programs."
     }
    ]
   },
   {
    "title": "Laser / łuki / wychył",
    "items": [
     {
      "k": "bit",
      "v": "HMI.bServiceManualLaser",
      "t": "BOOL",
      "off": "WYŁĄCZONY LASER TRYB RĘCZNY",
      "on": "ZAŁĄCZONY LASER TRYB RĘCZNY",
      "init": true,
      "use": "ManualLaserST: laser on automatically while jogging, off after fParameterLaserOff s."
     },
     {
      "k": "num",
      "v": "HMI.fParameterLaserOff",
      "t": "INT",
      "label": "Czas wyłączania lasera [s]",
      "unit": "s",
      "dec": 0,
      "min": 0.0,
      "max": 1000.0,
      "init": 30.0,
      "use": "ManualLaserST: TON time [s] before laser switches off after jogging (INT despite f-prefix)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceArcInnerOuterOption",
      "t": "BOOL",
      "label": "Łuki dodatkowa opcja wez/zew",
      "use": "CutArcST/StartArc/CutCircle: extra inner/outer option for arcs."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceStripeTableAdvanced",
      "t": "BOOL",
      "off": "Tabela Pasy Podstawowa",
      "on": "Tabela Pasy Rozszerzona",
      "use": "GetTable/CutStripesST/GetMillStripesTable: extended stripes table (per-stripe widths)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceForceAngle",
      "t": "BOOL",
      "off": "Forsowanie kąta obrotu wyłączone",
      "on": "Forsowanie kąta obrotu załączone",
      "use": "CutST/GetPositions/Stripes/Status: force rotation angle to 0/90 (snap) unless manual B angle."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceResetTilt",
      "t": "BOOL",
      "off": "Resetowanie pozycji wychylu Wyłączone",
      "on": "Resetowanie pozycji wychylu Załączone",
      "use": "Encoders: reset tilt encoder offset (inverter variant) when B stands still."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceAdditionalAxisBSet",
      "t": "BOOL",
      "off": "Dodatkowe bazowanie Wychyłu po cieciu Wylaczone",
      "on": "Dodatkowe bazowanie Wychyłu po cieciu Załączone",
      "use": "CutST: extra tilt homing after a cut if B is not at 0 (+-0.5 deg)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceArcChord",
      "t": "BOOL",
      "off": "Łuki definiowane Z 3 Punktów",
      "on": "Łuki definiowane Z Cięciwy",
      "use": "Arc: arc defined by chord instead of 3 points (limits iManualArcType)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceJogZProtection",
      "t": "BOOL",
      "off": "Brak ograniczenia Z do zapasu cięcia materiału",
      "on": "Ograniczenie Z do zapasu cięcia materiału",
      "use": "ManualST: limits Z jog down to the cutting reserve above the table (not in mill mode)."
     }
    ]
   },
   {
    "title": "Czujniki / osie / tryby maszyny",
    "items": [
     {
      "k": "bit",
      "v": "HMI.bServiceSensorAirPressureActive",
      "t": "BOOL",
      "off": "CZUJ. POWIETRZA WYŁĄCZONY",
      "on": "CZUJ. POWIETRZA AKTYWNY",
      "init": true,
      "use": "Alarms: enables air-pressure sensor alarm (TON_8)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceSensorWaterActive",
      "t": "BOOL",
      "off": "CZUJ. WODY WYŁĄCZONY",
      "on": "CZUJ. WODY AKTYWNY",
      "init": true,
      "use": "Alarms: enables water-flow alarms for saw (TON_9) and mill (TON_13) water."
     },
     {
      "k": "bit",
      "v": "HMI.bAxisBServo",
      "t": "BOOL",
      "off": "OŚ WYCHYŁU FALOWNIK",
      "on": "OŚ WYCHYŁU SERVO",
      "use": "Tilt (B) drive type: TRUE servo, FALSE inverter; switches homing/brake/encoder logic everywhere."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceAxisBFWD",
      "t": "BOOL",
      "off": "REV",
      "on": "FWD",
      "label": "Kierunek osi wychyłu",
      "init": false,
      "use": "Inverters: tilt (B) inverter direction (FWD/REV) for homing and moves."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceDryCut",
      "t": "BOOL",
      "off": "TRYB CIECIE Z WODA",
      "on": "TRYB CIECIE BEZ WODY",
      "init": false,
      "use": "MoveToStartPosition/Pause/ManualST/CutElipse: cutting without water (no water start/check)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceAutoHomeAL6A",
      "t": "BOOL",
      "off": "WYŁ AUTORESET AL6A",
      "on": "ZAŁ AUTORESET AL6A",
      "use": "AxisHoming: auto re-home X/Y/Z/A/B after servo alarm AL6A."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceStripesDirection",
      "t": "BOOL",
      "off": "Ukryty kierunek pasów",
      "on": "Widoczny kierunek pasów",
      "use": "Status: shows stripes direction on HMI (bManualStripesX/YDirection)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceAutoResetLimits",
      "t": "BOOL",
      "off": "Krancówki Z Alarmem",
      "on": "Krancówki Bez Alarmu",
      "use": "SingleAxisMotion/Alarms: limit-switch hits without alarm (auto reset)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceCNCMode",
      "t": "BOOL",
      "off": "BEZ CNC",
      "on": "TRYB CNC",
      "init": false,
      "use": "Motion_PRG: CNC (G-code) mode; Alarms for CNC errors; left menu switches layout."
     },
     {
      "k": "goto",
      "label": "USTAWIENIA CD",
      "hmi": "serwis_cd (90)"
     }
    ]
   }
  ]
 }
];

// Zmienne PLC ekranow serwisowych: sciezka GVL.zmienna -> typ IEC
export const SERVICE_SCREEN_VARS = {
 "HMI.fParameterHeadRotationDiameter": "LREAL",
 "HMI.fParameterCutTiltDiameter": "LREAL",
 "HMI.fParameterMaxSawVelocity": "LREAL",
 "HMI.fParameterDiscDiameter": "LREAL",
 "HMI.fParameterInnerCutCorrection": "LREAL",
 "HMI.fParameterInnerCutCorrectionBAngle": "LREAL",
 "HMI.fParameterMillTiltDiameter": "LREAL",
 "HMI.fParameterMaxMillVelocity": "LREAL",
 "HMI.fParameterMillWidth": "LREAL",
 "HMI.fParameterMillLength": "LREAL",
 "HMI.fParameterMillCorrection": "LREAL",
 "HMI.fParameterDrillLength": "LREAL",
 "HMI.fServiceXLimitNegative": "LREAL",
 "HMI2.bServiceXLimitNegativeSave": "BOOL",
 "HMI.fServiceXLimitPositive": "LREAL",
 "HMI2.bServiceXLimitPositiveSave": "BOOL",
 "HMI.fServiceYLimitNegative": "LREAL",
 "HMI2.bServiceYLimitNegativeSave": "BOOL",
 "HMI.fServiceYLimitPositive": "LREAL",
 "HMI2.bServiceYLimitPositiveSave": "BOOL",
 "HMI.fServiceZLimitNegative": "LREAL",
 "HMI2.bServiceZLimitNegativeSave": "BOOL",
 "HMI.fServiceZLimitPositive": "LREAL",
 "HMI2.bServiceZLimitPositiveSave": "BOOL",
 "HMI.fServiceALimitNegative": "LREAL",
 "HMI2.bServiceALimitNegativeSave": "BOOL",
 "HMI.fServiceALimitPositive": "LREAL",
 "HMI2.bServiceALimitPositiveSave": "BOOL",
 "HMI2.fXRealPosition": "LREAL",
 "HMI.bServiceElectronicLimits": "BOOL",
 "HMI2.fYRealPosition": "LREAL",
 "HMI.bServiceLimitAllowSave": "BOOL",
 "HMI2.fZRealPosition": "LREAL",
 "HMI.bCutOvertaking": "BOOL",
 "HMI.fCutOvertakingPrecent": "LREAL",
 "HMI.fParameterTiltCorrection": "LREAL",
 "HMI2.bManualBJogLeft": "BOOL",
 "HMI2.bManualBJogRight": "BOOL",
 "HMI2.fBActualPosition": "LREAL",
 "HMI.bBaseBZeroActive": "BOOL",
 "HMI.bBaseB90Active": "BOOL",
 "HMI.bBreakBOn": "BOOL",
 "IoConfig_Globals_Mapping.iAActualPositionImp": "DINT",
 "HMI2.fAActualPosition": "LREAL",
 "HMI.fJogAVelocity": "LREAL",
 "HMI2.bManualAJogLeft": "BOOL",
 "HMI2.bManualAJogRight": "BOOL",
 "HMI2.bBaseXSetZero": "BOOL",
 "HMI2.bBaseYSetZero": "BOOL",
 "HMI2.bBaseZSetZero": "BOOL",
 "HMI2.bBaseASetZero": "BOOL",
 "HMI2.bBaseBSetZero": "BOOL",
 "HMI.bServiceSawFWD": "BOOL",
 "HMI.iMainDriveMaxLoad": "WORD",
 "HMI.bServiceBlocksReverse": "BOOL",
 "HMI.bServiceAllowSwap": "BOOL",
 "HMI.bServiceRectangleACBD": "BOOL",
 "HMI.bServiceBlockSwap": "BOOL",
 "HMI.bServiceCutBackMode": "BOOL",
 "HMI.bServiceLastCutSlower": "BOOL",
 "HMI.fServiceLastCutSpeedPrecent": "LREAL",
 "HMI.fServiceLastCutSlowerPartPrecent": "LREAL",
 "HMI.fServiceLastCutSlowerPartMM": "LREAL",
 "HMI.fParameterCutOuterAdditionalDistance": "LREAL",
 "HMI.bManualCutIdiotsProtection": "BOOL",
 "HMI.bServiceStripesDontTurn": "BOOL",
 "HMI.bServiceCutUpMode": "BOOL",
 "HMI.bServiceManualRewriteJogSpeed": "BOOL",
 "HMI.bServicePartialCut": "BOOL",
 "HMI.bServiceOuterAdditionalDistance": "BOOL",
 "HMI.bService100Speed": "BOOL",
 "HMI.bServiceLastCutSlowerMM": "BOOL",
 "HMI.bServiceBladeWidthTilt": "BOOL",
 "HMI.bServiceIgnoreSecondaryTable": "BOOL",
 "HMI.bServiceBookMinimalRadius": "BOOL",
 "HMI.bWater2": "BOOL",
 "HMI.bServiceEncoderR1EC": "BOOL",
 "HMI.bServiceEncoderDVP": "BOOL",
 "HMI.bServiceAxisBEncoderServo": "BOOL",
 "HMI.bServiceCheckAxisAError": "BOOL",
 "HMI.bServiceSmoothingArrays": "BOOL",
 "HMI.bServiceCutProgramOuterInner": "BOOL",
 "HMI.bServiceManualLaser": "BOOL",
 "HMI.fParameterLaserOff": "INT",
 "HMI.bServiceArcInnerOuterOption": "BOOL",
 "HMI.bServiceStripeTableAdvanced": "BOOL",
 "HMI.bServiceForceAngle": "BOOL",
 "HMI.bServiceResetTilt": "BOOL",
 "HMI.bServiceAdditionalAxisBSet": "BOOL",
 "HMI.bServiceArcChord": "BOOL",
 "HMI.bServiceJogZProtection": "BOOL",
 "HMI.bServiceSensorAirPressureActive": "BOOL",
 "HMI.bServiceSensorWaterActive": "BOOL",
 "HMI.bAxisBServo": "BOOL",
 "HMI.bServiceAxisBFWD": "BOOL",
 "HMI.bServiceDryCut": "BOOL",
 "HMI.bServiceAutoHomeAL6A": "BOOL",
 "HMI.bServiceStripesDirection": "BOOL",
 "HMI.bServiceAutoResetLimits": "BOOL",
 "HMI.bServiceCNCMode": "BOOL"
};
