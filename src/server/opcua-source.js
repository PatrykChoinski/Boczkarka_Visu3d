// Odczyt zmiennych PLC przez OPC UA (serwer CODESYS na sterowniku).
//
// Wezly: albo z nodePrefix z configu (np. "ns=4;s=|var|AX-8.Application." + "HMI2.fXActualPosition"),
// albo szukane w drzewie OPC UA: Objects/.../Application/GlobalVars/<GVL>/<zmienna> - tak CODESYS
// publikuje symbol config, wiec nie trzeba znac nazwy urzadzenia.

import { EventEmitter } from 'node:events';
import {
  OPCUAClient, MessageSecurityMode, SecurityPolicy, AttributeIds, NodeClass, BrowseDirection, UserTokenType, DataType, VariantArrayType, Variant,
} from 'node-opcua-client';
import { REQUIRED, SLOW_KEYS } from '../shared/config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Limit wezlow w jednym odczycie: Server.ServerCapabilities.OperationLimits.MaxNodesPerRead (CODESYS: 100) -
// wiekszy Read konczy sie BadTooManyOperations; bez limitu w serwerze - DEFAULT_MAX_READ
const MAX_NODES_PER_READ = 'ns=0;i=11705';
const DEFAULT_MAX_READ = 100;

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

// Odczyt w porcjach po maxRead wezlow (wyniki w tej samej kolejnosci)
export async function readChunked(session, nodes, maxRead = DEFAULT_MAX_READ) {
  const n = Math.max(1, maxRead);
  if (nodes.length <= n) return session.read(nodes);
  const out = [];
  for (let i = 0; i < nodes.length; i += n) out.push(...await session.read(nodes.slice(i, i + n)));
  return out;
}

export class OpcUaSource extends EventEmitter {
  constructor(cfg) {
    super();
    this.cfg = cfg;
    this.status = 'Łączenie...';
    this.connected = false;
    this.values = {};
    this.resolved = {};       // klucz -> NodeId (po polaczeniu)
    this.missing = [];        // klucze bez wezla w OPC UA (zmienna nie ma w symbol configu / zla nazwa)
    this.dataTypes = {};      // klucz -> typ danych z serwera OPC UA (diagnostyka /api/variables)
    this.active = true;       // czytanie tylko, gdy ktos oglada strone
    this.stopped = false;
    // panel HMI (tryb PLC): zmienne otwartych ekranow - sciezka -> czas wygasniecia; wartosci, zmienne bez wezla
    this.watch = new Map();
    this.hmiValues = {};
    this.hmiBad = new Set();
    this.session = null;
    this.prefix = null;       // przedrostek NodeId zmiennych ("ns=4;s=|var|<urzadzenie>.Application.")
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
    await this.loop;
  }

  // Nowy adres OPC UA (#148, z /api/connection): zerwanie biezacego polaczenia i laczenie od razu z nowym
  reconnect(endpoint) {
    this.cfg.endpoint = endpoint;
    this.restart = true;
    this.values = {};
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
      });
      this.client = client;
      let session = null;
      try {
        this.setStatus(`Łączenie z ${this.cfg.endpoint}...`, false);
        await client.connect(this.cfg.endpoint);
        session = await client.createSession(this.cfg.username
          ? { type: UserTokenType.UserName, userName: this.cfg.username, password: this.cfg.password || '' }
          : undefined);
        await this.readLimits(session);
        const nodes = await this.resolve(session);
        await this.readDataTypes(session, nodes);
        this.session = session;
        const total = Object.keys(this.cfg.variables).length;
        const miss = this.missing.map((k) => this.cfg.variables[k]);
        this.setStatus(`Połączono (${this.cfg.endpoint}), zmienne ${total - miss.length}/${total}`
          + (miss.length ? `, brak: ${miss.slice(0, 5).join(', ')}${miss.length > 5 ? ' …' : ''}` : ''), true);
        await this.poll(session, nodes);
      } catch (err) {
        if (!this.restart) this.setStatus(`Brak połączenia: ${err.message || err}`, false);
      } finally {
        this.session = null;
        try { if (session) await session.close(); } catch { /* polaczenie juz zerwane */ }
        try { await client.disconnect(); } catch { /* jw. */ }
      }
      for (let i = 0; i < 20 && !this.stopped && !this.restart; i++) await sleep(100);
    }
  }

  async poll(session, nodes) {
    const all = Object.keys(nodes);
    const slow = new Set(SLOW_KEYS);
    const fastKeys = all.filter((k) => !slow.has(k));
    const slowKeys = all.filter((k) => slow.has(k));
    const req = (keys) => keys.map((k) => ({ nodeId: nodes[k], attributeId: AttributeIds.Value }));
    const fastReq = req(fastKeys);
    const allReq = req([...fastKeys, ...slowKeys]);
    const period = Math.max(10, Number(this.cfg.pollMs) || 50);
    const slowEvery = Math.max(1, Math.round(Number(this.cfg.slowEvery) || 20));
    let n = 0;
    let slowValues = {};
    while (!this.stopped && !this.restart) {
      const t0 = Date.now();
      if (this.active) {
        const withSlow = n % slowEvery === 0;
        n++;
        const keys = withSlow ? [...fastKeys, ...slowKeys] : fastKeys;
        const dvs = await readChunked(session, withSlow ? allReq : fastReq, this.maxRead);
        const values = {};
        keys.forEach((k, i) => {
          if (!dvs[i].statusCode.isGood()) return;
          values[k] = plainValue(dvs[i].value);
        });
        if (withSlow) slowValues = Object.fromEntries(slowKeys.filter((k) => k in values).map((k) => [k, values[k]]));
        this.values = { ...values, ...slowValues };
        this.emit('values', this.values);
        if (n % 4 === 1) await this.readWatched(session);
      }
      await sleep(Math.max(0, period - (Date.now() - t0)));
    }
  }

  // --- panel HMI (tryb PLC) ---------------------------------------------------------------------
  // NodeId dowolnej zmiennej "GVL.zmienna" / "GVL.tablica[3]" / "GVL.struktura.pole": nodePrefix z configu albo przedrostek
  // wziety z podpietej zmiennej (CODESYS publikuje symbole jako "ns=N;s=|var|<urzadzenie>.Application.<sciezka>")
  nodeIdFor(path) {
    if (this.cfg.nodePrefix) return this.cfg.nodePrefix + path;
    return this.prefix ? this.prefix + path : null;
  }

  // Zmienne otwartego ekranu: czytane co 4 cykle odczytu, dopoki strona je odswieza (ttl)
  watchVars(paths, ttlMs = 5000) {
    const until = Date.now() + ttlMs;
    for (const p of paths) this.watch.set(p, until);
  }

  async readWatched(session) {
    const now = Date.now();
    for (const [p, until] of this.watch) if (until < now) { this.watch.delete(p); delete this.hmiValues[p]; }
    const paths = [...this.watch.keys()].filter((p) => !this.hmiBad.has(p));
    if (!paths.length || !this.nodeIdFor('')) return;
    const dvs = await readChunked(session, paths.map((p) => ({ nodeId: this.nodeIdFor(p), attributeId: AttributeIds.Value })), this.maxRead);
    const out = {};
    paths.forEach((p, i) => {
      if (dvs[i].statusCode.isGood()) out[p] = plainValue(dvs[i].value);
      else this.hmiBad.add(p);
    });
    this.hmiValues = out;
    this.emit('hmi', out);
  }

  // Zapis [{v: "GVL.zmienna", value}] - typ z biezacej wartosci w PLC; blad przerywa caly zapis (nic nie zapisane)
  async write(items) {
    const session = this.session;
    if (!session || !this.connected) throw new Error('brak połączenia z PLC');
    const ids = items.map((it) => this.nodeIdFor(it.v));
    if (ids.some((id) => !id)) throw new Error('nieznany przedrostek węzłów OPC UA');
    const cur = await readChunked(session, ids.map((nodeId) => ({ nodeId, attributeId: AttributeIds.Value })), this.maxRead);
    const req = items.map((it, i) => {
      if (!cur[i].statusCode.isGood()) throw new Error(`${it.v}: brak w OPC UA (${cur[i].statusCode.name})`);
      if (cur[i].value.arrayType !== VariantArrayType.Scalar) throw new Error(`${it.v}: tablica – zapis tylko pojedynczych elementów`);
      return { nodeId: ids[i], attributeId: AttributeIds.Value, value: { value: writeVariant(cur[i].value.dataType, it.value) } };
    });
    const res = await session.write(req);
    res.forEach((sc, i) => { if (!sc.isGood()) throw new Error(`${items[i].v}: ${sc.name}`); });
  }

  // Limit wezlow w odczycie z serwera (0 / brak / blad - DEFAULT_MAX_READ)
  async readLimits(session) {
    this.maxRead = DEFAULT_MAX_READ;
    try {
      const [dv] = await session.read([{ nodeId: MAX_NODES_PER_READ, attributeId: AttributeIds.Value }]);
      const v = Number(dv.value?.value);
      if (dv.statusCode.isGood() && v > 0) this.maxRead = v;
    } catch { /* serwer bez OperationLimits */ }
  }

  async resolve(session) {
    const variables = this.cfg.variables;
    let nodes;
    if (this.cfg.nodePrefix) {
      nodes = {};
      const keys = Object.keys(variables);
      const dvs = await readChunked(session, keys.map((k) => ({ nodeId: this.cfg.nodePrefix + variables[k], attributeId: AttributeIds.Value })), this.maxRead);
      keys.forEach((k, i) => {
        if (dvs[i].statusCode.isGood()) nodes[k] = this.cfg.nodePrefix + variables[k];
      });
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
    this.hmiBad.clear();
    return nodes;
  }

  // Typy danych wezlow (DataType) - do diagnostyki podpiecia zmiennych
  async readDataTypes(session, nodes) {
    const keys = Object.keys(nodes);
    this.dataTypes = {};
    try {
      const dvs = await readChunked(session, keys.map((k) => ({ nodeId: nodes[k], attributeId: AttributeIds.DataType })), this.maxRead);
      keys.forEach((k, i) => {
        if (!dvs[i].statusCode.isGood()) return;
        // typ wbudowany (ns=0;i=11 -> Double), typy uzytkownika (enumy, struktury PLC) - NodeId
        const id = dvs[i].value.value;
        this.dataTypes[k] = id?.namespace === 0 && DataType[id.value] ? DataType[id.value] : id?.toString();
      });
    } catch { /* bez typow - diagnostyka tylko z wartosci */ }
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
