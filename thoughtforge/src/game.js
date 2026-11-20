import * as THREE from 'three';
import { ISLAND, TAU, rand, clamp } from './config.js';
import { CONSTRUCTS, GOALS, GLOW } from './meta.js';
import { load, store } from './save.js';
import { recognise } from './gesture.js';
import { World, heightAt } from './terrain.js';
import { Hero } from './hero.js';
import { Forge, wallLocal } from './constructs.js';
import { Foes } from './foes.js';
import { Particles } from './particles.js';

const PERFECT = 0.9;
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

export class Game {
  constructor({ scene, camera, hud, input, audio }) {
    Object.assign(this, { scene, camera, hud, input, audio });
    this.world = new World(scene);
    this.particles = new Particles(scene);
    this.hero = new Hero(scene);
    this.forge = new Forge(scene);
    this.foes = new Foes(scene);
    this.cam = { yaw: 0, pitch: 0.38, dist: 15, target: new THREE.Vector3(0, 1.6, 0), shake: 0 };
    this.view = { w: 1280, h: 720 };
    this.save = load();
    this.state = 'menu';
    this.mode = 'sandbox';
    this.reset();
  }

  get regen() {
    return this.mode === 'sandbox' ? 2 : 1;
  }

  reset() {
    this.forge.clear();
    this.foes.clear();
    this.particles.clear();
    this.hero.reset();
    this.cam.yaw = 0;
    this.time = 0;
    this.score = 0;
    this.kills = 0;
    this.forged = 0;
    this.blocks = 0;
    this.shapes = new Set();
    this.wave = 0;
    this.queue = [];
    this.rest = 3;
    this.spawnGap = 1;
    this.spawnTimer = 0;
    this.waveLive = false;
    if (this.mode === 'sandbox') this.stage();
  }

  stage() {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      this.foes.spawn('dummy', Math.cos(a) * 7, Math.sin(a) * 7);
    }
    for (let i = 0; i < 6; i++) this.foes.spawn('crate', 15 + (i % 3) * 1.9, -3 + Math.floor(i / 3) * 1.9);
  }

  setState(state) {
    this.state = state;
    this.hud.setState(state, this);
  }

  start(mode) {
    this.audio.unlock();
    this.mode = mode;
    this.reset();
    this.setState('playing');
    if (mode === 'sandbox') this.hud.banner('Playground', 'Hold the left mouse button and draw a shape');
    else this.hud.banner('Trial', 'Hold the island against the Hollows');
  }

  quit() {
    this.reset();
    this.setState('menu');
  }

  togglePause() {
    if (this.state === 'playing') this.setState('paused');
    else if (this.state === 'paused') this.setState('playing');
  }

  update(dt) {
    const { input } = this;
    if (input.hit('KeyM')) this.audio.toggle();
    if (input.hit('Escape') || input.hit('KeyP')) this.togglePause();
    const stroke = input.takeStroke();

    if (this.state === 'playing') {
      if (stroke) this.forgeStroke(stroke);
      this.step(dt);
    } else if (this.state === 'over') {
      this.particles.update(dt);
    }
    if (this.state !== 'paused') this.world.update(dt, this.hero);

    this.moveCamera(dt);
    this.hud.update(this, dt);
    input.endFrame();
  }

  step(dt) {
    this.time += dt;
    this.hero.update(dt, this);
    if (this.mode === 'trial') this.runTrial(dt);
    else if (this.input.hit('KeyH')) this.summon();
    this.foes.update(dt, this);
    this.forge.update(dt, this);
    this.particles.update(dt);
    if (this.hero.hp <= 0) this.gameOver();
  }

  // Turning a drawing into an intent: screen strokes become places, sizes and directions on the island.

  aim(px, py) {
    ndc.set((px / this.view.w) * 2 - 1, -(py / this.view.h) * 2 + 1);
    ray.setFromCamera(ndc, this.camera);
    return ray.ray;
  }

  pick(px, py) {
    const { origin, direction } = this.aim(px, py);
    const at = t => origin.clone().addScaledVector(direction, t);
    let near = 0;
    for (let far = 1; far < 240; far++) {
      const p = at(far);
      if (p.y > heightAt(p.x, p.z)) {
        near = far;
        continue;
      }
      for (let i = 0; i < 10; i++) {
        const mid = (near + far) / 2;
        const q = at(mid);
        if (q.y > heightAt(q.x, q.z)) near = mid;
        else far = mid;
      }
      return at(far);
    }
    return at(direction.y < -0.02 ? (this.hero.y - origin.y) / direction.y : 40);
  }

  pickFoe(px, py) {
    const r = this.aim(px, py);
    let best = null, bestT = Infinity;
    for (const f of this.foes.list) {
      const chest = new THREE.Vector3(f.x, f.y + f.height * 0.55, f.z);
      if (r.distanceSqToPoint(chest) > (f.radius + 0.7) ** 2) continue;
      const t = chest.distanceTo(r.origin);
      if (t < bestT) {
        best = chest;
        bestT = t;
      }
    }
    return best;
  }

  plan(points, read) {
    const mid = { x: 0, y: 0 };
    for (const p of points) {
      mid.x += p.x / points.length;
      mid.y += p.y / points.length;
    }
    const center = this.pick(mid.x, mid.y);
    const step = Math.max(1, Math.floor(points.length / 12));
    let spread = 0, n = 0;
    for (let i = 0; i < points.length; i += step) {
      const p = this.pick(points[i].x, points[i].y);
      spread += Math.hypot(p.x - center.x, p.z - center.z);
      n++;
    }
    const size = spread / n;

    // "Around me" is judged on screen, where the player drew it, not on the slanted ground.
    let reach = 0;
    for (const p of points) reach += Math.hypot(p.x - mid.x, p.y - mid.y) / points.length;
    const h = this.hero;
    const me = h.chest.project(this.camera);
    const meX = ((me.x + 1) / 2) * this.view.w, meY = ((1 - me.y) / 2) * this.view.h;

    return {
      center,
      size,
      start: this.pick(points[0].x, points[0].y),
      end: this.pick(points.at(-1).x, points.at(-1).y),
      target: read.shape === 'tap' ? this.pickFoe(mid.x, mid.y) : null,
      around: Math.hypot(meX - mid.x, meY - mid.y) < reach * 0.7,
      power: 0.6 + 0.6 * read.clarity + (read.clarity >= PERFECT ? 0.15 : 0),
    };
  }

  forgeStroke(points) {
    const read = recognise(points);
    if (!read) return null;
    const info = CONSTRUCTS[read.shape];
    const h = this.hero;
    if (h.will < info.cost) {
      this.audio.fizzle();
      this.hud.ink(points, false);
      this.hud.toast('Not enough will', `${info.name} needs ${info.cost}`);
      return null;
    }

    const plan = this.plan(points, read);
    h.will -= info.cost;
    h.castAt(plan.center);
    const made = this.forge.cast(read.shape, plan, this);
    this.forged++;
    this.shapes.add(read.shape);
    if (this.shapes.size === 6) this.goal('all');
    if (read.clarity >= PERFECT && read.shape !== 'tap') this.goal('perfect');
    this.audio.forge(read.shape);
    this.hud.ink(points, true);
    this.hud.cast(made.kind, read.clarity, read.shape);
    return made;
  }

  // Shared physics rules for the hero and every foe.

  floorAt(x, z, y) {
    let floor = heightAt(x, z);
    for (const w of this.forge.walls) {
      if (y < w.top - 0.6 || w.top <= floor) continue;
      const { lx, lz } = wallLocal(w, x, z);
      if (Math.abs(lx) <= w.width / 2 && Math.abs(lz) <= w.depth / 2 + 0.15) floor = w.top;
    }
    return floor;
  }

  solid(b, r) {
    for (const c of this.world.colliders) {
      const dx = b.x - c.x, dz = b.z - c.z, min = c.r + r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 1;
      b.x = c.x + (dx / d) * min;
      b.z = c.z + (dz / d) * min;
    }
    for (const w of this.forge.walls) {
      if (b.y >= w.top - 0.35 || b.y + 1.5 < w.base) continue;
      let { lx, lz } = wallLocal(w, b.x, b.z);
      const hw = w.width / 2 + r, hd = w.depth / 2 + r;
      const px = hw - Math.abs(lx), pz = hd - Math.abs(lz);
      if (px <= 0 || pz <= 0) continue;
      if (px < pz) lx = (lx >= 0 ? 1 : -1) * hw;
      else lz = (lz >= 0 ? 1 : -1) * hd;
      const c = Math.cos(w.yaw), s = Math.sin(w.yaw);
      b.x = w.x + lx * c + lz * s;
      b.z = w.z - lx * s + lz * c;
    }
  }

  damage(f, amount, push) {
    if (f.dead) return;
    const n = Math.max(1, Math.round(amount));
    f.hp -= n;
    f.flash = 0.1;
    this.hud.pop(n, new THREE.Vector3(f.x, f.y + f.height + 0.4, f.z), f.kind === 'dummy');
    this.audio.hit();
    if (push && f.kind === 'dummy') {
      f.wobbleV += Math.hypot(push.x, push.z) * 0.15 + 1;
      f.tiltYaw = Math.atan2(push.x, push.z);
    } else if (push) {
      f.vx += push.x / f.mass;
      f.vy += push.y / f.mass;
      f.vz += push.z / f.mass;
      if (f.speed) f.stun = Math.max(f.stun, 0.3);
    }
    if (f.hp <= 0) this.kill(f);
  }

  kill(f) {
    f.dead = true;
    const y = f.y + f.height * 0.5;
    this.audio.pop();
    if (f.kind === 'crate') {
      this.particles.burst(f.x, y, f.z, 0xc89a5a, 30, 10, 0.9, 20);
      if (this.mode === 'sandbox') this.foes.respawnLater(f);
      return;
    }
    this.particles.burst(f.x, y, f.z, 0x9b5cff, 40, 12, 0.9);
    this.particles.burst(f.x, y, f.z, 0xff3cc8, 12, 6, 0.6);
    this.kills++;
    this.score += f.score * Math.max(1, this.wave);
    for (let i = 0; i < (f.kind === 'brute' ? 4 : 2); i++) this.foes.motes.drop('will', f.x, f.y, f.z);
    if (Math.random() < 0.2) this.foes.motes.drop('life', f.x, f.y, f.z);
  }

  ringOut(f) {
    if (f.dead) return;
    if (f.speed) {
      this.hud.toast('Ring out', 'Knocked off the island');
      this.goal('ringout');
    }
    this.kill(f);
  }

  quake(at, r, dmg, small = false) {
    for (const f of this.foes.list) {
      const dx = f.x - at.x, dz = f.z - at.z, d = Math.hypot(dx, dz);
      if (d > r + f.radius) continue;
      const k = 1 - Math.min(1, d / (r + f.radius)) * 0.5;
      const out = ((small ? 4 : 16) * k) / (d || 1);
      this.damage(f, dmg * k, { x: dx * out, y: (small ? 3 : 13) * k, z: dz * out });
      if (f.kind === 'crate' && f.vy > 8) this.goal('launch');
    }
    const y = heightAt(at.x, at.z) + 0.3;
    this.particles.ring(at.x, y, at.z, 0x9ffcff, small ? 24 : 70, small ? 10 : 26, 0.7);
    this.particles.burst(at.x, y, at.z, 0xd9c8a8, small ? 8 : 40, small ? 5 : 12, 1, 12);
    this.cam.shake = Math.min(1, this.cam.shake + (small ? 0.2 : 0.8));
    if (!small) this.audio.slam();
  }

  hurtHero(amount, from) {
    const h = this.hero;
    if (h.hurtTime > 0) return;
    const left = this.forge.absorb(amount);
    if (left < amount) this.blocked();
    if (left <= 0) return;

    h.hurtTime = 0.5;
    const dx = h.x - from.x, dz = h.z - from.z, d = Math.hypot(dx, dz) || 1;
    h.vx += (dx / d) * 10;
    h.vz += (dz / d) * 10;
    h.vy = Math.max(h.vy, 5);
    h.grounded = false;
    if (this.mode === 'trial') h.hp -= left;
    this.audio.hurt();
    this.hud.flash();
    this.cam.shake = Math.min(1, this.cam.shake + 0.4);
  }

  blocked() {
    this.blocks++;
    if (this.blocks >= 10) this.goal('block');
  }

  fell() {
    const h = this.hero;
    h.x = h.z = 0;
    h.y = heightAt(0, 0) + 6;
    h.vx = h.vy = h.vz = 0;
    if (this.mode === 'trial') h.hp -= 20;
    this.hud.toast('You fell', this.mode === 'trial' ? 'Lost 20 health' : 'Back to the ring');
  }

  goal(id) {
    if (this.save.goals[id]) return;
    this.save.goals[id] = true;
    store(this.save);
    this.hud.toast('Goal complete', GOALS.find(g => g.id === id).text);
    this.audio.chime();
  }

  spot(test) {
    for (let tries = 0; tries < 40; tries++) {
      const p = test();
      if (Math.hypot(p.x, p.z) < ISLAND * 0.85) return p;
    }
    return { x: 0, z: -20 };
  }

  summon() {
    const h = this.hero;
    for (let i = 0; i < 3; i++) {
      const a = rand(0, TAU), r = rand(16, 22);
      const p = this.spot(() => ({ x: h.x + Math.cos(a) * r, z: h.z + Math.sin(a) * r }));
      this.foes.spawn(i === 2 ? 'spitter' : 'hollow', p.x, p.z);
    }
    this.hud.toast('Hollows summoned', 'They cannot hurt you here');
  }

  runTrial(dt) {
    if (!this.queue.length && !this.foes.creatures) {
      if (this.waveLive) this.waveClear();
      this.rest -= dt;
      if (this.rest <= 0) this.nextWave();
      return;
    }
    this.spawnTimer -= dt;
    if (!this.queue.length || this.spawnTimer > 0 || this.foes.creatures >= 30) return;
    this.spawnTimer = this.spawnGap;
    const h = this.hero;
    const p = this.spot(() => {
      const a = rand(0, TAU), r = rand(0.55, 0.82) * ISLAND;
      const q = { x: Math.cos(a) * r, z: Math.sin(a) * r };
      return Math.hypot(q.x - h.x, q.z - h.z) > 22 ? q : { x: 999, z: 999 };
    });
    this.foes.spawn(this.queue.shift(), p.x, p.z, 1 + (this.wave - 1) * 0.12);
    this.particles.burst(p.x, heightAt(p.x, p.z) + 1, p.z, 0x9b5cff, 24, 8, 0.8);
  }

  nextWave() {
    const w = ++this.wave;
    this.queue = Array.from({ length: 2 + w * 2 }, () => 'hollow');
    for (let i = 0; i < Math.floor(w / 2); i++) this.queue.splice(Math.floor(rand(0, this.queue.length)), 0, 'spitter');
    for (let i = 0; i < Math.min(4, Math.floor((w - 1) / 2)); i++) this.queue.push('brute');
    this.spawnGap = Math.max(0.35, 1.2 - w * 0.07);
    this.waveLive = true;
    this.rest = 4;
    this.hud.banner('Wave ' + w, w >= 3 && w % 2 ? 'Brutes are coming' : '');
  }

  waveClear() {
    this.waveLive = false;
    const bonus = 50 * this.wave;
    const h = this.hero;
    this.score += bonus;
    h.hp = Math.min(h.maxHp, h.hp + 20);
    this.hud.toast('Wave clear', `+${bonus} score, +20 health`);
    if (this.wave >= 5) this.goal('wave5');
    this.audio.chime();
  }

  gameOver() {
    const h = this.hero;
    h.parts.root.visible = false;
    this.particles.burst(h.x, h.y + 1, h.z, GLOW, 120, 20, 1.4);
    this.audio.slam();
    this.newBest = this.score > this.save.best;
    if (this.newBest) {
      this.save.best = this.score;
      store(this.save);
    }
    this.setState('over');
  }

  moveCamera(dt) {
    const { cam, camera, hero, input } = this;
    const look = input.takeLook();
    if (this.state === 'menu') {
      const a = this.world.t * 0.08;
      camera.position.set(Math.sin(a) * 30, 12, Math.cos(a) * 30);
      camera.lookAt(0, 2, 0);
      camera.updateMatrixWorld();
      return;
    }
    if (this.state === 'playing') {
      const spin = (input.keys.has('KeyE') ? 1 : 0) - (input.keys.has('KeyQ') ? 1 : 0);
      cam.yaw -= look.dx * 0.005 + spin * dt * 2;
      cam.pitch = clamp(cam.pitch + look.dy * 0.004, 0.08, 1.2);
      cam.dist = clamp(cam.dist + look.zoom * 0.01, 7, 30);
      cam.shake = Math.max(0, cam.shake - dt * 2);
    }

    const k = 1 - Math.exp(-dt * 10);
    cam.target.x += (hero.x - cam.target.x) * k;
    cam.target.y += (hero.y + 1.6 - cam.target.y) * k;
    cam.target.z += (hero.z - cam.target.z) * k;
    const flat = Math.cos(cam.pitch) * cam.dist;
    const p = camera.position.set(
      cam.target.x + Math.sin(cam.yaw) * flat,
      cam.target.y + Math.sin(cam.pitch) * cam.dist,
      cam.target.z + Math.cos(cam.yaw) * flat
    );
    p.y = Math.max(p.y, heightAt(p.x, p.z) + 1);
    const s = cam.shake ** 2 * 0.8;
    p.x += rand(-s, s);
    p.y += rand(-s, s);
    p.z += rand(-s, s);
    camera.lookAt(cam.target);
    camera.updateMatrixWorld();
  }
}
