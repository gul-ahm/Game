import test from 'node:test';
import assert from 'node:assert/strict';
import { recognise, resample } from '../src/gesture.js';
import { draw } from './shapes.mjs';

const SHAPES = ['tap', 'line', 'circle', 'triangle', 'square', 'zigzag'];

test('resample gives evenly spaced points whatever the drawing speed', () => {
  const slow = Array.from({ length: 200 }, (_, i) => ({ x: i, y: 0 }));
  const fast = [{ x: 0, y: 0 }, { x: 150, y: 0 }, { x: 199, y: 0 }];
  for (const pts of [slow, fast]) {
    const out = resample(pts);
    assert.equal(out.length, 64);
    const gaps = out.slice(1).map((p, i) => p.x - out[i].x);
    assert.ok(Math.max(...gaps) - Math.min(...gaps) < 0.01);
  }
});

test('every shape is read correctly at least 95% of the time', () => {
  for (const shape of SHAPES) {
    let right = 0;
    for (let i = 0; i < 400; i++) if (recognise(draw(shape)).shape === shape) right++;
    assert.ok(right / 400 >= 0.95, `${shape}: ${right} of 400`);
  }
});

test('size and position do not change the answer', () => {
  for (const shape of ['circle', 'triangle', 'square']) {
    assert.equal(recognise(draw(shape, 100, 100, 40)).shape, shape);
    assert.equal(recognise(draw(shape, 900, 500, 260)).shape, shape);
  }
});

test('clean drawings score higher clarity than shaky ones', () => {
  const avg = noise => {
    let sum = 0;
    for (let i = 0; i < 100; i++) sum += recognise(draw('circle', 400, 400, 120, noise)).clarity;
    return sum / 100;
  };
  assert.ok(avg(1) > avg(14));
});

test('empty input gives nothing', () => {
  assert.equal(recognise([]), null);
  assert.equal(recognise([{ x: 1, y: 1 }]), null);
});
