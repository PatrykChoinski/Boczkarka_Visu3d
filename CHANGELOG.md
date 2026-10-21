# Changelog

Zmiany w Promasz Visu3D (VizuApp) – wizualizacji cięcia piły mostowej Promasz
(zgłoszenie [#128](https://github.com/Induprogress/Promasz_PilaJednosuportowa/issues/128)
w repo głównym). Do 2026-10-21 aplikacja była w repo HMI (`HMI/VizuApp`); historia commitów została przeniesiona tutaj.

## 2026-10-21

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
