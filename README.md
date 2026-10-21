# Promasz Visu3D – wizualizacja cięcia (VizuApp)

Wizualizacja 3D piły mostowej **Promasz – Piła Jednosuportowa** (zgłoszenie
[#128 „Wizu Cięć maszyny”](https://github.com/Induprogress/Promasz_PilaJednosuportowa/issues/128)
w repo głównym). To repo jest podpięte jako submoduł `Visu3D` w
[Induprogress/Promasz_PilaJednosuportowa](https://github.com/Induprogress/Promasz_PilaJednosuportowa),
obok submodułów `PLC` i `HMI`. Wcześniej aplikacja była w HMI
(`HMI/VizuApp`) i stamtąd została przeniesiona razem z historią. Zmiany
opisuje [CHANGELOG.md](CHANGELOG.md).

Aplikacja przeglądarkowa na panel maszyny. Pokazuje w 3D maszynę (piła
mostowa: ściany z prowadnicami, most z wózkiem, słup Z, głowica z obrotem A,
silnik z wychyłem B, osłona tarczy), stół i kamień z punktów jak w PLC,
tarczę (z obrotami wg napędu głównego), laser oraz wycięty rzaz: ściany cięcia
z obwiednią głębokości, szczelina na górnej powierzchni, a cięcie w stół na
czerwono.

- **Online (PLC):** pozycje osi i parametry są czytane przez **OPC UA z
  localhost** (serwer CODESYS na sterowniku), czyli te same zmienne co HMI.
- **Offline:** bez PLC. Animacja ruchu z **prędkościami, przyspieszeniami i
  hamowaniem jak w napędach** (profil trapezowy). Do wyboru:
  - operacje piły jak w PLC,
  - automat (bufor kroków),
  - ruchy ręczne (jog, pozycje A/B, ruchy interpolowane wzdłuż lasera),
  - dojazd do pozycji.

  Parametry wpisujesz ręcznie albo pobierasz z PLC.

Operacje piły: cięcie proste (`CutST`), pasy, bloki, krawędzie, zakoszenie,
łuk, okrąg, elipsa, profil krawędzi i wygładzanie. Frez, wiercenie i
polerowanie są na razie pominięte.

Budowa: serwer **Node.js** (`node-opcua-client`, SSE do strony) i strona
**three.js** (WebGL), budowana przez esbuild do `public/`.

## Pliki

| Plik | Co to |
|---|---|
| `src/shared/geometry.js` | geometria głowicy wg `CutST.GetPositions` / `GetNextDepth`; frez / wiertło / polerka wg `MillST`, `DrillST`, `Polishing` |
| `src/shared/cuts.js` | zapis wyciętego materiału (rzaz) z kolejnych pozycji |
| `src/shared/tools.js` | tryby po bazowaniu (`BaseHomingST`), program bazowania, operacje frezu, wiercenia i polerowania |
| `src/shared/toolcuts.js` | zapis śladu narzędzia na wrzecionie (rowki, otwory, polerowana powierzchnia) |
| `src/shared/motion.js` | ruch offline: profil trapezowy, program cięcia jak `CutST`, dojazd do pozycji |
| `src/shared/config.js` | zmienne PLC, kroki `CutStepType`, ustawienia domyślne, jednostki (m/min, m/s²) |
| `src/shared/area.js` | stół i kamień z punktów XYZ jak w PLC (`WorkArea`): wierzchołki, Z min stołu, wielokąt |
| `src/shared/cutst.js`, `sawlines.js`, `arcs.js`, `profiles.js`, `ops.js`, `common.js` | operacje piły jak w PLC (`CutST`, pasy, bloki, krawędzie, łuki, okręgi, elipsy, profile, wygładzanie) |
| `src/shared/automat.js` | automat: bufor kroków jak `ProgramAutoCutST` / `ProgramAutoProfileST` |
| `src/shared/planmarks.js` | znaczniki XY początku / końca akcji i odległości między punktami na podglądzie planu |
| `src/shared/jog.js` | ruchy ręczne (jog z rampą, interpolacja względem lasera), linia lasera |
| `src/shared/figpics.js`, `src/client/img/figures/` | rysunki poglądowe figur z literami (#138) – obrazki z HMI, schematy SVG |
| `src/shared/figures/` | figury automatu 1:1 z PLC (`FiguresGeometricSt`, `Get…Positions`): `rectangle.js`, `groupA.js` (trójkąty, trapezy, krzyż, wielokąt), `groupB.js` (daszki, blat, schody, książki, ćwierćwałek), `groupC.js` (figury frezu i wiercenia), rejestr `index.js` |
| `src/server/main.js` | serwer: strona, `/api/config`, `/api/events` (SSE), `/api/health` |
| `src/server/opcua-source.js` | odczyt zmiennych PLC przez OPC UA |
| `src/client/` | strona: `index.html`, `style.css`, `main.js` (tryby, panel), `view3d.js` (three.js), `machine3d.js` (głowica i suport) |
| `scripts/build-client.js` | budowa strony do `public/` |
| `test/` | testy (`node --test`) i `fake-plc-server.js` (OPC UA udające CODESYS) |
| `config.json` | ustawienia (adres OPC UA, port strony, wartości początkowe offline) |
| `vizu.ps1` | uruchamianie z PLC (jak `D:\Calc\calc.ps1`) |
| `build.ps1` | testy i paczka `dist\VizuApp\` na maszynę |

## Uruchamianie na maszynie

Tak jak kalkulator: PLC (`HMIScreen`) wykonuje polecenie przez
`SysProcessExecuteCommand2`:

```
cmd /c start "" powershell -nop -ep bypass -w hidden -File D:\VizuApp\vizu.ps1
```

`vizu.ps1` robi trzy rzeczy:
1. Jeśli serwer jeszcze nie działa, uruchamia go w tle (`node.exe app\src\server\main.js`).
2. Otwiera `http://127.0.0.1:8128/` w Edge albo Chrome w trybie aplikacji
   (okno bez pasków przeglądarki).
3. Jeśli okno VizuApp jest już otwarte, tylko wyciąga je na wierzch.

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

1. `powershell -File build.ps1` na komputerze z Node.js 20+. Skrypt robi
   `npm ci`, testy, buduje stronę i składa `dist\VizuApp\`: `node.exe`, `app\`
   (serwer, strona, `node_modules` bez narzędzi), `config.json` i `vizu.ps1`.
2. Zawartość `dist\VizuApp\` (ok. 110 MB, z czego 92 MB to `node.exe`)
   skopiuj na maszynę do `D:\VizuApp\`. Instalacja Node.js na maszynie nie jest
   potrzebna.
3. Na sterowniku musi działać serwer OPC UA CODESYS (port 4840). W symbol
   configu jest już `SupportOPCUA` i potrzebne zmienne (`HMI`, `HMI2`,
   `Communication`, `IOVars`).
4. Na panelu potrzebna jest przeglądarka z WebGL (Edge albo Chrome).

## Ekran

- **Online (PLC) / Offline**: przełącznik trybu.
- **Izometria / Góra / Przód / Bok / Dopasuj / + / −**: widok. Obracanie
  palcem lub lewym przyciskiem, przesuwanie dwoma palcami lub prawym
  przyciskiem, kółko przybliża, dwuklik dopasowuje.
- **Wyczyść**: usuwa narysowane cięcia. **Głowica** (tarcza, słup Z, silnik,
  osłona) i **Suport** (ściany, most, wózek, stół): pokaż / ukryj.
- **Plan**: podgląd toru operacji / automatu. **XY** (#137): na materiale
  znaczniki punktów początkowych i końcowych kolejnych akcji z wartościami
  X / Y (początek – zielona kropka i etykieta po lewej, koniec – czerwona po
  prawej, punkt wspólny dwóch akcji – pomarańczowy). Etykiety mają stałą
  wielkość na ekranie, a etykiety aktualnego kroku automatu są podświetlone
  na czerwono. Przy wierceniu znacznik jest w punkcie otworu. W połowie toru
  każdej akcji jest też odległość między jej punktem początkowym i końcowym
  (`… mm`, w linii prostej; niebieska etykieta), poza okręgami i wierceniem.
  **Odległości**: pokaż / ukryj odległości niezależnie od XY.
  **Laser**: offline laser włączony; online pokazywany, gdy w PLC świeci
  (`IOVars.yLaser`).
- Pasek na dole: X/Y/Z/A/B, głębokość. Online dodatkowo `CutStep`, krok
  automatu, piła (częstotliwość i kierunek), woda, laser. Offline: krok
  programu, czas i prędkość.

### Tarcza, laser, cięcie w stół (oba tryby)

- **Obroty tarczy:** szprychy i czerwony znacznik zęba obracają się, gdy piła
  pracuje. Kierunek jest wg `bMainDriveRunFWD` / `bMainDriveRunREV`, a
  częstotliwość wg `iMainDriveFreqAct` (w 0,01 Hz, `saw.freqScale`); wartość
  w Hz widać na pasku. Szybkość obrotu na ekranie jest umowna: `saw.visualRps`
  obr/s przy 50 Hz, bo prawdziwe ~50 obr/s zlałyby się w obraz. Offline piła
  pracuje w trakcie programu albo po „Piła ON” w zakładce Ręczne.
- **Laser:** żółta linia na powierzchni (kamień albo stół) w płaszczyźnie
  tarczy, wzdłuż kierunku cięcia przy danym A. Domyślnie świeci w prawą
  stronę (`laser.side` = 1, czyli +kierunek cięcia); długość to
  `laser.length`.
- **Cięcie w stół:** gdy tarcza schodzi poniżej spodu kamienia, rzaz w płycie
  stołu (grubość `tableThickness`) rysuje się na czerwono, a na górze ekranu
  pojawia się czerwona informacja o długości i głębokości. Rzaz w kamieniu
  zapisuje się tylko nad kamieniem.

### Stół i kamień (oba tryby)

Działa tak jak w PLC (`Settings/WorkArea`). Stół i kamień to po **8 punktów
XYZ**, czyli wierzchołki zapisane z pozycji osi:
- stół: `aCuttingBoardX/Y/Z [0..7]`, liczba wierzchołków `iCuttingBoardApexNumber`,
- kamień: `aCuttingRockX/Y/Z [0..7]`, liczba wierzchołków `iCuttingRockApexNumber`.

- **Online:** punkty czytane z PLC; tabele są tylko do podglądu.
- **Offline:** punkty wpisujesz w tabelach. „Poz.” wpisuje do wiersza aktualną
  pozycję osi X, Y, Z, jak zapis w PLC. „Liczba punktów” odpowiada liczbie
  wierzchołków.
- **Stół i cała maszyna** (ściany, most) mają rozmiar z obrysu punktów stołu i
  nie zmieniają się, gdy zmieniasz kamień. Przy mniej niż 3 punktach stołu
  przyjęty jest stół 3500 × 3000 od (0, 0).
- **Kamień** to wielokąt z punktów (nie musi być prostokątem) o grubości
  `fParameterMaterialThickness`. Przy mniej niż 3 punktach materiał rysuje się
  wokół cięć.
- **Góra materiału:** online z PLC (`fCutMaterialHeight`). Offline liczona jak w
  PLC: `Z min stołu − grubość`, gdzie Z min to jak `fCuttingBoardZMin`: pierwszy
  punkt zawsze, kolejne tylko z Z > 0.
- **Ostrzeżenia:** gdy kamień wychodzi poza stół (zakładka Stół i kamień) albo
  linia cięcia wychodzi poza kamień (zakładka Cięcie).

### Tryb offline (panel po prawej)

- **Operacja**: wybór programu piły i formularz jak na ekranach HMI.
  - Programy: cięcie proste (zewnętrzne / wewnętrzne / odwrócone), pasy,
    bloki, krawędzie, zakoszenie, łuk (promień / trzy punkty / cięciwa),
    okrąg, elipsa, profil krawędzi z wygładzaniem.
  - **Zapisz** (#139): pod polami X / Y każdego punktu (początek, koniec,
    start, narożnik, punkt środkowy łuku, …) przycisk, który jak w PLC
    przepisuje aktualną pozycję osi X / Y zaokrągloną do 0,01 mm
    (`TO_REAL(TO_DINT(fXActualPosition*100))/100.0`; np. `bManualXSaveZero`,
    `bManualEndPositionSave`, `bManualStripesStartSaveX/Y`,
    `bEdgesStartPositionSave`, `bManualArc…PositionSave`). Przycisk jest
    widoczny razem z polami punktu.
  - Cięcie proste jak `CutST.GetPositions` (`bManualTwoPoint`):
    - **dwa punkty**: kąt A liczony z punktów;
    - **kąt i długość**: koniec = start + L·(cos A, sin A), a z „Długość w
      stronę lasera” (`bManualToLaser`) start − L·(cos A, sin A); kąt głowicy
      zostaje zadany.
  - Formularze pokazują tylko pola zaznaczonej opcji. Na przykład koniec X/Y
    widać tylko przy „dwóch punktach”, kąt pasów tylko przy „pod kątem”,
    tabelę szerokości tylko bez stałej szerokości, pola łuku wg rodzaju, a
    tablicę głębokości wg trybu.
  - Wspólne parametry cięcia: tablica głębokości, skos, wyjazd nad materiał,
    wolniejsza końcówka.
  - Przebieg jak w PLC (`CutST` i programy z zadania `Programs`), dojazd jak
    `GoToPositionST`.
  - Przyciski: Start / Pauza / Stop. **Tempo animacji** (pasek u góry): 1× to
    czas rzeczywisty, do wyboru też 2×–100×.
- **Automat** (oba tryby): bufor kroków jak lista programu w HMI
  (`ProgramAutoCutST` / `ProgramAutoProfileST`), czyli X, Y, krok, R, kąt,
  głębokość, we/zew i punkt startowy.
  - Krok wiersza i działa od punktu i do i+1: cięcie, przejazd, łuki, okręgi,
    skosy, profile, wygładzanie, zmiana głębokości.
  - Końce cięć prostych i skosów (#135):
    - koniec zewnętrzny: najniższy punkt tarczy wychodzi za punkt linii o
      szerokość tarczy (`fParameterBladeWidth`), żeby cięcia przecinały się
      w narożnikach na całej głębokości;
    - koniec wewnętrzny (wewn., wewn. początek / koniec): rzaz nie wychodzi
      za punkt, także przy skosie. Odsunięcie końca jest liczone z
      głębokości w płaszczyźnie tarczy (z / cos B), a nie z pionowej jak w PLC.
  - Offline: tabela do edycji i „Przykład”; „Zapisz punkt startowy” wpisuje
    aktualną pozycję X / Y (`bProgramSaveStartPosition`, frez
    `bProgramMillStartPointSave`).
  - **Figura – wypełnij bufor jak PLC** (`FiguresGeometricSt`): wybierasz
    figurę i wpisujesz jej pola (jak na ekranach figur w HMI: start
    `fFigureX/YStartPosition`, długość, szerokość, kąt, promień, …).
    „Wypełnij bufor” liczy tablice jak blok figury w PLC (`Get…Positions`) i
    przepisuje je do bufora tak jak PLC (`aProgram… := aFigure…`,
    `aProgramNextStep := aFigureIndex`, liczba kroków `:= iFigureNumber`).
    Rodzaj programu ustawia się sam: piła, profile albo frez.
    - Figury: prostokąt, trójkąty (prostokątny, równoboczny, równoramienny),
      daszki, trapez, trapez 45°, blat, schody łukowe, krzyż, książki,
      ćwierćwałek, wielokąt oraz figury frezu i wiercenia (prostokąt ścięty,
      serce, narożniki, otwory, ociekacz, elipsy, stół frezarski, narożniki
      L, płyta indukcyjna). Kod przeniesiony 1:1 z bloków PLC
      (`src/shared/figures/`).
    - „Parametry figury”: zmienne PLC, które `FiguresGeometricSt` podaje
      figurom (`iManualInternal`, `bManualAdditionalDistance`,
      `bServiceRectangleACBD`, `fParameterMillWidth`, korekty daszków, …).
      Szerokość tarczy, grubość i `bServiceBlocksReverse` biorą się z
      Parametrów i wspólnych parametrów cięcia.
    - Figury frezu wypełniają bufor frezu (`ProgramAutoMillST`, kroki
      `ProgramMillStep`) tylko do podglądu toru. Visu3D nie symuluje frezu.
    - `PROFILES` (100) nie jest tworzeniem figury, tylko liczeniem profilu na
      istniejącym buforze, więc go tu nie ma.
  - Online: tablice `aProgram…` z PLC i podświetlenie bieżącego kroku.
- **Ręczne** (offline, wizualizacja nie steruje maszyną): jak ekran ruchów
  ręcznych w HMI.
  - **Prędkości ruchów** (#140, na dole ekranu): prędkość każdej osi osobno – X, Y, Z
    w m/min, A, B w °/s (`fJogXVelocity` … `fJogBVelocity`). To te same
    wartości co „Jog” w Parametrach, zmiana w jednym miejscu jest widoczna w
    drugim. Prędkości dotyczą jogu i jazdy „o” kąt (jak `MCJog` /
    `MCRelative` w PLC). Jazda „na” kąt i przyciski A / B idą z prędkością
    osi (`VelA` / `VelB`). Opcja „Przy pile ON jog z prędkością cięcia”
    (`bServiceManualRewriteJogSpeed`): przy włączonej pile X / Y jadą z
    prędkością cięcia, a Z z prędkością roboczą Z.
  - **Jog X/Y/Z/A/B ±**: oś jedzie, dopóki przycisk jest wciśnięty, z
    prędkością jog (`fJog[XYZAB]Velocity`) i rampą osi; po puszczeniu hamuje.
  - **Obrót A**: 0 / 90 / −90 / 180 / −180°. **Wychył B**: 0 / 30 / 45 / 60 /
    90° (dojazd z prędkością i rampą osi).
  - **Jazda na zadany kąt A / B**: „Jedź na” – absolutnie
    (`bManualAMoveToPosAbs` / `bManualBMoveToPosAbs`, prędkość `VelA` / `VelB`),
    „Jedź o” – o podany kąt (`…MoveToPosRel`, prędkość jog osi).
  - **Ruchy interpolowane** względem lasera: wzdłuż lasera, przeciwnie do
    lasera, prostopadle, prostopadle odwrotnie. Ruch w XY z prędkością cięcia i
    `Acc` / `Dec`, także w materiale, więc tnie.
  - **Piła ON/OFF**, kierunek FWD / REV i częstotliwość.
- **Pozycja**: u góry aktualne X/Y/Z/A/B (odświeżane na bieżąco, tylko odczyt), pod nimi zadane X/Y/Z/A/B.
  - **Jedź**: animowany dojazd; najpierw Z w górę, jeśli trzeba, potem
    wszystkie osie naraz, każda z własną rampą.
  - **Wstaw aktualną**: wpisuje do pól bieżące położenie osi.
- **Parametry**: tarcza i głowica oraz dynamika.

| Ruch | Prędkość | Przyspieszenie / hamowanie | Zmienna PLC (Pobierz z PLC) |
|---|---|---|---|
| cięcie XY (interpolacja) | m/min | m/s², osobno przysp. i ham. | `fVelocitySawMode`, `Acc`, `Dec` |
| dojazd X/Y | m/min | m/s² | `fVelocityFast`, `DecX` |
| oś Z | m/min | m/s² | `fVelocityAxisZWork`, `DecZ` |
| oś A / B | °/s | °/s² | `VelA`, `DecA` / `VelB`, `DecB` |
| jog X / Y / Z | m/min | jak dojazd X/Y, oś Z | `fJogXVelocity`, `fJogYVelocity`, `fJogZVelocity` |
| jog A / B | °/s | jak oś A / B | `fJogAVelocity`, `fJogBVelocity` |

W PLC wartości są w mm/s i mm/s². „Pobierz z PLC” przelicza je na m/min i
m/s², np. 150 mm/s = 9 m/min, a 300 mm/s² = 0,3 m/s². W PLC
(`Settings/VelocityAcceleration`) `Acc := Vel/TAccXY` i `Dec := Vel/TDecXY`, a
rampa trwa 0,5 s. „Pobierz z PLC” działa, gdy jest połączenie z PLC.
Formularze są zapamiętywane w przeglądarce.

### Bazowanie i tryby (#134)

Zakładka „Bazowanie” działa jak `BaseHomingST`: Z jedzie do 0, A na 0 najkrótszą
drogą, a B na 0° (piła) albo 90° (frez, wiercenie, polerowanie). Po
zakończeniu (`END_PROCEDURE`) maszyna jest zbazowana w wybranym trybie i
narzędzie w widoku zamienia się na narzędzie trybu:

| Tryb | Narzędzie | Średnica / długość |
|---|---|---|
| Piła | tarcza (jak dotąd) | `fParameterDiscDiameter`, `fParameterBladeWidth` |
| Frez | frez (chwyt + część robocza) | `fParameterMillWidth`, `fParameterMillLength` + `fParameterMillCorrection` |
| Wiercenie | koronka (rura) | `fParameterMillWidth` (to samo co frez), `fParameterDrillLength` + `fParameterMillCorrection` |
| Polerowanie | talerz na uchwycie | średnica z Parametrów (w PLC nie ma takiej zmiennej), długość `fParameterMillCorrection − ActiveTool.Height` |

Widoczne ekrany zależą od trybu i bazowania. „Stół i kamień”, „Pozycja”,
„Parametry” i „Bazowanie” są zawsze. „Operacja”, „Automat” i „Ręczne” są
tylko po bazowaniu i tylko te, które dotyczą trybu:

- piła: wszystkie operacje piły, automat cięcia i profili;
- frez: frezowanie linii (`MillST`), automat frezu (`ProgramAutoMillST`, figury frezu, podgląd);
- wiercenie: wiercenie (`DrillST`);
- polerowanie: polerowanie (`Polishing` – XY, YX, prostokąt CCW / CW).

Przerwanie bazowania (Stop, inny ruch) zostawia maszynę niezbazowaną. Online
tryb i bazowanie są czytane z PLC (`bModeSaw` / `bModeMill` / `bModeDrill` /
`bModePolishing`, `bSystemBased`); bez tych zmiennych przyjmowana jest
zbazowana piła. Ślad frezu i wiertła jest rysowany jako rowek / otwór o
średnicy narzędzia, polerka zostawia jasny ślad na powierzchni. Rzazy piły
zostają po zmianie trybu.

### Rysunki figur w automacie (#138)

W sekcji „Figura” zakładki Automat pod wyborem figury jest rysunek poglądowy z literami wymiarów, tak jak na
ekranach figur w HMI (DIAScreen), a przy polach figury – te same litery (A, B, H, R, D, W, X, Y …):
- obrazki są wyciągnięte z projektu HMI (`HMI/PilaJednosuportowaINNER.dpa`, bank `[Picture]`; `PictureOffset`
  elementu ekranu = przesunięcie rekordu BMP od początku banku) do `src/client/img/figures`;
- wariant obrazka jak w HMI: typ trapezu (`iTrapezoidType`), blatu (`iWorktopType`), książki (`iBookType`),
  ćwierćwałka (`iQuaterRoundType`); daszki składane z 4 przycisków ścian (`bRoof1..4Wall`, zielona = ściana
  cięta pod kątem) z położeniem i obrotem (`nAngle`) jak na ekranie;
- litery: tekst obok pola na ekranie figury → zmienna PLC (np. A = `fFigureLength`, W = `fCrossWidth2`,
  A..H = `aWorktopLenghts[0..7]`);
- figury, które w HMI nie mają obrazka (Narożniki, Dziury, Ociekacz, Frez stół, Naroża L, Indukcja, Wielokąt),
  mają schemat SVG w tym samym stylu; wielokąt rysuje się z wpisanych punktów.

Mapa figur, obrazków i liter: `src/shared/figpics.js`; testy `test/figpics.test.js`.

### Obroty narzędzi (#136)

Frez, wiertło (koronka) i polerka kręcą się razem z wrzecionem, tym samym napędem co tarcza (`bMainDriveOn`,
`iMainDriveFreqAct`; offline „Piła / Wrzeciono ON” w „Ręczne”, częstotliwość i kierunek FWD / REV):
- frez: 4 spiralne ostrza na części roboczej i ostrza na czole,
- wiertło: 6 segmentów na obwodzie czoła i pasy wzdłuż rury,
- polerka: 8 sektorów na spodzie talerza i znacznik na boku,
- czerwony znacznik: pierwsze ostrze / segment / sektor i kreska na chwycie (widać kierunek, także gdy czoło jest w materiale).

Prędkość na ekranie jest umowna: `saw.toolVisualRps` obr/s przy 50 Hz (domyślnie 3; tarcza – `saw.visualRps`).
Geometria znaczników: `src/shared/toolspin.js` (`toolLayout`, `toolSpinMarks`), testy `test/toolspin.test.js`.

## Konfiguracja (`config.json` obok `vizu.ps1`)

| Klucz | Domyślnie | Opis |
|---|---|---|
| `httpPort` | 8128 | port strony |
| `endpoint` | `opc.tcp://localhost:4840` | serwer OPC UA sterownika |
| `username`, `password` | puste | logowanie do OPC UA; puste oznacza anonimowe |
| `nodePrefix` | puste | np. `ns=4;s=\|var\|<urządzenie>.Application.`; puste oznacza szukanie węzłów w drzewie `.../Application/GlobalVars/<GVL>` |
| `pollMs` | 50 | okres odczytu; serwer czyta tylko wtedy, gdy strona jest otwarta |
| `variables` | `{}` | podmiana zmiennych, np. `{"materialHeight": "HMI.fParameterZMaterialHeight"}` |
| `autoClearOnStart` | `true` | nowe cięcie (`bCutStart`) czyści poprzednie |
| `materialMargin`, `materialMinSize` | 300, [1200, 800] | rozmiar materiału w trybie „bez wymiarów” (mm) |
| `frame` | patrz plik | model maszyny: `bridgeAlong` `"x"` (most wzdłuż X, jeździ w Y) albo `"y"`, `margin` (ściany od stołu), `bridgeZ` (spód mostu nad Z = 0), `ramLength` (słup Z), `tableHeight`, `show` |
| `tableThickness` | 80 | grubość płyty stołu - do tej głębokości rysowane cięcie w stół (mm) |
| `laser` | `{side: 1, length: 2500}` | laser: `side` 1 - w prawą stronę (+kierunek cięcia), −1 - w lewą; długość linii (mm) |
| `saw` | `{freqScale: 0.01, visualRps: 1.5, toolVisualRps: 3, fwdSign: 1}` | napęd tarczy / wrzeciona: `iMainDriveFreqAct` × `freqScale` = Hz; obroty na ekranie (obr/s przy 50 Hz) tarczy i narzędzi (frez, wiertło, polerka); kierunek dla FWD |
| `offline` | patrz plik | wartości początkowe formularzy offline; dynamika w m/min, m/s², °/s, °/s²; `board` / `rock` - punkty stołu i kamienia `{count, points: [[x, y, z], ...]}`; `saw` - piła offline `{freq, dir}`; `mode` - tryb po bazowaniu na starcie (`saw`, `mill`, `drill`, `polishing`) |

Czytane zmienne (wymagane są pozycje, średnica tarczy i wysokość materiału):

| Co | Zmienne PLC |
|---|---|
| X, Y, Z, A, B | `HMI2.fXActualPosition` … `HMI2.fBActualPosition` |
| tarcza | `HMI.fParameterDiscDiameter`, `HMI.fParameterBladeWidth` |
| głowica | `HMI.fParameterCutTiltDiameter`, `HMI.fParameterHeadRotationDiameter` |
| frez, wiertło, polerka | `HMI.fParameterMillWidth`, `HMI.fParameterMillTiltDiameter`, `HMI.fParameterMillLength`, `HMI.fParameterDrillLength`, `HMI.fParameterMillCorrection`, `ToolChangeGVL.ActiveTool.Height` |
| bazowanie, tryb | `HMI2.bSystemBased`, `HMI2.bModeSaw`, `HMI2.bModeMill`, `HMI2.bModeDrill`, `HMI2.bModePolishing` |
| materiał | `HMI.fCutMaterialHeight` (Z górnej powierzchni), `HMI.fParameterMaterialThickness` |
| stan | `HMI2.CutStep`, `HMI2.bCutStart`, `Communication.bMainDriveRunning`, `IOVars.yWaterCut` |
| laser, napęd tarczy | `IOVars.yLaser`, `Communication.iMainDriveFreqAct`, `Communication.bMainDriveRunFWD`, `Communication.bMainDriveRunREV` |
| automat | `HMI2.aProgramXPosition/YPosition/NextStep/Radius/Angle/Depth/DepthEnd/Length/OutIn`, `HMI.fProgramStartPositionX/Y`, `HMI2.iProgramCutNumber`, `HMI2.iActualNumberOfProgramCuts` (i odpowiedniki profili oraz frezu: `iProgramMillNumber`, `iActualNumberOfProgramMills`, `bProgramMillStart`) |
| stół, kamień | `HMI.aCuttingBoardX/Y/Z`, `HMI.iCuttingBoardApexNumber`, `HMI.aCuttingRockX/Y/Z`, `HMI.iCuttingRockApexNumber` |
| dynamika (offline) | `HMI.fVelocitySawMode`, `Acc`, `Dec`, `fVelocityFast`, `DecX`, `fVelocityAxisZWork`, `DecZ`, `fVelocityAxisZApproach`, `VelA`, `DecA`, `VelB`, `DecB`, `fJog[XYZAB]Velocity` |

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

Frez, wiertło i polerka (B 90°): oś wychyłu jest odsunięta od osi A o
`-MillTiltDiameter/2`, kołnierz narzędzia leży `CutTiltDiameter/2` od osi
wychyłu wzdłuż osi wrzeciona, a czoło narzędzia dalej o długość narzędzia.
Testy (`test/tools.test.js`) sprawdzają, że dla pozycji z formuł
`MillST.GetPositions` / `GetNextDepth`, `DrillST` i `Polishing` środek czoła
leży w zadanym punkcie, na zadanej głębokości (także frez pod kątem B).
Punkt styku z materiałem (czerwona kulka) to przy B 90° środek czoła, a przy
wychyle najniższy punkt krawędzi czoła.

## Rozwój i testy

Wymagany Node.js 20+ (sprawdzone na 24).

```powershell
npm ci
npm test                 # geometria, ruch, operacje, automat, jog / laser, OPC UA (testowy serwer), SSE
npm run offline          # strona bez PLC: http://localhost:8128
npm run fake-plc         # udawany CODESYS na opc.tcp://localhost:4840 ...
npm start                # ... i strona z danymi z niego (tryb Online)
```

**Porównanie figur z PLC** (`scripts/compare-figures-plc.mjs`): dla każdej
figury i trzech wariantów (domyślne, wewnętrzne, dodatkowa droga) wpisuje pola
do PLC, uruchamia `FiguresGeometricSt` i porównuje `aFigure…` oraz
`iFigureNumber` z buforem Visu3D (wszystkie kolumny, wiersz po wierszu).

```powershell
$env:PROJECT_PASSWORD = "..."
node scripts/compare-figures-plc.mjs --sim ..\PLC\PilaJednosuportowaAI.project   # symulacja DIADesigner-AX, projekt bez zapisu
node scripts/compare-figures-plc.mjs opc.tcp://localhost:4840                    # działający PLC testowy (zapisuje zmienne!)
```

Tryb `--sim` otwiera projekt w DIADesigner-AX bez interfejsu
(`scripts/plc_figures_sim.py`). Symulację urządzenia włącza tylko w pamięci,
loguje się, startuje aplikację i czyta zmienne przez API skryptowe. Projekt
nie jest zapisywany.
