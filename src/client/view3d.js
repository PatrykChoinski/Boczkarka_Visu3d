// Widok 3D (three.js): material, tarcza z obrotem A i wychylem B (obroty tarczy), wyciety rzaz
// (w kamieniu i w stole - na czerwono), laser; w trybach frez / wiercenie / polerowanie narzedzie na wrzecionie
// i jego slad (rowki, otwory, polerowana powierzchnia).
// Uklad swiata: x = X, y = Y, z = -Z (do gory), jak w shared/geometry.js.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { bladeFrame, toolFrame, isToolMode, topZ } from '../shared/geometry.js';
import { MachineModel } from './machine3d.js';
import { planMarks, planDistances } from '../shared/planmarks.js';
import { waterDrops, waterSpray } from '../shared/water.js';
import { toolSpinMarks } from '../shared/toolspin.js';

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
  plan: 0xe07b00,
  planActive: 0xd62728,
  markStart: 0x2e7d32,
  tableWall: 0xc62828,
  tableKerf: 0x7f0000,
  laser: 0xffd400,
  spoke: 0x16365f,
  tooth: 0xd62728,
  toolMark: 0xf4f7fb,
  mill: 0x9aa4ad,
  millEdge: 0x1f5fa8,
  drill: 0x8fa6c1,
  polish: 0x3a3f44,
  polished: 0xf3f6f9,
  holder: 0x5c6670,
};

const v3 = (p) => new THREE.Vector3(p[0], p[1], p[2]);
const dist2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

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
    this.toolGroup = this.buildTool();
    this.machineModel = new MachineModel();
    this.planGroup = new THREE.Group();
    this.laserGroup = new THREE.Group();
    this.scene.add(this.materialGroup, this.cutsGroup, this.bladeGroup, this.toolGroup, this.machineModel.group, this.planGroup, this.laserGroup);
    this.laserMat = new THREE.MeshBasicMaterial({ color: COLORS.laser, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
    // wiazka lasera (wachlarz od modulu na oslonie do linii na materiale)
    this.laserFanMat = new THREE.MeshBasicMaterial({ color: COLORS.laser, side: THREE.DoubleSide, transparent: true, opacity: 0.16, depthWrite: false });
    // woda z dysz na tarcze (krople)
    this.water = new THREE.Group();
    this.waterDrops = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0x3f93e8, size: 16, transparent: true, opacity: 0.9, depthWrite: false }));
    this.waterDrops.frustumCulled = false;
    // mgla wodna przy rozbryzgu (duze, prawie przezroczyste punkty)
    this.waterMist = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0x9fd0ff, size: 110, transparent: true, opacity: 0.22, depthWrite: false }));
    this.waterMist.frustumCulled = false;
    // mokra plama na materiale wzdluz ciecia (polysk)
    this.waterWet = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0x9fb3c4, roughness: 0.08, metalness: 0.35,
      transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    this.waterWet.frustumCulled = false;
    // strumien: polprzezroczysta struga od dyszy do tarczy (przebudowa przy zmianie polozenia)
    const streamMat = new THREE.MeshBasicMaterial({ color: 0x6fb4f5, transparent: true, opacity: 0.45, depthWrite: false });
    this.waterStreams = [0, 1, 2].map(() => new THREE.Mesh(new THREE.BufferGeometry(), streamMat));
    this.waterKey = '';
    this.water.add(this.waterDrops, this.waterMist, this.waterWet, ...this.waterStreams);
    this.water.visible = false;
    this.scene.add(this.water);
    this.laserKey = '';
    this.planMat = new THREE.LineDashedMaterial({ color: COLORS.plan, dashSize: 14, gapSize: 8, depthTest: false, transparent: true, opacity: 0.85 });
    this.planActiveMat = new THREE.LineBasicMaterial({ color: COLORS.planActive, depthTest: false });
    this.planKey = '';

    // warstwy ciec: kamien i stol (ciecie w stol - innym kolorem)
    const kerf = (color) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    this.cutSlots = {
      stone: { wallMat: new THREE.MeshStandardMaterial({ color: COLORS.wall, side: THREE.DoubleSide, roughness: 1 }), kerfMat: kerf(COLORS.kerf) },
      table: { wallMat: new THREE.MeshStandardMaterial({ color: COLORS.tableWall, side: THREE.DoubleSide, roughness: 1 }), kerfMat: kerf(COLORS.tableKerf) },
    };
    this.polishMat = new THREE.MeshStandardMaterial({ color: COLORS.polished, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.75,
      side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 });
    this.extentKey = '';
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

  // Kamien: wielokat z punktow (aCuttingRock) wyciagniety na grubosc, albo prostokat extent (bez punktow)
  setMaterial(extent, m, polygon = null) {
    const key = JSON.stringify([extent, polygon, m.materialHeight, m.materialThickness]);
    if (key === this.extentKey) return;
    this.extentKey = key;
    disposeGroup(this.materialGroup);
    if (!extent) return;
    const [x0, y0, x1, y1] = extent;
    const top = topZ(m);
    const thick = Math.max(m.materialThickness, 1);
    const pts = polygon || [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const geo = prismGeometry(pts, top - thick, thick);
    const box = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: COLORS.material, roughness: 0.9, transparent: true, opacity: 0.72, depthWrite: false,
    }));
    box.renderOrder = 2;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: COLORS.materialEdge }));
    const size = Math.max(x1 - x0, y1 - y0) * 1.4;
    const grid = new THREE.GridHelper(size, Math.max(4, Math.round(size / 100)), COLORS.grid, COLORS.grid);
    grid.rotation.x = Math.PI / 2;
    grid.position.set((x0 + x1) / 2, (y0 + y1) / 2, top - thick - 1);
    this.grid = grid;
    this.materialGroup.add(grid, box, edges);
  }

  // --- ciecia -----------------------------------------------------------------

  // Siatki kazdego ciecia trzymane osobno - przebudowa tylko ciec, ktore sie zmienily (Cut.rev);
  // slot - warstwa 'stone' (kamien) albo 'table' (ciecie w stol, czerwone)
  setCuts(recorder, slot = 'stone') {
    const sl = this.cutSlots[slot];
    if (recorder.version === sl.version) return;
    sl.version = recorder.version;
    sl.meshes ??= new Map();
    const alive = new Set(recorder.cuts);
    for (const [cut, entry] of sl.meshes) {
      if (!alive.has(cut)) { disposeGroup(entry.group); this.cutsGroup.remove(entry.group); sl.meshes.delete(cut); }
    }
    const { wallMat, kerfMat } = sl;
    for (const cut of recorder.cuts) {
      let entry = sl.meshes.get(cut);
      if (entry && entry.rev === cut.rev) continue;
      if (!entry) {
        entry = { group: new THREE.Group(), rev: -1 };
        sl.meshes.set(cut, entry);
        this.cutsGroup.add(entry.group);
      }
      disposeGroup(entry.group);
      entry.rev = cut.rev;
      const half = cut.bladeWidth / 2;
      for (const offset of [-half, half]) {
        for (const strip of cut.wallStrips(offset)) entry.group.add(stripMesh(strip, wallMat));
      }
      for (const band of cut.topBands()) {
        const geo = new THREE.BufferGeometry().setFromPoints(band.map((p) => v3([p[0], p[1], p[2] + 0.3])));
        geo.setIndex([0, 1, 2, 0, 2, 3]);
        entry.group.add(new THREE.Mesh(geo, kerfMat));
      }
    }
  }

  // Slad narzedzia (ToolRecorder): przejscie frezu - rowek o szerokosci srednicy (sciany, dno, pasek na gorze),
  // otwor wiertla - walec, polerka - jasny pasek na powierzchni; slot jak w setCuts
  setToolCuts(recorder, slot = 'stone') {
    const sl = this.cutSlots[slot];
    if (sl.toolVersion === recorder.version) return;
    sl.toolVersion = recorder.version;
    sl.toolMeshes ??= new Map();
    const alive = new Set(recorder.passes);
    for (const [pass, entry] of sl.toolMeshes) {
      if (!alive.has(pass)) { disposeGroup(entry.group); this.cutsGroup.remove(entry.group); sl.toolMeshes.delete(pass); }
    }
    for (const pass of recorder.passes) {
      let entry = sl.toolMeshes.get(pass);
      if (entry && entry.rev === pass.rev) continue;
      if (!entry) {
        entry = { group: new THREE.Group(), rev: -1 };
        sl.toolMeshes.set(pass, entry);
        this.cutsGroup.add(entry.group);
      }
      disposeGroup(entry.group);
      entry.rev = pass.rev;
      buildToolPass(entry.group, pass, pass.polish ? null : sl.wallMat, pass.polish ? this.polishMat : sl.kerfMat);
    }
  }

  // --- plan (linie / tor operacji, kroki automatu) --------------------------------

  // Znaczniki XY: kropka (poczatek - zielona, koniec - czerwona, oba - pomaranczowa) i etykieta "X .. Y .." o stalej
  // wielkosci na ekranie, nad materialem i zawsze widoczne; aktywny krok - etykieta podswietlona
  // show {xy, dist} - znaczniki XY / odleglosci (osobne przelaczniki na gornym pasku)
  addPlanMarks(items, z, show) {
    for (const mk of show.xy ? planMarks(items) : []) {
      const color = mk.start && mk.end ? COLORS.plan : mk.start ? COLORS.markStart : COLORS.planActive;
      const dot = new THREE.Sprite(spriteMaterial(dotTexture(color)));
      dot.scale.set(0.014, 0.014, 1);
      dot.position.set(mk.x, mk.y, z + 2);
      dot.renderOrder = 7;
      const { texture, aspect } = labelTexture(mk.label, mk.active);
      const label = new THREE.Sprite(spriteMaterial(texture));
      const h = 0.03;
      label.scale.set(h * aspect, h, 1);
      // etykieta obok kropki: sam poczatek - w lewo, koniec - w prawo (bliskie punkty poczatku i konca sie nie zaslaniaja)
      label.center.set(mk.start && !mk.end ? 1.08 : -0.08, -0.25);
      label.position.copy(dot.position);
      label.renderOrder = 8;
      this.planGroup.add(dot, label);
    }
    // odleglosci miedzy punktami: etykieta "… mm" w polowie toru akcji (niebieska, aktywny krok - czerwona)
    for (const ds of show.dist ? planDistances(items) : []) {
      const { texture, aspect } = labelTexture(ds.label, ds.active, 'distance');
      const label = new THREE.Sprite(spriteMaterial(texture));
      const h = 0.026;
      label.scale.set(h * aspect, h, 1);
      label.center.set(0.5, 0.5);
      label.position.set(ds.x, ds.y, z + 2);
      label.renderOrder = 8;
      this.planGroup.add(label);
    }
  }

  // items: [{path: [[x, y] | null, ...], marks?, active}], z - wysokosc rysowania (gora materialu); null w sciezce = przerwa;
  // marks - znaczniki poczatku / konca akcji z wartosciami XY (#137)
  // show {xy, dist} - znaczniki XY i odleglosci miedzy punktami
  setPlan(items, z, show = { xy: true, dist: true }) {
    const key = JSON.stringify([items, z, show]);
    if (key === this.planKey) return;
    this.planKey = key;
    disposeGroup(this.planGroup);
    if (show.xy || show.dist) this.addPlanMarks(items, z, show);
    for (const it of items || []) {
      let run = [];
      const flush = () => {
        if (run.length >= 2) {
          const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(run.map(([x, y]) => new THREE.Vector3(x, y, z + 1))),
            it.active ? this.planActiveMat : this.planMat);
          line.computeLineDistances();
          line.renderOrder = 5;
          this.planGroup.add(line);
        }
        run = [];
      };
      for (const p of it.path || []) { if (p) run.push(p); else flush(); }
      flush();
    }
  }

  // --- laser -----------------------------------------------------------------

  // points - linia lasera na powierzchni [[x, y, z], ...] albo null (wylaczony); rysowana jako pasek width mm;
  // mount - polozenie modulu lasera na glowicy [x, y, z] (wiazka - wachlarz do linii) albo null
  setLaser(points, width = 8, mount = null) {
    const key = points ? JSON.stringify([points, mount].map((a) => a && JSON.stringify(a, (k, v) => (typeof v === 'number' ? Math.round(v * 2) / 2 : v)))) : '';
    if (key === this.laserKey) return;
    this.laserKey = key;
    disposeGroup(this.laserGroup);
    if (!points || points.length < 2) return;
    const pos = [];
    const idx = [];
    points.forEach((p, i) => {
      const q = points[Math.min(i + 1, points.length - 1)];
      const r = points[Math.max(i - 1, 0)];
      const dx = q[0] - r[0];
      const dy = q[1] - r[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len * width / 2;
      const ny = dx / len * width / 2;
      pos.push(p[0] + nx, p[1] + ny, p[2] + 0.6, p[0] - nx, p[1] - ny, p[2] + 0.6);
      if (i > 0) { const a = 2 * (i - 1); idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const strip = new THREE.Mesh(geo, this.laserMat);
    strip.renderOrder = 6;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(width, 12, 8), this.laserMat);
    dot.position.copy(v3(points[0]));
    this.laserGroup.add(strip, dot);
    if (mount) {
      const fan = [];
      for (let i = 0; i + 1 < points.length; i++) fan.push(...mount, ...points[i], ...points[i + 1]);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(fan, 3));
      const beam = new THREE.Mesh(g, this.laserFanMat);
      beam.renderOrder = 6;
      this.laserGroup.add(beam);
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
    // szprychy i znacznik zeba - widac obroty tarczy
    this.spokes = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COLORS.spoke }));
    this.tooth = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COLORS.tooth }));
    // geometria linii zmienia sie co klatke - bez obcinania po starej sferze otaczajacej
    for (const l of [this.discEdge, this.spindle, this.axisA, this.spokes, this.tooth]) l.frustumCulled = false;
    g.add(this.disc, this.discEdge, this.hub, this.spindle, this.axisA, this.lowest, this.spokes, this.tooth);
    return g;
  }

  // spin - kat obrotu tarczy [rad] (szprychy); w trybach narzedzi tarcza ukryta (setTool)
  setBlade(pose, m, visible, spin = 0) {
    this.bladeGroup.visible = Boolean(visible && pose && !isToolMode(m));
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
    const spokes = [];
    for (let k = 0; k < 6; k++) {
      const t = spin + k * Math.PI / 3;
      spokes.push(v3(f.point(r * 0.2 * Math.cos(t), r * 0.2 * Math.sin(t))), v3(f.point(r * 0.93 * Math.cos(t), r * 0.93 * Math.sin(t))));
    }
    this.spokes.geometry.setFromPoints(spokes);
    const tooth = [];
    for (let k = 0; k <= 8; k++) {
      const t = spin + (k / 8 - 0.5) * 0.25;
      tooth.push(v3(f.point(r * Math.cos(t), r * Math.sin(t))));
    }
    this.tooth.geometry.setFromPoints(tooth);
    this.spindle.geometry.setFromPoints([v3(f.pivot), v3(f.center)]);
    this.axisA.geometry.setFromPoints([v3(f.axis), v3([f.axis[0], f.axis[1], f.axis[2] + r * 0.9])]);
    this.axisA.computeLineDistances();
    this.lowest.position.copy(v3(f.lowest));
    this.lowest.scale.setScalar(Math.max(4, r * 0.02));
  }

  // --- narzedzie na wrzecionie (frez, wiertlo, polerka) ---------------------------

  buildTool() {
    const g = new THREE.Group();
    const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.4, ...extra });
    // walce three.js maja os Y; czesci ustawiane w setTool
    this.toolBody = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 48, 1), std(COLORS.mill));
    this.toolShank = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32, 1), std(COLORS.holder));
    this.toolTube = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 48, 1, true), std(COLORS.drill, { side: THREE.DoubleSide }));
    this.toolPad = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 48, 1), std(COLORS.polish, { metalness: 0.1, roughness: 0.8 }));
    this.toolFace = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COLORS.millEdge }));
    // znaczniki obrotu (ostrza frezu, segmenty koronki, sektory polerki) i wyrozniony znacznik
    this.toolMarks = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COLORS.toolMark }));
    this.toolMark = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COLORS.tooth }));
    this.toolAxisA = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: COLORS.axis, dashSize: 12, gapSize: 8 }));
    this.toolLowest = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: COLORS.lowest }));
    // geometria linii zmienia sie co klatke - bez obcinania po starej sferze otaczajacej
    for (const l of [this.toolMarks, this.toolMark, this.toolFace, this.toolAxisA]) l.frustumCulled = false;
    g.add(this.toolBody, this.toolShank, this.toolTube, this.toolPad, this.toolFace, this.toolMarks, this.toolMark, this.toolAxisA, this.toolLowest);
    g.visible = false;
    return g;
  }

  // Narzedzie trybu m.mode: frez - chwyt + czesc robocza, wiertlo - koronka (rura), polerka - talerz na uchwycie;
  // spin - kat obrotu wrzeciona [rad]: obracaja sie ostrza frezu, segmenty koronki, sektory polerki (toolSpinMarks)
  setTool(pose, m, visible, spin = 0) {
    this.toolGroup.visible = Boolean(visible && pose && isToolMode(m));
    if (!this.toolGroup.visible) return;
    const f = toolFrame(pose, m);
    const r = Math.max(f.radius, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v3(f.normal));
    const at = (k) => v3(f.flange.map((c, i) => c + f.normal[i] * k));   // punkt na osi narzedzia k mm od kolnierza
    const place = (mesh, k0, k1, rad) => {
      mesh.visible = true;
      mesh.quaternion.copy(q);
      mesh.scale.set(rad, Math.max(k1 - k0, 0.5), rad);
      mesh.position.copy(at((k0 + k1) / 2));
    };
    for (const part of [this.toolBody, this.toolShank, this.toolTube, this.toolPad]) part.visible = false;
    const marks = toolSpinMarks(f, m.mode, spin);
    const lay = marks.layout;
    const work = { drill: this.toolTube, polishing: this.toolPad, mill: this.toolBody }[lay.kind];
    place(this.toolShank, ...lay.shank);
    place(work, ...lay.work);
    // obwod czola i znaczniki obrotu
    const rim = (t) => v3(f.tip.map((c, i) => c + r * (Math.cos(t) * f.d[i] + Math.sin(t) * f.u[i])));
    this.toolFace.geometry.setFromPoints(Array.from({ length: 64 }, (_, i) => rim((i / 64) * Math.PI * 2)));
    this.toolMarks.geometry.setFromPoints(marks.lines.map(v3));
    this.toolMark.geometry.setFromPoints(marks.accent.map(v3));
    this.toolAxisA.geometry.setFromPoints([v3(f.axis), v3([f.axis[0], f.axis[1], f.axis[2] + 400])]);
    this.toolAxisA.computeLineDistances();
    this.toolLowest.position.copy(v3(f.lowest));
    this.toolLowest.scale.setScalar(Math.max(4, r * 0.08));
  }

  // Woda (#141): layout z waterLayout (dysze -> poczatek tarczy / narzedzie) albo null, on - woda leci (zawor + obroty),
  // phase - czas [s] (ruch kropli); kierunek obrotu (rozbryzg) w layout.spray (waterLayout z kierunkiem obrotu)
  setWater(layout, on, phase = 0) {
    this.water.visible = Boolean(layout && on);
    if (!this.water.visible) return;
    const { drops, mist } = waterSpray(layout, phase % 1000);
    this.waterDrops.geometry.setAttribute('position', new THREE.Float32BufferAttribute(drops, 3));
    this.waterMist.geometry.setAttribute('position', new THREE.Float32BufferAttribute(mist, 3));
    // mokra plama: prostokat od tarczy wzdluz ciecia w strone rozbryzgu, na gorze materialu
    const wet = layout.spray?.wet;
    this.waterWet.visible = Boolean(wet);
    if (wet) {
      const [o, dir, len, wid] = wet;
      const z = layout.spray.top + 0.8;
      const ax = [dir[0], dir[1]];
      const l = Math.hypot(...ax) || 1;
      const ux = ax[0] / l;
      const uy = ax[1] / l;
      const px = -uy * wid / 2;
      const py = ux * wid / 2;
      const a = [o[0] - ux * 0.3 * len, o[1] - uy * 0.3 * len];
      const b = [o[0] + ux * len, o[1] + uy * len];
      const pos = [a[0] + px, a[1] + py, z, a[0] - px, a[1] - py, z, b[0] - px * 1.6, b[1] - py * 1.6, z, b[0] + px * 1.6, b[1] + py * 1.6, z];
      this.waterWet.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      this.waterWet.geometry.setIndex([0, 1, 2, 0, 2, 3]);
      this.waterWet.geometry.computeVertexNormals();
    }
    const key = JSON.stringify([layout.nozzles, layout.targets].map((a) => a.map((p) => p.map((c) => Math.round(c)))));
    if (key !== this.waterKey) {
      this.waterKey = key;
      this.waterStreams.forEach((st, i) => { st.visible = i < layout.nozzles.length; });
      layout.nozzles.forEach((n, i) => {
        // os strugi bez rozrzutu kropli (spread 0), rurka zwezajaca sie nie jest potrzebna - stala 6 mm
        const axis = waterDrops(n, layout.targets[i], 16, 0, 0).sort((p, q) => dist2(p, n) - dist2(q, n));
        axis.push(layout.targets[i]);
        this.waterStreams[i].geometry.dispose();
        this.waterStreams[i].geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(axis.map(v3)), 24, 9, 8, false);
      });
    }
  }

  // glowica i suport (pila mostowa); extra - {laser: {side, mountAngle}, laserOn}
  setMachine(pose, m, frameCfg, board, showHead, showFrame, extra = {}) {
    this.machineModel.update(pose, m, frameCfg, board, showHead, showFrame, extra);
    // przy suporcie stol zastepuje siatke podlogi
    if (this.grid) this.grid.visible = !this.machineModel.frame.visible;
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

// Graniastoslup: wielokat [[x, y], ...] w XY od wysokosci z0, wysokosc h
export function prismGeometry(points, z0, h) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  geo.translate(0, 0, z0);
  return geo;
}

// Przejscie narzedzia: punkty [x, y, glebokosc] pod gora pass.top; wallMat null - tylko slad na powierzchni (polerka)
function buildToolPass(group, pass, wallMat, topMat) {
  const r = pass.radius;
  const pts = pass.points;
  const zTop = pass.top + (pass.polish ? 0.4 : 0.3);
  const bottom = (p) => pass.top - p[2];
  // konce przejscia i otwor (jeden punkt): krazek na gorze, sciana walca, dno
  const caps = pts.length === 1 ? [pts[0]] : [pts[0], pts[pts.length - 1]];
  for (const p of caps) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 40), topMat);
    disc.position.set(p[0], p[1], zTop);
    group.add(disc);
    if (wallMat && p[2] > 0.05) {
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, p[2], 40, 1, true), wallMat);
      wall.rotation.x = Math.PI / 2;
      wall.position.set(p[0], p[1], pass.top - p[2] / 2);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(r, 40), wallMat);
      floor.position.set(p[0], p[1], bottom(p) + 0.05);
      group.add(wall, floor);
    }
  }
  if (pts.length < 2) return;
  // przesuniecie w lewo od toru o promien (w kazdym punkcie)
  const side = pts.map((p, i) => {
    const q = pts[Math.min(i + 1, pts.length - 1)];
    const o = pts[Math.max(i - 1, 0)];
    const l = Math.hypot(q[0] - o[0], q[1] - o[1]) || 1;
    return [-(q[1] - o[1]) / l * r, (q[0] - o[0]) / l * r];
  });
  const ribbon = (z, mat) => group.add(stripMesh(pts.map((p, i) => [
    [p[0] + side[i][0], p[1] + side[i][1], z(p)], [p[0] - side[i][0], p[1] - side[i][1], z(p)]]), mat));
  ribbon(() => zTop, topMat);
  if (!wallMat) return;
  ribbon((p) => bottom(p) + 0.05, wallMat);
  for (const sign of [1, -1]) {
    group.add(stripMesh(pts.map((p, i) => {
      const x = p[0] + sign * side[i][0];
      const y = p[1] + sign * side[i][1];
      return [[x, y, pass.top], [x, y, bottom(p)]];
    }), wallMat));
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
    // wlasny material sprite'a znacznika (tekstura z canvas)
    if (obj.isSprite) { obj.material.map?.dispose(); obj.material.dispose(); }
  }
}

// --- znaczniki planu: tekstury z canvas ----------------------------------------

// Material sprite'a o stalej wielkosci na ekranie (scale = ulamek wysokosci widoku), zawsze na wierzchu
function spriteMaterial(map) {
  return new THREE.SpriteMaterial({ map, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true });
}

function dotTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.beginPath();
  g.arc(16, 16, 12, 0, Math.PI * 2);
  g.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = '#ffffff';
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Etykieta "X .. Y ..": ciemny tekst na jasnym tle (aktywny krok - czerwone tlo, bialy tekst);
// kind 'distance' - odleglosc: niebieski tekst i ramka
function labelTexture(text, active, kind = 'xy') {
  const dist = kind === 'distance';
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = '600 28px system-ui, Segoe UI, sans-serif';
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 20;
  c.width = w;
  c.height = 40;
  g.font = font;
  g.fillStyle = active ? 'rgba(214, 39, 40, 0.92)' : 'rgba(255, 255, 255, 0.88)';
  g.strokeStyle = active ? '#8b1a1a' : dist ? '#1f5fa8' : '#8d877a';
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(1, 1, w - 2, 38, 8);
  g.fill();
  g.stroke();
  g.fillStyle = active ? '#ffffff' : dist ? '#1f5fa8' : '#1f2933';
  g.textBaseline = 'middle';
  g.fillText(text, 10, 21);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { texture: t, aspect: w / 40 };
}
