// Testowy serwer OPC UA udajacy sterownik boczkarki (CODESYS Control Win V3 x64 SoftMotion) - bez PLC.
//
// Drzewo jak w CODESYS: Objects/DeviceSet/<urzadzenie>/Resources/Application/GlobalVars/<GVL>/<zmienna>
// (pola struktur jako obiekty), NodeId "|var|<urzadzenie>.Application.<sciezka>". Wartosci z symulatora
// (src/shared/simulator.js) - ta sama sekwencja co PLC. Zapis zmiennych sterowania (PLC_WRITES) dziala jak w PLC:
// EdgeProfile.Start / Pause / Stop, Alarms.Reset, Machine.ModeRequest, HomingProcess.Start.
//
//   node test/fake-plc-server.js [--port 4840] [--auto]      --auto: cykle receptury jeden po drugim
//   potem: npm start  (strona: tryb Online, adres localhost:4840)

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { OPCUAServer } from 'node-opcua-server';
import { Variant, VariantArrayType, DataType, MessageSecurityMode, SecurityPolicy, StatusCodes } from 'node-opcua-client';
import { VARIABLES, PLC_WRITES, STEP, DEFAULTS } from '../src/shared/config.js';
import { EdgeSimulator } from '../src/shared/simulator.js';
import { defaultRecipes } from '../src/shared/edgeprofile.js';

export const NAMESPACE = 'CODESYSSPV3/3S/IecVarAccess';
export const DEVICE = 'CODESYS SoftMotion Win V3 x64';
const MAX_ALARMS = 32;

const BOOLS = new Set(['xHomed', 'bHomed', 'simulation', 'safetyOk', 'directionPositive', 'cycleBothDirections', 'spindleRunning', 'water', 'clamp', 'alarmAny']);
const INTS = new Set(['mode', 'step', 'passIndex', 'repeatIndex', 'passCount', 'cycleKind', 'cycleRepeats', 'activeKind', 'activeRepeats']);
const STRINGS = new Set(['cycleName', 'activeName']);

// Model PLC: symulator + receptura robocza + stan trybu i alarmow
export function createModel({ auto = false } = {}) {
  const recipes = defaultRecipes();
  const sim = new EdgeSimulator({ ...DEFAULTS.offline });
  const m = { sim, active: { ...recipes[4], xStart: 200, xEnd: 1600 }, mode: 2, alarms: Array(MAX_ALARMS).fill(false), auto, last: Date.now() };
  m.tick = () => {
    const now = Date.now();
    sim.tick(Math.min(0.2, (now - m.last) / 1000));
    m.last = now;
    if (m.auto && sim.step === STEP.WaitForStart) sim.start({ ...m.active });
    m.alarms[13] = sim.step === STEP.WaitForCommand && sim.error > 0;	// alarm 14: receptura
  };
  m.values = () => {
    const s = sim.state();
    const p = sim.profile ?? m.active;
    const a = m.active;
    return {
      ...s, mode: m.mode, cycles: s.cycles, alarms: m.alarms, alarmAny: m.alarms.some(Boolean), spindleCurrent: s.spindleRunning ? 9 + s.spindleFrequency * 0.12 + (s.clamp ? 6 : 0) : 0,
      timeRemaining: 0, cycleTimeEstimate: 0, progress: s.passCount ? ((s.passIndex - 1) / s.passCount) * 100 : 0,
      cycleName: p.name, cycleKind: p.kind, cycleXStart: p.xStart, cycleXEnd: p.xEnd, cycleOvertravel: p.overtravel, cycleAngle: p.angle,
      cycleAngleStart: p.angleStart, cycleAngleEnd: p.angleEnd, cycleAngleStep: p.angleStep, cycleRepeats: p.repeats, cycleBothDirections: p.bothDirections,
      activeName: a.name, activeKind: a.kind, activeXStart: a.xStart, activeXEnd: a.xEnd, activeOvertravel: a.overtravel, activeAngle: a.angle,
      activeAngleStart: a.angleStart, activeAngleEnd: a.angleEnd, activeAngleStep: a.angleStep, activeRepeats: a.repeats,
      passTarget: s.directionPositive ? p.xEnd + p.overtravel : p.xStart - p.overtravel,
    };
  };
  // zapis zmiennej sterowania (jak programy PLC: rozkaz chwilowy kasowany przez PLC)
  m.write = (v, value) => {
    if (v === 'EdgeProfile.Start' && value) sim.start({ ...m.active });
    else if (v === 'EdgeProfile.Pause' && value) sim.pause();
    else if (v === 'EdgeProfile.Stop' && value) sim.stop();
    else if (v === 'Alarms.Reset' && value) { sim.acknowledge(); m.alarms.fill(false); }
    else if (v === 'Machine.ModeRequest') m.mode = Number(value);
    else if (v === 'Recipes.Index') m.recipe = Number(value);
    else if (v === 'Recipes.Load' && value && recipes[(m.recipe || 1) - 1]) m.active = { ...recipes[m.recipe - 1], xStart: 200, xEnd: 1600 };
  };
  return m;
}

function variant(type, v) {
  if (type === DataType.String) return new Variant({ dataType: type, value: String(v ?? '') });
  if (Array.isArray(v)) return new Variant({ dataType: type, arrayType: VariantArrayType.Array, value: v.map(Boolean) });
  return new Variant({ dataType: type, value: type === DataType.Boolean ? Boolean(v) : Number(v) || 0 });
}

export async function startFakePlc(port, { auto = false } = {}) {
  const server = new OPCUAServer({
    port, resourcePath: '', allowAnonymous: true,
    securityModes: [MessageSecurityMode.None], securityPolicies: [SecurityPolicy.None],
    buildInfo: { productName: 'Boczkarka fake PLC' },
    serverCapabilities: { operationLimits: { maxNodesPerRead: 100, maxNodesPerBrowse: 100 } },
  });
  await server.initialize();
  const space = server.engine.addressSpace;
  const ns = space.registerNamespace(NAMESPACE);
  const obj = (parent, name) => ns.addObject({ componentOf: parent, browseName: name });
  const deviceSet = ns.addObject({ organizedBy: space.rootFolder.objects, browseName: 'DeviceSet' });
  const globalVars = obj(obj(obj(obj(deviceSet, DEVICE), 'Resources'), 'Application'), 'GlobalVars');
  const model = createModel({ auto });
  const timer = setInterval(model.tick, 20);
  let cache = { at: -1, values: null };
  const values = () => {
    const now = Date.now();
    if (cache.at !== now) cache = { at: now, values: model.values() };
    return cache.values;
  };
  const folders = {};
  const parentOf = (varPath) => {
    const parts = varPath.split('.');
    parts.pop();
    let parent = globalVars;
    for (let i = 0; i < parts.length; i++) {
      const k = parts.slice(0, i + 1).join('.');
      folders[k] ??= obj(parent, parts[i]);
      parent = folders[k];
    }
    return parent;
  };
  const add = (varPath, type, get, set, array) => ns.addVariable({
    componentOf: parentOf(varPath), browseName: varPath.split('.').pop(),
    nodeId: `s=|var|${DEVICE}.Application.${varPath}`, dataType: type,
    ...(array ? { valueRank: 1, arrayDimensions: [array] } : {}),
    minimumSamplingInterval: 50,
    value: { get, set },
  });
  for (const [key, varPath] of Object.entries(VARIABLES)) {
    const type = key === 'alarms' ? DataType.Boolean : BOOLS.has(key) ? DataType.Boolean : INTS.has(key) ? DataType.Int16
      : STRINGS.has(key) ? DataType.String : key === 'cycles' ? DataType.UInt32 : DataType.Double;
    add(varPath, type, () => variant(type, values()[key]), () => StatusCodes.BadNotWritable, key === 'alarms' ? MAX_ALARMS : 0);
  }
  const written = {};
  for (const [varPath, w] of Object.entries(PLC_WRITES)) {
    if (Object.values(VARIABLES).includes(varPath)) continue;
    const type = /ModeRequest|Index$/.test(varPath) ? DataType.Int16 : DataType.Boolean;
    written[varPath] = type === DataType.Boolean ? false : 0;
    add(varPath, type, () => variant(type, written[varPath]), (vr) => {
      // rozkazy chwilowe (Start / Stop / Pause / Reset) PLC kasuje sam - tu: wykonanie i FALSE
      model.write(varPath, vr.value);
      written[varPath] = w.kind === 'mom' || type !== DataType.Boolean ? vr.value : false;
      return StatusCodes.Good;
    });
  }
  await server.start();
  return { server, model, stop: async () => { clearInterval(timer); await server.shutdown(0); } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values: args } = parseArgs({ options: { port: { type: 'string', default: '4840' }, auto: { type: 'boolean', default: false } } });
  const port = Number(args.port);
  await startFakePlc(port, { auto: args.auto });
  console.log(`Testowy serwer OPC UA boczkarki (udaje CODESYS): opc.tcp://localhost:${port}${args.auto ? ', cykle automatyczne' : ''}`);
}
