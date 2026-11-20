import * as THREE from 'three';
import { ARENA, TAU, rand } from './config.js';

const nebulaVert = `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const nebulaFrag = `
uniform float time;
uniform vec3 deep;
uniform vec3 cloud;
uniform vec3 mist;
varying vec3 vPos;

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x);
  float b = mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x);
  float c = mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x);
  float d = mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}

float fbm(vec3 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vPos);
  float n = fbm(dir * 2.5 + vec3(time * 0.01));
  float m = fbm(dir * 5.0 + vec3(7.0 - time * 0.015));
  vec3 col = mix(deep, cloud, smoothstep(0.35, 0.8, n));
  col += mist * smoothstep(0.5, 0.9, m);
  gl_FragColor = vec4(col, 1.0);
}`;

function rockGeometry() {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.multiplyScalar(1 + 0.22 * Math.sin(v.x * 5.1 + v.y * 3.7 + v.z * 4.3));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export class World {
  constructor(scene) {
    this.t = 0;
    scene.add(new THREE.HemisphereLight(0x8fa0ff, 0x1a0a30, 1.3));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(30, 60, 20);
    scene.add(sun);

    this.nebula = new THREE.Mesh(
      new THREE.SphereGeometry(1200, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          deep: { value: new THREE.Color() },
          cloud: { value: new THREE.Color() },
          mist: { value: new THREE.Color() },
        },
        vertexShader: nebulaVert,
        fragmentShader: nebulaFrag,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    scene.add(this.nebula);

    const stars = new Float32Array(3000 * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < 3000; i++) {
      v.randomDirection().multiplyScalar(rand(500, 900));
      stars.set([v.x, v.y, v.z], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 2.2, sizeAttenuation: false }));
    scene.add(this.stars);

    const grid = new THREE.PolarGridHelper(ARENA, 24, 9, 96);
    grid.material.vertexColors = false;
    grid.material.transparent = true;
    grid.material.opacity = 0.22;
    grid.material.depthWrite = false;
    scene.add(grid);
    this.grid = grid.material;

    const edge = new THREE.Mesh(
      new THREE.TorusGeometry(ARENA, 0.35, 8, 160),
      new THREE.MeshBasicMaterial()
    );
    edge.rotation.x = Math.PI / 2;
    scene.add(edge);
    this.edge = edge.material;

    this.planet = new THREE.Mesh(
      new THREE.SphereGeometry(190, 48, 32),
      new THREE.MeshStandardMaterial({ color: 0x3b2a6b, roughness: 0.9, emissive: 0x120828 })
    );
    this.planet.position.set(-260, -330, -220);
    const belt = new THREE.Mesh(
      new THREE.RingGeometry(240, 330, 96),
      new THREE.MeshBasicMaterial({ color: 0x6a55aa, side: THREE.DoubleSide, transparent: true, opacity: 0.35 })
    );
    belt.rotation.x = 1.25;
    this.planet.add(belt);
    scene.add(this.planet);

    const rockGeo = rockGeometry();
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6f6a7d, roughness: 0.95, flatShading: true });
    this.asteroids = [];
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(rockGeo, rockMat);
      scene.add(mesh);
      const rock = { mesh, x: 0, z: 0, vx: 0, vz: 0, radius: 1, hp: 1, spin: new THREE.Vector3() };
      this.asteroids.push(rock);
      this.placeRock(rock, rand(25, ARENA - 10));
    }
  }

  placeRock(rock, dist = ARENA - 4) {
    const a = Math.random() * TAU;
    rock.x = Math.cos(a) * dist;
    rock.z = Math.sin(a) * dist;
    rock.vx = rand(-2.5, 2.5);
    rock.vz = rand(-2.5, 2.5);
    rock.radius = rand(2.5, 6);
    rock.hp = rock.radius * 22;
    rock.spin.set(rand(-0.5, 0.5), rand(-0.5, 0.5), rand(-0.5, 0.5));
    rock.mesh.scale.setScalar(rock.radius);
  }

  setTheme(theme, instant) {
    this.theme = {
      deep: new THREE.Color(theme.deep),
      cloud: new THREE.Color(theme.cloud),
      mist: new THREE.Color(theme.mist),
      grid: new THREE.Color(theme.grid),
      edge: new THREE.Color(theme.edge).multiplyScalar(2),
    };
    if (instant) this.blend(1);
  }

  blend(k) {
    const u = this.nebula.material.uniforms;
    u.deep.value.lerp(this.theme.deep, k);
    u.cloud.value.lerp(this.theme.cloud, k);
    u.mist.value.lerp(this.theme.mist, k);
    this.grid.color.lerp(this.theme.grid, k);
    this.edge.color.lerp(this.theme.edge, k);
  }

  reset() {
    for (const rock of this.asteroids) this.placeRock(rock, rand(25, ARENA - 10));
  }

  update(dt) {
    this.t += dt;
    this.nebula.material.uniforms.time.value = this.t;
    this.blend(Math.min(1, dt * 0.8));
    this.stars.rotation.y += dt * 0.004;
    this.planet.rotation.y += dt * 0.01;

    for (const rock of this.asteroids) {
      rock.x += rock.vx * dt;
      rock.z += rock.vz * dt;
      const d = Math.hypot(rock.x, rock.z);
      if (d > ARENA - rock.radius && rock.x * rock.vx + rock.z * rock.vz > 0) {
        rock.vx = -rock.vx;
        rock.vz = -rock.vz;
      }
      rock.mesh.position.set(rock.x, 1, rock.z);
      rock.mesh.rotation.x += rock.spin.x * dt;
      rock.mesh.rotation.y += rock.spin.y * dt;
      rock.mesh.rotation.z += rock.spin.z * dt;
    }
  }
}
