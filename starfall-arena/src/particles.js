import * as THREE from 'three';
import { TAU } from './config.js';

const MAX = 4000;
const tint = new THREE.Color();

function softDot() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Particles {
  constructor(scene) {
    this.pos = new Float32Array(MAX * 3).fill(-9999);
    this.col = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.base = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.span = new Float32Array(MAX);
    this.next = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 1.3,
        map: softDot(),
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      })
    );
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(x, y, z, vx, vy, vz, hex, life) {
    const i = this.next;
    const j = i * 3;
    this.next = (i + 1) % MAX;
    tint.set(hex);
    this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z;
    this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz;
    this.base[j] = tint.r * 1.6; this.base[j + 1] = tint.g * 1.6; this.base[j + 2] = tint.b * 1.6;
    this.life[i] = this.span[i] = life;
  }

  burst(x, z, hex, count, speed, life = 0.6) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const s = speed * (0.25 + Math.random() * 0.75);
      this.spawn(x, 1, z, Math.cos(a) * s, (Math.random() - 0.3) * s * 0.5, Math.sin(a) * s, hex, life * (0.5 + Math.random() * 0.5));
    }
  }

  clear() {
    this.life.fill(0);
    this.pos.fill(-9999);
    this.col.fill(0);
  }

  update(dt) {
    const { pos, col, vel, base, life, span } = this;
    const drag = Math.exp(-dt * 2.5);
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) continue;
      const j = i * 3;
      life[i] -= dt;
      if (life[i] <= 0) {
        pos[j + 1] = -9999;
        continue;
      }
      const f = life[i] / span[i];
      pos[j] += vel[j] * dt;
      pos[j + 1] += vel[j + 1] * dt;
      pos[j + 2] += vel[j + 2] * dt;
      vel[j] *= drag; vel[j + 1] *= drag; vel[j + 2] *= drag;
      col[j] = base[j] * f; col[j + 1] = base[j + 1] * f; col[j + 2] = base[j + 2] * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
