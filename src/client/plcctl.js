// Sterowanie maszyna z ekranow Visu3D w trybie PLC: zapis zmiennych przez serwer VizuApp (src/server/plcwrite.js).
//
// write([{v, value}])  - zapis (Set / przelacznik / pole liczbowe); blad - komunikat (onError)
// hold(v) / release(v) - przycisk chwilowy jak Momentary w HMI: wcisniety = TRUE, potwierdzany co 200 ms (serwer sam
//                        zapisuje FALSE, gdy potwierdzenia ustana - np. zerwane polaczenie z tabletem)
// watch(vars)          - zmienne do odczytu poza konfiguracja (pola formularzy, stany przelacznikow), odswiezane co 3 s;
//                        wartosci przychodza w strumieniu SSE ({hmi})

export class PlcCtl {
  constructor({ headers, onError }) {
    this.headers = headers;
    this.onError = onError;
    this.holds = new Map();
    this.watched = new Set();
    setInterval(() => this.sendWatch(), 3000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseAll(); });
    window.addEventListener('pagehide', () => this.releaseAll());
  }

  async post(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...this.headers() }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
    return r.json();
  }

  async write(items) {
    try {
      await this.post('api/plc/write', { items });
      return true;
    } catch (err) {
      this.onError(`Nie zapisano do PLC: ${err.message}`);
      return false;
    }
  }

  hold(v) {
    if (this.holds.has(v)) return;
    const send = () => this.post('api/plc/hold', { v, on: true }).catch((err) => { this.onError(`Nie zapisano do PLC: ${err.message}`); this.release(v); });
    this.holds.set(v, setInterval(send, 200));
    send();
  }

  release(v) {
    if (!this.holds.has(v)) return;
    clearInterval(this.holds.get(v));
    this.holds.delete(v);
    this.post('api/plc/hold', { v, on: false }).catch(() => {});
  }

  releaseAll() { for (const v of [...this.holds.keys()]) this.release(v); }

  watch(vars) {
    const before = this.watched.size;
    for (const v of vars) this.watched.add(v);
    if (this.watched.size !== before) this.sendWatch();
  }

  sendWatch() {
    if (!this.watched.size || !this.active?.()) return;
    this.post('api/plc/watch', { vars: [...this.watched] }).catch(() => {});
  }
}
