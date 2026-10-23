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
// POST /api/plc/watch {vars: [...]}           zmienne otwartego formularza (odczyt w strumieniu SSE: {hmi})

import fs from 'node:fs';

export const HOLD_MS = 700;
const MAX_WATCH = 400;
const BUTTONS = new Set(['seton', 'mom', 'maint', 'setc', 'mstate']);
// zatrzymanie maszyny / ruchu - zawsze dozwolone (bez logowania)
const STOP_VAR = /(^|\.)b\w*(Stop|Pause)\w*$|\.(stop|pause)Button\.button$/i;

// Dostep z listy HMI (src/server/hmiwrites.json, scripts/gen-hmi-writes.py): {write: {zmienna: {level, kinds}}, read};
// STOP / PAUZA (przyciski) - poziom 0
export function hmiAccess(data) {
  const write = {};
  for (const [v, w] of Object.entries(data?.write || {})) {
    const kinds = new Set(w.kinds);
    const stop = STOP_VAR.test(v) && !/\.bService/.test(v) && [...kinds].some((k) => BUTTONS.has(k));
    write[v] = { level: stop ? 0 : w.level, kinds };
  }
  return { write, read: new Set([...(data?.read || []), ...Object.keys(write)]) };
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

  // zmienne do odczytu: tylko zmienne z listy HMI
  watch(vars) {
    const list = (Array.isArray(vars) ? vars : []).filter((v) => this.access.read.has(v)).slice(0, MAX_WATCH);
    this.source.watchVars(list);
    return list.length;
  }
}
