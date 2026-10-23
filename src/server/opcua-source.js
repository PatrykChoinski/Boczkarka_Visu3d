// Odczyt zmiennych PLC przez OPC UA (serwer CODESYS na sterowniku).
//
// Wezly: albo z nodePrefix z configu (np. "ns=4;s=|var|AX-8.Application." + "HMI2.fXActualPosition"),
// albo szukane w drzewie OPC UA: Objects/.../Application/GlobalVars/<GVL>/<zmienna> - tak CODESYS
// publikuje symbol config, wiec nie trzeba znac nazwy urzadzenia.

import { EventEmitter } from 'node:events';
import {
  OPCUAClient, MessageSecurityMode, SecurityPolicy, AttributeIds, NodeClass, BrowseDirection, UserTokenType, DataType, VariantArrayType, Variant,
  ClientSubscription, ClientMonitoredItemGroup, TimestampsToReturn,
} from 'node-opcua-client';
import { REQUIRED, BACKGROUND_KEYS } from '../shared/config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


// Wartosc z DataValue do JSON: tablice LREAL (Float64Array) -> zwykle tablice, LINT / ULINT (Int64 / UInt64 - w node-opcua
// para [starsze, mlodsze 32 bity]) -> liczba (np. licznik pracy maszyny HMI.iOverallMinutes)
export function plainValue(variant) {
  const v = variant?.value;
  const t = variant?.dataType;
  const int64 = (x) => (Array.isArray(x) && x.length === 2 ? x[0] * 4294967296 + x[1] : x);
  if (t === DataType.Int64 || t === DataType.UInt64) {
    return variant.arrayType === VariantArrayType.Scalar ? int64(v) : Array.from(v ?? [], int64);
  }
  return ArrayBuffer.isView(v) ? Array.from(v) : v;
}

// Tablica w typie elementu (node-opcua: Float64Array dla LREAL itd.; BOOL / STRING - zwykla lista)
const TYPED = {
  [DataType.Double]: Float64Array, [DataType.Float]: Float32Array, [DataType.Int16]: Int16Array, [DataType.UInt16]: Uint16Array,
  [DataType.Int32]: Int32Array, [DataType.UInt32]: Uint32Array, [DataType.SByte]: Int8Array, [DataType.Byte]: Uint8Array,
};
const typedArray = (dataType, list) => (TYPED[dataType] ? TYPED[dataType].from(list) : list);

// Wartosc do zapisu w typie wezla (typ z biezacej wartosci w PLC): BOOL, liczby calkowite (zaokraglone, w zakresie typu),
// REAL / LREAL, STRING. Inne typy (LINT, struktury) - blad
const INT_RANGE = {
  [DataType.SByte]: [-128, 127], [DataType.Byte]: [0, 255], [DataType.Int16]: [-32768, 32767], [DataType.UInt16]: [0, 65535],
  [DataType.Int32]: [-2147483648, 2147483647], [DataType.UInt32]: [0, 4294967295],
};
export function writeVariant(dataType, value) {
  if (dataType === DataType.Boolean) return new Variant({ dataType, value: value === true || value === 1 || value === 'true' || value === '1' });
  if (dataType === DataType.Float || dataType === DataType.Double) {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`zła liczba: ${value}`);
    return new Variant({ dataType, value: n });
  }
  if (INT_RANGE[dataType]) {
    const n = Math.round(Number(value));
    const [lo, hi] = INT_RANGE[dataType];
    if (!Number.isFinite(n) || n < lo || n > hi) throw new Error(`liczba poza zakresem typu ${DataType[dataType]}: ${value}`);
    return new Variant({ dataType, value: n });
  }
  if (dataType === DataType.String) return new Variant({ dataType, value: String(value ?? '') });
  throw new Error(`typ ${DataType[dataType] ?? dataType} nieobsługiwany przy zapisie`);
}

// Wymiana danych tylko przez subskrypcje OPC UA (CODESYS: pojedynczy Read ~0,5 s, subskrypcja - zmiany co ~100 ms):
// - subskrypcja w tle (BACKGROUND_KEYS z config.js) przez caly czas polaczenia,
// - zmienne otwartych ekranow - grupa elementow monitorowanych na kazdego klienta (strone): watch(cid, {keys, paths})
//   zastepuje poprzednia grupe klienta (inny ekran), pusta lista albo brak odswiezenia przez WATCH_TTL - koniec subskrypcji.
// Zmiany wysylane zbiorczo co EMIT_MS jako {values, hmi} (tylko zmienione wartosci) - zdarzenie 'delta';
// 'values' - pelny zestaw (diagnostyka, testy).
export const WATCH_TTL = 15000;
const EMIT_MS = 50;

export class OpcUaSource extends EventEmitter {
  constructor(cfg) {
    super();
    this.cfg = cfg;
    this.status = 'Łączenie...';
    this.connected = false;
    this.values = {};         // klucz konfiguracji -> wartosc (subskrybowane zmienne konfiguracji)
    this.hmiValues = {};      // "GVL.zmienna" -> wartosc (zmienne spoza konfiguracji: pola formularzy, przelaczniki)
    this.resolved = {};       // klucz -> NodeId (po polaczeniu)
    this.missing = [];        // klucze bez wezla w OPC UA (zmienna nie ma w symbol configu / zla nazwa)
    this.dataTypes = {};      // klucz -> typ danych z serwera OPC UA (diagnostyka /api/variables)
    this.types = new Map();   // NodeId -> {dataType, array} (zapis bez dodatkowego odczytu)
    this.stopped = false;
    this.session = null;
    this.sub = null;
    this.prefix = null;       // przedrostek NodeId zmiennych ("ns=4;s=|var|<urzadzenie>.Application.")
    this.clients = new Map(); // cid -> {sig, keys, paths, group, until}
    this.pending = { values: {}, hmi: {} };
    this.emitTimer = null;
    this.gcTimer = setInterval(() => this.expireWatches(), 1000);
    this.gcTimer.unref?.();
  }

  setStatus(status, connected) {
    this.status = status;
    this.connected = connected;
    this.emit('status', { status, connected });
  }

  start() {
    this.loop = this.run();
    return this;
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.gcTimer);
    this.wake?.();
    await this.loop;
  }

  // Nowy adres OPC UA (#148, z /api/connection): zerwanie biezacego polaczenia i laczenie od razu z nowym
  reconnect(endpoint) {
    this.cfg.endpoint = endpoint;
    this.restart = true;
    this.values = {};
    this.hmiValues = {};
    this.wake?.();
    this.client?.disconnect().catch(() => {});
  }

  async run() {
    while (!this.stopped) {
      this.restart = false;
      const client = OPCUAClient.create({
        applicationName: 'VizuApp',
        securityMode: MessageSecurityMode.None,
        securityPolicy: SecurityPolicy.None,
        endpointMustExist: false,
        connectionStrategy: { maxRetry: 0, initialDelay: 500, maxDelay: 1000 },
        requestedSessionTimeout: 60000,
        keepSessionAlive: true,
      });
      this.client = client;
      let session = null;
      try {
        this.setStatus(`Łączenie z ${this.cfg.endpoint}...`, false);
        await client.connect(this.cfg.endpoint);
        session = await client.createSession(this.cfg.username
          ? { type: UserTokenType.UserName, userName: this.cfg.username, password: this.cfg.password || '' }
          : undefined);
        // bez odczytow (Read): wezly z drzewa (Browse) albo z nodePrefix, wartosci i typy - z subskrypcji
        const nodes = await this.resolve(session);
        this.dataTypes = {};
        this.session = session;
        this.nodes = nodes;
        const lost = new Promise((resolve) => {
          this.wake = resolve;
          client.on('connection_lost', resolve);
          session.on('session_closed', resolve);
        });
        this.sub = await this.subscribe(session);
        this.sub.on('terminated', () => this.wake?.());
        // w tle: zmienne BACKGROUND_KEYS (te, ktore sa w OPC UA)
        const bg = BACKGROUND_KEYS.filter((k) => k in nodes);
        this.background = this.monitor(bg.map((k) => ({ key: k })));
        // klienci podlaczeni przed zerwaniem polaczenia - ich ekrany od nowa
        for (const c of this.clients.values()) { c.group = null; this.applyWatch(c); }
        const total = Object.keys(this.cfg.variables).length;
        const miss = this.missing.map((k) => this.cfg.variables[k]);
        this.setStatus(`Połączono (${this.cfg.endpoint}), zmienne ${total - miss.length}/${total}`
          + (miss.length ? `, brak: ${miss.slice(0, 5).join(', ')}${miss.length > 5 ? ' …' : ''}` : ''), true);
        if (!this.stopped && !this.restart) await lost;
        if (!this.stopped && !this.restart) this.setStatus(`Brak połączenia: zerwane połączenie z ${this.cfg.endpoint}`, false);
      } catch (err) {
        if (!this.restart && !this.stopped) this.setStatus(`Brak połączenia: ${err.message || err}`, false);
      } finally {
        this.wake = null;
        this.session = null;
        this.background = null;
        for (const c of this.clients.values()) c.group = null;
        try { if (this.sub) await this.sub.terminate(); } catch { /* polaczenie juz zerwane */ }
        this.sub = null;
        try { if (session) await session.close(); } catch { /* jw. */ }
        try { await client.disconnect(); } catch { /* jw. */ }
      }
      for (let i = 0; i < 20 && !this.stopped && !this.restart; i++) await sleep(100);
    }
  }

  // Subskrypcja: interwal publikacji z konfiguracji (pollMs, domyslnie 50 ms - CODESYS zwykle zwieksza do 100 ms)
  async subscribe(session) {
    const ms = Math.max(10, Number(this.cfg.pollMs) || 50);
    const sub = ClientSubscription.create(session, {
      requestedPublishingInterval: ms, requestedLifetimeCount: 600, requestedMaxKeepAliveCount: 20,
      maxNotificationsPerPublish: 0, publishingEnabled: true, priority: 10,
    });
    await new Promise((resolve, reject) => { sub.once('started', resolve); sub.once('internal_error', reject); });
    return sub;
  }

  // Grupa elementow monitorowanych: [{key}] - zmienna konfiguracji, [{path}] - dowolna zmienna "GVL.zmienna"
  monitor(items) {
    const list = items.map((it) => ({ ...it, nodeId: it.key ? this.nodes[it.key] : this.nodeIdFor(it.path) })).filter((it) => it.nodeId);
    if (!this.sub || !list.length) return null;
    const ms = Math.max(10, Number(this.cfg.pollMs) || 50);
    const group = ClientMonitoredItemGroup.create(this.sub, list.map((it) => ({ nodeId: it.nodeId, attributeId: AttributeIds.Value })),
      { samplingInterval: ms, discardOldest: true, queueSize: 1 }, TimestampsToReturn.Neither);
    group.on('changed', (item, dv, index) => {
      const it = list[index];
      if (!it) return;
      if (!dv.statusCode.isGood()) {
        // zmienna z nodePrefix, ktorej nie ma w OPC UA (symbol config) - brak (diagnostyka)
        if (it.key && !this.missing.includes(it.key)) this.missing.push(it.key);
        return;
      }
      if (dv.value?.dataType) {
        this.types.set(String(it.nodeId), { dataType: dv.value.dataType, array: dv.value.arrayType !== VariantArrayType.Scalar });
        if (it.key) this.dataTypes[it.key] = DataType[dv.value.dataType];
      }
      const v = plainValue(dv.value);
      if (it.key) { this.values[it.key] = v; this.pending.values[it.key] = v; } else { this.hmiValues[it.path] = v; this.pending.hmi[it.path] = v; }
      this.scheduleEmit();
    });
    group.on('err', () => {});
    return group;
  }

  scheduleEmit() {
    if (this.emitTimer) return;
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null;
      const d = this.pending;
      this.pending = { values: {}, hmi: {} };
      const out = {};
      if (Object.keys(d.values).length) out.values = d.values;
      if (Object.keys(d.hmi).length) out.hmi = d.hmi;
      if (!Object.keys(out).length) return;
      this.emit('delta', out);
      if (out.values) this.emit('values', this.values);
      if (out.hmi) this.emit('hmi', this.hmiValues);
    }, EMIT_MS);
  }

  // --- zmienne otwartych ekranow ------------------------------------------------------------------
  // NodeId dowolnej zmiennej "GVL.zmienna" / "GVL.tablica[3]" / "GVL.struktura.pole": nodePrefix z configu albo przedrostek
  // wziety z podpietej zmiennej (CODESYS publikuje symbole jako "ns=N;s=|var|<urzadzenie>.Application.<sciezka>")
  nodeIdFor(path) {
    if (this.cfg.nodePrefix) return this.cfg.nodePrefix + path;
    return this.prefix ? this.prefix + path : null;
  }

  // Ekran klienta: keys - klucze konfiguracji (poza zmiennymi w tle), paths - inne zmienne. Ta sama lista - tylko
  // odswiezenie; inna - nowa grupa (stara zamknieta); pusta - koniec subskrypcji ekranu
  watch(cid, { keys = [], paths = [] } = {}) {
    const bg = new Set(BACKGROUND_KEYS);
    const k = [...new Set(keys)].filter((x) => x in this.cfg.variables && !bg.has(x)).sort();
    const p = [...new Set(paths)].sort();
    const sig = JSON.stringify([k, p]);
    let c = this.clients.get(cid);
    if (!c) { c = { group: null }; this.clients.set(cid, c); }
    c.until = Date.now() + WATCH_TTL;
    if (c.sig === sig && (c.group || !this.sub)) return k.length + p.length;
    c.sig = sig;
    c.keys = k;
    c.paths = p;
    this.applyWatch(c);
    return k.length + p.length;
  }

  applyWatch(c) {
    const old = c.group;
    c.group = this.monitor([...c.keys.map((key) => ({ key })), ...c.paths.map((path) => ({ path }))]);
    if (old) old.terminate().catch(() => {});
    this.dropUnwatched();
  }

  unwatch(cid) {
    const c = this.clients.get(cid);
    if (!c) return;
    this.clients.delete(cid);
    if (c.group) c.group.terminate().catch(() => {});
    this.dropUnwatched();
  }

  // wartosci zmiennych, ktorych juz nikt nie oglada - usuniete (nieaktualne po koncu subskrypcji)
  dropUnwatched() {
    const keys = new Set(BACKGROUND_KEYS);
    const paths = new Set();
    for (const c of this.clients.values()) { for (const k of c.keys || []) keys.add(k); for (const x of c.paths || []) paths.add(x); }
    for (const k of Object.keys(this.values)) if (!keys.has(k)) delete this.values[k];
    for (const x of Object.keys(this.hmiValues)) if (!paths.has(x)) delete this.hmiValues[x];
  }

  expireWatches() {
    const now = Date.now();
    for (const [cid, c] of this.clients) if (c.until < now) this.unwatch(cid);
  }

  // Zapis [{v: "GVL.zmienna", value}] - typ z subskrypcji; bit (nazwa b...) - BOOL; inny nieznany typ - jednorazowa
  // krotka subskrypcja (pierwsze powiadomienie) zamiast odczytu. Blad przerywa caly zapis (nic nie zapisane)
  async write(items) {
    const session = this.session;
    if (!session || !this.connected) throw new Error('brak połączenia z PLC');
    const ids = items.map((it) => this.nodeIdFor(it.v));
    if (ids.some((id) => !id)) throw new Error('nieznany przedrostek węzłów OPC UA');
    items.forEach((it, i) => {
      if (!this.types.has(ids[i]) && !Array.isArray(it.value) && /^b[A-Z0-9]/.test(it.v.split('.').pop())) this.types.set(ids[i], { dataType: DataType.Boolean, array: false });
    });
    const unknown = [...new Set(ids.filter((id) => !this.types.has(id)))];
    if (unknown.length) await this.typesBySubscription(unknown, items, ids);
    const req = items.map((it, i) => {
      const t = this.types.get(ids[i]);
      // cala tablica (np. bufor programu aProgram*): wartosc - lista, typ elementu z subskrypcji
      if (t.array !== Array.isArray(it.value)) throw new Error(`${it.v}: ${t.array ? 'tablica – podaj listę wartości' : 'to nie jest tablica'}`);
      const value = t.array
        ? new Variant({ dataType: t.dataType, arrayType: VariantArrayType.Array, value: typedArray(t.dataType, it.value.map((x) => writeVariant(t.dataType, x).value)) })
        : writeVariant(t.dataType, it.value);
      return { nodeId: ids[i], attributeId: AttributeIds.Value, value: { value } };
    });
    const res = await session.write(req);
    res.forEach((sc, i) => { if (!sc.isGood()) throw new Error(`${items[i].v}: ${sc.name}`); });
  }

  // Typy zmiennych z pierwszego powiadomienia jednorazowej grupy subskrypcji (potem grupa zamknieta)
  async typesBySubscription(unknown, items, ids) {
    if (!this.sub) throw new Error('brak subskrypcji OPC UA');
    const group = ClientMonitoredItemGroup.create(this.sub, unknown.map((nodeId) => ({ nodeId, attributeId: AttributeIds.Value })),
      { samplingInterval: 50, discardOldest: true, queueSize: 1 }, TimestampsToReturn.Neither);
    const name = (id) => items[ids.indexOf(id)].v;
    try {
      await new Promise((resolve, reject) => {
        const left = new Set(unknown);
        const timer = setTimeout(() => reject(new Error(`${[...left].map(name).join(', ')}: brak odpowiedzi z OPC UA`)), 5000);
        group.on('changed', (item, dv, index) => {
          const id = unknown[index];
          if (!left.has(id)) return;
          left.delete(id);
          if (!dv.statusCode.isGood()) { clearTimeout(timer); reject(new Error(`${name(id)}: brak w OPC UA (${dv.statusCode.name})`)); return; }
          this.types.set(id, { dataType: dv.value.dataType, array: dv.value.arrayType !== VariantArrayType.Scalar });
          if (!left.size) { clearTimeout(timer); resolve(); }
        });
      });
    } finally {
      group.terminate().catch(() => {});
    }
  }

  async resolve(session) {
    const variables = this.cfg.variables;
    let nodes;
    if (this.cfg.nodePrefix) {
      // wezly z przedrostka (bez sprawdzania odczytem - zmienna spoza OPC UA: zly status w subskrypcji)
      nodes = Object.fromEntries(Object.keys(variables).map((k) => [k, this.cfg.nodePrefix + variables[k]]));
    } else {
      nodes = await this.browseVariables(session, variables);
    }
    this.missing = Object.keys(variables).filter((k) => !(k in nodes));
    const missing = REQUIRED.filter((k) => !(k in nodes));
    if (missing.length) throw new Error('brak zmiennych w OPC UA: ' + missing.map((k) => variables[k]).join(', '));
    this.resolved = Object.fromEntries(Object.entries(nodes).map(([k, n]) => [k, n.toString()]));
    this.prefix = null;
    for (const [k, id] of Object.entries(this.resolved)) {
      if (id.endsWith(`.${variables[k]}`)) { this.prefix = id.slice(0, id.length - variables[k].length); break; }
    }
    return nodes;
  }

  // Diagnostyka (/api/variables): kazda zmienna z konfiguracji - wezel OPC UA, typ, ostatnia wartosc
  variablesReport() {
    return Object.entries(this.cfg.variables).map(([key, name]) => {
      const v = this.values[key];
      return {
        key, name, node: this.resolved[key] ?? null, found: key in this.resolved, required: REQUIRED.includes(key),
        dataType: this.dataTypes[key] ?? null,
        value: Array.isArray(v) ? `[${v.length}] ${v.slice(0, 4).map((x) => (typeof x === 'number' ? +x.toFixed(3) : x)).join(', ')}${v.length > 4 ? ' …' : ''}` : v ?? null,
      };
    });
  }

  // Dzieci wezla: {nazwa: {nodeId, nodeClass}} (z kontynuacja przy duzych GVL)
  async children(session, nodeId) {
    const out = {};
    let res = await session.browse({
      nodeId, referenceTypeId: 'HierarchicalReferences', includeSubtypes: true,
      browseDirection: BrowseDirection.Forward, nodeClassMask: 0, resultMask: 63,
    });
    for (;;) {
      for (const ref of res.references || []) out[ref.browseName.name] = { nodeId: ref.nodeId, nodeClass: ref.nodeClass };
      if (!res.continuationPoint || !res.continuationPoint.length) break;
      [res] = await session.browseNext([res.continuationPoint], false);
    }
    return out;
  }

  async findApplication(session) {
    const queue = [['ObjectsFolder', 0]];
    while (queue.length) {
      const [nodeId, depth] = queue.shift();
      const kids = await this.children(session, nodeId);
      for (const [name, { nodeId: child, nodeClass }] of Object.entries(kids)) {
        if (nodeClass !== NodeClass.Object) continue;
        if (name === 'Application') return child;
        if (depth < 5 && !['Server', 'Aliases', 'Locations'].includes(name)) queue.push([child, depth + 1]);
      }
    }
    throw new Error('nie znaleziono Application w drzewie OPC UA');
  }

  async browseVariables(session, variables) {
    const app = await this.findApplication(session);
    const appKids = await this.children(session, app);
    const gvls = appKids.GlobalVars ? await this.children(session, appKids.GlobalVars.nodeId) : appKids;
    const cache = {};
    const nodes = {};
    // "GVL.zmienna" albo "GVL.struktura.pole" (np. ToolChangeGVL.ActiveTool.Height)
    for (const [key, path] of Object.entries(variables)) {
      const [gvl, ...names] = path.split('.');
      if (!gvls[gvl]) continue;
      let parent = gvl;
      let kids = cache[gvl] ??= await this.children(session, gvls[gvl].nodeId);
      for (let i = 0; i < names.length && kids; i++) {
        const node = kids[names[i]];
        if (!node) { kids = null; break; }
        if (i === names.length - 1) { nodes[key] = node.nodeId; break; }
        parent += `.${names[i]}`;
        kids = cache[parent] ??= await this.children(session, node.nodeId);
      }
    }
    return nodes;
  }
}
