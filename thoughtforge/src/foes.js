import * as THREE from 'three';
import { TAU, rand } from './config.js';
import { heightAt } from './terrain.js';
import { GLOW } from './meta.js';
import { wallLocal } from './constructs.js';

const KINDS = {
  dummy: { hp: Infinity, radius: 0.7, height: 2.5, mass: 99 },
  crate: { hp: 50, radius: 0.85, height: 1.6, mass: 1 },
  hollow: { hp: 45, radius: 0.7, height: 2, mass: 1, speed: 7, dmg: 10, score: 10 },
  spitter: { hp: 32, radius: 0.65, height: 1.9, mass: 0.8, speed: 5, dmg: 8, score: 20, range: 22 },
  brute: { hp: 180, radius: 1.3, height: 3.4, mass: 4, speed: 4.5, dmg: 24, score: 60 },
};

const G = {
  post: new THREE.CylinderGeometry(0.1, 0.12, 1.6, 6).translate(0, 0.8, 0),
  base: new THREE.CylinderGeometry(0.55, 0.7, 0.18, 10).translate(0, 0.09, 0),
  sack: new THREE.CylinderGeometry(0.45, 0.38, 1.0, 10).translate(0, 1.55, 0),
  head: new THREE.SphereGeometry(0.3, 10, 8).translate(0, 2.3, 0),
  bar: new THREE.BoxGeometry(1.6, 0.14, 0.14).translate(0, 1.8, 0),
  mark: new THREE.TorusGeometry(0.22, 0.05, 6, 16).translate(0, 1.55, 0.42),
  crate: new THREE.BoxGeometry(1.6, 1.6, 1.6).translate(0, 0.8, 0),
  wisp: new THREE.ConeGeometry(0.55, 1.5, 7).rotateX(Math.PI).translate(0, 1, 0),
  skull: new THREE.IcosahedronGeometry(0.42, 0).translate(0, 1.85, 0),
  eye: new THREE.SphereGeometry(0.07, 6, 5),
  shard: new THREE.TetrahedronGeometry(0.16),
  orb: new THREE.SphereGeometry(0.55, 12, 9).translate(0, 1.3, 0),
  halo: new THREE.TorusGeometry(0.8, 0.06, 6, 24).rotateX(Math.PI / 2).translate(0, 1.3, 0),
  mouth: new THREE.SphereGeometry(0.2, 8, 6).translate(0, 1.3, 0.5),
  tendril: new THREE.ConeGeometry(0.12, 0.9, 5).rotateX(Math.PI),
  hulk: new THREE.DodecahedronGeometry(1.2, 0).scale(1, 1.1, 0.9).translate(0, 2, 0),
  fist: new THREE.BoxGeometry(0.55, 1.6, 0.55),
  horn: new THREE.ConeGeometry(0.14, 0.7, 5),
};
const CRATE_EDGES = new THREE.EdgesGeometry(G.crate);

const wood = new THREE.MeshStandardMaterial({ color: 0x8c6239, roughness: 0.9, flatShading: true });
const straw = new THREE.MeshStandardMaterial({ color: 0xd8b46a, roughness: 1, flatShading: true });
const paint = new THREE.MeshStandardMaterial({ color: 0xc8402f, roughness: 0.7 });
const seam = new THREE.LineBasicMaterial({ color: 0x3b2614 });
const eyeGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3cc8).multiplyScalar(2.5) });

function put(group, geo, mat, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

const shadowSkin = hex =>
  new THREE.MeshStandardMaterial({ color: hex, emissive: 0x6a2bbf, emissiveIntensity: 0.25, roughness: 0.5, flatShading: true });

const MODELS = {
  dummy(g) {
    put(g, G.base, wood);
    const tilt = new THREE.Group();
    g.add(tilt);
    for (const [geo, mat] of [[G.post, wood], [G.sack, straw], [G.head, straw], [G.bar, wood], [G.mark, paint]]) put(tilt, geo, mat);
    return { tilt };
  },
  crate(g) {
    const skin = wood.clone();
    put(g, G.crate, skin);
    g.add(new THREE.LineSegments(CRATE_EDGES, seam));
    return { skin };
  },
  hollow(g) {
    const skin = shadowSkin(0x2a1840);
    put(g, G.wisp, skin);
    put(g, G.skull, skin);
    put(g, G.eye, eyeGlow, 0.15, 1.88, 0.36);
    put(g, G.eye, eyeGlow, -0.15, 1.88, 0.36);
    const spin = new THREE.Group();
    for (let i = 0; i < 3; i++) put(spin, G.shard, skin, Math.cos((i / 3) * TAU) * 0.8, 1.2, Math.sin((i / 3) * TAU) * 0.8);
    g.add(spin);
    return { skin, spin };
  },
  spitter(g) {
    const skin = shadowSkin(0x1f2a45);
    put(g, G.orb, skin);
    put(g, G.mouth, eyeGlow);
    const spin = new THREE.Group();
    put(spin, G.halo, skin);
    for (let i = 0; i < 3; i++) put(spin, G.tendril, skin, Math.cos((i / 3) * TAU) * 0.3, 0.5, Math.sin((i / 3) * TAU) * 0.3);
    g.add(spin);
    return { skin, spin };
  },
  brute(g) {
    const skin = shadowSkin(0x3a1d2a);
    put(g, G.hulk, skin);
    put(g, G.fist, skin, 1.35, 1.6, 0.2);
    put(g, G.fist, skin, -1.35, 1.6, 0.2);
    put(g, G.horn, skin, 0.5, 3.1, 0.2).rotation.z = -0.5;
    put(g, G.horn, skin, -0.5, 3.1, 0.2).rotation.z = 0.5;
    put(g, G.eye, eyeGlow, 0.3, 2.4, 0.95).scale.setScalar(1.6);
    put(g, G.eye, eyeGlow, -0.3, 2.4, 0.95).scale.setScalar(1.6);
    return { skin };
  },
};

class Orbs {
  constructor(scene) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.32, 10, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3cc8).multiplyScalar(2.2) }),
      200
    );
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.items = [];
    this.slot = new THREE.Object3D();
    scene.add(this.mesh);
  }

  spawn(from, to, speed, dmg) {
    if (this.items.length < 200) this.items.push({ pos: from.clone(), vel: to.clone().sub(from).setLength(speed), dmg, life: 5 });
  }

  clear() {
    this.items.length = 0;
    this.mesh.count = 0;
  }

  blocked(o, game) {
    for (const w of game.forge.walls) {
      if (o.pos.y > w.top || o.pos.y < w.base) continue;
      const { lx, lz } = wallLocal(w, o.pos.x, o.pos.z);
      if (Math.abs(lx) > w.width / 2 + 0.3 || Math.abs(lz) > w.depth / 2 + 0.3) continue;
      w.flash = 0.12;
      return true;
    }
    if (game.forge.shield && o.pos.distanceTo(game.hero.chest) < 2.5) {
      game.forge.absorb(o.dmg);
      return true;
    }
    return false;
  }

  update(dt, game) {
    let n = 0;
    for (const o of this.items) {
      o.life -= dt;
      o.pos.addScaledVector(o.vel, dt);
      if (o.life <= 0 || o.pos.y < heightAt(o.pos.x, o.pos.z)) continue;
      if (this.blocked(o, game)) {
        game.blocked();
        game.particles.burst(o.pos.x, o.pos.y, o.pos.z, GLOW, 10, 7, 0.35);
        continue;
      }
      if (o.pos.distanceTo(game.hero.chest) < 0.9) {
        game.hurtHero(o.dmg, o.pos);
        continue;
      }
      this.slot.position.copy(o.pos);
      this.slot.updateMatrix();
      this.mesh.setMatrixAt(n, this.slot.matrix);
      this.items[n++] = o;
    }
    this.items.length = n;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// What the shadows leave behind: cyan motes refill will, red ones heal.
class Motes {
  constructor(scene) {
    const make = hex => {
      const m = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.25), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(2.2) }), 120);
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
      return m;
    };
    this.meshes = { will: make(GLOW), life: make(0xff5577) };
    this.items = [];
    this.slot = new THREE.Object3D();
  }

  drop(kind, x, y, z) {
    if (this.items.length < 240) this.items.push({ kind, x, y: y + 1, z, vx: rand(-4, 4), vz: rand(-4, 4), age: 0 });
  }

  clear() {
    this.items.length = 0;
    for (const m of Object.values(this.meshes)) m.count = 0;
  }

  update(dt, game) {
    const h = game.hero;
    const count = { will: 0, life: 0 };
    let n = 0;
    for (const m of this.items) {
      m.age += dt;
      if (m.age > 30) continue;
      const dx = h.x - m.x, dy = h.y + 1 - m.y, dz = h.z - m.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      if (d < 1.2) {
        if (m.kind === 'will') h.will = Math.min(h.maxWill, h.will + 12);
        else h.hp = Math.min(h.maxHp, h.hp + 15);
        game.audio.chime();
        continue;
      }
      if (d < 7) {
        const pull = 20 * dt;
        m.x += (dx / d) * pull;
        m.y += (dy / d) * pull;
        m.z += (dz / d) * pull;
      } else {
        m.x += m.vx * dt;
        m.z += m.vz * dt;
        m.vx *= 0.97;
        m.vz *= 0.97;
        m.y += (heightAt(m.x, m.z) + 1 - m.y) * dt * 3;
      }
      this.items[n++] = m;
      if (count[m.kind] >= 120) continue;
      this.slot.position.set(m.x, m.y + Math.sin(m.age * 4) * 0.2, m.z);
      this.slot.rotation.y = m.age * 3;
      this.slot.updateMatrix();
      this.meshes[m.kind].setMatrixAt(count[m.kind]++, this.slot.matrix);
    }
    this.items.length = n;
    for (const kind in count) {
      this.meshes[kind].count = count[kind];
      this.meshes[kind].instanceMatrix.needsUpdate = true;
    }
  }
}

export class Foes {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.later = [];
    this.orbs = new Orbs(scene);
    this.motes = new Motes(scene);
  }

  spawn(kind, x, z, tough = 1) {
    const k = KINDS[kind];
    const mesh = new THREE.Group();
    const parts = MODELS[kind](mesh);
    this.scene.add(mesh);
    const f = {
      ...k, ...parts, kind, mesh, x, z, y: heightAt(x, z) + (k.speed ? 1 : 0),
      vx: 0, vy: 0, vz: 0, hp: k.hp * tough, maxHp: k.hp * tough, dmg: (k.dmg ?? 0) * Math.sqrt(tough),
      cool: rand(0.8, 2), bite: 0, held: 0, stun: 0, bashed: 0, burn: 0, flash: 0, charge: 0, cx: 0, cz: 0,
      wobble: 0, wobbleV: 0, tiltYaw: 0, yaw: rand(0, TAU), side: Math.random() < 0.5 ? 1 : -1,
      home: { x, z }, dead: false, age: rand(0, 9),
    };
    this.list.push(f);
    return f;
  }

  respawnLater(f) {
    this.later.push({ kind: f.kind, x: f.home.x, z: f.home.z, wait: 6 });
  }

  clear() {
    for (const f of this.list) this.scene.remove(f.mesh);
    this.list.length = 0;
    this.later.length = 0;
    this.orbs.clear();
    this.motes.clear();
  }

  get creatures() {
    return this.list.filter(f => f.speed && !f.dead).length;
  }

  nearest(point, range, skip) {
    let best = null, bestD = range;
    for (const f of this.list) {
      if (f.dead || f.kind === 'crate' || skip?.has(f)) continue;
      const d = Math.hypot(f.x - point.x, f.z - point.z);
      if (d < bestD) {
        best = f;
        bestD = d;
      }
    }
    return best;
  }

  think(f, dt, game) {
    const h = game.hero;
    const dx = h.x - f.x, dz = h.z - f.z;
    const d = Math.hypot(dx, dz) || 1;
    const nx = dx / d, nz = dz / d;
    let mx = nx, mz = nz, top = f.speed;
    f.yaw = Math.atan2(nx, nz);

    if (f.kind === 'spitter') {
      if (d < f.range * 0.55) {
        mx = -nx;
        mz = -nz;
      } else if (d < f.range) {
        mx = -nz * f.side;
        mz = nx * f.side;
      }
      if (f.cool <= 0 && d < f.range * 1.3) {
        f.cool = 2.2;
        this.orbs.spawn(new THREE.Vector3(f.x + nx * 0.6, f.y + 1.3, f.z + nz * 0.6), h.chest, 18, f.dmg);
      }
    } else if (f.kind === 'brute') {
      if (f.charge > 0) {
        f.charge -= dt;
        mx = f.cx;
        mz = f.cz;
        top = 24;
      } else if (d < 14 && f.cool <= 0) {
        f.charge = 0.7;
        f.cool = 3.5;
        f.cx = nx;
        f.cz = nz;
      }
    }

    if (f.kind !== 'spitter' && f.bite <= 0 && d < f.radius + 1.1 && Math.abs(h.y - f.y) < 2.5) {
      f.bite = f.kind === 'brute' ? 1.6 : 1.1;
      f.charge = 0;
      game.hurtHero(f.dmg, f);
    }

    const grip = Math.min(1, dt * 5);
    f.vx += (mx * top - f.vx) * grip;
    f.vz += (mz * top - f.vz) * grip;
  }

  update(dt, game) {
    const list = this.list;
    for (const f of list) {
      f.age += dt;
      f.cool -= dt;
      f.bite -= dt;
      f.held -= dt;
      f.stun -= dt;
      f.bashed -= dt;
      f.flash -= dt;

      if (f.kind === 'dummy') {
        f.wobbleV += (-f.wobble * 40 - f.wobbleV * 4) * dt;
        f.wobble += f.wobbleV * dt;
        continue;
      }

      const free = f.held <= 0 && f.stun <= 0;
      if (free && f.speed) this.think(f, dt, game);
      if (f.held > 0) {
        f.vx *= 0.8;
        f.vz *= 0.8;
      }

      f.vy -= 30 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.z += f.vz * dt;
      game.solid(f, f.radius);
      const floor = game.floorAt(f.x, f.z, f.y);
      if (f.y <= floor) {
        f.y = floor;
        f.vy = Math.max(0, f.vy);
        if (!free || !f.speed) {
          const k = Math.exp(-dt * 5);
          f.vx *= k;
          f.vz *= k;
        }
      }
      if (f.y < -28) game.ringOut(f);
    }

    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        const gap = a.radius + b.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= gap * gap || d2 === 0 || Math.abs(a.y - b.y) > 2) continue;
        const d = Math.sqrt(d2);
        const push = (gap - d) / d;
        const wa = a.kind === 'dummy' ? 0 : b.kind === 'dummy' ? 1 : b.mass / (a.mass + b.mass);
        const wb = b.kind === 'dummy' ? 0 : 1 - wa;
        a.x -= dx * push * wa;
        a.z -= dz * push * wa;
        b.x += dx * push * wb;
        b.z += dz * push * wb;
      }
    }

    let n = 0;
    for (const f of list) {
      if (f.dead) {
        this.scene.remove(f.mesh);
        f.skin?.dispose();
        continue;
      }
      this.draw(f);
      list[n++] = f;
    }
    list.length = n;

    for (const r of this.later) {
      r.wait -= dt;
      if (r.wait <= 0) this.spawn(r.kind, r.x, r.z);
    }
    this.later = this.later.filter(r => r.wait > 0);
    this.orbs.update(dt, game);
    this.motes.update(dt, game);
  }

  draw(f) {
    const hover = f.speed ? 0.25 + Math.sin(f.age * 3) * 0.15 : 0;
    f.mesh.position.set(f.x, f.y + hover, f.z);
    if (f.tilt) {
      f.mesh.rotation.y = f.tiltYaw;
      f.tilt.rotation.x = f.wobble;
      return;
    }
    f.mesh.rotation.y = f.yaw;
    if (f.spin) f.spin.rotation.y = f.age * (f.held > 0 ? 9 : 2);
    if (f.skin && f.speed) {
      const caught = f.held > 0 || f.stun > 0;
      f.skin.emissive.setHex(caught ? GLOW : 0x6a2bbf);
      f.skin.emissiveIntensity = f.flash > 0 ? 2.5 : caught ? 0.9 : 0.25;
    } else if (f.skin) {
      f.skin.emissive.setHex(f.flash > 0 ? 0x553311 : 0x000000);
    }
  }
}
