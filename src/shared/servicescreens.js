// Ekrany serwisowe HMI (#147 i brakujace): serwis (70) i wszystkie ekrany z niego otwierane - obszar pracy (71),
// ustawienia serwisowe (75), ustawienia frez CD (90), polerowanie (91), parametry osi (79), receptury (126, 76, 127),
// falowniki (72, 77), predkosci serwisowe (78), wejscia / wyjscia (73, 69), skalowanie (74), pomiar narzedzia (66),
// stol frezu (46). Wygenerowane z projektu HMI (PilaJednosuportowaINNER.dpa) i zrzutu PLC: grupy jak ramki na ekranie,
// zmienne, opisy, jednostki, zakresy, wartosci poczatkowe (init z GVL), dzialanie w PLC (use).
// k: num - pole, sel - lista (o: [wartosc, napis]), text - tekst, display / textout - odczyt, bit - przelacznik
// (off / on - napisy stanow z HMI), lamp - lampka, button - przycisk (act), goto - przejscie (page / tab),
// dead - element samego HMI bez zmiennej PLC. gain - mnoznik wyswietlania jak w HMI (0.06: mm/s -> m/min).
// Zmienne z indeksem (aMillingBoardX[0]) - odczyt calej tablicy.

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
      "hmi": "Servo Parametry (79)",
      "page": "servo"
     },
     {
      "k": "goto",
      "label": "RECEPTURY PARAMETRY",
      "hmi": "Pliki_Parametry (126)",
      "page": "files"
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
      "hmi": "falowniki (72)",
      "page": "drives"
     },
     {
      "k": "goto",
      "label": "PREDKOSCI",
      "hmi": "serwis_predkosci (78)",
      "page": "speeds"
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
      "page": "millTable"
     },
     {
      "k": "goto",
      "label": "WEJŚCIA WYJŚCIA",
      "hmi": "system (73)",
      "page": "io"
     },
     {
      "k": "goto",
      "label": "SKALOWANIE OSI",
      "hmi": "Skalowanie (74)",
      "page": "scaling"
     },
     {
      "k": "goto",
      "label": "POMIAR NARZĘDZIA",
      "hmi": "Homing Advanced (66)",
      "page": "toolMeasure"
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
      "k": "lamp",
      "v": "HMI.bCutOvertaking",
      "t": "BOOL",
      "label": "WYPRZEDZANIE",
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
      "note": "element samego HMI ($2.0) – bez zmiennej PLC"
     },
     {
      "k": "dead",
      "label": "-1°",
      "note": "element samego HMI ($2.1) – bez zmiennej PLC"
     },
     {
      "k": "dead",
      "label": "+1°",
      "note": "element samego HMI ($2.2) – bez zmiennej PLC"
     },
     {
      "k": "dead",
      "label": "+10°",
      "note": "element samego HMI ($2.3) – bez zmiennej PLC"
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
      "hmi": "serwis_cd (90)",
      "page": "cd"
     }
    ]
   }
  ]
 },
 {
  "id": "cd",
  "hmi": "serwis_cd (90)",
  "title": "Ustawienia frez (CD)",
  "groups": [
   {
    "title": "KIERUNEK RUCHU FREZU",
    "items": [
     {
      "k": "bit",
      "v": "HMI.bServiceMillFWD",
      "t": "BOOL",
      "off": "REV",
      "on": "FWD",
      "label": "KIERUNEK RUCHU FREZU",
      "init": true,
      "use": "never written by PLC; read in: Axis/SingleAxisMotion, Manual/Inverters"
     }
    ]
   },
   {
    "title": "Ruch interpolowany / pilot / pauza (kolumna x=300)",
    "items": [
     {
      "k": "bit",
      "v": "HMI.bServiceInterpolationLimit",
      "t": "BOOL",
      "off": "Ruch interpolowany O Dystans",
      "on": "Ruch Interpolowany Do krańcówki",
      "init": true,
      "use": "NOT USED in PLC code (only declared)"
     },
     {
      "k": "bit",
      "v": "HMI.bServicePilotInterpolation",
      "t": "BOOL",
      "off": "Pilot Ruch Standard",
      "on": "Pilot Ruch Interpolowany",
      "init": false,
      "use": "never written by PLC; read in: Manual/ManualInterpolationST, Manual/ManualST"
     },
     {
      "k": "bit",
      "v": "HMI.bServicePauseNotStopping",
      "t": "BOOL",
      "off": "Pauza nie zatrzymuje obrotow",
      "on": "Pauza Zatrzymuje obroty",
      "use": "never written by PLC; read in: Alarms/Pause"
     }
    ]
   },
   {
    "title": "Frezowanie - opcje (kolumna x=300, dół)",
    "items": [
     {
      "k": "bit",
      "v": "HMI.bServiceElipseAsOnePoint",
      "t": "BOOL",
      "off": "Elipsa jako 120pkt",
      "on": "Elipsa jako 1pkt",
      "use": "NOT USED in PLC code (only declared)"
     },
     {
      "k": "bit",
      "v": "HMI.bServiceMillProgramNewStartPoints",
      "t": "BOOL",
      "off": "Frezowanie auto Bez punktu Dziury",
      "on": "Frezowanie auto Z Punktem Dziury",
      "use": "never written by PLC; read in: CyclicTasks/FiguresGeometricSt"
     },
     {
      "k": "bit",
      "v": "HMI.bServiceMillShapeReturn",
      "t": "BOOL",
      "off": "Frezowanie całości w jednym kierunku",
      "on": "Frezowanie całości z cofaniem",
      "use": "never written by PLC; read in: CyclicTask/MillShapeST"
     }
    ]
   },
   {
    "title": "Oś Z / woda / frezowanie / stół (kolumna x=646)",
    "items": [
     {
      "k": "bit",
      "v": "HMI.bServiceAnalogZ",
      "t": "BOOL",
      "off": "PREDKOSC OSI Z Z PREDKOSCI",
      "on": "PREDKOSC OSI Z ANALOGA",
      "init": false,
      "use": "never written by PLC; read in: Settings/Status, Settings/VelocityAcceleration"
     },
     {
      "k": "bit",
      "v": "HMI.bServiceMillWaterAndCutWater",
      "t": "BOOL",
      "off": "Frezowanie zawor ciecie wyłączony",
      "on": "Frezowanie zawor ciecie załączony",
      "init": true,
      "use": "never written by PLC; read in: Alarms/Pause, MCodes/M03, MCodes/M04, Settings/Status"
     },
     {
      "k": "bit",
      "v": "HMI.bServiceMillZFirst",
      "t": "BOOL",
      "off": "FREZOWANIE Z ZAGŁEBIANIEM PO SKOSIE",
      "on": "FREZOWANIE NAJPIERW Z ZAGŁEBIANIEM W Z",
      "init": true,
      "use": "written in: CyclicTask/ProgramAutoMillST; read in: CyclicTask/MillArcST, CyclicTask/MillCircleST, CyclicTask/MillElipseST, CyclicTask/MillST, CyclicTask/MillShapeST, Mill/Reset, MillST/Reset, MillShapeST/SegmentPrepare (+5 more)"
     },
     {
      "k": "bit",
      "v": "HMI.bServiceMillDifferentTable",
      "t": "BOOL",
      "off": "STOŁ TAKI SAM DLA CIĘCIA I FREZU",
      "on": "STOŁ RÓŻNY SAM DLA CIĘCIA I FREZU",
      "init": true,
      "use": "never written by PLC; read in: CyclicTask/MillST, Settings/WorkArea"
     }
    ]
   },
   {
    "title": "Init / napęd główny (kolumna x=1025)",
    "items": [
     {
      "k": "bit",
      "v": "HMI2.startInit",
      "t": "BOOL",
      "label": "Start Init",
      "use": "NOT USED in PLC (declared in HMI2 only)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceInverterAnalog",
      "t": "BOOL",
      "off": "Main Drive Modbus",
      "on": "Main Drive Analog",
      "use": "never written by PLC; read in: IO/IO, Settings/Status"
     },
     {
      "k": "bit",
      "v": "HMI.bServiceMainDriveECAT",
      "t": "BOOL",
      "off": "Main Drive Modbus",
      "on": "Main Drive ECAT",
      "use": "never written by PLC; read in: Alarms/Alarms, Axis/SingleAxisMotion, Manual/Inverters"
     }
    ]
   },
   {
    "title": "Serwa / okrąg (kolumna x=1325)",
    "items": [
     {
      "k": "bit",
      "v": "HMI.bServoA3",
      "t": "BOOL",
      "off": "Servo A2",
      "on": "Servo A3",
      "use": "never written by PLC; read in: Alarms/Alarms, Axis/SingleAxisMotion, Servo/ServoParametersHandle"
     },
     {
      "k": "bit",
      "v": "HMI.bServoA3EP",
      "t": "BOOL",
      "off": "Servo A2",
      "on": "Servo A3EP",
      "use": "never written by PLC; read in: Alarms/Alarms, Axis/SingleAxisMotion, Settings/VelocityAcceleration"
     },
     {
      "k": "bit",
      "v": "HMI.bServiceMillCircleReverse",
      "t": "BOOL",
      "off": "Frezowanie okrag ze wskazowkami zegara",
      "on": "Frezowanie okrag przeciwnie do wskazówek zegara",
      "use": "never written by PLC; read in: CyclicTask/MillCircleST, CyclicTask/MillShapeST"
     }
    ]
   },
   {
    "title": "TODO / receptury / tryb testowy (kolumna x=1626)",
    "items": [
     {
      "k": "bit",
      "v": "HMI2.bTODO",
      "t": "BOOL",
      "label": "TODO",
      "init": true,
      "use": "TestingMode: forced FALSE when bServiceTestingMode; never read -> placeholder button."
     },
     {
      "k": "bit",
      "v": "HMI2.bRecipeInnerRewrite",
      "t": "BOOL",
      "label": "Nadpisz Receptruy",
      "use": "NOT USED in PLC (declared in HMI2 only)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceTestingMode",
      "t": "BOOL",
      "off": "Tryb Zwykly",
      "on": "Tryb Testowy",
      "init": false,
      "use": "never written by PLC; read in: Alarms/Alarms, Axis/SingleAxisMotion, BaseHoming/BaseHomingST, CyclicTask/MillArcST, CyclicTask/MillCircleST, CyclicTask/MillElipseST, CyclicTasks/CutElipseST, Demo/DemoST (+9 more)"
     }
    ]
   },
   {
    "title": "LICZNIKI SERWISOWE [dni:godz:min]",
    "items": [
     {
      "k": "display",
      "v": "HMI.iOverallDays",
      "t": "LINT",
      "label": "MASZYNA ZAŁĄCZONA - dni",
      "dec": 0,
      "use": "TimesNew: machine-on counter, days."
     },
     {
      "k": "display",
      "v": "HMI.iOverallHours",
      "t": "LINT",
      "label": "MASZYNA ZAŁĄCZONA - godziny",
      "dec": 0,
      "use": "TimesNew: machine-on counter, hours."
     },
     {
      "k": "display",
      "v": "HMI.iOverallMinutes",
      "t": "LINT",
      "label": "MASZYNA ZAŁĄCZONA - minuty",
      "dec": 0,
      "use": "TimesNew: machine-on counter, minutes."
     }
    ]
   },
   {
    "title": "System / numer maszyny / screenshoty",
    "items": [
     {
      "k": "dead",
      "label": "SYSTEM MENU",
      "note": "element samego HMI (system menu (HMI system screen)) – bez zmiennej PLC"
     },
     {
      "k": "num",
      "v": "HMI.iMachineNumber",
      "t": "INT",
      "label": "Numer Maszyny",
      "dec": 0,
      "min": 0.0,
      "max": 10000.0,
      "use": "never written by PLC; read in: CyclicTasks/FiguresGeometricSt, RecipeHandle, Visu/Visu"
     },
     {
      "k": "bit",
      "v": "HMI2.bMakeScreenshots",
      "t": "BOOL",
      "label": "SCREENSHOTY WSZYSTKICH EKRANOW",
      "use": "NOT USED in PLC (declared in HMI2 only); the HMI has no macro on it either."
     }
    ]
   },
   {
    "title": "JĘZYK / LANGUAGE",
    "items": [
     {
      "k": "dead",
      "label": "Język nr 0",
      "note": "element samego HMI (language change) – bez zmiennej PLC"
     },
     {
      "k": "dead",
      "label": "Język nr 1",
      "note": "element samego HMI (language change) – bez zmiennej PLC"
     },
     {
      "k": "dead",
      "label": "Język nr 2",
      "note": "element samego HMI (language change) – bez zmiennej PLC"
     },
     {
      "k": "dead",
      "label": "Język nr 3",
      "note": "element samego HMI (language change) – bez zmiennej PLC"
     },
     {
      "k": "dead",
      "label": "Język nr 4",
      "note": "element samego HMI (language change) – bez zmiennej PLC"
     },
     {
      "k": "dead",
      "label": "Język nr 5",
      "note": "element samego HMI (language change) – bez zmiennej PLC"
     },
     {
      "k": "dead",
      "label": "Język nr 6",
      "note": "element samego HMI (language change) – bez zmiennej PLC"
     },
     {
      "k": "dead",
      "label": "Język nr 7",
      "note": "element samego HMI (language change) – bez zmiennej PLC"
     }
    ]
   },
   {
    "title": "Ekrany",
    "items": [
     {
      "k": "goto",
      "label": "USTAWIENIA PIŁA",
      "hmi": "serwis_3 (75)",
      "page": "settings"
     },
     {
      "k": "goto",
      "label": "USTAWIENIA POLEROWANIE",
      "hmi": "serwis_polerowanie (91)",
      "page": "polishing"
     }
    ]
   }
  ]
 },
 {
  "id": "polishing",
  "hmi": "serwis_polerowanie (91)",
  "title": "Ustawienia polerowanie",
  "groups": [
   {
    "title": "Polerowanie - opcje (kolumna lewa)",
    "items": [
     {
      "k": "bit",
      "v": "HMI.bServicePolishing",
      "t": "BOOL",
      "off": "Brak Polerowania",
      "on": "Polerowanie",
      "use": "never written by PLC; read in: Axis/SingleAxisMotion, IO/IO"
     },
     {
      "k": "bit",
      "v": "HMI.bServicePolishingToolChange",
      "t": "BOOL",
      "off": "Brak Wymiany Narzedzi",
      "on": "Wymiana Narzedzi",
      "use": "NOT USED in PLC code (only declared)."
     },
     {
      "k": "bit",
      "v": "HMI.bServiceMainDriveEncoderAX",
      "t": "BOOL",
      "off": "Napęd Głowny Enkoder Falownik",
      "on": "Naped Głowny Encoder AX8",
      "use": "never written by PLC; read in: InverterECAT/InverterECAT_FB"
     },
     {
      "k": "bit",
      "v": "HMI.bServicePolishingToolChange",
      "t": "BOOL",
      "off": "Polerowanie bez czujnika bazowania",
      "on": "Polerowanie czujnik bazowania",
      "use": "NOT USED in PLC code (only declared)."
     }
    ]
   },
   {
    "title": "Czujniki / wymiana narzędzi (kolumna prawa)",
    "items": [
     {
      "k": "bit",
      "v": "HMI.bServicePolishingCoverIgnoreSensors",
      "t": "BOOL",
      "off": "Czujnik Osłona Aktywny",
      "on": "Ignoruj Czujnik Oslona",
      "use": "never written by PLC; read in: Polishing/PolishingToolChange"
     },
     {
      "k": "bit",
      "v": "HMI.bServicePolishingToolIgnoreSensors",
      "t": "BOOL",
      "off": "Czujnik Narzedzia Aktywny",
      "on": "Ignoruj Czujnik Narzedzia",
      "use": "never written by PLC; read in: Polishing/PolishingToolChange"
     },
     {
      "k": "num",
      "v": "ToolChangeGVL.SafeDistance",
      "t": "LREAL",
      "label": "Bezpieczna odległość wymiana narz",
      "dec": 0,
      "min": 0.0,
      "max": 1000.0,
      "init": 100.0,
      "use": "PolishingToolChange: safe Z distance [mm] for tool change."
     },
     {
      "k": "num",
      "v": "ToolChangeGVL.InverterHomePosition",
      "t": "DINT",
      "label": "Bazowanie Silnika przed wymiana narz [imp]",
      "unit": "imp",
      "dec": 0,
      "min": -100000.0,
      "max": 100000.0,
      "init": -100.0,
      "use": "PolishingToolChange: main-drive (inverter) home position [imp] before tool change."
     }
    ]
   },
   {
    "title": "System / numer maszyny / screenshoty",
    "items": [
     {
      "k": "dead",
      "label": "SYSTEM MENU",
      "note": "element samego HMI (system menu (HMI system screen)) – bez zmiennej PLC"
     },
     {
      "k": "num",
      "v": "HMI.iMachineNumber",
      "t": "INT",
      "label": "Numer Maszyny",
      "dec": 0,
      "min": 0.0,
      "max": 10000.0,
      "use": "never written by PLC; read in: CyclicTasks/FiguresGeometricSt, RecipeHandle, Visu/Visu"
     },
     {
      "k": "bit",
      "v": "HMI2.bMakeScreenshots",
      "t": "BOOL",
      "label": "SCREENSHOTY WSZYSTKICH EKRANOW",
      "use": "NOT USED in PLC (declared in HMI2 only); the HMI has no macro on it either."
     }
    ]
   },
   {
    "title": "Ekrany",
    "items": [
     {
      "k": "goto",
      "label": "USTAWIENIA PILA",
      "hmi": "serwis_3 (75)",
      "page": "settings"
     },
     {
      "k": "goto",
      "label": "USTAWIENIA FREZ",
      "hmi": "serwis_cd (90)",
      "page": "cd"
     }
    ]
   }
  ]
 },
 {
  "id": "servo",
  "hmi": "Servo Parametry (79)",
  "title": "Parametry osi (servo)",
  "groups": [
   {
    "title": "Wybór osi i daty ostatniego zapisu/odczytu",
    "items": [
     {
      "k": "sel",
      "v": "HMI2.iAxisRecipe",
      "t": "ServoType",
      "o": [
       [
        0,
        "X"
       ],
       [
        1,
        "Y"
       ],
       [
        2,
        "Z"
       ],
       [
        3,
        "A"
       ],
       [
        4,
        "B"
       ]
      ],
      "label": "Oś (wybór receptury parametrów serwa X/Y/Z/A/B)",
      "use": "ServoParametersHandle: selects axis (ServoType X/Y/Z/A/B) -> RecipeName AxisX.., sAxisRecipePath D:\\AxisParams\\AxisN.AxisParams.txtrecipe, last save/load dates."
     },
     {
      "k": "textout",
      "v": "HMI2.sLastSaveDate",
      "t": "STRING",
      "label": "Data ostatniego zapisu",
      "use": "ServoParametersHandle: copy of sLastSaveX..B for the selected axis (written at step 900 after a save)."
     },
     {
      "k": "textout",
      "v": "HMI2.sLastLoadDate",
      "t": "STRING",
      "label": "Data ostatniego przepisania",
      "use": "ServoParametersHandle: copy of sLastLoadX..B for the selected axis."
     }
    ]
   },
   {
    "title": "Operacje na recepturze parametrów osi",
    "items": [
     {
      "k": "bit",
      "v": "HMI2.bSaveAxisRecipe",
      "t": "BOOL",
      "off": "ZAPISZ",
      "on": "ZAPISUJE",
      "use": "ServoParametersHandle: R_TRIG only resets StepRead := 0; step 0 waits for bReadAxisX..B which nothing ever sets TRUE -> SDO read + recipe save never starts. Bit never reset by PLC (toggle stays ON)."
     },
     {
      "k": "bit",
      "v": "HMI2.bLoadAxisRecipe",
      "t": "BOOL",
      "label": "WCZYTAJ",
      "use": "ServoParametersHandle: R_TRIG only resets StepWrite := 0; step 0 waits for bWriteAxisX..B which nothing ever sets TRUE -> load + SDO write never starts. Bit never reset by PLC."
     },
     {
      "k": "bit",
      "v": "HMI2.bShowAxisRecipe",
      "t": "BOOL",
      "label": "POKAZ PARAMETRY",
      "use": "NOT USED in PLC. On HMI it is the OpenFileTrigVar of the file viewer (idx 10): rising edge opens sAxisRecipePath. Toggle, not reset."
     }
    ]
   },
   {
    "title": "Podgląd pliku parametrów osi",
    "items": [
     {
      "k": "textout",
      "v": "HMI2.sAxisRecipePath",
      "t": "STRING",
      "label": "Podgląd pliku receptury osi (plik z sAxisRecipePath)",
      "use": "ServoParametersHandle: D:\\AxisParams\\Axis<X..B>.AxisParams.txtrecipe for the selected axis (file shown by the HMI viewer)."
     }
    ]
   }
  ]
 },
 {
  "id": "files",
  "hmi": "Pliki_Parametry (126)",
  "title": "Receptury – parametry",
  "groups": [
   {
    "title": "Lista receptur + przewijanie",
    "items": [
     {
      "k": "textout",
      "v": "HMI2.aRecipes[0]",
      "t": "ARRAY_STRING",
      "label": "Lista receptur (aRecipes[0..], 10 wierszy/strona; wybór -> iSelectedRecipeName)",
      "use": "RecipeHandle only READS aRecipes[iSelectedRecipeName-1]; nothing in the PLC fills the array (DirList result is not copied) -> the list stays empty unless written elsewhere."
     },
     {
      "k": "dead",
      "label": "Poprzednia strona",
      "note": "element samego HMI ($24.0) – bez zmiennej PLC"
     },
     {
      "k": "dead",
      "label": "Pozycja +1",
      "note": "element samego HMI ($24.2) – bez zmiennej PLC"
     },
     {
      "k": "dead",
      "label": "Pozycja -1",
      "note": "element samego HMI ($24.3) – bez zmiennej PLC"
     },
     {
      "k": "dead",
      "label": "Następna strona",
      "note": "element samego HMI ($24.1) – bez zmiennej PLC"
     }
    ]
   },
   {
    "title": "Operacje na recepturach",
    "items": [
     {
      "k": "bit",
      "v": "HMI2.bRecipeCreateRecipe",
      "t": "BOOL",
      "label": "STWÓRZ NOWA RECEPTURE",
      "use": "RecipeHandle: CreateRecipe(sRecipeDefinition, sNewRecipeName) if storage path set, then := FALSE; otherwise sets bRecipeSetStoragePath first (bit stays TRUE until next scan creates it)."
     },
     {
      "k": "bit",
      "v": "HMI2.bRecipeDelete",
      "t": "BOOL",
      "label": "USUŃ RECEPTURE",
      "use": "RecipeHandle: DeleteRecipeFile(sSelectedRecipeName), bRecipeRefreshList := TRUE, := FALSE."
     },
     {
      "k": "bit",
      "v": "HMI2.bRecipeUploadRecipe",
      "t": "BOOL",
      "off": "PLC -> REC",
      "on": "ZAŁADUJ RECEPTURE",
      "use": "RecipeHandle \"PLC -> REC\": LoadRecipe + ReadRecipe (PLC values into the selected recipe), := FALSE. No SaveRecipe call."
     },
     {
      "k": "bit",
      "v": "HMI2.bRecipeLoadRecipe",
      "t": "BOOL",
      "off": "REC -> PLC",
      "on": "ZAŁADUJ RECEPTURE",
      "use": "RecipeHandle \"REC -> PLC\": LoadRecipe + WriteRecipe (recipe values to PLC variables), := FALSE."
     },
     {
      "k": "dead",
      "label": "PODGLAD RECEPTURY / ZAŁADUJ RECEPTURE",
      "note": "element samego HMI ($3002.0) – bez zmiennej PLC"
     }
    ]
   },
   {
    "title": "Nowa receptura / status błędu",
    "items": [
     {
      "k": "text",
      "v": "HMI2.sNewRecipeName",
      "t": "STRING",
      "label": "Nazwa nowej receptury",
      "use": "RecipeHandle: name of the recipe created by bRecipeCreateRecipe."
     },
     {
      "k": "display",
      "v": "HMI2.iRecipeError",
      "t": "DWORD",
      "label": "Status Bledu",
      "dec": 0,
      "use": "RecipeHandle: := RecipeMan.GetLastError() every scan."
     }
    ]
   },
   {
    "title": "Ekrany",
    "items": [
     {
      "k": "goto",
      "label": "PODGLĄD ZMIENNE",
      "hmi": "Pliki_Podglad_Popup (127)",
      "page": "recipeView"
     },
     {
      "k": "goto",
      "label": "PODGLĄD PROGRAMY",
      "hmi": "Receptury (76)",
      "page": "recipes"
     }
    ]
   }
  ]
 },
 {
  "id": "recipes",
  "hmi": "Receptury (76)",
  "title": "Receptury – programy",
  "groups": [
   {
    "title": "Podgląd receptury HMI",
    "items": [
     {
      "k": "dead",
      "label": "Numer grupy receptur HMI ($333)",
      "note": "element samego HMI ($333) – bez zmiennej PLC"
     },
     {
      "k": "dead",
      "label": "Podgląd receptur HMI (grupa z $333)",
      "note": "element samego HMI ($333) – bez zmiennej PLC"
     }
    ]
   }
  ]
 },
 {
  "id": "recipeView",
  "hmi": "Pliki_Podglad_Popup (127)",
  "title": "Podgląd receptury",
  "groups": [
   {
    "title": "Podgląd pliku receptury",
    "items": [
     {
      "k": "textout",
      "v": "HMI2.sSelectedRecipePath",
      "t": "STRING",
      "label": "Podgląd pliku wybranej receptury (sSelectedRecipePath)",
      "use": "RecipeHandle: /HMI/<name> (iMachineNumber <= 10) or D:\\Recipes\\<name>Template.txtrecipe; shown by popup 127."
     },
     {
      "k": "dead",
      "label": "Załaduj / Załadowano ($3001.2)",
      "note": "element samego HMI ($3001.2) – bez zmiennej PLC"
     },
     {
      "k": "dead",
      "label": "WYJDZ",
      "note": "element samego HMI ($3002.0) – bez zmiennej PLC"
     }
    ]
   }
  ],
  "note": "W HMI okno podglądu (popup) z ekranu Receptury – parametry."
 },
 {
  "id": "drives",
  "hmi": "falowniki (72)",
  "title": "Falowniki",
  "groups": [
   {
    "title": "ODCZYT PARAMETRÓW",
    "items": [
     {
      "k": "display",
      "v": "Communication.iAxisBFreqAct",
      "t": "WORD",
      "label": "CZĘST. ZADANA [Hz] - OŚ WYCHYŁU",
      "unit": "Hz",
      "dec": 2,
      "use": "written in: Manual/Inverters; read in: Manual/Inverters (Modbus/ECAT inverter data)"
     },
     {
      "k": "display",
      "v": "Communication.iMainDriveFreqAct",
      "t": "WORD",
      "label": "CZĘST. ZADANA [Hz] - NAPĘD GŁÓWNY",
      "unit": "Hz",
      "dec": 2,
      "use": "written in: Axis/SingleAxisMotion, Manual/Inverters; read in: Alarms/Stop, Axis/SingleAxisMotion, CyclicTasks/CutElipseST, Drill/DrillST, Drill/DrillSimpleST (Modbus/ECAT inverter data)"
     },
     {
      "k": "display",
      "v": "Communication.iAxisBFreqAct",
      "t": "WORD",
      "label": "CZĘST. WYJ. [Hz] - OŚ WYCHYŁU",
      "unit": "Hz",
      "dec": 2,
      "use": "written in: Manual/Inverters; read in: Manual/Inverters (Modbus/ECAT inverter data)"
     },
     {
      "k": "display",
      "v": "Communication.iMainDriveFreqAct",
      "t": "WORD",
      "label": "CZĘST. WYJ. [Hz] - NAPĘD GŁÓWNY",
      "unit": "Hz",
      "dec": 2,
      "use": "written in: Axis/SingleAxisMotion, Manual/Inverters; read in: Alarms/Stop, Axis/SingleAxisMotion, CyclicTasks/CutElipseST, Drill/DrillST, Drill/DrillSimpleST (Modbus/ECAT inverter data)"
     },
     {
      "k": "display",
      "v": "Communication.iAxisBVoltage",
      "t": "WORD",
      "label": "NAPIĘCIE WYJ. [V] - OŚ WYCHYŁU",
      "unit": "V",
      "dec": 1,
      "use": "written in: Manual/Inverters; read in: Manual/Inverters (Modbus/ECAT inverter data)"
     },
     {
      "k": "display",
      "v": "Communication.iMainDriveVoltage",
      "t": "WORD",
      "label": "NAPIĘCIE WYJ. [V] - NAPĘD GŁÓWNY",
      "unit": "V",
      "dec": 1,
      "use": "written in: Axis/SingleAxisMotion, Manual/Inverters; never read by PLC (Modbus/ECAT inverter data)"
     },
     {
      "k": "display",
      "v": "Communication.iAxisBCurrent",
      "t": "WORD",
      "label": "PRĄD WYJ. [A] - OŚ WYCHYŁU",
      "unit": "A",
      "dec": 2,
      "use": "written in: Manual/Inverters; read in: Manual/Inverters (Modbus/ECAT inverter data)"
     },
     {
      "k": "display",
      "v": "Communication.iMainDriveCurrent",
      "t": "WORD",
      "label": "PRĄD WYJ. [A] - NAPĘD GŁÓWNY",
      "unit": "A",
      "dec": 2,
      "use": "written in: Axis/SingleAxisMotion, Manual/Inverters; read in: Alarms/Alarms (Modbus/ECAT inverter data)"
     },
     {
      "k": "display",
      "v": "Communication.iMainDriveTorqueAbs",
      "t": "WORD",
      "label": "OBCIĄŻENIE NAPĘDU GŁOWNEGO [%]",
      "unit": "%",
      "dec": 1,
      "use": "written in: Axis/SingleAxisMotion, Manual/Inverters; never read by PLC (Modbus/ECAT inverter data)"
     },
     {
      "k": "display",
      "v": "Communication.iAxisBTorqueABS",
      "t": "WORD",
      "label": "OBCIĄŻENIE SILNIKA WYCHYŁ [%]",
      "unit": "%",
      "dec": 2,
      "use": "not written in ST code (filled by the Modbus/ECAT inverter mapping); read in: Manual/Inverters"
     },
     {
      "k": "display",
      "v": "Communication.iMainDriveTorqueAbs",
      "t": "WORD",
      "label": "Obciążenie napędu głównego - bargraf",
      "use": "written in: Axis/SingleAxisMotion, Manual/Inverters; never read by PLC (Modbus/ECAT inverter data)"
     }
    ]
   },
   {
    "title": "STATUSY FALOWNIÓW",
    "items": [
     {
      "k": "lamp",
      "v": "Communication.bMainDriveRunning",
      "t": "BOOL",
      "label": "PIŁA W RUCHU/ZATRZYMANA",
      "use": "written in: Axis/SingleAxisMotion, Manual/Inverters, Settings/Status; read in: Alarms/Alarms, CyclicTask/MillArcST, CyclicTask/MillCircleST, CyclicTask/MillElipseST, CyclicTasks/CutElipseST, Drill/DrillST, Drill/DrillSimpleST, Functions/IsMainDriveReady (+5 more) (Modbus/ECAT inverter data)"
     },
     {
      "k": "lamp",
      "v": "Communication.bMainDriveRunFWD",
      "t": "BOOL",
      "label": "PIŁA KIERUNEK FWD/REV",
      "use": "written in: Manual/Inverters; never read by PLC (Modbus/ECAT inverter data)"
     },
     {
      "k": "lamp",
      "v": "Communication.bAxisBRunning",
      "t": "BOOL",
      "label": "WYCHYŁ W RUCHU/ZATRZYMANA",
      "use": "written in: Manual/Inverters; never read by PLC (Modbus/ECAT inverter data)"
     },
     {
      "k": "lamp",
      "v": "Communication.bMainDriveRunFWD",
      "t": "BOOL",
      "label": "WYCHYŁ KIERUNEK FWD/REV",
      "use": "written in: Manual/Inverters; never read by PLC (Modbus/ECAT inverter data)"
     }
    ]
   },
   {
    "title": "KONFIGURACJA",
    "items": [
     {
      "k": "num",
      "v": "HMI.fVelocityMainDrive",
      "t": "LREAL",
      "label": "PRĘDKOŚĆ FALOWNIKA NAPĘDU PIŁY [Hz / rpm] - pole Hz",
      "unit": "Hz",
      "dec": 2,
      "min": 0.0,
      "max": 200.0,
      "init": 50.0,
      "use": "Main-drive speed set-point; Inverters/InverterECAT send it to the saw inverter."
     },
     {
      "k": "num",
      "v": "HMI.fVelocityMainDrive",
      "t": "LREAL",
      "label": "PRĘDKOŚĆ FALOWNIKA NAPĘDU PIŁY [Hz / rpm] - pole rpm",
      "unit": "rpm",
      "dec": 0,
      "min": 0.0,
      "max": 6000.0,
      "init": 50.0,
      "use": "Main-drive speed set-point; Inverters/InverterECAT send it to the saw inverter."
     },
     {
      "k": "num",
      "v": "HMI.fMaxVelocityMainDrive",
      "t": "LREAL",
      "label": "NAPĘD GŁ. MAX PREDKOSC [Hz]",
      "unit": "Hz",
      "dec": 2,
      "min": 0.0,
      "max": 250.0,
      "init": 200.0,
      "use": "VelocityAcceleration: scales the main-drive analog pot (fVelocityMainDrive := pot% * this) and iVelocityMainDrivePrecent."
     },
     {
      "k": "num",
      "v": "HMI.iVelocityAxisBFast",
      "t": "INT",
      "label": "WYCHYŁ PR. SZYBKA [Hz]",
      "unit": "Hz",
      "dec": 2,
      "min": 0.0,
      "max": 50.0,
      "init": 2000.0,
      "use": "Inverters: iAxisBFreqHigh := iVelocityAxisBFast (tilt inverter multi-speed 1); macro sets bAxisBRewriteSpeed."
     },
     {
      "k": "num",
      "v": "HMI.iVelocityAxisBSlow",
      "t": "INT",
      "label": "WYCHYŁ PR. DOJAZDU DOL [Hz]",
      "unit": "Hz",
      "dec": 2,
      "min": 0.0,
      "max": 50.0,
      "init": 100.0,
      "use": "Inverters: iAxisBFreqLow when B moves down (bAxisBMovingDown)."
     },
     {
      "k": "num",
      "v": "HMI.iVelocityAxisBSlow2",
      "t": "INT",
      "label": "WYCHYŁ PR. DOJAZDU GORA [Hz]",
      "unit": "Hz",
      "dec": 2,
      "min": 0.0,
      "max": 50.0,
      "init": 150.0,
      "use": "Inverters: iAxisBFreqLow when B moves up."
     },
     {
      "k": "num",
      "v": "HMI.fBaseBChangeVelocity",
      "t": "LREAL",
      "label": "PRZEŁĄCZENIE PRĘDKOŚCI [st.]",
      "unit": "st.",
      "dec": 2,
      "min": 0.0,
      "max": 90.0,
      "init": 8.0,
      "use": "Inverters: +/- window [deg] around the B target in which the tilt inverter switches from fast to slow speed."
     },
     {
      "k": "num",
      "v": "HMI.fBaseBStopPosition",
      "t": "LREAL",
      "label": "ZATRZYMANIE POZYCJONOWANIA [st.]",
      "unit": "st.",
      "dec": 2,
      "min": 0.0,
      "max": 90.0,
      "init": 0.1,
      "use": "Inverters/GoToPositionST: +/- window [deg] around the B target in which tilt positioning is stopped (overrun compensation)."
     },
     {
      "k": "num",
      "v": "HMI.fBaseBTime",
      "t": "LREAL",
      "label": "CZAS POZYCJONOWANIA [s]",
      "unit": "s",
      "dec": 2,
      "min": 0.0,
      "max": 5.0,
      "use": "NOT USED in PLC code (only declared in HMI)."
     },
     {
      "k": "num",
      "v": "HMI.iVelocityAxisBJog",
      "t": "INT",
      "label": "WYCHYŁ PR. JOG [Hz]",
      "unit": "Hz",
      "dec": 2,
      "min": 0.0,
      "max": 50.0,
      "init": 1000.0,
      "use": "Inverters: iAxisBFreqCommand := iVelocityAxisBJog (tilt jog frequency)."
     },
     {
      "k": "num",
      "v": "HMI.iBaseBSlow",
      "t": "INT",
      "label": "BAZOWANIE [Hz]",
      "unit": "Hz",
      "dec": 2,
      "min": 0.0,
      "max": 50.0,
      "init": 500.0,
      "use": "Inverters: iAxisBFreqBase := iBaseBSlow (tilt homing frequency)."
     },
     {
      "k": "num",
      "v": "HMI.iAxisBHomeTorqueFirst",
      "t": "WORD",
      "label": "MOMENT BAZOWANIE WSTĘPNE [%]",
      "unit": "%",
      "dec": 1,
      "min": 0.0,
      "max": 500.0,
      "init": 2000.0,
      "use": "Inverters (tilt homing): stop detected when Communication.iAxisBTorqueABS > this during the first approach."
     },
     {
      "k": "num",
      "v": "HMI.iAxisBHomeTorqueNext",
      "t": "WORD",
      "label": "MOMENT BAZOWANIE KOLEJNE[%]",
      "unit": "%",
      "dec": 1,
      "min": 0.0,
      "max": 500.0,
      "init": 1500.0,
      "use": "Inverters (tilt homing): stop detected when iAxisBTorqueABS > this for 0.5 s on the next approaches."
     }
    ]
   }
  ]
 },
 {
  "id": "speeds",
  "hmi": "serwis_predkosci (78)",
  "title": "Prędkości serwisowe",
  "groups": [
   {
    "title": "STATUS OSI (OŚ OBR WŁĄCZANA JEST TYLKO PRZED RUCHEM)",
    "items": [
     {
      "k": "lamp",
      "v": "HMI2.bStatusXEnabled",
      "t": "BOOL",
      "label": "Status osi X (włączona)",
      "use": "written in: Settings/Status; never read by PLC"
     },
     {
      "k": "lamp",
      "v": "HMI2.bStatusYEnabled",
      "t": "BOOL",
      "label": "Status osi Y (włączona)",
      "use": "written in: Settings/Status; never read by PLC"
     },
     {
      "k": "lamp",
      "v": "HMI2.bStatusZEnabled",
      "t": "BOOL",
      "label": "Status osi Z (włączona)",
      "use": "written in: Settings/Status; never read by PLC"
     },
     {
      "k": "lamp",
      "v": "HMI2.bStatusAEnabled",
      "t": "BOOL",
      "label": "Status osi OBR (włączona)",
      "use": "written in: Settings/Status; never read by PLC"
     },
     {
      "k": "lamp",
      "v": "HMI2.bStatusBEnabled",
      "t": "BOOL",
      "label": "Status osi WYCH (włączona)",
      "use": "written in: Settings/Status; read in: Settings/BreaksAxisST"
     }
    ]
   },
   {
    "title": "PRĘDKOŚĆ OSI Z - WIERCENIE",
    "items": [
     {
      "k": "display",
      "v": "HMI2.iVelocityAxisZDrillPrecent",
      "t": "INT",
      "label": "Prędkość Z wiercenia - bargraf [%]",
      "unit": "%",
      "use": "VelocityAcceleration: fVelocityAxisZDrill as % of fMaxVelocityAxisZDrill (display only)."
     },
     {
      "k": "display",
      "v": "HMI2.iVelocityAxisZDrillPrecent",
      "t": "INT",
      "label": "PRĘDKOŚĆ OSI Z - WIERCENIE [%]",
      "unit": "%",
      "dec": 0,
      "use": "VelocityAcceleration: fVelocityAxisZDrill as % of fMaxVelocityAxisZDrill (display only)."
     },
     {
      "k": "button",
      "v": "HMI2.bVelocityAxisZDrillDec",
      "t": "BOOL",
      "label": "- (zmniejsz o 1% prędkości max)",
      "use": "VelocityAcceleration: while TRUE fVelocityAxisZDrill -= 1% of max every scan. Macro sets bVelocityAxisZDrillChanged."
     },
     {
      "k": "num",
      "v": "HMI.fVelocityAxisZDrill",
      "t": "LREAL",
      "label": "PRĘDKOŚĆ OSI Z - WIERCENIE [m/min]",
      "gain": 0.06,
      "unit": "m/min",
      "dec": 2,
      "min": 0.0,
      "init": 0.5,
      "use": "Z feed speed while drilling (DrillST/DrillSimpleST VelZ); changes are applied live via bVelocityAxisZDrillChanged."
     },
     {
      "k": "button",
      "v": "HMI2.bVelocityAxisZDrillInc",
      "t": "BOOL",
      "label": "+ (zwiększ o 1% prędkości max)",
      "use": "VelocityAcceleration: while TRUE fVelocityAxisZDrill += 1% of fMaxVelocityAxisZDrill every scan (momentary, ramps fast). Macro also sets bVelocityAxisZDrillChanged."
     }
    ]
   },
   {
    "title": "Ograniczenie łuków / korekty daszków",
    "items": [
     {
      "k": "num",
      "v": "HMI.fParameterArcVelocityLimit",
      "t": "LREAL",
      "label": "Ograniczenie predkosci luk [m/min]",
      "gain": 0.06,
      "unit": "m/min",
      "dec": 2,
      "min": 0.0,
      "max": 9999.0,
      "init": 10.0,
      "use": "never written by PLC; read in: Settings/VelocityAcceleration"
     },
     {
      "k": "num",
      "v": "HMI.fParameterRoofCorrectionX",
      "t": "LREAL",
      "label": "KOREKTA ODLEGŁOŚC DASZKÓW X [mm]",
      "unit": "mm",
      "dec": 3,
      "min": -1000.0,
      "max": 1000.0,
      "use": "never written by PLC; read in: CyclicTasks/FiguresGeometricSt"
     },
     {
      "k": "num",
      "v": "HMI.fParameterRoofCorrectionY",
      "t": "LREAL",
      "label": "KOREKTA ODLEGŁOŚC DASZKÓW Y [mm]",
      "unit": "mm",
      "dec": 3,
      "min": -1000.0,
      "max": 1000.0,
      "use": "never written by PLC; read in: CyclicTasks/FiguresGeometricSt"
     }
    ]
   },
   {
    "title": "CZASY ACC/DEC | PRĘDKOŚĆ JOG",
    "items": [
     {
      "k": "num",
      "v": "HMI.TaccX",
      "t": "LREAL",
      "label": "X - Tacc [s]",
      "unit": "s",
      "dec": 3,
      "min": 0.001,
      "max": 99.0,
      "init": 2.0,
      "use": "written in: Settings/VelocityAcceleration; read in: Settings/VelocityAcceleration, Times/Blocks, Times/Profiles, Times/Stripes"
     },
     {
      "k": "num",
      "v": "HMI.TdecX",
      "t": "LREAL",
      "label": "X - Tdec [s]",
      "unit": "s",
      "dec": 3,
      "min": 0.001,
      "max": 9999.0,
      "init": 0.5,
      "use": "never written by PLC; read in: Times/Blocks, Times/Profiles, Times/Stripes"
     },
     {
      "k": "num",
      "v": "HMI.fJogXVelocity",
      "t": "LREAL",
      "label": "X - pr. JOG [m/min]",
      "gain": 0.06,
      "unit": "m/min",
      "dec": 3,
      "min": 0.0,
      "init": 100.0,
      "use": "written in: Manual/ManualST; read in: Axis/SingleAxisMotion, Manual/ManualST, MillST/StartManualPass"
     },
     {
      "k": "num",
      "v": "HMI.TaccY",
      "t": "LREAL",
      "label": "Y - Tacc [s]",
      "unit": "s",
      "dec": 3,
      "min": 0.001,
      "max": 9999.0,
      "init": 2.0,
      "use": "written in: Settings/VelocityAcceleration; read in: Settings/VelocityAcceleration, Times/Blocks, Times/Stripes"
     },
     {
      "k": "num",
      "v": "HMI.TdecY",
      "t": "LREAL",
      "label": "Y - Tdec [s]",
      "unit": "s",
      "dec": 3,
      "min": 0.001,
      "max": 9999.0,
      "init": 0.5,
      "use": "never written by PLC; read in: Times/Blocks, Times/Stripes"
     },
     {
      "k": "num",
      "v": "HMI.fJogYVelocity",
      "t": "LREAL",
      "label": "Y - pr. JOG [m/min]",
      "gain": 0.06,
      "unit": "m/min",
      "dec": 3,
      "min": 0.0,
      "init": 100.0,
      "use": "written in: Manual/ManualST; read in: Axis/SingleAxisMotion, Manual/ManualST, MillST/StartManualPass"
     },
     {
      "k": "num",
      "v": "HMI.TaccZ",
      "t": "LREAL",
      "label": "Z - Tacc [s]",
      "unit": "s",
      "dec": 3,
      "min": 0.001,
      "max": 9999.0,
      "init": 2.0,
      "use": "written in: Settings/VelocityAcceleration; read in: Settings/VelocityAcceleration, Times/Arc, Times/Blocks, Times/Circle, Times/Cut, Times/Drill, Times/Mill, Times/Profiles (+4 more)"
     },
     {
      "k": "num",
      "v": "HMI.TdecZ",
      "t": "LREAL",
      "label": "Z - Tdec [s]",
      "unit": "s",
      "dec": 3,
      "min": 0.001,
      "max": 9999.0,
      "init": 0.5,
      "use": "never written by PLC; read in: Times/Arc, Times/Blocks, Times/Circle, Times/Cut, Times/Drill, Times/Mill, Times/Profiles, Times/ProgramCut (+3 more)"
     },
     {
      "k": "num",
      "v": "HMI.fJogZVelocity",
      "t": "LREAL",
      "label": "Z - pr. JOG [m/min]",
      "gain": 0.06,
      "unit": "m/min",
      "dec": 3,
      "min": 0.0,
      "init": 20.0,
      "use": "written in: Manual/ManualST, Settings/VelocityAcceleration; read in: Axis/SingleAxisMotion, Manual/ManualST"
     },
     {
      "k": "num",
      "v": "HMI.TaccXY",
      "t": "LREAL",
      "label": "X+Y - Tacc [s]",
      "unit": "s",
      "dec": 3,
      "min": 0.001,
      "max": 9999.0,
      "init": 2.0,
      "use": "never written by PLC; read in: Times/Arc, Times/Blocks, Times/Circle, Times/Cut, Times/Mill, Times/Profiles, Times/ProgramCut, Times/ProgramMill (+12 more)"
     },
     {
      "k": "num",
      "v": "HMI.TdecXY",
      "t": "LREAL",
      "label": "X+Y - Tdec [s]",
      "unit": "s",
      "dec": 3,
      "min": 0.001,
      "max": 9999.0,
      "init": 0.5,
      "use": "never written by PLC; read in: Times/Arc, Times/Blocks, Times/Circle, Times/Cut, Times/Mill, Times/Profiles, Times/ProgramCut, Times/ProgramMill (+12 more)"
     },
     {
      "k": "num",
      "v": "HMI.TaccA",
      "t": "LREAL",
      "label": "obr. - Tacc [s]",
      "unit": "s",
      "dec": 3,
      "min": 0.001,
      "max": 9999.0,
      "init": 5.0,
      "use": "written in: Settings/VelocityAcceleration; read in: Settings/VelocityAcceleration"
     },
     {
      "k": "num",
      "v": "HMI.TdecA",
      "t": "LREAL",
      "label": "obr. - Tdec [s]",
      "unit": "s",
      "dec": 3,
      "min": 0.001,
      "max": 9999.0,
      "init": 5.0,
      "use": "NOT USED in PLC code (only declared)"
     },
     {
      "k": "num",
      "v": "HMI.fJogAVelocity",
      "t": "LREAL",
      "label": "obr. - pr. JOG [st./s]",
      "unit": "st./s",
      "dec": 2,
      "min": 0.0,
      "init": 50.0,
      "use": "never written by PLC; read in: Axis/SingleAxisMotion"
     },
     {
      "k": "num",
      "v": "HMI.TaccB",
      "t": "LREAL",
      "label": "wych - Tacc [s]",
      "unit": "s",
      "dec": 3,
      "min": 0.001,
      "max": 9999.0,
      "init": 0.5,
      "use": "written in: Settings/VelocityAcceleration; read in: Settings/VelocityAcceleration"
     },
     {
      "k": "num",
      "v": "HMI.TdecB",
      "t": "LREAL",
      "label": "wych - Tdec [s]",
      "unit": "s",
      "dec": 3,
      "min": 0.001,
      "max": 9999.0,
      "init": 20.0,
      "vis": "HMI.bAxisBServo = TRUE",
      "use": "never written by PLC; read in: Settings/VelocityAcceleration"
     },
     {
      "k": "num",
      "v": "HMI.fJogBVelocity",
      "t": "LREAL",
      "label": "wych - pr. JOG [st./s]",
      "unit": "st./s",
      "dec": 2,
      "min": 0.0,
      "init": 50.0,
      "vis": "HMI.bAxisBServo = TRUE",
      "use": "never written by PLC; read in: Axis/SingleAxisMotion"
     }
    ]
   },
   {
    "title": "CZASY ACC/DEC | PRĘDKOŚĆ AUTO",
    "items": [
     {
      "k": "num",
      "v": "HMI.fAutoTaccX",
      "t": "LREAL",
      "label": "X - Tacc AUTO [s]",
      "unit": "s",
      "dec": 3,
      "min": 0.001,
      "max": 99.0,
      "init": 2.0,
      "use": "written in: Settings/VelocityAcceleration; read in: Settings/VelocityAcceleration"
     },
     {
      "k": "num",
      "v": "HMI.fAutoTdecX",
      "t": "LREAL",
      "label": "X - Tdec AUTO [s]",
      "unit": "s",
      "dec": 3,
      "min": 0.001,
      "max": 9999.0,
      "init": 0.5,
      "use": "written in: Settings/VelocityAcceleration; never read by PLC"
     },
     {
      "k": "num",
      "v": "HMI.fAutoTaccY",
      "t": "LREAL",
      "label": "Y - Tacc AUTO [s]",
      "unit": "s",
      "dec": 3,
      "min": 0.001,
      "max": 9999.0,
      "init": 2.0,
      "use": "written in: Settings/VelocityAcceleration; read in: Settings/VelocityAcceleration"
     },
     {
      "k": "num",
      "v": "HMI.fAutoTdecY",
      "t": "LREAL",
      "label": "Y - Tdec AUTO [s]",
      "unit": "s",
      "dec": 3,
      "min": 0.001,
      "max": 9999.0,
      "init": 0.5,
      "use": "written in: Settings/VelocityAcceleration; never read by PLC"
     },
     {
      "k": "num",
      "v": "HMI.fAutoTaccZ",
      "t": "LREAL",
      "label": "Z - Tacc AUTO [s]",
      "unit": "s",
      "dec": 3,
      "min": 0.001,
      "max": 9999.0,
      "init": 2.0,
      "use": "written in: Settings/VelocityAcceleration; read in: Settings/VelocityAcceleration"
     },
     {
      "k": "num",
      "v": "HMI.fAutoTdecZ",
      "t": "LREAL",
      "label": "Z - Tdec AUTO [s]",
      "unit": "s",
      "dec": 3,
      "min": 0.001,
      "max": 9999.0,
      "init": 0.5,
      "use": "written in: Settings/VelocityAcceleration; never read by PLC"
     },
     {
      "k": "num",
      "v": "HMI.VelA",
      "t": "LREAL",
      "label": "A - pr. AUTO [st./s]",
      "unit": "st./s",
      "dec": 2,
      "min": 0.0,
      "init": 100.0,
      "use": "written in: Demo/DemoST; read in: Axis/SingleAxisMotion, TimesNew/AxesTime"
     },
     {
      "k": "num",
      "v": "HMI.VelB",
      "t": "LREAL",
      "label": "B - pr. AUTO [st./s]",
      "unit": "st./s",
      "dec": 2,
      "min": 0.0,
      "init": 20.0,
      "vis": "HMI.bAxisBServo = TRUE",
      "use": "written in: Demo/DemoST; read in: Axis/SingleAxisMotion"
     }
    ]
   },
   {
    "title": "Prędkość bazowania [m/min]",
    "items": [
     {
      "k": "num",
      "v": "HMI.fBaseZVel",
      "t": "LREAL",
      "label": "Prędkość bazowania Z [m/min]",
      "gain": 0.06,
      "unit": "m/min",
      "dec": 3,
      "min": 0.0,
      "init": 20.0,
      "use": "never written by PLC; read in: BaseHoming/BaseHomingST"
     },
     {
      "k": "num",
      "v": "HMI.fBaseAVel",
      "t": "LREAL",
      "label": "Prędkość bazowania A [m/min]",
      "unit": "m/min",
      "dec": 3,
      "min": 0.0,
      "init": 5.0,
      "use": "NOT USED in PLC code (only declared)"
     }
    ]
   }
  ]
 },
 {
  "id": "io",
  "hmi": "IO (73)",
  "title": "Wejścia / wyjścia",
  "groups": [
   {
    "title": "WEJŚCIA - kolumna 1",
    "items": [
     {
      "k": "sel",
      "v": "HMI.iServiceSafetyReady",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "Gotowosc Safety - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xSafetyReady",
      "t": "BOOL",
      "label": "Gotowosc Safety - stan wejścia",
      "use": "written in: IO/IO; read in: Alarms/Alarms, Alarms/Stop, CyclicTasks/CutST, GoToPosition/GoToPositionST"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceAxisSawReady",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "Gotowosc napędu Głownego - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xAxisSawReady",
      "t": "BOOL",
      "label": "Gotowosc napędu Głownego - stan wejścia",
      "use": "written in: IO/IO; never read by PLC"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceSafetyAck",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "Alarm Reset - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xSafetyReady",
      "t": "BOOL",
      "label": "Alarm Reset - stan wejścia",
      "use": "written in: IO/IO; read in: Alarms/Alarms, Alarms/Stop, CyclicTasks/CutST, GoToPosition/GoToPositionST"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceAlarmThermalSaw",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "termik piły - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xAlarmThermalSaw",
      "t": "BOOL",
      "label": "termik piły - stan wejścia",
      "use": "written in: IO/IO; read in: Alarms/Alarms"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceWaterSensorMill",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "CZUJNIK WODY FREZ - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xSensorWaterMill",
      "t": "BOOL",
      "label": "CZUJNIK WODY FREZ - stan wejścia",
      "use": "written in: IO/IO; read in: Alarms/Alarms"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceWaterSensorCut",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "CZUJNIK WODY PILA - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xSensorWaterCut",
      "t": "BOOL",
      "label": "CZUJNIK WODY PILA - stan wejścia",
      "use": "written in: IO/IO; read in: Alarms/Alarms"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceToolMeasureStart",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "CZUJNIK POMIARU NARZĘDZIA TOP - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xToolMeasureStart",
      "t": "BOOL",
      "label": "CZUJNIK POMIARU NARZĘDZIA TOP - stan wejścia",
      "use": "written in: IO/IO; read in: MeasureTool/MeasureToolReferenceST, MeasureTool/MeasureToolST"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceToolMeasureEnd",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "CZUJNIK POMIARU NARZĘDZIA DÓŁ - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xToolMeasureEnd",
      "t": "BOOL",
      "label": "CZUJNIK POMIARU NARZĘDZIA DÓŁ - stan wejścia",
      "use": "written in: IO/IO; never read by PLC"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceGrease",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "Smarowanie - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xGrease",
      "t": "BOOL",
      "label": "Smarowanie - stan wejścia",
      "use": "written in: IO/IO; read in: Alarms/Alarms"
     }
    ]
   },
   {
    "title": "WEJŚCIA PULPITU ROZSZERZONEGO (szara ramka gdy bServiceAdvancedDesktop = FALSE)",
    "items": [
     {
      "k": "sel",
      "v": "HMI.iServiceStartProgram",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "START PROGRAM - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xStartProgram",
      "t": "BOOL",
      "label": "START PROGRAM - stan wejścia",
      "use": "written in: IO/IO; read in: IO/IO"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceStopProgram",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "STOP PROGRAM - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xStopProgram",
      "t": "BOOL",
      "label": "STOP PROGRAM - stan wejścia",
      "use": "written in: IO/IO; read in: IO/IO"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceStartMainDrive",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "START NAPĘD GŁOWNY - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xStartMainDrive",
      "t": "BOOL",
      "label": "START NAPĘD GŁOWNY - stan wejścia",
      "use": "written in: IO/IO; read in: IO/IO"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceStopMainDrive",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "STOP NAPĘD GŁÓWNY - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xStopMainDrive",
      "t": "BOOL",
      "label": "STOP NAPĘD GŁÓWNY - stan wejścia",
      "use": "written in: IO/IO; read in: IO/IO"
     }
    ]
   },
   {
    "title": "WYJŚCIA - kolumna 2",
    "items": [
     {
      "k": "sel",
      "v": "HMI.iServiceAxisBRunStop",
      "t": "Outputs",
      "o": [
       [
        0,
        "Y0.0"
       ],
       [
        1,
        "Y0.1"
       ],
       [
        2,
        "Y0.2"
       ],
       [
        3,
        "Y0.3"
       ],
       [
        4,
        "Y0.4"
       ],
       [
        5,
        "Y0.5"
       ],
       [
        6,
        "Y0.6"
       ],
       [
        7,
        "Y0.7"
       ]
      ],
      "label": "WYCHYL RUN/STOP - adres wyjścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.yAxisBRunStop",
      "t": "BOOL",
      "label": "WYCHYL RUN/STOP - stan wyjścia",
      "use": "written in: Alarms/ResetLogicCommands, Alarms/ResetMotionCommands, Manual/Inverters, Settings/BreaksAxisST; read in: IO/IO, Manual/Inverters, Settings/Encoders"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceLaser",
      "t": "Outputs",
      "o": [
       [
        0,
        "Y0.0"
       ],
       [
        1,
        "Y0.1"
       ],
       [
        2,
        "Y0.2"
       ],
       [
        3,
        "Y0.3"
       ],
       [
        4,
        "Y0.4"
       ],
       [
        5,
        "Y0.5"
       ],
       [
        6,
        "Y0.6"
       ],
       [
        7,
        "Y0.7"
       ]
      ],
      "label": "LASER - adres wyjścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.yLaser",
      "t": "BOOL",
      "label": "LASER - stan wyjścia",
      "use": "written in: Manual/ManualLaserST; read in: IO/IO"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceAxisBFWDREV",
      "t": "Outputs",
      "o": [
       [
        0,
        "Y0.0"
       ],
       [
        1,
        "Y0.1"
       ],
       [
        2,
        "Y0.2"
       ],
       [
        3,
        "Y0.3"
       ],
       [
        4,
        "Y0.4"
       ],
       [
        5,
        "Y0.5"
       ],
       [
        6,
        "Y0.6"
       ],
       [
        7,
        "Y0.7"
       ]
      ],
      "label": "WYCHYŁ FWD/REV - adres wyjścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.yAxisBFWDREV",
      "t": "BOOL",
      "label": "WYCHYŁ FWD/REV - stan wyjścia",
      "use": "written in: Alarms/ResetMotionCommands, Manual/Inverters; read in: IO/IO, Manual/Inverters"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceWaterCut",
      "t": "Outputs",
      "o": [
       [
        0,
        "Y0.0"
       ],
       [
        1,
        "Y0.1"
       ],
       [
        2,
        "Y0.2"
       ],
       [
        3,
        "Y0.3"
       ],
       [
        4,
        "Y0.4"
       ],
       [
        5,
        "Y0.5"
       ],
       [
        6,
        "Y0.6"
       ],
       [
        7,
        "Y0.7"
       ]
      ],
      "label": "WODA CIECIE - adres wyjścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.yWaterCut",
      "t": "BOOL",
      "label": "WODA CIECIE - stan wyjścia",
      "use": "written in: Alarms/Pause, Alarms/ResetLogicCommands, Alarms/Stop, CutArcST/MoveToStartPosition, CutCircleST/MoveToStartPosition, CutElipseST/MoveToStartPosition, CutST/MoveToStartPosition, CyclicTask/MillBlocksST (+20 more); read in: Alarms/Alarms, BaseHoming/BaseHomingST, CyclicTasks/CutElipseST, IO/IO"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceAxisBMulti1",
      "t": "Outputs",
      "o": [
       [
        0,
        "Y0.0"
       ],
       [
        1,
        "Y0.1"
       ],
       [
        2,
        "Y0.2"
       ],
       [
        3,
        "Y0.3"
       ],
       [
        4,
        "Y0.4"
       ],
       [
        5,
        "Y0.5"
       ],
       [
        6,
        "Y0.6"
       ],
       [
        7,
        "Y0.7"
       ]
      ],
      "label": "WYCHYL MULTI1 - adres wyjścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.yAxisBMulti1",
      "t": "BOOL",
      "label": "WYCHYL MULTI1 - stan wyjścia",
      "use": "written in: Alarms/ResetMotionCommands, Manual/Inverters; read in: IO/IO"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceBreakBAxis",
      "t": "Outputs",
      "o": [
       [
        0,
        "Y0.0"
       ],
       [
        1,
        "Y0.1"
       ],
       [
        2,
        "Y0.2"
       ],
       [
        3,
        "Y0.3"
       ],
       [
        4,
        "Y0.4"
       ],
       [
        5,
        "Y0.5"
       ],
       [
        6,
        "Y0.6"
       ],
       [
        7,
        "Y0.7"
       ]
      ],
      "label": "WYCHYL HAMULEC - adres wyjścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.yBreakBAxis",
      "t": "BOOL",
      "label": "WYCHYL HAMULEC - stan wyjścia",
      "use": "written in: Settings/BreaksAxisST; read in: IO/IO, Manual/Inverters, Settings/BreaksAxisST, Settings/Encoders"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceWaterMill",
      "t": "Outputs",
      "o": [
       [
        0,
        "Y0.0"
       ],
       [
        1,
        "Y0.1"
       ],
       [
        2,
        "Y0.2"
       ],
       [
        3,
        "Y0.3"
       ],
       [
        4,
        "Y0.4"
       ],
       [
        5,
        "Y0.5"
       ],
       [
        6,
        "Y0.6"
       ],
       [
        7,
        "Y0.7"
       ]
      ],
      "label": "WODA FREZ - adres wyjścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.yWaterMill",
      "t": "BOOL",
      "label": "WODA FREZ - stan wyjścia",
      "use": "written in: Alarms/Pause, Alarms/ResetLogicCommands, Alarms/Stop, CyclicTask/MillArcST, CyclicTask/MillCircleST, CyclicTask/MillElipseST, CyclicTask/MillST, CyclicTask/MillShapeST (+15 more); read in: Alarms/Alarms, CyclicTask/MillArcST, CyclicTask/MillCircleST, CyclicTask/MillElipseST, Drill/DrillST, Drill/DrillSimpleST, IO/IO, MillShapeST/IsDriveReady (+1 more)"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceAxisBMulti2",
      "t": "Outputs",
      "o": [
       [
        0,
        "Y0.0"
       ],
       [
        1,
        "Y0.1"
       ],
       [
        2,
        "Y0.2"
       ],
       [
        3,
        "Y0.3"
       ],
       [
        4,
        "Y0.4"
       ],
       [
        5,
        "Y0.5"
       ],
       [
        6,
        "Y0.6"
       ],
       [
        7,
        "Y0.7"
       ]
      ],
      "label": "WYCHYL MULTI 2 - adres wyjścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.yAxisBMulti2",
      "t": "BOOL",
      "label": "WYCHYL MULTI 2 - stan wyjścia",
      "use": "written in: Alarms/ResetMotionCommands, Manual/Inverters; read in: IO/IO"
     }
    ]
   },
   {
    "title": "WEJŚCIA MPG (szara ramka gdy bMPGBasic = FALSE)",
    "items": [
     {
      "k": "sel",
      "v": "HMI.iServiceMPGConfig1",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "MPG AX1 - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xMPGConfig1",
      "t": "BOOL",
      "label": "MPG AX1 - stan wejścia",
      "use": "written in: IO/IO; read in: Manual/ManualST"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceMPGConfig2",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "MPG AX2 - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xMPGConfig2",
      "t": "BOOL",
      "label": "MPG AX2 - stan wejścia",
      "use": "written in: IO/IO; read in: Manual/ManualST"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceMPGMoveLeft",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "MPG LEWO - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xMPGMoveLeft",
      "t": "BOOL",
      "label": "MPG LEWO - stan wejścia",
      "use": "written in: IO/IO; read in: Manual/ManualST, Settings/Status"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceMPGMoveRight",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "MPG PRAWO - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xLimitSwitchBAxisRight",
      "t": "BOOL",
      "label": "MPG PRAWO - stan wejścia",
      "use": "written in: IO/IO; read in: Manual/ManualST"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceMPGEnable",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "MPG ENABLE - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xMPGEnable",
      "t": "BOOL",
      "label": "MPG ENABLE - stan wejścia",
      "use": "written in: IO/IO; never read by PLC"
     }
    ]
   },
   {
    "title": "WEJŚCIA PILOTA BEZPRZEWODOWEGO X+..B- (szara ramka gdy bMPGBasic = TRUE)",
    "items": [
     {
      "k": "sel",
      "v": "HMI.iServiceXPlus",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "X+ - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xXPlus",
      "t": "BOOL",
      "label": "X+ - stan wejścia",
      "use": "written in: IO/IO; read in: Manual/ManualInterpolationST, Manual/ManualST"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceXMinus",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "X- - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xXMinus",
      "t": "BOOL",
      "label": "X- - stan wejścia",
      "use": "written in: IO/IO; read in: Manual/ManualInterpolationST, Manual/ManualST"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceYPlus",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "Y+ - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xYPlus",
      "t": "BOOL",
      "label": "Y+ - stan wejścia",
      "use": "written in: IO/IO; read in: Manual/ManualInterpolationST, Manual/ManualST"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceYMinus",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "Y- - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xYMinus",
      "t": "BOOL",
      "label": "Y- - stan wejścia",
      "use": "written in: IO/IO; read in: Manual/ManualInterpolationST, Manual/ManualST"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceZPlus",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "Z+ - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xZPlus",
      "t": "BOOL",
      "label": "Z+ - stan wejścia",
      "use": "written in: IO/IO; read in: Manual/ManualST"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceZMinus",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "Z- - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xZMinus",
      "t": "BOOL",
      "label": "Z- - stan wejścia",
      "use": "written in: IO/IO; read in: Manual/ManualST"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceAPlus",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "A+ - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xAPlus",
      "t": "BOOL",
      "label": "A+ - stan wejścia",
      "use": "written in: IO/IO; read in: Manual/ManualST, Settings/BreaksAxisST"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceAMinus",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "A- - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xAMinus",
      "t": "BOOL",
      "label": "A- - stan wejścia",
      "use": "written in: IO/IO; read in: Manual/ManualST, Settings/BreaksAxisST"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceBPlus",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "B+ - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xBPlus",
      "t": "BOOL",
      "label": "B+ - stan wejścia",
      "use": "written in: IO/IO; read in: Manual/ManualST, Settings/BreaksAxisST"
     },
     {
      "k": "sel",
      "v": "HMI.iServiceBMinus",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ]
      ],
      "label": "B- - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xBMinus",
      "t": "BOOL",
      "label": "B- - stan wejścia",
      "use": "written in: IO/IO; read in: Manual/ManualST, Settings/BreaksAxisST"
     }
    ]
   },
   {
    "title": "ANALOGI - prędkości",
    "items": [
     {
      "k": "display",
      "v": "HMI2.fVelocityFastAnalog",
      "t": "UINT",
      "label": "PRZESUW SZYBKI",
      "dec": 0,
      "use": "UINT raw analog value (not written in ST code - filled by I/O mapping); VelocityAcceleration: if > 32760 -> fVelocityFast / Z approach & jog speed from the rapid-traverse pot."
     },
     {
      "k": "display",
      "v": "HMI2.fVelocityWorkAnalog",
      "t": "UINT",
      "label": "PRZESUW ROBOCZY",
      "dec": 0,
      "use": "UINT raw analog value (I/O mapping); VelocityAcceleration: if > 32760 -> fVelocitySawMode / fVelocityMillMode / feed override from the working-speed pot."
     },
     {
      "k": "display",
      "v": "HMI2.fVelocityMainDriveAnalog",
      "t": "UINT",
      "label": "NAPED GŁOWNY",
      "dec": 0,
      "use": "UINT raw analog value (I/O mapping); VelocityAcceleration: if > 32760 -> fVelocityMainDrive := pot% * fMaxVelocityMainDrive."
     }
    ]
   },
   {
    "title": "Konfiguracja pulpitu/pilota + nawigacja (dolny pasek)",
    "items": [
     {
      "k": "bit",
      "v": "HMI.bServiceAdvancedDesktop",
      "t": "BOOL",
      "off": "PULPIT PROSTY",
      "on": "PULPIT ROZSZERZONY",
      "use": "IO: TRUE = extended desk: START/STOP PROGRAM and START/STOP MAIN DRIVE inputs are evaluated (start of the function of the current screen, bStopMachine, bManualMainDriveOn)."
     },
     {
      "k": "bit",
      "v": "HMI.bMPGBasic",
      "t": "BOOL",
      "off": "PILOT BEZPRZEWODOWY Z PRZYCISKAMI",
      "on": "PILOT PROSTY Z PRZYCISKAMI",
      "init": true,
      "use": "IO: TRUE = simple MPG (wireless-pilot inputs X+..B- forced FALSE); ManualST selects MPG handling."
     },
     {
      "k": "lamp",
      "v": "HMI.bServiceOutputModule",
      "t": "BOOL",
      "label": "MODUŁ WYJŚĆ IO (R1-EC70A2 wykryty)",
      "init": true,
      "use": "IO: written every scan = R1-EC70A2 output module present; then outputs use the fixed legacy map and the output combos are ignored."
     },
     {
      "k": "goto",
      "label": "IO POLEROWANIE",
      "vis": "HMI.bServicePolishing = TRUE",
      "hmi": "IO Polerowanie (69)",
      "page": "ioPolish"
     }
    ]
   }
  ]
 },
 {
  "id": "ioPolish",
  "hmi": "IO Polerowanie (69)",
  "title": "Wejścia / wyjścia – polerowanie",
  "groups": [
   {
    "title": "WEJŚCIA POLEROWANIE",
    "items": [
     {
      "k": "sel",
      "v": "HMI.iServicePolishingSensorEjectorOpen",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ],
       [
        24,
        "X2.0"
       ],
       [
        25,
        "X2.1"
       ],
       [
        26,
        "X2.2"
       ],
       [
        27,
        "X2.3"
       ],
       [
        28,
        "X2.4"
       ],
       [
        29,
        "X2.5"
       ],
       [
        30,
        "X2.6"
       ],
       [
        31,
        "X2.7"
       ],
       [
        32,
        "X2.8"
       ],
       [
        33,
        "X2.9"
       ],
       [
        34,
        "X2.10"
       ],
       [
        35,
        "X2.11"
       ],
       [
        36,
        "X2.12"
       ],
       [
        37,
        "X2.13"
       ],
       [
        38,
        "X2.14"
       ],
       [
        39,
        "X2.15"
       ],
       [
        40,
        "X3.0"
       ],
       [
        41,
        "X3.1"
       ],
       [
        42,
        "X3.2"
       ],
       [
        43,
        "X3.3"
       ],
       [
        44,
        "X3.4"
       ],
       [
        45,
        "X3.5"
       ],
       [
        46,
        "X3.6"
       ],
       [
        47,
        "X3.7"
       ],
       [
        48,
        "X3.8"
       ],
       [
        49,
        "X3.9"
       ]
      ],
      "label": "Polerowanie Osłona Otwarta - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xPolishingSensorEjectorOpen",
      "t": "BOOL",
      "label": "Polerowanie Osłona Otwarta - stan wejścia",
      "use": "written in: IO/IO; read in: Polishing/PolishingToolChange"
     },
     {
      "k": "sel",
      "v": "HMI.iServicePolishingSensorEjectorClose",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ],
       [
        24,
        "X2.0"
       ],
       [
        25,
        "X2.1"
       ],
       [
        26,
        "X2.2"
       ],
       [
        27,
        "X2.3"
       ],
       [
        28,
        "X2.4"
       ],
       [
        29,
        "X2.5"
       ],
       [
        30,
        "X2.6"
       ],
       [
        31,
        "X2.7"
       ],
       [
        32,
        "X2.8"
       ],
       [
        33,
        "X2.9"
       ],
       [
        34,
        "X2.10"
       ],
       [
        35,
        "X2.11"
       ],
       [
        36,
        "X2.12"
       ],
       [
        37,
        "X2.13"
       ],
       [
        38,
        "X2.14"
       ],
       [
        39,
        "X2.15"
       ],
       [
        40,
        "X3.0"
       ],
       [
        41,
        "X3.1"
       ],
       [
        42,
        "X3.2"
       ],
       [
        43,
        "X3.3"
       ],
       [
        44,
        "X3.4"
       ],
       [
        45,
        "X3.5"
       ],
       [
        46,
        "X3.6"
       ],
       [
        47,
        "X3.7"
       ],
       [
        48,
        "X3.8"
       ],
       [
        49,
        "X3.9"
       ]
      ],
      "label": "Polerowanie Osłona Zamknięta - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xPolishingSensorEjectorClose",
      "t": "BOOL",
      "label": "Polerowanie Osłona Zamknięta - stan wejścia",
      "use": "written in: IO/IO; read in: Polishing/PolishingToolChange"
     },
     {
      "k": "sel",
      "v": "HMI.iServicePolishingSensorWater",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ],
       [
        24,
        "X2.0"
       ],
       [
        25,
        "X2.1"
       ],
       [
        26,
        "X2.2"
       ],
       [
        27,
        "X2.3"
       ],
       [
        28,
        "X2.4"
       ],
       [
        29,
        "X2.5"
       ],
       [
        30,
        "X2.6"
       ],
       [
        31,
        "X2.7"
       ],
       [
        32,
        "X2.8"
       ],
       [
        33,
        "X2.9"
       ],
       [
        34,
        "X2.10"
       ],
       [
        35,
        "X2.11"
       ],
       [
        36,
        "X2.12"
       ],
       [
        37,
        "X2.13"
       ],
       [
        38,
        "X2.14"
       ],
       [
        39,
        "X2.15"
       ],
       [
        40,
        "X3.0"
       ],
       [
        41,
        "X3.1"
       ],
       [
        42,
        "X3.2"
       ],
       [
        43,
        "X3.3"
       ],
       [
        44,
        "X3.4"
       ],
       [
        45,
        "X3.5"
       ],
       [
        46,
        "X3.6"
       ],
       [
        47,
        "X3.7"
       ],
       [
        48,
        "X3.8"
       ],
       [
        49,
        "X3.9"
       ]
      ],
      "label": "Polerowanie Woda w SIlniku - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xPolishingSensorWater",
      "t": "BOOL",
      "label": "Polerowanie Woda w SIlniku - stan wejścia",
      "use": "written in: IO/IO; never read by PLC"
     },
     {
      "k": "sel",
      "v": "HMI.iServicePolishingSensorToolIn",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ],
       [
        24,
        "X2.0"
       ],
       [
        25,
        "X2.1"
       ],
       [
        26,
        "X2.2"
       ],
       [
        27,
        "X2.3"
       ],
       [
        28,
        "X2.4"
       ],
       [
        29,
        "X2.5"
       ],
       [
        30,
        "X2.6"
       ],
       [
        31,
        "X2.7"
       ],
       [
        32,
        "X2.8"
       ],
       [
        33,
        "X2.9"
       ],
       [
        34,
        "X2.10"
       ],
       [
        35,
        "X2.11"
       ],
       [
        36,
        "X2.12"
       ],
       [
        37,
        "X2.13"
       ],
       [
        38,
        "X2.14"
       ],
       [
        39,
        "X2.15"
       ],
       [
        40,
        "X3.0"
       ],
       [
        41,
        "X3.1"
       ],
       [
        42,
        "X3.2"
       ],
       [
        43,
        "X3.3"
       ],
       [
        44,
        "X3.4"
       ],
       [
        45,
        "X3.5"
       ],
       [
        46,
        "X3.6"
       ],
       [
        47,
        "X3.7"
       ],
       [
        48,
        "X3.8"
       ],
       [
        49,
        "X3.9"
       ]
      ],
      "label": "Polerowanie Narzędzie Zamontowane - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xPolishingSensorToolIn",
      "t": "BOOL",
      "label": "Polerowanie Narzędzie Zamontowane - stan wejścia",
      "use": "written in: IO/IO; read in: Polishing/PolishingToolChange"
     },
     {
      "k": "sel",
      "v": "HMI.iServicePolishingSensorToolUnlocked",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ],
       [
        24,
        "X2.0"
       ],
       [
        25,
        "X2.1"
       ],
       [
        26,
        "X2.2"
       ],
       [
        27,
        "X2.3"
       ],
       [
        28,
        "X2.4"
       ],
       [
        29,
        "X2.5"
       ],
       [
        30,
        "X2.6"
       ],
       [
        31,
        "X2.7"
       ],
       [
        32,
        "X2.8"
       ],
       [
        33,
        "X2.9"
       ],
       [
        34,
        "X2.10"
       ],
       [
        35,
        "X2.11"
       ],
       [
        36,
        "X2.12"
       ],
       [
        37,
        "X2.13"
       ],
       [
        38,
        "X2.14"
       ],
       [
        39,
        "X2.15"
       ],
       [
        40,
        "X3.0"
       ],
       [
        41,
        "X3.1"
       ],
       [
        42,
        "X3.2"
       ],
       [
        43,
        "X3.3"
       ],
       [
        44,
        "X3.4"
       ],
       [
        45,
        "X3.5"
       ],
       [
        46,
        "X3.6"
       ],
       [
        47,
        "X3.7"
       ],
       [
        48,
        "X3.8"
       ],
       [
        49,
        "X3.9"
       ]
      ],
      "label": "Polerowanie Narzędzie Odblokowane - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xPolishingSensorToolUnlocked",
      "t": "BOOL",
      "label": "Polerowanie Narzędzie Odblokowane - stan wejścia",
      "use": "written in: IO/IO; never read by PLC"
     },
     {
      "k": "sel",
      "v": "HMI.iServicePolishingSensorToolMissing",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ],
       [
        24,
        "X2.0"
       ],
       [
        25,
        "X2.1"
       ],
       [
        26,
        "X2.2"
       ],
       [
        27,
        "X2.3"
       ],
       [
        28,
        "X2.4"
       ],
       [
        29,
        "X2.5"
       ],
       [
        30,
        "X2.6"
       ],
       [
        31,
        "X2.7"
       ],
       [
        32,
        "X2.8"
       ],
       [
        33,
        "X2.9"
       ],
       [
        34,
        "X2.10"
       ],
       [
        35,
        "X2.11"
       ],
       [
        36,
        "X2.12"
       ],
       [
        37,
        "X2.13"
       ],
       [
        38,
        "X2.14"
       ],
       [
        39,
        "X2.15"
       ],
       [
        40,
        "X3.0"
       ],
       [
        41,
        "X3.1"
       ],
       [
        42,
        "X3.2"
       ],
       [
        43,
        "X3.3"
       ],
       [
        44,
        "X3.4"
       ],
       [
        45,
        "X3.5"
       ],
       [
        46,
        "X3.6"
       ],
       [
        47,
        "X3.7"
       ],
       [
        48,
        "X3.8"
       ],
       [
        49,
        "X3.9"
       ]
      ],
      "label": "Polerowanie Brak Narzędzia - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xPolishingSensorToolMissing",
      "t": "BOOL",
      "label": "Polerowanie Brak Narzędzia - stan wejścia",
      "use": "written in: IO/IO; read in: Polishing/PolishingToolChange"
     },
     {
      "k": "sel",
      "v": "HMI.iServicePolishingSensorPressure",
      "t": "Inputs",
      "o": [
       [
        0,
        "X0.0"
       ],
       [
        1,
        "X0.1"
       ],
       [
        2,
        "X0.2"
       ],
       [
        3,
        "X0.3"
       ],
       [
        4,
        "X0.4"
       ],
       [
        5,
        "X0.5"
       ],
       [
        6,
        "X0.6"
       ],
       [
        7,
        "X0.7"
       ],
       [
        8,
        "X1.0"
       ],
       [
        9,
        "X1.1"
       ],
       [
        10,
        "X1.2"
       ],
       [
        11,
        "X1.3"
       ],
       [
        12,
        "X1.4"
       ],
       [
        13,
        "X1.5"
       ],
       [
        14,
        "X1.6"
       ],
       [
        15,
        "X1.7"
       ],
       [
        16,
        "X1.8"
       ],
       [
        17,
        "X1.9"
       ],
       [
        18,
        "X1.10"
       ],
       [
        19,
        "X1.11"
       ],
       [
        20,
        "X1.12"
       ],
       [
        21,
        "X1.13"
       ],
       [
        22,
        "X1.14"
       ],
       [
        23,
        "X1.15"
       ],
       [
        24,
        "X2.0"
       ],
       [
        25,
        "X2.1"
       ],
       [
        26,
        "X2.2"
       ],
       [
        27,
        "X2.3"
       ],
       [
        28,
        "X2.4"
       ],
       [
        29,
        "X2.5"
       ],
       [
        30,
        "X2.6"
       ],
       [
        31,
        "X2.7"
       ],
       [
        32,
        "X2.8"
       ],
       [
        33,
        "X2.9"
       ],
       [
        34,
        "X2.10"
       ],
       [
        35,
        "X2.11"
       ],
       [
        36,
        "X2.12"
       ],
       [
        37,
        "X2.13"
       ],
       [
        38,
        "X2.14"
       ],
       [
        39,
        "X2.15"
       ],
       [
        40,
        "X3.0"
       ],
       [
        41,
        "X3.1"
       ],
       [
        42,
        "X3.2"
       ],
       [
        43,
        "X3.3"
       ],
       [
        44,
        "X3.4"
       ],
       [
        45,
        "X3.5"
       ],
       [
        46,
        "X3.6"
       ],
       [
        47,
        "X3.7"
       ],
       [
        48,
        "X3.8"
       ],
       [
        49,
        "X3.9"
       ]
      ],
      "label": "Polerowanie Czujnik Ciśnienia - adres wejścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.xPolishingSensorPressure",
      "t": "BOOL",
      "label": "Polerowanie Czujnik Ciśnienia - stan wejścia",
      "use": "written in: IO/IO; read in: Alarms/Alarms"
     }
    ]
   },
   {
    "title": "WYJŚCIA POLEROWANIE",
    "items": [
     {
      "k": "sel",
      "v": "HMI.iServicePolishingPressureTool1",
      "t": "Outputs",
      "o": [
       [
        0,
        "Y0.0"
       ],
       [
        1,
        "Y0.1"
       ],
       [
        2,
        "Y0.2"
       ],
       [
        3,
        "Y0.3"
       ],
       [
        4,
        "Y0.4"
       ],
       [
        5,
        "Y0.5"
       ],
       [
        6,
        "Y0.6"
       ],
       [
        7,
        "Y0.7"
       ],
       [
        8,
        "Y1.0"
       ],
       [
        9,
        "Y1.1"
       ],
       [
        10,
        "Y1.2"
       ],
       [
        11,
        "Y1.3"
       ],
       [
        12,
        "Y1.4"
       ],
       [
        13,
        "Y1.5"
       ],
       [
        14,
        "Y1.6"
       ],
       [
        15,
        "Y1.7"
       ],
       [
        16,
        "Y1.8"
       ],
       [
        17,
        "Y1.9"
       ],
       [
        18,
        "Y1.10"
       ],
       [
        19,
        "Y1.11"
       ],
       [
        20,
        "Y1.12"
       ],
       [
        21,
        "Y1.13"
       ],
       [
        22,
        "Y1.14"
       ],
       [
        23,
        "Y1.15"
       ],
       [
        24,
        "Y2.0"
       ],
       [
        25,
        "Y2.1"
       ],
       [
        26,
        "Y2.2"
       ],
       [
        27,
        "Y2.3"
       ],
       [
        28,
        "Y2.4"
       ],
       [
        29,
        "Y2.5"
       ],
       [
        30,
        "Y2.6"
       ],
       [
        31,
        "Y2.7"
       ],
       [
        32,
        "Y2.8"
       ],
       [
        33,
        "Y2.9"
       ],
       [
        34,
        "Y2.10"
       ],
       [
        35,
        "Y2.11"
       ],
       [
        36,
        "Y2.12"
       ],
       [
        37,
        "Y2.13"
       ],
       [
        38,
        "Y2.14"
       ],
       [
        39,
        "Y2.15"
       ],
       [
        40,
        "Y3.0"
       ],
       [
        41,
        "Y3.1"
       ],
       [
        42,
        "Y3.2"
       ],
       [
        43,
        "Y3.3"
       ],
       [
        44,
        "Y3.4"
       ],
       [
        45,
        "Y3.5"
       ],
       [
        46,
        "Y3.6"
       ],
       [
        47,
        "Y3.7"
       ],
       [
        48,
        "Y3.8"
       ],
       [
        49,
        "Y3.9"
       ]
      ],
      "label": "Polerowanie Narzedzie 1 - adres wyjścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.yPolishingPressureTool1",
      "t": "BOOL",
      "label": "Polerowanie Narzedzie 1 - stan wyjścia",
      "use": "written in: Polishing/PolishingToolChange; read in: IO/IO"
     },
     {
      "k": "sel",
      "v": "HMI.iServicePolishingPressureTool2",
      "t": "Outputs",
      "o": [
       [
        0,
        "Y0.0"
       ],
       [
        1,
        "Y0.1"
       ],
       [
        2,
        "Y0.2"
       ],
       [
        3,
        "Y0.3"
       ],
       [
        4,
        "Y0.4"
       ],
       [
        5,
        "Y0.5"
       ],
       [
        6,
        "Y0.6"
       ],
       [
        7,
        "Y0.7"
       ],
       [
        8,
        "Y1.0"
       ],
       [
        9,
        "Y1.1"
       ],
       [
        10,
        "Y1.2"
       ],
       [
        11,
        "Y1.3"
       ],
       [
        12,
        "Y1.4"
       ],
       [
        13,
        "Y1.5"
       ],
       [
        14,
        "Y1.6"
       ],
       [
        15,
        "Y1.7"
       ],
       [
        16,
        "Y1.8"
       ],
       [
        17,
        "Y1.9"
       ],
       [
        18,
        "Y1.10"
       ],
       [
        19,
        "Y1.11"
       ],
       [
        20,
        "Y1.12"
       ],
       [
        21,
        "Y1.13"
       ],
       [
        22,
        "Y1.14"
       ],
       [
        23,
        "Y1.15"
       ],
       [
        24,
        "Y2.0"
       ],
       [
        25,
        "Y2.1"
       ],
       [
        26,
        "Y2.2"
       ],
       [
        27,
        "Y2.3"
       ],
       [
        28,
        "Y2.4"
       ],
       [
        29,
        "Y2.5"
       ],
       [
        30,
        "Y2.6"
       ],
       [
        31,
        "Y2.7"
       ],
       [
        32,
        "Y2.8"
       ],
       [
        33,
        "Y2.9"
       ],
       [
        34,
        "Y2.10"
       ],
       [
        35,
        "Y2.11"
       ],
       [
        36,
        "Y2.12"
       ],
       [
        37,
        "Y2.13"
       ],
       [
        38,
        "Y2.14"
       ],
       [
        39,
        "Y2.15"
       ],
       [
        40,
        "Y3.0"
       ],
       [
        41,
        "Y3.1"
       ],
       [
        42,
        "Y3.2"
       ],
       [
        43,
        "Y3.3"
       ],
       [
        44,
        "Y3.4"
       ],
       [
        45,
        "Y3.5"
       ],
       [
        46,
        "Y3.6"
       ],
       [
        47,
        "Y3.7"
       ],
       [
        48,
        "Y3.8"
       ],
       [
        49,
        "Y3.9"
       ]
      ],
      "label": "Polerowanie Narzedzie 2 - adres wyjścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.yPolishingPressureTool2",
      "t": "BOOL",
      "label": "Polerowanie Narzedzie 2 - stan wyjścia",
      "use": "written in: Polishing/PolishingToolChange; read in: IO/IO"
     },
     {
      "k": "sel",
      "v": "HMI.iServicePolishingPressureMainDrive",
      "t": "Outputs",
      "o": [
       [
        0,
        "Y0.0"
       ],
       [
        1,
        "Y0.1"
       ],
       [
        2,
        "Y0.2"
       ],
       [
        3,
        "Y0.3"
       ],
       [
        4,
        "Y0.4"
       ],
       [
        5,
        "Y0.5"
       ],
       [
        6,
        "Y0.6"
       ],
       [
        7,
        "Y0.7"
       ],
       [
        8,
        "Y1.0"
       ],
       [
        9,
        "Y1.1"
       ],
       [
        10,
        "Y1.2"
       ],
       [
        11,
        "Y1.3"
       ],
       [
        12,
        "Y1.4"
       ],
       [
        13,
        "Y1.5"
       ],
       [
        14,
        "Y1.6"
       ],
       [
        15,
        "Y1.7"
       ],
       [
        16,
        "Y1.8"
       ],
       [
        17,
        "Y1.9"
       ],
       [
        18,
        "Y1.10"
       ],
       [
        19,
        "Y1.11"
       ],
       [
        20,
        "Y1.12"
       ],
       [
        21,
        "Y1.13"
       ],
       [
        22,
        "Y1.14"
       ],
       [
        23,
        "Y1.15"
       ],
       [
        24,
        "Y2.0"
       ],
       [
        25,
        "Y2.1"
       ],
       [
        26,
        "Y2.2"
       ],
       [
        27,
        "Y2.3"
       ],
       [
        28,
        "Y2.4"
       ],
       [
        29,
        "Y2.5"
       ],
       [
        30,
        "Y2.6"
       ],
       [
        31,
        "Y2.7"
       ],
       [
        32,
        "Y2.8"
       ],
       [
        33,
        "Y2.9"
       ],
       [
        34,
        "Y2.10"
       ],
       [
        35,
        "Y2.11"
       ],
       [
        36,
        "Y2.12"
       ],
       [
        37,
        "Y2.13"
       ],
       [
        38,
        "Y2.14"
       ],
       [
        39,
        "Y2.15"
       ],
       [
        40,
        "Y3.0"
       ],
       [
        41,
        "Y3.1"
       ],
       [
        42,
        "Y3.2"
       ],
       [
        43,
        "Y3.3"
       ],
       [
        44,
        "Y3.4"
       ],
       [
        45,
        "Y3.5"
       ],
       [
        46,
        "Y3.6"
       ],
       [
        47,
        "Y3.7"
       ],
       [
        48,
        "Y3.8"
       ],
       [
        49,
        "Y3.9"
       ]
      ],
      "label": "Polerowanie Przedmuch - adres wyjścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.yPolishingPressureMainDrive",
      "t": "BOOL",
      "label": "Polerowanie Przedmuch - stan wyjścia",
      "use": "written in: Alarms/Pause, Alarms/Stop, Axis/SingleAxisMotion; read in: IO/IO"
     },
     {
      "k": "sel",
      "v": "HMI.iServicePolishingPressureEjectorOpen",
      "t": "Outputs",
      "o": [
       [
        0,
        "Y0.0"
       ],
       [
        1,
        "Y0.1"
       ],
       [
        2,
        "Y0.2"
       ],
       [
        3,
        "Y0.3"
       ],
       [
        4,
        "Y0.4"
       ],
       [
        5,
        "Y0.5"
       ],
       [
        6,
        "Y0.6"
       ],
       [
        7,
        "Y0.7"
       ],
       [
        8,
        "Y1.0"
       ],
       [
        9,
        "Y1.1"
       ],
       [
        10,
        "Y1.2"
       ],
       [
        11,
        "Y1.3"
       ],
       [
        12,
        "Y1.4"
       ],
       [
        13,
        "Y1.5"
       ],
       [
        14,
        "Y1.6"
       ],
       [
        15,
        "Y1.7"
       ],
       [
        16,
        "Y1.8"
       ],
       [
        17,
        "Y1.9"
       ],
       [
        18,
        "Y1.10"
       ],
       [
        19,
        "Y1.11"
       ],
       [
        20,
        "Y1.12"
       ],
       [
        21,
        "Y1.13"
       ],
       [
        22,
        "Y1.14"
       ],
       [
        23,
        "Y1.15"
       ],
       [
        24,
        "Y2.0"
       ],
       [
        25,
        "Y2.1"
       ],
       [
        26,
        "Y2.2"
       ],
       [
        27,
        "Y2.3"
       ],
       [
        28,
        "Y2.4"
       ],
       [
        29,
        "Y2.5"
       ],
       [
        30,
        "Y2.6"
       ],
       [
        31,
        "Y2.7"
       ],
       [
        32,
        "Y2.8"
       ],
       [
        33,
        "Y2.9"
       ],
       [
        34,
        "Y2.10"
       ],
       [
        35,
        "Y2.11"
       ],
       [
        36,
        "Y2.12"
       ],
       [
        37,
        "Y2.13"
       ],
       [
        38,
        "Y2.14"
       ],
       [
        39,
        "Y2.15"
       ],
       [
        40,
        "Y3.0"
       ],
       [
        41,
        "Y3.1"
       ],
       [
        42,
        "Y3.2"
       ],
       [
        43,
        "Y3.3"
       ],
       [
        44,
        "Y3.4"
       ],
       [
        45,
        "Y3.5"
       ],
       [
        46,
        "Y3.6"
       ],
       [
        47,
        "Y3.7"
       ],
       [
        48,
        "Y3.8"
       ],
       [
        49,
        "Y3.9"
       ]
      ],
      "label": "Polerowanie Osłona Otwórz - adres wyjścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.yPolishingPressureEjectorOpen",
      "t": "BOOL",
      "label": "Polerowanie Osłona Otwórz - stan wyjścia",
      "use": "written in: Polishing/PolishingToolChange; read in: IO/IO"
     },
     {
      "k": "sel",
      "v": "HMI.iServicePolishingPressureEjectorClose",
      "t": "Outputs",
      "o": [
       [
        0,
        "Y0.0"
       ],
       [
        1,
        "Y0.1"
       ],
       [
        2,
        "Y0.2"
       ],
       [
        3,
        "Y0.3"
       ],
       [
        4,
        "Y0.4"
       ],
       [
        5,
        "Y0.5"
       ],
       [
        6,
        "Y0.6"
       ],
       [
        7,
        "Y0.7"
       ],
       [
        8,
        "Y1.0"
       ],
       [
        9,
        "Y1.1"
       ],
       [
        10,
        "Y1.2"
       ],
       [
        11,
        "Y1.3"
       ],
       [
        12,
        "Y1.4"
       ],
       [
        13,
        "Y1.5"
       ],
       [
        14,
        "Y1.6"
       ],
       [
        15,
        "Y1.7"
       ],
       [
        16,
        "Y1.8"
       ],
       [
        17,
        "Y1.9"
       ],
       [
        18,
        "Y1.10"
       ],
       [
        19,
        "Y1.11"
       ],
       [
        20,
        "Y1.12"
       ],
       [
        21,
        "Y1.13"
       ],
       [
        22,
        "Y1.14"
       ],
       [
        23,
        "Y1.15"
       ],
       [
        24,
        "Y2.0"
       ],
       [
        25,
        "Y2.1"
       ],
       [
        26,
        "Y2.2"
       ],
       [
        27,
        "Y2.3"
       ],
       [
        28,
        "Y2.4"
       ],
       [
        29,
        "Y2.5"
       ],
       [
        30,
        "Y2.6"
       ],
       [
        31,
        "Y2.7"
       ],
       [
        32,
        "Y2.8"
       ],
       [
        33,
        "Y2.9"
       ],
       [
        34,
        "Y2.10"
       ],
       [
        35,
        "Y2.11"
       ],
       [
        36,
        "Y2.12"
       ],
       [
        37,
        "Y2.13"
       ],
       [
        38,
        "Y2.14"
       ],
       [
        39,
        "Y2.15"
       ],
       [
        40,
        "Y3.0"
       ],
       [
        41,
        "Y3.1"
       ],
       [
        42,
        "Y3.2"
       ],
       [
        43,
        "Y3.3"
       ],
       [
        44,
        "Y3.4"
       ],
       [
        45,
        "Y3.5"
       ],
       [
        46,
        "Y3.6"
       ],
       [
        47,
        "Y3.7"
       ],
       [
        48,
        "Y3.8"
       ],
       [
        49,
        "Y3.9"
       ]
      ],
      "label": "Polerowanie Osłona Zamknij - adres wyjścia (kombo)",
      "use": "never written by PLC; read in: IO/IO"
     },
     {
      "k": "lamp",
      "v": "IOVars.yPolishingPressureEjectorClose",
      "t": "BOOL",
      "label": "Polerowanie Osłona Zamknij - stan wyjścia",
      "use": "written in: Polishing/PolishingToolChange; read in: IO/IO"
     }
    ]
   },
   {
    "title": "Ekrany",
    "items": [
     {
      "k": "goto",
      "label": "IO",
      "hmi": "IO (73)",
      "page": "io"
     }
    ]
   }
  ]
 },
 {
  "id": "scaling",
  "hmi": "Skalowanie (74)",
  "title": "Skalowanie osi",
  "groups": [
   {
    "title": "Oś X (kolumna)",
    "items": [
     {
      "k": "num",
      "v": "HMI.fGearAxisX",
      "t": "LREAL",
      "label": "X - SKAL [mm/1obr.silnika]",
      "unit": "mm/1obr.silnika",
      "dec": 2,
      "min": -9999999.0,
      "max": 9999999.0,
      "use": "written in: Settings/AxisGear; read in: Settings/AxisGear, Settings/VelocityAcceleration"
     },
     {
      "k": "display",
      "v": "HMI2.fXActualPosition",
      "t": "LREAL",
      "label": "X - POZ. AKT. [mm]",
      "unit": "mm",
      "dec": 2,
      "use": "written in: Settings/ActualPosition; read in: Alarms/Alarms, CyclicTask/MillBlocksST, CyclicTask/MillElipseST, CyclicTask/MillST, CyclicTask/ProgramAutoCutST, CyclicTask/ProgramAutoMillST, CyclicTasks/CutBlocksST, CyclicTasks/CutElipseST (+14 more)"
     },
     {
      "k": "num",
      "v": "HMI2.fGearRatioXSetPosition",
      "t": "LREAL",
      "label": "X - PRZEJAZD ZADANY [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -9999.0,
      "max": 9999.0,
      "init": 1000.0,
      "use": "never written by PLC; read in: Settings/AxisGear"
     },
     {
      "k": "button",
      "v": "HMI2.bGearRatioXMoveToPosition",
      "t": "BOOL",
      "label": "X - START przejazdu zadanego",
      "use": "written in: Alarms/ResetLogicCommands, Settings/AxisGear; read in: Settings/AxisGear"
     },
     {
      "k": "num",
      "v": "HMI2.fGearRatioXMeasuredPosition",
      "t": "LREAL",
      "label": "X - PRZEJAZD ZMIERZONY [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -9999.0,
      "max": 9999.0,
      "init": 1000.0,
      "use": "written in: Settings/AxisGear; read in: Settings/AxisGear"
     },
     {
      "k": "button",
      "v": "HMI2.bGearRatioXRecalc",
      "t": "BOOL",
      "label": "PRZELICZ SKALOWANIE X",
      "init": false,
      "use": "written in: Alarms/ResetLogicCommands, Settings/AxisGear; read in: Settings/AxisGear"
     },
     {
      "k": "button",
      "v": "HMI2.bGearRatioXDefault",
      "t": "BOOL",
      "label": "PRZYWRÓĆ SKAL. X DOMYŚLNE",
      "use": "written in: Alarms/ResetLogicCommands, Settings/AxisGear; read in: Settings/AxisGear"
     }
    ]
   },
   {
    "title": "Oś Y (kolumna)",
    "items": [
     {
      "k": "num",
      "v": "HMI.fGearAxisY",
      "t": "LREAL",
      "label": "Y - SKAL. [mm/1obr.silnika]",
      "unit": "mm/1obr.silnika",
      "dec": 2,
      "min": -9999999.0,
      "max": 9999999.0,
      "use": "written in: Settings/AxisGear; read in: Settings/AxisGear, Settings/VelocityAcceleration"
     },
     {
      "k": "display",
      "v": "HMI2.fYActualPosition",
      "t": "LREAL",
      "label": "Y - POZ. AKT. [mm]",
      "unit": "mm",
      "dec": 2,
      "use": "written in: Settings/ActualPosition; read in: Alarms/Alarms, CyclicTask/MillBlocksST, CyclicTask/MillElipseST, CyclicTask/MillST, CyclicTask/ProgramAutoCutST, CyclicTask/ProgramAutoMillST, CyclicTasks/CutBlocksST, CyclicTasks/CutElipseST (+14 more)"
     },
     {
      "k": "num",
      "v": "HMI2.fGearRatioYSetPosition",
      "t": "LREAL",
      "label": "Y - PRZEJAZD ZADANY [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -9999.0,
      "max": 9999.0,
      "init": 1000.0,
      "use": "never written by PLC; read in: Settings/AxisGear"
     },
     {
      "k": "button",
      "v": "HMI2.bGearRatioYMoveToPosition",
      "t": "BOOL",
      "label": "Y - START przejazdu zadanego",
      "use": "written in: Alarms/ResetLogicCommands, Settings/AxisGear; read in: Settings/AxisGear"
     },
     {
      "k": "num",
      "v": "HMI2.fGearRatioYMeasuredPosition",
      "t": "LREAL",
      "label": "Y - PRZEJAZD ZMIERZONY [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -9999.0,
      "max": 9999.0,
      "init": 1000.0,
      "use": "written in: Settings/AxisGear; read in: Settings/AxisGear"
     },
     {
      "k": "button",
      "v": "HMI2.bGearRatioYRecalc",
      "t": "BOOL",
      "label": "PRZELICZ SKALOWANIE Y",
      "init": false,
      "use": "written in: Alarms/ResetLogicCommands, Settings/AxisGear; read in: Settings/AxisGear"
     },
     {
      "k": "button",
      "v": "HMI2.bGearRatioYDefault",
      "t": "BOOL",
      "label": "PRZYWRÓĆ SKAL. Y DOMYŚLNE",
      "use": "written in: Alarms/ResetLogicCommands, Settings/AxisGear; read in: Settings/AxisGear"
     }
    ]
   },
   {
    "title": "Oś Z (kolumna)",
    "items": [
     {
      "k": "num",
      "v": "HMI.fGearAxisZ",
      "t": "LREAL",
      "label": "Z - SKAL [mm/1obr.silnika]",
      "unit": "mm/1obr.silnika",
      "dec": 2,
      "min": -9999999.0,
      "max": 9999999.0,
      "use": "written in: Settings/AxisGear; read in: Settings/AxisGear, Settings/VelocityAcceleration"
     },
     {
      "k": "display",
      "v": "HMI2.fZActualPosition",
      "t": "LREAL",
      "label": "Z - POZ. AKT. [mm]",
      "unit": "mm",
      "dec": 2,
      "use": "written in: Settings/ActualPosition; read in: Alarms/Alarms, CyclicTask/ProgramAutoCutST, GoToPosition/GoToPositionST, GoToPositionST/SaveManualPoint, MillST/MoveToStartPosition, Polishing/Polishing, Polishing/PolishingToolChange, Settings/Status (+1 more)"
     },
     {
      "k": "num",
      "v": "HMI2.fGearRatioZSetPosition",
      "t": "LREAL",
      "label": "Z - PRZEJAZD ZADANY [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -9999.0,
      "max": 9999.0,
      "init": 1000.0,
      "use": "never written by PLC; read in: Settings/AxisGear"
     },
     {
      "k": "button",
      "v": "HMI2.bGearRatioZMoveToPosition",
      "t": "BOOL",
      "label": "Z - START przejazdu zadanego",
      "use": "written in: Alarms/ResetLogicCommands, Settings/AxisGear; read in: Settings/AxisGear"
     },
     {
      "k": "num",
      "v": "HMI2.fGearRatioZMeasuredPosition",
      "t": "LREAL",
      "label": "Z - PRZEJAZD ZMIERZONY [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -9999.0,
      "max": 9999.0,
      "init": 1000.0,
      "use": "written in: Settings/AxisGear; read in: Settings/AxisGear"
     },
     {
      "k": "button",
      "v": "HMI2.bGearRatioZRecalc",
      "t": "BOOL",
      "label": "PRZELICZ SKALOWANIE Z",
      "init": false,
      "use": "written in: Alarms/ResetLogicCommands, Settings/AxisGear; read in: Settings/AxisGear"
     },
     {
      "k": "button",
      "v": "HMI2.bGearRatioZDefault",
      "t": "BOOL",
      "label": "PRZYWRÓĆ SKAL. Z DOMYŚLNE",
      "use": "written in: Alarms/ResetLogicCommands, Settings/AxisGear; read in: Settings/AxisGear"
     }
    ]
   },
   {
    "title": "Oś A (kolumna)",
    "items": [
     {
      "k": "num",
      "v": "HMI.fGearAxisA",
      "t": "LREAL",
      "label": "A - SKAL [mm/1obr.silnika]",
      "unit": "mm/1obr.silnika",
      "dec": 2,
      "min": -9999999.0,
      "max": 9999999.0,
      "use": "written in: Settings/AxisGear; read in: Settings/AxisGear"
     },
     {
      "k": "display",
      "v": "HMI2.fAActualPosition",
      "t": "LREAL",
      "label": "Pozycja [°]",
      "unit": "mm",
      "dec": 2,
      "use": "written in: Settings/ActualPosition; read in: CyclicTask/ProgramAutoCutST, Manual/ManualST"
     },
     {
      "k": "num",
      "v": "HMI2.fGearRatioASetPosition",
      "t": "LREAL",
      "label": "A - PRZEJAZD ZADANY [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -9999.0,
      "max": 9999.0,
      "init": 1000.0,
      "use": "never written by PLC; read in: Settings/AxisGear"
     },
     {
      "k": "button",
      "v": "HMI2.bGearRatioAMoveToPosition",
      "t": "BOOL",
      "label": "A - START przejazdu zadanego",
      "use": "written in: Alarms/ResetLogicCommands, Settings/AxisGear; read in: Settings/AxisGear"
     },
     {
      "k": "num",
      "v": "HMI2.fGearRatioAMeasuredPosition",
      "t": "LREAL",
      "label": "A - PRZEJAZD ZMIERZONY [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -9999.0,
      "max": 9999.0,
      "init": 1000.0,
      "use": "written in: Settings/AxisGear; read in: Settings/AxisGear"
     },
     {
      "k": "button",
      "v": "HMI2.bGearRatioARecalc",
      "t": "BOOL",
      "label": "PRZELICZ SKALOWANIE A",
      "init": false,
      "use": "written in: Alarms/ResetLogicCommands, Settings/AxisGear; read in: Settings/AxisGear, Settings/BreaksAxisST"
     },
     {
      "k": "button",
      "v": "HMI2.bGearRatioADefault",
      "t": "BOOL",
      "label": "PRZYWRÓĆ SKAL. A DOMYŚLNE",
      "use": "written in: Alarms/ResetLogicCommands, Settings/AxisGear; read in: Settings/AxisGear"
     }
    ]
   },
   {
    "title": "Oś B (kolumna; szara ramka gdy bAxisBServo = FALSE)",
    "items": [
     {
      "k": "num",
      "v": "HMI.fGearAxisB",
      "t": "LREAL",
      "label": "B - SKAL [mm/1obr.silnika]",
      "unit": "mm/1obr.silnika",
      "dec": 2,
      "min": -9999999.0,
      "max": 9999999.0,
      "use": "written in: Settings/AxisGear; read in: Settings/AxisGear"
     },
     {
      "k": "display",
      "v": "HMI2.fBActualPosition",
      "t": "LREAL",
      "label": "B - POZ. AKT. [mm]",
      "unit": "mm",
      "dec": 2,
      "use": "written in: Settings/Encoders; read in: Alarms/Alarms, Cut/GetNextDepth, Cut/GetPositions, CutArc/GetNextDepth, CutArc/SetPosition, CutArc/SetPositionOvertaking, CutArcST/GetNextDepth, CutArcST/SetPosition (+31 more)"
     },
     {
      "k": "num",
      "v": "HMI2.fGearRatioBSetPosition",
      "t": "LREAL",
      "label": "B - PRZEJAZD ZADANY [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -9999.0,
      "max": 9999.0,
      "init": 1000.0,
      "use": "never written by PLC; read in: Settings/AxisGear"
     },
     {
      "k": "button",
      "v": "HMI2.bGearRatioBMoveToPosition",
      "t": "BOOL",
      "label": "B - START przejazdu zadanego",
      "use": "written in: Settings/AxisGear; read in: Settings/AxisGear"
     },
     {
      "k": "num",
      "v": "HMI2.fGearRatioBMeasuredPosition",
      "t": "LREAL",
      "label": "B - PRZEJAZD ZMIERZONY [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -9999.0,
      "max": 9999.0,
      "init": 1000.0,
      "use": "written in: Settings/AxisGear; read in: Settings/AxisGear"
     },
     {
      "k": "button",
      "v": "HMI2.bGearRatioBRecalc",
      "t": "BOOL",
      "label": "PRZELICZ SKALOWANIE B / PRZELICZ SKALOWANIE A",
      "init": false,
      "use": "written in: Settings/AxisGear; read in: Settings/AxisGear"
     },
     {
      "k": "button",
      "v": "HMI2.bGearRatioADefault",
      "t": "BOOL",
      "label": "PRZYWRÓĆ SKAL. B DOMYŚLNE / PRZYWRÓĆ SKAL. A DOMYŚLNE",
      "use": "written in: Alarms/ResetLogicCommands, Settings/AxisGear; read in: Settings/AxisGear"
     }
    ]
   },
   {
    "title": "B - enkoder wychyłu / wychył na pozycję",
    "items": [
     {
      "k": "num",
      "v": "HMI.iEncoderImpPerDeg",
      "t": "INT",
      "label": "B skalowanie imp enk./st. kąta wych.",
      "dec": 0,
      "min": 0.0,
      "max": 10000.0,
      "init": 40.0,
      "use": "Encoders: tilt-encoder pulses per degree (B position from DVP/R1-EC/AX encoder)."
     },
     {
      "k": "button",
      "v": "HMI2.bManualBSetPosition0",
      "t": "BOOL",
      "label": "Wychył na pozycje 0°",
      "use": "ManualST: if NOT bStatusWork -> fManualBSetPosition := 0, bManualBMoveToPosAbs (only when main drive stopped), := FALSE."
     },
     {
      "k": "button",
      "v": "HMI2.bManualBSetPosition90",
      "t": "BOOL",
      "label": "Wychył na pozycje +90°",
      "use": "ManualST: if NOT bStatusWork -> fManualBSetPosition := 90, move B absolute, := FALSE."
     }
    ]
   },
   {
    "title": "KOREKTA PIŁA WYCHYŁ 30/45/60 + reinicjalizacja",
    "items": [
     {
      "k": "num",
      "v": "HMI.fParameterAxisTilt45Correction",
      "t": "LREAL",
      "label": "KOREKTA PILA WYCHYL 45 st[mm]",
      "unit": "mm",
      "dec": 2,
      "min": -999.0,
      "max": 999.0,
      "init": 0.0,
      "use": "Status: fStatusAxisTiltCorrection := mean(c30/sin30, c45/sin45, c60/sin60), only when all three corrections > 0."
     },
     {
      "k": "num",
      "v": "HMI.fParameterAxisTilt30Correction",
      "t": "LREAL",
      "label": "KOREKTA PILA WYCHYL 30 st[mm]",
      "unit": "mm",
      "dec": 2,
      "min": -999.0,
      "max": 999.0,
      "init": 0.0,
      "use": "Status: fStatusAxisTiltCorrection := mean(c30/sin30, c45/sin45, c60/sin60), only when all three corrections > 0."
     },
     {
      "k": "num",
      "v": "HMI.fParameterAxisTilt60Correction",
      "t": "LREAL",
      "label": "KOREKTA PILA WYCHYL 60 st[mm]",
      "unit": "mm",
      "dec": 2,
      "min": -999.0,
      "max": 999.0,
      "init": 0.0,
      "use": "Status: fStatusAxisTiltCorrection := mean(c30/sin30, c45/sin45, c60/sin60), only when all three corrections > 0."
     },
     {
      "k": "button",
      "v": "HMI2.bReinitAxis",
      "t": "BOOL",
      "label": "Reinicjalizacja Osi",
      "use": "AxisGear: reinit of all axes X/Y/Z/A/B (MC_Reinit), := FALSE when all done; also reset by ResetLogicCommands."
     }
    ]
   }
  ]
 },
 {
  "id": "toolMeasure",
  "hmi": "pomiar_narzędzia_ustawienia (66)",
  "title": "Pomiar narzędzia",
  "groups": [
   {
    "title": "Pozycja pomiaru narzędzia",
    "items": [
     {
      "k": "num",
      "v": "HMI.fMeasureToolXPosition",
      "t": "LREAL",
      "label": "Pozycja pomiaru narzędzia X [mm]",
      "unit": "mm",
      "dec": 3,
      "min": 0.0,
      "max": 5000.0,
      "init": 2117.825,
      "use": "written in: MeasureTool/MeasureToolST; read in: MeasureTool/MeasureToolReferenceST, MeasureTool/MeasureToolST"
     },
     {
      "k": "num",
      "v": "HMI.fMeasureToolYPosition",
      "t": "LREAL",
      "label": "Pozycja pomiaru narzędzia Y [mm]",
      "unit": "mm",
      "dec": 3,
      "min": 0.0,
      "max": 5000.0,
      "init": 768.133,
      "use": "written in: MeasureTool/MeasureToolST; read in: MeasureTool/MeasureToolReferenceST, MeasureTool/MeasureToolST"
     },
     {
      "k": "button",
      "v": "HMI2.bMeasureToolSave",
      "t": "BOOL",
      "label": "ZAPISZ (aktualne X/Y -> pozycja pomiaru)",
      "use": "MeasureToolST: fMeasureToolX/YPosition := actual X/Y, fMeasureToolZPosition := 0, := FALSE (one-shot)."
     },
     {
      "k": "num",
      "v": "HMI.fMeasureToolReferenceDiscDiameter",
      "t": "LREAL",
      "label": "Średnica dysku dla drogi referencyjjnej [mm]",
      "unit": "mm",
      "dec": 3,
      "min": 0.0,
      "max": 1500.0,
      "init": 500.0,
      "use": "MeasureToolReferenceST: disc diameter used while determining the reference path."
     },
     {
      "k": "num",
      "v": "HMI.fMeasureToolReference",
      "t": "LREAL",
      "label": "Droga referencyjna [mm]",
      "unit": "mm",
      "dec": 3,
      "min": 0.0,
      "max": 1500.0,
      "init": 0.0,
      "use": "MeasureToolST: reference path [mm] (distance sensor start -> disc edge) used to compute tool length."
     }
    ]
   },
   {
    "title": "Czujniki pomiaru",
    "items": [
     {
      "k": "lamp",
      "v": "IOVars.xToolMeasureStart",
      "t": "BOOL",
      "label": "CZUJNIK POMIARU POCZATEK (X8)",
      "use": "written in: IO/IO; read in: MeasureTool/MeasureToolReferenceST, MeasureTool/MeasureToolST"
     },
     {
      "k": "lamp",
      "v": "IOVars.xToolMeasureEnd",
      "t": "BOOL",
      "label": "CZUJNIK POMIARU KONIEC (X9)",
      "use": "written in: IO/IO; never read by PLC"
     }
    ]
   },
   {
    "title": "PRĘDKOŚĆ POMIAR",
    "items": [
     {
      "k": "num",
      "v": "HMI.fVelocityAxisZMeasureFast",
      "t": "LREAL",
      "label": "PRĘDKOŚĆ POMIAR SZYBKA [m/min]",
      "gain": 0.06,
      "unit": "m/min",
      "dec": 2,
      "min": 0.0,
      "init": 2.0,
      "use": "never written by PLC; read in: MeasureTool/MeasureToolReferenceST, MeasureTool/MeasureToolST"
     },
     {
      "k": "num",
      "v": "HMI.fVelocityAxisZMeasureSlow",
      "t": "LREAL",
      "label": "PRĘDKOŚĆ POMIAR WOLNA [m/min]",
      "gain": 0.06,
      "unit": "m/min",
      "dec": 2,
      "min": 0.0,
      "init": 0.2,
      "use": "never written by PLC; read in: MeasureTool/MeasureToolReferenceST, MeasureTool/MeasureToolST"
     }
    ]
   },
   {
    "title": "WYZNACZ DROGĘ REFERENCYJNĄ",
    "items": [
     {
      "k": "bit",
      "v": "HMI2.bMeasureToolReferenceStart",
      "t": "BOOL",
      "off": "WŁĄCZ TRYB WYZNACZANIA DROGI REFERENCYJNEJ",
      "on": "TRYB WYZNACZANIA DROGI REFERENCYJNEJ",
      "use": "MeasureToolReferenceST: starts the reference-path measuring cycle; resetting it aborts the cycle; reset by PLC at the end and by ResetLogicCommands."
     },
     {
      "k": "bit",
      "v": "HMI2.bMeasureToolReferenceStart",
      "t": "BOOL",
      "label": "Tryb wyznaczania drogi referencyjnej - drugi przycisk",
      "use": "MeasureToolReferenceST: starts the reference-path measuring cycle; resetting it aborts the cycle; reset by PLC at the end and by ResetLogicCommands."
     },
     {
      "k": "button",
      "v": "HMI.bStopMachine",
      "t": "BOOL",
      "label": "STOP",
      "use": "Alarms/Stop: global STOP of all motion; reset by the PLC."
     }
    ]
   }
  ]
 },
 {
  "id": "millTable",
  "hmi": "wierzcholki_stol (46)",
  "title": "Obszar stołu – frez / wiercenie / polerowanie",
  "groups": [
   {
    "title": "DEFINICJA PUNKTÓW STOŁU",
    "items": [
     {
      "k": "num",
      "v": "HMI.iMillingBoardApexNumber",
      "t": "INT",
      "label": "IL. WIERZCHOŁKÓW",
      "dec": 0,
      "min": 3.0,
      "max": 8.0,
      "init": 4.0,
      "use": "WorkArea: number of mill-table vertices; points above it are zeroed."
     },
     {
      "k": "bit",
      "v": "HMI.bMillingBoardAllowSave",
      "t": "BOOL",
      "off": "AKTYWUJ ZAPIS ROZMIARÓW",
      "on": "ZAPIS ROZMIARÓW AKTYWNY",
      "use": "WorkArea: unlocks editing of mill table points (bMillingBoardSaveHide := NOT this); HMI uses it as interlock of the X/Y/Z entries."
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardX[0]",
      "t": "ARRAY",
      "label": "Punkt X1 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/WorkArea; read in: Settings/Status, Settings/WorkArea"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardY[0]",
      "t": "ARRAY",
      "label": "Punkt Y1 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/WorkArea; read in: Settings/WorkArea"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardZ[0]",
      "t": "ARRAY",
      "label": "Punkt Z1 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/Status, Settings/WorkArea; read in: Settings/Status, Settings/WorkArea"
     },
     {
      "k": "button",
      "v": "HMI.iMillingBoardSave",
      "t": "INT",
      "label": "Zapisz punkt 1",
      "init": -1.0,
      "vis": "HMI.bCuttingBoardSaveHide = FALSE",
      "use": "WorkArea: if > 0 -> aMillingBoardX/Y/Z[n-1] := actual X/Y/Z, then := -1 (one-shot set-constant 1..8).",
      "act": "millpt:1"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardX[1]",
      "t": "ARRAY",
      "label": "Punkt X2 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/WorkArea; read in: Settings/Status, Settings/WorkArea"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardY[1]",
      "t": "ARRAY",
      "label": "Punkt Y2 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/WorkArea; read in: Settings/WorkArea"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardZ[1]",
      "t": "ARRAY",
      "label": "Punkt Z2 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/Status, Settings/WorkArea; read in: Settings/Status, Settings/WorkArea"
     },
     {
      "k": "button",
      "v": "HMI.iMillingBoardSave",
      "t": "INT",
      "label": "Zapisz punkt 2",
      "init": -1.0,
      "vis": "HMI.bCuttingBoardSaveHide = FALSE",
      "use": "WorkArea: if > 0 -> aMillingBoardX/Y/Z[n-1] := actual X/Y/Z, then := -1 (one-shot set-constant 1..8).",
      "act": "millpt:2"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardX[2]",
      "t": "ARRAY",
      "label": "Punkt X3 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/WorkArea; read in: Settings/Status, Settings/WorkArea"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardY[2]",
      "t": "ARRAY",
      "label": "Punkt Y3 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/WorkArea; read in: Settings/WorkArea"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardZ[2]",
      "t": "ARRAY",
      "label": "Punkt Z3 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/Status, Settings/WorkArea; read in: Settings/Status, Settings/WorkArea"
     },
     {
      "k": "button",
      "v": "HMI.iMillingBoardSave",
      "t": "INT",
      "label": "Zapisz punkt 3",
      "init": -1.0,
      "vis": "HMI.bCuttingBoardSaveHide = FALSE",
      "use": "WorkArea: if > 0 -> aMillingBoardX/Y/Z[n-1] := actual X/Y/Z, then := -1 (one-shot set-constant 1..8).",
      "act": "millpt:3"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardX[3]",
      "t": "ARRAY",
      "label": "Punkt X4 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/WorkArea; read in: Settings/Status, Settings/WorkArea"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardY[3]",
      "t": "ARRAY",
      "label": "Punkt Y4 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/WorkArea; read in: Settings/WorkArea"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardZ[3]",
      "t": "ARRAY",
      "label": "Punkt Z4 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/Status, Settings/WorkArea; read in: Settings/Status, Settings/WorkArea"
     },
     {
      "k": "button",
      "v": "HMI.iMillingBoardSave",
      "t": "INT",
      "label": "Zapisz punkt 4",
      "init": -1.0,
      "vis": "HMI.bCuttingBoardSaveHide = FALSE",
      "use": "WorkArea: if > 0 -> aMillingBoardX/Y/Z[n-1] := actual X/Y/Z, then := -1 (one-shot set-constant 1..8).",
      "act": "millpt:4"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardX[4]",
      "t": "ARRAY",
      "label": "Punkt X5 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/WorkArea; read in: Settings/Status, Settings/WorkArea"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardY[4]",
      "t": "ARRAY",
      "label": "Punkt Y5 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/WorkArea; read in: Settings/WorkArea"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardZ[4]",
      "t": "ARRAY",
      "label": "Punkt Z5 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/Status, Settings/WorkArea; read in: Settings/Status, Settings/WorkArea"
     },
     {
      "k": "button",
      "v": "HMI.iMillingBoardSave",
      "t": "INT",
      "label": "Zapisz punkt 5",
      "init": -1.0,
      "vis": "HMI.bCuttingBoardSaveHide = FALSE",
      "use": "WorkArea: if > 0 -> aMillingBoardX/Y/Z[n-1] := actual X/Y/Z, then := -1 (one-shot set-constant 1..8).",
      "act": "millpt:5"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardX[5]",
      "t": "ARRAY",
      "label": "Punkt X6 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/WorkArea; read in: Settings/Status, Settings/WorkArea"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardY[5]",
      "t": "ARRAY",
      "label": "Punkt Y6 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/WorkArea; read in: Settings/WorkArea"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardZ[5]",
      "t": "ARRAY",
      "label": "Punkt Z6 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/Status, Settings/WorkArea; read in: Settings/Status, Settings/WorkArea"
     },
     {
      "k": "button",
      "v": "HMI.iMillingBoardSave",
      "t": "INT",
      "label": "Zapisz punkt 6",
      "init": -1.0,
      "vis": "HMI.bCuttingBoardSaveHide = FALSE",
      "use": "WorkArea: if > 0 -> aMillingBoardX/Y/Z[n-1] := actual X/Y/Z, then := -1 (one-shot set-constant 1..8).",
      "act": "millpt:6"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardX[6]",
      "t": "ARRAY",
      "label": "Punkt X7 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/WorkArea; read in: Settings/Status, Settings/WorkArea"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardY[6]",
      "t": "ARRAY",
      "label": "Punkt Y7 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/WorkArea; read in: Settings/WorkArea"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardZ[6]",
      "t": "ARRAY",
      "label": "Punkt Z7 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/Status, Settings/WorkArea; read in: Settings/Status, Settings/WorkArea"
     },
     {
      "k": "button",
      "v": "HMI.iMillingBoardSave",
      "t": "INT",
      "label": "Zapisz punkt 7",
      "init": -1.0,
      "vis": "HMI.bCuttingBoardSaveHide = FALSE",
      "use": "WorkArea: if > 0 -> aMillingBoardX/Y/Z[n-1] := actual X/Y/Z, then := -1 (one-shot set-constant 1..8).",
      "act": "millpt:7"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardX[7]",
      "t": "ARRAY",
      "label": "Punkt X8 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/WorkArea; read in: Settings/Status, Settings/WorkArea"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardY[7]",
      "t": "ARRAY",
      "label": "Punkt Y8 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/WorkArea; read in: Settings/WorkArea"
     },
     {
      "k": "num",
      "v": "HMI.aMillingBoardZ[7]",
      "t": "ARRAY",
      "label": "Punkt Z8 [mm]",
      "unit": "mm",
      "dec": 2,
      "min": -10000.0,
      "max": 10000.0,
      "use": "written in: Settings/Status, Settings/WorkArea; read in: Settings/Status, Settings/WorkArea"
     },
     {
      "k": "button",
      "v": "HMI.iMillingBoardSave",
      "t": "INT",
      "label": "Zapisz punkt 8",
      "init": -1.0,
      "vis": "HMI.bCuttingBoardSaveHide = FALSE",
      "use": "WorkArea: if > 0 -> aMillingBoardX/Y/Z[n-1] := actual X/Y/Z, then := -1 (one-shot set-constant 1..8).",
      "act": "millpt:8"
     }
    ]
   },
   {
    "title": "Przyciski (dolny pasek)",
    "items": [
     {
      "k": "bit",
      "v": "HMI2.bMillingBoardSaveAllZPoints",
      "t": "BOOL",
      "label": "ZAPISZ AKTUALA POZYCJE Z DO WSZYSTKICH PKT",
      "use": "Status: R_TRIG -> all aMillingBoardZ[i] := actual Z, := FALSE."
     },
     {
      "k": "bit",
      "v": "HMI.bMillingBoardSaveFromCut",
      "t": "BOOL",
      "label": "PRZEPISZ Z OBSZARU CIECIA",
      "use": "WorkArea: copies aCuttingBoardX/Y/Z -> aMillingBoardX/Y/Z, := FALSE."
     }
    ]
   }
  ]
 },
 {
  "id": "tiltDrive",
  "hmi": "falownik_wychył (77)",
  "title": "Falownik wychyłu",
  "groups": [
   {
    "title": "Parametry silnika wychyłu P05-xx",
    "items": [
     {
      "k": "num",
      "v": "HMI.iAxisBMotorPower",
      "t": "WORD",
      "label": "P05-01 PRAD SILNIKA",
      "dec": 2,
      "min": 0.0,
      "max": 50.0,
      "init": 110.0,
      "use": "NOT USED in PLC code (only declared). Inverters uses iAxisBMotorCurrent / iAxisBMotorRPM / iAxisBMotorPolesNumber for autotuning."
     },
     {
      "k": "num",
      "v": "HMI.iAxisBMotorPower",
      "t": "WORD",
      "label": "P05-02 MOC SILNIKA",
      "dec": 2,
      "min": 0.0,
      "max": 50.0,
      "init": 110.0,
      "use": "NOT USED in PLC code (only declared). Inverters uses iAxisBMotorCurrent / iAxisBMotorRPM / iAxisBMotorPolesNumber for autotuning."
     },
     {
      "k": "num",
      "v": "HMI.iAxisBMotorRPM",
      "t": "WORD",
      "label": "P05-03 RPM SILNIKA",
      "dec": 0,
      "min": 0.0,
      "max": 3000.0,
      "init": 900.0,
      "use": "Inverters: iAxisBMotorSpeed := iAxisBMotorRPM when autotuning starts."
     },
     {
      "k": "num",
      "v": "HMI.iAxisBMotorPolesNumber",
      "t": "WORD",
      "label": "P05-04 LICZBA BIEGUNÓW SILNIKA",
      "dec": 0,
      "min": 2.0,
      "max": 10.0,
      "init": 6.0,
      "use": "Inverters: iAxisBPolesNumber := iAxisBMotorPolesNumber when autotuning starts."
     }
    ]
   },
   {
    "title": "Autotuning",
    "items": [
     {
      "k": "button",
      "v": "HMI2.bAxisBTuning",
      "t": "BOOL",
      "label": "ROZPOCZNIJ AUTOTUNING / TRWA TUNING",
      "use": "Inverters: starts tilt-inverter autotuning (writes motor data, brake off, RUN after 1 s, waits for warn 25), := FALSE when tuning done."
     },
     {
      "k": "lamp",
      "v": "HMI.bAxisBTuningDone",
      "t": "BOOL",
      "label": "TUNING NIEWYKONANY / TUNING ZAKONCZONY",
      "vis": "HMI.bAxisBTuningDone = TRUE",
      "use": "Inverters: TRUE when autotuning finished and vector mode written."
     }
    ]
   }
  ],
  "note": "W HMI ten ekran nie jest otwierany żadnym przyciskiem."
 }
];

// Zmienne PLC ekranow serwisowych: sciezka GVL.zmienna (tablice bez indeksu) -> typ (ARRAY / ARRAY_STRING / STRING / IEC)
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
 "HMI.bServiceCNCMode": "BOOL",
 "HMI.bServiceMillFWD": "BOOL",
 "HMI.bServiceInterpolationLimit": "BOOL",
 "HMI.bServicePilotInterpolation": "BOOL",
 "HMI.bServicePauseNotStopping": "BOOL",
 "HMI.bServiceElipseAsOnePoint": "BOOL",
 "HMI.bServiceMillProgramNewStartPoints": "BOOL",
 "HMI.bServiceMillShapeReturn": "BOOL",
 "HMI.bServiceAnalogZ": "BOOL",
 "HMI.bServiceMillWaterAndCutWater": "BOOL",
 "HMI.bServiceMillZFirst": "BOOL",
 "HMI.bServiceMillDifferentTable": "BOOL",
 "HMI2.startInit": "BOOL",
 "HMI.bServiceInverterAnalog": "BOOL",
 "HMI.bServiceMainDriveECAT": "BOOL",
 "HMI.bServoA3": "BOOL",
 "HMI.bServoA3EP": "BOOL",
 "HMI.bServiceMillCircleReverse": "BOOL",
 "HMI2.bTODO": "BOOL",
 "HMI2.bRecipeInnerRewrite": "BOOL",
 "HMI.bServiceTestingMode": "BOOL",
 "HMI.iOverallDays": "LINT",
 "HMI.iOverallHours": "LINT",
 "HMI.iOverallMinutes": "LINT",
 "HMI.iMachineNumber": "INT",
 "HMI2.bMakeScreenshots": "BOOL",
 "HMI.bServicePolishing": "BOOL",
 "HMI.bServicePolishingToolChange": "BOOL",
 "HMI.bServiceMainDriveEncoderAX": "BOOL",
 "HMI.bServicePolishingCoverIgnoreSensors": "BOOL",
 "HMI.bServicePolishingToolIgnoreSensors": "BOOL",
 "ToolChangeGVL.SafeDistance": "LREAL",
 "ToolChangeGVL.InverterHomePosition": "DINT",
 "HMI2.iAxisRecipe": "ServoType",
 "HMI2.sLastSaveDate": "STRING",
 "HMI2.sLastLoadDate": "STRING",
 "HMI2.bSaveAxisRecipe": "BOOL",
 "HMI2.bLoadAxisRecipe": "BOOL",
 "HMI2.bShowAxisRecipe": "BOOL",
 "HMI2.sAxisRecipePath": "STRING",
 "HMI2.aRecipes": "ARRAY_STRING",
 "HMI2.bRecipeCreateRecipe": "BOOL",
 "HMI2.bRecipeDelete": "BOOL",
 "HMI2.bRecipeUploadRecipe": "BOOL",
 "HMI2.bRecipeLoadRecipe": "BOOL",
 "HMI2.sNewRecipeName": "STRING",
 "HMI2.iRecipeError": "DWORD",
 "HMI2.sSelectedRecipePath": "STRING",
 "Communication.iAxisBFreqAct": "WORD",
 "Communication.iMainDriveFreqAct": "WORD",
 "Communication.iAxisBVoltage": "WORD",
 "Communication.iMainDriveVoltage": "WORD",
 "Communication.iAxisBCurrent": "WORD",
 "Communication.iMainDriveCurrent": "WORD",
 "Communication.iMainDriveTorqueAbs": "WORD",
 "Communication.iAxisBTorqueABS": "WORD",
 "Communication.bMainDriveRunning": "BOOL",
 "Communication.bMainDriveRunFWD": "BOOL",
 "Communication.bAxisBRunning": "BOOL",
 "HMI.fVelocityMainDrive": "LREAL",
 "HMI.fMaxVelocityMainDrive": "LREAL",
 "HMI.iVelocityAxisBFast": "INT",
 "HMI.iVelocityAxisBSlow": "INT",
 "HMI.iVelocityAxisBSlow2": "INT",
 "HMI.fBaseBChangeVelocity": "LREAL",
 "HMI.fBaseBStopPosition": "LREAL",
 "HMI.fBaseBTime": "LREAL",
 "HMI.iVelocityAxisBJog": "INT",
 "HMI.iBaseBSlow": "INT",
 "HMI.iAxisBHomeTorqueFirst": "WORD",
 "HMI.iAxisBHomeTorqueNext": "WORD",
 "HMI2.bStatusXEnabled": "BOOL",
 "HMI2.bStatusYEnabled": "BOOL",
 "HMI2.bStatusZEnabled": "BOOL",
 "HMI2.bStatusAEnabled": "BOOL",
 "HMI2.bStatusBEnabled": "BOOL",
 "HMI2.iVelocityAxisZDrillPrecent": "INT",
 "HMI2.bVelocityAxisZDrillDec": "BOOL",
 "HMI.fVelocityAxisZDrill": "LREAL",
 "HMI2.bVelocityAxisZDrillInc": "BOOL",
 "HMI.fParameterArcVelocityLimit": "LREAL",
 "HMI.fParameterRoofCorrectionX": "LREAL",
 "HMI.fParameterRoofCorrectionY": "LREAL",
 "HMI.TaccX": "LREAL",
 "HMI.TdecX": "LREAL",
 "HMI.fJogXVelocity": "LREAL",
 "HMI.TaccY": "LREAL",
 "HMI.TdecY": "LREAL",
 "HMI.fJogYVelocity": "LREAL",
 "HMI.TaccZ": "LREAL",
 "HMI.TdecZ": "LREAL",
 "HMI.fJogZVelocity": "LREAL",
 "HMI.TaccXY": "LREAL",
 "HMI.TdecXY": "LREAL",
 "HMI.TaccA": "LREAL",
 "HMI.TdecA": "LREAL",
 "HMI.TaccB": "LREAL",
 "HMI.TdecB": "LREAL",
 "HMI.fJogBVelocity": "LREAL",
 "HMI.fAutoTaccX": "LREAL",
 "HMI.fAutoTdecX": "LREAL",
 "HMI.fAutoTaccY": "LREAL",
 "HMI.fAutoTdecY": "LREAL",
 "HMI.fAutoTaccZ": "LREAL",
 "HMI.fAutoTdecZ": "LREAL",
 "HMI.VelA": "LREAL",
 "HMI.VelB": "LREAL",
 "HMI.fBaseZVel": "LREAL",
 "HMI.fBaseAVel": "LREAL",
 "HMI.iServiceSafetyReady": "Inputs",
 "IOVars.xSafetyReady": "BOOL",
 "HMI.iServiceAxisSawReady": "Inputs",
 "IOVars.xAxisSawReady": "BOOL",
 "HMI.iServiceSafetyAck": "Inputs",
 "HMI.iServiceAlarmThermalSaw": "Inputs",
 "IOVars.xAlarmThermalSaw": "BOOL",
 "HMI.iServiceWaterSensorMill": "Inputs",
 "IOVars.xSensorWaterMill": "BOOL",
 "HMI.iServiceWaterSensorCut": "Inputs",
 "IOVars.xSensorWaterCut": "BOOL",
 "HMI.iServiceToolMeasureStart": "Inputs",
 "IOVars.xToolMeasureStart": "BOOL",
 "HMI.iServiceToolMeasureEnd": "Inputs",
 "IOVars.xToolMeasureEnd": "BOOL",
 "HMI.iServiceGrease": "Inputs",
 "IOVars.xGrease": "BOOL",
 "HMI.iServiceStartProgram": "Inputs",
 "IOVars.xStartProgram": "BOOL",
 "HMI.iServiceStopProgram": "Inputs",
 "IOVars.xStopProgram": "BOOL",
 "HMI.iServiceStartMainDrive": "Inputs",
 "IOVars.xStartMainDrive": "BOOL",
 "HMI.iServiceStopMainDrive": "Inputs",
 "IOVars.xStopMainDrive": "BOOL",
 "HMI.iServiceAxisBRunStop": "Outputs",
 "IOVars.yAxisBRunStop": "BOOL",
 "HMI.iServiceLaser": "Outputs",
 "IOVars.yLaser": "BOOL",
 "HMI.iServiceAxisBFWDREV": "Outputs",
 "IOVars.yAxisBFWDREV": "BOOL",
 "HMI.iServiceWaterCut": "Outputs",
 "IOVars.yWaterCut": "BOOL",
 "HMI.iServiceAxisBMulti1": "Outputs",
 "IOVars.yAxisBMulti1": "BOOL",
 "HMI.iServiceBreakBAxis": "Outputs",
 "IOVars.yBreakBAxis": "BOOL",
 "HMI.iServiceWaterMill": "Outputs",
 "IOVars.yWaterMill": "BOOL",
 "HMI.iServiceAxisBMulti2": "Outputs",
 "IOVars.yAxisBMulti2": "BOOL",
 "HMI.iServiceMPGConfig1": "Inputs",
 "IOVars.xMPGConfig1": "BOOL",
 "HMI.iServiceMPGConfig2": "Inputs",
 "IOVars.xMPGConfig2": "BOOL",
 "HMI.iServiceMPGMoveLeft": "Inputs",
 "IOVars.xMPGMoveLeft": "BOOL",
 "HMI.iServiceMPGMoveRight": "Inputs",
 "IOVars.xLimitSwitchBAxisRight": "BOOL",
 "HMI.iServiceMPGEnable": "Inputs",
 "IOVars.xMPGEnable": "BOOL",
 "HMI.iServiceXPlus": "Inputs",
 "IOVars.xXPlus": "BOOL",
 "HMI.iServiceXMinus": "Inputs",
 "IOVars.xXMinus": "BOOL",
 "HMI.iServiceYPlus": "Inputs",
 "IOVars.xYPlus": "BOOL",
 "HMI.iServiceYMinus": "Inputs",
 "IOVars.xYMinus": "BOOL",
 "HMI.iServiceZPlus": "Inputs",
 "IOVars.xZPlus": "BOOL",
 "HMI.iServiceZMinus": "Inputs",
 "IOVars.xZMinus": "BOOL",
 "HMI.iServiceAPlus": "Inputs",
 "IOVars.xAPlus": "BOOL",
 "HMI.iServiceAMinus": "Inputs",
 "IOVars.xAMinus": "BOOL",
 "HMI.iServiceBPlus": "Inputs",
 "IOVars.xBPlus": "BOOL",
 "HMI.iServiceBMinus": "Inputs",
 "IOVars.xBMinus": "BOOL",
 "HMI2.fVelocityFastAnalog": "UINT",
 "HMI2.fVelocityWorkAnalog": "UINT",
 "HMI2.fVelocityMainDriveAnalog": "UINT",
 "HMI.bServiceAdvancedDesktop": "BOOL",
 "HMI.bMPGBasic": "BOOL",
 "HMI.bServiceOutputModule": "BOOL",
 "HMI.iServicePolishingSensorEjectorOpen": "Inputs",
 "IOVars.xPolishingSensorEjectorOpen": "BOOL",
 "HMI.iServicePolishingSensorEjectorClose": "Inputs",
 "IOVars.xPolishingSensorEjectorClose": "BOOL",
 "HMI.iServicePolishingSensorWater": "Inputs",
 "IOVars.xPolishingSensorWater": "BOOL",
 "HMI.iServicePolishingSensorToolIn": "Inputs",
 "IOVars.xPolishingSensorToolIn": "BOOL",
 "HMI.iServicePolishingSensorToolUnlocked": "Inputs",
 "IOVars.xPolishingSensorToolUnlocked": "BOOL",
 "HMI.iServicePolishingSensorToolMissing": "Inputs",
 "IOVars.xPolishingSensorToolMissing": "BOOL",
 "HMI.iServicePolishingSensorPressure": "Inputs",
 "IOVars.xPolishingSensorPressure": "BOOL",
 "HMI.iServicePolishingPressureTool1": "Outputs",
 "IOVars.yPolishingPressureTool1": "BOOL",
 "HMI.iServicePolishingPressureTool2": "Outputs",
 "IOVars.yPolishingPressureTool2": "BOOL",
 "HMI.iServicePolishingPressureMainDrive": "Outputs",
 "IOVars.yPolishingPressureMainDrive": "BOOL",
 "HMI.iServicePolishingPressureEjectorOpen": "Outputs",
 "IOVars.yPolishingPressureEjectorOpen": "BOOL",
 "HMI.iServicePolishingPressureEjectorClose": "Outputs",
 "IOVars.yPolishingPressureEjectorClose": "BOOL",
 "HMI.fGearAxisX": "LREAL",
 "HMI2.fXActualPosition": "LREAL",
 "HMI2.fGearRatioXSetPosition": "LREAL",
 "HMI2.bGearRatioXMoveToPosition": "BOOL",
 "HMI2.fGearRatioXMeasuredPosition": "LREAL",
 "HMI2.bGearRatioXRecalc": "BOOL",
 "HMI2.bGearRatioXDefault": "BOOL",
 "HMI.fGearAxisY": "LREAL",
 "HMI2.fYActualPosition": "LREAL",
 "HMI2.fGearRatioYSetPosition": "LREAL",
 "HMI2.bGearRatioYMoveToPosition": "BOOL",
 "HMI2.fGearRatioYMeasuredPosition": "LREAL",
 "HMI2.bGearRatioYRecalc": "BOOL",
 "HMI2.bGearRatioYDefault": "BOOL",
 "HMI.fGearAxisZ": "LREAL",
 "HMI2.fZActualPosition": "LREAL",
 "HMI2.fGearRatioZSetPosition": "LREAL",
 "HMI2.bGearRatioZMoveToPosition": "BOOL",
 "HMI2.fGearRatioZMeasuredPosition": "LREAL",
 "HMI2.bGearRatioZRecalc": "BOOL",
 "HMI2.bGearRatioZDefault": "BOOL",
 "HMI.fGearAxisA": "LREAL",
 "HMI2.fGearRatioASetPosition": "LREAL",
 "HMI2.bGearRatioAMoveToPosition": "BOOL",
 "HMI2.fGearRatioAMeasuredPosition": "LREAL",
 "HMI2.bGearRatioARecalc": "BOOL",
 "HMI2.bGearRatioADefault": "BOOL",
 "HMI.fGearAxisB": "LREAL",
 "HMI2.fGearRatioBSetPosition": "LREAL",
 "HMI2.bGearRatioBMoveToPosition": "BOOL",
 "HMI2.fGearRatioBMeasuredPosition": "LREAL",
 "HMI2.bGearRatioBRecalc": "BOOL",
 "HMI.iEncoderImpPerDeg": "INT",
 "HMI2.bManualBSetPosition0": "BOOL",
 "HMI2.bManualBSetPosition90": "BOOL",
 "HMI.fParameterAxisTilt45Correction": "LREAL",
 "HMI.fParameterAxisTilt30Correction": "LREAL",
 "HMI.fParameterAxisTilt60Correction": "LREAL",
 "HMI2.bReinitAxis": "BOOL",
 "HMI.fMeasureToolXPosition": "LREAL",
 "HMI.fMeasureToolYPosition": "LREAL",
 "HMI2.bMeasureToolSave": "BOOL",
 "HMI.fMeasureToolReferenceDiscDiameter": "LREAL",
 "HMI.fMeasureToolReference": "LREAL",
 "HMI.fVelocityAxisZMeasureFast": "LREAL",
 "HMI.fVelocityAxisZMeasureSlow": "LREAL",
 "HMI2.bMeasureToolReferenceStart": "BOOL",
 "HMI.bStopMachine": "BOOL",
 "HMI.iMillingBoardApexNumber": "INT",
 "HMI.bMillingBoardAllowSave": "BOOL",
 "HMI.aMillingBoardX": "ARRAY",
 "HMI.aMillingBoardY": "ARRAY",
 "HMI.aMillingBoardZ": "ARRAY",
 "HMI.iMillingBoardSave": "INT",
 "HMI2.bMillingBoardSaveAllZPoints": "BOOL",
 "HMI.bMillingBoardSaveFromCut": "BOOL",
 "HMI.iAxisBMotorPower": "WORD",
 "HMI.iAxisBMotorRPM": "WORD",
 "HMI.iAxisBMotorPolesNumber": "WORD",
 "HMI2.bAxisBTuning": "BOOL",
 "HMI.bAxisBTuningDone": "BOOL"
};
