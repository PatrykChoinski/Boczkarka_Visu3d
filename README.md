# Boczkarka Visu3D – wizualizacja boczkarki profilowej (VizuApp)

Wizualizacja 3D boczkarki profilowej Promasz (konstrukcja jak B1PK-14.0-2000.2: jedna głowica z silnikiem
wrzecionowym i tarczą garnkową na ramieniu wychylnym B, przejazd X wzdłuż stołu). Submoduł `Visu3D` repo
[Promasz_Boczkarka](https://github.com/PatrykChoinski/Promasz_Boczkarka) (obok `PLC` i `HMI`).

Wygląd jak na zdjęciach B1PK-14.0-2000.2S (zpupromasz.pl): jasnoszara rama, czarny blat z rolkami kulowymi, belka
z żółtym pasem, wózek i głowica w żółtych obudowach, tarcza w półkolistej osłonie, drugie
wrzeciono ze szczotką, prowadnik kabli, szafa na prawym końcu; kamera od strony operatora. Widok pokazuje
głowicę pochyloną o kąt B, docisk, wodę, obroty tarczy oraz **krawędź płyty obrabianą przejście po przejściu** (fasetki ćwierćwałka / półwałka, fazy, bok prosty,
bieżący przejazd zeszlifowany do aktualnej pozycji X). Panel: krok automatu, przejście i/n, X, B, wrzeciono, czas,
liczniki, alarmy i przekrój krawędzi 2D (stan obecny i profil docelowy).

## Tryby

- **Offline** – symulator cyklu w przeglądarce (`src/shared/simulator.js`): ta sama sekwencja co
  `EdgeProfileControl` w PLC (kroki `EdgeStep`), osie X i B z profilem trapezowym, rozruch wrzeciona, docisk,
  pauza / wznowienie, stop, autopowrót. Receptura z formularza (7 receptur startowych jak w PLC, rodzaj profilu,
  pole X, posuw, obroty, kąty), tempo 1–30×. Działa też bez serwera (wersja statyczna `npm run build:pages`; publikacja GitHub Pages po włączeniu Pages w repo i zmiennej `PAGES_ENABLED=true`).
- **Online** – wartości z PLC przez OPC UA (serwer VizuApp, `node-opcua-client`, subskrypcje). **Adres IP serwera
  OPC UA** (sterownika) wpisywany na stronie (Adres IP + port, „Połącz”) – zapis w `connection.json` obok
  `config.json`, „Domyślny” wraca do adresu z `config.json`. Lista przejść liczona na stronie tym samym algorytmem co
  PLC (`src/shared/edgeprofile.js`) z receptury cyklu `EdgeProfile.CycleProfile`. Sterowanie (START, PAUZA, STOP,
  reset alarmów, tryb) – tylko zmienne z listy `PLC_WRITES` (`src/shared/config.js`).

## Układ strony (jak VizuApp piły)

Górny pasek: tryb PLC / SIM, połączenie z PLC, alarmy, STOP / PAUZA, tempo symulacji, logowanie w prawym górnym
rogu. Ekrany w lewym pasku: Automat, Serwis; Ręczny - przesuwane okno (przycisk z ręką na pasku, jak w pile). Widok 3D z narzędziami widoku, panel ekranu po prawej,
stan maszyny (X, B, wrzeciono, krok, przejście, czas, licznik) na dolnym pasku.

## Panel obsługi

- **Logowanie** w prawym górnym rogu, zawsze 3 konta: **Operator** (START, tryb, receptura, Ręczny), **Serwis** i
  **Admin** (dodatkowo Serwis – parametry, adres OPC UA). Bez logowania: podgląd, STOP, PAUZA. Hasła w `users.json` obok
  `config.json` (poza repo): `node scripts/users.mjs set Operator` (tak samo `Serwis`, `Admin`). Bez `users.json` konta są
  bez hasła i można je otworzyć tylko na komputerze z VizuApp (z tabletu w sieci nie). Serwer sprawdza poziom przy
  każdym zapisie (403). Tryb SIM i wersja statyczna (Pages): logowanie bez hasła, tylko na stronie (bez dostępu do PLC); tryb PLC: hasło.
- **Alarmy**: okno z paska – aktywne i **historia z bazy** `alarms.db` (SQLite obok `config.json`; serwer zapisuje
  wystąpienie i ustąpienie każdego alarmu PLC, także bez otwartej strony), kwitowanie od Operatora.
- **Ręczny**: jog X± / B± (przycisk trzymany, `/api/plc/hold`, serwer puszcza po utracie strony), jog szybko,
  dojazd do X / kąta B, wrzeciono z obrotami, woda, docisk – zmienne `Manual.*` w PLC. Offline: osie
  symulatora, gdy automat stoi.
- **Serwis**: parametry trwałe PLC (`SERVICE_PARAMS` w `src/shared/config.js`: `AxesConfig`, `SpindleConfig`,
  `EdgeProfileConfig`, `MachineConfig`) z zakresem sprawdzanym na stronie i w serwerze (400), TIME na stronie w s,
  w PLC w ms; zapis po zmianie pola. Offline: parametry z odpowiednikiem w symulatorze.

## Uruchomienie

```powershell
npm ci
npm start                      # serwer + strona http://localhost:8128 (OPC UA z config.json / connection.json)
npm run offline                # bez PLC
node test/fake-plc-server.js --port 4850 --auto     # testowy PLC (udaje CODESYS), potem na stronie: localhost, port 4850
```

Strona z `?lite` w adresie: bez cieni i wygładzania (słaby tablet, przeglądarka bez GPU).

Opcje serwera: `--port`, `--host 0.0.0.0` (tablet w sieci), `--endpoint opc.tcp://IP:4840`, `--no-plc`,
`--config`, `--users` (logowanie, `scripts/users.mjs`), `--alarms-db`.
Na maszynie: `build.ps1` → `dist\VizuApp` (node.exe + aplikacja), start przez `vizu.ps1`.

## Zmienne PLC

Mapa w `src/shared/config.js` (`VARIABLES`) – GVL dziedzin z `PLC/src`: `Axes.StatusX/B.Position`,
`EdgeProfile.*` (krok, przejście, kierunek, kopia receptury), `RecipeStore.Active.*`, `Spindle.Status.*`,
`Io.Outputs.Water/Clamp`, `Alarms.Active`, `Times.*`, `MachineCounters.*`. Węzły znajdowane przeglądaniem drzewa
`Application/GlobalVars` (jak w CODESYS) albo z `nodePrefix` w `config.json`. Diagnostyka: `GET /api/variables`.
Geometria maszyny do modelu i wielkość profilu na rysunku: `config.json` (`machine`, `shape`), dynamika trybu
offline: `offline` (jak parametry `AxesConfig` / `SpindleConfig` / `EdgeProfileConfig` w PLC).

## Struktura

| Plik | Co |
|---|---|
| `src/server/main.js` | serwer HTTP: strona, `/api/config`, SSE `/api/events`, `/api/connection` (adres OPC UA), `/api/plc/*`, logowanie, historia alarmów |
| `src/server/opcua-source.js` | klient OPC UA: przeglądanie drzewa, subskrypcje, ponowne łączenie, zmiana adresu w locie |
| `src/server/plcwrite.js` | zapis zmiennych z listy `PLC_WRITES`, przyciski chwilowe |
| `src/shared/edgeprofile.js` | receptury: `generatePasses`, `validateProfile`, receptury startowe (port z PLC) |
| `src/shared/simulator.js` | symulator offline (sekwencja `EdgeProfileControl`) |
| `src/shared/edgeshape.js` | przekrój krawędzi po przejściach, punkt styku tarczy |
| `src/client/view3d.js` | scena three.js: maszyna, płyta, krawędź, głowica |
| `src/client/main.js` | strona: tryby, formularz, połączenie, panel |
| `test/fake-plc-server.js` | testowy serwer OPC UA (drzewo CODESYS, wartości z symulatora, zapis sterowania) |

## Testy

```powershell
npm test                        # receptury (zgodność z PLC), symulator (też ręczny), przekrój, OPC UA z testowym PLC,
                                # poziomy dostępu / jog / parametry (access.test.js), logowanie, alarmy
node scripts/smoke-test.mjs     # strona w Chrome: offline (cykl, jog, parametr), online (testowy PLC, serwis),
                                # logowanie Operatora, wersja statyczna
```

Sprawdzone też z programem PLC boczkarki na lokalnym CODESYS Control Win V3 x64 SoftMotion (tryb symulacji PLC):
48/48 zmiennych, cykl uruchomiony przyciskami strony.
