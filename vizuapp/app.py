"""VizuApp - wizualizacja ciecia pily (#128).

Okno: widok 3D materialu, tarczy (z obrotem A i wychylem B) i wycietego
rzazu, pasek z pozycjami osi i krokiem CutStep. Dane z PLC przez OPC UA
(albo --demo bez PLC).
"""
import argparse
import math
import sys
import tkinter as tk

from . import config
from .cuts import CutRecorder
from .geometry import Machine, Pose, blade_frame, penetration, add, mul
from .render import Camera, Scene, box_faces, shade

MATERIAL_RGB = (205, 198, 184)
CUT_FILL = "#5b4636"
KERF_FILL = "#2a211b"
BLADE = "#1f5fa8"
LOWEST = "#d62728"
GRID = "#d5dae0"
BG = "#eef1f4"

FONT = ("Segoe UI", 13)
FONT_BTN = ("Segoe UI", 13, "bold")
FONT_MONO = ("Consolas", 14)


class VizuApp:
    def __init__(self, root, cfg, state):
        self.root = root
        self.cfg = cfg
        self.state = state
        self.machine = Machine()
        self.pose = None
        self.recorder = CutRecorder()
        self.camera = Camera()
        self.extent = None          # (x0, y0, x1, y1) materialu
        self.extent_provisional = True
        self.last_seq = -1
        self.last_cut_start = False
        self.fitted = False
        self.dirty = True
        self.values = {}
        self.show_blade = tk.BooleanVar(value=True)
        self._drag = None

        root.title("VizuApp - wizualizacja cięcia")
        root.configure(bg=BG)
        root.geometry("1280x800")
        if cfg.get("fullscreen"):
            root.attributes("-fullscreen", True)

        bar = tk.Frame(root, bg=BG)
        bar.pack(side="top", fill="x", padx=6, pady=4)
        for text, cmd in (("Izometria", lambda: self.set_view("iso")), ("Góra", lambda: self.set_view("top")),
                          ("Przód", lambda: self.set_view("front")), ("Bok", lambda: self.set_view("side")),
                          ("Dopasuj", self.fit), ("+", lambda: self.zoom(0.8)), ("−", lambda: self.zoom(1.25)),
                          ("Wyczyść", self.clear)):
            tk.Button(bar, text=text, command=cmd, font=FONT_BTN, width=max(3, len(text) + 1),
                      relief="groove", bg="white").pack(side="left", padx=3, ipady=4)
        tk.Checkbutton(bar, text="Tarcza", variable=self.show_blade, font=FONT, bg=BG,
                       command=self.invalidate).pack(side="left", padx=10)
        tk.Button(bar, text="Zamknij", command=root.destroy, font=FONT_BTN, relief="groove",
                  bg="white").pack(side="right", padx=3, ipady=4)

        status = tk.Frame(root, bg="#dfe4ea")
        status.pack(side="bottom", fill="x")
        self.lbl_conn = tk.Label(status, font=FONT, bg="#dfe4ea", anchor="w")
        self.lbl_conn.pack(side="left", padx=8, pady=4)
        self.lbl_step = tk.Label(status, font=FONT, bg="#dfe4ea", anchor="e")
        self.lbl_step.pack(side="right", padx=8)
        self.lbl_pos = tk.Label(root, font=FONT_MONO, bg="#dfe4ea", anchor="w")
        self.lbl_pos.pack(side="bottom", fill="x", ipadx=8, ipady=2)

        self.canvas = tk.Canvas(root, bg=BG, highlightthickness=0)
        self.canvas.pack(side="top", fill="both", expand=True)

        c = self.canvas
        c.bind("<Configure>", lambda e: self.invalidate())
        c.bind("<ButtonPress-1>", self._press)
        c.bind("<ButtonPress-3>", self._press)
        c.bind("<B1-Motion>", lambda e: self._motion(e, pan=bool(e.state & 0x0001)))
        c.bind("<B3-Motion>", lambda e: self._motion(e, pan=True))
        c.bind("<MouseWheel>", lambda e: self.zoom(0.9 if e.delta > 0 else 1.1))
        c.bind("<Double-Button-1>", lambda e: self.fit())
        root.bind("<Escape>", lambda e: root.attributes("-fullscreen", False))

        self.tick()

    # --- obsluga widoku -------------------------------------------------------

    def invalidate(self):
        self.dirty = True

    def set_view(self, name):
        self.camera.view(name)
        self.fit()

    def zoom(self, factor):
        self.camera.zoom(factor)
        self.invalidate()

    def clear(self):
        self.recorder.clear()
        self.extent = None
        self.extent_provisional = True
        self.invalidate()

    def fit(self):
        lo, hi = self._scene_box()
        if lo is not None:
            self.camera.fit(lo, hi)
        self.invalidate()

    def _press(self, event):
        self._drag = (event.x, event.y)

    def _motion(self, event, pan):
        if self._drag is None:
            return
        dx, dy = event.x - self._drag[0], event.y - self._drag[1]
        self._drag = (event.x, event.y)
        if pan:
            self.camera.pan(dx, dy, self.canvas.winfo_height())
        else:
            self.camera.orbit(dx, dy)
        self.invalidate()

    # --- dane -----------------------------------------------------------------

    def tick(self):
        seq, values, status, connected = self.state.snapshot()
        if seq != self.last_seq:
            self.last_seq = seq
            self.values = values
            self._apply(values)
        self.lbl_conn.config(text=status, fg="#1a7f37" if connected else "#b42318")
        if self.dirty:
            self.dirty = False
            self.redraw()
        self.root.after(40, self.tick)

    def _apply(self, v):
        m = self.machine
        for key in ("disc_diameter", "blade_width", "cut_tilt_diameter", "head_rotation_diameter",
                    "material_height", "material_thickness"):
            if isinstance(v.get(key), (int, float)):
                setattr(m, key, float(v[key]))
        try:
            self.pose = Pose(float(v["x"]), float(v["y"]), float(v["z"]), float(v["a"]), float(v["b"]))
        except (KeyError, TypeError, ValueError):
            return
        cut_start = bool(v.get("cut_start", False))
        if cut_start and not self.last_cut_start and self.cfg.get("auto_clear_on_start", True):
            self.clear()
        self.last_cut_start = cut_start
        self.recorder.update(self.pose, m)
        self._grow_extent()
        if not self.fitted:
            self.fitted = True
            self.fit()
        self._update_labels()
        self.invalidate()

    def _grow_extent(self):
        margin = float(self.cfg.get("material_margin", 300.0))
        min_w, min_h = self.cfg.get("material_min_size", [1200.0, 800.0])
        frame = blade_frame(self.pose, self.machine)
        lx, ly = frame.lowest[0], frame.lowest[1]
        in_material = penetration(frame, self.machine) > 0
        # material wokol tarczy; dopoki tarcza nie weszla w material - tymczasowo (jedzie za tarcza)
        if self.extent is None or self.extent_provisional:
            refit = self.extent is not None and in_material
            self.extent = (lx - min_w / 2, ly - min_h / 2, lx + min_w / 2, ly + min_h / 2)
            self.extent_provisional = not in_material
            if refit:
                self.fit()
        x0, y0, x1, y1 = self.extent
        b = self.recorder.bounds()
        if b:
            x0, y0 = min(x0, b[0] - margin), min(y0, b[1] - margin)
            x1, y1 = max(x1, b[2] + margin), max(y1, b[3] + margin)
        if in_material:
            x0, y0 = min(x0, lx - margin), min(y0, ly - margin)
            x1, y1 = max(x1, lx + margin), max(y1, ly + margin)
        self.extent = (x0, y0, x1, y1)

    def _update_labels(self):
        p = self.pose
        frame = blade_frame(p, self.machine)
        depth = penetration(frame, self.machine)
        self.lbl_pos.config(text="X %8.1f  Y %8.1f  Z %7.1f  A %6.1f°  B %5.1f°  głęb. %6.1f mm"
                            % (p.x, p.y, p.z, p.a, p.b, max(0.0, depth)))
        step = self.values.get("cut_step")
        text = ""
        if step is not None:
            try:
                step = int(step)
                text = "CutStep: %s" % config.CUT_STEPS.get(step, step)
            except (TypeError, ValueError):
                text = "CutStep: %s" % step
        if self.values.get("saw_running"):
            text += "   piła ON"
        if self.values.get("water_cut"):
            text += "   woda"
        self.lbl_step.config(text=text)

    # --- scena ----------------------------------------------------------------

    def _scene_box(self):
        if self.extent is None:
            return None, None
        x0, y0, x1, y1 = self.extent
        top = self.machine.top_z
        lo = (x0, y0, top - self.machine.material_thickness)
        hi = (x1, y1, top + self.machine.radius * 0.6)
        return lo, hi

    def redraw(self):
        scene = Scene()
        if self.extent is not None:
            self._add_material(scene)
            self._add_cuts(scene)
        if self.pose is not None and self.show_blade.get():
            self._add_blade(scene)
        scene.draw(self.canvas, self.camera)
        self._overlay()

    def _add_material(self, scene):
        x0, y0, x1, y1 = self.extent
        top = self.machine.top_z
        bottom = top - max(self.machine.material_thickness, 1.0)
        step = 100.0
        gx0, gy0 = math.floor(x0 / step) * step, math.floor(y0 / step) * step
        gx = gx0
        while gx <= x1 + 1e-6:
            scene.line(0, [(gx, y0, bottom), (gx, y1, bottom)], GRID)
            gx += step
        gy = gy0
        while gy <= y1 + 1e-6:
            scene.line(0, [(x0, gy, bottom), (x1, gy, bottom)], GRID)
            gy += step
        _, eye = self.camera.projector(1, 1)
        for pts, normal in box_faces((x0, y0, bottom), (x1, y1, top)):
            center = tuple(sum(c) / 4.0 for c in zip(*pts))
            to_eye = (eye[0] - center[0], eye[1] - center[1], eye[2] - center[2])
            if to_eye[0] * normal[0] + to_eye[1] * normal[1] + to_eye[2] * normal[2] <= 0:
                continue
            scene.polygon(1, pts, shade(MATERIAL_RGB, normal), outline="#8d877a")

    def _add_cuts(self, scene):
        for cut in self.recorder.cuts:
            for band in cut.top_bands():
                scene.polygon(2, [add(p, (0.0, 0.0, 0.2)) for p in band], KERF_FILL, outline=KERF_FILL)
            for wall in cut.wall_polygons():
                scene.polygon(2, wall, CUT_FILL, outline="#3c2e23")

    def _add_blade(self, scene):
        frame = blade_frame(self.pose, self.machine)
        half = self.machine.blade_width / 2.0
        scene.polygon(3, frame.circle(offset=-half), "", outline="#7f9cc0", width=1)
        scene.polygon(3, frame.circle(offset=half), "", outline=BLADE, width=2)
        hub = 0.15 * frame.radius
        hub_pts = [add(frame.center, add(mul(frame.u, hub * math.cos(t * math.pi / 12)),
                                         mul(frame.d, hub * math.sin(t * math.pi / 12)))) for t in range(24)]
        scene.polygon(3, hub_pts, "", outline=BLADE, width=2)
        # wrzeciono (os wychylu -> srodek tarczy) i pionowa os obrotu A
        scene.line(3, [frame.pivot, frame.center], BLADE, width=3)
        axis = (self.pose.x, self.pose.y, -self.pose.z)
        scene.line(3, [axis, add(axis, (0.0, 0.0, frame.radius * 0.8))], "#555555", width=3, dash=(6, 4))
        low = frame.lowest
        scene.line(3, [add(low, mul(frame.u, -12.0)), add(low, mul(frame.u, 12.0))], LOWEST, width=3)
        scene.line(3, [add(low, mul(frame.d, -12.0)), add(low, mul(frame.d, 12.0))], LOWEST, width=3)

    def _overlay(self):
        c = self.canvas
        c.delete("overlay")
        summary = self.recorder.summary()
        if summary:
            text = "Cięcie: długość %.0f mm, głębokość %.1f mm (cięć: %d)" % summary
        else:
            text = "Brak cięcia - tarcza nad materiałem"
        c.create_text(12, 10, text=text, anchor="nw", font=FONT, fill="#333333", tags="overlay")
        m = self.machine
        c.create_text(12, 34, anchor="nw", font=("Segoe UI", 11), fill="#555555", tags="overlay",
                      text="Tarcza Ø%.0f × %.1f mm, materiał: góra Z %.1f, grubość %.1f mm"
                      % (m.disc_diameter, m.blade_width, m.material_height, m.material_thickness))


def _dpi_aware():
    if sys.platform == "win32":
        try:
            import ctypes
            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except Exception:
            pass


def _screenshot(root, path):
    from PIL import ImageGrab
    root.update()
    x, y = root.winfo_rootx(), root.winfo_rooty()
    w, h = root.winfo_width(), root.winfo_height()
    ImageGrab.grab(bbox=(x, y, x + w, y + h)).save(path)


def main(argv=None):
    parser = argparse.ArgumentParser(prog="VizuApp", description="Wizualizacja cięcia piły (OPC UA)")
    parser.add_argument("--config", help="plik config.json (domyślnie obok programu)")
    parser.add_argument("--endpoint", help="adres serwera OPC UA, np. opc.tcp://localhost:4840")
    parser.add_argument("--demo", action="store_true", help="symulacja cięcia bez PLC")
    parser.add_argument("--demo-start", type=float, default=0.0, help="(demo) start symulacji od tej sekundy")
    parser.add_argument("--view", choices=("iso", "top", "front", "side"), default="iso")
    parser.add_argument("--screenshot", help="(test) zapisz zrzut okna do pliku PNG i zakończ")
    parser.add_argument("--after", type=float, default=8.0, help="(test) po ilu sekundach zrzut")
    args = parser.parse_args(argv)

    cfg = config.load(args.config)
    if args.endpoint:
        cfg["endpoint"] = args.endpoint

    from .source_opcua import SharedState
    state = SharedState()
    if args.demo:
        from .simulator import SimulatorSource
        source = SimulatorSource(cfg, state, args.demo_start)
    else:
        from .source_opcua import OpcUaSource
        source = OpcUaSource(cfg, state)
    source.start()

    _dpi_aware()
    root = tk.Tk()
    app = VizuApp(root, cfg, state)
    app.camera.view(args.view)
    if args.screenshot:
        def shot():
            app.fit()
            app.redraw()
            try:
                _screenshot(root, args.screenshot)
            finally:
                root.destroy()
        root.after(int(args.after * 1000), shot)
    root.mainloop()
    source.stop()


if __name__ == "__main__":
    main()
