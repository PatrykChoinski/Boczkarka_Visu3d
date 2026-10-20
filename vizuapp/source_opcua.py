"""Odczyt zmiennych PLC przez OPC UA (serwer CODESYS na sterowniku).

Wezly: albo z node_prefix z configu (np. "ns=4;s=|var|AX-8.Application."
+ "HMI2.fXActualPosition"), albo szukane w drzewie OPC UA:
Objects/.../Application/GlobalVars/<GVL>/<zmienna> - tak CODESYS publikuje
symbol config, wiec nie trzeba znac nazwy urzadzenia.
"""
import asyncio
import threading
import time

from asyncua import Client, ua

from .config import REQUIRED


class SharedState:
    """Ostatnie wartosci zmiennych + stan polaczenia (watek zrodla -> GUI)."""

    def __init__(self):
        self._lock = threading.Lock()
        self.values = {}
        self.status = "Łączenie..."
        self.connected = False
        self.seq = 0

    def publish(self, values=None, status=None, connected=None):
        with self._lock:
            if values is not None:
                self.values = values
                self.seq += 1
            if status is not None:
                self.status = status
            if connected is not None:
                self.connected = connected

    def snapshot(self):
        with self._lock:
            return self.seq, dict(self.values), self.status, self.connected


class OpcUaSource(threading.Thread):
    def __init__(self, cfg, state):
        super().__init__(daemon=True, name="opcua")
        self.cfg = cfg
        self.state = state
        self._stop_event = threading.Event()
        self.resolved = {}        # klucz -> NodeId (po polaczeniu)

    def stop(self):
        self._stop_event.set()

    def run(self):
        asyncio.run(self._main())

    async def _main(self):
        while not self._stop_event.is_set():
            client = Client(self.cfg["endpoint"], timeout=4)
            if self.cfg.get("username"):
                client.set_user(self.cfg["username"])
                client.set_password(self.cfg.get("password", ""))
            try:
                self.state.publish(status="Łączenie z %s..." % self.cfg["endpoint"], connected=False)
                await client.connect()
                try:
                    nodes = await self._resolve(client)
                    self.state.publish(status="Połączono (%s)" % self.cfg["endpoint"], connected=True)
                    await self._poll(client, nodes)
                finally:
                    await client.disconnect()
            except Exception as exc:  # brak serwera, zerwane polaczenie, brak zmiennych
                self.state.publish(status="Brak połączenia: %s" % (str(exc) or type(exc).__name__),
                                   connected=False)
            await self._sleep(2.0)

    async def _sleep(self, seconds):
        end = time.monotonic() + seconds
        while not self._stop_event.is_set() and time.monotonic() < end:
            await asyncio.sleep(0.1)

    async def _poll(self, client, nodes):
        keys = list(nodes)
        node_list = [nodes[k] for k in keys]
        period = max(10, int(self.cfg.get("poll_ms", 50))) / 1000.0
        while not self._stop_event.is_set():
            t0 = time.monotonic()
            raw = await client.read_values(node_list)
            values = {}
            for key, val in zip(keys, raw):
                values[key] = val.value if hasattr(val, "value") else val
            self.state.publish(values=values)
            await asyncio.sleep(max(0.0, period - (time.monotonic() - t0)))

    async def _resolve(self, client):
        variables = self.cfg["variables"]
        prefix = self.cfg.get("node_prefix") or ""
        if prefix:
            nodes = {k: client.get_node(prefix + path) for k, path in variables.items()}
            nodes = await self._keep_readable(client, nodes)
        else:
            nodes = await self._browse(client, variables)
        missing = [k for k in REQUIRED if k not in nodes]
        if missing:
            raise RuntimeError("brak zmiennych w OPC UA: " + ", ".join(variables[k] for k in missing))
        self.resolved = {k: n.nodeid.to_string() for k, n in nodes.items()}
        return nodes

    async def _keep_readable(self, client, nodes):
        ok = {}
        for key, node in nodes.items():
            try:
                await node.read_value()
                ok[key] = node
            except Exception:
                pass
        return ok

    async def _children(self, client, node):
        refs = await node.get_children_descriptions()
        return {r.BrowseName.Name: (client.get_node(r.NodeId), r.NodeClass) for r in refs}

    async def _find_application(self, client):
        queue = [(client.nodes.objects, 0)]
        while queue:
            node, depth = queue.pop(0)
            for name, (child, node_class) in (await self._children(client, node)).items():
                if node_class != ua.NodeClass.Object:
                    continue
                if name == "Application":
                    return child
                if depth < 5 and name not in ("Server", "Aliases", "Locations"):
                    queue.append((child, depth + 1))
        raise RuntimeError("nie znaleziono Application w drzewie OPC UA")

    async def _browse(self, client, variables):
        app = await self._find_application(client)
        app_children = await self._children(client, app)
        root = app_children["GlobalVars"][0] if "GlobalVars" in app_children else app
        gvls = await self._children(client, root) if root is not app else app_children
        cache = {}
        nodes = {}
        for key, path in variables.items():
            gvl, _, name = path.partition(".")
            if gvl not in gvls:
                continue
            if gvl not in cache:
                cache[gvl] = await self._children(client, gvls[gvl][0])
            if name in cache[gvl]:
                nodes[key] = cache[gvl][name][0]
        return nodes
