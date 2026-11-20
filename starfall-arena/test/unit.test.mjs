import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const disk = new Map();
globalThis.localStorage = {
  getItem: key => disk.get(key) ?? null,
  setItem: (key, value) => disk.set(key, String(value)),
};

const { Game } = await import('../src/game.js');
const { Recorder, Echo } = await import('../src/echo.js');
const { rollUpgrades, findUpgrade } = await import('../src/upgrades.js');
const { SHOP, MEDALS, MODES, shopCost } = await import('../src/meta.js');
const { load, store, loadEchoes, storeEcho } = await import('../src/save.js');

const quiet = new Proxy({}, { get: () => () => {} });

function newGame() {
  disk.clear();
  const pressed = new Set();
  const input = {
    mouse: { x: 0, y: 0, down: false },
    axis: () => ({ x: 0, z: 0 }),
    hit: code => pressed.has(code),
    endFrame: () => pressed.clear(),
  };
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 1, 3000);
  const game = new Game({ scene: new THREE.Scene(), camera, hud: quiet, input, audio: quiet });
  const tick = (frames = 1) => {
    for (let i = 0; i < frames; i++) {
      camera.updateMatrixWorld();
      game.update(1 / 60);
    }
  };
  return { game, input, pressed, tick };
}

test('save falls back to defaults and keeps stored values', () => {
  disk.clear();
  assert.equal(load().mode, 'normal');
  store({ ...load(), credits: 42 });
  assert.equal(load().credits, 42);
  assert.deepEqual(load().shop, {});
});

test('upgrade rolls are distinct and respect rank limits', () => {
  const player = { taken: { split: findUpgrade('split').max } };
  for (let i = 0; i < 50; i++) {
    const picks = rollUpgrades(player, 3, 'level');
    assert.equal(new Set(picks.map(u => u.id)).size, 3);
    assert.ok(!picks.some(u => u.id === 'split'));
  }
  assert.ok(rollUpgrades(player, 3, 'relic').every(u => u.relic));
});

test('shop charges rising prices and stops at the rank limit', () => {
  const { game } = newGame();
  const item = SHOP.find(s => s.id === 'head');
  game.save.credits = shopCost(item, 0) + shopCost(item, 1) + 5;
  assert.ok(game.buy('head'));
  assert.ok(game.buy('head'));
  assert.equal(game.save.credits, 5);
  game.save.credits = 9999;
  assert.equal(game.buy('head'), false);
});

test('hangar parts change the starting ship', () => {
  const { game } = newGame();
  game.save.shop = { armor: 2, reactor: 1 };
  game.start();
  assert.equal(game.player.maxHp, 120);
  assert.equal(game.player.maxShield, 50);
});

test('nightmare stays locked until the veteran medal is earned', () => {
  const { game } = newGame();
  game.setMode('insane');
  assert.equal(game.save.mode, 'normal');
  game.save.medals.veteran = true;
  game.setMode('insane');
  assert.equal(game.mode, MODES.insane);
});

test('waves start, and every fifth wave holds the boss', () => {
  const { game, tick } = newGame();
  game.start();
  tick(120);
  assert.equal(game.wave, 1);
  game.wave = 4;
  game.nextWave();
  assert.equal(game.queue[0], 'boss');
  assert.equal(game.sector, 0);
  game.nextWave();
  assert.equal(game.sector, 1);
});

test('a level up pauses play until an upgrade is picked', () => {
  const { game, pressed, tick } = newGame();
  game.start();
  game.addXp(game.xpNeed);
  assert.equal(game.state, 'upgrade');
  const first = game.choices[0].id;
  pressed.add('Digit1');
  tick();
  assert.equal(game.state, 'playing');
  assert.equal(game.player.taken[first], 1);
});

test('killing a boss queues a relic and pays credits', () => {
  const { game, tick } = newGame();
  game.start();
  tick(5);
  game.spawnAt('boss', 30, 0);
  const boss = game.boss;
  game.hitEnemy(boss, boss.hp + 1, boss.x, boss.z);
  assert.equal(game.state, 'upgrade');
  assert.ok(game.choices.every(u => u.relic));
  assert.ok(game.earned >= 100);
});

test('gravity well swallows enemy shots and returns fire on collapse', () => {
  const { game, tick } = newGame();
  game.start();
  tick(2);
  game.well.cast(40, 0, 0);
  for (let i = 0; i < 10; i++) game.bolts.spawn(40 + i * 0.1, 1, 0, 0, 10, 5);
  tick(2);
  assert.equal(game.well.absorbed, 10);
  assert.equal(game.bolts.items.length, 0);
  while (game.well.life > 0) tick();
  assert.equal(game.well.best, 10);
  assert.ok(game.shots.items.length >= 30);
});

test('gravity well drags enemies toward its core', () => {
  const { game, tick } = newGame();
  game.start();
  tick(2);
  game.player.x = -60;
  game.spawnAt('bomber', 50, 0);
  const enemy = game.enemies.list.at(-1);
  enemy.speed = 0;
  game.well.cast(40, 0, 0);
  tick(60);
  assert.ok(enemy.x < 49);
});

test('a recorded run replays as an echo at the same positions', () => {
  const rec = new Recorder();
  const ship = { x: 0, z: 0, angle: 0 };
  for (let i = 0; i < 600; i++) {
    ship.x = i * 0.05;
    ship.z = -i * 0.02;
    rec.sample(1 / 60, ship, true);
  }
  assert.ok(Math.abs(rec.seconds - 10) < 0.2);

  const { game } = newGame();
  game.start();
  const echo = new Echo(game.scene, { frames: rec.frames, wave: 3 });
  for (let i = 0; i < 300; i++) echo.update(1 / 60, game);
  assert.ok(Math.abs(echo.x - 15) < 0.6);
  assert.ok(game.shots.items.length > 0);
  for (let i = 0; i < 400; i++) if (!echo.done) echo.update(1 / 60, game);
  assert.ok(echo.done);
  assert.ok(game.pickups.items.some(it => it.kind === 'power'));
});

test('only the best three runs are kept as echoes', () => {
  disk.clear();
  for (const score of [50, 400, 10, 900]) storeEcho({ score, wave: 1, frames: [] });
  assert.deepEqual(loadEchoes().map(r => r.score), [900, 400, 50]);
});

test('runs shorter than thirty seconds leave no echo', () => {
  const { game, tick } = newGame();
  game.start();
  tick(600);
  game.quit();
  assert.equal(loadEchoes().length, 0);
  game.start();
  for (let i = 0; i < 60 * 31; i++) {
    game.player.hp = game.player.maxHp;
    tick();
  }
  game.quit();
  assert.equal(loadEchoes().length, 1);
});

test('medals pay once', () => {
  const { game } = newGame();
  game.start();
  game.kills = 1;
  game.checkMedals();
  const credits = game.save.credits;
  assert.equal(credits, MEDALS.find(m => m.id === 'first').reward);
  game.checkMedals();
  assert.equal(game.save.credits, credits);
});

test('death banks credits, stores the best score and allows a restart', () => {
  const { game, pressed, tick } = newGame();
  game.start();
  tick(5);
  game.score = 777;
  game.earned = 12.6;
  game.player.hp = 0;
  tick();
  assert.equal(game.state, 'over');
  assert.equal(game.save.best.normal, 777);
  assert.ok(game.save.credits >= 12);
  pressed.add('Enter');
  tick();
  assert.equal(game.state, 'playing');
  assert.equal(game.score, 0);
});
