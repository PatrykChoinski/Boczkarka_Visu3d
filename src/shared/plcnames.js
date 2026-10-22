// Opisy zmiennych PLC w interfejsie (nazwy GVL / zmiennych, np. "(fManualXZeroPosition)", "HMI.bService...") - widoczne
// tylko dla Admina. Rozpoznawanie nazw w tekstach i podpowiedziach (czyste funkcje, bez DOM - test/plcnames.test.js).

// Nazwa zmiennej PLC: GVL.zmienna albo nazwa z przedrostkiem typu (b / f / i / s / a / x / y / e + wielka litera,
// np. bManualTwoPoint, fParameterMillWidth, iManualStripesNumberSet, aCuttingBoardX, yLaser), ActiveTool.Height
export const PLC_ID = /\b(?:HMI2?|IOVars|Communication|ToolChangeGVL|IoConfig_Globals_Mapping|PolishingGVL|VisuVars|GVL)\.[\w[\]…]+|\b[bfisaxye][A-Z][A-Za-z0-9_]*\w|\bActiveTool\.Height\b/;

export const hasPlcName = (s) => PLC_ID.test(s || '');

// Fragmenty tekstu z nazwami zmiennych do schowania: nawiasy z nazwa zmiennej ("(fManualXSaveZero)",
// "(jak w PLC: bProgramSaveStartPosition)") i dopisek po pauzie na koncu ("– bManualTwoPoint").
// Zwraca liste [{start, end}] (end - za fragmentem) w kolejnosci.
export function plcNameRanges(text) {
  const out = [];
  const re = /\s*\(([^()]*)\)|\s+[–-]\s+([\w.[\]…]+)\s*$/g;
  let m;
  while ((m = re.exec(text))) {
    const inner = m[1] ?? m[2];
    if (hasPlcName(inner)) out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

// Tekst bez nazw zmiennych (np. podpowiedz dla nie-Admina): bez nawiasow i dopiskow z nazwami, bez linii "HMI: ..."
// i linii, w ktorych dalej sa nazwy zmiennych (opisy dzialania w PLC)
export function stripPlcNames(text) {
  if (!text) return text;
  return text.split('\n').map((line) => {
    let s = line;
    for (const r of plcNameRanges(line).reverse()) s = s.slice(0, r.start) + s.slice(r.end);
    return s;
  }).filter((line) => line.trim() && !/^\s*HMI:/.test(line) && !hasPlcName(line)).join('\n');
}
