"""Geometria glowicy vs formuly PLC (CutST) i zapis ciecia.

python -m unittest discover -s tests   (z katalogu VizuApp)
"""
import math
import random
import unittest

from vizuapp.cuts import CutRecorder
from vizuapp.geometry import Machine, Pose, blade_frame, penetration, plc_axis_xy, plc_axis_z

MACHINE = Machine(disc_diameter=625.0, blade_width=4.0, cut_tilt_diameter=200.0,
                  head_rotation_diameter=100.0, material_height=450.0, material_thickness=40.0)


class GeometryTest(unittest.TestCase):
    def test_lowest_point_on_cut_line_at_depth(self):
        # GetPositions + GetNextDepth: najnizszy punkt tarczy na linii ciecia, na zadanej glebokosci
        rnd = random.Random(1)
        for _ in range(500):
            a = rnd.uniform(-180.0, 180.0)
            b = rnd.uniform(0.0, 60.0)
            lx, ly = rnd.uniform(0, 3000), rnd.uniform(0, 2000)
            depth = rnd.uniform(0.0, 40.0)
            x, y = plc_axis_xy(lx, ly, a, b, MACHINE)
            frame = blade_frame(Pose(x, y, plc_axis_z(depth, b, MACHINE), a, b), MACHINE)
            self.assertAlmostEqual(frame.lowest[0], lx, places=6)
            self.assertAlmostEqual(frame.lowest[1], ly, places=6)
            self.assertAlmostEqual(penetration(frame, MACHINE), depth, places=6)

    def test_tilted_cut_top_line_with_plc_b_offset(self):
        # ciecie pod katem (bManualBAngle): PLC dodaje fBX/YOffset, zeby rzaz na gornej powierzchni
        # byl na zadanej linii - plaszczyzna tarczy musi przecinac gore materialu na tej linii
        rnd = random.Random(2)
        for _ in range(200):
            a = rnd.uniform(-180.0, 180.0)
            b = rnd.uniform(5.0, 60.0)
            lx, ly = rnd.uniform(0, 3000), rnd.uniform(0, 2000)
            depth = rnd.uniform(1.0, 40.0)
            x, y = plc_axis_xy(lx, ly, a, b, MACHINE)
            tan_b = math.tan(math.radians(b))
            x += -math.sin(math.radians(a)) * tan_b * depth
            y += math.cos(math.radians(a)) * tan_b * depth
            frame = blade_frame(Pose(x, y, plc_axis_z(depth, b, MACHINE), a, b), MACHINE)
            # punkt plaszczyzny tarczy pod najnizszym punktem na wysokosci gory materialu
            t = (frame.center[2] - MACHINE.top_z) / frame.cos_b
            top = frame.point(0.0, t)
            self.assertAlmostEqual(top[2], MACHINE.top_z, places=6)
            # odleglosc od zadanej linii (kierunek A) w poziomie = 0
            n = (math.sin(math.radians(a)), -math.cos(math.radians(a)))
            self.assertAlmostEqual((top[0] - lx) * n[0] + (top[1] - ly) * n[1], 0.0, places=6)

    def test_blade_vertical_without_tilt(self):
        frame = blade_frame(Pose(0, 0, 0, 37.0, 0.0), MACHINE)
        self.assertAlmostEqual(frame.normal[2], 0.0)
        self.assertAlmostEqual(frame.d[2], -1.0)


class RecorderTest(unittest.TestCase):
    def _cut(self, a, b, length, depths, recorder=None):
        recorder = recorder or CutRecorder()
        lx0, ly0 = 500.0, 400.0
        for i, depth in enumerate(depths):
            for k in range(0, 101):
                s = length * (k if i % 2 == 0 else 100 - k) / 100.0
                lx = lx0 + math.cos(math.radians(a)) * s
                ly = ly0 + math.sin(math.radians(a)) * s
                x, y = plc_axis_xy(lx, ly, a, b, MACHINE)
                recorder.update(Pose(x, y, plc_axis_z(depth, b, MACHINE), a, b), MACHINE)
        return recorder

    def test_straight_cut_length_and_depth(self):
        rec = self._cut(0.0, 0.0, 600.0, (10.0, 20.0))
        length, depth, count = rec.summary()
        r = MACHINE.radius
        chord = math.sqrt(r * r - (r - 20.0) ** 2)
        self.assertEqual(count, 1)
        self.assertAlmostEqual(depth, 20.0, places=3)
        self.assertAlmostEqual(length, 600.0 + 2 * chord, delta=2.0)

    def test_tilted_cut_is_one_cut(self):
        rec = self._cut(30.0, 45.0, 500.0, (8.0, 16.0, 24.0))
        length, depth, count = rec.summary()
        self.assertEqual(count, 1)
        self.assertAlmostEqual(depth, 24.0, places=3)
        self.assertGreater(length, 500.0)

    def test_depth_clipped_to_material(self):
        rec = self._cut(0.0, 0.0, 300.0, (60.0,))
        self.assertAlmostEqual(rec.summary()[1], MACHINE.material_thickness, places=3)

    def test_above_material_records_nothing(self):
        rec = self._cut(0.0, 0.0, 300.0, (-5.0,))
        self.assertIsNone(rec.summary())


if __name__ == "__main__":
    unittest.main()
