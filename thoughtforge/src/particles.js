import * as THREE from 'three';
import { TAU } from './config.js';

const MAX = 5000;
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
    this.fall = new Float32Array(MAX);
    this.next = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.7,
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

  spawn(x, y, z, vx, vy, vz, hex, life, fall = 0) {
    const i = this.next;
    const j = i * 3;
    this.next = (i + 1) % MAX;
    tint.set(hex);
    this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z;
    this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz;
    this.base[j] = tint.r * 1.6; this.base[j + 1] = tint.g * 1.6; this.base[j + 2] = tint.b * 1.6;
    this.life[i] = this.span[i] = life;
    this.fall[i] = fall;
  }

  burst(x, y, z, hex, count, speed, life = 0.6, fall = 0) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const up = Math.random() * 2 - 0.6;
      const s = speed * (0.25 + Math.random() * 0.75);
      this.spawn(x, y, z, Math.cos(a) * s, up * s * 0.6, Math.sin(a) * s, hex, life * (0.5 + Math.random() * 0.5), fall);
    }
  }

  ring(x, y, z, hex, count, speed, life = 0.6) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      this.spawn(x, y, z, Math.cos(a) * speed, Math.random() * 2, Math.sin(a) * speed, hex, life);
    }
  }

  clear() {
    this.life.fill(0);
    this.pos.fill(-9999);
    this.col.fill(0);
  }

  update(dt) {
    const { pos, col, vel, base, life, span, fall } = this;
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
      vel[j + 1] -= fall[i] * dt;
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
