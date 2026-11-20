import * as THREE from 'three';
import { ISLAND, TAU, rand, clamp } from './config.js';

const EDGE = ISLAND * 1.04;
const RING = 11;

const smooth = (a, b, t) => {
  const k = clamp((t - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};

// Rolling hills around a flat training ring, ending in a cliff at the rim.
export function heightAt(x, z) {
  const r = Math.hypot(x, z) / ISLAND;
  const hills = Math.sin(x * 0.09) * Math.cos(z * 0.08) * 2.5 + Math.sin(x * 0.023 + z * 0.031) * 4.5 + 4.5;
  return hills * smooth(0.2, 0.55, r) - smooth(0.9, 1.04, r) * 30;
}

const slopeAt = (x, z) =>
  Math.hypot(heightAt(x + 0.6, z) - heightAt(x - 0.6, z), heightAt(x, z + 0.6) - heightAt(x, z - 0.6)) / 1.2;

const skyVert = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const skyFrag = `
uniform vec3 top;
uniform vec3 horizon;
uniform vec3 bottom;
uniform vec3 sunDir;
varying vec3 vDir;
void main() {
  float h = vDir.y;
  vec3 col = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, bottom, pow(-h, 0.4));
  float sun = max(dot(vDir, sunDir), 0.0);
  col += vec3(1.0, 0.75, 0.45) * pow(sun, 300.0) * 4.0 + vec3(1.0, 0.55, 0.3) * pow(sun, 8.0) * 0.35;
  gl_FragColor = vec4(col, 1.0);
}`;

const GRASS = new THREE.Color(0x4f9a43);
const MEADOW = new THREE.Color(0x9ccc5c);

function tint(c, x, y, z) {
  const r = Math.hypot(x, z) / ISLAND;
  if (y < -1.5) c.set(0x5d5049);
  else if (slopeAt(x, z) > 0.8) c.set(0x857a70);
  else if (r > 0.86 && y < 2) c.set(0xd9c38c);
  else c.copy(GRASS).lerp(MEADOW, clamp(y / 9, 0, 1));
  c.multiplyScalar(0.92 + Math.random() * 0.16);
}

// A radial grid keeps the rim perfectly round, which a square plane cannot do.
function islandGeometry() {
  const rings = 96, segs = 168;
  const pos = [0, heightAt(0, 0), 0];
  const col = [];
  const index = [];
  const c = new THREE.Color();
  tint(c, 0, 0, 0);
  col.push(c.r, c.g, c.b);

  for (let i = 1; i <= rings; i++) {
    const r = EDGE * (i / rings) ** 0.8;
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * TAU;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = heightAt(x, z);
      pos.push(x, y, z);
      tint(c, x, y, z);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < segs; j++) index.push(0, 1 + ((j + 1) % segs), 1 + j);
  for (let i = 2; i <= rings; i++) {
    const inner = 1 + (i - 2) * segs, outer = 1 + (i - 1) * segs;
    for (let j = 0; j < segs; j++) {
      const k = (j + 1) % segs;
      index.push(inner + j, outer + k, outer + j, inner + j, inner + k, outer + k);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

function jagged(geo, amount, keepTop) {
  const p = geo.attributes.position;
  const top = Math.max(...Array.from({ length: p.count }, (_, i) => p.getY(i)));
  for (let i = 0; i < p.count; i++) {
    if (keepTop && p.getY(i) > top - 0.01) continue;
    const k = 1 + rand(-amount, amount);
    p.setXYZ(i, p.getX(i) * k, p.getY(i) + rand(-amount, amount) * 4, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return geo;
}

const rock = new THREE.MeshStandardMaterial({ color: 0x6e625a, roughness: 1, flatShading: true });

export class World {
  constructor(scene) {
    this.t = 0;
    this.colliders = [];
    scene.fog = new THREE.Fog(0xf2b98f, 140, 650);

    const sunDir = new THREE.Vector3(0.55, 0.32, -0.6).normalize();
    scene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(900, 32, 16),
        new THREE.ShaderMaterial({
          uniforms: {
            top: { value: new THREE.Color(0x23468c) },
            horizon: { value: new THREE.Color(0xf2b98f) },
            bottom: { value: new THREE.Color(0x5b6fa8) },
            sunDir: { value: sunDir },
          },
          vertexShader: skyVert,
          fragmentShader: skyFrag,
          side: THREE.BackSide,
          depthWrite: false,
          fog: false,
        })
      )
    );

    scene.add(new THREE.HemisphereLight(0xa9c1ff, 0x6b4f3a, 1.3));
    this.sunDir = sunDir;
    this.sun = new THREE.DirectionalLight(0xffdcb5, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 220 });
    this.sun.shadow.bias = -0.0005;
    scene.add(this.sun, this.sun.target);

    const ground = new THREE.Mesh(
      islandGeometry(),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true })
    );
    ground.receiveShadow = true;
    scene.add(ground);

    const under = new THREE.Mesh(jagged(new THREE.ConeGeometry(EDGE, 75, 42, 7, true).rotateX(Math.PI), 0.08, true), rock);
    under.position.y = -30 - 37.5;
    scene.add(under);

    this.buildRing(scene);
    this.plant(scene);
    this.scatterRocks(scene);
    this.buildSky(scene);
  }

  buildRing(scene) {
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(RING, RING + 0.4, 0.4, 64),
      new THREE.MeshStandardMaterial({ color: 0x8b8e9c, roughness: 0.85 })
    );
    floor.position.y = -0.15;
    floor.receiveShadow = true;
    const rune = new THREE.Mesh(
      new THREE.TorusGeometry(RING - 0.8, 0.08, 6, 96).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7cf7ff).multiplyScalar(1.8) })
    );
    rune.position.y = 0.07;
    const core = rune.clone();
    core.scale.setScalar(0.3);
    scene.add(floor, rune, core);

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2;
      const x = Math.cos(a) * (RING + 2.2), z = Math.sin(a) * (RING + 2.2);
      const tall = rand(2.5, 5.5);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, tall, 8), rock);
      pillar.position.set(x, heightAt(x, z) + tall / 2 - 0.2, z);
      pillar.rotation.z = rand(-0.08, 0.08);
      pillar.castShadow = pillar.receiveShadow = true;
      scene.add(pillar);
      this.colliders.push({ x, z, r: 0.75 });
    }
  }

  plant(scene) {
    const spots = [];
    for (let tries = 0; tries < 900 && spots.length < 80; tries++) {
      const a = Math.random() * TAU, r = rand(0.4, 0.86) * ISLAND;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (slopeAt(x, z) > 0.55 || spots.some(s => Math.hypot(s.x - x, s.z - z) < 4.5)) continue;
      spots.push({ x, z, s: rand(0.8, 1.5) });
    }

    const trunk = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.18, 0.28, 2.2, 6).translate(0, 1.1, 0),
      new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 1, flatShading: true }),
      spots.length
    );
    const crown = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1.5, 0).translate(0, 3.1, 0),
      new THREE.MeshStandardMaterial({ color: 0x3f8a3a, roughness: 0.9, flatShading: true }),
      spots.length
    );
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const shade = new THREE.Color();
    spots.forEach(({ x, z, s }, i) => {
      q.setFromAxisAngle(up, rand(0, TAU));
      m.compose(new THREE.Vector3(x, heightAt(x, z) - 0.1, z), q, new THREE.Vector3(s, s * rand(0.9, 1.3), s));
      trunk.setMatrixAt(i, m);
      crown.setMatrixAt(i, m);
      crown.setColorAt(i, shade.setHSL(rand(0.24, 0.33), 0.5, rand(0.32, 0.45)));
      this.colliders.push({ x, z, r: 0.45 * s });
    });
    trunk.castShadow = crown.castShadow = true;
    crown.receiveShadow = true;
    scene.add(trunk, crown);
  }

  scatterRocks(scene) {
    const geo = jagged(new THREE.DodecahedronGeometry(1, 0), 0.18);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * TAU, r = rand(0.3, 0.88) * ISLAND;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, s = rand(0.6, 2.2);
      const mesh = new THREE.Mesh(geo, rock);
      mesh.position.set(x, heightAt(x, z) + s * 0.3, z);
      mesh.scale.set(s, s * rand(0.6, 1), s);
      mesh.rotation.set(rand(0, TAU), rand(0, TAU), 0);
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);
      this.colliders.push({ x, z, r: s * 0.9 });
    }
  }

  buildSky(scene) {
    this.islets = [];
    const grass = new THREE.MeshStandardMaterial({ color: 0x5aa24a, roughness: 0.9, flatShading: true });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + rand(-0.2, 0.2), r = rand(120, 230), s = rand(4, 14);
      const islet = new THREE.Group();
      islet.add(new THREE.Mesh(jagged(new THREE.ConeGeometry(s, s * 2.2, 9, 3).rotateX(Math.PI), 0.12, true), rock));
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(s * 1.02, s, s * 0.25, 9), grass);
      cap.position.y = s * 1.1;
      islet.add(cap);
      islet.position.set(Math.cos(a) * r, rand(-25, 35), Math.sin(a) * r);
      islet.userData = { base: islet.position.y, phase: rand(0, TAU) };
      scene.add(islet);
      this.islets.push(islet);
    }

    const puff = new THREE.SphereGeometry(1, 10, 7);
    this.clouds = new THREE.InstancedMesh(
      puff,
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, roughness: 1, flatShading: true }),
      70
    );
    this.cloudData = Array.from({ length: 70 }, () => {
      const a = Math.random() * TAU, r = rand(70, 320);
      return { x: Math.cos(a) * r, y: rand(-62, -40), z: Math.sin(a) * r, sx: rand(18, 42), sy: rand(4, 8), sz: rand(14, 30) };
    });
    scene.add(this.clouds);
  }

  update(dt, focus) {
    this.t += dt;
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 90);
    this.sun.target.position.copy(focus);

    for (const islet of this.islets) {
      islet.position.y = islet.userData.base + Math.sin(this.t * 0.3 + islet.userData.phase) * 1.5;
      islet.rotation.y += dt * 0.02;
    }

    const m = new THREE.Matrix4();
    this.cloudData.forEach((c, i) => {
      c.x += dt * 2.5;
      if (c.x > 330) c.x -= 660;
      m.makeScale(c.sx, c.sy, c.sz).setPosition(c.x, c.y, c.z);
      this.clouds.setMatrixAt(i, m);
    });
    this.clouds.instanceMatrix.needsUpdate = true;
  }
}
