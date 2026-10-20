"""Zapis wycietego materialu - pojedyncze ciecia tarcza.

Jedno ciecie = jedna plaszczyzna tarczy (stale A, B i polozenie w poprzek).
W tej plaszczyznie trzymana jest obwiednia glebokosci e(s): dla kazdego
punktu s wzdluz linii ciecia najwieksza glebokosc (wzdluz d, od gornej
powierzchni materialu), na jaka zeszla tarcza w ktorejkolwiek probce.
Z obwiedni powstaje sciana rzazu (wycinek tarczy przeciagniety wzdluz
ciecia) i pasek rzazu na gornej powierzchni materialu.
"""
import math

from .geometry import add, mul, sub, dot, blade_frame, penetration

ANGLE_TOL = math.radians(0.3)     # zmiana A / B wieksza = nowe ciecie
MIN_PENETRATION = 0.05            # mm - ponizej tego tarcza nie tnie


class Cut:
    def __init__(self, frame, machine, resolution):
        self.origin = frame.center
        self.u = frame.u
        self.d = frame.d
        self.normal = frame.normal
        self.cos_b = max(frame.cos_b, 0.05)
        self.res = resolution
        # gorna powierzchnia materialu w plaszczyznie tarczy: t = b_top (wzdluz d od origin)
        self.b_top = (self.origin[2] - machine.top_z) / self.cos_b
        self.t_bottom = machine.material_thickness / self.cos_b
        self.blade_width = machine.blade_width
        self.bins = {}            # indeks s -> glebokosc e (mm wzdluz d od gornej powierzchni)
        self.max_depth = 0.0      # mm w pionie

    def same_direction(self, u, normal):
        return dot(self.u, u) >= math.cos(ANGLE_TOL) and dot(self.normal, normal) >= math.cos(ANGLE_TOL)

    def matches(self, frame):
        if not self.same_direction(frame.u, frame.normal):
            return False
        off = abs(dot(sub(frame.center, self.origin), self.normal))
        return off <= max(0.5, self.blade_width / 2.0)

    def add_sample(self, frame):
        rel = sub(frame.center, self.origin)
        s_i = dot(rel, self.u)
        m_i = dot(rel, self.d)
        r = frame.radius
        lowest = m_i + r - self.b_top
        if lowest <= 0:
            return False
        changed = False
        k0 = int(math.floor((s_i - r) / self.res))
        k1 = int(math.ceil((s_i + r) / self.res))
        bins = self.bins
        for k in range(k0, k1 + 1):
            ds = k * self.res - s_i
            h = r * r - ds * ds
            if h <= 0:
                continue
            e = m_i + math.sqrt(h) - self.b_top
            if e <= 0:
                continue
            if e > self.t_bottom:
                e = self.t_bottom
            if e > bins.get(k, 0.0) + 1e-6:
                bins[k] = e
                changed = True
        if changed:
            self.max_depth = max(self.max_depth, min(lowest, self.t_bottom) * self.cos_b)
        return changed

    def _point(self, s, e):
        return add(self.origin, add(mul(self.u, s), mul(self.d, self.b_top + e)))

    def runs(self):
        """Ciagle odcinki obwiedni: lista list (s, e)."""
        out, run, last = [], [], None
        for k in sorted(self.bins):
            if last is not None and k != last + 1:
                out.append(run)
                run = []
            run.append((k * self.res, self.bins[k]))
            last = k
        if run:
            out.append(run)
        return out

    def wall_polygons(self, max_points=160):
        """Sciany rzazu (wycinek tarczy w materiale) - wielokaty 3D."""
        polys = []
        for run in self.runs():
            step = max(1, len(run) // max_points)
            pts = run[::step]
            if pts[-1] != run[-1]:
                pts.append(run[-1])
            top = [self._point(pts[0][0], 0.0), self._point(pts[-1][0], 0.0)]
            bottom = [self._point(s, e) for s, e in reversed(pts)]
            polys.append(top + bottom)
        return polys

    def top_bands(self):
        """Rzaz na gornej powierzchni materialu (szerokosc tarczy) - wielokaty 3D."""
        half = (self.blade_width / 2.0) / self.cos_b
        # poziomy kierunek w poprzek linii ciecia
        across = (self.u[1], -self.u[0], 0.0)
        bands = []
        for run in self.runs():
            p0 = self._point(run[0][0], 0.0)
            p1 = self._point(run[-1][0], 0.0)
            bands.append([add(p0, mul(across, half)), add(p1, mul(across, half)),
                          add(p1, mul(across, -half)), add(p0, mul(across, -half))])
        return bands


class CutRecorder:
    """Zbiera probki pozycji i buduje ciecia."""

    def __init__(self, resolution=1.0, max_cuts=50):
        self.resolution = resolution
        self.max_cuts = max_cuts
        self.cuts = []
        self.version = 0          # rosnie przy kazdej zmianie (do odswiezania widoku)

    def clear(self):
        self.cuts = []
        self.version += 1

    def update(self, pose, machine):
        frame = blade_frame(pose, machine)
        if penetration(frame, machine) <= MIN_PENETRATION or machine.disc_diameter <= 0:
            return False
        cut = self.cuts[-1] if self.cuts and self.cuts[-1].matches(frame) else None
        if cut is None:
            cut = next((c for c in reversed(self.cuts) if c.matches(frame)), None)
        if cut is None:
            cut = Cut(frame, machine, self.resolution)
            self.cuts.append(cut)
            if len(self.cuts) > self.max_cuts:
                self.cuts.pop(0)
        if cut.add_sample(frame):
            self.version += 1
            return True
        return False

    def summary(self):
        """Ostatnie ciecie (wszystkie plaszczyzny o tym samym A i B - przy wychyle kazda
        glebokosc lezy w troche innej plaszczyznie): (dlugosc, glebokosc, liczba ciec) albo None."""
        if not self.cuts:
            return None
        last = self.cuts[-1]
        group = [c for c in self.cuts if c.same_direction(last.u, last.normal)]
        along = [dot(c._point(s, 0.0), last.u) for c in group for run in c.runs() for s in (run[0][0], run[-1][0])]
        count, prev = 0, None
        for c in self.cuts:
            if prev is None or not c.same_direction(prev.u, prev.normal):
                count += 1
            prev = c
        return max(along) - min(along), max(c.max_depth for c in group), count

    def bounds(self):
        """Zakres XY wszystkich ciec (min_x, min_y, max_x, max_y) albo None."""
        pts = []
        for cut in self.cuts:
            for band in cut.top_bands():
                pts.extend(band)
        if not pts:
            return None
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        return min(xs), min(ys), max(xs), max(ys)
