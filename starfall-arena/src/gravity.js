import * as THREE from 'three';
import { TAU, rand } from './config.js';

const COOLDOWN = 8;
const CORE = 2.2;

// A short lived gravity well. It drags enemies in, swallows enemy shots,
// then collapses and throws the swallowed energy back as player shots.
export class Singularity {
  constructor(scene) {
    const core = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 14), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.22, 8, 48).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xaa66ff).multiplyScalar(2.5) })
    );
    this.mesh = new THREE.Group().add(core, this.ring);
    scene.add(this.mesh);
    this.reset();
  }

  reset() {
    this.x = this.z = 0;
    this.life = 0;
    this.cool = 0;
    this.absorbed = 0;
    this.best = 0;
    this.mesh.visible = false;
  }

  get charge() {
    return 1 - Math.max(0, this.cool) / COOLDOWN;
  }

  cast(x, z, power) {
    this.x = x;
    this.z = z;
    this.reach = 24 + power * 4;
    this.life = 3 + power * 0.8;
    this.cool = COOLDOWN;
    this.absorbed = 0;
    this.mesh.position.set(x, 1, z);
    this.mesh.visible = true;
  }

  update(dt, game) {
    this.cool -= dt;
    if (this.life <= 0) return;
    this.life -= dt;
    const { x, z, reach } = this;

    for (const e of game.enemies.list) {
      const dx = x - e.x, dz = z - e.z;
      const d = Math.hypot(dx, dz);
      if (d > reach || d < 1) continue;
      const pull = 34 * (1 - d / reach) * (e.type === 'boss' ? 0.1 : 1) * dt;
      e.x += (dx / d) * pull;
      e.z += (dz / d) * pull;
    }

    for (const b of game.bolts.items) {
      const dx = x - b.x, dz = z - b.z;
      const d = Math.hypot(dx, dz);
      if (d > reach) continue;
      if (d < CORE) {
        b.dead = true;
        this.absorbed++;
        continue;
      }
      const bend = (40 + 260 * (1 - d / reach)) * dt;
      b.vx += (dx / d) * bend;
      b.vz += (dz / d) * bend;
    }

    for (let i = 0; i < 3; i++) {
      const a = Math.random() * TAU, r = rand(4, reach);
      const cos = Math.cos(a), sin = Math.sin(a);
      game.particles.spawn(x + cos * r, 1, z + sin * r, -cos * r * 1.4 - sin * 12, 0, -sin * r * 1.4 + cos * 12, 0xaa66ff, 0.6);
    }
    this.ring.rotation.y += dt * 6;
    this.ring.scale.setScalar(1 + 0.15 * Math.sin(this.life * 10));

    if (this.life <= 0) this.collapse(game);
  }

  collapse(game) {
    const { x, z, absorbed } = this;
    const p = game.player;
    this.mesh.visible = false;
    this.best = Math.max(this.best, absorbed);

    const shots = Math.min(60, 10 + absorbed * 2);
    for (let i = 0; i < shots; i++) {
      const a = (i / shots) * TAU;
      game.shots.spawn(x, z, Math.sin(a) * 60, Math.cos(a) * 60, p.damage, 0.9, 1);
    }
    for (const e of game.enemies.list) {
      const dx = x - e.x, dz = z - e.z;
      if (dx * dx + dz * dz < 81) game.hitEnemy(e, 40 + absorbed * 5 + game.wave * 3, e.x, e.z);
    }
    game.particles.burst(x, z, 0xaa66ff, 80, 40, 0.8);
    game.shake = Math.min(1, game.shake + 0.4);
    game.audio.boom(false);
  }
}
