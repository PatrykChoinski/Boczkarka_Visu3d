// Historia alarmow PLC w bazie SQLite (wbudowany node:sqlite, bez zaleznosci): plik alarms.db obok config.json.
// Serwer zapisuje wystapienie i ustapienie kazdego alarmu z tablicy Alarms.Active (subskrypcja w tle), takze gdy zadna
// strona nie jest otwarta. Wpis: numer i nazwa alarmu, czas wystapienia, ustapienia (NULL - aktywny), kwitowanie.
//
// GET  /api/alarms?limit=200&offset=0&active=1   historia (najnowsze najpierw) i liczba niepotwierdzonych
// POST /api/alarms/ack                           kwitowanie wszystkich wpisow (jak Kwituj w HMI)

import { DatabaseSync } from 'node:sqlite';
import { alarmByNumber } from '../shared/alarms.js';

export const ALARMS_DB = 'alarms.db';

export class AlarmDb {
  constructor(file) {
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS alarm_history (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        n       INTEGER NOT NULL,             -- numer alarmu (Alarms.Active[n])
        name    TEXT,                         -- nazwa (PL) w chwili wystapienia
        on_ms   INTEGER NOT NULL,             -- wystapil (ms od 1970)
        off_ms  INTEGER,                      -- ustapil; NULL - aktywny
        ack     INTEGER NOT NULL DEFAULT 0,   -- potwierdzony (Kwituj)
        endpoint TEXT                         -- adres PLC (OPC UA)
      );
      CREATE INDEX IF NOT EXISTS alarm_history_on ON alarm_history (on_ms DESC);
      CREATE INDEX IF NOT EXISTS alarm_history_open ON alarm_history (off_ms) WHERE off_ms IS NULL;
    `);
    this.q = {
      open: this.db.prepare('SELECT id, n FROM alarm_history WHERE off_ms IS NULL'),
      insert: this.db.prepare('INSERT INTO alarm_history (n, name, on_ms, endpoint) VALUES (?, ?, ?, ?)'),
      close: this.db.prepare('UPDATE alarm_history SET off_ms = ? WHERE id = ?'),
      ack: this.db.prepare('UPDATE alarm_history SET ack = 1 WHERE ack = 0'),
      unacked: this.db.prepare('SELECT COUNT(*) AS c FROM alarm_history WHERE ack = 0'),
      list: this.db.prepare('SELECT id, n, name, on_ms AS "on", off_ms AS "off", ack FROM alarm_history ORDER BY on_ms DESC, id DESC LIMIT ? OFFSET ?'),
      listActive: this.db.prepare('SELECT id, n, name, on_ms AS "on", off_ms AS "off", ack FROM alarm_history WHERE off_ms IS NULL ORDER BY on_ms DESC'),
      count: this.db.prepare('SELECT COUNT(*) AS c FROM alarm_history'),
    };
    this.version = 0;
  }

  // Aktywne alarmy (numery) z PLC: nowe - wpis, te, ktore zniknely - czas ustapienia. true - zmiana
  update(active, now = Date.now(), endpoint = null) {
    const set = new Set(active);
    const open = this.q.open.all();
    const openN = new Set();
    let changed = false;
    this.db.exec('BEGIN');
    try {
      for (const r of open) {
        if (set.has(r.n)) openN.add(r.n);
        else { this.q.close.run(now, r.id); changed = true; }
      }
      for (const n of set) {
        if (openN.has(n)) continue;
        const a = alarmByNumber(n);
        this.q.insert.run(n, a?.pl || a?.en || `Alarm ${n}`, now, endpoint);
        changed = true;
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    if (changed) this.version++;
    return changed;
  }

  ack() {
    const r = this.q.ack.run();
    if (r.changes) this.version++;
    return r.changes;
  }

  list({ limit = 200, offset = 0, active = false } = {}) {
    const rows = active ? this.q.listActive.all() : this.q.list.all(Math.min(1000, Math.max(1, limit)), Math.max(0, offset));
    return {
      entries: rows.map((r) => ({ ...r, ack: Boolean(r.ack) })),
      total: this.q.count.get().c,
      unacked: this.q.unacked.get().c,
      version: this.version,
    };
  }

  close() { this.db.close(); }
}
