import * as THREE from 'three';

const disk = new Map();
globalThis.localStorage = {
  getItem: key => disk.get(key) ?? null,
  setItem: (key, value) => disk.set(key, String(value)),
};

const { Game } = await import('../src/game.js');
const quiet = new Proxy({}, { get: () => () => {} });

export function newGame(mode = 'sandbox') {
  disk.clear();
  const pressed = new Set();
  const input = {
    keys: new Set(),
    stroke: null,
    strokes: [],
    move: { x: 0, y: 0 },
    axis() { return this.move; },
    hit: code => pressed.has(code),
    takeStroke() { return this.strokes.shift(); },
    takeLook: () => ({ dx: 0, dy: 0, zoom: 0 }),
    endFrame: () => pressed.clear(),
  };
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 2000);
  const game = new Game({ scene: new THREE.Scene(), camera, hud: quiet, input, audio: quiet });
  game.start(mode);

  const tick = (frames = 1) => {
    for (let i = 0; i < frames; i++) game.update(1 / 60);
  };
  const screen = (x, y, z) => {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return { x: ((v.x + 1) / 2) * game.view.w, y: ((1 - v.y) / 2) * game.view.h };
  };
  tick(60);
  return { game, input, pressed, tick, screen };
}
