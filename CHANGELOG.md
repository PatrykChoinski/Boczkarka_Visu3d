# Changelog

Zmiany w Promasz Visu3D (VizuApp) – wizualizacji cięcia piły mostowej Promasz
(zgłoszenie [#128](https://github.com/Induprogress/Promasz_PilaJednosuportowa/issues/128)
w repo głównym). Do 2026-10-21 aplikacja była w repo HMI (`HMI/VizuApp`); historia commitów została przeniesiona tutaj.

## 2026-10-23

### Alarmy – zakładka Zaawansowane
- Jak ekran HMI 81 „alarmy opis”: ID alarmów osi X / Y / Z / A / B i napędu głównego, błędy napędów, napięcia enkoderów, błędy grup interpolacji XYZAB / XYZ z tekstem SoftMotion CNC, CNC ERROR i FILE PROCESSOR ERROR. Subskrypcja tylko przy otwartej zakładce. Generator listy HMI zbiera też wyświetlacze tekstu (Character Display). Sprawdzone na PLC maszyny: 22/22 wartości.

### Mniej opisów na ekranach
- Bazowanie, okno Alarmy, okno Ruchy ręczne – bez opisów i linii informacyjnych (zostały komunikaty błędów). Pod przyciskami piły bez wyboru FWD / REV i częstotliwości: kierunek z Serwisu (`HMI.bServiceSawFWD`, w symulacji tak samo), częstotliwość – ekran Prędkość.

### Historia alarmów w SQLite
- Serwer zapisuje historię alarmów PLC (wystąpienie, ustąpienie, kwitowanie) w bazie SQLite `alarms.db` obok `config.json` (`src/server/alarmdb.js`, wbudowany `node:sqlite`), z subskrypcji `HMI2.aAlarms` w tle – także bez otwartej strony; historia zostaje po restarcie. Okno Alarmy w trybie PLC: historia z bazy z datą; przycisk Reset alarmów (zamiast Kwituj) zapisuje `HMI2.bAlarmReset` jak przycisk HMI i potwierdza wpisy w bazie (po zalogowaniu). Testy: `test/alarmdb.test.js`, integracja z testowym PLC w `test/plccontrol.test.js`.

### Bez okien potwierdzenia ruchu w trybie PLC
- Bazowanie i START operacji Manual działają od razu, jak przyciski HMI (usunięte okna „Maszyna wykona ruch. Kontynuować?”).

### OPC UA tylko przez subskrypcje
- Cała wymiana danych z PLC przez subskrypcje OPC UA zamiast cyklicznego odczytu (CODESYS na maszynie: jeden Read ~0,45 s – strona dostawała pozycje 1,6 razy na sekundę, ruchy ręczne nie były płynne; subskrypcja – zmiany co ~100 ms).
- Subskrypcja w tle przez cały czas połączenia tylko dla `BACKGROUND_KEYS` (60 zmiennych: pozycje, prędkości osi, narzędzie, tryb, stany, stół i kamień, alarmy, STOP / PAUZA, liczniki automatu). Zmienne ekranów (`SCREEN_KEYS`: Prędkość, Automat, G-kod, Ruchy ręczne, Parametry; Serwis – zmienne otwartej strony; Manual – pola operacji) subskrybowane tylko na czas otwarcia ekranu / okna: strona zgłasza listę przy otwarciu (`POST /api/plc/watch {cid, keys, paths}`), nowy ekran zamyka subskrypcję poprzedniego, zamknięcie strony (koniec strumienia SSE `?cid=`) albo brak odświeżenia przez 15 s – koniec subskrypcji.
- SSE: pełny stan na początku, potem tylko zmienione wartości (wcześniej ~20 kB co odczyt). Po połączeniu żadnego Read: węzły z drzewa (Browse) albo `nodePrefix`, typy z subskrypcji; zapis – typ z subskrypcji, bit (`b…`) BOOL, inny nieznany typ z jednorazowej krótkiej subskrypcji (test liczy wywołania Read – 0).
- Sprawdzone w przeglądarce (testowy PLC): Manual – 104 pola, okno Ruchy ręczne dokłada swoje zmienne, jog X+ trzymany i puszczony, zamknięcie okna i zmiana ekranu zamykają subskrypcje.
- Sprawdzone: `npm test` 189/189 (subskrypcja ekranu: otwarcie, zmiana, zamknięcie), na PLC maszyny: wartości ekranu 0,3–0,4 s po otwarciu, po zmianie ekranu i zamknięciu strony subskrypcja zamknięta.

### Sterowanie maszyną z Visu3D w trybie PLC (tablet)
- Zapis do PLC przez serwer VizuApp (`src/server/plcwrite.js`, `POST /api/plc/write`, `/hold`, `/watch`): tylko zmienne zapisywane przez ekrany HMI (`src/server/hmiwrites.json` z `scripts/gen-hmi-writes.py` – 956 zmiennych, poziom ekranu, rodzaj przycisku wg SubType DIAScreen), po zalogowaniu (Operator / Serwis); bez `users.json` – tylko komputer z VizuApp, z sieci STOP / PAUZA. Typ zapisu z bieżącej wartości w PLC (BOOL, INT w zakresie, REAL, STRING).
- Przyciski chwilowe (jog, skosy, ruch wzdłuż wychylonej tarczy, +/- prędkości): potwierdzane co 200 ms, serwer sam zapisuje FALSE po 0,7 s bez potwierdzenia.
- Ekrany Visu3D w trybie PLC: STOP / PAUZA w górnym pasku, bazowanie (`HMI2.bBase…`), Manual – pola = zmienne PLC (`src/shared/plcforms.js`, wszystkie operacje piły, frezu, wiercenia, polerowania i parametry wspólne), START z potwierdzeniem; okno Ruchy ręczne, Prędkość, Serwis, START / STOP piły. Formularze w trybie PLC nie nadpisują zapisanych formularzy symulacji.
- Przycisk logowania zawsze w górnym pasku; bez `users.json` – „Logowanie wyłączone” i podpowiedź, jak założyć użytkowników (`scripts/users.mjs`).
- Testowy PLC: zmienne HMI w pamięci, zapisywalne. Test OPC UA sprawdza ruch całej pozycji (X / Y / Z / A / B) – sama X w przebiegu testowym stoi do ~10 s (przyczyna dawnych sporadycznych błędów).
- Sprawdzone: `npm test` 188/188 (`test/plccontrol.test.js`, `test/plcforms.test.js`), przeglądarka bez okna na testowym PLC: logowanie Operator, zapis pola, START cięcia (wartości + `HMI2.bCutStart`), jog X+ trzymany i puszczony, tryb ciągły.

### Testy z prawdziwym CODESYS (OPC UA localhost) – poprawki
- Odczyt OPC UA w porcjach według `MaxNodesPerRead` serwera (CODESYS SoftMotion Win 3.5.18: 100). Wcześniej wszystkie 438 zmiennych jednym `Read` – z prawdziwym PLC `BadTooManyOperations` i brak jakichkolwiek wartości. Testowy PLC ma teraz limit 100 jak CODESYS.
- LINT / ULINT (Int64 – w node-opcua para [starsze, młodsze 32 bity]) zamieniane na liczbę – licznik pracy maszyny (`HMI.iOverallDays/Hours/Minutes`) zamiast „–”.
- Sprawdzone: `npm test` 180/180 (`test/opcvalues.test.js`), smoke test, `check-plc-live` na lokalnym CODESYS (438/438, geometria zgodna). Raport z testów: repo główne `_DOKUMENTACJA/Raport_testy_Visu3D_PLC_2026-10-23.md`.

### Alarmy z tablicy HMI2.aAlarms (#155)
- Alarmy online czytane z tablicy `HMI2.aAlarms` (ARRAY [0..199] OF BOOL – jest w konfiguracji symboli PLC) jak w HMI (`ReadAlarmVar = HMI2.aAlarms[0]`, adresy ciągłe): alarm n = `aAlarms[n-1]` – zamiast 78 osobnych bitów `HMI2.bAlarm…`, których nie ma w symbol configu. Bez zmian w PLC; działa też alarm 84 (polerowanie, bez własnego bitu). Usunięte zmienne opcjonalne (`alarm:…`), stan połączenia i `check-plc-symbols` jak przed #155. Lista „Wszystkie” pokazuje pozycję w tablicy i bit HMI.
- Sprawdzone: `npm test` 178/178, `check-plc-symbols` (oba pliki: `HMI2.aAlarms` ARRAY [0..199] OF BOOL, wszystkie zmienne OK); online z testowym PLC (tablica 200 bitów, zmienne 438/438, alarmy 8 i 24 pojawiają się i ustępują, historia).

## 2026-10-22

### Alarmy z HMI (#155), ukrywanie wyciętych elementów (#156)
- #155 Alarmy: wszystkie 81 alarmów z projektu HMI (sekcja `[Alarm]`: numer, bit `HMI2.bAlarm…`, teksty PL / EN, wyłączone 38 / 39, 84 bez bitu) w `src/shared/alarms.js` (eksport `HMI/scripts/dpa.py alarms`). Przycisk alarmów w górnym pasku (czerwony, migający, z liczbą aktywnych) i okno: aktywne, historia (wystąpił / ustąpił, potwierdzenie), lista wszystkich, „Kwituj”. Online – 78 bitów jako zmienne opcjonalne OPC UA (`alarm:…`, czytane co ok. 1 s; brak w symbol configu nie psuje połączenia, stan: „alarmy N/78”, `check-plc-symbols` tylko informuje). Offline – alarmy symulacji: 21 start bez bazowania, 58 krańcówka elektroniczna (#154), 45 skok o zero, 24 aktywny alarm; „Kwituj” kasuje. Testowy PLC zgłasza alarm 8 (ciśnienie powietrza) co 20 s.
- #156 Ukryj wycięte elementy (przełącznik na pasku widoku): kamień dzielony cięciami przez całą grubość na kawałki (siatka nad kamieniem, rzazy z obwiedni głębokości cięć), największy zostaje, pozostałe ukryte – kamień jako kształt z otworami (`src/shared/cutout.js`, `shapesGeometry`). Przeliczane po zmianie cięć (w trakcie programu najwyżej co 1 s).
- Sprawdzone: `npm test` 178/178 (`test/alarms.test.js`, `test/cutout.test.js`), smoke test, `check-plc-symbols` (oba pliki OK, 77 bitów alarmów brak w symbol configu); w przeglądarce online z testowym PLC (alarmy 78/78, alarm 8 pojawia się i ustępuje, historia) i offline (alarmy 21 / 58, Kwituj; prostokąt wycięty przez całą grubość – otwór w kamieniu).

### Zgłoszenia #150–#154
- #150 Przezroczysty kamień: przełącznik na pasku widoku (ikona kamienia) – krycie kamienia 0,22 zamiast 0,72, widać cięcia wewnątrz materiału; zapamiętywany w przeglądarce.
- #151 Cięcie pod kątem B (CutST ze skosem, skosy automatu): start nad materiałem na przedłużeniu skosu tarczy, wjazd w kamień i wyjazd z niego jednym ruchem XYZ pod kątem nachylenia (interpolacja), do wysokości nad materiałem – bez pionowego zjazdu na powierzchnię i pionowego wyjazdu.
- #152 Profile i wygładzanie (kroki 8–11 i 15–18, Manual „Profil krawędzi”): tarcza (dysk o grubości tarczy) obniża mapę wysokości kamienia (`HeightMap.bladeStamp / bladeCarve`), widoczną jak relief G-kodu – kształt profilu w XZ / YZ i ruch tarczy w poprzek po łuku przy wygładzaniu; offline i online (automat profili w toku).
- #153 Ściany maszyny 300 mm od stołu z każdej strony (`frame.margin` 150 → 300).
- #154 Krańcówki elektroniczne aktywne w symulacji: X / Y domyślnie obrys stołu (punkty `aCuttingBoard`), Z 0…5000, wartości zapisane w Serwis → Obszar pracy mają pierwszeństwo (strona pokazuje domyślne). Ruch ręczny staje na krańcówce (oś poza zakresem może wyjechać tylko do środka), program symulacji staje przed krańcówką z komunikatem „stop: krańcówka elektroniczna X max (3500 mm)”; bazowanie bez kontroli.
- Sprawdzone: `npm test` 171/171 (`test/surface.test.js`, #151 w `test/ops.test.js`, #154 w `test/jog.test.js`), smoke test; w przeglądarce: przezroczysty kamień z rzazami krawędzi, profile (książki, ćwierćwałek, profil krawędzi z wygładzaniem), ściany 300 mm od stołu, krańcówki (Serwis, stop programu na X 3500).

### Daszki: ściany z przezroczystym tłem
- Obrazki ścian daszków (`img/figures/roof_wall{1..4}_{0,1}.png`, rysunek figury Daszki jak ekran HMI 137) z przezroczystym tłem zamiast białego – ściany nie zasłaniają już narożników sąsiednich ścian. Te same pliki w repo HMI (`Pictures/`, skrypt `scripts/roof_walls_transparent.py`).
- Sprawdzone: `npm test` 166/166; rysunek Daszków w przeglądarce przed / po.

### Automat: rodzaj cięcia wewn. / zewn. w figurach (piła i frez)
- Pole „Rodzaj cięcia” (Zewnętrzne / Wewnętrzne) w formularzu figury jak lista `ComboBox_077 → HMI.iManualInternal` na ekranach figur HMI (Prostokąt, trójkąty, Prostokąt zaokrąglony, Narożniki, Daszki, Elipsa, Trapez 142 / 153, L Narożniki, Krzyż, Serce, Wielokąt – sprawdzone `dpa.py find iManualInternal`). Dotąd wybór był tylko w „Parametrach figury” (Admin). Wartość trafia do bloku figury jako `iInner`: piła – kroki cięcia wewnętrznego (5 / 23 zamiast 1 / 22), frez – korekta o promień frezu do środka; pole Admina „Rodzaj” zsynchronizowane.
- Sprawdzone: `npm test` 166/166 (`test/figinternal.test.js`), smoke test; w przeglądarce prostokąt piły zewn. / wewn. (bufor i plan), prostokąt zaokrąglony frezu.

### Plan cięcia: zewnętrzne poza materiał, wewnętrzne bez przecięć
- Plan linii cięcia piłą (Manual: cięcie proste, pasy, bloki, krawędzie; kroki cięcia automatu offline i online) rysowany jako rzeczywisty zasięg rzazu na powierzchni (`cutSurfaceSpan` w `cutst.js` – przejścia z `cutPlan` + połowa cięciwy tarczy na głębokości przejścia, przy skosie w płaszczyźnie tarczy). Zewnętrzne – linia wychodzi za punkty (tarcza poza materiałem, krawędzie prostokąta krzyżują się za narożami), wewnętrzne – kończy się na punktach, linie się nie przecinają; wewn. początek / koniec – za punkt wychodzi tylko drugi koniec. Znaczniki XY i odległości zostają na zadanych punktach (`ends`).
- Sprawdzone: `npm test` 164/164 (`test/plancut.test.js`: ciecie proste zewn. / wewn. / wewn. początek, krawędzie – wewn. bez przecięć, zewn. przecięte za narożami, automat), smoke test; zrzuty planu z góry (krawędzie zewn. / wewn., cięcie proste).

### Film prezentacyjny – druga wersja (#149)
- Tor, punkty X / Y i wymiary pokazywane przed każdym programem i chowane po ok. 2,5 s; najazdy kamery blisko głowicy (płynne podążanie za tarczą / frezem) i powrót do widoku głównego – pasy, Automat piły, prostokąt frezu, G-kod.
- Frez: prostokąt z zaokrąglonymi narożami zamiast ociekacza; G-kod Madonny pokazywany ok. 15 s dłużej; Blat z A = 1500 (C = 500, E = 700 – figura się domyka, tor na kamieniu).
- Film: `E:\VizuApp_film\VizuApp_prezentacja_2026-10-22_v2.mp4` (2:13, Full HD, 30 kl./s); poprzednia wersja zostaje obok.

### Film prezentacyjny (#149)
- `scripts/record-demo.mjs`: film ok. 2 min, Full HD, 30 kl./s z wersji statycznej (logowanie demo Serwis), Chrome bez okna z kartą graficzną, klatki z CDP (`Page.startScreencast`), MP4 przez ffmpeg (libx264). Podpisy części i kursor na filmie; tempo symulacji dobierane do czasu programu. Proporcje: ustawienia / bazowanie / ruchy ręczne 18 s (15 %), piła – Manual (cięcie proste, pasy, łuk, elipsa) i Automat (demo, figura Blat) 61 s (51 %), frez – Automat (Ociekacz) i G-kod z Madonną 31 s (26 %, reszta frezowania wycięta, film wraca na gotowej płaskorzeźbie w podglądzie z góry), polerowanie 9 s.
- Film zapisany lokalnie: `E:\VizuApp_film\VizuApp_prezentacja_2026-10-22.mp4` (2:05, 9 MB) – nie w repo.

### Full HD na maszynie, tablet z adresem PLC (#148)
- Okno „Połączenie z PLC” (przycisk z błyskawicą w górnym pasku, Serwis / Admin): adres serwera OPC UA do wpisania (np. `opc.tcp://192.168.1.10:4840`), „Połącz” – serwer łączy się od razu z nowym adresem bez restartu (`OpcUaSource.reconnect`), adres zapamiętany w `connection.json` obok `config.json` (lokalny, `.gitignore`); „Domyślny” – adres z `config.json` / `--endpoint`. Stan połączenia i adresy strony w sieci w oknie. `GET/POST /api/connection` – zmiana tylko Serwis / Admin, bez `users.json` tylko z komputera z serwerem; zły adres odrzucany.
- Serwer: `httpHost` w `config.json` / `--host` – domyślnie `127.0.0.1` (maszyna, jak dotąd), `0.0.0.0` – strona dostępna dla tabletu w sieci (`http://<IP>:8128/`, adresy w konsoli i oknie).
- Tablet pionowo (768×1024, 800×1280): widok 3D i panel dzielą wysokość ekranu – cała strona na ekranie, stopka widoczna (wcześniej strona wychodziła poza ekran, stopka zasłaniała panel).
- Sprawdzone: `npm test` 161/161 (`test/connection.test.js`, zmiana adresu w trakcie pracy z testowym serwerem OPC UA w `test/opcua.test.js`), smoke test; w przeglądarce: serwer ze złym adresem → wpisany adres testowego PLC → połączono 437/437 zmiennych bez restartu, „Domyślny” (usuwa `connection.json`), zły adres odrzucony; układ 1920×1080, 1280×800, 1024×768 (z oknem ruchów ręcznych), 768×1024, 800×1280 – bez przewijania strony.

### Opisy zmiennych PLC tylko dla Admina
- Nazwy zmiennych PLC w interfejsie (np. „(fManualXZeroPosition)”, „– bManualTwoPoint”, `aCuttingBoardX/Y/Z`, nazwy pod polami Serwisu) i podpowiedzi z nazwami zmiennych / działaniem w PLC widoczne tylko po zalogowaniu jako Admin; dla innych użytkowników ukryte (podpowiedzi bez nazw). Działa w całej aplikacji, także dla elementów dodawanych później (MutationObserver). Strona Serwis → „Zmienne PLC” tylko dla Admina. Bez logowania (brak `users.json`) – pełny dostęp jak dotąd.
- Etykiety „CutTiltDiameter”, „HeadRotationDiameter”, „MillTiltDiameter” w Parametrach po polsku (średnica wychyłu / obrotu głowicy / wychyłu frezu), nazwa zmiennej w nawiasie (Admin).
- Ukrywane też nazwy programów PLC (`BaseHomingST`, `ProgramAutoCutST` – także w pozycjach list) i całe zdania, w których nazwa zmiennej stoi poza nawiasem; podpowiedzi Bazowania, Parametrów (prędkości z PLC) i Serwisu przepisane tak, by nazwy były w nawiasach.
- Sprawdzone: `npm test` 157/157 (`test/plcnames.test.js`), smoke test; w przeglądarce (wersja Pages, logowanie demo) automatyczny skan wszystkich widocznych tekstów, podpowiedzi, pozycji list i wartości pól – wszystkie zakładki, każda pozycja każdej listy (operacje Manual, typy Automatu, strony serwisu) i wszystkie strony Serwisu, w trybach piła / frez / wiercenie / polerowanie: Serwis 0 nazw, Operator 0, wylogowany 0; Admin – nazwy widoczne (127 na 5 zakładkach).

### Brakujące ekrany serwisowe, bez dublującego się Ustawienia → Serwis
- Serwis: wszystkie ekrany otwierane z ekranu serwisowego HMI – ustawienia frez (`serwis_cd`, 90), polerowanie (91), parametry osi servo (79), receptury (126, 76, 127), falowniki (72, 77), prędkości serwisowe (78), wejścia / wyjścia (73, 69), skalowanie osi (74), pomiar narzędzia (66), obszar stołu frez / wiercenie / polerowanie (46). Razem 17 stron, wszystkie 462 elementy HMI, 370 zmiennych PLC – wszystkie 391 zmiennych i bitów z ekranów HMI (w symbol configu, czytane online; 437 zmiennych Visu3D). Nowe elementy: listy (przypisania wejść / wyjść X / Y, wybór osi), teksty (receptury), lampki, tablice (punkty stołu frezu – zapis punktu narzędzia jak w PLC), przyciski ustawiające wartość, warunki widoczności jak w HMI; elementy samego HMI (menu systemowe, język, bity `$…`) nieaktywne z opisem. Pozostałe ekrany w liście „Inne ekrany serwisowe”, przejścia jak w HMI.
- Usunięta podstrona Ustawienia → Serwis (dublowała się z Serwis → Ustawienia): bity `bService…` tylko na ekranie Serwis (bity frezu `bServiceMillZFirst`, `bServiceMillCircleReverse`, `bServiceMillProgramNewStartPoints` na stronie Ustawienia frez (CD) jak w HMI); tabela „Zmienne PLC” przeniesiona do Serwisu (strona w trybie PLC). Ustawienia – tylko stół i kamień.
- Sprawdzone: `npm test` 155/155, smoke test 437/437 zmiennych z typem i wartością, oba pliki symboli PLC 437/437; w przeglądarce wszystkie strony offline (zapis punktu stołu frezu, bity wspólne z programami) i online (odczyt z PLC, tylko do odczytu).

### Ekran Prędkość (#146), ekran Serwis (#147), głębokość ze znakiem
- #146 Prędkość jak ekran HMI `predkosc`: pozycje jak na panelu (`fX/Y/ZActualPosition`, kąt obrotu, wychył) i głębokość; grupy przesuw szybki, przesuw roboczy (piła / frez wg trybu), oś Z dojazd i praca, silnik główny (Hz i rpm = Hz × 30) – pasek % maksimum (`HMI2.fMaxVelocity…`), pole i −/+ (1 % maksimum, silnik 0,1 Hz, przytrzymanie powtarza, granice 0…maksimum jak `LIMIT` w PLC). Offline zmienia dynamikę symulacji (maksima w `offline.speedMax`), online odczyt z PLC; informacja o pulpicie rozszerzonym (`bServiceAdvancedDesktop`).
- #147 Serwis: trzy strony jak ekrany HMI `serwis` (70), `serwis_2` (71 – obszar pracy maszyny), `serwis_3` (75 – ustawienia serwisowe); 118 elementów, 100 zmiennych PLC (42 bity ustawień serwisowych z napisami stanów jak w HMI). Dane wygenerowane z projektu HMI i GVL (`src/shared/servicescreens.js`: grupy, opisy, jednostki, zakresy, wartości początkowe, działanie w PLC). Online wszystkie zmienne z PLC (84 nowe w `VARIABLES` jako `hmi:GVL.zmienna`, czytane rzadziej), offline wspólne z symulacją tam, gdzie Visu3D ma odpowiednik (parametry głowicy / narzędzi, bity `bService…`, jog A, pozycje), zapis krańcówek X / Y / Z z aktualnej pozycji, JOG obrotu i wychyłu. Opisy HMI poprawione tam, gdzie były błędne (maks. prędkości w m/min, średnica wychyłu frezu, pozycja obrotu w °).
- Głębokość nad materiałem ujemna (stopka, Prędkość) – jak `HMI2.fStatusActualCutDepth = fZActualPosition − fCutMaterialHeight`; online wartość z PLC.
- Lewe menu: Automat, G-kod, Manual, Bazowanie, Serwis, Parametry, Prędkość, Ustawienia, Pozycja.
- Sprawdzone: `npm test` 155/155 (`test/servicescreens.test.js`), smoke test 189/189 zmiennych z testowym PLC, oba pliki symboli PLC 189/189; w przeglądarce Prędkość i Serwis offline (zmiany w symulacji, bit wspólny z Ustawieniami) i online (odczyt z PLC).

### Logowanie na GitHub Pages (demo)
- Wersja statyczna (GitHub Pages) ma logowanie demonstracyjne: wybór Operator / Serwis / Admin bez hasła, te same poziomy co na maszynie (niezalogowany – tylko Bazowanie, Operator – praca, Serwis – Parametry i bity serwisowe, Admin – parametry figur), sesja do zamknięcia karty. Hasła sprawdza tylko serwer VizuApp na maszynie – skróty haseł w publicznej stronie dałyby się złamać (np. 11111111). Smoke test wersji statycznej: bez logowania brak ekranu Manual, po zalogowaniu demo (Operator) cięcie działa.
- Poprawione opisy po zmianie nazw (Manual, Ustawienia → Serwis).

### Zmienne PLC (OPC UA): pozycje osi, punkt narzędzia, przyspieszenia, sprawdzenie na sterowniku
- Pozycje X / Y / Z z `HMI2.fX/Y/ZRealPosition` (rzeczywiste osie) zamiast `fX/Y/ZActualPosition` – to w PLC punkt narzędzia (oś − przesunięcie głowicy wg A / B, w Z + średnica tarczy / 2), a wizualizacja liczy z osi; na maszynie głowica byłaby przesunięta (Y ok. 50 mm, Z ok. 312 mm przy tarczy Ø625). Testowe PLC podawało osie pod starą nazwą, więc tego nie wykrywało.
- Punkt narzędzia `HMI2.fX/Y/ZActualPosition` podpięty osobno – okno Ruchy ręczne pokazuje te same pozycje co ekrany HMI; offline ten sam wzór (`plcActualPosition` z `Settings/ActualPosition` dla piły, frezu, wiertła, polerki).
- Zapis jak w PLC: „Zapisz” (punkty operacji, punkt startowy automatu), punkty stołu i kamienia (z Z), punkty ręczne A / B / C i Z polerowania wpisują punkt narzędzia (`fX/Y/ZActualPosition`) zamiast pozycji osi; przejazd na punkt A / B / C liczy oś z punktu (`axisFromActual`). G54 – jak w PLC – osie.
- Aktualne prędkości osi z PLC: `HMI2.f[XYZ]ActualVelocity` (m/min), `fAActualVelocity` (°/s × 0,06); `fBActualVelocity` niepodpięta (w PLC `VelocityAcceleration` liczy ją z `MCActualVelocityA` – błąd w PLC), prędkość B z różnicy pozycji.
- „Pobierz z PLC”: przyspieszenia X / Z / A / B wzorami PLC (`fMaxVelocityJog* / fAutoTacc* / Tacc*`) zamiast `HMI.DecX/DecZ/DecA/DecB` (opóźnienia) – `AccX/Z/A/B` są w GVL bez symbol configu.
- Diagnostyka: status połączenia „zmienne N/M” z brakującymi nazwami, `GET /api/variables` (węzeł, typ, wartość), tabela „Zmienne PLC” w Ustawienia → Serwis (tryb PLC), smoke test wymaga wszystkich zmiennych z typem i wartością; `scripts/check-plc-symbols.mjs` (plik symboli z kompilacji) i `scripts/check-plc-live.mjs opc.tcp://<IP>:4840` (sterownik, tylko odczyt, porównanie geometrii z PLC).
- Sprawdzone: oba pliki symboli (AI i produkcyjny) – 94/94 zmiennych, typy zgodne; enumy `CutStepType`, `ProgramCutStep`, `ProgramMillStep`, `OutInType` jak w PLC; jednostki prędkości (mm/s) jak w PLC; `npm test` 154/154 (`test/plcvars.test.js`), smoke test 94/94. Nie sprawdzone na prawdziwym sterowniku – z tego komputera żaden nie jest osiągalny (adresy maszyn z repo nie odpowiadają na 4840).

## 2026-10-21

### Podpięcie zmiennych PLC przez OPC UA – sprawdzone (#128)
- `scripts/check-plc-symbols.mjs` uruchomiony na świeżym pliku symboli projektu AI (Generuj kod po #130): 87/87 zmiennych z `VARIABLES` w symbol configu, typy zgodne. Wszystkie zmienne są zadeklarowane w GVL. Pozycje, prędkości, tryby i wyjścia zapisuje PLC, a parametry i bity `bService…` są wpisywane z HMI. Opis i wynik w README (Rozwój i testy → Podpięcie zmiennych PLC).

### Wychył w cięciu, okno ruchów ręcznych, blokada bez bazowania, logowanie (#142, #143, #144, #145)
- #142 Wychył: pola „Cięcie pod kątem – wychył B” (`bManualBAngle`) i kąt (`fManualBSetPosition`, −2,5…90°) na ekranie cięcia prostego jak `manual_ciecie` w HMI (wcześniej schowane we wspólnych polach „Głębokość, wychył, wyjazd”). Skos tylko dla 0 < B < 90 (`GetPositions`) – inaczej komunikat i cięcie pionowe. Pasy, bloki, krawędzie, łuk, okrąg i elipsa tną bez skosu jak w PLC (`CutStripesST`, `CutArcST`, `CutCircleST` zerują `bManualBAngle`; wcześniej wychył ze wspólnych pól działał też w pasach i blokach).
- #143 Ruchy ręczne: zamiast zakładki – okno otwierane przyciskiem „Ruchy ręczne” w górnym menu, przesuwane za nagłówek (myszą i dotykiem, w granicach ekranu, pozycja zapamiętana w przeglądarce), zamykane ×. Przycisk aktywny tylko offline po bazowaniu (i od poziomu Operator).
- Bity serwisowe `HMI.bService…` na ekranie Ustawienia → Serwis (od poziomu Serwis, `src/shared/service.js`): 12 bitów piły, automatu, frezu i ruchów ręcznych w jednym miejscu; formularze programów, automatu, figur i okno ruchów ręcznych nie pokazują już tych pól i biorą wartość z ustawień (np. `bServiceRectangleACBD` wspólny dla krawędzi i figur). Ustawienia mają podekrany „Stół i kamień” i „Serwis”.
- „Operacja” → „Manual”; lewe menu w kolejności lewego menu HMI: Automat, G-kod, Manual, Bazowanie, Parametry (serwis), Ustawienia, Pozycja. Bazowanie – nowy piktogram (strzałki do punktu bazowego) zamiast domku.
- Nowoczesny wygląd: ciemny górny pasek i lewe menu, panel z tytułem ekranu, karty i zaokrąglone pola, paski narzędzi nad widokiem 3D (kamera – pionowo po prawej, warstwy i czyszczenie – na dole po lewej), nowe okna (ruchy ręczne, logowanie).
- Ikony zamiast napisów (łatwiejsze tłumaczenie na inne języki): własne piktogramy SVG (`src/client/icons.js`, bez zewnętrznych bibliotek i czcionek), opis w podpowiedzi. Ikony: tryb PLC / SIM, ruchy ręczne, tempo, użytkownik, ekrany w lewym menu, widok i warstwy, start / pauza / stop, zapisz pozycję, tryby bazowania (piła, frez, wiertło, polerka), okno ruchów ręcznych (strzałki, punkty, nad materiał, tryb ciągły / skok, obrót / wychył, ruchy względem lasera, ruch wzdłuż wychylonej tarczy). Legenda w README (Ekran). Teksty zostały w etykietach pól ze zmiennymi PLC, podpowiedziach i komunikatach.
- Przyciski ekranów w kolumnie po lewej stronie (jak `Menu_Lewo` w HMI), panel ekranu po prawej; na wąskim ekranie – rząd nad panelem.
- Okno Ruchy ręczne jak ekrany HMI `MPG` (STEROWANIE RĘCZNE) i `MANUAL INTERPOLATION` (RUCHY INTERPOLOWANE): układ, napisy i kolory z projektu DIAScreen (`src/client/manualpanel.js`), skalowane do szerokości okna. Nowe jak w PLC: skosy XY ↖ ↗ ↙ ↘ (45 / 135 / 225 / 315°), TRYB CIĄGŁY / SKOK z SKOK [mm], punkty ręczne A / B / C (zapis w zakładce Pozycja) i NAD MATERIAŁ, STOP, ruch wzdłuż wychylonej tarczy (`bManualMoveWithTiltUp` / `Down`, 50 mm), ruchy względem lasera jako przełączniki do STOP, LASER, presety obrotu −180…+180° i wychyłu 0…90°, ustaw głowicę na zadany kąt; START / STOP PIŁY. Jog A / B ± i jazda „o” kąt usunięte (nie ma ich na ekranach HMI).
- #144 Bez bazowania: żadnych ruchów poza bazowaniem (program, jog, jazda na pozycję / kąt) i zablokowane ustawienia – stół i kamień, Pozycja, Parametry (szare, bez edycji) z komunikatem na górze panelu.
- #145 Logowanie: Operator / Serwis / Admin. Hasła sprawdza serwer (`src/server/auth.js`: `POST /api/login`, `/api/logout`, `GET /api/session`, token sesji, 0,5 s opóźnienia po złym haśle, wylogowanie po bezczynności `auth.timeoutMin`, domyślnie 30 min). Hasła tylko jako skróty scrypt w lokalnym `users.json` (nie w repo – `.gitignore`; `scripts/users.mjs set <użytkownik>`, `build.ps1` dołącza plik do paczki). Niezalogowany – podgląd (bez zakładki „Stół i kamień”, tylko Bazowanie do odczytu i online automat z PLC); Operator – praca; Serwis – + Parametry i opcje serwisowe; Admin – + parametry figur. Bez `users.json` i na GitHub Pages logowanie wyłączone.
- Sprawdzone: `npm test` 150/150 (ruchy okna: skosy, wychył), smoke test; w przeglądarce nowy wygląd (ekrany, okno ruchów ręcznych, bazowanie, logowanie, telefon), bity serwisowe (pole znika z formularza, zmiana bitu zmienia program); `npm test` 151/151 z `test/service.test.js` (nowe: `test/auth.test.js` – skróty, sesja, wylogowanie, serwer `/api/login`, config strony bez skrótów; wychył tylko w cięciu prostym), `npm run test:smoke` (serwery bez `users.json`). W przeglądarce: okno ruchów ręcznych (przesuwanie, zapamiętana pozycja), blokada po przerwanym bazowaniu, logowanie złym i dobrym hasłem, poziomy Operator / Serwis / Admin, sesja po przeładowaniu strony, wychył 30° w cięciu prostym.

### Frez, polerowanie, wiercenie (#131, #132, #133), laser na osłonie (#141)
- Tryby: w pile ukryte pola frezu, w trybach frezu / wiercenia / polerowania pola piły (`data-modes` w HTML, `modes` w polach „Parametry figury”). Parametry pokazują tylko narzędzie trybu (tarcza i `HeadRotationDiameter` w pile; frez, wiertło albo polerka w trybach narzędzi), w dynamice „Cięcie XY” / „Praca XY”.
- Frez (#131, `src/shared/millops.js`) jak w PLC: `MillST` (dwa punkty albo kąt i długość, zjazd w Z w trakcie ruchu na `fCutOvertakingPrecent` długości i przejście czyszczące, albo `bServiceMillZFirst`), `MillArcST` (promień, trzy punkty, cięciwa, `bManualArcIncludeToolDiameter`, zejście helikalne), `MillCircleST` (zewnętrzny / wewnętrzny / po linii, od środka albo od góry, CW / CCW), `MillElipseST`, `MillStripesST` (też frezowanie stołu i zamiana kierunku linii), `MillBlocksST`, `EdgesST` w trybie frezu. Wspólne pola frezu: tablica głębokości (`Depths`: równe, stały skok z minimalnym ostatnim, jedno przejście, zapas) i wyjazd nad materiał.
- Automat frezu: Start symuluje `ProgramAutoMillST` (wcześniej tylko podgląd toru) – linie, łuki, przejazdy, skosy B (`MillSlopeDown` / `Up`, `GoToPositionWithoutZ`), wiercenie, `ChangeDepth`, okręgi, elipsy, `MillWithoutZ`, potwierdzenie; opcja `bProgramReapitingOver` – zamknięte kształty w całości na każdej głębokości (`MillShapeST`).
- Wiercenie (#133): prędkość Z wiercenia `fVelocityAxisZDrill`, nowa operacja „Wiercenie w miejscu” (`DrillSimpleST`: od aktualnego Z o `fDrillDepth`, potem w górę o `fParameterZMoveAboveMaterial`).
- Polerowanie (#132): prędkość `fVelocityMillMode`, Z z wysokości materiału albo z `fHeightPosition` (przycisk „Zapisz Z” jak `bSaveZ`), powtórzenia narzędzi `aToolRepetitions` albo kolejka `aQueueTools` (XY / YX / CCW / CW na narzędzie), wymiana narzędzia między narzędziami (wyjazd w górę i postój – pozycje magazynu nieznane).
- Laser (#141): moduł na górnej krawędzi osłony przy narożniku (kąt montażu 40° zamiast 60°, jak na zdjęciu w zgłoszeniu).
- Sprawdzone: `npm test` 145 / 145 (nowy `test/millops.test.js`: tablica głębokości, kolejność i Z przejść MillST, ZFirst, ślady okręgu / elipsy / łuku / linii pod kątem, linie pasów / bloków / krawędzi, automat frezu z wierceniem i ChangeDepth, zamknięte kształty; wiercenie – prędkość Z i DrillSimpleST; polerowanie – kolejka, powtórzenia, wymiana, Z z fHeightPosition), `npm run test:smoke`. W przeglądarce: frez – pasy (4 rowki 40 mm), automat „Serce” 6 min 54 s; polerowanie z dwoma narzędziami; wiercenie w punkcie i w miejscu; piła bez zmian.

### G-kod / CNC 3D w trybie frezu (#124)
- Nowa zakładka „G-kod” (tylko tryb frezu po bazowaniu, jak moduł CNC w PLC): wczytanie pliku `.nc`, punkt początkowy G54 (pola, „= aktualna”, „bez promienia” jak `bSetG54_*` w CNCInfo; online `HMI.G54_X / Y / Z` z PLC), podsumowanie programu (ruchy, długości posuwu i szybkich, szacowany czas, zakres X / Y / Z, uwagi parsera, ostrzeżenie o głębokości większej niż grubość kamienia).
- Parser `gcode.js` (G0 / G1 / G2 / G3, I / J i R, G90 / G91, G20 / G21, G53 jak w PLC, F, M03 / M05 / M30), program ruchu `cnc.js` (X = G54_X + X, Y = G54_Y − Y, Z = G54_Z + Z, limity 200 mm/s XY i 20 mm/s Z, ciągła ścieżka), mapa wysokości `heightmap.js` – z poprzedniego commita „GCode”, teraz podłączone.
- Materiał jako mapa wysokości w widoku 3D (`view3d.setHeightMap`, kolor wg głębokości, siatka do ok. 400 tys. punktów), tor programu (`setCncPath`: G1 pomarańczowy, G0 niebieski przerywany). Start – animacja, „Wynik od razu” – cały program bez animacji, „Wyczyść materiał”. Próbki programu CNC idą na mapę wysokości zamiast osobnych śladów narzędzia (54 tys. linii nie robi tysięcy rowków).
- Animacja G-kodu: podsumowanie materiału odświeżane co 1 s, tempo 500× i 1000×. Cały plik Madonny przeanimowany w przeglądarce na 1000× – wynik zgodny z „Wynik od razu” (146 127 / 146 131 komórek, 99,8 % siatki identyczne; różnice na ostrych narożnikach przy dużym tempie). Ostrzeżenie, gdy wychył B ≠ 90° (CNC jak w PLC nie rusza A / B, frez musi być pionowo).
- Podgląd 2D w panelu zakładki G-kod: mapa wysokości z cieniowaniem jak płaskorzeźba (światło z lewej góry, kolor wg głębokości, +Y do góry jak widok „Góra”), czerwona kropka i okrąg średnicy frezu w miejscu narzędzia; po „Wynik od razu” i w trakcie animacji (co 0,3 s). W 3D bryła kamienia nad obrobionym reliefem prawie przezroczysta (krycie 0,18 zamiast 0,72) – wcześniej jej górna ściana rozmywała wynik i relief był słabo widoczny (światło w scenie pada prawie z góry).
- Parser: kody z listy PLC (`GCodes`) – G4 postój (P w ms albo X w s, w programie ruchu i czasie), G70 / G71 jak G20 / G21; G28, G55–G59 i cykle G81–G84 – linia bez ruchu z uwagą (wcześniej cykl z X / Y / Z robił zwykły ruch).
- Wydajność: mapa wysokości zapamiętuje zakres zmienionych komórek, widok przelicza tylko ten fragment (pozycje, kolory, normalne z różnic wysokości) – 0,17 ms zamiast ok. 35 ms na zmianę przy 201 tys. punktów siatki.
- Przycisk „Przykład” w zakładce G-kod – `examples/madonna_frez_fi25mm_fixed.nc` (kopia pliku z `Dodatkowe Programy`, kopiowana do `public/examples`, więc jest też w paczce na maszynę).
- Testowy PLC: `--mode cnc` (frez po bazowaniu wykonuje program G-kodu `CNC_GCODE` od G54, wystawia `HMI.G54_X / Y / Z`); sprawdzone online – G54 z PLC, ruchy z PLC wycinają mapę wysokości (214 cm², 6 mm jak w programie). `.claude/launch.json` w repo głównym: `visu3d-fake-plc-cnc`.
- Poprawka: po przeładowaniu strony zbazowany tryb (frez / wiertło / polerka) startował z B 0° zamiast B po bazowaniu – frez leżał poziomo i program CNC nic nie ciął.
- Sprawdzone: `npm test` (nowy `test/cnc.test.js`: parser na fragmencie przykładowego pliku, łuki I / J i R, G91 / G20, G54 → osie, mapa wysokości – szerokość rowka i spód, program ruchu – koniec, głębokość i prędkość Z, animacja = tor, przykładowy plik bez uwag z zakresem X −25…307,3, Y −412…25, Z do 57,4). W przeglądarce: tryb frezu, plik Madonny (wczytanie 0,2 s, „Wynik od razu” 1,7 s, siatka 399 × 504 co 1 mm, 1461 cm²), relief z mapy wysokości zgodny z plikiem.

### Węże z wodą, osłona tarczy, odbojnik, moduł lasera i panel operatorski (#141)
- Osłona tarczy (osłonka na wodę) wg zdjęcia w zgłoszeniu, zamiast półokrągłej żółtej: kanciasta, jasna aluminiowa płyta (`GUARD_OUTLINE`, `GUARD_HUB_HOLE` w `water.js`).
  - Wymiary zmierzone na zdjęciu w promieniach tarczy: środek piasty i promień tarczy w pikselach, skrót perspektywy z okrągłego wybrania.
  - Kształt ze zdjęcia (pionowa krawędź, skos, płaska góra, druga krawędź, dół na dwóch wysokościach, okrągłe wybranie wokół piasty) powiększony tak, żeby osłona była większa od tarczy: tarcza wychodzi tylko pod dolną krawędzią, a każda krawędź powyżej jest co najmniej 1,02 promienia od środka.
  - Wymiary w promieniach tarczy: pionowa krawędź 1,08, skos do (0,5; 1,1), góra 1,1, druga krawędź 1,05, dół −0,62 / −0,45.
- Odbojnik wody jak płyta na zdjęciu, tylko zielony (`guardFlap`, `FLAP`): gumowa płyta w poprzek rzazu (szersza niż osłona) pod przednim dolnym narożnikiem osłony od strony skosu. Wisi od dolnej krawędzi osłony do powierzchni materiału, najwyżej 0,8 promienia.
- Krople i mgła wody rysowane jako okrągłe, miękkie punkty.
  - Na zdjęciu widać zewnętrzną ścianę (nakrętkę), więc skos osłony jest od strony −u.
- Woda wg zdjęcia, wszystko po zewnętrznej stronie osłony:
  - stalowy oplatany przewód z głowicy do srebrnego rozdzielacza przy dolnym rogu osłony;
  - z rozdzielacza dwa niebieskie węże segmentowe (Loc-Line, segmenty jako kulki) z pętlą do dwóch pomarańczowych dysz tuż obok piasty, na jej wysokości;
  - trzeci wąż do dyszy przy dolnej części tarczy (na zdjęciu są trzy końcówki);
  - przy frezie, wierceniu i polerowaniu dysze są po obu stronach narzędzia.
  - Porównanie obok siebie ze zdjęciem (zrzut z Visu3D pod tym samym kątem): układ osłony, węży i dysz się zgadza.
- Przy włączonych obrotach dużo wody, jak na filmie z cięcia (`waterSpray`: 380 kropli na dyszę, mgła, mokra plama na kamieniu):
  1. woda trafia w początek tarczy, czyli w stronę, która przy danym kierunku obrotu schodzi w materiał, tuż nad powierzchnią;
  2. 35% rozlewa się po tarczy i ją zasłania;
  3. reszta przechodzi z obrotem przez rzaz, przy wyjściu odrywa się w kierunku obrotu i nisko wzdłuż cięcia spada na materiał za tarczą.
  - Frez, wiercenie, polerowanie: woda na czoło, rozlewa się promieniście.
  - `saw.fwdSign` domyślnie −1 (także w `config.json`), żeby przy FWD w materiał schodziła strona tarczy, w którą celują dysze (jak na zdjęciu). Dotyczy też kierunku obrotu szprych tarczy i narzędzi; na maszynie do sprawdzenia.
  - Offline: woda leci, gdy pracuje piła / wrzeciono.
  - Online: woda zależy od zaworów `IOVars.yWaterCut` (piła) i `IOVars.yWaterMill` (frez, wiercenie). Gdy PLC nie podaje tych zmiennych, woda leci przy obrotach.
  - Pasek stanu: „woda” / „woda (frez)”.
- Moduł lasera (obudowa i okienko, które świeci na czerwono przy włączonym laserze) jest zamontowany na krawędzi osłony tarczy od strony lasera, `laser.mountAngle` stopni od góry (domyślnie 50°). Przy włączonym laserze półprzezroczysty wachlarz wiązki prowadzi od modułu do linii lasera na materiale.
- Suport: panel operatorski przed przednim końcem prawego murka (słupek, konsola pochylona o 30° do operatora, ekran HMI, grzybek STOP na żółtej podstawie, przyciski zielony / biały / niebieski); wyłączany w configu (`frame.panel`). Zielona mata na stole, dodana wcześniej w tym zgłoszeniu, została usunięta.
- Geometria w `src/shared/water.js` (`waterLayout`, `waterDrops`, `laserMount`, `headDims`), rysowanie w `machine3d.js` (węże, dysze, moduł) i `view3d.js` (`setWater`, wachlarz w `setLaser`). Testowy PLC podaje `waterMill` w trybach narzędzi.
- Sprawdzone:
  - `npm test` 123/123 (nowy `test/water.test.js`: trzy dysze wg zdjęcia, rozdzielacz, osłona większa od tarczy, odbojnik do powierzchni materiału, trafienie w początek tarczy tuż nad materiałem, rozbryzg za tarczą w kierunku obrotu i tylko w rzazie pod powierzchnią, woda na czoło narzędzia, moduł lasera na krawędzi osłony);
  - porównanie obok siebie ze zdjęciem z #141 i klatką z filmu (118 s);
  - `scripts/smoke-test.mjs` OK;
  - w przeglądarce piła i frez z włączonymi obrotami i laserem.

### CI: testy na Windows przy każdym pushu / PR, publikacja Pages po testach
- `.github/workflows/ci.yml` (zastępuje `pages.yml`):
  - przy każdym pushu (każda gałąź) i pull requeście job `test-windows` na `windows-latest`: `npm ci`, `npm test`, `scripts/smoke-test.mjs`, zrzuty ekranu jako artefakt;
  - job `deploy-pages` (GitHub Pages) tylko po udanych testach i tylko przy pushu do `master`.
- `scripts/smoke-test.mjs` (`npm run test:smoke`): test uruchomienia strony w przeglądarce (Chrome, a bez niego Edge, headless przez `playwright-core`, przeglądarka z systemu). Sprawdza:
  1. serwer bez PLC: widok 3D, symulacja cięcia prostego offline (napis „Cięcie: długość …”);
  2. serwer z testowym PLC (`test/fake-plc-server.js`, OPC UA): tryb online, „Połączono”, pozycje osi;
  3. wersję statyczną GitHub Pages pod `/Promasz-Visu3D/`: `static`, tylko offline, brak `api/events`, symulacja cięcia.
  - Każdy błąd JS, konsoli albo HTTP (poza `favicon.ico`) przerywa test.
- Nowa zależność deweloperska `playwright-core`.
- Sprawdzone lokalnie (Windows, Chrome 156): `npm test` i smoke test - wszystkie trzy warianty OK.

### Wersja na GitHub Pages
- Visu3D jest dostępne w przeglądarce bez instalacji: <https://patrykchoinski.github.io/Promasz-Visu3D/>. Wersja statyczna, tylko tryb Offline (symulacja), bez PLC.
- `scripts/build-pages.js` (`npm run build:pages`) buduje `site/`:
  - strona z `public/`;
  - plik `api/config` z tą samą konfiguracją, co serwer (`clientConfig` w `src/server/main.js`, bez haseł), z `static: true`;
  - `.nojekyll`.
- Strona z `static: true`:
  - nie łączy się z `api/events`;
  - chowa przycisk Online i zawsze startuje w trybie Offline;
  - pasek stanu pokazuje „Offline - symulacja (GitHub Pages, bez PLC)”.
- Workflow `.github/workflows/pages.yml`: po pushu do `master` (albo ręcznie) testy, budowa i publikacja (`actions/upload-pages-artifact`, `actions/deploy-pages`).
- Sprawdzone: `npm test` 116/116; lokalnie statyczny serwer plików pod podkatalogiem `/Promasz-Visu3D/` (wszystkie pliki 200, tryb offline, symulacja cięcia).

### Ręczne: prędkości ruchów dla każdej osi (#140)
- Ekran Ręczne, sekcja „Prędkości ruchów” na dole ekranu: prędkość X, Y, Z [m/min] i A, B [°/s] (`fJogXVelocity` … `fJogBVelocity`).
  - To te same pola co „Jog” w Parametrach, synchronizowane w obie strony i zapamiętywane z formularzami.
- Jak w PLC (`SingleAxisMotion`):
  - jog i jazda „o” kąt (`MCJog` / `MCRelative`) jadą z prędkością jog osi;
  - jazda „na” kąt (`MCAbsolute`) jedzie z `VelA` / `VelB`. Wcześniej „Jedź o” używało `VelA` / `VelB`.
- Opcja „Przy pile ON jog z prędkością cięcia” (`bServiceManualRewriteJogSpeed`, `ManualST`): przy włączonej pile jog X / Y z prędkością cięcia (`fVelocitySawMode`), Z z prędkością roboczą (`fVelocityAxisZWork`).
- Z informacji na ekranie Ręczne usunięte linie „Pozycja” i „Jog” (zostaje interpolacja: prędkość cięcia i strona lasera).
- Ekran Pozycja: nad polami zadanymi aktualne X / Y / Z / A / B (tylko odczyt, odświeżane na bieżąco, 0,01 mm); usunięty przycisk „Ustaw od razu”.
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

### Rysunki poglądowe figur w automacie (#138)
- Sekcja „Figura” (zakładka Automat): pod wyborem figury rysunek z literami wymiarów jak na ekranach figur w HMI, przy polach te same litery (A, B, H, R, D, W, X, Y …), rysunek odświeżany na bieżąco z polami.
- Obrazki wyciągnięte z projektu DIAScreen `HMI/PilaJednosuportowaINNER.dpa`: sekcja `[Picture]` to nagłówek `DOP-100IMAGE1.0` i rekordy (u32 rozmiar + `BITMAPINFOHEADER` + piksele BGRA 32 bpp), `PictureOffset` stanu elementu = przesunięcie rekordu od początku banku. 36 obrazków z ekranów 130–154 w `src/client/img/figures` (przycięte, białe tło), kopiowane przez `build-client.js` do `public/img`.
- Warianty jak w HMI: trapez wg `iTrapezoidType` (7), blat wg `iWorktopType` (7), książka wg `iBookType`, ćwierćwałek wg `iQuaterRoundType`; daszki z 4 przycisków ścian `bRoof1..4Wall` (zielona = cięta pod kątem) z położeniem i obrotem `nAngle` z ekranu (w HMI ściana 1 – dół – ma 180° jak ściana 3, odwzorowane 1:1).
- Litery z ekranów: tekst obok pola → zmienna PLC (np. A = `fFigureLength`, B = `fFigureWidth`, H = `fFigureHeight`, R = `fFigureRadius`, W = `fCrossWidth2`, H serca = `fHeartHeightPart`, D..D5 książki, A..H blatu = `aWorktopLenghts[0..7]`).
- Figury bez obrazka w HMI (Narożniki, Dziury, Ociekacz, Frez stół, Naroża L, Indukcja – brak ekranu, Wielokąt) – schemat SVG w stylu HMI z literami; wielokąt z wpisanych punktów (numery wierzchołków).
- `src/shared/figpics.js` (mapa figur, obrazków i liter), `test/figpics.test.js`: każda figura ma rysunek i pliki istnieją, litery odpowiadają polom figur, warianty typów dają różne obrazki, ściany daszków.
- Sprawdzone: `npm test` 109/109; w przeglądarce trapez, blat (zmiana typu), daszki (wyłączona ściana), litery przy polach; schematy SVG w headless Edge.

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
