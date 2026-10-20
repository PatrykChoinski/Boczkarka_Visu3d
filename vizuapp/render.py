"""Rzut perspektywiczny i rysowanie sceny na tkinter.Canvas (bez OpenGL).

Wielokaty sortowane od najdalszego (algorytm malarza) w warstwach:
0 - siatka podlogi, 1 - material, 2 - ciecia (zawsze widoczne, jak
przeswietlenie), 3 - tarcza i osie.
"""
import math

from .geometry import add, sub, mul, dot, cross, norm

LIGHT = norm((-0.4, -0.6, 1.0))


class Camera:
    def __init__(self):
        self.target = (0.0, 0.0, 0.0)
        self.yaw = math.radians(-60.0)
        self.pitch = math.radians(35.0)
        self.dist = 2500.0
        self.fov = math.radians(35.0)
        self.near = 10.0

    def basis(self):
        cp = math.cos(self.pitch)
        eye = add(self.target, mul((cp * math.cos(self.yaw), cp * math.sin(self.yaw), math.sin(self.pitch)), self.dist))
        f = norm(sub(self.target, eye))
        r = norm(cross(f, (0.0, 0.0, 1.0)))
        if r == (0.0, 0.0, 0.0):
            r = (1.0, 0.0, 0.0)
        up = cross(r, f)
        return eye, r, up, f

    def projector(self, width, height):
        eye, r, up, f = self.basis()
        focal = (height / 2.0) / math.tan(self.fov / 2.0)
        cx, cy = width / 2.0, height / 2.0
        near = self.near

        def project(p):
            v = (p[0] - eye[0], p[1] - eye[1], p[2] - eye[2])
            depth = v[0] * f[0] + v[1] * f[1] + v[2] * f[2]
            if depth < near:
                return None
            x = v[0] * r[0] + v[1] * r[1] + v[2] * r[2]
            y = v[0] * up[0] + v[1] * up[1] + v[2] * up[2]
            return cx + focal * x / depth, cy - focal * y / depth, depth
        return project, eye

    def orbit(self, dx, dy):
        self.yaw -= dx * 0.008
        self.pitch = max(math.radians(-89.0), min(math.radians(89.0), self.pitch + dy * 0.008))

    def pan(self, dx, dy, height):
        _, r, up, _ = self.basis()
        scale = 2.0 * self.dist * math.tan(self.fov / 2.0) / max(height, 1)
        self.target = add(self.target, add(mul(r, -dx * scale), mul(up, dy * scale)))

    def zoom(self, factor):
        self.dist = max(50.0, min(50000.0, self.dist * factor))

    def view(self, name):
        yaw, pitch = {
            "iso": (-60.0, 35.0),
            "top": (-90.0, 89.0),
            "front": (-90.0, 0.0),
            "side": (0.0, 0.0),
        }[name]
        self.yaw = math.radians(yaw)
        self.pitch = math.radians(pitch)

    def fit(self, lo, hi):
        """Ustaw cel i odleglosc tak, zeby prostopadloscian lo..hi byl widoczny."""
        self.target = mul(add(lo, hi), 0.5)
        radius = 0.5 * math.dist(lo, hi)
        self.dist = max(200.0, radius / math.sin(self.fov / 2.0) * 1.05)


def shade(rgb, normal):
    k = 0.55 + 0.45 * max(0.0, dot(normal, LIGHT))
    return "#%02x%02x%02x" % tuple(min(255, int(c * k)) for c in rgb)


def box_faces(lo, hi):
    """Sciany prostopadloscianu: (wierzcholki, normalna)."""
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    return [
        ([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], (0, 0, 1)),
        ([(x0, y0, z0), (x0, y1, z0), (x1, y1, z0), (x1, y0, z0)], (0, 0, -1)),
        ([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], (0, -1, 0)),
        ([(x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)], (0, 1, 0)),
        ([(x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1)], (-1, 0, 0)),
        ([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], (1, 0, 0)),
    ]


class Scene:
    """Lista elementow do narysowania; draw() rysuje je na canvasie."""

    def __init__(self):
        self.items = []   # (warstwa, typ, punkty3D, opcje)

    def polygon(self, layer, pts, fill, outline="", width=1):
        self.items.append((layer, "polygon", pts, dict(fill=fill, outline=outline, width=width)))

    def line(self, layer, pts, fill, width=1, dash=None):
        opts = dict(fill=fill, width=width)
        if dash:
            opts["dash"] = dash
        self.items.append((layer, "line", pts, opts))

    def text(self, layer, pt, text, fill, font):
        self.items.append((layer, "text", [pt], dict(text=text, fill=fill, font=font)))

    def draw(self, canvas, camera):
        width = max(canvas.winfo_width(), 1)
        height = max(canvas.winfo_height(), 1)
        project, _ = camera.projector(width, height)
        drawn = []
        for layer, kind, pts, opts in self.items:
            proj = [project(p) for p in pts]
            if any(p is None for p in proj):
                continue
            depth = sum(p[2] for p in proj) / len(proj)
            flat = [c for p in proj for c in p[:2]]
            drawn.append((layer, -depth, kind, flat, opts))
        drawn.sort(key=lambda it: (it[0], it[1]))
        canvas.delete("scene")
        for layer, _, kind, flat, opts in drawn:
            if kind == "polygon" and len(flat) >= 6:
                canvas.create_polygon(flat, tags="scene", **opts)
            elif kind == "line" and len(flat) >= 4:
                canvas.create_line(flat, tags="scene", **opts)
            elif kind == "text":
                canvas.create_text(flat[0], flat[1], tags="scene", anchor="sw", **opts)
