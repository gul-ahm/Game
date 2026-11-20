// Runs the game logic without a browser. A simple bot plays every mode for a fixed time.
import * as THREE from 'three';
import { Game } from '../src/game.js';
import { MODES } from '../src/meta.js';

const disk = new Map();
globalThis.localStorage = { getItem: k => disk.get(k) ?? null, setItem: (k, v) => disk.set(k, String(v)) };

const quiet = new Proxy({}, { get: () => () => {} });

function play({ mode, minutes, tough }) {
  const pressed = new Set();
  const input = {
    mouse: { x: 0, y: 0, down: true },
    move: { x: 0, z: 0 },
    axis() { return this.move; },
    hit: code => pressed.has(code),
    endFrame: () => pressed.clear(),
  };
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 1, 3000);
  const game = new Game({ scene: new THREE.Scene(), camera, hud: quiet, input, audio: quiet });
  const seen = new Set();
  let deaths = 0, maxWave = 0;

  game.save.medals.veteran = true;
  game.save.credits = 5000;
  game.setMode(mode);
  for (const id of ['armor', 'head', 'head', 'head', 'scanner']) game.buy(id);
  if (game.save.shop.head !== 2) throw new Error('shop rank limit failed');

  game.start();
  for (let frame = 0; frame < minutes * 3600; frame++) {
    if (frame % 40 === 0) {
      input.move = { x: Math.round(Math.random() * 2 - 1), z: Math.round(Math.random() * 2 - 1) };
      input.mouse.x = Math.random() * 1.6 - 0.8;
      input.mouse.y = Math.random() * 1.6 - 0.8;
    }
    if (frame % 90 === 0) pressed.add('Space');
    if (frame % 200 === 0) pressed.add('KeyQ');
    if (frame % 1500 === 700 || frame % 1500 === 720) pressed.add('KeyP');
    if (game.state === 'upgrade') pressed.add('Digit' + (1 + Math.floor(Math.random() * 3)));
    if (game.state === 'over') {
      deaths++;
      pressed.add('Enter');
    }
    if (tough) game.player.hp = game.player.maxHp;

    camera.updateMatrixWorld();
    game.update(1 / 60);

    for (const e of game.enemies.list) seen.add(e.elite ? 'elite' : e.type);
    maxWave = Math.max(maxWave, game.wave);
    const p = game.player;
    const nums = [p.x, p.z, p.hp, p.shield, game.score, game.wallet, camera.position.x, game.aim.x, ...game.enemies.list.flatMap(e => [e.x, e.z, e.hp])];
    if (nums.some(n => !Number.isFinite(n))) throw new Error('bad number at frame ' + frame);
  }
  game.quit();
  if (game.state !== 'menu') throw new Error('quit failed');
  return `${mode.padEnd(7)} tough=${tough} deaths=${deaths} wave=${maxWave} medals=${Object.keys(game.save.medals).length} credits=${game.save.credits} seen=${[...seen].join(',')}`;
}

for (const mode of Object.keys(MODES)) console.log(play({ mode, minutes: 5, tough: false }));
console.log(play({ mode: 'normal', minutes: 14, tough: true }));
console.log(play({ mode: 'insane', minutes: 8, tough: true }));
