"""Symulator ciecia (tryb --demo i testowy serwer OPC UA).

Ruch jak w CutST: dojazd nad poczatek, zjazd w Z na kolejna glebokosc,
ciecie wzdluz linii, kolejna glebokosc z drugiej strony, wyjazd w Z.
Pozycje osi liczone formulami PLC (geometry.plc_axis_xy / plc_axis_z).
"""
import math
import threading
import time

from .geometry import Machine, plc_axis_xy, plc_axis_z

MACHINE = Machine(disc_diameter=625.0, blade_width=4.0, cut_tilt_diameter=200.0,
                  head_rotation_diameter=100.0, material_height=450.0, material_thickness=40.0)

# (poczatek linii, kat A, wychyl B, dlugosc, glebokosci)
PROGRAMS = [
    ((200.0, 300.0), 0.0, 0.0, 800.0, (10.0, 20.0, 30.0)),
    ((300.0, 450.0), 30.0, 45.0, 700.0, (8.0, 16.0, 24.0)),
    ((900.0, 300.0), 120.0, 30.0, 600.0, (12.0, 24.0, 36.0)),
]

V_CUT = 250.0     # mm/s (przyspieszone)
V_Z = 80.0
V_FAST = 600.0
ABOVE = 50.0      # mm nad materialem


def _waypoints(program, machine):
    (x0, y0), a, b, length, depths = program
    x1 = x0 + math.cos(math.radians(a)) * length
    y1 = y0 + math.sin(math.radians(a)) * length
    ends = [plc_axis_xy(x0, y0, a, b, machine), plc_axis_xy(x1, y1, a, b, machine)]
    z_above = plc_axis_z(-ABOVE, b, machine)
    pts = [(ends[0], z_above, 10, V_FAST)]           # MoveToStartPosition
    side = 0
    for depth in depths:
        z = plc_axis_z(depth, b, machine)
        pts.append((ends[side], z, 20, V_Z))          # StartCutDepth
        side = 1 - side
        pts.append((ends[side], z, 50, V_CUT))        # StartSingleCut
    pts.append((ends[side], z_above, 70, V_Z))        # StartMoveAboveMaterial
    return a, b, pts


class Timeline:
    """Pozycje osi w funkcji czasu (petla po PROGRAMS)."""

    def __init__(self, machine=MACHINE, programs=PROGRAMS, pause=2.0):
        self.machine = machine
        self.segments = []        # (t0, t1, p0, p1, a, b, step)
        t = 0.0
        prev = None
        for program in programs:
            a, b, pts = _waypoints(program, machine)
            if prev is None:
                prev = (pts[0][0], pts[0][1])
            for (xy, z, step, v) in pts:
                dist = math.dist((prev[0][0], prev[0][1], prev[1]), (xy[0], xy[1], z))
                dt = max(dist / v, 0.05)
                self.segments.append((t, t + dt, prev, (xy, z), a, b, step))
                t += dt
                prev = (xy, z)
            self.segments.append((t, t + pause, prev, prev, a, b, 100))   # CutFinish
            t += pause
        self.period = t

    def values(self, t):
        t = t % self.period
        for (t0, t1, p0, p1, a, b, step) in self.segments:
            if t0 <= t < t1:
                k = (t - t0) / (t1 - t0)
                break
        else:
            k = 1.0
        m = self.machine
        (x0, y0), z0 = p0
        (x1, y1), z1 = p1
        return {
            "x": x0 + (x1 - x0) * k, "y": y0 + (y1 - y0) * k, "z": z0 + (z1 - z0) * k,
            "a": a, "b": b,
            "disc_diameter": m.disc_diameter, "blade_width": m.blade_width,
            "cut_tilt_diameter": m.cut_tilt_diameter, "head_rotation_diameter": m.head_rotation_diameter,
            "material_height": m.material_height, "material_thickness": m.material_thickness,
            "cut_step": step, "cut_start": step != 100, "saw_running": step != 100,
            "water_cut": step in (20, 50),
        }


class SimulatorSource(threading.Thread):
    def __init__(self, cfg, state, offset=0.0):
        super().__init__(daemon=True, name="demo")
        self.offset = offset
        self.state = state
        self.timeline = Timeline()
        self._stop_event = threading.Event()
        self.period = max(10, int(cfg.get("poll_ms", 50))) / 1000.0

    def stop(self):
        self._stop_event.set()

    def run(self):
        start = time.monotonic() - self.offset
        self.state.publish(status="Tryb demo (symulacja, bez PLC)", connected=True)
        while not self._stop_event.is_set():
            self.state.publish(values=self.timeline.values(time.monotonic() - start))
            time.sleep(self.period)
