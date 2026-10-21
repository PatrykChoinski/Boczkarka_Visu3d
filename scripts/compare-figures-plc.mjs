// Porownanie figur automatu z PLC: dla kazdej figury i przypadku (domyslne, wewnetrzne, dodatkowa droga) wpisuje pola
// figury i parametry do PLC, uruchamia FiguresGeometricSt (iFigureType + bFigureAddToCurrent), czeka na
// bFigureCalculated, czyta aFigure* i iFigureNumber i porownuje z buforem z src/shared/figures (wszystkie kolumny).
//
//   node scripts/compare-figures-plc.mjs --sim <PLC .project>     symulacja DIADesigner-AX (projekt otwierany bez zapisu,
//                                                                  haslo w PROJECT_PASSWORD), skrypt plc_figures_sim.py
//   node scripts/compare-figures-plc.mjs [opc.tcp://localhost:4840]   dzialajacy PLC przez OPC UA (tylko PLC testowy -
//                                                                  zapisuje zmienne figur i parametry)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIGURES, FIGURE_CONTEXT_FIELDS, figureContext } from '../src/shared/figures/index.js';
import { defaults, COMMON_FIELDS } from '../src/shared/ops.js';
import { machine } from '../src/shared/geometry.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIA = 'C:/Program Files/Delta Industrial Automation/DIAStudio/DIADesigner-AX 1.10/CODESYS/Common/DIADesigner-AX.exe';
const M = machine({ discDiameter: 625, bladeWidth: 4, materialThickness: 40, millWidth: 20 });
const COMMON = { ...defaults(COMMON_FIELDS), bladeWidth: M.bladeWidth };
const CASES = [
  { name: 'domyslne', ctx: {} },
  { name: 'wewnetrzne', ctx: { internal: 1 } },
  { name: 'dodatkowa droga 50', ctx: { additional: true, additionalDistance: 50 } },
];
const COLS = ['x', 'y', 'step', 'r', 'angle', 'depth', 'depthEnd', 'length'];
const OUT_VARS = ['aFigureXPosition', 'aFigureYPosition', 'aFigureIndex', 'aFigureRadius', 'aFigureAngle', 'aFigureDepthStart', 'aFigureDepthEnd', 'aFigureLength'];
const LABEL_VAR = /\(([A-Za-z][A-Za-z0-9_]*)[^)]*\)\s*$/;
// parametry stale dla obu stron (jak kontekst figur w aplikacji)
const FIXED = [['fParameterBladeWidth', 'real', M.bladeWidth], ['fParameterMaterialThickness', 'real', M.materialThickness],
  ['bServiceBlocksReverse', 'bool', COMMON.blocksReverse], ['fParameterZMoveAboveMaterial', 'real', COMMON.above], ['bModeMill', 'bool', false],
  ['fParameterMillWidth', 'real', M.millWidth]];

const kindOf = (f) => (f.t === 'bool' ? 'bool' : f.t === 'num' ? 'real' : 'int');

// Przypadki: zapisy do PLC [[zmienna, rodzaj, wartosc]] i oczekiwany bufor Visu3D
function buildCases() {
  const out = [];
  for (const fig of FIGURES) {
    for (const c of CASES) {
      const ctxValues = { ...defaults(FIGURE_CONTEXT_FIELDS), ...c.ctx };
      const v = defaults(fig.fields);
      let js;
      try { js = fig.build(v, figureContext(ctxValues, M, COMMON)); } catch (e) { js = { error: e.message }; }
      const writes = [...FIXED];
      for (const f of FIGURE_CONTEXT_FIELDS) {
        const m = f.label.match(LABEL_VAR);
        if (m) writes.push([m[1], kindOf(f), ctxValues[f.k]]);
      }
      for (const f of fig.fields) {
        const m = f.label.match(LABEL_VAR);
        if (!m) continue;
        if (f.t === 'list') {
          // listy: aWorktopLenghts od [0], aPolygonX / Y od [1] (jak w groupA); reszta tablicy = 0
          const off = m[1].startsWith('aPolygon') ? 1 : 0;
          const size = m[1].startsWith('aPolygon') ? 100 : 8;
          for (let i = 0; i < size; i++) writes.push([`${m[1]}[${i}]`, 'real', i >= off ? (v[f.k][i - off] ?? 0) : 0]);
        } else {
          writes.push([m[1], kindOf(f), v[f.k]]);
        }
      }
      out.push({ id: fig.id, v: fig.v, kind: fig.kind, case: c.name, writes, js, expectCount: js.count ?? 0 });
    }
  }
  return out;
}

// Porownanie: plc = {count, rows: [[x, y, step, r, angle, depth, depthEnd, length], ...], error?}
function compare(c, plc) {
  const diffs = [];
  if (plc.error) diffs.push(`PLC: ${plc.error}`);
  if (c.js.error) diffs.push(`Visu3D: ${c.js.error}`);
  if (plc.error || c.js.error) return diffs;
  if (plc.count !== c.js.count) diffs.push(`iFigureNumber PLC ${plc.count} != ${c.js.count}`);
  const n = Math.max(plc.count, c.js.count);
  for (let i = 0; i <= n && diffs.length < 6; i++) {
    COLS.forEach((k, j) => {
      const p = Number(plc.rows[i]?.[j] ?? 0);
      const v = Number(c.js.rows[i]?.[k] ?? 0);
      const pn = Number.isNaN(p);
      const vn = Number.isNaN(v);
      if (pn !== vn || (!pn && Math.abs(p - v) > 1e-6 * Math.max(1, Math.abs(p)))) diffs.push(`[${i}].${k} PLC ${p} != ${v}`);
    });
  }
  return diffs;
}

function report(cases, results) {
  let failed = 0;
  cases.forEach((c, i) => {
    const r = results[i];
    const diffs = compare(c, r);
    const ok = diffs.length === 0;
    if (!ok) failed++;
    console.log(`${ok ? 'OK  ' : 'ROZN'} ${String(c.v).padStart(3)} ${c.id.padEnd(18)} ${c.case.padEnd(20)} ${c.kind.padEnd(7)} iFigureNumber ${r.count ?? '-'}${ok ? '' : `  ${diffs.join('; ')}`}`);
  });
  console.log(`\nZgodnych z PLC: ${cases.length - failed} / ${cases.length}`);
  return failed;
}

// --- symulacja DIADesigner ------------------------------------------------------------------------
function runSim(projectPath) {
  const cases = buildCases();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vizu-fig-'));
  const casesFile = path.join(dir, 'cases.json');
  const resultsFile = path.join(dir, 'results.json');
  fs.writeFileSync(casesFile, JSON.stringify(cases.map(({ id, v, case: name, writes, expectCount }) => ({ id, v, case: name, writes, expectCount }))));
  console.log(`Symulacja PLC: ${projectPath}, przypadkow ${cases.length} ...`);
  // DIADesigner wymaga --profile="..." (cudzyslow tylko wokol wartosci) - argumenty bez przerabiania przez Node
  const args = ['--profile="DIADesigner-AX 1.10"', '--noUI', `--runscript="${path.join(HERE, 'plc_figures_sim.py')}"`];
  const res = spawnSync(DIA, args, {
    env: { ...process.env, VIZU_PROJECT: path.resolve(projectPath), VIZU_CASES: casesFile, VIZU_RESULTS: resultsFile },
    encoding: 'utf8', timeout: 3600000, windowsVerbatimArguments: true, shell: false,
  });
  if (!fs.existsSync(resultsFile)) {
    console.error((res.stdout || '').split('\n').slice(-30).join('\n'), res.stderr || '');
    throw new Error('brak wynikow symulacji');
  }
  const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
  return report(cases, results);
}

// --- OPC UA (dzialajacy PLC) -------------------------------------------------------------------------
async function runOpcUa(endpoint) {
  const { OPCUAClient, MessageSecurityMode, SecurityPolicy, AttributeIds, DataType, Variant, VariantArrayType } = await import('node-opcua-client');
  const { OpcUaSource } = await import('../src/server/opcua-source.js');
  const client = OPCUAClient.create({ applicationName: 'VizuApp-compare', securityMode: MessageSecurityMode.None, securityPolicy: SecurityPolicy.None, endpointMustExist: false });
  await client.connect(endpoint);
  const session = await client.createSession();
  const src = new OpcUaSource({});
  const app = await src.findApplication(session);
  const appKids = await src.children(session, app);
  const gvls = appKids.GlobalVars ? await src.children(session, appKids.GlobalVars.nodeId) : appKids;
  const vars = {};
  for (const g of Object.values(gvls)) for (const [name, { nodeId }] of Object.entries(await src.children(session, g.nodeId))) vars[name] ??= nodeId;
  const node = (name) => { if (!vars[name]) throw new Error(`brak zmiennej ${name} w OPC UA`); return vars[name]; };
  const read = async (name) => (await session.read({ nodeId: node(name), attributeId: AttributeIds.Value })).value;
  // zapis tym samym typem, jaki zwraca PLC; "tab[i]" - element tablicy (cala tablica czytana i zapisywana)
  const pendingArrays = new Map();
  async function write(items) {
    for (const [name, , value] of items) {
      const m = name.match(/^(\w+)\[(\d+)\]$/);
      if (m) {
        if (!pendingArrays.has(m[1])) pendingArrays.set(m[1], { cur: await read(m[1]), vals: [] });
        pendingArrays.get(m[1]).vals[Number(m[2])] = value;
        continue;
      }
      const cur = await read(name);
      const v = new Variant({ dataType: cur.dataType, value: cur.dataType === DataType.Boolean ? Boolean(value) : Number(value) });
      await session.write({ nodeId: node(name), attributeId: AttributeIds.Value, value: { value: v } });
    }
    for (const [name, { cur, vals }] of pendingArrays) {
      const arr = Array.from(cur.value);
      vals.forEach((x, i) => { if (x !== undefined && i < arr.length) arr[i] = Number(x); });
      const Typed = cur.value.constructor;
      await session.write({ nodeId: node(name), attributeId: AttributeIds.Value, value: { value: new Variant({ dataType: cur.dataType, arrayType: VariantArrayType.Array, value: Typed === Array ? arr : Typed.from(arr) }) } });
    }
    pendingArrays.clear();
  }
  const waitFor = async (name, pred, ms = 5000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (pred((await read(name)).value)) return true; await new Promise((r) => setTimeout(r, 20)); }
    return false;
  };
  const cases = buildCases();
  const results = [];
  for (const c of cases) {
    const r = {};
    await write([['bFigureCalculated', 'bool', false]]);
    if (!await waitFor('iFigureType', (x) => Number(x) === 0, 2000)) await write([['iFigureType', 'int', 0]]);
    await write(c.writes);
    await write([...OUT_VARS.flatMap((n) => Array.from({ length: 250 }, (_, i) => [`${n}[${i}]`, 'real', 0])), ['iFigureNumber', 'int', 0]]);
    await write([['iFigureType', 'int', c.v], ['bFigureAddToCurrent', 'bool', true]]);
    if (!await waitFor('bFigureCalculated', (x) => x === true)) r.error = 'timeout bFigureCalculated';
    r.count = Number((await read('iFigureNumber')).value);
    const cols = [];
    for (const n of OUT_VARS) cols.push(Array.from((await read(n)).value));
    r.rows = Array.from({ length: Math.max(r.count, c.expectCount) + 1 }, (_, i) => cols.map((col) => col[i]));
    await write([['bFigureCalculated', 'bool', false]]);
    results.push(r);
  }
  await session.close();
  await client.disconnect();
  return report(cases, results);
}

const args = process.argv.slice(2);
const failed = args[0] === '--sim' ? runSim(args[1]) : await runOpcUa(args[0] || 'opc.tcp://localhost:4840');
process.exit(failed ? 1 : 0);
