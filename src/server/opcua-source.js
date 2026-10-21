// Odczyt zmiennych PLC przez OPC UA (serwer CODESYS na sterowniku).
//
// Wezly: albo z nodePrefix z configu (np. "ns=4;s=|var|AX-8.Application." + "HMI2.fXActualPosition"),
// albo szukane w drzewie OPC UA: Objects/.../Application/GlobalVars/<GVL>/<zmienna> - tak CODESYS
// publikuje symbol config, wiec nie trzeba znac nazwy urzadzenia.

import { EventEmitter } from 'node:events';
import {
  OPCUAClient, MessageSecurityMode, SecurityPolicy, AttributeIds, NodeClass, BrowseDirection, UserTokenType,
} from 'node-opcua-client';
import { REQUIRED, SLOW_KEYS } from '../shared/config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class OpcUaSource extends EventEmitter {
  constructor(cfg) {
    super();
    this.cfg = cfg;
    this.status = 'Łączenie...';
    this.connected = false;
    this.values = {};
    this.resolved = {};       // klucz -> NodeId (po polaczeniu)
    this.active = true;       // czytanie tylko, gdy ktos oglada strone
    this.stopped = false;
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

  async run() {
    while (!this.stopped) {
      const client = OPCUAClient.create({
        applicationName: 'VizuApp',
        securityMode: MessageSecurityMode.None,
        securityPolicy: SecurityPolicy.None,
        endpointMustExist: false,
        connectionStrategy: { maxRetry: 0, initialDelay: 500, maxDelay: 1000 },
        requestedSessionTimeout: 60000,
      });
      let session = null;
      try {
        this.setStatus(`Łączenie z ${this.cfg.endpoint}...`, false);
        await client.connect(this.cfg.endpoint);
        session = await client.createSession(this.cfg.username
          ? { type: UserTokenType.UserName, userName: this.cfg.username, password: this.cfg.password || '' }
          : undefined);
        const nodes = await this.resolve(session);
        this.setStatus(`Połączono (${this.cfg.endpoint})`, true);
        await this.poll(session, nodes);
      } catch (err) {
        this.setStatus(`Brak połączenia: ${err.message || err}`, false);
      } finally {
        try { if (session) await session.close(); } catch { /* polaczenie juz zerwane */ }
        try { await client.disconnect(); } catch { /* jw. */ }
      }
      for (let i = 0; i < 20 && !this.stopped; i++) await sleep(100);
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
    while (!this.stopped) {
      const t0 = Date.now();
      if (this.active) {
        const withSlow = n % slowEvery === 0;
        n++;
        const keys = withSlow ? [...fastKeys, ...slowKeys] : fastKeys;
        const dvs = await session.read(withSlow ? allReq : fastReq);
        const values = {};
        keys.forEach((k, i) => {
          if (!dvs[i].statusCode.isGood()) return;
          const v = dvs[i].value.value;
          values[k] = ArrayBuffer.isView(v) ? Array.from(v) : v;   // tablice LREAL (Float64Array) -> JSON
        });
        if (withSlow) slowValues = Object.fromEntries(slowKeys.filter((k) => k in values).map((k) => [k, values[k]]));
        this.values = { ...values, ...slowValues };
        this.emit('values', this.values);
      }
      await sleep(Math.max(0, period - (Date.now() - t0)));
    }
  }

  async resolve(session) {
    const variables = this.cfg.variables;
    let nodes;
    if (this.cfg.nodePrefix) {
      nodes = {};
      const keys = Object.keys(variables);
      const dvs = await session.read(keys.map((k) => ({ nodeId: this.cfg.nodePrefix + variables[k], attributeId: AttributeIds.Value })));
      keys.forEach((k, i) => {
        if (dvs[i].statusCode.isGood()) nodes[k] = this.cfg.nodePrefix + variables[k];
      });
    } else {
      nodes = await this.browseVariables(session, variables);
    }
    const missing = REQUIRED.filter((k) => !(k in nodes));
    if (missing.length) throw new Error('brak zmiennych w OPC UA: ' + missing.map((k) => variables[k]).join(', '));
    this.resolved = Object.fromEntries(Object.entries(nodes).map(([k, n]) => [k, n.toString()]));
    return nodes;
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
    for (const [key, path] of Object.entries(variables)) {
      const [gvl, name] = path.split('.');
      if (!gvls[gvl]) continue;
      cache[gvl] ??= await this.children(session, gvls[gvl].nodeId);
      if (cache[gvl][name]) nodes[key] = cache[gvl][name].nodeId;
    }
    return nodes;
  }
}
