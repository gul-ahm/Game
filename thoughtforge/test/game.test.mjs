import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from './helpers.mjs';
import { draw } from './shapes.mjs';
import { heightAt } from '../src/terrain.js';

const ground = (x, z) => [x, heightAt(x, z), z];

function forgeAt(env, shape, x, z, pixels = 80) {
  const p = env.screen(...ground(x, z));
  return env.game.forgeStroke(draw(shape, p.x, p.y, pixels, 1));
}

test('a screen point maps back to the same spot on the island', () => {
  const env = newGame();
  for (const [x, z] of [[0, -6], [4, -12], [-5, -18]]) {
    const p = env.screen(...ground(x, z));
    const hit = env.game.pick(p.x, p.y);
    assert.ok(Math.hypot(hit.x - x, hit.z - z) < 0.3, `${x},${z} -> ${hit.x.toFixed(2)},${hit.z.toFixed(2)}`);
  }
});

test('the playground starts with dummies and crates', () => {
  const { game } = newGame();
  assert.equal(game.foes.list.filter(f => f.kind === 'dummy').length, 4);
  assert.equal(game.foes.list.filter(f => f.kind === 'crate').length, 6);
});

test('a tap on a Hollow fires a bolt that hurts it', () => {
  const env = newGame();
  const f = env.game.foes.spawn('hollow', 0, -10);
  f.speed = 0;
  env.tick(2);
  const p = env.screen(f.x, f.y + 1.2, f.z);
  const made = env.game.forgeStroke(draw('tap', p.x, p.y));
  assert.equal(made.kind, 'bolt');
  env.tick(30);
  assert.ok(f.hp < f.maxHp);
});

test('will is spent, and a shape you cannot afford fizzles', () => {
  const env = newGame();
  const h = env.game.hero;
  h.will = 100;
  forgeAt(env, 'square', 0, -8);
  assert.ok(h.will <= 100 - 18 + 1);
  h.will = 5;
  assert.equal(forgeAt(env, 'triangle', 0, -10), null);
  assert.equal(h.will, 5);
});

test('a circle around the hero raises an Aegis that soaks damage', () => {
  const env = newGame('trial');
  const h = env.game.hero;
  const p = env.screen(h.x, h.y + 1, h.z);
  const made = env.game.forgeStroke(draw('circle', p.x, p.y, 130, 1));
  assert.equal(made.kind, 'aegis');
  env.game.hurtHero(30, { x: 5, z: 0 });
  assert.equal(h.hp, h.maxHp);
  assert.ok(made.hp < made.maxHp);
});

test('a circle elsewhere drops a Cage that holds Hollows', () => {
  const env = newGame();
  const caught = [[0, -14], [1.5, -15], [-1.5, -15]].map(([x, z]) => env.game.foes.spawn('hollow', x, z));
  env.tick(1);
  const made = forgeAt(env, 'circle', 0, -14.5, 110);
  assert.equal(made.kind, 'cage');
  env.tick(30);
  assert.ok(caught.every(f => f.held > 0));
  assert.ok(env.game.save.goals.cage);
});

test('a triangle brings down a Hammer that launches crates', () => {
  const env = newGame();
  const crate = env.game.foes.spawn('crate', 0, -12);
  const made = forgeAt(env, 'triangle', 0, -12, 90);
  assert.equal(made.kind, 'hammer');
  let peak = 0;
  for (let i = 0; i < 50; i++) {
    env.tick();
    peak = Math.max(peak, crate.vy);
  }
  assert.ok(made.struck);
  assert.ok(peak > 8);
  assert.ok(env.game.save.goals.launch);
});

test('a square raises a Wall you can stand on and that blocks shots', () => {
  const env = newGame();
  const { game } = env;
  const wall = forgeAt(env, 'square', 0, -8, 90);
  assert.equal(wall.kind, 'wall');
  env.tick(20);
  assert.equal(game.floorAt(wall.x, wall.z, wall.top + 1), wall.top);

  const before = game.blocks;
  const from = new (game.hero.chest.constructor)(0, 1.5, -20);
  game.foes.orbs.spawn(from, game.hero.chest, 18, 10);
  env.tick(90);
  assert.equal(game.blocks, before + 1);

  const h = game.hero;
  h.x = wall.x;
  h.z = wall.z;
  h.y = wall.top + 2;
  h.vy = 0;
  env.tick(60);
  assert.ok(Math.abs(h.y - wall.top) < 0.05);
  assert.ok(game.save.goals.climb);
});

test('a zigzag sends a Storm through several targets', () => {
  const env = newGame();
  for (const f of env.game.foes.list) f.dead = true;
  env.tick(1);
  [[-3, -12], [0, -14], [3, -12]].forEach(([x, z]) => env.game.foes.spawn('dummy', x, z));
  const made = forgeAt(env, 'zigzag', 0, -13, 90);
  assert.equal(made.kind, 'storm');
  assert.ok(made.hits >= 3);
  assert.ok(env.game.save.goals.chain);
});

test('a line throws a Lance that pierces a row of Hollows', () => {
  const env = newGame();
  const row = [-8, -12, -16].map(z => {
    const f = env.game.foes.spawn('hollow', 0, z);
    f.speed = 0;
    return f;
  });
  env.tick(1);
  const a = env.screen(...ground(0, -4)), b = env.screen(...ground(0, -18));
  const pts = Array.from({ length: 30 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / 29, y: a.y + ((b.y - a.y) * i) / 29 }));
  assert.equal(env.game.forgeStroke(pts).kind, 'lance');
  env.tick(40);
  assert.ok(row.every(f => f.hp < f.maxHp || f.dead));
});

test('knocking a Hollow off the island counts as a ring out', () => {
  const env = newGame();
  const f = env.game.foes.spawn('hollow', 0, -66);
  env.tick(2);
  assert.ok(!env.game.foes.list.includes(f));
  assert.ok(env.game.save.goals.ringout);
});

test('the trial sends waves, adds brutes later and ends when health runs out', () => {
  const env = newGame('trial');
  const { game } = env;
  env.tick(60 * 4);
  assert.equal(game.wave, 1);
  game.wave = 2;
  game.nextWave();
  assert.ok(game.queue.includes('brute'));
  game.score = 321;
  game.hero.hp = 0;
  env.tick(1);
  assert.equal(game.state, 'over');
  assert.equal(game.save.best, 321);
});

test('playground damage never lowers health', () => {
  const env = newGame();
  env.game.hurtHero(50, { x: 3, z: 0 });
  assert.equal(env.game.hero.hp, env.game.hero.maxHp);
});
