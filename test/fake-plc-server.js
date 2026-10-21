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
import { Variant, DataType, MessageSecurityMode, SecurityPolicy } from 'node-opcua-client';
import { VARIABLES, DEFAULTS } from '../src/shared/config.js';
import { machine } from '../src/shared/geometry.js';
import { cutProgram, depthTable } from '../src/shared/motion.js';

export const NAMESPACE = 'CODESYSSPV3/3S/IecVarAccess';
export const DEVICE = 'AX-8';
const BOOLS = new Set(['cutStart', 'sawRunning', 'waterCut']);
const STEP_CODES = { MoveToStartPosition: 10, StartCutDepth: 20, StartSingleCut: 50, StartLastCut: 60, StartMoveAboveMaterial: 70, CutFinish: 100 };

// Petla dwoch ciec (proste i z wychylem) - wartosci wszystkich zmiennych w czasie t [s]
export function plcTimeline() {
  const m = machine(DEFAULTS.offline.machine);
  const dyn = { ...DEFAULTS.offline.dynamics, cutVel: 150, cutAcc: 300, cutDec: 300 };   // szybciej - krotki test
  const p1 = cutProgram({ x: 0, y: 0, z: 0, a: 0, b: 0 }, { x0: 200, y0: 300, x1: 1000, y1: 300, b: 0, above: 20, depths: depthTable(30, 2) }, m, dyn);
  const p2 = cutProgram(p1.at(p1.duration).pose, { x0: 300, y0: 450, x1: 900, y1: 800, b: 45, above: 20, depths: depthTable(24, 2) }, m, dyn);
  const period = p1.duration + p2.duration;
  return (t) => {
    t %= period;
    const r = t < p1.duration ? p1.at(t) : p2.at(t - p1.duration);
    const step = STEP_CODES[r.step];
    return {
      ...r.pose, ...m, ...dyn,
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
    const type = BOOLS.has(key) ? DataType.Boolean : key === 'cutStep' ? DataType.Int16 : DataType.Double;
    ns.addVariable({
      componentOf: gvls[gvl],
      browseName: name,
      nodeId: `s=|var|${DEVICE}.Application.${varPath}`,
      dataType: type,
      minimumSamplingInterval: 50,
      value: { get: () => new Variant({ dataType: type, value: type === DataType.Boolean ? Boolean(values()[key]) : Number(values()[key]) }) },
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
