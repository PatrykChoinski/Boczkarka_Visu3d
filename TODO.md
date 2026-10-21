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
