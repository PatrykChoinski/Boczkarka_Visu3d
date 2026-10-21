# Promasz Visu3D – wizualizacja cięcia (VizuApp)

Wizualizacja 3D piły mostowej **Promasz – Piła Jednosuportowa** (zgłoszenie
[#128 „Wizu Cięć maszyny”](https://github.com/Induprogress/Promasz_PilaJednosuportowa/issues/128)
w repo głównym). To repo jest podpięte jako submoduł `Visu3D` w
[Induprogress/Promasz_PilaJednosuportowa](https://github.com/Induprogress/Promasz_PilaJednosuportowa),
obok submodułów `PLC` i `HMI`. Wcześniej aplikacja była w HMI
(`HMI/VizuApp`) i stamtąd została przeniesiona razem z historią. Zmiany
opisuje [CHANGELOG.md](CHANGELOG.md).

**Podgląd w przeglądarce (GitHub Pages):** <https://patrykchoinski.github.io/Promasz-Visu3D/>. To wersja statyczna, bez
serwera VizuApp, więc działa tylko tryb Offline: symulacja operacji, automatu,
ruchów ręcznych i bazowania, bez połączenia z PLC. Jest publikowana
automatycznie po każdym pushu do `master`, ale tylko gdy przejdą testy (workflow
[`.github/workflows/ci.yml`](.github/workflows/ci.yml)). Formularze zapamiętuje
przeglądarka odwiedzającego.

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
łuk, okrąg, elipsa, profil krawędzi i wygładzanie. Frez (#131): linia,
łuk, okrąg, elipsa, pasy, bloki, krawędzie i automat frezu. Wiercenie (#133):
w punkcie i w miejscu. Polerowanie (#132): z powtórzeniami albo kolejką
narzędzi.

Budowa: serwer **Node.js** (`node-opcua-client`, SSE do strony) i strona
**three.js** (WebGL), budowana przez esbuild do `public/`.

## Pliki

| Plik | Co to |
|---|---|
| `src/shared/geometry.js` | geometria głowicy wg `CutST.GetPositions` / `GetNextDepth`; frez / wiertło / polerka wg `MillST`, `DrillST`, `Polishing` |
| `src/shared/cuts.js` | zapis wyciętego materiału (rzaz) z kolejnych pozycji |
| `src/shared/tools.js` | tryby po bazowaniu (`BaseHomingST`), program bazowania, operacje wiercenia (`DrillST`, `DrillSimpleST`) i polerowania (`Polishing`), lista operacji narzędzi |
| `src/shared/millops.js` | programy frezu jak w PLC (#131): `MillST`, `MillArcST`, `MillCircleST`, `MillElipseST`, `MillStripesST`, `MillBlocksST`, `EdgesST` (frez), tablica głębokości frezu, automat `ProgramAutoMillST` + `MillShapeST` |
| `src/server/auth.js` | logowanie (#145): użytkownicy z `users.json` (skróty scrypt), sesje, wylogowanie po bezczynności |
| `scripts/users.mjs` | zakładanie / zmiana haseł użytkowników w `users.json` |
| `src/shared/toolcuts.js` | zapis śladu narzędzia na wrzecionie (rowki, otwory, polerowana powierzchnia) |
| `src/shared/motion.js` | ruch offline: profil trapezowy, program cięcia jak `CutST`, dojazd do pozycji |
| `src/shared/config.js` | zmienne PLC, kroki `CutStepType`, ustawienia domyślne, jednostki (m/min, m/s²) |
| `src/shared/area.js` | stół i kamień z punktów XYZ jak w PLC (`WorkArea`): wierzchołki, Z min stołu, wielokąt |
| `src/shared/cutst.js`, `sawlines.js`, `arcs.js`, `profiles.js`, `ops.js`, `common.js` | operacje piły jak w PLC (`CutST`, pasy, bloki, krawędzie, łuki, okręgi, elipsy, profile, wygładzanie) |
| `src/shared/automat.js` | automat: bufor kroków jak `ProgramAutoCutST` / `ProgramAutoProfileST` |
| `src/shared/water.js` | woda i laser na głowicy: dysze, cele na tarczy, węże, krople, miejsce modułu lasera |
| `src/shared/planmarks.js` | znaczniki XY początku / końca akcji i odległości między punktami na podglądzie planu |
| `src/shared/jog.js` | ruchy ręczne (jog z rampą, interpolacja względem lasera), linia lasera |
| `src/shared/figpics.js`, `src/client/img/figures/` | rysunki poglądowe figur z literami (#138) – obrazki z HMI, schematy SVG |
| `src/shared/figures/` | figury automatu 1:1 z PLC (`FiguresGeometricSt`, `Get…Positions`): `rectangle.js`, `groupA.js` (trójkąty, trapezy, krzyż, wielokąt), `groupB.js` (daszki, blat, schody, książki, ćwierćwałek), `groupC.js` (figury frezu i wiercenia), rejestr `index.js` |
| `src/server/main.js` | serwer: strona, `/api/config`, `/api/events` (SSE), `/api/health` |
| `src/server/opcua-source.js` | odczyt zmiennych PLC przez OPC UA |
| `src/client/` | strona: `index.html`, `style.css`, `main.js` (tryby, panel), `view3d.js` (three.js), `machine3d.js` (głowica i suport) |
| `scripts/build-client.js` | budowa strony do `public/` |
| `scripts/build-pages.js` | wersja statyczna na GitHub Pages do `site/` (strona + `api/config` z `static: true`, tylko offline) |
| `.github/workflows/ci.yml` | CI: przy każdym pushu i PR testy na Windows (`npm test` + uruchomienie strony), po nich przy pushu do `master` publikacja na GitHub Pages |
| `scripts/smoke-test.mjs` | test uruchomienia strony w przeglądarce (Chrome / Edge headless): serwer bez PLC, z testowym PLC, wersja Pages |
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
   (serwer, strona, `node_modules` bez narzędzi), `config.json`, `vizu.ps1`
   i `users.json` (jeśli jest – patrz „Logowanie”).
2. Zawartość `dist\VizuApp\` (ok. 110 MB, z czego 92 MB to `node.exe`)
   skopiuj na maszynę do `D:\VizuApp\`. Instalacja Node.js na maszynie nie jest
   potrzebna.
3. Na sterowniku musi działać serwer OPC UA CODESYS (port 4840). W symbol
   configu jest już `SupportOPCUA` i potrzebne zmienne (`HMI`, `HMI2`,
   `Communication`, `IOVars`).
4. Na panelu potrzebna jest przeglądarka z WebGL (Edge albo Chrome).

### Logowanie (#145)

Użytkownicy jak w zgłoszeniu: **Operator**, **Serwis**, **Admin**. HMI i PLC
nie mają własnych użytkowników (w HMI jest tylko poziom 5 na przycisku ekranu
„serwis”), więc poziomy są takie:

| Poziom | Dostęp |
|---|---|
| niezalogowany | podgląd: widok 3D, „Bazowanie” tylko do odczytu, online automat z PLC; bez „Stołu i kamienia” |
| Operator | praca: Operacja, Automat, G-kod, Ruchy ręczne, Pozycja, Bazowanie, edycja stołu i kamienia |
| Serwis | jak Operator + Parametry i opcje serwisowe (`bService…`, pola „(serwis)”) |
| Admin | jak Serwis + „Parametry figury” (zmienne PLC podawane figurom) |

- Hasła sprawdza serwer. W pliku `users.json` obok `config.json` są tylko
  skróty scrypt haseł (sól + hash). Pliku nie ma w repo (`.gitignore`, repo jest
  publiczne). Zakładanie i zmiana hasła (hasło z wejścia, nie z linii poleceń):
  `node scripts/users.mjs set Operator`, `… set Serwis`, `… set Admin`;
  `node scripts/users.mjs list` – lista.
- Wylogowanie po bezczynności: `auth.timeoutMin` w `config.json` (domyślnie
  30 min, 0 – bez limitu). Sesja trwa do zamknięcia karty przeglądarki.
- Bez `users.json` (i w wersji na GitHub Pages) logowanie jest wyłączone i
  wszystko jest dostępne.

## Ekran

Przyciski ekranów (Stół i kamień, Operacja, Automat, G-kod, Pozycja, Parametry,
Bazowanie) są w kolumnie po lewej stronie jak menu HMI (`Menu_Lewo`), panel
wybranego ekranu – po prawej, z tytułem (ikona i nazwa ekranu).

**Ikony zamiast napisów.** Przyciski mają piktogramy zamiast napisów (łatwiej
przetłumaczyć aplikację na inne języki), opis jest w podpowiedzi po najechaniu
(atrybut `title`). Ikony to własne rysunki SVG w `src/client/icons.js`, bez
zewnętrznych bibliotek i czcionek (panel może nie mieć internetu). Teksty
zostały tam, gdzie ikona nie wystarczy: etykiety pól z nazwami zmiennych PLC,
podpowiedzi i komunikaty.

| Ikona | Znaczenie |
|---|---|
| procesor / monitor (PLC / SIM) | tryb online z PLC / symulacja offline |
| dłoń | okno Ruchy ręczne |
| prędkościomierz | tempo symulacji, prędkości jog |
| sylwetka, strzałka do / z drzwi | użytkownik, zaloguj / wyloguj |
| warstwy, tarcza z rzazem, lista z ▶, `</>`, celownik, suwaki, dom | ekrany: Stół i kamień, Operacja, Automat, G-kod, Pozycja, Parametry, Bazowanie |
| sześcian, kwadrat z krzyżem, przód, bok, ramka, lupy | widok: izometria, góra, przód, bok, dopasuj, przybliż / oddal |
| tarcza, most, przerywany tor, celownik, linijka, laser, gumka | warstwy: głowica, suport, plan, XY, odległości, laser; wyczyść |
| ▶ / ❚❚ / ośmiokąt | start, pauza / wznów, stop |
| dyskietka + pinezka | zapisz aktualną pozycję (punkt, start) |
| pinezka A / B / C, strzałka nad blokiem | punkty ręczne, nad materiał |
| strzałka ciągła / strzałka między kreskami | tryb ciągły / skok |
| obrót, wychył | oś obrotu (C / A), oś wychyłu B |
| piła, frez, wiertło, polerka | tryby po bazowaniu |

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
  `laser.length`. Moduł lasera (#141) jest narysowany na osłonie tarczy od
  strony lasera, `laser.mountAngle` stopni od góry (domyślnie 40°: na górnej krawędzi osłony przy narożniku, jak na zdjęciu w #141). Gdy laser
  świeci, z modułu do linii na materiale idzie półprzezroczysty wachlarz
  wiązki. W trybach frezu, wiercenia i polerowania moduł jest obok narzędzia.
- **Suport (#141):** przed przednim końcem prawego murka (od strony operatora)
  stoi panel operatorski: słupek i pochylona konsola z ekranem HMI, grzybkiem
  STOP oraz przyciskami. Można go wyłączyć: `frame.panel`.
- **Osłona tarczy i woda (#141, wg zdjęcia i filmu w zgłoszeniu):**
  - **Osłona tarczy** (osłonka na wodę) to kanciasta, jasna aluminiowa płyta
    o kształcie ze zdjęcia: pionowa krawędź, skos, płaska góra, druga
    krawędź, dół na dwóch wysokościach. Jest większa od tarczy, więc tarcza
    wychodzi tylko pod dolną krawędzią osłony. Wymiary w promieniach tarczy:
    pionowa krawędź 1,08, góra 1,10, druga krawędź 1,05, dół −0,62 / −0,45.
    Ma okrągłe wybranie wokół piasty, w którym widać nakrętkę.
  - **Odbojnik wody** jest jak płyta na zdjęciu, tylko zielony: gumowa płyta
    w poprzek rzazu pod przednim dolnym narożnikiem osłony (od strony skosu).
    Wisi od osłony do powierzchni materiału, najwyżej 0,8 promienia.
  - **Woda jak na zdjęciu:**
    - wszystko jest po zewnętrznej stronie osłony;
    - stalowy oplatany przewód schodzi do srebrnego rozdzielacza przy dolnym
      rogu osłony;
    - z rozdzielacza dwa niebieskie węże segmentowe (Loc-Line) idą do dwóch
      pomarańczowych dysz tuż obok piasty, a trzeci wąż do dyszy przy dolnej
      części tarczy.
  - **Narzędzia:** przy frezie, wierceniu i polerowaniu dysze są po obu
    stronach narzędzia.
  - **Przy włączonych obrotach** (jak na filmie) leci dużo wody (ok. 380
    kropli na dyszę i mgła):
    1. Woda trafia w początek tarczy, czyli w stronę, która przy danym
       kierunku obrotu schodzi w materiał, tuż nad powierzchnią.
    2. Część rozlewa się po tarczy i ją zasłania.
    3. Reszta obrót wciąga przez rzaz. Przy wyjściu z rzazu woda odrywa się w
       kierunku obrotu i nisko wzdłuż cięcia spada na materiał za tarczą.
       Kamień za tarczą jest mokry (połyskująca plama).
  - **Kierunek obrotu** dla FWD to `saw.fwdSign` (domyślnie −1: w materiał
    schodzi strona tarczy, w którą celują dysze).
  - **Online** woda zależy od zaworów z PLC (`IOVars.yWaterCut` dla
  piły, `IOVars.yWaterMill` dla frezu i wiercenia); bez tych zmiennych woda
  leci przy obrotach, tak jak offline.
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
  - Wspólne parametry cięcia: tablica głębokości, wyjazd nad materiał,
    wolniejsza końcówka.
  - Wychył (#142): jak na ekranie `manual_ciecie` – tylko w cięciu prostym
    (`CutST`): „Cięcie pod kątem – wychył B” (`bManualBAngle`) i kąt
    `fManualBSetPosition` (pole −2,5…90°, skos tylko dla 0 < B < 90 jak
    `GetPositions`). Pasy, bloki, krawędzie, łuk i okrąg w PLC zerują
    `bManualBAngle`, więc tu też tną pionowo; skosy automatu – kąt z wiersza.
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
      `ProgramMillStep`). W trybie frezu Start symuluje automat (#131):
      linie, łuki, okręgi, elipsy, skosy B, wiercenie, zmiana głębokości,
      potwierdzenie. „Zamknięte kształty” (`bProgramReapitingOver`) frezują
      zamknięty kształt w całości na każdej głębokości (`MillShapeST`).
    - `PROFILES` (100) nie jest tworzeniem figury, tylko liczeniem profilu na
      istniejącym buforze, więc go tu nie ma.
  - Online: tablice `aProgram…` z PLC i podświetlenie bieżącego kroku.
- **Ruchy ręczne** (#143, offline, wizualizacja nie steruje maszyną): okno
  otwierane przyciskiem „Ruchy ręczne” w górnym menu (jak „STEROWANIE RĘCZNE”
  w górnym menu HMI). Okno przesuwa się za nagłówek (pozycja zapamiętana w
  przeglądarce), zamyka przyciskiem × i jest aktywne tylko po bazowaniu.
  Układ i kolory jak ekrany HMI (pozycje elementów z projektu DIAScreen,
  skalowane do szerokości okna, którą można zmieniać):
  - **STEROWANIE RĘCZNE** (ekran `MPG`):
    - krzyż XY 3 × 3: Y+ / Y- / X- / X+ (jog osi) i skosy ↖ ↗ ↙ ↘ (ruch XY
      pod 135 / 45 / 225 / 315°, `bManualXY…`, tylko trzymany – jak
      `ManualInterpolationST`); Z- w górę, Z+ w dół;
    - LASER, pozycje osi X / Y / Z;
    - TRYB CIĄGŁY / TRYB SKOK (`bManualContinousMode`) i SKOK [mm]
      (`fManualJumpDist`): w trybie skok oś jedzie o skok (`MCRelative`),
      skosy o skok w kierunku skosu;
    - A / B / C – przejazd na punkty ręczne zapisane w zakładce Pozycja
      (`bManualMovePointA…C`, `bManualSavePointA…C`), NAD MATERIAŁ – Z nad
      materiał w aktualnym miejscu (`bManualMovePointD`), STOP;
    - USTAWIENIE OSI OBROTU (C – w PLC oś A): −180…+180°, USTAWIENIE OSI
      WYCHYLU (B): 0…90°;
    - pr. JOG X / Y / Z [m/min] (`fJogXVelocity` … – te same pola co „Jog” w
      Parametrach); SERWIS PRĘDKOŚĆ JOG → Parametry (od poziomu Serwis),
      USTAWIENIA POZYCJI → Pozycja.
  - **RUCHY INTERPOLOWANE** (ekran `MANUAL INTERPOLATION`): pozycja obrotu,
    zadany kąt i „ustaw głowicę” (`bManualAMoveToPosAbs`), presety C; ruch w
    kierunku lasera / przeciwnym / prostopadle + / − (przełączniki jak w HMI:
    ruch do STOP albo ponownego naciśnięcia); wychył – pozycja, zadany kąt
    (0–90°, `bManualBMoveToPosAbs`), presety B; ruch wzdłuż wychylonej tarczy
    ↙ / ↗ (`bManualMoveWithTiltDown` / `Up`: o 50 mm w Z, w XY o
    tan(B) · 50 mm w stronę skosu, tylko trzymany), LASER, STOP.
  - Prędkości jak w PLC: jog osi `fJog[XYZ]Velocity` (opcja serwisowa
    `bServiceManualRewriteJogSpeed` – przy pile X / Y z prędkością cięcia, Z
    roboczą), skosy i ruchy interpolowane – prędkość cięcia przy pile ON,
    inaczej dojazdu; ruch z wychyłem – Z robocza przy pile ON, inaczej
    dojazdowa.
  - Pod ekranem: START / STOP PIŁY (w HMI na ekranie cięcia), kierunek FWD /
    REV i częstotliwość.
- **Pozycja**: u góry aktualne X/Y/Z/A/B (odświeżane na bieżąco, tylko odczyt), pod nimi zadane X/Y/Z/A/B.
  - **Punkty ręczne A, B, C** (jak `Zapisane_Pozycje` w HMI): „Zapisz” wpisuje aktualną pozycję
    X/Y/Z/A/B (zapamiętaną w przeglądarce); przyciski A / B / C w oknie Ruchy ręczne jadą na punkt.
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
„Parametry” i „Bazowanie” są zawsze. „Operacja”, „Automat” i „Ruchy ręczne”
są tylko po bazowaniu i tylko te, które dotyczą trybu. Bez bazowania (#144)
nie ma żadnych ruchów poza bazowaniem, a ustawienia (stół i kamień, Pozycja,
Parametry) są zablokowane – na górze panelu jest komunikat:

- piła: wszystkie operacje piły, automat cięcia i profili;
- frez (#131): linia (`MillST`: dwa punkty albo kąt i długość), łuk
  (`MillArcST`: promień, trzy punkty, cięciwa, z / bez średnicy frezu), okrąg
  (`MillCircleST`: zewnętrzny / wewnętrzny / po linii, od środka albo od góry),
  elipsa (`MillElipseST`), pasy (`MillStripesST`, też frezowanie stołu), bloki
  (`MillBlocksST`), krawędzie prostokąta (`EdgesST` w trybie frezu), automat
  frezu (`ProgramAutoMillST`) z symulacją ruchu;
- wiercenie (#133): w punkcie (`DrillST`) i w miejscu (`DrillSimpleST` – od
  aktualnego Z), prędkość Z wiercenia `fVelocityAxisZDrill`;
- polerowanie (#132): `Polishing` – XY, YX, prostokąt CCW / CW, prędkość
  `fVelocityMillMode`, Z z wysokości materiału albo `fHeightPosition`
  („Zapisz Z” jak `bSaveZ`), powtórzenia narzędzi `aToolRepetitions` albo
  kolejka `aQueueTools` (rodzaje na narzędzie), wymiana narzędzia jako
  wyjazd w górę i postój (pozycje magazynu `PolishingToolChange` są w PLC
  zmienne, więc bez dojazdu).

Wspólne pola frezu (zakładka Operacja, „Głębokości frezu”): tablica głębokości
(`Depths`: grubość materiału + `fMillDepthMillReserve`, równe przejścia, stały
skok `fMillDepthMillHeight` z `fMillDepthMinLastJumpDistance` albo jedno
przejście), `bServiceMillZFirst`, `fCutOvertakingPrecent` (zjazd w Z w trakcie
ruchu i przejście czyszczące) i wyjazd nad materiał. Przejścia idą na zmianę w
obie strony jak w PLC. W pile ukryte są pola frezu (parametry frezu, wiertła,
polerki, „Parametry figury” frezu), w trybach narzędzi pola piły (tarcza,
`HeadRotationDiameter`, przesunięcie we/zew, korekty daszków).

Przerwanie bazowania (Stop, inny ruch) zostawia maszynę niezbazowaną. Online
tryb i bazowanie są czytane z PLC (`bModeSaw` / `bModeMill` / `bModeDrill` /
`bModePolishing`, `bSystemBased`); bez tych zmiennych przyjmowana jest
zbazowana piła. Ślad frezu i wiertła jest rysowany jako rowek / otwór o
średnicy narzędzia, polerka zostawia jasny ślad na powierzchni. Rzazy piły
zostają po zmianie trybu.

### G-kod / CNC 3D (#124, tylko tryb frezu)

Zakładka „G-kod” (widoczna w trybie frezu po bazowaniu) wczytuje program `.nc` i pokazuje, co frez zrobi
w materiale – jak moduł CNC w PLC:
- **Parser** (`src/shared/gcode.js`) jak preprocesor PLC: G0 / G1 (domyślnie G1), G2 / G3 z I / J (R liczone, ale
  z ostrzeżeniem – PLC go nie obsługuje), G90 / G91, G20 / G21, G53 (reszta linii pomijana, jak w PLC), F w mm/min,
  M03 / M05, koniec na M30, komentarze `( )` i `;`; G4 postój, G70 / G71; G28, G55–G59 i cykle G81–G84 pomijane z uwagą.
- **Punkt początkowy G54** = pozycja osi (`HMI.G54_X / Y / Z`, CNCInfo): X osi = G54_X + X, Y osi = G54_Y − Y
  (odwrócona oś Y), Z osi = G54_Z + Z (Z w głąb). Przyciski „= aktualna” i „bez promienia” (+ `fParameterMillWidth / 2`)
  jak `bSetG54_*`. Online G54 czytane z PLC. A i B bez zmian (frez B 90° po bazowaniu).
- **Ruch**: przed programem Z w górę o wyjazd nad materiał, potem ruchy z pliku – posuw F, G0 z prędkością dojazdu,
  ścieżka ograniczona jak `limitDyn` w PLC (200 mm/s XY, 20 mm/s Z), kolejne bloki bez zatrzymania.
- **Materiał**: mapa wysokości (`src/shared/heightmap.js`) w obszarze programu – płaskie czoło frezu o średnicy
  `fParameterMillWidth` obniża powierzchnię (nie niżej niż spód kamienia), kolor wg głębokości. „Start” – animacja
  (tempo jak w innych programach), „Wynik od razu” – cały program bez animacji (przykładowy plik 54 tys. linii ≈ 2 s),
  „Wyczyść materiał”. Online – gdy plik jest wczytany, ruchy z PLC wycinają mapę wysokości.
- **Podgląd 2D** w panelu: wynik z góry z cieniowaniem jak płaskorzeźba (światło z lewej góry) i pozycją frezu – czytelniejszy niż płaski relief w scenie 3D; w 3D kamień nad reliefem jest wtedy prawie przezroczysty.
- Tor programu w widoku: G1 pomarańczowy, G0 niebieski przerywany. Podsumowanie: ruchy, długości, szacowany czas,
  zakres X / Y / Z, ostrzeżenie, gdy program schodzi głębiej niż grubość kamienia.

Przykładowy plik: przycisk „Przykład” – `examples/madonna_frez_fi25mm_fixed.nc` (kopia z `Dodatkowe Programy` w repo głównym, frez Ø25). Testy: `test/cnc.test.js`.
Online bez maszyny: `node test/fake-plc-server.js --mode cnc` (frez wykonuje program `CNC_GCODE` od G54 700 / 900) + `npm start`.

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
| `frame` | patrz plik | model maszyny: `bridgeAlong` `"x"` (most wzdłuż X, jeździ w Y) albo `"y"`, `margin` (ściany od stołu), `bridgeZ` (spód mostu nad Z = 0), `ramLength` (słup Z), `tableHeight`, `show`, `panel` (panel operatorski przed prawym murkiem) |
| `tableThickness` | 80 | grubość płyty stołu - do tej głębokości rysowane cięcie w stół (mm) |
| `laser` | `{side: 1, length: 2500, mountAngle: 40}` | laser: `side` 1 - w prawą stronę (+kierunek cięcia), −1 - w lewą; długość linii (mm); `mountAngle` - moduł na osłonie tarczy, kąt od góry w stronę lasera (°) |
| `saw` | `{freqScale: 0.01, visualRps: 1.5, toolVisualRps: 3, fwdSign: -1}` | napęd tarczy / wrzeciona: `iMainDriveFreqAct` × `freqScale` = Hz; obroty na ekranie (obr/s przy 50 Hz) tarczy i narzędzi (frez, wiertło, polerka); kierunek dla FWD (−1: strona −u tarczy schodzi w materiał - tam leci woda z dysz) |
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
| stan | `HMI2.CutStep`, `HMI2.bCutStart`, `Communication.bMainDriveRunning`, `IOVars.yWaterCut`, `IOVars.yWaterMill` |
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

Wymagany Node.js 20+ (sprawdzone na 24; `npm test` z wzorcem plików potrzebuje 21+, CI używa 22).

```powershell
npm ci
npm test                 # geometria, ruch, operacje, automat, jog / laser, OPC UA (testowy serwer), SSE
npm run test:smoke       # uruchomienie strony w Chrome / Edge headless (jak w CI), zrzuty w test-results/
npm run offline          # strona bez PLC: http://localhost:8128
npm run fake-plc         # udawany CODESYS na opc.tcp://localhost:4840 ...
npm start                # ... i strona z danymi z niego (tryb Online)
```

**CI (GitHub Actions, `.github/workflows/ci.yml`)**: przy każdym pushu (każda
gałąź) i pull requeście na `windows-latest`:
1. `npm ci`;
2. `npm test`;
3. `scripts/smoke-test.mjs`. Buduje stronę i wersję statyczną, a potem w Chrome headless sprawdza trzy warianty:
   - serwer bez PLC: widok 3D i symulacja cięcia offline;
   - serwer z testowym PLC przez OPC UA: tryb online, połączenie i pozycje osi;
   - wersję statyczną pod `/Promasz-Visu3D/`: tylko offline, bez `api/events`, symulacja cięcia.

   Każdy błąd JS, konsoli albo HTTP na stronie przerywa test. Zrzuty ekranu są w artefakcie `zrzuty-strony`.

Dopiero gdy testy przejdą, push do `master` publikuje stronę na GitHub Pages
(job `deploy-pages`).

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
