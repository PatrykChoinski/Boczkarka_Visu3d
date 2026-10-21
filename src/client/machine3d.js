// Model maszyny (pila mostowa): suport - sciany z prowadnicami, most z wozkiem, stol pod kamieniem;
// glowica - slup Z, korpus obrotu A, silnik wrzeciona z wychylem B, oslona tarczy (frez / wiertlo / polerka - bez oslony,
// wrzeciono do kolnierza narzedzia).
// Bryly uproszczone, polozenie wg pozycji osi (shared/geometry.js); stol i rozstaw maszyny wg punktow
// stolu (aCuttingBoard), niezalezne od kamienia; reszta wymiarow z frame w configu.

import * as THREE from 'three';
import { headFrame, isToolMode, add, mul, dot, topZ } from '../shared/geometry.js';
import { isArea, bounds } from '../shared/area.js';
import { prismGeometry } from './view3d.js';

const YELLOW = 0xf2b705;
const GREY = 0xe4e6e8;
const DARK = 0x6f6152;
const STEEL = 0x7d8790;

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
    this.frame.add(this.wallA, this.wallB, this.railA, this.railB, this.table, this.bridge, this.bridgeFace, this.carriage);
    // glowica
    this.head = new THREE.Group();
    this.ram = box(YELLOW);
    this.rotary = box(YELLOW);
    this.motor = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32), new THREE.MeshStandardMaterial({ color: YELLOW, roughness: 0.5 }));
    this.spindle = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24), new THREE.MeshStandardMaterial({ color: STEEL, metalness: 0.6, roughness: 0.3 }));
    // oslona tarczy - polowa walca (gorna polowa tarczy)
    this.guard = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 48, 1, false, -Math.PI / 2, Math.PI),
      new THREE.MeshStandardMaterial({ color: YELLOW, roughness: 0.5, side: THREE.DoubleSide }));
    this.head.add(this.ram, this.rotary, this.motor, this.spindle, this.guard);
    this.group.add(this.frame, this.head);
  }

  // cfg - frame z configu, board - punkty stolu [[x, y, z], ...]
  update(pose, m, cfg, board, showHead, showFrame) {
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
      // oslona: polowa walca o osi wrzeciona, nad srodkiem tarczy (lokalne z > 0 = w gore w plaszczyznie tarczy)
      this.guard.visible = !tool;
      const upInPlane = mul(f.d, -1);
      const flip = dot(zAxis, upInPlane) >= 0 ? 1 : -1;
      orient(this.guard, mul(xAxis, flip), yAxis, mul(zAxis, flip), add(f.center, mul(f.normal, -m.bladeWidth / 2 - 10)),
        [r * 1.08, Math.max(m.bladeWidth, 1) + 60, r * 1.08]);
    }

    if (this.frame.visible) {
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
      const tableKey = JSON.stringify([tablePts, tableTop]);
      if (tableKey !== this.tableKey) {
        this.tableKey = tableKey;
        this.table.geometry.dispose();
        this.table.geometry = prismGeometry(tablePts, tableTop - 80, 79.5);
        this.table.position.set(0, 0, 0);
        this.table.scale.set(1, 1, 1);
        this.table.quaternion.identity();
      }
      // most jedzie z osia poprzeczna (Y), wozek z osia wzdluz mostu (X); slup przed mostem
      const posA = alongX ? f.axis[0] : f.axis[1];
      const posC = alongX ? f.axis[1] : f.axis[0];
      const bridgeC = posC + ramW / 2 + 200;
      box2(this.bridge, [wa0, bridgeC, zBridge], [wa1, bridgeC + 380, zBridge + 140]);
      box2(this.bridgeFace, [wa0 + wall, bridgeC, zBridge + 140], [wa1 - wall, bridgeC + 380, zBridge + 420]);
      box2(this.carriage, [posA - ramW, posC - ramW / 2 - 40, zBridge + 60], [posA + ramW, bridgeC, zBridge + 560]);
    }
  }
}
