import * as THREE from 'three';
import { ARENA, TAU, rand } from './config.js';

const TYPES = {
  drone: { hp: 20, speed: 15, radius: 1.4, dmg: 10, xp: 1, score: 10, color: 0xff3355 },
  shooter: { hp: 34, speed: 10, radius: 1.7, dmg: 9, xp: 2, score: 25, color: 0xffa322, range: 34, fireRate: 1.7 },
  dasher: { hp: 28, speed: 9, radius: 1.5, dmg: 16, xp: 2, score: 30, color: 0x33ffcc },
  bomber: { hp: 85, speed: 6.5, radius: 2.6, dmg: 20, xp: 4, score: 50, color: 0xaa44ff },
  splitter: { hp: 60, speed: 9, radius: 2.2, dmg: 12, xp: 3, score: 40, color: 0x77ff44 },
  mite: { hp: 10, speed: 19, radius: 0.9, dmg: 6, xp: 1, score: 5, color: 0x77ff44 },
  boss: { hp: 1400, speed: 6, radius: 6.5, dmg: 25, xp: 40, score: 1000, color: 0xff2277 },
};

const GEO = {
  drone: new THREE.OctahedronGeometry(1.4).scale(1, 0.55, 1.5),
  shooter: new THREE.ConeGeometry(1.3, 3.2, 5).rotateX(Math.PI / 2),
  halo: new THREE.TorusGeometry(2, 0.14, 6, 24).rotateX(Math.PI / 2),
  dasher: new THREE.ConeGeometry(1.1, 4.2, 3).rotateX(Math.PI / 2),
  bomber: new THREE.DodecahedronGeometry(2.6),
  splitter: new THREE.IcosahedronGeometry(2.2),
  mite: new THREE.TetrahedronGeometry(1.1),
  boss: new THREE.IcosahedronGeometry(5.5, 1),
  bossRing: new THREE.TorusGeometry(8, 0.35, 8, 48),
};

const FACES_PLAYER = { drone: true, shooter: true, dasher: true };

function build(type, mat) {
  const mesh = new THREE.Mesh(GEO[type], mat);
  if (type === 'shooter') mesh.add(new THREE.Mesh(GEO.halo, mat));
  if (type === 'boss') {
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff66aa).multiplyScalar(2) });
    for (const tilt of [0.5, -0.9]) {
      const ring = new THREE.Mesh(GEO.bossRing, glow);
      ring.rotation.x = Math.PI / 2 + tilt;
      mesh.add(ring);
    }
  }
  return mesh;
}

export class Enemies {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  spawn(type, x, z, game, elite = false) {
    const t = TYPES[type];
    const { mode, wave } = game;
    const growth = 1 + (wave - 1) * (type === 'boss' ? 0.08 : 0.1);
    const size = elite ? 1.35 : 1;
    const bonus = elite ? 3 : 1;
    const hp = t.hp * growth * mode.hp * bonus;
    const glow = elite ? 1.8 : 0.6;

    const mat = new THREE.MeshStandardMaterial({
      color: t.color,
      emissive: t.color,
      emissiveIntensity: glow,
      roughness: 0.4,
      metalness: 0.3,
      flatShading: true,
    });
    const mesh = build(type, mat);
    mesh.position.set(x, 1, z);
    mesh.scale.setScalar(size);
    this.scene.add(mesh);

    this.list.push({
      ...t, type, elite, mesh, mat, glow, x, z, hp, maxHp: hp,
      radius: t.radius * size,
      dmg: t.dmg * mode.dmg,
      xp: t.xp * bonus,
      score: t.score * bonus,
      speed: t.speed * mode.speed * Math.min(1.5, 1 + wave * 0.02),
      vx: 0, vz: 0, flash: 0, orbCd: 0,
      timer: rand(0.5, 2), side: Math.random() < 0.5 ? 1 : -1,
      phase: 0, phaseTime: 3, spiral: 0, dead: false,
    });
  }

  clear() {
    for (const e of this.list) this.remove(e);
    this.list.length = 0;
  }

  remove(e) {
    this.scene.remove(e.mesh);
    e.mat.dispose();
  }

  bossAttack(e, game, nx, nz) {
    const { bolts } = game;
    const rage = e.hp < e.maxHp / 2;
    const hit = game.mode.dmg;
    if (e.phaseTime <= 0) {
      e.phase = (e.phase + 1) % 3;
      e.phaseTime = e.phase === 2 ? 2 : 4.5;
      e.timer = rage ? 0.4 : 0.7;
    }
    if (e.timer > 0) return;

    if (e.phase === 0) {
      const arms = rage ? 4 : 3;
      e.timer = 0.08;
      e.spiral += 0.31;
      for (let arm = 0; arm < arms; arm++) {
        const a = e.spiral + (arm / arms) * TAU;
        bolts.spawn(e.x, e.z, Math.sin(a) * 21, Math.cos(a) * 21, 12 * hit, 7);
      }
    } else if (e.phase === 1) {
      const half = rage ? 4 : 3;
      e.timer = rage ? 0.65 : 0.9;
      const base = Math.atan2(nx, nz);
      for (let i = -half; i <= half; i++) {
        const a = base + i * 0.17;
        bolts.spawn(e.x, e.z, Math.sin(a) * 30, Math.cos(a) * 30, 14 * hit, 6);
      }
    } else {
      e.timer = 5;
      for (let i = 0; i < (rage ? 6 : 4); i++) game.spawnAt('drone', e.x + rand(-9, 9), e.z + rand(-9, 9));
    }
  }

  update(dt, game) {
    const p = game.player;
    const list = this.list;

    for (const e of list) {
      const dx = p.x - e.x, dz = p.z - e.z;
      const d = Math.hypot(dx, dz) || 1;
      const nx = dx / d, nz = dz / d;
      let mx = nx, mz = nz;
      e.timer -= dt;
      e.orbCd -= dt;

      if (e.type === 'shooter') {
        if (d < e.range) {
          mx = -nz * e.side;
          mz = nx * e.side;
          if (d < e.range * 0.6) {
            mx -= nx;
            mz -= nz;
          }
        }
        if (e.timer <= 0 && d < e.range * 1.4) {
          e.timer = e.fireRate;
          game.bolts.spawn(e.x + nx * 2, e.z + nz * 2, nx * 28, nz * 28, e.dmg, 4);
        }
      } else if (e.type === 'dasher') {
        if (e.phase === 0 && d < 30 && e.timer <= 0) {
          e.phase = 1;
          e.timer = e.flash = 0.55;
        } else if (e.phase === 1) {
          mx = mz = 0;
          if (e.timer <= 0) {
            e.phase = 2;
            e.timer = 0.45;
            e.vx = nx * 62;
            e.vz = nz * 62;
          }
        } else if (e.phase === 2) {
          mx = e.vx / e.speed;
          mz = e.vz / e.speed;
          if (e.timer <= 0) {
            e.phase = 0;
            e.timer = 1.4;
          }
        }
      } else if (e.type === 'boss') {
        if (d < 24) mx = mz = 0;
        e.phaseTime -= dt;
        this.bossAttack(e, game, nx, nz);
      }

      const turn = Math.min(1, dt * 3);
      e.vx += (mx * e.speed - e.vx) * turn;
      e.vz += (mz * e.speed - e.vz) * turn;
      e.x += e.vx * dt;
      e.z += e.vz * dt;
    }

    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        const gap = a.radius + b.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= gap * gap || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = ((gap - d) / d) * 0.5;
        const wa = a.type === 'boss' ? 0 : 1, wb = b.type === 'boss' ? 0 : 1;
        a.x -= dx * push * wa; a.z -= dz * push * wa;
        b.x += dx * push * wb; b.z += dz * push * wb;
      }
    }

    let n = 0;
    for (const e of list) {
      if (e.dead) {
        this.remove(e);
        continue;
      }
      const d = Math.hypot(e.x, e.z);
      if (d > ARENA - 1) {
        e.x *= (ARENA - 1) / d;
        e.z *= (ARENA - 1) / d;
      }
      e.flash -= dt;
      e.mat.emissiveIntensity = e.flash > 0 ? 4 : e.glow;
      e.mesh.position.set(e.x, e.type === 'boss' ? 2 : 1, e.z);
      if (FACES_PLAYER[e.type]) {
        if (e.phase !== 2) e.mesh.rotation.y = Math.atan2(p.x - e.x, p.z - e.z);
      } else {
        e.mesh.rotation.y += dt * (e.type === 'boss' ? 0.4 : 1.2);
        e.mesh.rotation.x += dt * 0.5;
      }
      list[n++] = e;
    }
    list.length = n;
  }
}
