// Sterowanie maszyna z ekranow Visu3D w trybie PLC: zapis zmiennych przez serwer VizuApp (src/server/plcwrite.js).
//
// write([{v, value}])  - zapis (Set / przelacznik / pole liczbowe); blad - komunikat (onError)
// hold(v) / release(v) - przycisk chwilowy jak Momentary w HMI: wcisniety = TRUE, potwierdzany co 200 ms (serwer sam
//                        zapisuje FALSE, gdy potwierdzenia ustana - np. zerwane polaczenie z tabletem)
// setScreen(keys, paths) - zmienne otwartego ekranu / okna (subskrypcja OPC UA tylko na czas otwarcia ekranu);
//                        wartosci przychodza w strumieniu SSE ({values}, {hmi})

export class PlcCtl {
  constructor({ headers, onError }) {
    this.headers = headers;
    this.onError = onError;
    this.holds = new Map();
    // identyfikator strony: strumien SSE i subskrypcje ekranow (zamkniecie strony - koniec subskrypcji)
    this.cid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    this.sig = null;
    setInterval(() => this.sendWatch(), 5000);
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

  // Zmienne otwartego ekranu (subskrypcja OPC UA na serwerze): keys - klucze konfiguracji, paths - inne zmienne.
  // Nowy ekran - nowa lista (serwer zamyka subskrypcje poprzedniego); lista odswiezana co 5 s (bez odswiezenia
  // serwer konczy subskrypcje po 15 s); pusta lista - brak zmiennych ekranu (tylko zmienne w tle)
  setScreen(keys, paths) {
    const sig = JSON.stringify([[...new Set(keys)].sort(), [...new Set(paths)].sort()]);
    if (sig === this.sig) return;
    this.sig = sig;
    this.sendWatch();
  }

  sendWatch() {
    if (!this.sig || !this.active?.()) return;
    const [keys, paths] = JSON.parse(this.sig);
    this.post('api/plc/watch', { cid: this.cid, keys, paths }).catch(() => {});
  }
}
