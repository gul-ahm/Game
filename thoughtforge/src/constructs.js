import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU, clamp, rand } from './config.js';
import { heightAt } from './terrain.js';
import { GLOW } from './meta.js';

const MAX_WALLS = 6;
const SHIELD_RADIUS = 2.4;
const BUILD_TIME = 0.15;

const BOLT_GEO = new THREE.OctahedronGeometry(0.28).scale(1, 1, 2.4);
const LANCE_GEO = new THREE.OctahedronGeometry(0.4).scale(0.6, 0.6, 5.5);
const SHIELD_GEO = new THREE.IcosahedronGeometry(SHIELD_RADIUS, 2);

// Hard light: a translucent glowing fill with bright edges, so every construct reads as built, not solid.
function shell(geo, opacity = 0.5) {
  const fill = new THREE.MeshStandardMaterial({
    color: GLOW,
    emissive: GLOW,
    emissiveIntensity: 1.4,
    transparent: true,
    opacity,
    roughness: 0.25,
    depthWrite: false,
  });
  const edge = new THREE.LineBasicMaterial({ color: new THREE.Color(GLOW).multiplyScalar(2.5), transparent: true });
  const group = new THREE.Group().add(new THREE.Mesh(geo, fill), new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edge));
  group.userData.mats = [[fill, opacity], [edge, 1]];
  return group;
}

function fade(group, k) {
  for (const [mat, base] of group.userData.mats) mat.opacity = base * k;
}

function glowUp(group, amount) {
  group.userData.mats[0][0].emissiveIntensity = 1.4 + amount;
}

function dispose(group) {
  group.traverse(o => {
    if (o.geometry && o.geometry !== BOLT_GEO && o.geometry !== LANCE_GEO && o.geometry !== SHIELD_GEO) o.geometry.dispose();
    o.material?.dispose();
  });
}

export function wallLocal(w, x, z) {
  const dx = x - w.x, dz = z - w.z;
  const c = Math.cos(w.yaw), s = Math.sin(w.yaw);
  return { lx: dx * c - dz * s, lz: dx * s + dz * c };
}

const touches = (f, p, r) =>
  Math.hypot(f.x - p.x, f.z - p.z) < f.radius + r && p.y > f.y - r && p.y < f.y + f.height + r;

function cageGeometry(r) {
  const bars = Math.round(r * 2.4);
  const parts = [
    new THREE.TorusGeometry(r, 0.12, 6, 48).rotateX(Math.PI / 2).translate(0, 0.2, 0),
    new THREE.TorusGeometry(r, 0.12, 6, 48).rotateX(Math.PI / 2).translate(0, 3.6, 0),
  ];
  for (let i = 0; i < bars; i++) {
    const a = (i / bars) * TAU;
    parts.push(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 5).translate(Math.cos(a) * r, 1.9, Math.sin(a) * r));
  }
  return mergeGeometries(parts);
}

function hammerGeometry(size) {
  return mergeGeometries([
    new THREE.CylinderGeometry(0.18 * size, 0.22 * size, 6, 8).translate(0, 3, 0),
    new THREE.BoxGeometry(1.6 * size, 1.5 * size, 2.8 * size).translate(0, 6, 0),
    new THREE.BoxGeometry(1.75 * size, 1.65 * size, 0.35 * size).translate(0, 6, 0),
  ]);
}

function jag(points, spread) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    for (let k = 0; k < 8; k++) {
      const t = k / 8, edge = k === 0 ? 0 : spread;
      out.push(
        a.x + (b.x - a.x) * t + rand(-edge, edge),
        a.y + (b.y - a.y) * t + rand(-edge, edge),
        a.z + (b.z - a.z) * t + rand(-edge, edge)
      );
    }
  }
  const end = points.at(-1);
  out.push(end.x, end.y, end.z);
  return out;
}

const TICK = {
  bolt: (c, dt, game) => flight(c, dt, game, 0x9ffcff),
  lance: (c, dt, game) => flight(c, dt, game, 0x7cf7ff),

  aegis(c, dt, game) {
    const h = game.hero;
    c.mesh.position.set(h.x, h.y + 1.1, h.z);
    c.mesh.rotation.y += dt * 0.8;
    c.flash -= dt;
    glowUp(c.mesh, c.flash > 0 ? 3 : 0);
    for (const f of game.foes.list) {
      if (!f.speed || f.bashed > 0 || Math.hypot(f.x - h.x, f.z - h.z) > SHIELD_RADIUS + f.radius) continue;
      const dx = f.x - h.x, dz = f.z - h.z, d = Math.hypot(dx, dz) || 1;
      f.bashed = 0.6;
      game.damage(f, 8 * c.power, { x: (dx / d) * 14, y: 5, z: (dz / d) * 14 });
    }
  },

  cage(c, dt, game) {
    let caught = 0;
    for (const f of game.foes.list) {
      const dx = c.x - f.x, dz = c.z - f.z;
      if (f.kind === 'crate' || Math.hypot(dx, dz) > c.r) continue;
      f.held = Math.max(f.held, 0.15);
      f.vx += dx * dt * 3;
      f.vz += dz * dt * 3;
      if (f.speed) {
        caught++;
        f.burn = (f.burn || 0) + dt;
        if (f.burn > 0.5) {
          f.burn = 0;
          game.damage(f, 5 * c.power);
        }
      }
    }
    if (caught >= 3) game.goal('cage');
    c.mesh.rotation.y += dt * 0.6;
  },

  hammer(c, dt, game) {
    const t = c.age;
    const pivot = c.mesh.children[0];
    if (t < 0.3) {
      pivot.rotation.x = -0.5 - t;
    } else if (!c.struck) {
      const k = Math.min(1, (t - 0.3) / 0.16);
      pivot.rotation.x = -0.8 + (Math.PI / 2 + 0.8) * k * k;
      if (k >= 1) {
        c.struck = true;
        game.quake(c.at, c.r, c.damage);
      }
    }
  },

  wall(c, dt) {
    const k = Math.min(1, c.age / 0.22);
    c.mesh.position.y = c.base - c.height / 2 + c.height * (1 - (1 - k) ** 3);
    c.flash -= dt;
    glowUp(c.mesh, c.flash > 0 ? 3 : 0);
  },

  storm(c) {
    if (c.age - c.drawn < 0.05) return;
    c.drawn = c.age;
    c.mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(jag(c.points, 0.5), 3));
  },
};

function flight(c, dt, game, trail) {
  c.pos.addScaledVector(c.vel, dt);
  c.mesh.position.copy(c.pos);
  game.particles.spawn(c.pos.x, c.pos.y, c.pos.z, rand(-1, 1), rand(-1, 1), rand(-1, 1), trail, 0.3);

  for (const f of game.foes.list) {
    if (c.hits.has(f) || !touches(f, c.pos, c.radius)) continue;
    c.hits.add(f);
    const push = c.vel.clone().setY(0).setLength(c.push);
    game.damage(f, c.damage, { x: push.x, y: c.push * 0.3, z: push.z });
    if (!c.pierce) {
      c.life = 0;
      break;
    }
  }
  if (c.pos.y < heightAt(c.pos.x, c.pos.z)) {
    game.particles.burst(c.pos.x, c.pos.y + 0.2, c.pos.z, trail, 12, 8, 0.4);
    c.life = 0;
  }
}

export class Forge {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  get shield() {
    return this.list.find(c => c.kind === 'aegis' && c.life > 0);
  }

  get walls() {
    return this.list.filter(c => c.kind === 'wall');
  }

  clear() {
    for (const c of this.list) this.drop(c);
    this.list.length = 0;
  }

  add(c) {
    c.age = 0;
    c.full = c.life;
    this.scene.add(c.mesh);
    this.list.push(c);
    return c;
  }

  drop(c) {
    this.scene.remove(c.mesh);
    dispose(c.mesh);
  }

  absorb(amount) {
    const s = this.shield;
    if (!s) return amount;
    const took = Math.min(s.hp, amount);
    s.hp -= took;
    s.flash = 0.15;
    if (s.hp <= 0) s.life = Math.min(s.life, 0.25);
    return amount - took;
  }

  cast(shape, plan, game) {
    switch (shape) {
      case 'tap': return this.bolt(plan, game);
      case 'line': return this.lance(plan, game);
      case 'circle': return plan.around ? this.aegis(plan) : this.cage(plan);
      case 'triangle': return this.hammer(plan, game);
      case 'square': return this.wall(plan, game);
      case 'zigzag': return this.storm(plan, game);
    }
  }

  bolt(plan, game) {
    const from = game.hero.hand;
    const target = plan.target ?? plan.center.clone().setY(plan.center.y + 0.6);
    const mesh = shell(BOLT_GEO, 0.9);
    mesh.position.copy(from);
    mesh.lookAt(target);
    return this.add({
      kind: 'bolt', mesh, pos: from, vel: target.sub(from).setLength(70),
      life: 1.2, radius: 0.5, damage: 14 * plan.power, push: 6, pierce: false, hits: new Set(),
    });
  }

  lance(plan, game) {
    const h = game.hero;
    const from = h.hand;
    const dir = plan.end.clone().sub(plan.start).setY(0);
    if (dir.length() < 1.5) dir.set(Math.sin(h.facing), 0, Math.cos(h.facing));
    dir.normalize();
    const mesh = shell(LANCE_GEO, 0.7);
    mesh.position.copy(from);
    mesh.lookAt(from.clone().add(dir));
    return this.add({
      kind: 'lance', mesh, pos: from, vel: dir.multiplyScalar(80),
      life: 1.1, radius: 1, damage: 38 * plan.power, push: 18, pierce: true, hits: new Set(),
    });
  }

  aegis(plan) {
    if (this.shield) this.shield.life = 0.2;
    const hp = 50 + 60 * plan.power;
    return this.add({ kind: 'aegis', mesh: shell(SHIELD_GEO, 0.22), life: 6 + 4 * plan.power, hp, maxHp: hp, flash: 0, power: plan.power });
  }

  cage(plan) {
    const r = clamp(plan.size, 3, 9);
    const mesh = shell(cageGeometry(r), 0.6);
    const { x, z } = plan.center;
    mesh.position.set(x, heightAt(x, z), z);
    return this.add({ kind: 'cage', mesh, x, z, r, life: 4 + 2 * plan.power, power: plan.power });
  }

  hammer(plan, game) {
    const h = game.hero;
    const at = plan.center.clone();
    const r = clamp(plan.size * 0.9, 4, 9);
    const size = r / 5;
    const dir = new THREE.Vector3(at.x - h.x, 0, at.z - h.z);
    const yaw = dir.lengthSq() > 1 ? Math.atan2(dir.x, dir.z) : h.facing;

    const outer = new THREE.Group();
    const pivot = shell(hammerGeometry(size), 0.65);
    outer.add(pivot);
    outer.userData.mats = pivot.userData.mats;
    // The handle is six units long, so a pivot six units back lands the head on the target.
    outer.position.set(at.x - Math.sin(yaw) * 6, heightAt(at.x, at.z) + 1.4 * size, at.z - Math.cos(yaw) * 6);
    outer.rotation.y = yaw;
    return this.add({ kind: 'hammer', mesh: outer, at, r, life: 1.1, damage: 55 * plan.power, struck: false });
  }

  wall(plan, game) {
    const h = game.hero;
    const { x, z } = plan.center;
    const width = clamp(plan.size * 1.8, 4, 14);
    const height = clamp(plan.size * 0.75, 2.5, 5);
    const depth = 1.3;
    const yaw = Math.atan2(x - h.x, z - h.z);
    const base = heightAt(x, z) - 0.3;

    const live = this.walls.filter(w => w.life > 0.3);
    if (live.length >= MAX_WALLS) live[0].life = 0.3;

    const mesh = shell(new THREE.BoxGeometry(width, height, depth), 0.55);
    mesh.position.set(x, base - height / 2, z);
    mesh.rotation.y = yaw;
    return this.add({ kind: 'wall', mesh, x, z, yaw, width, height, depth, base, top: base + height, life: 14 + 6 * plan.power, flash: 0 });
  }

  storm(plan, game) {
    const jumps = 3 + Math.round(plan.power * 2);
    const hit = new Set();
    const points = [game.hero.hand];
    let next = game.foes.nearest(plan.center, 14, hit);
    while (next && hit.size < jumps) {
      hit.add(next);
      const at = new THREE.Vector3(next.x, next.y + next.height * 0.6, next.z);
      points.push(at);
      next.stun = Math.max(next.stun, 1.2);
      game.damage(next, 26 * plan.power, { x: 0, y: 4, z: 0 });
      game.particles.burst(at.x, at.y, at.z, 0xd8f6ff, 16, 10, 0.4);
      next = game.foes.nearest(at, 12, hit);
    }
    if (!hit.size) {
      points.push(plan.center.clone());
      game.quake(plan.center, 3, 15 * plan.power, true);
    }
    if (hit.size >= 3) game.goal('chain');
    game.audio.zap();

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(jag(points, 0.5), 3));
    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(0xd8f6ff).multiplyScalar(3), transparent: true });
    const mesh = new THREE.Line(geo, mat);
    mesh.frustumCulled = false;
    mesh.userData.mats = [[mat, 1]];
    return this.add({ kind: 'storm', mesh, points, life: 0.35, drawn: 0, hits: hit.size });
  }

  update(dt, game) {
    let n = 0;
    for (const c of this.list) {
      c.age += dt;
      c.life -= dt;
      if (c.life > 0) TICK[c.kind](c, dt, game);
      if (c.life <= 0) {
        this.drop(c);
        continue;
      }
      if (c.kind !== 'storm' && c.kind !== 'wall') {
        const k = Math.min(1, c.age / BUILD_TIME);
        c.mesh.scale.setScalar(1 + 0.25 * Math.sin(k * Math.PI) - (1 - k) * 0.8);
      }
      fade(c.mesh, Math.min(1, c.life / 0.3));
      this.list[n++] = c;
    }
    this.list.length = n;
  }
}
