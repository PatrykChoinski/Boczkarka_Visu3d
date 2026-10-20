"""Geometria glowicy pily - jak w PLC (CutST.GetPositions / GetNextDepth).

Uklad maszyny: X, Y poziomo, Z w dol (wieksze Z = nizej), A - obrot glowicy
(kierunek ciecia w XY), B - wychyl tarczy. Uklad swiata w aplikacji: x = X,
y = Y, z = -Z (do gory), zeby rysowac jak zwykla scene 3D.

Model glowicy (wyprowadzony z formul PLC):
  - os obrotu A pionowa przez (X, Y),
  - kierunek ciecia u = (cos A, sin A), poprzecznie n = (sin A, -cos A),
  - os wychylu B pozioma, rownolegla do u, przesunieta od osi A o
    (fParameterHeadRotationDiameter/2 - fParameterCutTiltDiameter/2) wzdluz n,
    na wysokosci Z,
  - srodek tarczy odsuniety od osi wychylu o fParameterCutTiltDiameter/2
    wzdluz osi wrzeciona (normalna tarczy), ktora przy B = 0 jest pozioma (n),
    a przy wychyle B obraca sie w dol: normalna = cos B * n + sin B * dol.

Sprawdzenie (tests/test_geometry.py): najnizszy punkt tarczy lezy na linii
ciecia z GetPositions (fManualX/YZeroPosition), a jego glebokosc pod
fCutMaterialHeight to glebokosc z GetNextDepth.
"""
import math
from dataclasses import dataclass


@dataclass
class Machine:
    """Parametry z HMI (fParameter*) potrzebne do rysowania."""
    disc_diameter: float = 625.0          # fParameterDiscDiameter
    blade_width: float = 4.0              # fParameterBladeWidth
    cut_tilt_diameter: float = 0.0        # fParameterCutTiltDiameter
    head_rotation_diameter: float = 0.0   # fParameterHeadRotationDiameter
    material_height: float = 400.0        # fCutMaterialHeight (Z gornej powierzchni)
    material_thickness: float = 30.0      # fParameterMaterialThickness

    @property
    def radius(self):
        return self.disc_diameter / 2.0

    @property
    def top_z(self):
        """Gorna powierzchnia materialu w ukladzie swiata (z do gory)."""
        return -self.material_height


@dataclass
class Pose:
    """Pozycje osi z PLC (f[XYZAB]ActualPosition)."""
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    a: float = 0.0
    b: float = 0.0


def add(p, q):
    return (p[0] + q[0], p[1] + q[1], p[2] + q[2])


def sub(p, q):
    return (p[0] - q[0], p[1] - q[1], p[2] - q[2])


def mul(p, k):
    return (p[0] * k, p[1] * k, p[2] * k)


def dot(p, q):
    return p[0] * q[0] + p[1] * q[1] + p[2] * q[2]


def cross(p, q):
    return (p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0])


def norm(p):
    length = math.sqrt(dot(p, p))
    return mul(p, 1.0 / length) if length > 1e-12 else (0.0, 0.0, 0.0)


@dataclass
class BladeFrame:
    """Polozenie tarczy w ukladzie swiata."""
    center: tuple      # srodek tarczy
    u: tuple           # kierunek ciecia (poziomo, w plaszczyznie tarczy)
    d: tuple           # "w dol" w plaszczyznie tarczy (do najnizszego punktu)
    normal: tuple      # normalna tarczy (os wrzeciona)
    pivot: tuple       # punkt na osi wychylu
    cos_b: float
    radius: float

    @property
    def lowest(self):
        return add(self.center, mul(self.d, self.radius))

    def point(self, s, t):
        """Punkt plaszczyzny tarczy: s wzdluz u, t wzdluz d od srodka."""
        return add(self.center, add(mul(self.u, s), mul(self.d, t)))

    def circle(self, segments=72, offset=0.0):
        """Obwod tarczy (opcjonalnie przesuniety wzdluz normalnej o offset)."""
        base = add(self.center, mul(self.normal, offset))
        pts = []
        for i in range(segments):
            ang = 2.0 * math.pi * i / segments
            pts.append(add(base, add(mul(self.u, self.radius * math.cos(ang)),
                                     mul(self.d, self.radius * math.sin(ang)))))
        return pts


def blade_frame(pose, machine):
    a = math.radians(pose.a)
    b = math.radians(pose.b)
    u = (math.cos(a), math.sin(a), 0.0)
    n = (math.sin(a), -math.cos(a), 0.0)
    down = (0.0, 0.0, -1.0)
    axis_point = (pose.x, pose.y, -pose.z)
    pivot = add(axis_point, mul(n, machine.head_rotation_diameter / 2.0 - machine.cut_tilt_diameter / 2.0))
    normal = add(mul(n, math.cos(b)), mul(down, math.sin(b)))
    center = add(pivot, mul(normal, machine.cut_tilt_diameter / 2.0))
    d = add(mul(n, -math.sin(b)), mul(down, math.cos(b)))
    return BladeFrame(center=center, u=u, d=d, normal=normal, pivot=pivot,
                      cos_b=math.cos(b), radius=machine.radius)


def penetration(frame, machine):
    """Glebokosc najnizszego punktu tarczy pod gorna powierzchnia materialu (mm, > 0 = w materiale)."""
    return machine.top_z - frame.lowest[2]


# --- formuly z PLC (do testow i symulatora) ----------------------------------

def plc_axis_xy(line_x, line_y, a_deg, b_deg, machine):
    """CutST.GetPositions: pozycja osi X/Y dla punktu linii ciecia (bez fBX/YOffset)."""
    a = math.radians(a_deg)
    b = math.radians(b_deg)
    k = (machine.cut_tilt_diameter / 2.0 - machine.head_rotation_diameter / 2.0
         - math.cos(b) * machine.cut_tilt_diameter / 2.0 + math.sin(b) * machine.disc_diameter / 2.0)
    return line_x + math.sin(a) * k, line_y - math.cos(a) * k


def plc_axis_z(depth, b_deg, machine):
    """CutST.GetNextDepth: pozycja osi Z dla glebokosci ciecia (bez korekt wychylu)."""
    b = math.radians(b_deg)
    return (machine.material_height - math.sin(b) * machine.cut_tilt_diameter / 2.0
            - math.cos(b) * machine.disc_diameter / 2.0 + depth)
