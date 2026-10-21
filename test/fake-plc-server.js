// Testowy serwer OPC UA udajacy sterownik CODESYS (bez PLC).
//
// Drzewo jak w CODESYS: Objects/DeviceSet/AX-8/Resources/Application/GlobalVars/<GVL>/<zmienna>,
// NodeId "|var|AX-8.Application.<GVL>.<zmienna>"; pozycje osi z programu ciecia (tryb offline) w petli.
//
//   node test/fake-plc-server.js [--port 4840]     potem: npm start  (tryb Online)

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { OPCUAServer } from 'node-opcua-server';
import { Variant, VariantArrayType, DataType, MessageSecurityMode, SecurityPolicy } from 'node-opcua-client';
import { VARIABLES, DEFAULTS, dynamicsToInternal } from '../src/shared/config.js';
import { machine } from '../src/shared/geometry.js';
import { cutProgram, depthTable } from '../src/shared/motion.js';
import { MAX_APEX, rectangle } from '../src/shared/area.js';

export const NAMESPACE = 'CODESYSSPV3/3S/IecVarAccess';
export const DEVICE = 'AX-8';
const BOOLS = new Set(['cutStart', 'sawRunning', 'waterCut']);
const INTS = new Set(['cutStep', 'boardCount', 'rockCount']);
const ARRAYS = new Set(['boardX', 'boardY', 'boardZ', 'rockX', 'rockY', 'rockZ']);

// Stol 3500 x 3000 (Z 490 - gora materialu 450 przy grubosci 40, jak fCutMaterialHeight w WorkArea)
// i kamien - pieciokat (nie musi byc prostokatem); tablice [0..7] jak aCuttingBoard / aCuttingRock
const BOARD = rectangle(0, 0, 3500, 3000, 490);
const ROCK = [[100, 150, 450], [2600, 150, 450], [2900, 900, 450], [2200, 1700, 450], [100, 1700, 450]];
const column = (pts, i) => Array.from({ length: MAX_APEX }, (_, k) => (k < pts.length ? pts[k][i] : 0));
const AREA = {
  boardX: column(BOARD, 0), boardY: column(BOARD, 1), boardZ: column(BOARD, 2), boardCount: BOARD.length,
  rockX: column(ROCK, 0), rockY: column(ROCK, 1), rockZ: column(ROCK, 2), rockCount: ROCK.length,
};
const STEP_CODES = { MoveToStartPosition: 10, StartCutDepth: 20, StartSingleCut: 50, StartLastCut: 60, StartMoveAboveMaterial: 70, CutFinish: 100 };

// Petla dwoch ciec (proste i z wychylem) - wartosci wszystkich zmiennych w czasie t [s]
export function plcTimeline() {
  const m = machine(DEFAULTS.offline.machine);
  const dyn = { ...dynamicsToInternal(DEFAULTS.offline.dynamics), cutVel: 150, cutAcc: 300, cutDec: 300 };   // szybciej - krotki test
  const p1 = cutProgram({ x: 0, y: 0, z: 0, a: 0, b: 0 }, { x0: 200, y0: 300, x1: 1000, y1: 300, b: 0, above: 20, depths: depthTable(30, 2) }, m, dyn);
  const p2 = cutProgram(p1.at(p1.duration).pose, { x0: 300, y0: 450, x1: 900, y1: 800, b: 45, above: 20, depths: depthTable(24, 2) }, m, dyn);
  const period = p1.duration + p2.duration;
  return (t) => {
    t %= period;
    const r = t < p1.duration ? p1.at(t) : p2.at(t - p1.duration);
    const step = STEP_CODES[r.step];
    return {
      ...r.pose, ...m, ...dyn, ...AREA,
      cutStep: step, cutStart: step !== 100, sawRunning: step !== 100, waterCut: step === 20 || step === 50 || step === 60,
    };
  };
}

export async function startFakePlc(port) {
  const server = new OPCUAServer({
    port,
    resourcePath: '',
    allowAnonymous: true,
    securityModes: [MessageSecurityMode.None],
    securityPolicies: [SecurityPolicy.None],
    buildInfo: { productName: 'VizuApp fake PLC' },
  });
  await server.initialize();
  const space = server.engine.addressSpace;
  const ns = space.registerNamespace(NAMESPACE);
  const obj = (parent, name) => ns.addObject({ componentOf: parent, browseName: name });
  const deviceSet = ns.addObject({ organizedBy: space.rootFolder.objects, browseName: 'DeviceSet' });
  const globalVars = obj(obj(obj(obj(deviceSet, DEVICE), 'Resources'), 'Application'), 'GlobalVars');
  const timeline = plcTimeline();
  const t0 = Date.now();
  let cache = { at: -1, values: null };
  const values = () => {
    const now = Date.now();
    if (cache.at !== now) cache = { at: now, values: timeline((now - t0) / 1000) };
    return cache.values;
  };
  const gvls = {};
  for (const [key, varPath] of Object.entries(VARIABLES)) {
    const [gvl, name] = varPath.split('.');
    gvls[gvl] ??= obj(globalVars, gvl);
    const type = BOOLS.has(key) ? DataType.Boolean : INTS.has(key) ? DataType.Int16 : DataType.Double;
    const array = ARRAYS.has(key);
    const value = () => {
      const v = values()[key];
      if (array) return new Variant({ dataType: type, arrayType: VariantArrayType.Array, value: Float64Array.from(v) });
      return new Variant({ dataType: type, value: type === DataType.Boolean ? Boolean(v) : Number(v) });
    };
    ns.addVariable({
      componentOf: gvls[gvl],
      browseName: name,
      nodeId: `s=|var|${DEVICE}.Application.${varPath}`,
      dataType: type,
      ...(array ? { valueRank: 1, arrayDimensions: [MAX_APEX] } : {}),
      minimumSamplingInterval: 50,
      value: { get: value },
    });
  }
  await server.start();
  return { server, nsIndex: ns.index, stop: () => server.shutdown(0) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values: args } = parseArgs({ options: { port: { type: 'string', default: '4840' } } });
  const port = Number(args.port);
  await startFakePlc(port);
  console.log(`Testowy serwer OPC UA (udaje CODESYS): opc.tcp://localhost:${port}`);
}
