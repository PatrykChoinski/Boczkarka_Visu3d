"""Odczyt przez OPC UA z testowego serwera o drzewie jak w CODESYS."""
import asyncio
import threading
import time
import unittest

from vizuapp import config
from vizuapp.source_opcua import OpcUaSource, SharedState
from tests.fake_plc_server import serve, DEVICE

PORT = 48461


class OpcUaTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.stop = threading.Event()
        started = threading.Event()
        cls.idx = None

        def ready(idx):
            cls.idx = idx
            started.set()

        cls.thread = threading.Thread(target=lambda: asyncio.run(serve(PORT, cls.stop, ready)), daemon=True)
        cls.thread.start()
        if not started.wait(30):
            raise RuntimeError("serwer testowy nie wystartowal")

    @classmethod
    def tearDownClass(cls):
        cls.stop.set()
        cls.thread.join(10)

    def _run_source(self, **overrides):
        cfg = config.load("nie-ma-takiego-pliku.json")
        cfg["endpoint"] = "opc.tcp://127.0.0.1:%d" % PORT
        cfg.update(overrides)
        state = SharedState()
        source = OpcUaSource(cfg, state)
        source.start()
        xs = set()
        deadline = time.monotonic() + 30
        try:
            while time.monotonic() < deadline:
                seq, values, status, connected = state.snapshot()
                if connected and values:
                    xs.add(round(values["x"], 3))
                    if seq > 30 and len(xs) > 5:
                        break
                time.sleep(0.05)
        finally:
            source.stop()
            source.join(10)
        return source, values, status, connected, xs

    def test_browse_finds_all_variables(self):
        source, values, status, connected, xs = self._run_source()
        self.assertTrue(connected, status)
        self.assertEqual(set(values), set(config.VARIABLES))
        self.assertGreater(len(xs), 5, "pozycja X sie nie zmienia")
        self.assertIn("|var|%s.Application.HMI2.fXActualPosition" % DEVICE, source.resolved["x"])
        self.assertIsInstance(values["cut_step"], int)

    def test_node_prefix(self):
        prefix = "ns=%d;s=|var|%s.Application." % (self.idx, DEVICE)
        source, values, status, connected, xs = self._run_source(node_prefix=prefix)
        self.assertTrue(connected, status)
        self.assertEqual(set(values), set(config.VARIABLES))

    def test_missing_required_variable(self):
        variables = dict(config.VARIABLES, x="HMI2.fNieMaTakiejZmiennej")
        cfg = config.load("nie-ma-takiego-pliku.json")
        cfg.update(endpoint="opc.tcp://127.0.0.1:%d" % PORT, variables=variables)
        state = SharedState()
        source = OpcUaSource(cfg, state)
        source.start()
        deadline = time.monotonic() + 20
        try:
            while time.monotonic() < deadline:
                status = state.snapshot()[2]
                if "brak zmiennych" in status:
                    break
                time.sleep(0.1)
        finally:
            source.stop()
            source.join(10)
        self.assertIn("HMI2.fNieMaTakiejZmiennej", status)


if __name__ == "__main__":
    unittest.main()
