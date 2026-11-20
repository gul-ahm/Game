import * as THREE from 'three';
import { rand } from './config.js';

const dummy = new THREE.Object3D();
const MAX = { gem: 500, heart: 20, power: 12 };

const glow = (hex, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });

export class Pickups {
  constructor(scene) {
    this.meshes = {
      gem: new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.45), glow(0x44ff99, 1.8), MAX.gem),
      heart: new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.8, 1), glow(0xff4488, 2), MAX.heart),
      power: new THREE.InstancedMesh(new THREE.TorusGeometry(0.8, 0.28, 8, 16), glow(0xffd24a, 2.4), MAX.power),
    };
    for (const m of Object.values(this.meshes)) {
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
    }
    this.items = [];
  }

  drop(kind, x, z, n = 1) {
    for (let i = 0; i < n && this.items.length < MAX.gem; i++) {
      this.items.push({ kind, x, z, vx: rand(-9, 9), vz: rand(-9, 9), age: Math.random() });
    }
  }

  clear() {
    this.items.length = 0;
    for (const m of Object.values(this.meshes)) m.count = 0;
  }

  update(dt, game) {
    const p = game.player;
    const slow = Math.exp(-dt * 4);
    const count = { gem: 0, heart: 0, power: 0 };
    let n = 0;

    for (const it of this.items) {
      it.age += dt;
      if (it.age > 45) continue;

      const dx = p.x - it.x, dz = p.z - it.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d < 1.8) {
        game.collect(it.kind);
        continue;
      }
      const reach = game.vacuum > 0 && it.kind === 'gem' ? 999 : p.magnet;
      if (d < reach) {
        const pull = reach > 100 ? 70 : 14 + 45 * (1 - d / reach);
        it.x += (dx / d) * pull * dt;
        it.z += (dz / d) * pull * dt;
      } else {
        it.x += it.vx * dt;
        it.z += it.vz * dt;
        it.vx *= slow;
        it.vz *= slow;
      }

      this.items[n++] = it;
      if (count[it.kind] >= MAX[it.kind]) continue;
      dummy.position.set(it.x, 1 + Math.sin(it.age * 4) * 0.25, it.z);
      dummy.rotation.set(it.kind === 'power' ? it.age * 2 : 0, it.age * 3, 0);
      dummy.updateMatrix();
      this.meshes[it.kind].setMatrixAt(count[it.kind]++, dummy.matrix);
    }

    this.items.length = n;
    for (const kind in count) {
      this.meshes[kind].count = count[kind];
      this.meshes[kind].instanceMatrix.needsUpdate = true;
    }
  }
}
