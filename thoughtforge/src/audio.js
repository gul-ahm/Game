const NOTES = { tap: 880, line: 660, circle: 523, triangle: 392, square: 440, zigzag: 784 };

export class Sfx {
  constructor() {
    this.muted = false;
    this.last = {};
  }

  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.45;
      this.out.connect(this.ctx.destination);
    }
    this.ctx.resume();
  }

  toggle() {
    this.muted = !this.muted;
    if (this.out) this.out.gain.value = this.muted ? 0 : 0.45;
  }

  ready(name, gap) {
    if (!this.ctx || this.muted) return false;
    const t = this.ctx.currentTime;
    if (t - (this.last[name] || 0) < gap) return false;
    this.last[name] = t;
    return true;
  }

  tone(from, to, dur, type = 'sine', vol = 0.12, delay = 0) {
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

  noise(dur, vol, cutoff = 1800) {
    const { ctx } = this;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    src.buffer = buf;
    filter.frequency.setValueAtTime(cutoff, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + dur);
    amp.gain.value = vol;
    src.connect(filter).connect(amp).connect(this.out);
    src.start();
  }

  forge(shape) {
    if (!this.ready('forge', 0.05)) return;
    const f = NOTES[shape];
    [1, 1.25, 1.5].forEach((k, i) => this.tone(f * k, f * k * 1.01, 0.35, 'triangle', 0.07, i * 0.035));
  }

  fizzle() {
    if (this.ready('fizzle', 0.2)) this.tone(300, 90, 0.25, 'sawtooth', 0.08);
  }

  hit() {
    if (this.ready('hit', 0.05)) this.tone(260, 120, 0.07, 'square', 0.06);
  }

  slam() {
    if (!this.ready('slam', 0.1)) return;
    this.noise(0.9, 0.8, 900);
    this.tone(110, 35, 0.6, 'sine', 0.35);
  }

  zap() {
    if (this.ready('zap', 0.08)) this.noise(0.25, 0.4, 6000);
  }

  hurt() {
    if (this.ready('hurt', 0.2)) this.tone(200, 60, 0.3, 'sawtooth', 0.18);
  }

  jump() {
    if (this.ready('jump', 0.1)) this.tone(300, 520, 0.12, 'sine', 0.06);
  }

  pop() {
    if (this.ready('pop', 0.06)) this.noise(0.35, 0.35, 1500);
  }

  chime() {
    if (!this.ready('chime', 0.1)) return;
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.2, 'triangle', 0.1, i * 0.07));
  }
}
