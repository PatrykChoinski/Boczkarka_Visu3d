# Changelog

Zmiany w Promasz Visu3D (VizuApp) – wizualizacji cięcia piły mostowej Promasz
(zgłoszenie [#128](https://github.com/Induprogress/Promasz_PilaJednosuportowa/issues/128)
w repo głównym). Do 2026-10-21 aplikacja była w repo HMI (`HMI/VizuApp`); historia commitów została przeniesiona tutaj.

## 2026-10-21

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
