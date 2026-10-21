// Widok 3D (three.js): material, tarcza z obrotem A i wychylem B, wyciety rzaz.
// Uklad swiata: x = X, y = Y, z = -Z (do gory), jak w shared/geometry.js.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { bladeFrame, topZ } from '../shared/geometry.js';

const COLORS = {
  background: 0xeef1f4,
  material: 0xcdc6b8,
  materialEdge: 0x8d877a,
  wall: 0x5b4636,
  kerf: 0x2a211b,
  blade: 0x8fa6c1,
  bladeEdge: 0x1f5fa8,
  lowest: 0xd62728,
  axis: 0x555555,
  grid: 0xc9d0d8,
};

const v3 = (p) => new THREE.Vector3(p[0], p[1], p[2]);

export class View3D {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.background);
    this.camera = new THREE.PerspectiveCamera(35, 1, 5, 200000);
    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.addEventListener('change', () => this.render());

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-1500, -2500, 4000);
    this.scene.add(sun);

    this.materialGroup = new THREE.Group();
    this.cutsGroup = new THREE.Group();
    this.bladeGroup = this.buildBlade();
    this.scene.add(this.materialGroup, this.cutsGroup, this.bladeGroup);

    this.wallMat = new THREE.MeshStandardMaterial({ color: COLORS.wall, side: THREE.DoubleSide, roughness: 1 });
    this.kerfMat = new THREE.MeshBasicMaterial({ color: COLORS.kerf, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    this.extentKey = '';
    this.cutsVersion = -1;
    this.bladeKey = '';
    this.viewName = 'iso';
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  // --- material ---------------------------------------------------------------

  setMaterial(extent, m) {
    const key = JSON.stringify([extent, m.materialHeight, m.materialThickness]);
    if (key === this.extentKey) return;
    this.extentKey = key;
    disposeGroup(this.materialGroup);
    if (!extent) return;
    const [x0, y0, x1, y1] = extent;
    const top = topZ(m);
    const thick = Math.max(m.materialThickness, 1);
    const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, thick);
    const box = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: COLORS.material, roughness: 0.9, transparent: true, opacity: 0.72, depthWrite: false,
    }));
    box.position.set((x0 + x1) / 2, (y0 + y1) / 2, top - thick / 2);
    box.renderOrder = 2;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: COLORS.materialEdge }));
    edges.position.copy(box.position);
    const size = Math.max(x1 - x0, y1 - y0) * 1.4;
    const grid = new THREE.GridHelper(size, Math.max(4, Math.round(size / 100)), COLORS.grid, COLORS.grid);
    grid.rotation.x = Math.PI / 2;
    grid.position.set((x0 + x1) / 2, (y0 + y1) / 2, top - thick - 1);
    this.materialGroup.add(grid, box, edges);
  }

  // --- ciecia -----------------------------------------------------------------

  setCuts(recorder) {
    if (recorder.version === this.cutsVersion) return;
    this.cutsVersion = recorder.version;
    disposeGroup(this.cutsGroup);
    const { wallMat, kerfMat } = this;
    for (const cut of recorder.cuts) {
      const half = cut.bladeWidth / 2;
      for (const offset of [-half, half]) {
        for (const strip of cut.wallStrips(offset)) this.cutsGroup.add(stripMesh(strip, wallMat));
      }
      for (const band of cut.topBands()) {
        const geo = new THREE.BufferGeometry().setFromPoints(band.map((p) => v3([p[0], p[1], p[2] + 0.3])));
        geo.setIndex([0, 1, 2, 0, 2, 3]);
        this.cutsGroup.add(new THREE.Mesh(geo, kerfMat));
      }
    }
  }

  // --- tarcza -----------------------------------------------------------------

  buildBlade() {
    const g = new THREE.Group();
    this.disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96, 1),
      new THREE.MeshStandardMaterial({ color: COLORS.blade, metalness: 0.6, roughness: 0.35, transparent: true, opacity: 0.55, depthWrite: false }));
    this.disc.renderOrder = 3;
    this.discEdge = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COLORS.bladeEdge }));
    this.hub = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32, 1), new THREE.MeshStandardMaterial({ color: 0x2f4f78, metalness: 0.5, roughness: 0.4 }));
    this.spindle = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COLORS.bladeEdge }));
    this.axisA = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: COLORS.axis, dashSize: 12, gapSize: 8 }));
    this.lowest = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: COLORS.lowest }));
    g.add(this.disc, this.discEdge, this.hub, this.spindle, this.axisA, this.lowest);
    return g;
  }

  setBlade(pose, m, visible) {
    this.bladeGroup.visible = Boolean(visible && pose);
    if (!this.bladeGroup.visible) return;
    const f = bladeFrame(pose, m);
    const r = f.radius;
    // walec three.js ma os wzdluz Y - obrot do normalnej tarczy
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v3(f.normal));
    this.disc.quaternion.copy(q);
    this.disc.scale.set(r, Math.max(m.bladeWidth, 1), r);
    this.disc.position.copy(v3(f.center));
    this.hub.quaternion.copy(q);
    this.hub.scale.set(r * 0.15, Math.max(m.bladeWidth, 1) * 6, r * 0.15);
    this.hub.position.copy(v3(f.center));
    const ring = [];
    for (let i = 0; i < 96; i++) {
      const t = (i / 96) * Math.PI * 2;
      ring.push(v3(f.point(r * Math.cos(t), r * Math.sin(t))));
    }
    this.discEdge.geometry.setFromPoints(ring);
    this.spindle.geometry.setFromPoints([v3(f.pivot), v3(f.center)]);
    this.axisA.geometry.setFromPoints([v3(f.axis), v3([f.axis[0], f.axis[1], f.axis[2] + r * 0.9])]);
    this.axisA.computeLineDistances();
    this.lowest.position.copy(v3(f.lowest));
    this.lowest.scale.setScalar(Math.max(4, r * 0.02));
  }

  // --- kamera -----------------------------------------------------------------

  setView(name) {
    this.viewName = name;
    this.fit();
  }

  // box: [[x0, y0, z0], [x1, y1, z1]]
  fit(box = this.lastBox) {
    if (!box) return;
    this.lastBox = box;
    const lo = v3(box[0]);
    const hi = v3(box[1]);
    const center = lo.clone().add(hi).multiplyScalar(0.5);
    const radius = lo.distanceTo(hi) / 2;
    const dist = Math.max(300, radius / Math.sin((this.camera.fov * Math.PI / 180) / 2) * 1.05);
    const dirs = {
      iso: [-0.45, -0.75, 0.55],
      top: [0, -0.001, 1],
      front: [0, -1, 0.02],
      side: [1, 0, 0.02],
    };
    const dir = new THREE.Vector3(...dirs[this.viewName]).normalize();
    this.controls.target.copy(center);
    this.camera.position.copy(center.clone().add(dir.multiplyScalar(dist)));
    this.controls.update();
    this.render();
  }

  zoom(factor) {
    const t = this.controls.target;
    this.camera.position.sub(t).multiplyScalar(factor).add(t);
    this.controls.update();
    this.render();
  }
}

function stripMesh(strip, material) {
  const pos = [];
  const idx = [];
  strip.forEach(([top, bottom], i) => {
    pos.push(...top, ...bottom);
    if (i > 0) {
      const a = 2 * (i - 1);
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

function disposeGroup(group) {
  for (const obj of [...group.children]) {
    group.remove(obj);
    obj.geometry?.dispose();
  }
}
