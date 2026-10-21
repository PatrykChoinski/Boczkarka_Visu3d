// Sprawdzenie podpiecia zmiennych (tryb PLC): kazda zmienna z src/shared/config.js (VARIABLES) musi byc w konfiguracji
// symboli PLC (plik <projekt>.Device.Application.xml z kompilacji, SupportOPCUA) - inaczej serwer OPC UA jej nie poda.
//
//   node scripts/check-plc-symbols.mjs <plik symboli .xml> [kolejny .xml ...]
//   (repo glowne: PLC/PilaJednosuportowa.Device.Application.xml, PLC/PilaJednosuportowaAI.Device.Application.xml)
//
// Wypisuje typ IEC kazdej zmiennej i sprawdza rodzaj (BOOL dla flag, tablice, liczby); kod wyjscia 1 - braki / zly typ.

import fs from 'node:fs';
import { VARIABLES } from '../src/shared/config.js';

// Oczekiwany rodzaj wartosci w aplikacji: bool, array albo liczba (num, w tym enumy i WORD)
const BOOL_KEYS = /^(mode|systemBased|cutStart|sawRunning|sawFwd|sawRev|water|laser|prog(Mill|Cut|Prof)Start|progOuterInner|smoothingArrays)/;
const ARRAY_KEYS = /^(board[XYZ]|rock[XYZ]|prog(X|Y|Step|Radius|Angle|Depth|DepthEnd|Length|OutIn))$/;
const expected = (k) => (ARRAY_KEYS.test(k) ? 'array' : BOOL_KEYS.test(k) ? 'bool' : 'num');

function parse(xml) {
  const types = {};
  for (const m of xml.matchAll(/<TypeSimple name="([^"]+)"[^>]*iecname="([^"]+)"/g)) types[m[1]] = { kind: 'simple', iec: m[2] };
  for (const m of xml.matchAll(/<TypeArray ([^>]*)>/g)) {
    const attr = (n) => new RegExp(`${n}="([^"]+)"`).exec(m[1])?.[1];
    types[attr('name')] = { kind: 'array', base: attr('basetype'), iec: attr('iecname') };
  }
  for (const m of xml.matchAll(/<TypeUserDef name="([^"]+)"[^>]*iecname="([^"]+)"[^>]*>([\s\S]*?)<\/TypeUserDef>/g)) {
    const els = Object.fromEntries([...m[3].matchAll(/<UserDefElement iecname="([^"]+)" type="([^"]+)"/g)].map((e) => [e[1], e[2]]));
    types[m[1]] = { kind: Object.keys(els).length ? 'struct' : 'enum', iec: m[2], els };
  }
  for (const m of xml.matchAll(/<TypeEnum name="([^"]+)"[^>]*iecname="([^"]+)"/g)) types[m[1]] = { kind: 'enum', iec: m[2] };
  // wezly: sciezka z zagniezdzenia <Node name=...>
  const syms = {};
  const stack = [];
  for (const m of xml.matchAll(/<Node name="([^"]+)"([^>]*?)(\/?)>|<\/Node>/g)) {
    if (m[0] === '</Node>') { stack.pop(); continue; }
    const path = [...stack, m[1]].join('.');
    const t = /type="([^"]+)"/.exec(m[2]);
    if (t) syms[path] = t[1];
    if (!m[3]) stack.push(m[1]);
  }
  return { types, syms };
}

function lookup({ types, syms }, name) {
  const parts = name.split('.');
  for (let i = parts.length; i > 0; i--) {
    let t = syms[['Application', ...parts.slice(0, i)].join('.')];
    if (!t) continue;
    for (const p of parts.slice(i)) {
      const ty = types[t];
      if (!ty || ty.kind !== 'struct' || !ty.els[p]) return null;
      t = ty.els[p];
    }
    return types[t] ?? { kind: 'simple', iec: t };
  }
  return null;
}

const files = process.argv.slice(2);
if (!files.length) { console.log('Użycie: node scripts/check-plc-symbols.mjs <plik symboli .xml> [...]'); process.exit(2); }
let bad = 0;
for (const f of files) {
  const sym = parse(fs.readFileSync(f, 'utf8'));
  console.log(`\n${f}`);
  for (const [k, name] of Object.entries(VARIABLES)) {
    const t = lookup(sym, name);
    const exp = expected(k);
    let ok = Boolean(t);
    if (t) {
      const kind = t.kind === 'array' ? 'array' : t.iec === 'BOOL' ? 'bool' : 'num';
      ok = kind === exp;
    }
    if (!ok) bad++;
    console.log(`${ok ? 'OK  ' : 'BŁĄD'} ${k.padEnd(20)} ${name.padEnd(40)} ${t ? t.iec : 'brak w symbol configu'}${ok ? '' : `  (oczekiwane: ${exp})`}`);
  }
}
console.log(bad ? `\n${bad} problem(ów)` : '\nWszystkie zmienne są w symbol configu, typy zgodne');
process.exit(bad ? 1 : 0);
