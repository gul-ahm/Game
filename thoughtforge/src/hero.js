import * as THREE from 'three';
import { TAU, clamp } from './config.js';
import { heightAt } from './terrain.js';
import { GLOW } from './meta.js';

const GRAVITY = 30;
const JUMP = 12;
const WALK = 9;
const RUN = 15;

const suit = new THREE.MeshStandardMaterial({ color: 0x1f2738, metalness: 0.5, roughness: 0.45 });
const trim = new THREE.MeshStandardMaterial({ color: 0xc9d3e6, metalness: 0.85, roughness: 0.3 });
const light = new THREE.MeshBasicMaterial({ color: new THREE.Color(GLOW).multiplyScalar(2.2) });

function part(geo, mat, x, y, z, parent) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function limb(len, radius, x, y, parent) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  part(new THREE.CapsuleGeometry(radius, len, 4, 8), suit, 0, -len / 2 - radius, 0, pivot);
  parent.add(pivot);
  return pivot;
}

function buildBody() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 1;
  root.add(body);

  part(new THREE.CapsuleGeometry(0.3, 0.5, 4, 10), suit, 0, 0.45, 0, body);
  part(new THREE.BoxGeometry(0.62, 0.34, 0.2), trim, 0, 0.62, 0.17, body);
  part(new THREE.OctahedronGeometry(0.09), light, 0, 0.62, 0.29, body);
  part(new THREE.TorusGeometry(0.31, 0.035, 6, 20).rotateX(Math.PI / 2), light, 0, 0.12, 0, body);

  const head = new THREE.Group();
  head.position.y = 1.12;
  body.add(head);
  part(new THREE.SphereGeometry(0.24, 14, 10), suit, 0, 0, 0, head);
  part(new THREE.BoxGeometry(0.34, 0.08, 0.1), light, 0, 0.02, 0.2, head);
  part(new THREE.ConeGeometry(0.05, 0.3, 4).rotateX(-0.5), trim, 0, 0.25, -0.05, head);

  const legL = limb(0.5, 0.11, 0.15, 0, body);
  const legR = limb(0.5, 0.11, -0.15, 0, body);
  const armL = limb(0.42, 0.09, 0.42, 0.82, body);
  const armR = limb(0.42, 0.09, -0.42, 0.82, body);
  for (const arm of [armL, armR]) {
    part(new THREE.SphereGeometry(0.12, 10, 8), trim, 0, -0.7, 0, arm);
    part(new THREE.TorusGeometry(0.13, 0.035, 6, 16).rotateX(Math.PI / 2), light, 0, -0.6, 0, arm);
  }

  const core = new THREE.Group();
  part(new THREE.IcosahedronGeometry(0.13, 1), light, 0, 0, 0, core);
  core.add(new THREE.PointLight(GLOW, 6, 9, 1.6));
  root.add(core);

  return { root, body, head, legL, legR, armL, armR, core };
}

export class Hero {
  constructor(scene) {
    this.parts = buildBody();
    scene.add(this.parts.root);
    this.time = 0;
    this.reset();
  }

  reset() {
    this.x = this.z = 0;
    this.y = heightAt(0, 0);
    this.vx = this.vy = this.vz = 0;
    this.facing = Math.PI;
    this.maxHp = this.hp = 100;
    this.maxWill = this.will = 100;
    this.grounded = true;
    this.stride = 0;
    this.cast = 0;
    this.castYaw = 0;
    this.idle = 9;
    this.hurtTime = 0;
    this.parts.root.visible = true;
  }

  get hand() {
    const s = Math.sin(this.facing), c = Math.cos(this.facing);
    return new THREE.Vector3(this.x - 0.45 * c + 0.5 * s, this.y + 1.5, this.z + 0.45 * s + 0.5 * c);
  }

  get chest() {
    return new THREE.Vector3(this.x, this.y + 1.4, this.z);
  }

  castAt(point) {
    this.cast = 0.4;
    this.idle = 0;
    this.castYaw = Math.atan2(point.x - this.x, point.z - this.z);
  }

  update(dt, game) {
    const { input, cam } = game;
    const move = input.axis();
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
    let wx = Math.cos(cam.yaw) * move.x + fx * move.y;
    let wz = -Math.sin(cam.yaw) * move.x + fz * move.y;
    const len = Math.hypot(wx, wz);
    if (len > 1) {
      wx /= len;
      wz /= len;
    }

    const top = input.keys.has('ShiftLeft') ? RUN : WALK;
    const grip = Math.min(1, dt * (this.grounded ? 10 : 2.5));
    this.vx += (wx * top - this.vx) * grip;
    this.vz += (wz * top - this.vz) * grip;
    if (this.grounded && input.hit('Space')) {
      this.vy = JUMP;
      this.grounded = false;
      game.audio.jump();
    }

    this.vy -= GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
    game.solid(this, 0.45);

    const floor = game.floorAt(this.x, this.z, this.y);
    const snap = this.grounded && this.vy <= 0 && this.y - floor < 0.45;
    if (this.y <= floor || snap) {
      if (this.vy < -20) game.particles.burst(this.x, floor + 0.1, this.z, 0xd9c8a8, 18, 6, 0.6);
      this.y = floor;
      this.vy = 0;
      this.grounded = true;
      if (floor > heightAt(this.x, this.z) + 1) game.goal('climb');
    } else {
      this.grounded = false;
    }
    if (this.y < -28) game.fell();

    this.cast -= dt;
    this.idle += dt;
    this.hurtTime -= dt;
    this.will = Math.min(this.maxWill, this.will + (this.idle > 1 ? 22 : 8) * game.regen * dt);
    this.animate(dt);
  }

  animate(dt) {
    const p = this.parts;
    const speed = Math.hypot(this.vx, this.vz);
    const pace = clamp(speed / WALK, 0, 1);
    this.time += dt;

    const want = this.cast > 0 ? this.castYaw : speed > 0.6 ? Math.atan2(this.vx, this.vz) : this.facing;
    let turn = want - this.facing;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    this.facing += turn * Math.min(1, dt * 12);

    this.stride += dt * speed * 1.1;
    const swing = Math.sin(this.stride) * pace * 0.8;
    if (this.grounded) {
      p.legL.rotation.x = swing;
      p.legR.rotation.x = -swing;
    } else {
      p.legL.rotation.x = -0.7;
      p.legR.rotation.x = 0.35;
    }
    p.armL.rotation.x = -swing * 0.8;
    p.armR.rotation.x = this.cast > 0 ? -1.55 : swing * 0.8;
    p.armR.rotation.z = this.cast > 0 ? 0.15 : 0;
    p.body.position.y = 1 + Math.abs(Math.cos(this.stride)) * 0.07 * pace;
    p.body.rotation.x = pace * 0.12;
    p.head.rotation.y = this.cast > 0 ? 0 : Math.sin(this.time * 0.7) * 0.15 * (1 - pace);

    const orbit = this.time * 2;
    p.core.position.set(Math.cos(orbit) * 0.75, 2 + Math.sin(this.time * 3) * 0.12, Math.sin(orbit) * 0.75);
    light.color.setHex(this.hurtTime > 0 ? 0xff5566 : GLOW).multiplyScalar(1.4 + (this.will / this.maxWill) * 1.2);

    p.root.position.set(this.x, this.y, this.z);
    p.root.rotation.y = this.facing;
  }
}
