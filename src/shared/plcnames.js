// Opisy zmiennych PLC w interfejsie (nazwy GVL / zmiennych, np. "(fManualXZeroPosition)", "HMI.bService...") - widoczne
// tylko dla Admina. Rozpoznawanie nazw w tekstach i podpowiedziach (czyste funkcje, bez DOM - test/plcnames.test.js).

// Nazwa zmiennej PLC: GVL.zmienna albo nazwa z przedrostkiem typu (b / f / i / s / a / x / y / e + wielka litera,
// np. bManualTwoPoint, fParameterMillWidth, iManualStripesNumberSet, aCuttingBoardX, yLaser), ActiveTool.Height,
// programy PLC (BaseHomingST, ProgramAutoCutST)
export const PLC_ID = /\b(?:HMI2?|IOVars|Communication|ToolChangeGVL|IoConfig_Globals_Mapping|PolishingGVL|VisuVars|GVL)\.[\w[\]…]+|\b[bfisaxye][A-Z][A-Za-z0-9_]*\w|\bActiveTool\.Height\b|\b[A-Z][a-z][A-Za-z]*ST\b/;

export const hasPlcName = (s) => PLC_ID.test(s || '');

// Fragmenty tekstu z nazwami zmiennych do schowania: nawiasy z nazwa zmiennej ("(fManualXSaveZero)",
// "(jak w PLC: bProgramSaveStartPosition)") i dopisek po pauzie na koncu ("– bManualTwoPoint").
// Zdanie, w ktorym poza nawiasami dalej jest nazwa zmiennej, chowane w calosci.
// Zwraca liste [{start, end}] (end - za fragmentem) w kolejnosci.
export function plcNameRanges(text) {
  const parts = [];
  const parens = [];
  const re = /\s*\(([^()]*)\)|\s+[–-]\s+([\w.[\]…]+)\s*$/g;
  let m;
  while ((m = re.exec(text))) {
    const r = { start: m.index, end: m.index + m[0].length };
    if (m[1] !== undefined) parens.push(r);
    if (hasPlcName(m[1] ?? m[2])) parts.push(r);
  }
  // zdania (koniec na . ; ! ? przed odstepem, nie w nawiasie - kropki w nazwach GVL.zmienna nie koncza zdania)
  const sentences = [];
  const sre = /[.;!?](?=\s|$)\s*/g;
  let from = 0;
  while ((m = sre.exec(text)) || from < text.length) {
    if (m && parens.some((r) => m.index > r.start && m.index < r.end)) continue;
    const end = m ? m.index + m[0].length : text.length;
    const rest = parts.filter((r) => r.start >= from && r.end <= end)
      .reduceRight((s, r) => s.slice(0, r.start - from) + s.slice(r.end - from), text.slice(from, end));
    if (hasPlcName(rest)) sentences.push({ start: from, end });
    from = end;
    if (!m) break;
  }
  return [...sentences, ...parts.filter((r) => !sentences.some((s) => r.start >= s.start && r.end <= s.end))]
    .sort((a, b) => a.start - b.start);
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
