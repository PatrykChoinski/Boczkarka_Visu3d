// Tryb offline: symulator boczkarki - sekwencja jak EdgeProfileControl w PLC (kroki EdgeStep), osie X i B z profilem
// trapezowym, wrzeciono z rampa, docisk z czasem ustalenia, pauza i stop. Migawka state() ma te same pola co wartosci
// z PLC w trybie online (strona rysuje oba tryby tym samym kodem).
import { STEP } from './config.js';
import { generatePasses, validateProfile } from './edgeprofile.js';

// Os z ruchem do celu: predkosc ograniczona do vmax i do hamowania sqrt(2 a d), przyspieszenie a
export class Axis {
  constructor(pos = 0) { this.pos = pos; this.vel = 0; this.target = null; this.vmax = 0; this.acc = 1; }
  moveTo(target, vmax, acc) { this.target = target; this.vmax = Math.abs(vmax); this.acc = Math.abs(acc); }
  halt() { this.target = null; }
  get done() { return this.target === null && Math.abs(this.vel) < 1e-6; }
  step(dt) {
    let want = 0;
    if (this.target !== null) {
      const d = this.target - this.pos;
      if (Math.abs(d) < 1e-4 && Math.abs(this.vel) < this.acc * dt * 1.5) {
        this.pos = this.target;
        this.vel = 0;
        this.target = null;
        return;
      }
      want = Math.sign(d) * Math.min(this.vmax, Math.sqrt(2 * this.acc * Math.abs(d)));
    }
    const dv = this.acc * dt;
    this.vel = this.vel < want ? Math.min(want, this.vel + dv) : Math.max(want, this.vel - dv);
    const next = this.pos + this.vel * dt;
    // bez przestrzelenia celu
    if (this.target !== null && (this.target - this.pos) * (this.target - next) < 0) {
      this.pos = this.target;
      this.vel = 0;
      this.target = null;
    } else this.pos = next;
  }
}

export class EdgeSimulator {
  constructor(opts = {}) {
    this.o = {
      xMaxVelocity: 400, xAcceleration: 1500, returnVelocity: 300, bVelocity: 45, bAcceleration: 360,
      clampDelay: 1.0, spindleRamp: 25, waterOffDelay: 3, loadPositionX: 0, parkAngleB: 0, autoReturn: true,
      limits: {}, ...opts,
    };
    this.x = new Axis(this.o.loadPositionX);
    this.b = new Axis(0);
    this.profile = null;
    this.passes = [];
    this.reset();
  }

  reset() {
    this.step = STEP.WaitForStart;
    this.pauseStep = STEP.WaitForStart;
    this.passIndex = 0;
    this.repeatIndex = 0;
    this.direction = true;
    this.passFrom = null;
    this.spindleRequest = false;
    this.spindleSet = 0;
    this.spindleFrequency = 0;
    this.water = false;
    this.waterTimer = 0;
    this.clamp = false;
    this.timer = 0;
    this.cycles = this.cycles ?? 0;
    this.meters = this.meters ?? 0;
    this.error = 0;
    this.x.halt();
    this.b.halt();
  }

  // Start / wznowienie (jak przycisk START)
  start(profile) {
    if (this.step === STEP.Pause) {
      this.step = this.pauseStep === STEP.PassX ? STEP.ClampOn : this.pauseStep;
      this.timer = 0;
      return true;
    }
    if (this.step !== STEP.WaitForStart) return false;
    const { ok, passes } = generatePasses(profile);
    this.error = ok ? validateProfile(profile, passes, this.o.limits) : 3;
    if (this.error) { this.step = STEP.WaitForCommand; return false; }
    this.profile = profile;
    this.passes = passes;
    this.left = profile.xStart - profile.overtravel;
    this.right = profile.xEnd + profile.overtravel;
    this.passIndex = 1;
    this.repeatIndex = 1;
    this.direction = profile.bothDirections ? Math.abs(this.x.pos - this.left) <= Math.abs(this.x.pos - this.right) : true;
    this.step = STEP.SpindleStart;
    return true;
  }

  pause() {
    if ([STEP.WaitForStart, STEP.WaitForCommand, STEP.Pause].includes(this.step)) return;
    this.pauseStep = this.step;
    this.x.halt();
    this.b.halt();
    this.clamp = false;
    this.step = STEP.Pause;
  }

  stop() {
    if (this.step === STEP.WaitForStart) return;
    this.x.halt();
    this.b.halt();
    this.clamp = false;
    this.spindleRequest = false;
    this.water = false;
    this.step = STEP.WaitForCommand;
  }

  // Potwierdzenie po stopie (jak skasowanie alarmow): powrot do gotowosci
  acknowledge() {
    if (this.step === STEP.WaitForCommand && this.x.done && this.b.done) { this.step = STEP.WaitForStart; this.error = 0; }
  }

  feed() { // mm/s
    const pass = this.passes[this.passIndex - 1];
    const f = pass && pass.feed > 0 ? pass.feed : this.profile.feed;
    return (f * 1000) / 60;
  }

  frequency() {
    const pass = this.passes[this.passIndex - 1];
    return pass && pass.spindleFrequency > 0 ? pass.spindleFrequency : this.profile?.spindleFrequency ?? 0;
  }

  startSide() { return this.direction ? this.left : this.right; }

  // Ruch osi zlecany raz na krok; true = dojechala
  moveX(target, vel) {
    if (!this.moving) { this.x.moveTo(target, Math.min(vel, this.o.xMaxVelocity), this.o.xAcceleration); this.moving = true; }
    if (this.x.done) { this.moving = false; return true; }
    return false;
  }

  moveB(target) {
    if (!this.moving) { this.b.moveTo(target, this.o.bVelocity, this.o.bAcceleration); this.moving = true; }
    if (this.b.done) { this.moving = false; return true; }
    return false;
  }

  go(step) { this.step = step; this.timer = 0; this.moving = false; }

  tick(dt) {
    // kroki krotsze niz 20 ms (stabilny ruch przy przyspieszonej symulacji)
    for (let left = dt; left > 1e-9; left -= 0.02) this.update(Math.min(0.02, left));
  }

  update(dt) {
    this.timer += dt;
    this.x.step(dt);
    this.b.step(dt);
    // wrzeciono: rampa do zadanej
    const want = this.spindleRequest ? this.spindleSet : 0;
    const ramp = this.o.spindleRamp * dt;
    this.spindleFrequency += Math.max(-ramp, Math.min(ramp, want - this.spindleFrequency));
    const atSpeed = this.spindleRequest && Math.abs(this.spindleFrequency - this.spindleSet) < 0.5;
    if (this.water) this.waterTimer = this.o.waterOffDelay;
    else this.waterTimer = Math.max(0, this.waterTimer - dt);

    switch (this.step) {
      case STEP.SpindleStart:
        this.spindleSet = this.frequency();
        this.spindleRequest = true;
        this.water = true;
        if (atSpeed) this.go(STEP.MoveToStart);
        break;
      case STEP.MoveToStart:
        if (this.moveX(this.startSide(), this.o.returnVelocity)) this.go(STEP.MoveBAngle);
        break;
      case STEP.MoveBAngle:
        this.spindleSet = this.frequency();
        if (this.moveB(this.passes[this.passIndex - 1].angleB)) this.go(STEP.ClampOn);
        break;
      case STEP.ClampOn:
        this.clamp = true;
        if (this.timer >= this.o.clampDelay && atSpeed) {
          if (this.passFrom === null) this.passFrom = this.x.pos;
          this.go(STEP.PassX);
        }
        break;
      case STEP.PassX:
        if (this.moveX(this.direction ? this.right : this.left, this.feed())) {
          this.clamp = false;
          this.passFrom = null;
          this.meters += (this.profile.xEnd - this.profile.xStart) / 1000;
          this.go(STEP.NextPass);
        }
        break;
      case STEP.NextPass:
        if (this.repeatIndex < this.passes[this.passIndex - 1].repeats) this.repeatIndex += 1;
        else { this.repeatIndex = 1; this.passIndex += 1; }
        if (this.passIndex <= this.passes.length) {
          if (this.profile.bothDirections) { this.direction = !this.direction; this.go(STEP.MoveBAngle); } else this.go(STEP.ReturnX);
        } else this.go(STEP.AutoReturn);
        break;
      case STEP.ReturnX:
        if (this.moveX(this.startSide(), this.o.returnVelocity)) this.go(STEP.MoveBAngle);
        break;
      case STEP.AutoReturn:
        if (!this.o.autoReturn) this.go(STEP.SpindleStop);
        else if (this.moveB(this.o.parkAngleB)) this.go(STEP.AutoReturnX);
        break;
      case STEP.AutoReturnX:
        if (this.moveX(this.o.loadPositionX, this.o.returnVelocity)) this.go(STEP.SpindleStop);
        break;
      case STEP.SpindleStop:
        this.spindleRequest = false;
        this.water = false;
        if (this.spindleFrequency < 0.5) this.go(STEP.EndProcedure);
        break;
      case STEP.EndProcedure:
        this.cycles += 1;
        this.go(STEP.WaitForStart);
        break;
      default:
        break;
    }
    // przejazd przerwany pauza: poczatek szlifowanego odcinka zostaje (wznowienie dokonczy go)
  }

  // Migawka w ksztalcie wartosci PLC (klucze VARIABLES)
  state() {
    const pass = this.passes[this.passIndex - 1];
    return {
      x: this.x.pos, b: this.b.pos, xVelocity: this.x.vel, xHomed: true, bHomed: true, mode: 2, simulation: true, safetyOk: true,
      step: this.step, passIndex: this.passIndex, repeatIndex: this.repeatIndex, passCount: this.passes.length,
      passAngle: pass ? pass.angleB : 0, directionPositive: this.direction, passFrom: this.passFrom,
      spindleRunning: this.spindleFrequency > 0.5 || this.spindleRequest, spindleFrequency: this.spindleFrequency,
      water: this.water || this.waterTimer > 0, clamp: this.clamp, alarmAny: this.step === STEP.WaitForCommand,
      validationError: this.error, cycles: this.cycles, metersTotal: this.meters,
    };
  }
}
