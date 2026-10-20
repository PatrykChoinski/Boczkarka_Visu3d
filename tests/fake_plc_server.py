"""Testowy serwer OPC UA udajacy sterownik CODESYS (bez PLC).

Drzewo jak w CODESYS: Objects/DeviceSet/AX-8/Resources/Application/GlobalVars/<GVL>/<zmienna>,
NodeId "|var|AX-8.Application.<GVL>.<zmienna>"; wartosci z symulatora ciecia.

python -m tests.fake_plc_server [--port 4840]   (z katalogu VizuApp), potem VizuApp.exe
"""
import argparse
import asyncio
import time

from asyncua import Server, ua

from vizuapp.config import VARIABLES
from vizuapp.simulator import Timeline

NAMESPACE = "CODESYSSPV3/3S/IecVarAccess"
DEVICE = "AX-8"
TYPES = {"cut_step": ua.VariantType.Int16}
BOOLS = ("cut_start", "saw_running", "water_cut")


async def build(server):
    idx = await server.register_namespace(NAMESPACE)
    objects = server.nodes.objects
    device_set = await objects.add_object(idx, "DeviceSet")
    device = await device_set.add_object(idx, DEVICE)
    resources = await device.add_object(idx, "Resources")
    application = await resources.add_object(idx, "Application")
    global_vars = await application.add_object(idx, "GlobalVars")
    gvls, nodes = {}, {}
    for key, path in VARIABLES.items():
        gvl, _, name = path.partition(".")
        if gvl not in gvls:
            gvls[gvl] = await global_vars.add_object(idx, gvl)
        node_id = ua.NodeId("|var|%s.Application.%s" % (DEVICE, path), idx)
        if key in BOOLS:
            value = ua.Variant(False, ua.VariantType.Boolean)
        else:
            value = ua.Variant(0 if key in TYPES else 0.0, TYPES.get(key, ua.VariantType.Double))
        nodes[key] = await gvls[gvl].add_variable(node_id, name, value)
    return idx, nodes


async def serve(port, stop=None, ready=None):
    server = Server()
    await server.init()
    server.set_endpoint("opc.tcp://127.0.0.1:%d" % port)
    server.set_security_policy([ua.SecurityPolicyType.NoSecurity])
    idx, nodes = await build(server)
    timeline = Timeline()
    start = time.monotonic()
    async with server:
        if ready is not None:
            ready(idx)
        while stop is None or not stop.is_set():
            values = timeline.values(time.monotonic() - start)
            for key, node in nodes.items():
                vt = ua.VariantType.Boolean if key in BOOLS else TYPES.get(key, ua.VariantType.Double)
                val = bool(values[key]) if key in BOOLS else (int(values[key]) if key in TYPES else float(values[key]))
                await node.write_value(ua.Variant(val, vt))
            await asyncio.sleep(0.05)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=4840)
    args = parser.parse_args()
    print("Serwer testowy OPC UA: opc.tcp://127.0.0.1:%d" % args.port)
    asyncio.run(serve(args.port))


if __name__ == "__main__":
    main()
