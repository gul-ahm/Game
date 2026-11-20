export class Sfx {
  constructor() {
    this.muted = false;
    this.last = {};
  }

  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.5;
      this.out.connect(this.ctx.destination);
    }
    this.ctx.resume();
  }

  toggle() {
    this.muted = !this.muted;
    if (this.out) this.out.gain.value = this.muted ? 0 : 0.5;
  }

  ready(name, gap) {
    if (!this.ctx || this.muted) return false;
    const t = this.ctx.currentTime;
    if (t - (this.last[name] || 0) < gap) return false;
    this.last[name] = t;
    return true;
  }

  tone(name, from, to, dur, type = 'square', vol = 0.12, gap = 0.04, delay = 0) {
    if (!delay && !this.ready(name, gap)) return;
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    amp.gain.setValueAtTime(vol, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(amp).connect(this.out);
    osc.start(t);
    osc.stop(t + dur);
  }

  noise(name, dur, vol, gap = 0.06) {
    if (!this.ready(name, gap)) return;
    const { ctx } = this;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    src.buffer = buf;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + dur);
    amp.gain.value = vol;
    src.connect(filter).connect(amp).connect(this.out);
    src.start();
  }

  shoot() { this.tone('shoot', 880, 220, 0.09, 'square', 0.05, 0.05); }
  hit() { this.tone('hit', 320, 160, 0.05, 'triangle', 0.08, 0.05); }
  boom(big) { this.noise('boom', big ? 1.2 : 0.35, big ? 0.7 : 0.35); }
  hurt() { this.tone('hurt', 180, 50, 0.3, 'sawtooth', 0.2, 0.2); }
  well() { this.tone('well', 420, 55, 0.6, 'sine', 0.2, 0.3); }
  dash() { this.tone('dash', 200, 900, 0.18, 'sine', 0.15, 0.1); }
  pickup(kind) {
    if (kind === 'gem') this.tone('gem', 900, 1400, 0.06, 'sine', 0.06, 0.03);
    else this.tone('heart', 500, 1000, 0.25, 'triangle', 0.15, 0.1);
  }
  level() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone('lvl', f, f, 0.18, 'triangle', 0.12, 0, i * 0.08 + 0.001));
  }
}
