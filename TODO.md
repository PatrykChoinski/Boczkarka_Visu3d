# TODO – #128 podprogramy piły + automat

Zakres: wszystkie programy piły z zadania `Programs` w PLC + automat (`ProgramAutoCutST` – bufor kroków).
Frez, wiercenie, polerowanie – na razie pominięte.

## Przygotowanie
- [x] Zrzut kodu PLC (projekt AI) i lista POU w zadaniach (`Programs`: CutST, CutArcST, CutCircleST, CutStripesST, CutBlocksST, CutElipseST, SmoothingShape, SmoothingShapeFull, ProgramAutoCutST, ProgramAutoProfileST, EdgesST; `MainTask`: MowingST)
- [x] Zmienne automatu w symbol configu (aProgramXPosition/Y, aProgramNextStep, aProgramRadius, aProgramAngle, aProgramDepth, aProgramOutIn, iProgramCutNumber, fProgramStartPositionX/Y, iActualNumberOfProgramCuts)
- [x] Analiza: CutST (wewnętrzne, odwrócone, skos, tablica głębokości)
- [x] Analiza: CutArcST, CutCircleST, CutElipseST (interpolacja kołowa, A styczna liniowo, B = 0)
- [x] Analiza: CutStripesST, CutBlocksST, EdgesST, MowingST (pasy / bloki / krawędzie = linie dla CutST; koszenie = 2 zagłębienia na A 0, B 0)
- [x] Analiza: SmoothingShape, SmoothingShapeFull, ProgramAutoProfileST (profile = cięcia CutST z głębokością z okręgu; wygładzanie = łuki XZ / YZ)

## Rdzeń
- [x] Rzazy: przebudowa siatek tylko dla zmienionych cięć, limit 60 -> 4000 cięć, zakres XY przyrostowo
- [x] Ruch: `ProgramBuilder` (osie osobno, prosta, łuk, postój, dojazd jak GoToPositionST)
- [x] Dojazd między krokami jak GoToPositionST (Z nad materiał, X/Y/A, B, Z)

## Operacje (offline)
- [x] Silnik: `cutst.js`, `sawlines.js`, `arcs.js`, `profiles.js`, `ops.js` + testy (`test/ops.test.js`, 36/36)
- [x] Cięcie proste – wewnętrzne / pół-wewnętrzne / odwrócone / skos jak CutST
- [x] Łuk (CutArcST)
- [x] Okrąg (CutCircleST)
- [x] Elipsa (CutElipseST)
- [x] Pasy (CutStripesST)
- [x] Bloki (CutBlocksST)
- [x] Krawędzie (EdgesST)
- [x] Koszenie (MowingST)
- [x] Wygładzanie / wygładzanie pełne (SmoothingShape / SmoothingShapeFull)
- [x] Profile (ProgramAutoProfileST)

## Automat (ProgramAutoCutST)
- [x] Tabela kroków offline (X, Y, krok, R, kąt, głębokość, we/zew) + punkt startowy
- [x] Sekwencer kroków -> jeden program ruchu (Cut, GoToPosition, łuki, okręgi, skosy, ChangeDepth, Nothing, Confirm, profile, wygładzanie) – `src/shared/automat.js`
- [x] Online: odczyt tablic z PLC, rysowanie ścieżki programu i podświetlenie bieżącego kroku

## UI
- [x] Zakładka Operacja: wybór programu + formularz z definicji
- [x] Zakładka Automat
- [x] Pasek stanu: operacja / krok automatu

## Zakończenie
- [x] Testy (`npm test`) dla nowych operacji i automatu
- [x] Sprawdzenie w przeglądarce (offline: każda operacja + automat)
- [x] README + CHANGELOG (Visu3D), CHANGELOG repo główne, commit

## Z #128 (komentarze w zgłoszeniu)
- [x] Laser – żółta linia zgodna z ruchem cięcia, domyślnie w prawą stronę
- [x] Obroty tarczy wg częstotliwości i kierunku napędu (`iMainDriveFreqAct`, `bMainDriveRunFWD/REV`)
- [x] Cięcie w stół innym kolorem (czerwony)
- [x] Ekran ruchów ręcznych: jog XYZAB ±, A 0 / 90 / −90 / 180 / −180, B 0 / 30 / 45 / 60 / 90
- [x] Ruchy interpolowane: wzdłuż lasera / przeciwnie / prostopadle / prostopadle odwrotnie
- [ ] Na maszynie: kierunek lasera i obrotu tarczy (FWD) względem rzeczywistości, skala `iMainDriveFreqAct`
- [x] Cięcie proste: dwa punkty / kąt i długość (jak CutST.GetPositions), pola chowane wg zaznaczonej opcji
- [x] Figury w automacie – wypełnianie bufora jak FiguresGeometricSt (wszystkie FigureType poza PROFILES; frez – podgląd)
- [x] Ręczne: jazda na zadany kąt A i B (absolutnie / o kąt)

## #134 Bazowanie
- [x] Ekran Bazowanie jak BaseHomingST (Z 0, A 0 najkrótszą drogą, B 0 / 90), tryb online z bMode* / bSystemBased
- [x] Narzędzia frez / wiertło / polerka z B 90°, zamiana narzędzia po bazowaniu
- [x] Punkty styku z materiałem wg formuł MillST / DrillST / Polishing (testy)
- [x] Średnice: fParameterMillWidth (frez, wiertło), polerka – parametr wizualizacji
- [x] Ekrany tylko trybu (operacje frezu, wiercenia, polerowania; automat frezu)
- [ ] Symulacja ruchu automatu frezu (ProgramAutoMillST) – na razie podgląd toru
- [ ] Na maszynie: znak ActiveTool.Height i średnica polerki

## #135 Końce cięć w automacie
- [x] Cięcie zewnętrzne wychodzi za punkt o szerokość tarczy
- [x] Wewnętrzne / pół-wewnętrzne nie wychodzą za punkt (też skos - głębokość w płaszczyźnie tarczy)
- [ ] PLC: odsunięcie skosu wewnętrznego z głębokości pionowej (CutST) - do decyzji

# TODO – #136 animacja obrotów: frez / wiercenie / polerowanie

Gałąź `develop/AnimacjaObrotowNarzedzi` (Visu3D i repo główne), od najnowszego `master` / `main`.

- [x] Sprawdzenie w PLC: frez, wiercenie i polerowanie kręcą tym samym napędem co piła (`bMainDriveOn`, `iMainDriveFreqAct`) – obroty z `sawState()`
- [x] Frez: spiralne ostrza na części roboczej + krzyż na czole, obracają się z wrzecionem
- [x] Wiertło (koronka): segmenty na obwodzie czoła + pasy wzdłuż rury
- [x] Polerka: sektory na talerzu + znacznik na boku
- [x] Znacznik na chwycie (widać obroty także przy zasłoniętym czole)
- [x] Prędkość obrotów narzędzi w `config.json` (`saw.toolVisualRps`), kierunek FWD / REV
- [x] Test: geometria znaczników na powierzchni narzędzia i obrót wokół osi (`test/toolspin.test.js`, 105/105)
- [x] Sprawdzenie w przeglądarce: frez, wiercenie, polerowanie po bazowaniu, wrzeciono ON – obrót widoczny
- [x] Linie znaczników i tarczy bez obcinania po starej sferze otaczającej (`frustumCulled = false`) – wcześniej znikały po odjechaniu narzędzia
- [ ] Na maszynie: kierunek obrotu FWD narzędzi względem rzeczywistości (`fwdSign`)
- [x] README + CHANGELOG (Visu3D), CHANGELOG repo główne, commit na gałęzi develop, push, merge do `master`

## #137 Znaczniki XY
- [x] Punkty początkowe / końcowe kolejnych akcji z wartościami X / Y na materiale (operacja, automat, frez, wiercenie, polerowanie)
- [x] Przełącznik XY, podświetlenie aktualnego kroku
- [x] Odległości między punktami (początek - koniec akcji) w połowie toru
- [x] Przełącznik Odległości na górnym pasku (osobno od XY)

## #139 Zapisz punkty
- [x] Przyciski Zapisz przy punktach początkowych / końcowych wszystkich operacji (jak w PLC, 0,01 mm)
- [x] Zapisz punkt startowy automatu

## #140 Prędkości ruchów ręcznych
- [x] Prędkość każdej osi na ekranie Ręczne (fJog[XYZAB]Velocity), wspólna z Parametrami
- [x] Jazda „o” kąt z prędkością jog (MCRelative), „na” kąt z VelA / VelB
- [x] bServiceManualRewriteJogSpeed (przy pile jog z prędkością cięcia)

# TODO – #138 rysunki poglądowe figur w automacie

Gałąź `develop/RysunkiFigurAutomat` (Visu3D i repo główne), od najnowszego `master` / `main`.

- [x] Ekrany figur w DIAScreen (130–155): litera obok pola → zmienna PLC (np. A = `fFigureLength`, W = `fCrossWidth2`, A..H = `aWorktopLenghts[0..7]`)
- [x] Obrazki z projektu DIAScreen: bank `[Picture]` w `.dpa` (rekordy BMP 32 bpp, `PictureOffset` = przesunięcie od początku banku) → `src/client/img/figures` (36 plików)
- [x] Warianty jak w HMI: `iTrapezoidType` (7), `iWorktopType` (7), `iBookType` (2), `iQuaterRoundType` (2), daszki – 4 przyciski ścian `bRoof1..4Wall` z obrotem `nAngle`
- [x] Figury bez obrazka w HMI (Narożniki, Dziury, Ociekacz, Frez stół, Naroża L, Indukcja, Wielokąt) – schemat SVG w stylu HMI z literami
- [x] Litery przy polach figury (A, B, H, R, D, W, X, Y …) i rysunek zmieniany na bieżąco z polami
- [x] Test `test/figpics.test.js` (każda figura ma rysunek, pliki istnieją, litery = pola, warianty)
- [x] Sprawdzenie w przeglądarce: trapez, blat (typ), daszki (ściany), schematy SVG (headless Edge)
- [ ] Na maszynie / HMI: porównać daszki – w HMI ściana 1 (dół) ma `nAngle` 180 jak ściana 3 (góra), odwzorowane 1:1
- [x] README + CHANGELOG (Visu3D), CHANGELOG repo główne, commit na gałęzi develop, push, merge do `master`

## #141 Woda i laser
- [x] Dwa niebieskie węże z wodą, woda z dysz na tarczę / narzędzie przy obrotach (online yWaterCut / yWaterMill)
- [x] Moduł lasera na osłonie tarczy, wiązka do linii lasera
- [x] Panel operatorski przed prawym murkiem (zielona mata na stole usunięta)
- [x] Osłona większa od tarczy, zielony odbojnik wody pod przednim narożnikiem osłony
- [x] Osłona tarczy i dysze wg zdjęcia w #141, dużo wody z rozbryzgiem wg filmu
- [ ] Na maszynie: kierunek obrotu FWD (saw.fwdSign -1), położenie modułu lasera (laser.mountAngle), trzecia (dolna) dysza

# TODO – #124 G-kod / CNC 3D (tylko tryb frezu)

Gałąź `develop/WizuGCode` (Visu3D i repo główne). Przykładowy plik: `Dodatkowe Programy/madonna_frez_fi25mm_fixed.nc` (54 485 linii, G00 / G01, frez fi 25).

- [x] Parser G-kodu jak preprocesor CNC w PLC (`gcode.js`): G0 / G1 / G2 / G3 (I / J, R z ostrzeżeniem), G90 / G91, G20 / G21, G53 (reszta linii pomijana), F, M03 / M05 / M30
- [x] Pozycje osi z G54 jak CNCInfo / preprocesor (`cnc.js`): X = G54_X + X, Y = G54_Y − Y, Z = G54_Z + Z; limity 200 mm/s XY, 20 mm/s Z
- [x] Mapa wysokości materiału (`heightmap.js`): czoło frezu obniża powierzchnię
- [x] Zakładka „G-kod” tylko w trybie frezu po bazowaniu: wczytanie pliku `.nc`, podsumowanie (ruchy, zakres, długości, czas, ostrzeżenia)
- [x] Punkt początkowy G54 X / Y / Z: pola, „= aktualna” i „bez promienia” (+ fParameterMillWidth / 2) jak bSetG54_*; online G54 z PLC (HMI.G54_X / Y / Z)
- [x] Start (animacja z prędkościami z pliku) i „Wynik od razu” (cały program na mapie wysokości)
- [x] Widok 3D: powierzchnia mapy wysokości (kolor wg głębokości), tor programu (G1 / G0)
- [x] Testy: parser na fragmencie pliku, G54 → osie, mapa wysokości (frez schodzi na zadaną głębokość), program z przykładowego pliku
- [x] Sprawdzenie w przeglądarce na przykładowym pliku (wczytanie 0,2 s, „Wynik od razu” 1,7 s, siatka 399 × 504 co 1 mm; relief Madonny z mapy wysokości – zgodny z plikiem)
- [x] README + CHANGELOG (Visu3D), CHANGELOG repo główne, commit (bez push)
- [x] Online z testowym PLC (`--mode cnc`: frez po bazowaniu, program G-kodu od G54, `HMI.G54_X / Y / Z`): G54 z PLC w polach (zablokowane), ruchy z PLC wycinają mapę wysokości – 214 cm², 6 mm jak w programie
- [ ] Na maszynie (robi użytkownik): porównanie z rzeczywistym frezowaniem (G54, kierunek Y, głębokość)
- [x] Animacja w przeglądarce: cały plik Madonny na 1000× – mapa wysokości tnie się w trakcie, podsumowanie odświeżane co 1 s (koniec po 17 886 s programu; wynik = „Wynik od razu” w 99,8 % siatki, różnice > 0,5 mm w 342 komórkach na narożnikach – próbki co 10 s przy 1000× łączone prostą)
- [x] Poprawka: po przeładowaniu strony zbazowany tryb wracał z B 0° (frez poziomo, program CNC nic nie ciął) – teraz B jak po bazowaniu; ostrzeżenie w zakładce G-kod, gdy B ≠ 90°
- [x] Tempo animacji 500× i 1000× (program Madonny ≈ 5 h ruchu)
- [x] Wydajność: widok aktualizuje tylko zmieniony fragment mapy (`HeightMap.takeDirty`), normalne z różnic wysokości – 0,17 ms zamiast ok. 35 ms na zmianę przy siatce Madonny (201 tys. punktów)
- [x] Przycisk „Przykład” – `examples/madonna_frez_fi25mm_fixed.nc` (kopia z `Dodatkowe Programy`, w paczce na maszynę)
