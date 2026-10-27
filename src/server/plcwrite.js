// Sterowanie boczkarka z Visu3D (tryb online): zapis zmiennych PLC przez OPC UA.
//
// Dozwolone tylko zmienne z PLC_WRITES (src/shared/config.js) z poziomem dostepu: STOP / PAUZA - zawsze (0),
// START, reset alarmow, tryb, bazowanie, jog - Operator (1). Bez users.json zapis tylko z komputera z VizuApp.
//
// Przycisk chwilowy (jog): POST /api/plc/hold {v, on: true} co 200 ms, dopoki przycisk wcisniety;
// bez odswiezenia przez HOLD_MS serwer sam zapisuje FALSE (zerwane polaczenie z tabletem nie zostawia jazdy).
//
// POST /api/plc/write {items: [{v, value}]}   zapis
// POST /api/plc/hold  {v, on}                 przycisk chwilowy
// POST /api/plc/watch {cid, keys, paths}      dodatkowe zmienne strony (SSE: {values}, {hmi})

import { PLC_WRITES } from '../shared/config.js';

export const HOLD_MS = 700;
const MAX_WATCH = 400;

// {write: {zmienna: {level, kinds}}, read} z listy PLC_WRITES
export function writeAccess(list = PLC_WRITES) {
  const write = {};
  for (const [v, w] of Object.entries(list)) write[v] = { level: w.level, kinds: new Set([w.kind]) };
  return { write, read: new Set(Object.keys(write)) };
}

export class PlcControl {
  constructor(source, list = PLC_WRITES, { log = console.log } = {}) {
    this.source = source;
    this.access = writeAccess(list ?? PLC_WRITES);
    this.log = log;
    this.holds = new Map();    // zmienna -> {until, who}
    this.timer = setInterval(() => this.tick(), 100);
    this.timer.unref?.();
  }

  close() { clearInterval(this.timer); }

  // wymagany poziom dostepu do zapisu zmiennej albo null (zmienna spoza PLC_WRITES)
  levelFor(v) {
    const base = String(v);
    return this.access.write[base]?.level ?? null;
  }

  check(v, level) {
    const need = this.levelFor(v);
    if (need === null) return `${v}: zmienna spoza listy sterowania (PLC_WRITES)`;
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

  // Subskrypcja zmiennych otwartego ekranu klienta (cid): keys - klucze konfiguracji, paths - zmienne z listy sterowania
  watch(cid, keys, paths) {
    if (!cid || typeof cid !== 'string' || cid.length > 64) throw Object.assign(new Error('brak identyfikatora strony (cid)'), { code: 400 });
    const p = (Array.isArray(paths) ? paths : []).filter((v) => this.access.read.has(v)).slice(0, MAX_WATCH);
    const k = (Array.isArray(keys) ? keys : []).filter((x) => typeof x === 'string').slice(0, MAX_WATCH);
    return this.source.watch(cid, { keys: k, paths: p });
  }
}
