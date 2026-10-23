// Sterowanie maszyna z Visu3D (tryb PLC): zapis zmiennych PLC przez OPC UA tak jak elementy ekranow HMI.
//
// Dozwolone sa tylko zmienne zapisywane przez elementy ekranow HMI (src/server/hmiwrites.json, scripts/gen-hmi-writes.py),
// z poziomem ekranu: ekrany pracy - Operator (1), ekrany serwisowe - Serwis (2). STOP i PAUZA (przyciski "stop" / "pauza") -
// bez logowania. Bez users.json zapis tylko z komputera z VizuApp (panel maszyny); tablet - po zalogowaniu.
//
// Przycisk chwilowy (Momentary, np. jog X+): POST /api/plc/hold {v, on: true} co 200 ms, dopoki przycisk wcisniety;
// bez odswiezenia przez HOLD_MS serwer sam zapisuje FALSE (zerwane polaczenie z tabletem nie zostawia jazdy).
//
// POST /api/plc/write {items: [{v, value}]}   zapis (Set / Reset / pole liczbowe / lista / przelacznik)
// POST /api/plc/hold  {v, on}                 przycisk chwilowy
// POST /api/plc/watch {cid, keys, paths}      subskrypcja zmiennych otwartego ekranu (SSE: {values}, {hmi})

import fs from 'node:fs';

export const HOLD_MS = 700;
const MAX_WATCH = 400;
const BUTTONS = new Set(['seton', 'mom', 'maint', 'setc', 'mstate']);
// zatrzymanie maszyny / ruchu - zawsze dozwolone (bez logowania)
const STOP_VAR = /(^|\.)b\w*(Stop|Pause)\w*$|\.(stop|pause)Button\.button$/i;

// Zmienne zapisywane w HMI makrami (generator ich nie widzi): kreator figur (FiguresGeometricSt) i bufor programu
// automatu (makro kopiuje aFigure* do aProgram*, jak GetDemoProgram w PLC) - poziom Operator
export const MACRO_WRITES = ['HMI2.iFigureType', 'HMI2.bFigureAddToCurrent', 'HMI2.bFigureCalculated',
  'HMI2.aProgramXPosition', 'HMI2.aProgramYPosition', 'HMI2.aProgramNextStep', 'HMI2.aProgramRadius', 'HMI2.aProgramAngle',
  'HMI2.aProgramDepth', 'HMI2.aProgramDepthEnd', 'HMI2.aProgramLength', 'HMI2.aProgramOutIn',
  'HMI2.iProgramCutNumber', 'HMI2.iProgramProfilesNumber', 'HMI2.iProgramMillNumber'];
export const MACRO_READS = ['HMI2.aFigureXPosition', 'HMI2.aFigureYPosition', 'HMI2.aFigureIndex', 'HMI2.aFigureRadius',
  'HMI2.aFigureAngle', 'HMI2.aFigureDepthStart', 'HMI2.aFigureDepthEnd', 'HMI2.aFigureLength', 'HMI2.iFigureNumber'];

// Dostep z listy HMI (src/server/hmiwrites.json, scripts/gen-hmi-writes.py): {write: {zmienna: {level, kinds}}, read};
// STOP / PAUZA (przyciski) - poziom 0
export function hmiAccess(data) {
  const write = {};
  for (const [v, w] of Object.entries(data?.write || {})) {
    const kinds = new Set(w.kinds);
    const stop = STOP_VAR.test(v) && !/\.bService/.test(v) && [...kinds].some((k) => BUTTONS.has(k));
    write[v] = { level: stop ? 0 : w.level, kinds };
  }
  for (const v of MACRO_WRITES) write[v] ??= { level: 1, kinds: new Set(['macro']) };
  return { write, read: new Set([...(data?.read || []), ...Object.keys(write), ...MACRO_READS]) };
}

export function loadHmiWrites(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { write: {}, read: [] }; }
}

export class PlcControl {
  constructor(source, data, { log = console.log } = {}) {
    this.source = source;
    this.access = hmiAccess(data);
    this.log = log;
    this.holds = new Map();    // zmienna -> {until, who}
    this.timer = setInterval(() => this.tick(), 100);
    this.timer.unref?.();
  }

  close() { clearInterval(this.timer); }

  // wymagany poziom dostepu do zapisu zmiennej albo null (zmienna spoza ekranow HMI)
  levelFor(v) {
    const base = String(v);
    return this.access.write[base]?.level ?? null;
  }

  check(v, level) {
    const need = this.levelFor(v);
    if (need === null) return `${v}: zmiennej nie zapisuje żaden ekran HMI`;
    if (level < need) return need >= 2 ? `${v}: zapis od poziomu Serwis` : 'Zaloguj się, żeby sterować maszyną';
    return null;
  }

  async write(items, who, level) {
    if (!Array.isArray(items) || !items.length || items.length > 100) throw Object.assign(new Error('zła lista zmiennych'), { code: 400 });
    for (const it of items) {
      const err = this.check(it?.v, level);
      if (err) throw Object.assign(new Error(err), { code: 403 });
    }
    await this.source.write(items.map((it) => ({ v: it.v, value: it.value })));
    this.log(`[PLC] ${who}: ${items.map((it) => `${it.v} := ${JSON.stringify(it.value)}`).join(', ')}`);
  }

  async hold(v, on, who, level) {
    const err = this.check(v, level);
    if (err) throw Object.assign(new Error(err), { code: 403 });
    if (!this.access.write[v].kinds.has('mom')) throw Object.assign(new Error(`${v}: to nie jest przycisk chwilowy`), { code: 400 });
    if (on) {
      const fresh = !this.holds.has(v);
      this.holds.set(v, { until: Date.now() + HOLD_MS, who });
      if (fresh) {
        try {
          await this.source.write([{ v, value: true }]);
          this.log(`[PLC] ${who}: ${v} wciśnięty`);
        } catch (e) { this.holds.delete(v); throw e; }
      }
    } else {
      await this.release(v, 'puszczony');
    }
  }

  async release(v, why) {
    const h = this.holds.get(v);
    this.holds.delete(v);
    try {
      await this.source.write([{ v, value: false }]);
      if (h) this.log(`[PLC] ${h.who}: ${v} ${why}`);
    } catch (e) {
      // ponowienie w nastepnym cyklu - przycisk nie moze zostac wcisniety
      this.holds.set(v, { until: 0, who: h?.who ?? '?' });
      throw e;
    }
  }

  tick() {
    const now = Date.now();
    for (const [v, h] of this.holds) if (h.until < now) this.release(v, 'puszczony (brak potwierdzenia z panelu)').catch(() => {});
  }

  // Pelne sciezki zmiennych z samych nazw (np. etykiety pol figur: "fFigureLength" -> "HMI2.fFigureLength",
  // "aPolygonX[3]" -> "HMI.aPolygonX[3]") - z listy zmiennych zapisywanych przez HMI
  resolve(names) {
    const base = new Map();
    for (const v of Object.keys(this.access.write)) {
      const short = v.split('.').pop().replace(/\[\d+\]$/, '');
      if (!base.has(short)) base.set(short, v.slice(0, v.length - v.split('.').pop().length));
    }
    const out = {};
    for (const n of Array.isArray(names) ? names.slice(0, 500) : []) {
      const m = /^([A-Za-z_]\w*)(\[\d+\])?$/.exec(String(n));
      if (m && base.has(m[1])) out[n] = base.get(m[1]) + n;
    }
    return out;
  }

  // Subskrypcja zmiennych otwartego ekranu klienta (cid): keys - klucze konfiguracji, paths - zmienne z listy HMI
  watch(cid, keys, paths) {
    if (!cid || typeof cid !== 'string' || cid.length > 64) throw Object.assign(new Error('brak identyfikatora strony (cid)'), { code: 400 });
    const p = (Array.isArray(paths) ? paths : []).filter((v) => this.access.read.has(v)).slice(0, MAX_WATCH);
    const k = (Array.isArray(keys) ? keys : []).filter((x) => typeof x === 'string').slice(0, MAX_WATCH);
    return this.source.watch(cid, { keys: k, paths: p });
  }
}
