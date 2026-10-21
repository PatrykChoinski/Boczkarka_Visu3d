# Changelog

Zmiany w Promasz Visu3D (VizuApp) – wizualizacji cięcia piły mostowej Promasz
(zgłoszenie [#128](https://github.com/Induprogress/Promasz_PilaJednosuportowa/issues/128)
w repo głównym). Do 2026-10-21 aplikacja była w repo HMI (`HMI/VizuApp`); historia commitów została przeniesiona tutaj.

## 2026-10-21

### Ręczne: prędkości ruchów dla każdej osi (#140)
- Ekran Ręczne, sekcja „Prędkości ruchów”: prędkość X, Y, Z [m/min] i A, B [°/s] (`fJogXVelocity` … `fJogBVelocity`).
  - To te same pola co „Jog” w Parametrach, synchronizowane w obie strony i zapamiętywane z formularzami.
- Jak w PLC (`SingleAxisMotion`):
  - jog i jazda „o” kąt (`MCJog` / `MCRelative`) jadą z prędkością jog osi;
  - jazda „na” kąt (`MCAbsolute`) jedzie z `VelA` / `VelB`. Wcześniej „Jedź o” używało `VelA` / `VelB`.
- Opcja „Przy pile ON jog z prędkością cięcia” (`bServiceManualRewriteJogSpeed`, `ManualST`): przy włączonej pile jog X / Y z prędkością cięcia (`fVelocitySawMode`), Z z prędkością roboczą (`fVelocityAxisZWork`). Opis prędkości jest w informacji pod ekranem.
- `jogVelocity`, `relativeMoveDynamics`, `JOG_DYN` w `jog.js`.
- Sprawdzone:
  - `npm test` 113/113 (nowy test w `test/jog.test.js`: prędkość i rampa każdej osi, przepisanie przy pile, jazda o 90° A z prędkością jog);
  - w przeglądarce: zmiana prędkości X na ekranie Ręczne → Parametry i jog X 3 m/min (96 mm w 2 s z rampą), zmiana w Parametrach → ekran Ręczne, opcja przy pile.

### Przyciski „Zapisz” punktów początkowych / końcowych (#139)
- Zakładka Operacja, pod polami X / Y każdego punktu: przycisk „Zapisz …” (początek, koniec, start, narożnik, punkt, punkt środkowy łuku, górny wierzchołek elipsy). Tak jak w PLC przepisuje aktualną pozycję osi X / Y zaokrągloną do 0,01 mm (`TO_REAL(TO_DINT(fXActualPosition*100))/100.0`).
  - Zmienne PLC w podpowiedzi przycisku:
    - cięcie proste i profil: `bManualXSaveZero` / `bManualYSaveZero`, `bManualEndPositionSave`;
    - pasy: `bManualStripesStartSaveX/Y`, `bCutStripesEndPositionSave`;
    - bloki: `bManualBlocksStartPositionSave90` / `…Save`;
    - krawędzie: `bEdgesStartPositionSave`;
    - zakoszenie: `bMowingSaveStartPosition`;
    - łuk: `bManualArcZero/End/MiddlePositionSave`;
    - frez, wiercenie: jak cięcie;
    - polerowanie: `bSaveStartPosition`.
  - Przycisk jest widoczny razem z polami punktu, np. „Zapisz koniec” znika przy kącie i długości.
- Automat: „Zapisz punkt startowy” (`bProgramSaveStartPosition`, frez `bProgramMillStartPointSave`), tylko offline.
- Definicje w operacjach: `saves: [{x, y, name, plc}]` (`ops.js`, `tools.js`), `savedPosition` - zaokrąglenie.
- Sprawdzone:
  - `npm test` 112/112, nowy `test/saves.test.js`;
  - w przeglądarce: cięcie proste (812.35 / 455.11 i 1500.01 / 455.11, znaczniki planu odświeżone), ukrywanie przy kącie i długości, liczba przycisków w każdej operacji, punkt startowy automatu.

### Znaczniki pozycji XY na podglądzie planu (#137)
- Przy rysowaniu kolejnych akcji (operacja, kroki automatu offline i online, figury, frez, wiercenie, polerowanie) na materiale są zaznaczone punkty początkowe i końcowe z wartościami `X … Y …`:
  - kropka: początek zielony, koniec czerwony, punkt wspólny (koniec akcji i = początek akcji i+1) pomarańczowy i tylko jeden;
  - etykieta samego początku jest po lewej stronie kropki, a pozostałe po prawej, więc bliskie punkty się nie zasłaniają;
  - etykiety aktualnego kroku automatu są podświetlone na czerwono;
  - wiercenie (operacja i krok `Drilling` frezu) ma znacznik w punkcie otworu.
- Odległości między punktami: w połowie toru każdej akcji etykieta `… mm` z odległością (w linii prostej) od punktu początkowego do końcowego:
  - przy łuku etykieta jest na łuku;
  - bez etykiety: akcja zamknięta (okrąg), wiercenie, odległość poniżej 1 mm;
  - niebieska ramka i tekst, aktualny krok automatu na czerwono;
  - osobny przełącznik **Odległości** na górnym pasku (ukrywanie niezależne od XY, zapamiętywane w przeglądarce); `planDistances`, `pathMiddle` w `planmarks.js`.
- Znaczniki mają stałą wielkość na ekranie i są zawsze na wierzchu. Przełącznik **XY** na górnym pasku, zapamiętywany w przeglądarce. Limit 120 znaczników.
- `src/shared/planmarks.js` (`planMarks`, `markLabel`), rysowanie w `view3d.addPlanMarks` (sprite'y z teksturą z canvas).
- Sprawdzone:
  - `npm test` 110/110, nowy `test/planmarks.test.js` (znaczniki i odległości);
  - w przeglądarce: prostokąt z figury w automacie (4 narożniki z XY, boki 1000 / 600 mm, podświetlenie aktywnego kroku), cięcie proste, wyłączenie XY.

### Automat: końce cięć zewnętrznych i wewnętrznych (#135)
- Cięcia proste i skosy w automacie:
  - koniec zewnętrzny: najniższy punkt tarczy wychodzi za punkt linii o szerokość tarczy. Tak samo jak `fCutOuterAdditionalDistance` w `CutST.GetPositions` (wartość = `fParameterBladeWidth`), dlatego cięcia figur (np. prostokąta) przecinają się w narożnikach na całej głębokości;
  - koniec wewnętrzny i pół-wewnętrzny: rzaz nie wychodzi za punkt. Bez skosu tak już było. Przy skosie rzaz wychodził ok. 10 mm za punkt (B 45°, grubość 40, tarcza Ø625), bo odsunięcie (`GetSawOffset`) i głębokość maksymalna (`GetMaxZDepth`) były liczone z głębokości pionowej, a cięciwa tarczy na powierzchni zależy od głębokości w płaszczyźnie tarczy (z / cos B). Teraz Visu3D liczy z głębokości w płaszczyźnie tarczy.
- `cutPlan` (`cutst.js`): nowa opcja `innerSlant`; automat podaje `outerAdd` = szerokość tarczy i `innerSlant`. Operacje z zakładki „Operacja” bez zmian (jak PLC).
- Uwaga z PLC (bez zmian w PLC): w `CutST` skos wewnętrzny liczy odsunięcie końca z głębokości pionowej, więc na maszynie rzaz przy skosie też może wychodzić za punkt wewnętrzny. Korekta `fParameterInnerCutCorrection` dla B (15 mm) tego przy 45° nie pokrywa.
- Sprawdzone:
  - `npm test` 99/99, nowy test w `test/ops.test.js`: zewn., wewn., wewn. początek / koniec, skos zewn. i wewn. 45°;
  - w przeglądarce prostokąt z figury: pełna głębokość przechodzi przez narożniki.

### Animacja obrotów: frez, wiercenie, polerowanie (#136)
- Narzędzia kręcą się z wrzecionem (ten sam napęd co tarcza w PLC – `bMainDriveOn` w `MillST`, `DrillST`, `DrillSimpleST`, `Polishing`; online `bMainDriveRunning`, `iMainDriveFreqAct`, FWD / REV):
  - frez: 4 spiralne ostrza na części roboczej (skręt 0,9 rad) i ostrza na czole;
  - wiertło (koronka): 6 segmentów na obwodzie czoła i pasy wzdłuż rury;
  - polerka: 8 sektorów na spodzie talerza i znacznik na boku;
  - czerwony znacznik (pierwsze ostrze / segment / sektor, kreska na chwycie) pokazuje kierunek, także przy czole w materiale.
- Prędkość na ekranie: `saw.toolVisualRps` obr/s przy 50 Hz (domyślnie 3), tarcza bez zmian (`saw.visualRps`).
- Geometria znaczników i układ części narzędzia (chwyt, część robocza) przeniesione do `src/shared/toolspin.js` (`toolLayout`, `toolSpinMarks`) – widok używa tych samych wymiarów co przedtem.
- Poprawka: linie obrotów (znaczniki narzędzi, szprychy i ząb tarczy, obwód czoła, oś A) mają `frustumCulled = false` – geometria jest podmieniana co klatkę, a three.js obcinał je po sferze otaczającej z pierwszej pozycji, więc znikały po odjechaniu narzędzia.
- Sprawdzone: `npm test` 105/105 (nowy `test/toolspin.test.js`: znaczniki na narzędziu w obrębie części dla frezu, wiertła i polerki przy A 0 / 37 / −90 i B 90 / 60, obrót wrzeciona obraca znaczniki wokół osi narzędzia o ten sam kąt, spirala frezu). W przeglądarce offline: bazowanie frez / wiercenie / polerowanie, wrzeciono ON – ostrza, segmenty i sektory obracają się.

### Ekran Bazowanie, tryby frez / wiercenie / polerowanie (#134)
- Nowa zakładka „Bazowanie” jak `BaseHomingST`:
  - Z do 0, potem A na 0 najkrótszą drogą i B na 0° (piła) albo 90° (frez, wiercenie, polerowanie);
  - po zakończeniu narzędzie w widoku zamienia się na narzędzie trybu;
  - przerwane bazowanie zostawia maszynę niezbazowaną;
  - online tryb i bazowanie są czytane z PLC (`bModeSaw` / `bModeMill` / `bModeDrill` / `bModePolishing`, `bSystemBased`).
- Narzędzia na wrzecionie (`toolFrame` w `geometry.js`) liczone odwrotnie do formuł `MillST.GetPositions` / `GetNextDepth`, `DrillST` i `Polishing`:
  - oś narzędzia `fParameterMillTiltDiameter/2` od osi A;
  - czoło `CutTiltDiameter/2` + długość narzędzia od osi wychyłu;
  - punkt styku z materiałem to środek czoła przy B 90°, przy wychyle najniższy punkt krawędzi;
  - laser startuje z osi narzędzia.
- Każde narzędzie ma swoją średnicę:
  - frez i wiertło: `fParameterMillWidth` (jedno narzędzie w PLC);
  - polerka: parametr wizualizacji, bo PLC nie ma średnicy polerki.
  - Długości: `fParameterMillLength` / `fParameterDrillLength` + `fParameterMillCorrection`, polerka `fParameterMillCorrection − ActiveTool.Height`.
  - Parametry są w zakładce „Parametry”, a online pochodzą z PLC.
  - Parametr figur „Szerokość frezu” usunięty, bo figury biorą `fParameterMillWidth` z parametrów maszyny. `bModeMill` w figurach jest teraz brany z trybu.
- Ekrany tylko trybu (Operacja / Automat / Ręczne dopiero po bazowaniu):
  - piła: jak dotąd;
  - frez: frezowanie linii (`MillST`) i automat frezu z figurami frezu (online `iProgramMillNumber` / `iActualNumberOfProgramMills` / `bProgramMillStart`);
  - wiercenie: wiercenie (`DrillST`);
  - polerowanie: polerowanie (`Polishing`, tor XY / YX / prostokąt CCW / CW jak `MOVE_POLISHING_X/Y` + `CHECK_END_LINE`).
- Ślad narzędzia (`toolcuts.js`, `view3d.setToolCuts`):
  - frez: rowek o średnicy narzędzia (ściany, dno, pasek na górze);
  - wiertło: otwór;
  - polerka: jasny ślad na powierzchni;
  - w stole na czerwono jak przy pile. Rzazy piły zostają po zmianie trybu.
- Głowica w trybie narzędzia jest bez osłony tarczy, z wrzecionem do kołnierza narzędzia. Napęd w „Ręczne” i na pasku stanu nazywa się „Wrzeciono”.
- OPC UA czyta też pola struktur (`ToolChangeGVL.ActiveTool.Height`). Testowy PLC ma opcję `--mode saw|mill|drill|polishing`, w której robi operację narzędzia w pętli.
- Uwaga z PLC: `Polishing.END_MOVE_ABOVE_MATERIAL` liczy Z bez `ActiveTool.Height` (w odróżnieniu od dojazdu). Visu3D wyjeżdża nad materiał z uwzględnieniem wysokości narzędzia, żeby polerka nie wchodziła w kamień.
- Sprawdzone:
  - `npm test` 98/98, w tym nowy `test/tools.test.js`: czoło narzędzia w punkcie z formuł PLC dla frezu, wiertła i polerki (A 0 / 37 / −90 / 180, z korektą i bez), frez pod kątem B 60 / 45, bazowanie, tory polerowania, wiercenie, frezowanie linii.
  - W przeglądarce offline: bazowanie piła → frez → wiercenie → polerowanie, zamiana narzędzia i zakładek, frezowanie linii, otwór, polerowanie.
  - Online z testowym PLC w trybie frezu: tryb, bazowanie i `ActiveTool.Height` z PLC, zakładki trybu.

### Figury w automacie – wypełnianie bufora jak PLC (#128)
- Zakładka Automat, sekcja „Figura”: wybór figury i jej pola (jak ekrany figur w HMI), „Wypełnij bufor”. Działa tak jak PLC:
  - `FiguresGeometricSt` przekazuje pola figury do bloku `Get…Positions`;
  - wynik jest przepisywany do bufora jak w `GetDemoProgram` (`aProgram… := aFigure…`, `aProgramNextStep := aFigureIndex`, liczba kroków `:= iFigureNumber`);
  - rodzaj programu ustawia się sam (piła / profile / frez).
- Wszystkie figury `FigureType` oprócz `PROFILES` (100), który liczy profil na istniejącym buforze, a nie tworzy figury. Bloki przeniesione 1:1 z kodu PLC (`src/shared/figures/`):
  - piła: prostokąt (`GetRectanglePositions_1`), trójkąty prostokątny / równoboczny / równoramienny, daszki (`GetRoofPositions` + `GetAdditionalDistance`), trapez, trapez 45°, blat (`GetWorktopPositions`), schody łukowe, krzyż, wielokąt;
  - profile: książki, ćwierćwałek;
  - frez / wiercenie: prostokąt ścięty, serce, narożniki, otwory, ociekacz, elipsa (1 punkt i 120 punktów), stół frezarski, narożniki L, płyta indukcyjna.
- „Parametry figury” to zmienne PLC, które `FiguresGeometricSt` podaje figurom: `iManualInternal`, `bManualAdditionalDistance` / `fManualAdditionalDistance`, `bServiceRectangleACBD`, `fParameterMillWidth`, korekty daszków, nowe punkty startu frezu, `iMachineNumber`, `bServiceBookMinimalRadius`. Szerokość tarczy, grubość i `bServiceBlocksReverse` są brane z Parametrów i wspólnych parametrów.
- Figury frezu wypełniają bufor frezu (`ProgramAutoMillST`, kroki `ProgramMillStep`, nowy rodzaj „Frez – podgląd”). Widać tabelę z nazwami kroków frezu i podgląd toru, ale nie ma symulacji ruchu, bo Visu3D nie symuluje frezu.
- Zachowania PLC przeniesione tak jak są (z komentarzem w kodzie), m.in.:
  - trapez 45° nie ma kąta 45° (`fLength := fFigureHeight + 8`);
  - wielokąt nie używa `aPolygonFunction`;
  - błędne indeksy kroków w trójkątach przy dodatkowej drodze;
  - daszki zawsze zewnętrzne;
  - `iNumber := 10` w książkach z wygładzaniem;
  - tablice przycinane do `[0..100]` przez `CheckBounds` z globalnymi `Radius` / `Depth`;
  - promień elipsy 120 punktów z drugiej instancji FB.
- Sprawdzone:
  - `npm test` 89/89: rejestr (23 figury budują bufor, kroki z właściwego enuma), prostokąt punkt w punkt jak `GetRectanglePositions_1`, testy grup A / B / C z wartościami liczonymi z formuł ST, bufor prostokąta → program automatu.
  - W przeglądarce: wszystkie 23 figury wypełniają bufor (właściwy rodzaj programu, bez NaN i nieznanych kroków), a 13 buforów piły i profili przechodzi przez automat jako program ruchu.
  - **Zgodność z PLC: 69 / 69.** `scripts/compare-figures-plc.mjs --sim` porównał 23 figury × 3 warianty (domyślne, wewnętrzne, dodatkowa droga) z `PilaJednosuportowaAI.project` uruchomionym w symulacji DIADesigner-AX. Kod PLC jest skompilowany i działa; skrypt wpisuje pola, uruchamia `FiguresGeometricSt` i czyta `aFigure…`. Wszystkie kolumny bufora i `iFigureNumber` są identyczne. Projekt nie jest zapisywany. Jest też tryb OPC UA dla działającego PLC testowego.

### Cięcie proste: dwa punkty / kąt i długość, pola wg opcji, jazda na zadany kąt A / B (#128)
- Cięcie proste jak `CutST.GetPositions` (`bManualTwoPoint`): dwa punkty albo kąt i długość. Przy kącie i długości koniec = start + L·(cos, sin), a z `bManualToLaser` start − L·(cos, sin); kąt głowicy A zostaje zadany (`cutParams.angle`, `cutAngle`).
- Pola formularzy z warunkiem `show(v)`: widoczne tylko przy zaznaczonej opcji.
  - Cięcie: koniec X/Y albo kąt, długość, „w stronę lasera”.
  - Pasy: koniec przy dwóch punktach, długość bez nich, kąt przy „pod kątem”, szerokość i liczba albo tabele.
  - Łuk wg rodzaju (promień / trzy punkty / strzałka); profil: skok wygładzania.
  - Wspólne: przejścia albo skok głębokości wg trybu tablicy, wychył B przy skosie.
- Zakładka Ręczne: jazda na zadany kąt A i B, absolutnie (`bManualAMoveToPosAbs` / `bManualBMoveToPosAbs`) albo o kąt (`…MoveToPosRel`), z prędkością i rampą osi.
- Sprawdzone: `npm test` 41/41 (nowy test kąta i długości); w przeglądarce przełączanie pól cięcia i pasów, A 0 → 45 (absolutnie) → 15 (−30 względnie), B → 30.

### Laser, obroty tarczy, cięcie w stół, ruchy ręczne (#128)
- **Laser:** żółta linia na powierzchni (kamień albo stół) w płaszczyźnie tarczy, wzdłuż kierunku cięcia przy danym A, domyślnie w prawą stronę (`laser.side` = 1, `laser.length`). Online, gdy świeci w PLC (`IOVars.yLaser`); offline przełącznik „Laser”.
- **Obroty tarczy:** szprychy i znacznik zęba obracają się, gdy piła pracuje.
  - Online: kierunek z `Communication.bMainDriveRunFWD` / `bMainDriveRunREV`, częstotliwość z `iMainDriveFreqAct` × `saw.freqScale` (0,01 Hz).
  - Offline: piła pracuje w programie albo po „Piła ON” w zakładce Ręczne (kierunek, Hz).
  - Szybkość obrotu na ekranie jest umowna (`saw.visualRps` przy 50 Hz); Hz i kierunek są na pasku stanu.
- **Cięcie w stół:** drugi zapis rzazu dla płyty stołu (`tableThickness`, domyślnie 80 mm), rysowany na czerwono, plus czerwona informacja w HUD. Rzaz w kamieniu zapisuje się tylko nad kamieniem (wielokąt z punktów).
- **Zakładka Ręczne (offline):**
  - Jog X/Y/Z/A/B ± z przytrzymaniem: prędkości `fJog[XYZAB]Velocity` (nowe w Parametrach, „Pobierz z PLC”), rampa osi, hamowanie po puszczeniu.
  - Pozycje A 0 / 90 / −90 / 180 / −180 i B 0 / 30 / 45 / 60 / 90 (jak `bManualASetPosition…` / `bManualBSetPosition…`).
  - Ruchy interpolowane względem lasera: wzdłuż, przeciwnie, prostopadle, prostopadle odwrotnie. Prędkość cięcia i `Acc` / `Dec`; w materiale tną.
  - Piła ON/OFF.
  - W trybie online zakładka jest ukryta: wizualizacja nie steruje maszyną.
- Nowy moduł `src/shared/jog.js` (`JogMotion`, kierunki interpolacji, `laserLine`) z testami `test/jog.test.js`. Testowy PLC podaje laser, częstotliwość i kierunek napędu, prędkości jog oraz program automatu (tablice `aProgram…` [0..249], punkt startowy; bieżący krok zmienia się co 6 s).
- Sprawdzone:
  - `npm test` 40/40.
  - W przeglądarce offline: każda operacja buduje program; automat (przykład, 6 kroków) przechodzi do końca; interpolacja „wzdłuż lasera” przy A 30° na głębokości 60 mm przy kamieniu 40 mm daje rzaz 40 mm w kamieniu i 20 mm w stole (czerwony), a droga 60 mm w 2 s zgadza się z rampą.
  - Online z testowym PLC: laser przy cięciu, szprychy się obracają, na pasku „piła 50.0 Hz FWD”; automat: 5 kroków z PLC w tabeli, bieżący krok podświetlony w tabeli i na torze, na pasku „Automat: krok 3 / 5 – Cięcie”.

### Operacje piły i automat (#128)
- Silnik operacji jak w PLC: `cutst.js` (`CutST`: wewnętrzne, odwrócone, skos, tablica głębokości), `sawlines.js` (pasy, bloki, krawędzie), `arcs.js` (łuk, okrąg, elipsa), `profiles.js` (profile, wygładzanie), `ops.js` (definicje formularzy) oraz `ProgramBuilder` w `motion.js` (dojazd jak `GoToPositionST`).
- Zakładka Operacja: wybór programu i formularz jak na ekranach HMI, wspólne parametry cięcia, podgląd toru (Plan).
- Zakładka Automat (`automat.js`): bufor kroków jak `ProgramAutoCutST` / `ProgramAutoProfileST`. Offline jest tabela kroków; online czytane są tablice `aProgram…` z PLC i podświetlany jest bieżący krok.
- Rzazy: przebudowa siatek tylko dla zmienionych cięć, limit 4000 cięć.

### Przeniesienie do osobnego repo
- Aplikacja przeniesiona z `Promasz_PilaJednosuporotowa-HMI/VizuApp` do tego repo (z historią, `git subtree split`); w repo głównym podpięta jako submoduł `Visu3D`. Ścieżki w aplikacji są względne, więc nic w kodzie się nie zmieniło. `.gitignore` = szablon Node.js + `public/`, `dist/`.

### Stół i kamień z 8 punktów XYZ (jak w PLC)
- Zakładka „Stół i kamień”: jak w PLC (`Settings/WorkArea`) po 8 punktów XYZ.
  - Stół: `aCuttingBoardX/Y/Z`, `iCuttingBoardApexNumber`.
  - Kamień: `aCuttingRockX/Y/Z`, `iCuttingRockApexNumber`.
  - Online wartości są czytane z PLC (OPC UA, tablice `[0..7]`). Offline wpisuje się je w tabelach; „Poz.” wpisuje aktualną pozycję osi.
- Stół i maszyna (ściany, most) mają rozmiar z obrysu punktów stołu, więc zmiana kamienia ich nie zmienia. Kamień rysuje się jako wielokąt z punktów.
- Góra materiału offline jest liczona jak w PLC: `fCutMaterialHeight := fCuttingBoardZMin - grubość`. Aplikacja ostrzega, gdy kamień wychodzi poza stół albo linia cięcia poza kamień.

### Jednostki, głowica i suport
- Prędkości na ekranie są w m/min, a przyspieszenia i hamowanie w m/s². Osie A/B zostały w °/s. „Pobierz z PLC” przelicza wartości z mm/s i mm/s².
- Model piły mostowej: ściany z prowadnicami, most z wózkiem, płyta stołu, słup Z, korpus obrotu A, silnik i osłona tarczy z wychyłem B. Przełączniki „Głowica” i „Suport”, wymiary w `config.json` (`frame`).

### Node.js + przeglądarka, tryb offline
- Przepisanie z Pythona (tkinter) na Node.js. Serwer (`node-opcua-client`) czyta zmienne PLC przez OPC UA i podaje je stronie (SSE, `http://127.0.0.1:8128`). Strona three.js rysuje materiał, tarczę i rzaz.
- Tryb offline (bez PLC):
  - Zadane cięcie: punkty linii, wychył B, głębokość, przejścia.
  - Zadana pozycja osi X/Y/Z/A/B.
  - Animacja z profilem trapezowym. Prędkość, przyspieszenie i hamowanie odpowiadają PLC (`fVelocitySawMode`, `Acc`, `Dec`, `fVelocityFast`, `DecX`, `fVelocityAxisZWork`, `DecZ`, `VelA` / `DecA`, `VelB` / `DecB`).
  - Przebieg jak w `CutST`; dojazd odbywa się na wysokości bezpiecznej dla obrotu B.
- Uruchamianie jak kalkulator: `vizu.ps1` (serwer `node.exe` w tle + Edge / Chrome `--app`). `build.ps1` tworzy paczkę `dist\VizuApp` razem z `node.exe`.

## 2026-10-20

### Pierwsza wersja (Python)
- Wizualizacja pojedynczego cięcia z obrotem A i wychyłem B, dane z OPC UA, geometria głowicy według `CutST.GetPositions` / `GetNextDepth`. Python, tkinter, PyInstaller; zastąpione wersją Node.js.
