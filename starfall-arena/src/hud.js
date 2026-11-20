import { ARENA } from './config.js';
import { MODES, SHOP, MEDALS, shopCost } from './meta.js';
import { findUpgrade } from './upgrades.js';

const $ = id => document.getElementById(id);
const SCREENS = ['menu', 'hangar', 'medals', 'paused', 'upgrade', 'over'];
const num = n => Math.round(n).toLocaleString();
const pips = (on, max) => '<i class="on"></i>'.repeat(on) + '<i></i>'.repeat(max - on);

function el(tag, cls, html) {
  const node = document.createElement(tag);
  node.className = cls;
  node.innerHTML = html;
  return node;
}

function replay(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

export class Hud {
  constructor() {
    this.cache = {};
    this.frame = 0;
    this.radar = $('radar').getContext('2d');
  }

  bind(game) {
    this.game = game;
    $('start').onclick = () => game.start();
    $('retry').onclick = () => game.start();
    $('resume').onclick = () => game.togglePause();
    $('quit').onclick = () => game.quit();
    $('toMenu').onclick = () => game.quit();
    $('openHangar').onclick = () => this.show('hangar');
    $('openMedals').onclick = () => this.show('medals');
    for (const b of document.querySelectorAll('.back')) b.onclick = () => this.show('menu');
    this.setState(game.state, game);
  }

  show(screen) {
    for (const id of SCREENS) $(id).hidden = id !== screen;
  }

  setState(state, game) {
    this.show(state);
    $('hud').hidden = state === 'menu';
    document.body.classList.toggle('aiming', state === 'playing');
    if (state === 'menu') this.drawMenu();
    if (state === 'upgrade') this.drawCards(game);
    if (state === 'paused') $('pauseBuild').innerHTML = this.chips(game.player) || 'No upgrades yet';
    if (state === 'over') this.drawResult(game);
  }

  drawMenu() {
    const g = this.game;
    const { save } = g;

    $('modes').replaceChildren(
      ...Object.entries(MODES).map(([id, m]) => {
        const open = g.unlocked(id);
        const cls = 'mode' + (id === save.mode ? ' on' : '') + (open ? '' : ' locked');
        const b = el('button', cls, `<b>${m.name}</b><small>${open ? 'Score x' + m.score : 'Beat the Warden on Veteran'}</small>`);
        b.onclick = () => {
          g.setMode(id);
          this.drawMenu();
        };
        return b;
      })
    );
    $('modeNote').textContent = g.mode.note;
    $('menuBest').textContent = `Best on ${g.mode.name}: ${num(save.best[save.mode] || 0)}`;
    for (const node of document.querySelectorAll('.wallet')) node.textContent = num(save.credits) + ' credits';

    $('shop').replaceChildren(
      ...SHOP.map(item => {
        const rank = save.shop[item.id] || 0;
        const cost = shopCost(item, rank);
        const full = rank >= item.max;
        const cls = 'card' + (full ? ' full' : save.credits < cost ? ' poor' : '');
        const b = el('button', cls, `<h3>${item.name}</h3><p>${item.desc}</p><div class="pips">${pips(rank, item.max)}</div><span class="cost">${full ? 'Maxed' : num(cost) + ' credits'}</span>`);
        b.onclick = () => {
          if (!g.buy(item.id)) return;
          g.audio.unlock();
          g.audio.pickup('heart');
          this.drawMenu();
        };
        return b;
      })
    );

    const earned = MEDALS.filter(m => save.medals[m.id]).length;
    $('medalCount').textContent = `${earned} of ${MEDALS.length} earned`;
    $('medalList').replaceChildren(
      ...MEDALS.map(m => el('div', 'medal' + (save.medals[m.id] ? ' got' : ''), `<span class="star">★</span><div><h3>${m.name}</h3><p>${m.desc}</p></div><span class="cost">${m.reward}</span>`))
    );
  }

  drawCards(game) {
    const relic = game.offers[0] === 'relic';
    $('offerTitle').textContent = relic ? 'Warden Relic' : 'Level Up';
    $('offerNote').textContent = relic ? 'A rare reward. Pick one.' : 'Pick one upgrade. You can also press 1, 2 or 3.';
    $('cards').replaceChildren(
      ...game.choices.map((u, i) => {
        const rank = game.player.taken[u.id] || 0;
        const card = el('button', 'card pick' + (relic ? ' relic' : ''), `<span class="key">${i + 1}</span><span class="icon">${u.icon}</span><h3>${u.name}</h3><p>${u.desc}</p><div class="pips">${pips(rank, u.max)}</div>`);
        card.onclick = () => game.pick(i);
        return card;
      })
    );
  }

  drawResult(g) {
    $('rank').textContent = g.rank;
    $('rank').className = 'rank' + g.rank;
    $('final').textContent = num(g.score);
    $('newBest').hidden = !g.newBest;
    const medals = g.newMedals.reduce((sum, m) => sum + m.reward, 0);
    const stats = [
      ['Mode', g.mode.name],
      ['Wave', g.wave],
      ['Sector', g.sector + 1],
      ['Level', g.level],
      ['Kills', g.kills],
      ['Credits', '+' + num(Math.floor(g.earned) + medals)],
    ];
    $('stats').innerHTML = stats.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
    $('gotMedals').textContent = g.newMedals.length ? 'New medals: ' + g.newMedals.map(m => m.name).join(', ') : '';
  }

  chips(player) {
    return Object.entries(player.taken)
      .map(([id, n]) => {
        const u = findUpgrade(id);
        return `<span class="chip" title="${u.name}">${u.icon}<b>${n}</b></span>`;
      })
      .join('');
  }

  banner(title, sub = '') {
    $('bannerTitle').textContent = title;
    $('bannerSub').textContent = sub;
    replay($('banner'), 'show');
  }

  toast(title, sub = '') {
    const box = $('toasts');
    const node = el('div', 'toast', `<b>${title}</b><small>${sub}</small>`);
    box.append(node);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => node.remove(), 3400);
  }

  flash() {
    replay($('hit'), 'show');
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

  toggle(id, on) {
    if (this.cache[id] === on) return;
    this.cache[id] = on;
    $(id).hidden = !on;
  }

  update(g) {
    if (g.state === 'menu') return;
    const p = g.player;
    this.bar('hull', p.hp / p.maxHp);
    this.bar('shield', p.shield / p.maxShield);
    this.bar('xp', g.xp / g.xpNeed);
    this.bar('dash', 1 - p.dashTimer / p.dashCd);
    this.bar('well', g.well.charge);
    this.text('hullText', Math.max(0, Math.ceil(p.hp)) + ' / ' + p.maxHp);
    this.text('level', 'LV ' + g.level);
    this.text('score', num(g.score));
    this.text('combo', g.combo > 1 ? 'x' + g.combo : '');
    this.text('credits', num(g.wallet) + ' cr');
    this.text('sector', g.wave ? `SECTOR ${g.sector + 1}  ·  ${g.theme.name}` : '');
    this.text('wave', g.wave ? 'WAVE ' + g.wave : 'GET READY');
    this.text('left', g.wave ? g.queue.length + g.enemies.list.length + ' hostiles' : '');

    this.toggle('boost', p.overdrive > 0);
    if (p.overdrive > 0) this.bar('boostBar', p.overdrive / 8);

    const boss = g.boss;
    this.toggle('bossWrap', !!boss);
    if (boss) this.bar('bossBar', boss.hp / boss.maxHp);

    if (this.cache.build !== g.build) {
      this.cache.build = g.build;
      $('build').innerHTML = this.chips(p);
    }

    const low = p.hp / p.maxHp < 0.3 && g.state === 'playing';
    if (this.cache.low !== low) {
      this.cache.low = low;
      $('hud').classList.toggle('low', low);
    }

    if (this.frame++ % 3 === 0) this.drawRadar(g);
  }

  drawRadar(g) {
    const c = this.radar;
    const mid = 80, k = 72 / ARENA;
    const dot = (o, color, r) => {
      c.fillStyle = color;
      c.beginPath();
      c.arc(mid + o.x * k, mid + o.z * k, r, 0, 7);
      c.fill();
    };

    c.clearRect(0, 0, 160, 160);
    c.fillStyle = 'rgba(8, 14, 40, 0.55)';
    c.strokeStyle = 'rgba(120, 170, 255, 0.6)';
    c.beginPath();
    c.arc(mid, mid, 73, 0, 7);
    c.fill();
    c.stroke();

    for (const rock of g.world.asteroids) dot(rock, 'rgba(150, 150, 170, 0.5)', rock.radius * k);
    for (const it of g.pickups.items) if (it.kind !== 'gem') dot(it, it.kind === 'heart' ? '#ff4488' : '#ffd24a', 2.5);
    for (const e of g.enemies.list) dot(e, e.type === 'boss' ? '#ff66aa' : e.elite ? '#ffd24a' : '#ff4455', e.type === 'boss' ? 6 : e.elite ? 3 : 2);
    dot(g.player, '#ffffff', 3);
  }
}
