// Testowy serwer OPC UA udajacy sterownik CODESYS (bez PLC).
//
// Drzewo jak w CODESYS: Objects/DeviceSet/AX-8/Resources/Application/GlobalVars/<GVL>/<zmienna>,
// NodeId "|var|AX-8.Application.<GVL>.<zmienna>"; pozycje osi z programu ciecia (tryb offline) w petli.
//
//   node test/fake-plc-server.js [--port 4840] [--mode saw|mill|drill|polishing]     potem: npm start  (tryb Online)
//   --mode - tryb po bazowaniu (bModeSaw / Mill / Drill / Polishing, bSystemBased); frez / wiercenie / polerowanie;
//   cnc - frez wykonuje program G-kodu CNC_GCODE od punktu G54 (HMI.G54_X / Y / Z) jak modul CNC w PLC (#124)
//   w petli wykonuje operacje narzedzia (shared/tools.js) zamiast ciec pila

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { OPCUAServer } from 'node-opcua-server';
import { Variant, VariantArrayType, DataType, MessageSecurityMode, SecurityPolicy, StatusCodes } from 'node-opcua-client';
import { VARIABLES, DEFAULTS, dynamicsToInternal } from '../src/shared/config.js';
import { SERVICE_PAGES, SERVICE_SCREEN_VARS } from '../src/shared/servicescreens.js';

// ekrany serwisowe (#147): wartosci poczatkowe zmiennych z GVL (init), bity - FALSE
const SERVICE_INIT = {};
const HMI_ARRAY_LEN = { ARRAY: 8, ARRAY_STRING: 500 };
const svcDefault = (t) => (t === 'BOOL' ? false : t === 'STRING' ? '' : 0);
for (const p of SERVICE_PAGES) {
  for (const g of p.groups) {
    for (const it of g.items) {
      if (!it.v) continue;
      const m = /^(.*)\[(\d+)\]$/.exec(it.v);
      if (m) {
        const t = SERVICE_SCREEN_VARS[m[1]];
        SERVICE_INIT[m[1]] ??= Array(HMI_ARRAY_LEN[t]).fill(t === 'ARRAY_STRING' ? '' : 0);
        SERVICE_INIT[m[1]][Number(m[2])] = it.init ?? SERVICE_INIT[m[1]][Number(m[2])];
      } else if (!(it.v in SERVICE_INIT)) SERVICE_INIT[it.v] = it.init ?? svcDefault(it.t);
    }
  }
}
const hmiValues = () => Object.fromEntries(Object.entries(VARIABLES).filter(([k]) => k.startsWith('hmi:'))
  .map(([k, v]) => [k, SERVICE_INIT[v] ?? svcDefault(SERVICE_SCREEN_VARS[v] ?? (/^HMI\.bService/.test(v) ? 'BOOL' : null))]));
// typy OPC UA zmiennych ekranow serwisowych (jak typy IEC w PLC)
const SVC_TYPES = { BOOL: 'Boolean', STRING: 'String', ARRAY_STRING: 'String', ARRAY: 'Double', INT: 'Int16', Inputs: 'Int16', Outputs: 'Int16',
  ServoType: 'Int16', WORD: 'UInt16', UINT: 'UInt16', DINT: 'Int32', DWORD: 'UInt32' };
import { machine, plcToolAxisZ, plcActualPosition } from '../src/shared/geometry.js';
import { parseGcode } from '../src/shared/gcode.js';
import { cncProgram } from '../src/shared/cnc.js';
import { cutProgram, depthTable, ProgramBuilder } from '../src/shared/motion.js';
import { MODES, toolOpsFor } from '../src/shared/tools.js';
import { defaults } from '../src/shared/ops.js';
import { MAX_APEX, rectangle } from '../src/shared/area.js';

// Sterowanie z Visu3D (tryb PLC): zmienne zapisywane / czytane przez HMI (src/server/hmiwrites.json) spoza konfiguracji -
// w pamieci, zapisywalne jak w PLC.
// Typ wg przedrostka nazwy (b - BOOL, i / e / n / w - INT, s - STRING, inne - LREAL)
const HMI_WRITES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'server', 'hmiwrites.json');
export function panelVars() {
  try {
    const d = JSON.parse(fs.readFileSync(HMI_WRITES, 'utf8'));
    return new Set([...Object.keys(d.write), ...d.read]);
  } catch { return new Set(); }
}
export function panelType(p) {
  const name = p.split('.').pop().replace(/\[\d+\]$/, '');
  if (/^b[A-Z]/.test(name)) return DataType.Boolean;
  if (/^[iewn][A-Z]/.test(name)) return DataType.Int16;
  if (/^s[A-Z]/.test(name)) return DataType.String;
  return DataType.Double;
}
const panelDefault = (t) => (t === DataType.Boolean ? false : t === DataType.String ? '' : 0);

export const NAMESPACE = 'CODESYSSPV3/3S/IecVarAccess';
export const DEVICE = 'AX-8';
const BOOLS = new Set(['stopMachine', 'pauseMachine', 'alarms', 'advancedDesktop', 'cutStart', 'sawRunning', 'waterCut', 'waterMill', 'laser', 'sawFwd', 'sawRev', 'progCutStart', 'progProfStart', 'progOuterInner', 'smoothingArrays',
  'progMillStart', 'systemBased', 'modeSaw', 'modeMill', 'modeDrill', 'modePolishing']);
const INTS = new Set(['cutStep', 'boardCount', 'rockCount', 'sawFreq', 'progCutCount', 'progProfCount', 'progCutIndex', 'progProfIndex', 'progStep', 'progOutIn',
  'progMillCount', 'progMillIndex']);
// tablice: dlugosc (aCuttingBoard / Rock [0..7], tablice programu automatu [0..249])
const ARRAYS = {
  boardX: MAX_APEX, boardY: MAX_APEX, boardZ: MAX_APEX, rockX: MAX_APEX, rockY: MAX_APEX, rockZ: MAX_APEX,
  progX: 250, progY: 250, progStep: 250, progRadius: 250, progAngle: 250, progDepth: 250, progDepthEnd: 250, progLength: 250, progOutIn: 250,
  alarms: 200,
};

// Stol 3500 x 3000 (Z 490 - gora materialu 450 przy grubosci 40, jak fCutMaterialHeight w WorkArea)
// i kamien - pieciokat (nie musi byc prostokatem); tablice [0..7] jak aCuttingBoard / aCuttingRock
const BOARD = rectangle(0, 0, 3500, 3000, 490);
const ROCK = [[100, 150, 450], [2600, 150, 450], [2900, 900, 450], [2200, 1700, 450], [100, 1700, 450]];
const column = (pts, i) => Array.from({ length: MAX_APEX }, (_, k) => (k < pts.length ? pts[k][i] : 0));
const AREA = {
  boardX: column(BOARD, 0), boardY: column(BOARD, 1), boardZ: column(BOARD, 2), boardCount: BOARD.length,
  rockX: column(ROCK, 0), rockY: column(ROCK, 1), rockZ: column(ROCK, 2), rockCount: ROCK.length,
};
// Automat (ProgramAutoCutST): program jak "Przyklad" na stronie - 5 krokow od punktu startowego (500, 400),
// kolejne kroki co 6 s jako biezacy (iActualNumberOfProgramCuts)
const PROG_ROWS = [
  { x: 0, y: 0, step: 1 }, { x: 1500, y: 0, step: 4, r: 1000 }, { x: 1500, y: 900, step: 1 },
  { x: 0, y: 900, step: 1 }, { x: 0, y: 0, step: 2 }, { x: 750, y: 450, step: 26, r: 200 },
];
const progColumn = (k) => Array.from({ length: 250 }, (_, i) => PROG_ROWS[i]?.[k] ?? 0);
const PROGRAM = {
  progX: progColumn('x'), progY: progColumn('y'), progStep: progColumn('step'), progRadius: progColumn('r'),
  progAngle: progColumn('angle'), progDepth: progColumn('depth'), progDepthEnd: progColumn('depthEnd'),
  progLength: progColumn('length'), progOutIn: progColumn('outIn'),
  progOriginX: 500, progOriginY: 400, progCutCount: PROG_ROWS.length - 1, progProfCount: 0, progProfIndex: 0,
  progCutStart: true, progProfStart: false, progMillCount: 0, progMillIndex: 0, progMillStart: false, progOuterInner: false, profileJump: 5, smoothingJump: 100, smoothingArrays: false,
};

const STEP_CODES = { MoveToStartPosition: 10, StartCutDepth: 20, StartSingleCut: 50, StartLastCut: 60, StartMoveAboveMaterial: 70, CutFinish: 100 };

// Petla dwoch ciec (proste i z wychylem) albo operacji narzedzia trybu - wartosci wszystkich zmiennych w czasie t [s]
// Program G-kodu dla --mode cnc: kieszen 120 x 80 z lukiem, 2 przejscia po 3 mm (Y w dol jak w plikach CAM)
export const CNC_GCODE = `S5500 M03
G00 X0 Y0 Z-10
G01 Z3 F300
G01 X120 F3000
G01 Y-80
G02 X60 Y-80 I-30 J0
G01 X0
G01 Y0
G01 Z6 F300
G01 X120 F3000
G01 Y-80
G01 X0
G01 Y0
G00 Z-10
M30`;

export function plcTimeline(mode = 'saw') {
  const cnc = mode === 'cnc';
  if (cnc) mode = 'mill';
  const m = machine({ ...DEFAULTS.offline.machine, mode });
  const dyn = { ...dynamicsToInternal(DEFAULTS.offline.dynamics), cutVel: 150, cutAcc: 300, cutDec: 300 };   // szybciej - krotki test
  let p1;
  let p2;
  if (mode === 'saw') {
    p1 = cutProgram({ x: 0, y: 0, z: 0, a: 0, b: 0 }, { x0: 200, y0: 300, x1: 1000, y1: 300, b: 0, above: 20, depths: depthTable(30, 2) }, m, dyn);
    p2 = cutProgram(p1.at(p1.duration).pose, { x0: 300, y0: 450, x1: 900, y1: 800, b: 45, above: 20, depths: depthTable(24, 2) }, m, dyn);
  } else if (cnc) {
    p1 = cncProgram({ x: 0, y: 0, z: 0, a: 0, b: 90 }, parseGcode(CNC_GCODE), cncG54(m), m, dyn, { zAbove: 20 });
    p2 = { duration: 2, at: () => p1.at(p1.duration) };
  } else {
    const op = toolOpsFor(mode)[0];
    const pb = new ProgramBuilder({ x: 0, y: 0, z: 0, a: 0, b: 90 }, m, dyn);
    op.build(pb, defaults(op.fields));
    p1 = pb.build();
    p2 = { duration: 2, at: () => p1.at(p1.duration) };
  }
  const flags = Object.fromEntries(MODES.map((x) => [x.flag, x.id === mode]));
  const period = p1.duration + p2.duration;
  return (t) => {
    t %= period;
    const at = (tt) => (tt < p1.duration ? p1.at(tt) : p2.at(tt - p1.duration));
    const r = at(t);
    const step = STEP_CODES[r.step] ?? (t < p1.duration ? 50 : 100);
    // aktualne predkosci osi jak HMI2.f[XYZA]ActualVelocity: mm/s (°/s) * 60 / 1000
    const h = 0.02;
    const r0 = at(Math.max(0, t - h)).pose;
    const actVel = Object.fromEntries(['x', 'y', 'z', 'a'].map((ax) => [`${ax}ActVel`, t >= h ? (r.pose[ax] - r0[ax]) / h * 0.06 : 0]));
    // przyspieszenia jak w PLC: fMaxVelocityJog* / czasy Tacc (dynamika testowa)
    const accVars = { maxJogX: 500, autoTaccX: 500 / dyn.fastAcc, maxJogZ: 200, autoTaccZ: 200 / dyn.zAcc,
      maxJogA: 600, taccA: Math.max(5, 600 / dyn.aAcc), maxJogB: 600, taccB: 600 / dyn.bAcc };
    // HMI2.fX/Y/ZActualPosition - punkt narzedzia jak Settings/ActualPosition w PLC
    const ap = plcActualPosition(r.pose, m);
    // ekran Predkosc: maksima (mm/s, Hz), predkosc frezu, silnik glowny, glebokosc ciecia
    const speedVars = { millVel: dyn.cutVel, mainDriveHz: 50, maxMainDriveHz: 200, maxFastVel: 333.3, maxSawVel: 166.6, maxMillVel: 33.3,
      maxZUpVel: 50, maxZVel: 50, advancedDesktop: false, cutDepth: ap.z - m.materialHeight, aFixed: r.pose.a };
    return {
      ...hmiValues(),
      // #155 HMI2.aAlarms (alarm n = [n - 1]): cisnienie powietrza (8) przez pierwsze 10 s kazdych 20 s, Aktywny Alarm (24) z nim
      alarms: Array.from({ length: 200 }, (_, i) => (i === 7 || i === 23) && t % 20 < 10),
      ...r.pose, toolX: ap.x, toolY: ap.y, toolZ: ap.z, ...actVel, ...accVars, ...speedVars, ...m, ...dyn, ...AREA, ...PROGRAM, ...flags, ...g54Values(m), systemBased: true, progCutIndex: Math.floor(t / 6) % (PROG_ROWS.length - 1),
      cutStep: step, cutStart: step !== 100, sawRunning: step !== 100, waterCut: mode === 'saw' && (step === 20 || step === 50 || step === 60),
      waterMill: mode !== 'saw' && step !== 100,      // yWaterMill - frez, wiercenie, polerowanie
      // laser przy cieciu, naped tarczy 50 Hz (0.01 Hz jak falownik) FWD w trakcie programu
      laser: step === 50 || step === 60, sawFreq: step !== 100 ? 5000 : 0, sawFwd: step !== 100, sawRev: false,
    };
  };
}

// G54 testowego PLC: naroznik kamienia + 400 / 600, Z - czolo frezu na gornej powierzchni (B 90)
export const cncG54 = (m) => ({ x: 700, y: 900, z: plcToolAxisZ(0, 90, m) });
const g54Values = (m) => { const g = cncG54(m); return { g54X: g.x, g54Y: g.y, g54Z: g.z }; };

export async function startFakePlc(port, mode = 'saw') {
  const server = new OPCUAServer({
    port,
    resourcePath: '',
    allowAnonymous: true,
    securityModes: [MessageSecurityMode.None],
    securityPolicies: [SecurityPolicy.None],
    buildInfo: { productName: 'VizuApp fake PLC' },
    // jak CODESYS (SoftMotion Win 3.5.18): najwyzej 100 wezlow w jednym Read - wiekszy konczy sie BadTooManyOperations
    serverCapabilities: { operationLimits: { maxNodesPerRead: 100, maxNodesPerBrowse: 100 } },
  });
  await server.initialize();
  const space = server.engine.addressSpace;
  const ns = space.registerNamespace(NAMESPACE);
  const obj = (parent, name) => ns.addObject({ componentOf: parent, browseName: name });
  const deviceSet = ns.addObject({ organizedBy: space.rootFolder.objects, browseName: 'DeviceSet' });
  const globalVars = obj(obj(obj(obj(deviceSet, DEVICE), 'Resources'), 'Application'), 'GlobalVars');
  const timeline = plcTimeline(mode);
  const t0 = Date.now();
  let cache = { at: -1, values: null };
  const values = () => {
    const now = Date.now();
    if (cache.at !== now) cache = { at: now, values: timeline((now - t0) / 1000) };
    return cache.values;
  };
  const gvls = {};
  // zapis z OPC UA (panel HMI): wartosc zapisana zastepuje wartosc z przebiegu
  const overrides = {};
  const panel = {};
  for (const [key, varPath] of Object.entries(VARIABLES)) {
    // "GVL.zmienna" albo "GVL.struktura.pole" - struktura jako obiekt (jak w CODESYS)
    const parts = varPath.split('.');
    const name = parts.pop();
    let parent = globalVars;
    for (let i = 0; i < parts.length; i++) {
      const key2 = parts.slice(0, i + 1).join('.');
      gvls[key2] ??= obj(parent, parts[i]);
      parent = gvls[key2];
    }
    const svcType = key.startsWith('hmi:') ? (SERVICE_SCREEN_VARS[varPath] ?? (/^HMI\.bService/.test(varPath) ? 'BOOL' : null)) : null;
    const type = svcType ? DataType[SVC_TYPES[svcType] ?? 'Double']
      : BOOLS.has(key) ? DataType.Boolean : INTS.has(key) ? DataType.Int16 : DataType.Double;
    const array = ARRAYS[key] ?? HMI_ARRAY_LEN[svcType];
    const value = () => {
      const v = key in overrides ? overrides[key] : values()[key];
      if (type === DataType.String) {
        return array ? new Variant({ dataType: type, arrayType: VariantArrayType.Array, value: v.map(String) }) : new Variant({ dataType: type, value: String(v ?? '') });
      }
      if (array && type === DataType.Boolean) return new Variant({ dataType: type, arrayType: VariantArrayType.Array, value: v.map(Boolean) });
      if (array) return new Variant({ dataType: type, arrayType: VariantArrayType.Array, value: (type === DataType.Int16 ? Int16Array : Float64Array).from(v) });
      return new Variant({ dataType: type, value: type === DataType.Boolean ? Boolean(v) : Number(v) });
    };
    ns.addVariable({
      componentOf: parent,
      browseName: name,
      nodeId: `s=|var|${DEVICE}.Application.${varPath}`,
      dataType: type,
      ...(array ? { valueRank: 1, arrayDimensions: [array] } : {}),
      minimumSamplingInterval: 50,
      value: { get: value, set: (variant) => { overrides[key] = variant.value; return StatusCodes.Good; } },
    });
  }
  const known = new Set(Object.values(VARIABLES));
  for (const p of panelVars()) {
    if (known.has(p)) continue;
    const type = panelType(p);
    panel[p] = panelDefault(type);
    ns.addVariable({
      componentOf: globalVars,
      browseName: p,
      nodeId: `s=|var|${DEVICE}.Application.${p}`,
      dataType: type,
      minimumSamplingInterval: 50,
      value: {
        get: () => new Variant({ dataType: type, value: panel[p] }),
        set: (variant) => { panel[p] = variant.value; return StatusCodes.Good; },
      },
    });
  }
  await server.start();
  return { server, nsIndex: ns.index, panel, overrides, stop: () => server.shutdown(0) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values: args } = parseArgs({ options: { port: { type: 'string', default: '4840' }, mode: { type: 'string', default: 'saw' } } });
  const port = Number(args.port);
  await startFakePlc(port, args.mode);
  console.log(`Testowy serwer OPC UA (udaje CODESYS): opc.tcp://localhost:${port}, tryb ${args.mode}`);
}
