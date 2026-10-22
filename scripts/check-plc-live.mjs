// Sprawdzenie podpiecia zmiennych na prawdziwym sterowniku (tylko odczyt OPC UA, nic nie zapisuje):
//
//   node scripts/check-plc-live.mjs opc.tcp://<IP sterownika>:4840 [--user <login> --password <haslo>]
//
// 1. kazda zmienna z src/shared/config.js (VARIABLES) - wezel w OPC UA, typ danych, wartosc;
// 2. pozycja punktu narzedzia liczona przez Visu3D z osi (fX/Y/ZRealPosition, A, B, parametry glowicy) w porownaniu
//    z HMI2.fX/Y/ZActualPosition z PLC (Settings/ActualPosition) - roznica > 0,1 mm oznacza inna geometrie;
// 3. predkosci osi z PLC (f[XYZA]ActualVelocity) i fBActualVelocity (w PLC liczona z osi A).
// Kod wyjscia 1 - brakujace zmienne albo niezgodna geometria.

import { parseArgs } from 'node:util';
import { OpcUaSource } from '../src/server/opcua-source.js';
import { VARIABLES, MACHINE_KEYS, DEFAULTS, plcDynamics } from '../src/shared/config.js';
import { machine, plcActualPosition } from '../src/shared/geometry.js';
import { modeFromValues } from '../src/shared/tools.js';

const { values: args, positionals: [endpoint] } = parseArgs({
  options: { user: { type: 'string' }, password: { type: 'string' }, timeout: { type: 'string', default: '20' } }, allowPositionals: true,
});
if (!endpoint) { console.log('Użycie: node scripts/check-plc-live.mjs opc.tcp://<IP>:4840 [--user u --password p]'); process.exit(2); }

const source = new OpcUaSource({ ...DEFAULTS, endpoint, username: args.user || '', password: args.password || '', variables: VARIABLES, pollMs: 100, slowEvery: 1 });
source.on('status', (s) => console.log(`[OPC UA] ${s.status}`));
source.start();

const deadline = Date.now() + Number(args.timeout) * 1000;
while (Date.now() < deadline && !(source.connected && Object.keys(source.values).length)) await new Promise((r) => setTimeout(r, 200));
// drugi odczyt (wolne zmienne, typy)
await new Promise((r) => setTimeout(r, 1500));
await source.stop();
if (!source.connected && !Object.keys(source.values).length) { console.log('Brak połączenia ze sterownikiem'); process.exit(1); }

let bad = 0;
console.log('\nZmienne:');
for (const v of source.variablesReport()) {
  if (!v.found) bad++;
  console.log(`${v.found ? 'OK  ' : 'BRAK'} ${v.key.padEnd(20)} ${v.name.padEnd(36)} ${String(v.dataType ?? '').padEnd(10)} ${v.value ?? ''}`);
}

const v = source.values;
const pose = { x: v.x, y: v.y, z: v.z, a: v.a, b: v.b };
const mode = modeFromValues(v) || 'saw';
const m = machine({ ...DEFAULTS.offline.machine, ...Object.fromEntries(MACHINE_KEYS.filter((k) => typeof v[k] === 'number').map((k) => [k, v[k]])), mode });
console.log(`\nTryb: ${mode}, osie (Real): X ${pose.x} Y ${pose.y} Z ${pose.z} A ${pose.a} B ${pose.b}`);
if (['x', 'y', 'z', 'a', 'b', 'toolX', 'toolY', 'toolZ'].every((k) => typeof v[k] === 'number')) {
  const ap = plcActualPosition(pose, m);
  const d = { x: ap.x - v.toolX, y: ap.y - v.toolY, z: ap.z - v.toolZ };
  const ok = Math.max(...Object.values(d).map(Math.abs)) <= 0.1;
  if (!ok) bad++;
  console.log(`Punkt narzędzia Visu3D: X ${ap.x.toFixed(2)} Y ${ap.y.toFixed(2)} Z ${ap.z.toFixed(2)}`);
  console.log(`fX/Y/ZActualPosition:  X ${v.toolX.toFixed(2)} Y ${v.toolY.toFixed(2)} Z ${v.toolZ.toFixed(2)}`);
  console.log(`${ok ? 'OK  ' : 'BŁĄD'} różnica X ${d.x.toFixed(3)} Y ${d.y.toFixed(3)} Z ${d.z.toFixed(3)} mm`
    + (ok ? '' : ' (fStatusAxisTiltCorrection / bServiceBladeWidthTilt w Z przy wychyle, albo inne parametry głowicy)'));
} else {
  bad++;
  console.log('BŁĄD brak pozycji osi albo fX/Y/ZActualPosition - nie można porównać geometrii');
}
console.log(`\nPrędkości z PLC [m/min]: X ${v.xActVel} Y ${v.yActVel} Z ${v.zActVel}, A ${v.aActVel} (°/s × 0,06); B - z różnicy pozycji (fBActualVelocity w PLC z osi A)`);
const dyn = plcDynamics(v);
console.log(`Dynamika (mm/s, mm/s²): ${Object.entries(dyn).map(([k, x]) => `${k} ${x.toFixed(2)}`).join(', ')}`);
console.log(bad ? `\n${bad} problem(ów)` : '\nWszystkie zmienne podpięte, geometria zgodna z PLC');
process.exit(bad ? 1 : 0);
