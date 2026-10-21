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
