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
- [ ] Cięcie proste – wewnętrzne / pół-wewnętrzne / odwrócone / skos jak CutST
- [ ] Łuk (CutArcST)
- [ ] Okrąg (CutCircleST)
- [ ] Elipsa (CutElipseST)
- [ ] Pasy (CutStripesST)
- [ ] Bloki (CutBlocksST)
- [ ] Krawędzie (EdgesST)
- [ ] Koszenie (MowingST)
- [ ] Wygładzanie / wygładzanie pełne (SmoothingShape / SmoothingShapeFull)
- [ ] Profile (ProgramAutoProfileST)

## Automat (ProgramAutoCutST)
- [ ] Tabela kroków offline (X, Y, krok, R, kąt, głębokość, we/zew) + punkt startowy
- [x] Sekwencer kroków -> jeden program ruchu (Cut, GoToPosition, łuki, okręgi, skosy, ChangeDepth, Nothing, Confirm, profile, wygładzanie) – `src/shared/automat.js`
- [ ] Online: odczyt tablic z PLC, rysowanie ścieżki programu i podświetlenie bieżącego kroku

## UI
- [ ] Zakładka Operacja: wybór programu + formularz z definicji
- [ ] Zakładka Automat
- [ ] Pasek stanu: operacja / krok automatu

## Zakończenie
- [ ] Testy (`npm test`) dla nowych operacji i automatu
- [ ] Sprawdzenie w przeglądarce (offline: każda operacja + automat)
- [ ] README + CHANGELOG (Visu3D), CHANGELOG repo główne, commit
