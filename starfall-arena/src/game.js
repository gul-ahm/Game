import * as THREE from 'three';
import { ARENA, TAU, near, rand } from './config.js';
import { MODES, SECTORS, SHOP, MEDALS, shopCost } from './meta.js';
import { load, store, loadEchoes, storeEcho } from './save.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Enemies } from './enemies.js';
import { BulletPool } from './bullets.js';
import { Particles } from './particles.js';
import { Pickups } from './pickups.js';
import { rollUpgrades } from './upgrades.js';
import { Singularity } from './gravity.js';
import { Echo, Recorder } from './echo.js';

const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1);
const ray = new THREE.Raycaster();

function pickType(wave) {
  const r = Math.random();
  if (wave >= 6 && r < 0.1) return 'splitter';
  if (wave >= 4 && r < 0.22) return 'bomber';
  if (wave >= 3 && r < 0.38) return 'dasher';
  if (wave >= 2 && r < 0.6) return 'shooter';
  return 'drone';
}

export class Game {
  constructor({ scene, camera, hud, input, audio }) {
    Object.assign(this, { scene, camera, hud, input, audio });
    this.world = new World(scene);
    this.particles = new Particles(scene);
    this.shots = new BulletPool(scene, 600, 0x66eeff, 0.3);
    this.bolts = new BulletPool(scene, 800, 0xff5530, 0.45);
    this.pickups = new Pickups(scene);
    this.enemies = new Enemies(scene);
    this.player = new Player(scene);
    this.well = new Singularity(scene);
    this.echoes = [];
    this.aim = new THREE.Vector3(0, 1, 10);
    this.look = new THREE.Vector3();
    this.save = load();
    if (!MODES[this.save.mode] || !this.unlocked(this.save.mode)) this.save.mode = 'normal';
    this.state = 'menu';
    this.reset();
  }

  get mode() {
    return MODES[this.save.mode];
  }

  get combo() {
    return Math.min(8, 1 + Math.floor(this.chain / 5));
  }

  get boss() {
    return this.enemies.list.find(e => e.type === 'boss');
  }

  get sector() {
    return Math.floor(Math.max(0, this.wave - 1) / 5);
  }

  get theme() {
    return SECTORS[this.sector % SECTORS.length];
  }

  get wallet() {
    return this.save.credits + Math.floor(this.earned) - this.banked;
  }

  get rank() {
    const w = this.wave;
    return w >= 16 ? 'S' : w >= 11 ? 'A' : w >= 7 ? 'B' : w >= 4 ? 'C' : 'D';
  }

  unlocked(id) {
    return id !== 'insane' || !!this.save.medals.veteran;
  }

  setMode(id) {
    if (!this.unlocked(id)) return;
    this.save.mode = id;
    store(this.save);
  }

  buy(id) {
    const item = SHOP.find(s => s.id === id);
    const rank = this.save.shop[id] || 0;
    const cost = shopCost(item, rank);
    if (rank >= item.max || this.save.credits < cost) return false;
    this.save.credits -= cost;
    this.save.shop[id] = rank + 1;
    store(this.save);
    return true;
  }

  reset() {
    this.enemies.clear();
    this.shots.clear();
    this.bolts.clear();
    this.pickups.clear();
    this.particles.clear();
    this.world.reset();
    this.world.setTheme(SECTORS[0], true);
    this.player.reset(this.save.shop);
    this.well.reset();
    for (const echo of this.echoes) echo.remove();
    this.echoes = [];
    this.recorder = new Recorder();
    this.time = 0;
    this.score = 0;
    this.kills = 0;
    this.bossKills = 0;
    this.crystals = 0;
    this.cleanWaves = 0;
    this.earned = 0;
    this.banked = 0;
    this.newMedals = [];
    this.wave = 0;
    this.waveLive = false;
    this.wasHit = false;
    this.queue = [];
    this.rest = 1.5;
    this.spawnTimer = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNeed = 6;
    this.offers = [];
    this.choices = [];
    this.build = 0;
    this.chain = 0;
    this.chainTimer = 0;
    this.shake = 0;
    this.slow = 0;
    this.vacuum = 0;
    this.medalTimer = 0;
  }

  setState(state) {
    this.state = state;
    this.hud.setState(state, this);
  }

  start() {
    this.audio.unlock();
    this.reset();
    for (let i = 0; i < (this.save.shop.head || 0); i++) this.offers.push('level');
    this.echoes = loadEchoes()
      .slice(0, 1 + (this.save.shop.echo || 0))
      .map(run => new Echo(this.scene, run));
    this.setState('playing');
    this.offerUpgrade();
  }

  quit() {
    this.keepEcho();
    this.bank();
    this.reset();
    this.setState('menu');
  }

  togglePause() {
    if (this.state === 'playing') this.setState('paused');
    else if (this.state === 'paused') this.setState('playing');
  }

  update(dt) {
    const { input } = this;
    if (input.hit('KeyM')) this.audio.toggle();
    if (input.hit('Escape') || input.hit('KeyP')) this.togglePause();
    if (input.hit('Enter') && (this.state === 'menu' || this.state === 'over')) this.start();
    if (this.state === 'upgrade') {
      for (let i = 0; i < this.choices.length; i++) if (input.hit('Digit' + (i + 1))) this.pick(i);
    }

    if (this.state !== 'paused' && this.state !== 'upgrade') this.world.update(dt);
    if (this.state === 'playing') this.step(dt);
    else if (this.state === 'over') this.particles.update(dt);

    this.moveCamera(dt);
    this.hud.update(this);
    input.endFrame();
  }

  step(dt) {
    if (this.slow > 0) {
      this.slow -= dt;
      dt *= 0.3;
    }
    this.time += dt;
    this.vacuum -= dt;
    ray.setFromCamera(this.input.mouse, this.camera);
    ray.ray.intersectPlane(ground, this.aim);

    this.player.update(dt, this);
    this.recorder.sample(dt, this.player, this.input.mouse.down);
    this.castWell();
    this.runWave(dt);
    this.enemies.update(dt, this);
    this.well.update(dt, this);
    for (const echo of this.echoes) echo.update(dt, this);
    this.echoes = this.echoes.filter(echo => !echo.done);
    this.shots.update(dt);
    this.bolts.update(dt);
    this.collide();
    this.pickups.update(dt, this);
    this.particles.update(dt);

    this.chainTimer -= dt;
    if (this.chainTimer <= 0) this.chain = 0;
    this.medalTimer -= dt;
    if (this.medalTimer <= 0) {
      this.medalTimer = 0.5;
      this.checkMedals();
    }
    if (this.player.hp <= 0) this.gameOver();
  }

  castWell() {
    const { input, well, aim } = this;
    if (well.cool > 0 || !(input.hit('Mouse2') || input.hit('KeyQ'))) return;
    const d = Math.hypot(aim.x, aim.z);
    const fit = Math.min(1, (ARENA - 4) / (d || 1));
    well.cast(aim.x * fit, aim.z * fit, this.player.wellPower);
    this.audio.well();
  }

  keepEcho() {
    if (this.recorder.seconds >= 30) storeEcho({ score: this.score, wave: this.wave, frames: this.recorder.frames });
    this.recorder = new Recorder();
  }

  nextWave() {
    const w = ++this.wave;
    const bossWave = w % 5 === 0;
    const { pace } = this.mode;
    const count = Math.round((bossWave ? 4 + w : 5 + w * 3) * (2 - pace));
    this.queue = bossWave ? ['boss'] : [];
    for (let i = 0; i < count; i++) this.queue.push(pickType(w));
    this.spawnGap = Math.max(0.2, (1.1 - w * 0.05) * pace);
    this.waveLive = true;
    this.wasHit = false;

    if (w % 5 === 1) {
      this.world.setTheme(this.theme);
      this.hud.banner('Sector ' + (this.sector + 1), this.theme.name);
    } else {
      this.hud.banner(bossWave ? 'Warden' : 'Wave ' + w, bossWave ? 'Boss wave' : '');
    }
  }

  waveClear() {
    this.waveLive = false;
    const clean = !this.wasHit && this.wave >= 3;
    if (clean) this.cleanWaves++;
    const bonus = this.earn(this.wave * (clean ? 8 : 4));
    this.hud.toast(clean ? 'Flawless wave' : 'Wave clear', `+${bonus} credits`);
    this.bank();
  }

  runWave(dt) {
    if (!this.queue.length && !this.enemies.list.length) {
      if (this.waveLive) this.waveClear();
      this.rest -= dt;
      if (this.rest <= 0) {
        this.rest = 3;
        this.nextWave();
      }
      return;
    }
    this.spawnTimer -= dt;
    if (this.queue.length && this.spawnTimer <= 0 && this.enemies.list.length < 70) {
      this.spawnTimer = this.spawnGap;
      let x, z;
      do {
        const a = Math.random() * TAU, r = rand(ARENA * 0.5, ARENA - 6);
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
      } while (near({ x, z }, this.player, 35));
      this.spawnAt(this.queue.shift(), x, z);
    }
  }

  spawnAt(type, x, z) {
    const elite = this.wave >= 7 && type !== 'boss' && type !== 'mite' && Math.random() < 0.08;
    this.enemies.spawn(type, x, z, this, elite);
    this.particles.burst(x, z, elite ? 0xffd24a : 0xffffff, elite ? 30 : 14, 12, 0.4);
  }

  collide() {
    const { player, enemies, shots, bolts, world } = this;

    for (const b of shots.items) {
      for (const e of enemies.list) {
        if (e.dead || b.hit === e || !near(b, e, e.radius + 0.5)) continue;
        this.hitEnemy(e, b.damage, b.x, b.z);
        if (b.pierce-- <= 0) {
          b.dead = true;
          break;
        }
        b.hit = e;
      }
      if (b.dead) continue;
      for (const rock of world.asteroids) {
        if (!near(b, rock, rock.radius)) continue;
        b.dead = true;
        this.hitRock(rock, b.damage, b.x, b.z);
        break;
      }
    }

    for (const b of bolts.items) {
      if (near(b, player, 1.3)) {
        b.dead = true;
        this.hurtPlayer(b.damage);
      } else if (world.asteroids.some(rock => near(b, rock, rock.radius))) {
        b.dead = true;
        this.particles.burst(b.x, b.z, 0xff5530, 4, 8, 0.3);
      }
    }

    for (const e of enemies.list) {
      if (e.dead) continue;
      if (near(e, player, e.radius + 1.2)) {
        const d = Math.hypot(e.x - player.x, e.z - player.z) || 1;
        e.vx = ((e.x - player.x) / d) * 30;
        e.vz = ((e.z - player.z) / d) * 30;
        if (e.type === 'dasher') {
          e.phase = 0;
          e.timer = 1.4;
        }
        this.hurtPlayer(e.dmg);
      }
      if (e.orbCd <= 0) {
        for (const orb of player.orbMeshes) {
          if (!near(e, orb.position, e.radius + 0.9)) continue;
          e.orbCd = 0.35;
          this.hitEnemy(e, player.damage * 1.2, orb.position.x, orb.position.z);
          break;
        }
      }
      if (e.type !== 'boss') for (const rock of world.asteroids) this.pushOut(e, rock, e.radius);
    }

    for (const rock of world.asteroids) this.pushOut(player, rock, 1.2);
  }

  pushOut(body, rock, radius) {
    const gap = rock.radius + radius;
    if (!near(body, rock, gap)) return;
    const dx = body.x - rock.x, dz = body.z - rock.z;
    const d = Math.hypot(dx, dz) || 1;
    body.x = rock.x + (dx / d) * gap;
    body.z = rock.z + (dz / d) * gap;
  }

  hurtPlayer(amount) {
    if (!this.player.hurt(amount)) return;
    this.wasHit = true;
    this.shake = Math.min(1, this.shake + 0.5);
    this.audio.hurt();
    this.hud.flash();
    this.particles.burst(this.player.x, this.player.z, 0xff8866, 16, 18, 0.5);
  }

  hitEnemy(e, damage, x, z) {
    if (e.dead) return;
    e.hp -= damage;
    e.flash = Math.max(e.flash, 0.08);
    this.particles.burst(x, z, e.color, 4, 10, 0.3);
    this.audio.hit();
    if (e.hp <= 0) this.kill(e);
  }

  kill(e) {
    const { player, pickups } = this;
    const big = e.type === 'boss';
    e.dead = true;
    this.kills++;
    this.chain++;
    this.chainTimer = 2.5;
    this.score += Math.round(e.score * this.combo * this.mode.score);
    this.earn(e.score / 10);
    this.shake = Math.min(1, this.shake + (big ? 1 : 0.15));
    this.particles.burst(e.x, e.z, e.color, big ? 400 : 26, big ? 60 : 22, big ? 1.6 : 0.7);
    this.particles.burst(e.x, e.z, 0xffffff, big ? 80 : 8, big ? 30 : 12, 0.4);
    this.audio.boom(big);
    player.heal(player.leech);
    pickups.drop('gem', e.x, e.z, e.xp);

    if (big) {
      this.bossKills++;
      this.slow = 1.2;
      this.bolts.clear();
      pickups.drop('heart', e.x, e.z);
      this.hud.toast('Warden destroyed', `+${this.earn(100)} credits`);
      this.offers.push('relic');
    } else if (e.elite || Math.random() < 0.025) {
      pickups.drop('power', e.x, e.z);
    } else if (Math.random() < 0.06) {
      pickups.drop('heart', e.x, e.z);
    }

    if (e.type === 'bomber') {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        this.bolts.spawn(e.x, e.z, Math.sin(a) * 18, Math.cos(a) * 18, 10 * this.mode.dmg, 4);
      }
    }
    if (e.type === 'splitter') {
      for (let i = 0; i < 3; i++) this.spawnAt('mite', e.x + rand(-2, 2), e.z + rand(-2, 2));
    }
    if (player.blast) {
      this.particles.burst(e.x, e.z, 0xffaa33, 30, 30, 0.4);
      for (const other of this.enemies.list) {
        if (near(other, e, e.radius + 7)) this.hitEnemy(other, player.damage * 1.5 * player.blast, other.x, other.z);
      }
    }
    if (big && this.state === 'playing') this.offerUpgrade();
  }

  hitRock(rock, damage, x, z) {
    rock.hp -= damage;
    this.particles.burst(x, z, 0xaaa4b8, 4, 8, 0.4);
    if (rock.hp > 0) return;
    this.particles.burst(rock.x, rock.z, 0xaaa4b8, 40, 20, 0.9);
    this.audio.boom(false);
    this.pickups.drop('gem', rock.x, rock.z, Math.ceil(rock.radius / 2));
    if (Math.random() < 0.12) this.pickups.drop('power', rock.x, rock.z);
    this.score += 5;
    this.world.placeRock(rock);
  }

  collect(kind) {
    this.audio.pickup(kind);
    if (kind === 'gem') {
      this.crystals++;
      this.addXp(this.player.gemValue);
    } else if (kind === 'heart') {
      this.player.heal(25);
    } else {
      this.powerUp();
    }
  }

  powerUp() {
    const p = this.player;
    const roll = Math.floor(Math.random() * 3);
    if (roll === 0) {
      p.overdrive = 8;
      this.hud.toast('Overdrive', 'Double fire rate for 8 seconds');
    } else if (roll === 1) {
      this.vacuum = 4;
      this.hud.toast('Tractor Pulse', 'All crystals fly to you');
    } else {
      this.bolts.clear();
      this.shake = 1;
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * TAU;
        this.particles.spawn(p.x, 1, p.z, Math.cos(a) * 80, 0, Math.sin(a) * 80, 0xffd24a, 0.8);
      }
      for (const e of this.enemies.list) this.hitEnemy(e, 50 + this.wave * 10, e.x, e.z);
      this.audio.boom(true);
      this.hud.toast('Shockwave', 'Every enemy takes damage');
    }
  }

  earn(amount) {
    const got = amount * this.mode.credits * (1 + 0.1 * (this.save.shop.scanner || 0));
    this.earned += got;
    return Math.round(got);
  }

  bank() {
    const whole = Math.floor(this.earned);
    this.save.credits += whole - this.banked;
    this.banked = whole;
    store(this.save);
  }

  checkMedals() {
    for (const medal of MEDALS) {
      if (this.save.medals[medal.id] || !medal.test(this)) continue;
      this.save.medals[medal.id] = true;
      this.save.credits += medal.reward;
      this.newMedals.push(medal);
      this.hud.toast('Medal: ' + medal.name, `+${medal.reward} credits`);
      this.audio.level();
      store(this.save);
    }
  }

  addXp(n) {
    this.xp += n;
    while (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.xpNeed = Math.floor(this.xpNeed * 1.22 + 3);
      this.level++;
      this.offers.push('level');
    }
    if (this.state === 'playing') this.offerUpgrade();
  }

  offerUpgrade() {
    while (this.offers.length) {
      this.choices = rollUpgrades(this.player, 3, this.offers[0]);
      if (this.choices.length) {
        this.audio.level();
        return this.setState('upgrade');
      }
      this.offers.shift();
    }
    if (this.state !== 'playing') this.setState('playing');
  }

  pick(i) {
    const upgrade = this.choices[i];
    if (!upgrade || this.state !== 'upgrade') return;
    const p = this.player;
    upgrade.apply(p);
    p.taken[upgrade.id] = (p.taken[upgrade.id] || 0) + 1;
    this.build++;
    this.offers.shift();
    this.state = 'picked';
    this.offerUpgrade();
  }

  gameOver() {
    const p = this.player;
    const id = this.save.mode;
    p.mesh.visible = false;
    for (const orb of p.orbMeshes) orb.visible = false;
    this.particles.burst(p.x, p.z, 0x55ccff, 200, 45, 1.5);
    this.audio.boom(true);
    this.shake = 1;
    this.checkMedals();
    this.keepEcho();
    this.newBest = this.score > (this.save.best[id] || 0);
    if (this.newBest) this.save.best[id] = this.score;
    this.bank();
    this.setState('over');
  }

  moveCamera(dt) {
    const { camera, look } = this;
    if (this.state === 'menu') {
      const a = this.world.t * 0.12;
      camera.position.set(Math.sin(a) * 46, 26, Math.cos(a) * 46);
      camera.lookAt(0, 0, 0);
      look.set(0, 0, 0);
      return;
    }

    const p = this.player;
    const k = 1 - Math.exp(-dt * 5);
    const leadX = THREE.MathUtils.clamp((this.aim.x - p.x) * 0.15, -6, 6);
    const leadZ = THREE.MathUtils.clamp((this.aim.z - p.z) * 0.15, -6, 6);
    look.x += (p.x + leadX - look.x) * k;
    look.z += (p.z + leadZ - look.z) * k;

    if (this.state !== 'paused' && this.state !== 'upgrade') this.shake = Math.max(0, this.shake - dt * 2.2);
    const s = this.shake * this.shake * 1.6;
    camera.position.set(look.x + rand(-s, s), 54 + rand(-s, s), look.z + 36 + rand(-s, s));
    camera.lookAt(look.x, 0, look.z);
  }
}
