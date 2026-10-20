# VizuApp – wizualizacja cięcia (#128)

Aplikacja na panel maszyny, która w 3D pokazuje, co tnie piła: materiał,
tarczę ustawioną zgodnie z **obrotem A** i **wychyłem B** oraz wycięty rzaz
(ścianę cięcia z obwiednią głębokości i szczelinę na górnej powierzchni).
Dane czyta przez **OPC UA z localhost** (serwer CODESYS na sterowniku), czyli
te same zmienne co HMI.

Na razie tylko **pojedyncze cięcie piłą**. Inne operacje (frez, łuki, profile)
dojdą później.

## Pliki

| Plik | Co to |
|---|---|
| `vizuapp/geometry.py` | geometria głowicy wg `CutST.GetPositions` / `GetNextDepth` |
| `vizuapp/cuts.py` | zapis wyciętego materiału (rzaz) z kolejnych pozycji |
| `vizuapp/render.py` | rzut 3D i rysowanie na `tkinter.Canvas` (bez OpenGL) |
| `vizuapp/source_opcua.py` | odczyt zmiennych PLC przez OPC UA (`asyncua`) |
| `vizuapp/simulator.py` | symulacja cięcia (`--demo`, testy) |
| `vizuapp/app.py` | okno aplikacji |
| `config.json` | ustawienia (adres OPC UA, zmienne) |
| `vizu.ps1` | uruchamianie z PLC (jak `D:\Calc\calc.ps1`) |
| `build.ps1` | testy + budowa `dist\VizuApp\VizuApp.exe` |
| `tests/` | testy geometrii, zapisu cięcia i OPC UA (`fake_plc_server.py` udaje CODESYS) |

## Uruchamianie na maszynie

Tak jak kalkulator: PLC (`HMIScreen`) przy przycisku z HMI wykonuje polecenie
`SysProcessExecuteCommand2`:

```
cmd /c start "" powershell -nop -ep bypass -w hidden -File D:\VizuApp\vizu.ps1
```

`vizu.ps1` uruchamia `VizuApp.exe`, a jeśli aplikacja już działa, tylko wyciąga
jej okno na wierzch.

**Do zrobienia w PLC / HMI** (osobno, poza tym folderem), wzorem `bCalculator`:

```
// GVL HMI2 (symbol config, jak bCalculator)
bVizuApp : BOOL;

// HMIScreen - deklaracja
sCmdVizuApp : STRING := 'cmd /c start "" powershell -nop -ep bypass -w hidden -File D:\VizuApp\vizu.ps1';

// HMIScreen - na końcu
IF bVizuApp THEN
diExitCode := SysProcessExecuteCommand2(
pszCommand   := sCmdVizuApp,
pszStdOut    := sStdOut,
udiStdOutLen := SIZEOF(sStdOut),
pResult      := ADR(eResult));
bVizuApp := FALSE;
END_IF
```

Dodatkowo w HMI potrzebny jest przycisk ustawiający `bVizuApp`.

### Instalacja

1. `powershell -File build.ps1` na komputerze z Pythonem 3.11. Skrypt zakłada
   `.venv`, uruchamia testy i buduje exe.
2. Zawartość `dist\VizuApp\` (`VizuApp.exe`, `vizu.ps1`, `config.json`) skopiuj
   na maszynę do `D:\VizuApp\`. Python na maszynie nie jest potrzebny.
3. Na sterowniku musi działać serwer OPC UA CODESYS (port 4840). W symbol
   configu jest już `SupportOPCUA` i potrzebne zmienne (`HMI`, `HMI2`,
   `Communication`, `IOVars`).

## Konfiguracja (`config.json` obok exe)

| Klucz | Domyślnie | Opis |
|---|---|---|
| `endpoint` | `opc.tcp://localhost:4840` | serwer OPC UA sterownika |
| `username`, `password` | puste | logowanie do OPC UA; puste oznacza anonimowe |
| `node_prefix` | puste | np. `ns=4;s=\|var\|<urządzenie>.Application.`; puste oznacza szukanie węzłów w drzewie `.../Application/GlobalVars/<GVL>` |
| `poll_ms` | 50 | okres odczytu |
| `variables` | `{}` | podmiana zmiennych, np. `{"material_height": "HMI.fParameterZMaterialHeight"}` |
| `auto_clear_on_start` | `true` | nowe cięcie (`bCutStart`) czyści poprzednie |
| `material_margin`, `material_min_size` | 300, [1200, 800] | rozmiar rysowanego materiału wokół cięć (mm) |
| `fullscreen` | `false` | pełny ekran (Esc wyłącza) |

Czytane zmienne (wymagane są pozycje, średnica tarczy i wysokość materiału):

| Klucz | Zmienna PLC |
|---|---|
| X, Y, Z, A, B | `HMI2.fXActualPosition` … `HMI2.fBActualPosition` |
| tarcza | `HMI.fParameterDiscDiameter`, `HMI.fParameterBladeWidth` |
| głowica | `HMI.fParameterCutTiltDiameter`, `HMI.fParameterHeadRotationDiameter` |
| materiał | `HMI.fCutMaterialHeight` (Z górnej powierzchni), `HMI.fParameterMaterialThickness` |
| stan | `HMI2.CutStep`, `HMI2.bCutStart`, `Communication.bMainDriveRunning`, `IOVars.yWaterCut` |

## Geometria

Tak jak w PLC: Z rośnie w dół, a głębokość liczona jest od `fCutMaterialHeight`.
Oś obrotu A jest pionowa przez (X, Y). Oś wychyłu B jest pozioma, odsunięta o
`HeadRotationDiameter/2 - CutTiltDiameter/2`. Środek tarczy leży
`CutTiltDiameter/2` od osi wychyłu, wzdłuż osi wrzeciona. Testy sprawdzają, że
dla pozycji policzonych formułami `CutST` najniższy punkt tarczy leży na linii
cięcia, na zadanej głębokości. Przy cięciu pod kątem (z `fBX/YOffset`) rzaz
leży na linii na górnej powierzchni materiału. Korekty wychyłu
(`fParameterTiltCorrection`, `fStatusAxisTiltCorrection`, `fBladeWidthTilt`)
nie są jeszcze uwzględnione.

## Obsługa

Przeciąganie lewym przyciskiem (lub palcem) obraca widok. Prawy przycisk albo
Shift + lewy przesuwa widok, kółko przybliża, a dwuklik dopasowuje.
Przyciski: widoki Izometria / Góra / Przód / Bok, Dopasuj, + / −, Wyczyść
(usuwa narysowane cięcia), Tarcza (pokaż / ukryj).

## Rozwój i testy

```powershell
.\.venv\Scripts\python -m vizuapp --demo                      # bez PLC, symulacja cięcia
.\.venv\Scripts\python -m tests.fake_plc_server --port 4840    # udawany CODESYS przez OPC UA
.\.venv\Scripts\python -m vizuapp                              # w drugim oknie
.\.venv\Scripts\python -m unittest discover -s tests -t .
```
