// Scena 3D boczkarki (wyglad jak Promasz B1PK): podstawa z blatem, belka osi X z tylu stolu, wozek z ramieniem
// nad stolem, glowica wychylna B przed krawedzia plyty (tarcza w oslonie + motoreduktor), szafa; krawedz plyty
// obrabiana kolejnymi przejsciami.
//
// Uklad (mm): three x = os X maszyny (wzdluz stolu), y - w gore, z - w poprzek: krawedz plyty z = 0 (od strony
// operatora), plyta z < 0 (w glab stolu, belka z tylu), glowica i operator po stronie z > 0. Przekroj krawedzi (u, v) z edgeshape.js: u -> z, v -> y (od wierzchu stolu).
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
    this.scene.background = new THREE.Color(0xeef0f2);
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
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9da0, 1.2), new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(2400, 4200, 3200);
    sun.castShadow = !this.lite;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -3000, right: 3000, top: 3000, bottom: -3000, near: 100, far: 10000 });
    sun.target.position.set(1200, 0, 0);
    this.scene.add(sun, sun.target);
    // hala: posadzka betonowa z dylatacjami
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14000, 10000), mat(0xa9acaf, { roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(1200, 0, 0);
    floor.receiveShadow = true;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(14000, 4, 0x8e9295, 0x8e9295);
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

  cylinder(r, h, color, parent, segments = 40) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segments), typeof color === 'number' ? mat(color) : color);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // Tekstury z canvas: blat z otworami kul (rolki wielokierunkowe), tabliczka PROMASZ, kratka wentylacyjna
  texture(w, h, draw, repeat = [1, 1]) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
    t.anisotropy = 4;
    return t;
  }

  // Wyglad jak boczkarka Promasz B1PK (zdjecie DSCN1131): zamknieta biala podstawa z dwiema zoltymi tablicami
  // PROMASZ, czarny blat; krawedz plyty od strony operatora, glowica przed krawedzia (tarcza skierowana na
  // krawedz, silnik do operatora); belka osi X z tylu stolu na slupach (zolte pasy), wozek z ramieniem nad
  // stolem, obudowa z szybka i silnikiem, prowadnik kabli do glowicy, oslona boczna i szafa na prawym koncu.
  buildMachine() {
    const m = this.m;
    const x0 = m.travelX[0] - 250;
    const len = m.tableLength;
    const th = m.tableHeight;
    const zFront = -m.stoneOverhang;			// przednia krawedz blatu (operator po stronie +z)
    const zRear = zFront - m.tableWidth;
    const railZ = zRear - 80;				// os belki X z tylu stolu
    const beamTop = m.railHeight - 60;
    const beamH = 300;
    this.railZ = railZ;
    this.beamTop = beamTop;
    const white = mat(0xeceeef, { roughness: 0.75 });	// lakier strukturalny
    const yellow = mat(0xf7b733, { roughness: 0.5, emissive: 0x3d2a00 });
    const alu = mat(0xd5d9de, { metalness: 0.6, roughness: 0.3 });
    const black = mat(0x1c1e21, { roughness: 0.7 });
    // podstawa: zamknieta szafa pod blatem, przod cofniety (dostep tarczy od dolu krawedzi)
    const zBaseFront = zFront - 160;
    this.box(len, th - 25 - 60, zBaseFront - zRear, white, x0 + len / 2, 60 + (th - 85) / 2, (zBaseFront + zRear) / 2);
    this.box(len - 40, 60, zBaseFront - zRear - 40, 0x9ea4aa, x0 + len / 2, 30, (zBaseFront + zRear) / 2);
    for (const fx of [x0 + 100, x0 + len - 100]) this.box(160, 14, 160, 0x8b9096, fx, 7, zBaseFront - 60);
    // zolte tablice PROMASZ na froncie podstawy
    const logo = this.texture(512, 384, (g, w, h) => {
      g.fillStyle = '#f5a623';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 7;
      g.beginPath(); g.arc(w * 0.5, h * 0.55, h * 0.36, Math.PI * 1.05, Math.PI * 2.25); g.stroke();
      g.fillStyle = '#ffffff';
      g.font = `bold ${h * 0.17}px Georgia, "Times New Roman", serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('PROMASZ', w / 2, h * 0.62);
    });
    for (const f of [0.26, 0.74]) {
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(560, 420), new THREE.MeshStandardMaterial({ map: logo, roughness: 0.5 }));
      plate.position.set(x0 + len * f, 60 + (th - 85) * 0.5, zBaseFront + 1);
      this.scene.add(plate);
    }
    // blat czarny (wysuniety nad przod podstawy)
    const holes = this.texture(256, 256, (g, w, h) => {
      g.fillStyle = '#1d2023';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#2c3135';
      for (const [cx, cy] of [[64, 64], [192, 192]]) { g.beginPath(); g.arc(cx, cy, 26, 0, Math.PI * 2); g.fill(); }
    }, [len / 400, m.tableWidth / 400]);
    const topMat = mat(0xffffff, { map: holes, roughness: 0.6 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(len, 25, m.tableWidth), [black, black, topMat, black, black, black]);
    top.position.set(x0 + len / 2, th - 12.5, (zFront + zRear) / 2);
    top.receiveShadow = true;
    top.castShadow = true;
    this.scene.add(top);
    // slupy na koncach i belka osi X (dwa zolte pasy jak na zdjeciu)
    const postH = beamTop;
    for (const px of [x0 - 90, x0 + len + 90]) this.box(160, postH, 220, white, px, postH / 2, railZ);
    this.box(len + 340, beamH, 220, white, x0 + len / 2, beamTop - beamH / 2, railZ);
    this.box(len + 360, 30, 240, yellow, x0 + len / 2, beamTop + 15, railZ);
    this.box(len + 200, 70, 14, yellow, x0 + len / 2, beamTop - beamH + 70, railZ + 117);
    this.box(len + 200, 40, 160, mat(0xb8bdc3, { metalness: 0.4, roughness: 0.4 }), x0 + len / 2, beamTop + 50, railZ);	// wanna olejowa
    // oslona boczna (siatka) na prawym koncu i szafa sterownicza
    const mesh = mat(0x9aa0a6, { transparent: true, opacity: 0.55, roughness: 0.6, side: THREE.DoubleSide });
    const guard = new THREE.Mesh(new THREE.BoxGeometry(12, beamTop - 150, zFront - railZ + 150), mesh);
    guard.position.set(x0 + len + 180, 150 + (beamTop - 150) / 2, (zFront + railZ) / 2 + 40);
    this.scene.add(guard);
    const cabX = x0 + len + 330;
    this.box(140, th + 200, 140, white, cabX, (th + 200) / 2, railZ);
    this.box(320, 900, 300, mat(0xf3f4f5, { roughness: 0.5 }), cabX, th + 650, railZ);
    const vent = this.texture(128, 128, (g, w, h) => {
      g.fillStyle = '#e9ebed'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#4a4f55';
      for (let i = 0; i < 8; i++) g.fillRect(14, 14 + i * 13, w - 28, 6);
    });
    const ventPlate = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), new THREE.MeshStandardMaterial({ map: vent }));
    ventPlate.position.set(cabX, th + 980, railZ + 151);
    this.scene.add(ventPlate);
    // prowadnik kabli w belce: od punktu stalego do wozka
    this.chainFixX = x0 + len / 2;
    this.chainRun = this.box(1, 40, 90, black, 0, beamTop + 95, railZ);
    // wozek osi X na belce, ramie nad stolem do przodu, obudowa z szybka i silnikiem
    this.carriage = new THREE.Group();
    this.scene.add(this.carriage);
    const hubZ = 380;
    this.box(440, 130, 300, 0xd9dcdf, 0, beamTop + 135, railZ, this.carriage);
    this.box(300, 200, hubZ + 120 - railZ, white, 0, beamTop + 160, (railZ + hubZ + 120) / 2, this.carriage);
    const houseTop = beamTop + 260;
    const houseBottom = th + 520;
    this.box(320, houseTop - houseBottom, 300, white, 0, (houseTop + houseBottom) / 2, hubZ - 20, this.carriage);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(12, houseTop - houseBottom - 60, 380),
      mat(0x2a2320, { transparent: true, opacity: 0.75, roughness: 0.15, metalness: 0.2 }));
    glass.position.set(230, (houseTop + houseBottom) / 2, hubZ - 20);
    this.carriage.add(glass);
    this.box(14, houseTop - houseBottom - 30, 400, alu, 165, (houseTop + houseBottom) / 2, hubZ - 20, this.carriage);
    const topMotor = this.cylinder(85, 260, mat(0xa9aeb4, { metalness: 0.35, roughness: 0.4 }), this.carriage, 28);
    topMotor.rotation.z = Math.PI / 2;
    topMotor.position.set(-20, houseTop + 90, hubZ - 40);
    this.box(200, 60, 160, 0x8f959b, -20, houseTop + 30, hubZ - 40, this.carriage);
    // petla prowadnika kabli od obudowy do glowicy (lewa strona, jak na zdjeciu)
    const loop = new THREE.Mesh(new THREE.TorusGeometry(230, 34, 4, 26, Math.PI), black);
    loop.rotation.z = Math.PI / 2;				// polokrag po stronie -x
    loop.position.set(-170, th + 470, hubZ + 60);
    loop.castShadow = true;
    this.carriage.add(loop);
    this.column = this.box(240, 1, 40, mat(0xe9ebed, { roughness: 0.6 }), 0, 0, railZ - 40, this.carriage);
    // przegub B: zolta obudowa obrotu na koncu sanek
    this.hub = new THREE.Group();
    this.carriage.add(this.hub);
    const hubDisc = this.cylinder(120, 110, yellow, this.hub);
    hubDisc.rotation.z = Math.PI / 2;
    const hubCap = this.cylinder(70, 130, 0x8d949c, this.hub, 24);
    hubCap.rotation.z = Math.PI / 2;
    // lacznik piasta -> glowica (dlugosc ustawiana w update)
    this.link = this.box(110, 90, 1, mat(0xcfd3d8, { metalness: 0.3 }), 0, 0, 0, this.carriage);
    // glowica: uklad, w ktorym +z = normalna szlifowanej plaszczyzny (od kamienia do silnika)
    this.head = new THREE.Group();
    this.carriage.add(this.head);
    this.tool = new THREE.Group();
    this.head.add(this.tool);
    const R = m.wheelDiameter / 2;
    const H = m.wheelHeight;
    const wheel = new THREE.Group();
    // tarcza: zebrowany pierscien diamentowy (jak na zdjeciach) z segmentem roboczym od strony kamienia
    const ring = this.cylinder(R, H, mat(0xc9ced4, { metalness: 0.75, roughness: 0.25 }), wheel, 48);
    ring.rotation.x = Math.PI / 2;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const rib = this.box(5, 3, H - 4, 0x7f868e, 0, 0, 0, wheel);
      rib.position.set(Math.cos(a) * (R + 1), Math.sin(a) * (R + 1), 0);
      rib.rotation.z = a + Math.PI / 2;
    }
    const seg = this.cylinder(R - 4, 4, mat(0x45484d, { metalness: 0.5 }), wheel);
    seg.rotation.x = Math.PI / 2;
    seg.position.z = -H / 2 - 2;
    wheel.position.z = H / 2;
    this.wheel = wheel;
    this.tool.add(wheel);
    // polkolista oslona aluminiowa i zolta oslona gorna z kratka
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(R + 24, R + 24, H + 26, 48, 1, true, -Math.PI * 0.15, Math.PI * 1.3),
      mat(0xdfe3e7, { side: THREE.DoubleSide, metalness: 0.55, roughness: 0.3 }));
    shroud.rotation.x = Math.PI / 2;
    shroud.position.z = H / 2 + 6;
    this.tool.add(shroud);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(R + 24, 4, 8, 48, Math.PI * 1.3), alu);
    lip.rotation.z = -Math.PI * 0.15 + Math.PI / 2;
    lip.position.z = -4;
    this.tool.add(lip);
    const grille = this.texture(128, 64, (g, w, h) => {
      g.fillStyle = '#e8a52a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#b8781a';
      for (let y = 4; y < h; y += 8) for (let x = 4; x < w; x += 8) g.fillRect(x, y, 4, 4);
    }, [2, 1]);
    const gb = R * 2 + 70;
    this.box(gb, gb * 0.55, 120, yellow, 0, R * 0.55, H + 70, this.tool);
    const grilleTop = new THREE.Mesh(new THREE.PlaneGeometry(gb - 20, 110), new THREE.MeshStandardMaterial({ map: grille, roughness: 0.6 }));
    grilleTop.rotation.x = -Math.PI / 2;
    grilleTop.position.set(0, R * 0.55 + gb * 0.275 + 1, H + 70);
    this.tool.add(grilleTop);
    // motoreduktor: korpus szary, silnik z niebieska oslona wentylatora, zolty korek
    const shaft = this.cylinder(26, 50, 0x8d949c, this.tool, 20);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = H + 150;
    const gear = this.cylinder(m.motorDiameter / 2 + 10, 150, mat(0x7c8288, { metalness: 0.4, roughness: 0.45 }), this.tool, 32);
    gear.rotation.x = Math.PI / 2;
    gear.position.z = H + 175 + 75;
    const motor = this.cylinder(m.motorDiameter / 2 - 10, m.motorLength - 150, mat(0xa3a9af, { metalness: 0.35, roughness: 0.4 }), this.tool, 32);
    motor.rotation.x = Math.PI / 2;
    motor.position.z = H + 250 + (m.motorLength - 150) / 2;
    const fan = this.cylinder(m.motorDiameter / 2 - 4, 70, mat(0x1d4fb8, { roughness: 0.4 }), this.tool, 32);
    fan.rotation.x = Math.PI / 2;
    fan.position.z = H + 175 + m.motorLength + 35;
    const cap = this.cylinder(40, 50, yellow, this.tool, 24);
    cap.position.set(0, m.motorDiameter / 2 + 30, H + 260);
    this.motorRear = H + 175 + m.motorLength + 70;
    // woda
    this.water = new THREE.Mesh(new THREE.ConeGeometry(m.wheelDiameter * 0.55, 140, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x5fb3ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.z = -20;
    this.tool.add(this.water);
    // znacznik docisku (pierscien przy oslonie)
    this.clampRing = new THREE.Mesh(new THREE.TorusGeometry(R + 34, 6, 12, 48), mat(0x2ecc71, { emissive: 0x0b5d2a }));
    this.clampRing.position.z = H + 8;
    this.tool.add(this.clampRing);
  }

  resize() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Widoki: iso i przod od strony operatora (jak na zdjeciach), bok (przekroj profilu), gora
  view(name, centerX = 1000) {
    const th = this.m.tableHeight;
    const t = new THREE.Vector3(centerX, th + 200, 250);
    const p = {
      iso: [centerX + 1700, th + 1300, 3500], front: [centerX, th + 450, 4800],
      side: [this.m.travelX[0] - 900, th + 120, 260], top: [centerX, th + 4200, 600],
    }[name] ?? [centerX + 1700, th + 1300, 3500];
    if (name === 'side') t.set(this.m.travelX[0] + 200, th + 15, 0);
    if (name === 'top') t.set(centerX, th, 0);
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
    // sanki pionowe od wozka (przed belka) do obudowy B
    const colTop = this.beamTop + 190;
    this.column.scale.y = colTop - hubY;
    this.column.position.set(0, (colTop + hubY) / 2, hubZ + 80);
    // prowadnik kabli na belce: od punktu stalego do petli przy wozku
    const ca = this.chainFixX;
    const cb = x;
    this.chainRun.scale.x = Math.max(1, Math.abs(cb - ca));
    this.chainRun.position.x = (ca + cb) / 2;
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
