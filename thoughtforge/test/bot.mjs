// A bot plays both modes with random movement and random drawings, failing on any error or bad number.
import { newGame } from './helpers.mjs';
import { draw } from './shapes.mjs';

const SHAPES = ['tap', 'line', 'circle', 'triangle', 'square', 'zigzag'];
const pick = list => list[Math.floor(Math.random() * list.length)];

function play(mode, minutes, tough) {
  const env = newGame(mode);
  const { game, input, pressed } = env;
  const made = {};
  let deaths = 0, maxWave = 0;

  for (let frame = 0; frame < minutes * 3600; frame++) {
    if (frame % 50 === 0) input.move = { x: Math.round(Math.random() * 2 - 1), y: Math.round(Math.random() * 2 - 1) };
    if (frame % 70 === 0) pressed.add('Space');
    if (mode === 'sandbox' && frame % 900 === 0) pressed.add('KeyH');
    if (frame % 25 === 0) input.strokes.push(draw(pick(SHAPES), 200 + Math.random() * 880, 250 + Math.random() * 400));
    if (tough) game.hero.hp = game.hero.maxHp;
    if (game.state === 'over') {
      deaths++;
      game.start(mode);
    }
    env.tick();

    for (const c of game.forge.list) made[c.kind] = (made[c.kind] || 0) + 1;
    maxWave = Math.max(maxWave, game.wave);
    const h = game.hero;
    const nums = [h.x, h.y, h.z, h.hp, h.will, game.camera.position.x, ...game.foes.list.flatMap(f => [f.x, f.y, f.z])];
    if (nums.some(n => Number.isNaN(n) || n === Infinity || n === -Infinity)) throw new Error(`bad number in ${mode} at frame ${frame}`);
  }
  const kinds = Object.keys(made).sort().join(',');
  return `${mode.padEnd(7)} tough=${tough} deaths=${deaths} wave=${maxWave} kills=${game.kills} forged=${game.forged} kinds=${kinds} goals=${Object.keys(game.save.goals).length}`;
}

console.log(play('sandbox', 4, false));
console.log(play('trial', 4, false));
console.log(play('trial', 10, true));
