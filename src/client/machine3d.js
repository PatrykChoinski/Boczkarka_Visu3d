// Model maszyny (pila mostowa): suport - sciany z prowadnicami, most z wozkiem, stol pod kamieniem z zielona mata
// lapiaca wode, panel operatorski przed prawym murkiem;
// glowica - slup Z, korpus obrotu A, silnik wrzeciona z wychylem B, oslona tarczy (frez / wiertlo / polerka - bez oslony,
// wrzeciono do kolnierza narzedzia), dwa niebieskie weze z woda do dysz i modul lasera na oslonie (#141).
// Bryly uproszczone, polozenie wg pozycji osi (shared/geometry.js); stol i rozstaw maszyny wg punktow
// stolu (aCuttingBoard), niezalezne od kamienia; reszta wymiarow z frame w configu.

import * as THREE from 'three';
import { headFrame, isToolMode, add, mul, dot, topZ } from '../shared/geometry.js';
import { waterLayout, laserMount, GUARD_OUTLINE, GUARD_SIDES, GUARD_HUB_HOLE } from '../shared/water.js';
import { isArea, bounds } from '../shared/area.js';
import { prismGeometry } from './view3d.js';

const YELLOW = 0xf2b705;
const GREY = 0xe4e6e8;
const DARK = 0x6f6152;
const STEEL = 0x7d8790;
const HOSE = 0x1e4fbf;        // niebieskie weze segmentowe (Loc-Line)
const ALU = 0xe4e7ea;         // aluminiowa oslona tarczy (jasna jak na zdjeciu w #141)
const BRAID = 0xdadde0;       // stalowy oplatany przewod zasilajacy (srebrny)
const MAT = 0x2f8f46;
const NOZZLE = 0xe5532a;     // pomaranczowo-czerwone koncowki dysz
const HOSE_BEADS = 64;        // segmenty jednego weza

const v3 = (p) => new THREE.Vector3(p[0], p[1], p[2]);
const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];

function box(color, opts = {}) {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...opts }));
}

// Prostopadloscian od lo do hi (osie swiata)
function placeBox(mesh, lo, hi) {
  mesh.scale.set(Math.max(hi[0] - lo[0], 1), Math.max(hi[1] - lo[1], 1), Math.max(hi[2] - lo[2], 1));
  mesh.position.set((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
  mesh.quaternion.identity();
}

// Bryla w ukladzie (x, y, z) - osie lokalne geometrii three.js
function orient(mesh, x, y, z, pos, scale) {
  mesh.matrixAutoUpdate = true;
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(v3(x), v3(y), v3(z)));
  mesh.position.copy(v3(pos));
  mesh.scale.set(...scale);
}

// Obrys stolu [x0, y0, x1, y1] z punktow stolu; bez punktow - 3500 x 3000 od (0, 0)
export function tableExtent(board) {
  return isArea(board) ? bounds(board) : [0, 0, 3500, 3000];
}

export class MachineModel {
  constructor() {
    this.group = new THREE.Group();
    // suport
    this.frame = new THREE.Group();
    this.wallA = box(GREY);
    this.wallB = box(GREY);
    this.railA = box(YELLOW);
    this.railB = box(YELLOW);
    this.table = box(DARK, { roughness: 0.9 });
    this.bridge = box(YELLOW);
    this.bridgeFace = box(GREY);
    this.carriage = box(YELLOW);
    // zielona mata gumowa na plycie stolu (pod kamieniem) - lapie wode
    this.mat = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: MAT, roughness: 0.95 }));
    // panel operatorski: slupek, pochylona konsola z ekranem HMI, grzybek STOP, przyciski
    this.panel = new THREE.Group();
    this.panelPost = box(GREY);
    this.panelBox = box(0x3b4148, { roughness: 0.5 });
    this.panelScreen = box(0x0d2238, { roughness: 0.2, metalness: 0.3, emissive: 0x0a2a4a, emissiveIntensity: 0.6 });
    const knob = (color, r) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 24), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
    this.panelStop = knob(0xd62020, 1);
    this.panelStopBase = knob(0xf2c400, 1);
    this.panelBtns = [knob(0x2eaa44, 1), knob(0xf0f0f0, 1), knob(0x1f5fa8, 1)];
    this.panel.add(this.panelPost, this.panelBox, this.panelScreen, this.panelStopBase, this.panelStop, ...this.panelBtns);
    this.frame.add(this.wallA, this.wallB, this.railA, this.railB, this.table, this.mat, this.bridge, this.bridgeFace, this.carriage, this.panel);
    // glowica
    this.head = new THREE.Group();
    this.ram = box(YELLOW);
    this.rotary = box(YELLOW);
    this.motor = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32), new THREE.MeshStandardMaterial({ color: YELLOW, roughness: 0.5 }));
    this.spindle = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24), new THREE.MeshStandardMaterial({ color: STEEL, metalness: 0.6, roughness: 0.3 }));
    // oslona tarczy (oslonka na wode, #141): kanciasta aluminiowa plyta z GUARD_OUTLINE, tarcza w szczelinie
    this.guard = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: ALU, roughness: 0.6, metalness: 0.12 }));
    this.guardEdges = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x7c8288 }));
    this.guard.add(this.guardEdges);
    this.guardKey = '';
    // weze z woda: segmentowe (kulki wzdluz krzywej - InstancedMesh), dysze, rozdzielacz, stalowy przewod zasilajacy
    const hoseMat = new THREE.MeshStandardMaterial({ color: HOSE, roughness: 0.35, metalness: 0.1 });
    this.hoses = [0, 1, 2].map(() => {
      const h = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), hoseMat, HOSE_BEADS);
      h.frustumCulled = false;
      return h;
    });
    this.nozzles = [0, 1, 2].map(() => new THREE.Mesh(new THREE.CylinderGeometry(1, 0.55, 1, 16), new THREE.MeshStandardMaterial({ color: NOZZLE, roughness: 0.4 })));
    this.manifold = box(0xcfd3d6, { metalness: 0.3, roughness: 0.4 });     // srebrny rozdzielacz
    this.supply = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: BRAID, metalness: 0.25, roughness: 0.45 }));
    this.hoseKey = '';
    // modul lasera: obudowa i okienko (swieci, gdy laser wlaczony)
    this.laserBody = box(0x2b2f33, { roughness: 0.5 });
    this.laserLens = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 20), new THREE.MeshBasicMaterial({ color: 0x5a1a1a }));
    this.head.add(this.ram, this.rotary, this.motor, this.spindle, this.guard, ...this.hoses, ...this.nozzles, this.manifold, this.supply,
      this.laserBody, this.laserLens);
    this.group.add(this.frame, this.head);
  }

  // cfg - frame z configu, board - punkty stolu [[x, y, z], ...], extra {laser: {side, mountAngle}, laserOn}
  update(pose, m, cfg, board, showHead, showFrame, extra = {}) {
    this.head.visible = Boolean(pose && showHead);
    this.frame.visible = Boolean(pose && showFrame);
    if (!pose) return;
    const tool = isToolMode(m);
    const f = headFrame(pose, m);
    const r = Math.max(m.discDiameter / 2, 150);    // wielkosc glowicy wg tarczy - bez zmiany przy zamianie narzedzia
    const zPivot = -pose.z;                 // wysokosc osi wychylu
    const zBridge = cfg.bridgeZ;            // spod mostu (nad Z = 0)
    const ramW = Math.max(160, r * 0.45);

    if (this.head.visible) {
      // slup Z - pionowo w osi obrotu A, przesuwa sie razem z Z
      const ax = f.axis;
      placeBox(this.ram, [ax[0] - ramW / 2, ax[1] - ramW / 2, zPivot + ramW * 0.6], [ax[0] + ramW / 2, ax[1] + ramW / 2, zPivot + cfg.ramLength]);
      // korpus obrotu A - od osi A do osi wychylu, obraca sie z A
      const n = [Math.sin(pose.a * Math.PI / 180), -Math.cos(pose.a * Math.PI / 180), 0];
      const across = dot([f.pivot[0] - ax[0], f.pivot[1] - ax[1], 0], n);
      const mid = add(ax, mul(n, across / 2));
      orient(this.rotary, f.u, n, cross(f.u, n), [mid[0], mid[1], zPivot + ramW * 0.35],
        [ramW * 1.1, Math.abs(across) + ramW, ramW * 0.7]);
      // silnik na osi wrzeciona (normalna tarczy) po stronie osi wychylu, wrzeciono do tarczy
      const motorLen = Math.max(250, r * 0.8);
      const motorR = Math.max(70, r * 0.2);
      const away = mul(f.normal, -1);
      const yAxis = f.normal;
      const xAxis = f.u;
      const zAxis = cross(xAxis, yAxis);
      orient(this.motor, xAxis, yAxis, zAxis, add(f.pivot, mul(away, motorLen / 2 - motorR * 0.5)), [motorR, motorLen, motorR]);
      const spindleEnd = tool ? f.flange : f.center;
      const hubToPivot = Math.max(1, Math.hypot(...[0, 1, 2].map((i) => spindleEnd[i] - f.pivot[i])));
      orient(this.spindle, xAxis, yAxis, zAxis, add(f.pivot, mul(f.normal, hubToPivot / 2)), [motorR * 0.3, hubToPivot + 20, motorR * 0.3]);
      // oslona: plyta z obrysu GUARD_OUTLINE w plaszczyznie tarczy (lokalne x - przod u, y - w gore, z - normalna)
      this.guard.visible = !tool;
      if (!tool) this.updateGuard(f, m);
      this.updateWater(pose, m, extra.spin ?? 1);
      this.updateLaser(pose, m, extra.laser || {}, extra.laserOn);
    }

    if (this.frame.visible) {
      this.updateFrame(f, m, cfg, board, ramW, zBridge);
    }
  }

  // Oslona: geometria z obrysu (w promieniach tarczy) - przebudowa przy zmianie promienia / szerokosci tarczy
  updateGuard(f, m) {
    const R = f.radius;
    const key = `${R}:${m.bladeWidth}`;
    if (key !== this.guardKey) {
      this.guardKey = key;
      const shape = new THREE.Shape(GUARD_OUTLINE.map(([s, t]) => new THREE.Vector2(s * R, t * R)));
      const hole = new THREE.Path();
      hole.absarc(0, 0, GUARD_HUB_HOLE * R, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      const depth = m.bladeWidth + GUARD_SIDES.inner + GUARD_SIDES.outer;
      const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
      geo.translate(0, 0, -(m.bladeWidth / 2 + GUARD_SIDES.inner));
      this.guard.geometry.dispose();
      this.guard.geometry = geo;
      this.guardEdges.geometry.dispose();
      this.guardEdges.geometry = new THREE.EdgesGeometry(geo);
    }
    orient(this.guard, f.u, mul(f.d, -1), f.normal, f.center, [1, 1, 1]);
  }

  // Weze: segmenty (kulki) wzdluz krzywej przez punkty z waterLayout (rozdzielacz -> pod oslona -> dysza), dysze
  // skierowane na tarcze, stalowy przewod z gory glowicy do rozdzielacza
  updateWater(pose, m, spin = 1) {
    const w = waterLayout(pose, m, spin);
    const key = JSON.stringify([w.hoses, w.supply].map((a) => JSON.stringify(a, (k, v) => (typeof v === 'number' ? Math.round(v) : v))));
    if (key !== this.hoseKey) {
      this.hoseKey = key;
      const mtx = new THREE.Matrix4();
      this.hoses.forEach((h, i) => { h.visible = i < w.hoses.length; });
      w.hoses.forEach((pts, i) => {
        const curve = new THREE.CatmullRomCurve3(pts.map(v3));
        curve.getSpacedPoints(HOSE_BEADS - 1).forEach((p, k) => {
          mtx.makeScale(11, 11, 11).setPosition(p);
          this.hoses[i].setMatrixAt(k, mtx);
        });
        this.hoses[i].instanceMatrix.needsUpdate = true;
      });
      this.supply.geometry.dispose();
      this.supply.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(w.supply.map(v3)), 48, 12, 10, false);
    }
    placeBox(this.manifold, w.manifold.map((c) => c - 28), w.manifold.map((c) => c + 28));
    this.nozzles.forEach((nz, i) => { nz.visible = i < w.nozzles.length; });
    w.nozzles.forEach((p, i) => {
      const dir = new THREE.Vector3(...w.targets[i]).sub(v3(p)).normalize();
      const nz = this.nozzles[i];
      nz.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);   // waski koniec (dol walca) w strone tarczy
      nz.scale.set(14, 50, 14);
      nz.position.copy(v3(p)).addScaledVector(dir, 10);
    });
  }

  // Modul lasera na oslonie: obudowa wzdluz kierunku lasera, okienko od strony linii lasera
  updateLaser(pose, m, cfg, on) {
    const mt = laserMount(pose, m, cfg.side ?? 1, cfg.mountAngle ?? 50);
    const z = cross(mt.u, mt.normal);
    const up = dot(z, mt.up) >= 0 ? z : mul(z, -1);
    orient(this.laserBody, mt.u, mt.normal, up, add(mt.pos, mul(up, 35)), [110, 60, 70]);
    orient(this.laserLens, mt.u, up, mt.normal, add(add(mt.pos, mul(up, 35)), mul(mt.u, 56)), [16, 6, 16]);
    this.laserLens.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v3(mt.u));
    this.laserLens.material.color.setHex(on ? 0xff2a1a : 0x5a1a1a);
    this.laserMount = mt;
  }

  // Panel operatorski przed przednim koncem prawego murka (strona operatora - mniejsze c): slupek z podloga,
  // konsola pochylona o 30 stopni do operatora, ekran HMI, grzybek STOP, przyciski. a - srodek murka wzdluz mostu.
  updatePanel(cfg, P, a, cl0, floor, alongX) {
    this.panel.visible = cfg.panel !== false;
    if (!this.panel.visible) return;
    const aDir = alongX ? [1, 0, 0] : [0, 1, 0];
    const cDir = alongX ? [0, 1, 0] : [1, 0, 0];
    const up = [0, 0, 1];
    const c = cl0 - 380;                                       // przed murkiem
    const postTop = floor + 950;
    const postLo = P(a - 110, c - 90, floor);
    const postHi = P(a + 110, c + 90, postTop);
    placeBox(this.panelPost, [Math.min(postLo[0], postHi[0]), Math.min(postLo[1], postHi[1]), floor],
      [Math.max(postLo[0], postHi[0]), Math.max(postLo[1], postHi[1]), postTop]);
    // konsola: os z = do operatora i w gore (pochylenie 30 stopni), y - w gore po skosie, x - wzdluz mostu
    const t = 30 * Math.PI / 180;
    const face = add(mul(cDir, -Math.sin(t)), mul(up, Math.cos(t)));
    const slope = cross(face, aDir);
    const yAxis = dot(slope, up) >= 0 ? slope : mul(slope, -1);
    const xAxis = cross(yAxis, face);
    const center = add(P(a, c, postTop + 170), mul(face, -20));
    orient(this.panelBox, xAxis, yAxis, face, center, [560, 380, 120]);
    const onFace = (x, y, out) => add(add(add(center, mul(xAxis, x)), mul(yAxis, y)), mul(face, 60 + out));
    orient(this.panelScreen, xAxis, yAxis, face, onFace(-60, 30, 1), [340, 240, 2]);
    // przyciski: walce wzdluz normalnej konsoli (os walca three.js = y)
    const btnAxes = [xAxis, face, cross(xAxis, face)];
    orient(this.panelStopBase, ...btnAxes, onFace(190, 90, 4), [42, 8, 42]);
    orient(this.panelStop, ...btnAxes, onFace(190, 90, 22), [34, 28, 34]);
    this.panelBtns.forEach((b, i) => orient(b, ...btnAxes, onFace(150 + i * 40, -110, 6), [14, 12, 14]));
  }

  // Suport: sciany z prowadnicami, stol, most i wozek
  updateFrame(f, m, cfg, board, ramW, zBridge) {
    const alongX = cfg.bridgeAlong !== 'y';
    // (wzdluz mostu, w poprzek) -> (x, y)
    const P = (a, c, z) => (alongX ? [a, c, z] : [c, a, z]);
    const [x0, y0, x1, y1] = tableExtent(board);
    const [a0, a1, c0, c1] = alongX ? [x0, x1, y0, y1] : [y0, y1, x0, x1];
    const mg = cfg.margin;
    const top = topZ(m);
    const tableTop = top - m.materialThickness;
    const floor = tableTop - cfg.tableHeight;
    const wall = 300;
    const wa0 = a0 - mg - wall;
    const wa1 = a1 + mg + wall;
    const cl0 = c0 - mg;
    const cl1 = c1 + mg;
    const box2 = (mesh, p, q) => {
      const lo = P(Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.min(p[2], q[2]));
      const hi = P(Math.max(p[0], q[0]), Math.max(p[1], q[1]), Math.max(p[2], q[2]));
      placeBox(mesh, [Math.min(lo[0], hi[0]), Math.min(lo[1], hi[1]), lo[2]], [Math.max(lo[0], hi[0]), Math.max(lo[1], hi[1]), hi[2]]);
    };
    box2(this.wallA, [wa0, cl0, floor], [wa0 + wall, cl1, zBridge - 60]);
    box2(this.wallB, [wa1 - wall, cl0, floor], [wa1, cl1, zBridge - 60]);
    box2(this.railA, [wa0 + 40, cl0, zBridge - 60], [wa0 + wall - 40, cl1, zBridge]);
    box2(this.railB, [wa1 - wall + 40, cl0, zBridge], [wa1 - 40, cl1, zBridge - 60]);
    // plyta stolu - wielokat z punktow stolu (bez punktow - prostokat)
    const tablePts = isArea(board) ? board : [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const matT = cfg.mat === false ? 0 : 10;               // grubosc maty [mm]
    const tableKey = JSON.stringify([tablePts, tableTop, matT]);
    if (tableKey !== this.tableKey) {
      this.tableKey = tableKey;
      this.table.geometry.dispose();
      this.table.geometry = prismGeometry(tablePts, tableTop - 80, 79.5 - matT);
      this.table.position.set(0, 0, 0);
      this.table.scale.set(1, 1, 1);
      this.table.quaternion.identity();
      // mata: wierzch plyty stolu (pod kamieniem, gora maty = spod kamienia)
      this.mat.geometry.dispose();
      this.mat.geometry = matT ? prismGeometry(tablePts, tableTop - 0.5 - matT, matT) : new THREE.BufferGeometry();
    }
    this.mat.visible = matT > 0;
    this.updatePanel(cfg, P, wa1 - wall / 2, cl0, floor, alongX);
    // most jedzie z osia poprzeczna (Y), wozek z osia wzdluz mostu (X); slup przed mostem
    const posA = alongX ? f.axis[0] : f.axis[1];
    const posC = alongX ? f.axis[1] : f.axis[0];
    const bridgeC = posC + ramW / 2 + 200;
    box2(this.bridge, [wa0, bridgeC, zBridge], [wa1, bridgeC + 380, zBridge + 140]);
    box2(this.bridgeFace, [wa0 + wall, bridgeC, zBridge + 140], [wa1 - wall, bridgeC + 380, zBridge + 420]);
    box2(this.carriage, [posA - ramW, posC - ramW / 2 - 40, zBridge + 60], [posA + ramW, bridgeC, zBridge + 560]);
  }
}
