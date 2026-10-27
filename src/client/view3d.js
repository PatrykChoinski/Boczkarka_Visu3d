// Scena 3D boczkarki (jak B1PK-14.0-2000.2): stol z plyta kamienia, belka na slupach, wozek osi X, ramie
// i glowica wychylna B (silnik wrzecionowy + tarcza garnkowa), krawedz plyty obrabiana kolejnymi przejsciami.
//
// Uklad (mm): three x = os X maszyny (wzdluz stolu), y - w gore, z - w poprzek: krawedz plyty z = 0, plyta z < 0,
// glowica po stronie z > 0. Przekroj krawedzi (u, v) z edgeshape.js: u -> z, v -> y (od wierzchu stolu).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { edgeSection, passPlane, normal } from '../shared/edgeshape.js';
import { PROFILE_TYPE } from '../shared/edgeprofile.js';

const BAND = 60;			// szerokosc pasa krawedzi liczonego przekrojem [mm]
const RETRACT = 18;			// odsuniecie glowicy bez docisku [mm]

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.15, ...extra });

export class EdgeView {
  constructor(container, cfg) {
    this.cfg = cfg;
    this.m = cfg.machine;
    this.container = container;
    // lite (?lite w adresie): bez cieni i wygladzania - slabe tablety, przegladarka bez GPU
    this.lite = new URLSearchParams(location.search).has('lite');
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.lite });
    this.renderer.setPixelRatio(this.lite ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.lite;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdde3ea);
    this.camera = new THREE.PerspectiveCamera(40, 1, 10, 40000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.lights();
    this.buildMachine();
    this.stone = new THREE.Group();
    this.scene.add(this.stone);
    this.stoneKey = '';
    this.spin = 0;
    this.view('iso');
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  lights() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-1500, 4000, 3000);
    sun.castShadow = !this.lite;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -3000, right: 3000, top: 3000, bottom: -3000, near: 100, far: 10000 });
    sun.target.position.set(1200, 0, 0);
    this.scene.add(sun, sun.target);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12000, 9000), mat(0xb9bec5, { roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(1200, 0, 0);
    floor.receiveShadow = true;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(12000, 24, 0x9aa1aa, 0xa9b0b8);
    grid.position.set(1200, 1, 0);
    this.scene.add(grid);
  }

  box(w, h, d, color, x, y, z, parent = this.scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'number' ? mat(color) : color);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  cylinder(r, h, color, parent) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40), typeof color === 'number' ? mat(color) : color);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  buildMachine() {
    const m = this.m;
    const x0 = m.travelX[0] - 150;
    const len = m.tableLength;
    const th = m.tableHeight;
    const front = -m.stoneOverhang;			// przednia krawedz blatu
    // stol: blat z rowkami, nogi, rama
    this.box(len, 40, m.tableWidth, 0x6c7480, x0 + len / 2, th - 20, front - m.tableWidth / 2);
    for (let i = 0; i < 8; i++) this.box(len, 4, 12, 0x3d434b, x0 + len / 2, th + 1, front - 60 - i * ((m.tableWidth - 120) / 7));
    for (const lx of [x0 + 80, x0 + len - 80]) {
      for (const lz of [front - 80, front - m.tableWidth + 80]) this.box(90, th - 40, 90, 0x2f343b, lx, (th - 40) / 2, lz);
    }
    this.box(len - 160, 70, 70, 0x2f343b, x0 + len / 2, 260, front - 80);
    this.box(len - 160, 70, 70, 0x2f343b, x0 + len / 2, 260, front - m.tableWidth + 80);
    // konstrukcja nosna: slupy po obu koncach i belka osi X po stronie glowicy (kolor Promasz)
    const railZ = 560;
    const steel = mat(0xf2b134, { metalness: 0.25, roughness: 0.45 });
    for (const px of [x0 - 120, x0 + len + 120]) this.box(160, m.railHeight + 120, 160, steel, px, (m.railHeight + 120) / 2, railZ);
    this.box(len + 400, 180, 200, steel, x0 + len / 2, m.railHeight + 60, railZ);
    this.box(len + 380, 18, 40, mat(0xc9ced6, { metalness: 0.7, roughness: 0.25 }), x0 + len / 2, m.railHeight - 38, railZ - 80);
    // wozek osi X i ramie
    this.carriage = new THREE.Group();
    this.scene.add(this.carriage);
    this.box(320, 260, 300, 0xe9ecef, 0, m.railHeight + 60, railZ, this.carriage);
    this.box(260, 80, 20, 0x1f6fb2, 0, m.railHeight + 60, railZ + 160, this.carriage);
    this.column = this.box(150, 1, 150, 0xe9ecef, 0, 0, railZ - 40, this.carriage);
    // przegub B: piasta na koncu ramienia
    this.hub = new THREE.Group();
    this.carriage.add(this.hub);
    const hubDisc = this.cylinder(110, 120, 0x9aa3ad, this.hub);
    hubDisc.rotation.z = Math.PI / 2;
    // lacznik piasta -> silnik (dlugosc ustawiana w update)
    this.link = this.box(70, 70, 1, 0xd5dae0, 0, 0, 0, this.carriage);
    // glowica: uklad, w ktorym +z = normalna szlifowanej plaszczyzny (od kamienia do silnika)
    this.head = new THREE.Group();
    this.carriage.add(this.head);
    this.tool = new THREE.Group();
    this.head.add(this.tool);
    const wheel = new THREE.Group();
    const cup = this.cylinder(m.wheelDiameter / 2, m.wheelHeight, mat(0xc0612b, { roughness: 0.8 }), wheel);
    cup.rotation.x = Math.PI / 2;
    const seg = this.cylinder(m.wheelDiameter / 2 - 6, 4, mat(0x4a4d52, { metalness: 0.5 }), wheel);
    seg.rotation.x = Math.PI / 2;
    seg.position.z = -m.wheelHeight / 2 - 2;
    // znaczniki obrotow na tarczy
    for (let i = 0; i < 6; i++) {
      const mk = this.box(10, 6, m.wheelHeight + 2, 0xf6d2b5, 0, 0, 0, wheel);
      const a = (i / 6) * Math.PI * 2;
      mk.position.set(Math.cos(a) * (m.wheelDiameter / 2 - 4), Math.sin(a) * (m.wheelDiameter / 2 - 4), 0);
    }
    wheel.position.z = m.wheelHeight / 2;
    this.wheel = wheel;
    this.tool.add(wheel);
    const shaft = this.cylinder(28, 60, 0x8d949c, this.tool);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = m.wheelHeight + 30;
    const motor = this.cylinder(m.motorDiameter / 2, m.motorLength, mat(0xf4f5f6, { roughness: 0.35 }), this.tool);
    motor.rotation.x = Math.PI / 2;
    motor.position.z = m.wheelHeight + 60 + m.motorLength / 2;
    const box = this.box(110, 120, 140, 0x1f6fb2, 0, m.motorDiameter / 2 + 40, m.wheelHeight + 60 + m.motorLength * 0.55, this.tool);
    box.castShadow = true;
    const fan = this.cylinder(m.motorDiameter / 2 - 8, 40, 0x3a3f46, this.tool);
    fan.rotation.x = Math.PI / 2;
    fan.position.z = m.wheelHeight + 60 + m.motorLength + 20;
    this.motorRear = m.wheelHeight + 60 + m.motorLength + 40;
    // oslona tarczy i woda
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(m.wheelDiameter / 2 + 18, m.wheelDiameter / 2 + 18, m.wheelHeight + 30, 40, 1, true, 0, Math.PI * 1.3),
      mat(0x1f6fb2, { side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
    guard.rotation.x = Math.PI / 2;
    guard.position.z = m.wheelHeight / 2 + 12;
    this.tool.add(guard);
    this.water = new THREE.Mesh(new THREE.ConeGeometry(m.wheelDiameter * 0.55, 140, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x5fb3ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.z = -20;
    this.tool.add(this.water);
    // znacznik docisku (pierscien przy silniku)
    this.clampRing = new THREE.Mesh(new THREE.TorusGeometry(m.motorDiameter / 2 + 8, 7, 12, 40), mat(0x2ecc71, { emissive: 0x0b5d2a }));
    this.clampRing.position.z = m.wheelHeight + 70;
    this.tool.add(this.clampRing);
  }

  resize() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Widoki: iso, przod (wzdluz krawedzi), bok (przekroj profilu), gora
  view(name, centerX = 1000) {
    const th = this.m.tableHeight;
    const t = new THREE.Vector3(centerX, th, 0);
    // kamera od strony operatora, pod belka osi X (widac krawedz plyty i glowice)
    const p = {
      iso: [centerX - 1300, th + 650, 2300], front: [centerX, th + 380, 2600],
      side: [this.m.travelX[0] - 900, th + 120, 260], top: [centerX, th + 4200, 400],
    }[name] ?? [centerX - 1300, th + 650, 2300];
    if (name === 'side') t.set(this.m.travelX[0] + 200, th + 15, 0);
    this.camera.position.set(...p);
    this.controls.target.copy(t);
    this.controls.update();
  }

  // Plyta i krawedz: odbudowa tylko przy zmianie przekroju / odcinkow
  updateStone(profile, passes, cut) {
    const m = this.m;
    const T = m.stoneThickness;
    const x0 = Math.min(profile.xStart, profile.xEnd);
    const x1 = Math.max(profile.xStart, profile.xEnd);
    const angles = passes.slice(0, cut.done).map((p) => p.angleB);
    const part = cut.partial ? { ...cut.partial, from: Math.max(x0, cut.partial.from), to: Math.min(x1, cut.partial.to) } : null;
    const key = JSON.stringify([profile.kind, x0, x1, angles, part && [part.angle, Math.round(part.from / 4), Math.round(part.to / 4)]]);
    if (key === this.stoneKey) return;
    this.stoneKey = key;
    for (const c of [...this.stone.children]) { c.geometry?.dispose(); this.stone.remove(c); }
    if (x1 - x0 < 1) return;
    const granite = mat(0x8f8a86, { roughness: 0.5, metalness: 0.05, flatShading: true });
    const polished = mat(0xa9a39d, { roughness: 0.25, metalness: 0.1, flatShading: true });
    // plyta poza pasem krawedzi
    const body = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, T, m.stoneWidth - BAND), granite);
    body.position.set((x0 + x1) / 2, m.tableHeight + T / 2, -BAND - (m.stoneWidth - BAND) / 2);
    body.castShadow = true;
    body.receiveShadow = true;
    this.stone.add(body);
    // pas krawedzi: odcinki X z wlasnym przekrojem (biezacy przejazd zeszlifowal juz czesc dlugosci)
    const done = edgeSection(profile.kind, angles, T, this.cfg.shape, BAND);
    const segs = part && part.to > part.from
      ? [[x0, part.from, done], [part.from, part.to, edgeSection(profile.kind, [...angles, part.angle], T, this.cfg.shape, BAND)], [part.to, x1, done]]
      : [[x0, x1, done]];
    for (const [a, b, poly] of segs) {
      if (b - a < 0.5 || poly.length < 3) continue;
      const shape = new THREE.Shape(poly.map(([u, v]) => new THREE.Vector2(-u, v)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: b - a, bevelEnabled: false, curveSegments: 1 });
      const mesh = new THREE.Mesh(geo, angles.length || (part && segs.length > 1 && a === part.from) ? polished : granite);
      mesh.rotation.y = Math.PI / 2;
      mesh.position.set(a, m.tableHeight, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.stone.add(mesh);
    }
  }

  // Polozenie glowicy z migawki maszyny (symulator lub PLC)
  update(state, profile, passes, cut, dt) {
    const m = this.m;
    this.updateStone(profile, passes, cut);
    const x = Number(state.x) || 0;
    const b = Number(state.b) || 0;
    this.carriage.position.x = x;
    // punkt styku tarczy na plaszczyznie profilu dla biezacego kata B; bez docisku - odsuniecie
    const kind = profile.kind ?? PROFILE_TYPE.StraightEdge;
    const plane = passPlane(kind, b, m.stoneThickness, this.cfg.shape);
    const n = normal(b);
    const off = state.clamp ? 0 : RETRACT;
    const cu = plane.contact[0] + n[0] * off;
    const cv = plane.contact[1] + n[1] * off;
    this.head.position.set(0, m.tableHeight + cv, cu);
    this.head.rotation.x = -b * Math.PI / 180;
    // piasta przegubu nad krawedzia, ramie z wozka do piasty, lacznik piasta -> tyl silnika
    const hubY = m.tableHeight + 420;
    const hubZ = 380;
    this.hub.position.set(0, hubY, hubZ);
    const colTop = m.railHeight - 40;
    this.column.scale.y = colTop - hubY;
    this.column.position.set(0, (colTop + hubY) / 2, hubZ);
    const rear = new THREE.Vector3(0, m.tableHeight + cv + n[1] * this.motorRear * 0.7, cu + n[0] * this.motorRear * 0.7);
    const hub = new THREE.Vector3(0, hubY, hubZ);
    const len = rear.distanceTo(hub);
    this.link.scale.z = Math.max(1, len);
    this.link.position.copy(rear.clone().add(hub).multiplyScalar(0.5));
    // os z prostopadloscianu wzdluz odcinka tyl silnika -> piasta (obrot wokol X: z -> (0, -sin, cos))
    this.link.rotation.set(Math.atan2(-(hub.y - rear.y), hub.z - rear.z), 0, 0);
    // obroty tarczy i woda
    const rps = Math.min(Number(state.spindleFrequency) || 0, 120) / 10;
    this.spin += rps * Math.PI * 2 * dt;
    this.wheel.rotation.z = this.spin;
    this.water.visible = Boolean(state.water);
    this.water.material.opacity = 0.2 + 0.1 * Math.sin(performance.now() / 70);
    this.clampRing.visible = Boolean(state.clamp);
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
