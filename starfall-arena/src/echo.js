import * as THREE from 'three';
import { buildShip } from './player.js';

const STEP = 0.1;
const FIELDS = 4;
const MAX_SAMPLES = 6000;

const ghost = new THREE.MeshBasicMaterial({
  color: new THREE.Color(0x55ddff).multiplyScalar(1.4),
  transparent: true,
  opacity: 0.4,
  depthWrite: false,
});

const round = (n, k) => Math.round(n * k) / k;

// Stores the flight of the current run as flat samples: x, z, angle, firing.
export class Recorder {
  constructor() {
    this.frames = [];
    this.clock = 0;
  }

  get seconds() {
    return (this.frames.length / FIELDS) * STEP;
  }

  sample(dt, player, firing) {
    this.clock += dt;
    if (this.clock < STEP || this.frames.length >= MAX_SAMPLES * FIELDS) return;
    this.clock -= STEP;
    this.frames.push(round(player.x, 10), round(player.z, 10), round(player.angle, 100), firing ? 1 : 0);
  }
}

// Replays a stored run as a ghost ship that fires weaker shots.
export class Echo {
  constructor(scene, run) {
    this.scene = scene;
    this.frames = run.frames;
    this.wave = run.wave;
    this.time = 0;
    this.cool = 0;
    this.done = false;
    this.x = this.z = 0;
    this.mesh = buildShip();
    this.mesh.traverse(part => {
      if (part.isMesh) part.material = ghost;
    });
    scene.add(this.mesh);
  }

  update(dt, game) {
    const f = this.frames;
    this.time += dt;
    const at = this.time / STEP;
    const i = Math.floor(at) * FIELDS;
    if (i + FIELDS * 2 > f.length) return this.fade(game);

    const k = at % 1;
    const angle = f[i + 2];
    this.x = f[i] + (f[i + FIELDS] - f[i]) * k;
    this.z = f[i + 1] + (f[i + FIELDS + 1] - f[i + 1]) * k;
    this.mesh.position.set(this.x, 1, this.z);
    this.mesh.rotation.y = angle;

    this.cool -= dt;
    if (f[i + 3] && this.cool <= 0) {
      const sin = Math.sin(angle), cos = Math.cos(angle);
      this.cool = 0.25;
      game.shots.spawn(this.x + sin * 2, this.z + cos * 2, sin * 75, cos * 75, game.player.damage * 0.4, 1.1);
    }
  }

  fade(game) {
    this.done = true;
    this.remove();
    game.particles.burst(this.x, this.z, 0x55ddff, 40, 20, 0.8);
    game.pickups.drop('power', this.x, this.z);
    game.hud.toast('Echo faded', `That run ended on wave ${this.wave}`);
  }

  remove() {
    this.scene.remove(this.mesh);
  }
}
