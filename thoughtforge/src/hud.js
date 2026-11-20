import * as THREE from 'three';
import { CONSTRUCTS, GOALS, NAMES } from './meta.js';

const $ = id => document.getElementById(id);
const SCREENS = ['menu', 'paused', 'over'];
const POPS = 40;
const ICONS = {
  tap: '<circle cx="12" cy="12" r="2.5"/>',
  line: '<path d="M4 20 20 4"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  triangle: '<path d="M12 3.5 20.5 19.5h-17z"/>',
  square: '<rect x="4" y="4" width="16" height="16"/>',
  zigzag: '<path d="M2 16 6.5 7l5 10 5-10 5.5 9"/>',
};
const icon = shape => `<svg viewBox="0 0 24 24">${ICONS[shape]}</svg>`;

function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

export class Hud {
  constructor() {
    this.cache = {};
    this.trail = null;
    this.ctx = $('ink').getContext('2d');
    this.v = new THREE.Vector3();
    this.pops = Array.from({ length: POPS }, () => {
      const el = document.createElement('div');
      el.className = 'pop';
      $('pops').append(el);
      return { el, life: 0, pos: new THREE.Vector3() };
    });
    this.nextPop = 0;
    addEventListener('resize', () => this.fit());
    this.fit();
  }

  fit() {
    const k = Math.min(devicePixelRatio, 2);
    $('ink').width = innerWidth * k;
    $('ink').height = innerHeight * k;
    this.ctx.setTransform(k, 0, 0, k, 0, 0);
  }

  bind(game) {
    this.game = game;
    $('playground').onclick = () => game.start('sandbox');
    $('trial').onclick = () => game.start('trial');
    $('resume').onclick = () => game.togglePause();
    $('quit').onclick = () => game.quit();
    $('home').onclick = () => game.quit();
    $('retry').onclick = () => game.start(game.mode);

    const entries = Object.entries(CONSTRUCTS);
    $('legend').innerHTML = entries.map(([s, c]) => `<div class="rune" data-shape="${s}">${icon(s)}<b>${c.name}</b><small>${c.cost} will</small></div>`).join('');
    $('guide').innerHTML = entries.map(([s, c]) => `<div class="lore">${icon(s)}<div><b>${c.name}</b><small>${c.hint}</small></div></div>`).join('');
    this.runes = Object.fromEntries([...document.querySelectorAll('.rune')].map(el => [el.dataset.shape, el]));
    this.setState(game.state, game);
  }

  setState(state, game) {
    for (const id of SCREENS) $(id).hidden = id !== state;
    $('hud').hidden = state === 'menu';
    $('goals').hidden = game.mode !== 'sandbox';
    this.cache.goals = -1;

    if (state === 'menu') {
      const done = GOALS.filter(g => game.save.goals[g.id]).length;
      $('record').textContent = `Trial best ${game.save.best.toLocaleString()}  ·  Training ${done} of ${GOALS.length}`;
    }
    if (state === 'over') {
      $('final').textContent = game.score.toLocaleString();
      $('newBest').hidden = !game.newBest;
      $('stats').innerHTML = [['Wave', game.wave], ['Kills', game.kills], ['Constructs', game.forged], ['Best', game.save.best.toLocaleString()]]
        .map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`)
        .join('');
    }
  }

  ink(points, ok) {
    this.trail = { points, color: ok ? '#bffcff' : '#ff5566', life: 0.5 };
  }

  cast(kind, clarity, shape) {
    const form = Math.round(clarity * 100);
    $('castTitle').textContent = NAMES[kind];
    $('castForm').textContent = shape === 'tap' ? '' : clarity >= 0.9 ? `${form}% form · Perfect` : `${form}% form`;
    replay($('cast'), 'show');
    replay(this.runes[shape], 'lit');
  }

  toast(title, sub = '') {
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<b>${title}</b><small>${sub}</small>`;
    box.append(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => el.remove(), 3400);
  }

  banner(title, sub = '') {
    $('bannerTitle').textContent = title;
    $('bannerSub').textContent = sub;
    replay($('banner'), 'show');
  }

  flash() {
    replay($('hit'), 'show');
  }

  pop(amount, pos, soft) {
    const slot = this.pops[this.nextPop++ % POPS];
    slot.pos.copy(pos);
    slot.life = 0.9;
    slot.el.textContent = amount;
    slot.el.className = soft ? 'pop soft' : 'pop';
  }

  text(id, value) {
    if (this.cache[id] === value) return;
    this.cache[id] = value;
    $(id).textContent = value;
  }

  bar(id, ratio) {
    const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
    if (this.cache[id] === pct) return;
    this.cache[id] = pct;
    $(id).style.width = pct + '%';
  }

  update(g, dt) {
    this.drawInk(g, dt);
    if (g.state === 'menu') return;
    const h = g.hero;
    this.bar('hp', h.hp / h.maxHp);
    this.bar('will', h.will / h.maxWill);
    this.text('hpText', Math.max(0, Math.ceil(h.hp)) + '');
    this.text('willText', Math.floor(h.will) + '');

    if (g.mode === 'trial') {
      this.text('wave', g.wave ? 'WAVE ' + g.wave : 'GET READY');
      this.text('left', g.wave ? g.queue.length + g.foes.creatures + ' Hollows left' : '');
      this.text('score', g.score.toLocaleString());
      this.text('sub', g.kills + ' kills');
    } else {
      this.text('wave', 'PLAYGROUND');
      this.text('left', 'Press H to summon Hollows');
      this.text('score', g.forged + '');
      this.text('sub', 'constructs forged');
    }

    for (const [shape, el] of Object.entries(this.runes)) {
      const low = h.will < CONSTRUCTS[shape].cost;
      if (this.cache[shape] !== low) {
        this.cache[shape] = low;
        el.classList.toggle('low', low);
      }
    }

    const done = GOALS.filter(x => g.save.goals[x.id]).length;
    if (g.mode === 'sandbox' && this.cache.goals !== done) {
      this.cache.goals = done;
      $('goals').innerHTML = `<h4>Training ${done} / ${GOALS.length}</h4>` +
        GOALS.map(x => `<div class="${g.save.goals[x.id] ? 'done' : ''}">${x.text}</div>`).join('');
    }

    const low = h.hp / h.maxHp < 0.3 && g.mode === 'trial';
    if (this.cache.low !== low) {
      this.cache.low = low;
      $('hud').classList.toggle('low', low);
    }
    this.movePops(g.camera, dt);
  }

  movePops(camera, dt) {
    for (const p of this.pops) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const v = this.v.copy(p.pos);
      v.y += (0.9 - p.life) * 1.6;
      v.project(camera);
      const x = ((v.x + 1) / 2) * innerWidth, y = ((1 - v.y) / 2) * innerHeight;
      p.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      p.el.style.opacity = v.z > 1 || p.life <= 0 ? 0 : Math.min(1, p.life * 3);
    }
  }

  drawInk(g, dt) {
    const c = this.ctx;
    c.clearRect(0, 0, innerWidth, innerHeight);
    const trace = (pts, color, alpha, width) => {
      if (!pts || pts.length < 2) return;
      c.globalAlpha = alpha;
      c.strokeStyle = color;
      c.lineWidth = width;
      c.lineCap = c.lineJoin = 'round';
      c.shadowColor = color;
      c.shadowBlur = 18;
      c.beginPath();
      c.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) c.lineTo(p.x, p.y);
      c.stroke();
    };

    if (g.state === 'playing') {
      trace(g.input.stroke, '#7cf7ff', 0.85, 6);
      trace(g.input.stroke, '#ffffff', 0.95, 1.6);
    }
    if (this.trail) {
      this.trail.life -= dt;
      const a = Math.max(0, this.trail.life / 0.5);
      trace(this.trail.points, this.trail.color, a, 6 + (1 - a) * 10);
      if (a <= 0) this.trail = null;
    }
    c.globalAlpha = 1;
    c.shadowBlur = 0;
  }
}
