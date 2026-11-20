import * as THREE from 'three';
import { ARENA, TAU } from './config.js';

const orbGeo = new THREE.SphereGeometry(0.7, 12, 8);
const orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffcc33).multiplyScalar(2.2) });

export function buildShip() {
  const ship = new THREE.Group();
  const hull = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xd5deee, metalness: 0.6, roughness: 0.35, flatShading: true });
  const paint = new THREE.MeshStandardMaterial({ color: 0x2a6cff, metalness: 0.4, roughness: 0.5, flatShading: true });
  const light = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x55eeff).multiplyScalar(2.5) });

  const body = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.6, 6).rotateX(Math.PI / 2), metal);
  const wings = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.16, 1.2), paint);
  wings.position.z = -0.8;
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 1), paint);
  fin.position.set(0, 0.45, -1.1);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), light);
  cockpit.position.set(0, 0.35, 0.2);
  cockpit.scale.z = 1.8;
  hull.add(body, wings, fin, cockpit);

  for (const side of [-1, 1]) {
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.7, 8).rotateX(Math.PI / 2), light);
    engine.position.set(side * 0.9, 0, -1.6);
    hull.add(engine);
  }

  ship.add(hull);
  ship.position.y = 1;
  ship.userData.hull = hull;
  return ship;
}

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.mesh = buildShip();
    this.hull = this.mesh.userData.hull;
    this.orbMeshes = [];
    scene.add(this.mesh);
    this.reset();
  }

  reset(shop = {}) {
    const rank = id => shop[id] || 0;
    this.x = this.z = this.vx = this.vz = 0;
    this.angle = 0;
    this.maxHp = this.hp = 100 + rank('armor') * 10;
    this.maxShield = this.shield = 40 + rank('reactor') * 10;
    this.shieldRegen = 8;
    this.shieldWait = 3;
    this.shieldDelay = 0;
    this.speed = 26 * (1 + rank('engine') * 0.04);
    this.fireRate = 0.2;
    this.damage = 12 * (1 + rank('cannon') * 0.06);
    this.shots = 1;
    this.pierce = 0;
    this.magnet = 9;
    this.dashCd = 2.2;
    this.dashTimer = 0;
    this.nova = 0;
    this.orbs = 0;
    this.wellPower = 0;
    this.leech = 0;
    this.blast = 0;
    this.gemValue = 1;
    this.overdrive = 0;
    this.cool = 0;
    this.invuln = 0;
    this.taken = {};
    for (const orb of this.orbMeshes) this.scene.remove(orb);
    this.orbMeshes.length = 0;
    this.mesh.visible = true;
    this.mesh.position.set(0, 1, 0);
  }

  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  hurt(n) {
    if (this.invuln > 0) return false;
    this.shieldDelay = this.shieldWait;
    const blocked = Math.min(this.shield, n);
    this.shield -= blocked;
    this.hp -= n - blocked;
    this.invuln = 0.6;
    return true;
  }

  update(dt, game) {
    const { input, aim, particles } = game;
    const move = input.axis();
    const len = Math.hypot(move.x, move.z);
    const dirX = len ? move.x / len : 0;
    const dirZ = len ? move.z / len : 0;

    const grip = Math.min(1, dt * 7);
    this.vx += (dirX * this.speed - this.vx) * grip;
    this.vz += (dirZ * this.speed - this.vz) * grip;

    this.angle = Math.atan2(aim.x - this.x, aim.z - this.z);
    const sin = Math.sin(this.angle), cos = Math.cos(this.angle);

    this.dashTimer -= dt;
    if (input.hit('Space') && this.dashTimer <= 0) {
      const dx = len ? dirX : sin, dz = len ? dirZ : cos;
      this.vx = dx * this.speed * 3.6;
      this.vz = dz * this.speed * 3.6;
      this.dashTimer = this.dashCd;
      this.invuln = Math.max(this.invuln, 0.35);
      particles.burst(this.x, this.z, 0x55eeff, 30, 25, 0.5);
      game.audio.dash();
      const ring = this.nova && 8 + this.nova * 6;
      for (let i = 0; i < ring; i++) {
        const a = (i / ring) * TAU;
        game.shots.spawn(this.x, this.z, Math.sin(a) * 55, Math.cos(a) * 55, this.damage * 1.5, 0.8, 1);
      }
    }

    this.x += this.vx * dt;
    this.z += this.vz * dt;
    const d = Math.hypot(this.x, this.z);
    if (d > ARENA - 2) {
      this.x *= (ARENA - 2) / d;
      this.z *= (ARENA - 2) / d;
    }

    this.cool -= dt;
    this.overdrive -= dt;
    if (input.mouse.down && this.cool <= 0) {
      this.cool = this.overdrive > 0 ? this.fireRate / 2 : this.fireRate;
      for (let i = 0; i < this.shots; i++) {
        const a = this.angle + (i - (this.shots - 1) / 2) * 0.11;
        const sx = Math.sin(a), sz = Math.cos(a);
        game.shots.spawn(this.x + sx * 2, this.z + sz * 2, sx * 75, sz * 75, this.damage, 1.1, this.pierce);
      }
      game.audio.shoot();
    }

    this.shieldDelay -= dt;
    if (this.shieldDelay <= 0) this.shield = Math.min(this.maxShield, this.shield + this.shieldRegen * dt);
    this.invuln -= dt;

    const speed = Math.hypot(this.vx, this.vz);
    if (speed > 4 && Math.random() < dt * 60) {
      particles.spawn(this.x - sin * 1.8, 1, this.z - cos * 1.8, -this.vx * 0.2, 0, -this.vz * 0.2, 0x3399ff, 0.35);
    }

    this.mesh.position.set(this.x, 1, this.z);
    this.mesh.rotation.y = this.angle;
    this.mesh.visible = this.invuln <= 0 || Math.floor(this.invuln * 20) % 2 === 0;
    const slide = this.vx * cos - this.vz * sin;
    this.hull.rotation.z += (-slide * 0.025 - this.hull.rotation.z) * grip;

    while (this.orbMeshes.length < this.orbs) {
      const orb = new THREE.Mesh(orbGeo, orbMat);
      this.orbMeshes.push(orb);
      this.scene.add(orb);
    }
    this.orbMeshes.forEach((orb, i) => {
      const a = game.time * 2.6 + (i / this.orbs) * TAU;
      orb.position.set(this.x + Math.cos(a) * 6, 1, this.z + Math.sin(a) * 6);
    });
  }
}
