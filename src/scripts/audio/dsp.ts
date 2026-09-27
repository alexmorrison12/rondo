/**
 * Offline DSP: every sound Rondo makes is synthesised here into small mono buffers.
 * No samples are downloaded. Pure functions of (sampleRate, parameters) so the live engine
 * and the WAV exporter produce identical audio.
 */

const TWO_PI = Math.PI * 2;

class Biquad {
  private b0 = 0;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(type: 'lowpass' | 'highpass' | 'bandpass', freq: number, q: number, sr: number) {
    const w0 = (TWO_PI * Math.min(freq, sr * 0.45)) / sr;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    let b0: number, b1: number, b2: number;
    if (type === 'lowpass') {
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = (1 - cos) / 2;
    } else if (type === 'highpass') {
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = (1 + cos) / 2;
    } else {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    }
    const a0 = 1 + alpha;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  process(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

function normalise(buf: Float32Array, peak = 0.85): Float32Array {
  let max = 0;
  for (let i = 0; i < buf.length; i++) max = Math.max(max, Math.abs(buf[i]!));
  if (max > 0) {
    const g = peak / max;
    for (let i = 0; i < buf.length; i++) buf[i]! *= g;
  }
  return buf;
}

function fadeOut(buf: Float32Array, sr: number, seconds = 0.05) {
  const n = Math.min(buf.length, Math.floor(sr * seconds));
  for (let i = 0; i < n; i++) buf[buf.length - 1 - i]! *= i / n;
}

/** Karplus–Strong plucked string with allpass fine-tuning and pitch-dependent decay. */
export function renderPluck(sr: number, freq: number, midi: number): Float32Array {
  const t60 = 3.2 - Math.min(1, Math.max(0, (midi - 40) / 48)) * 2.3;
  const dur = Math.min(3, t60 + 0.3);
  const len = Math.floor(sr * dur);
  const out = new Float32Array(len);
  const period = sr / freq;
  const N = Math.max(2, Math.floor(period - 0.5 - 0.15));
  const frac = period - 0.5 - N;
  const C = (1 - frac) / (1 + frac);
  const loopGain = Math.pow(0.001, 1 / (t60 * freq));
  const line = new Float32Array(N);
  // Excitation: filtered noise, brighter for higher notes, with a pick-position comb.
  const bright = 0.35 + Math.min(0.5, (midi - 36) / 80);
  let lp = 0;
  for (let i = 0; i < N; i++) {
    lp += (Math.random() * 2 - 1 - lp) * bright;
    line[i] = lp;
  }
  const pick = Math.max(1, Math.floor(N * 0.13));
  for (let i = N - 1; i >= pick; i--) line[i]! -= line[i - pick]! * 0.6;

  let w = 0;
  let prev = 0;
  let apX1 = 0;
  let apY1 = 0;
  for (let n = 0; n < len; n++) {
    const x = line[w]!;
    const avg = (x + prev) * 0.5 * loopGain;
    prev = x;
    const ap = C * avg + apX1 - C * apY1;
    apX1 = avg;
    apY1 = ap;
    line[w] = ap;
    w = w + 1 === N ? 0 : w + 1;
    out[n] = x;
  }
  fadeOut(out, sr, 0.08);
  return normalise(out, 0.8);
}

/** Two-operator FM bell with an inharmonic shimmer partial: "Glass". */
export function renderGlass(sr: number, freq: number): Float32Array {
  const dur = 3.2;
  const len = Math.floor(sr * dur);
  const out = new Float32Array(len);
  const incC = (TWO_PI * freq) / sr;
  const incM = (TWO_PI * freq * 3.5) / sr;
  const incS = (TWO_PI * freq * 2.756) / sr;
  let pc = 0;
  let pm = 0;
  let ps = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const index = 2.2 * Math.exp(-t * 8) + 0.22;
    const env = (1 - Math.exp(-t * 500)) * Math.exp(-t * 1.6);
    const shimmer = 0.18 * Math.sin(ps) * Math.exp(-t * 4);
    out[i] = (Math.sin(pc + index * Math.sin(pm)) + shimmer) * env;
    pc += incC;
    pm += incM;
    ps += incS;
    if (pc > TWO_PI) pc -= TWO_PI;
    if (pm > TWO_PI) pm -= TWO_PI;
    if (ps > TWO_PI) ps -= TWO_PI;
  }
  fadeOut(out, sr, 0.1);
  return normalise(out, 0.7);
}

/* ── The "Dust" kit ─────────────────────────────────────────────── */

const noise = () => Math.random() * 2 - 1;

function kick(sr: number) {
  const len = Math.floor(sr * 0.55);
  const out = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const f = 46 + 130 * Math.exp(-t * 32) + 24 * Math.exp(-t * 5);
    ph += (TWO_PI * f) / sr;
    const body = Math.sin(ph) * Math.exp(-t * 6.5);
    const click = noise() * Math.exp(-t * 320) * 0.25;
    out[i] = Math.tanh((body + click) * 1.5);
  }
  return normalise(out, 0.95);
}

function snare(sr: number) {
  const len = Math.floor(sr * 0.32);
  const out = new Float32Array(len);
  const hp = new Biquad('highpass', 1400, 0.7, sr);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const tone = (Math.sin(TWO_PI * 185 * t) * 0.6 + Math.sin(TWO_PI * 330 * t) * 0.25) * Math.exp(-t * 24);
    const nz = hp.process(noise()) * Math.exp(-t * 15) * 0.8;
    out[i] = Math.tanh(tone + nz);
  }
  return normalise(out, 0.8);
}

function clap(sr: number) {
  const len = Math.floor(sr * 0.38);
  const out = new Float32Array(len);
  const bp = new Biquad('bandpass', 1150, 1.1, sr);
  const bursts = [0, 0.011, 0.023];
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let env = 0;
    for (const b of bursts) if (t >= b) env += Math.exp(-(t - b) * 190);
    if (t >= 0.031) env += 0.8 * Math.exp(-(t - 0.031) * 15);
    out[i] = bp.process(noise()) * env;
  }
  return normalise(out, 0.75);
}

function metallic(sr: number, decay: number, seconds: number) {
  const len = Math.floor(sr * seconds);
  const out = new Float32Array(len);
  const freqs = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => f * 1.7);
  const hp = new Biquad('highpass', 7000, 0.8, sr);
  const hp2 = new Biquad('highpass', 8500, 0.7, sr);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let sq = 0;
    for (const f of freqs) sq += Math.sign(Math.sin(TWO_PI * f * t));
    const env = Math.exp(-t * decay);
    out[i] = (hp.process(sq / 6) * 0.7 + hp2.process(noise()) * 0.5) * env;
  }
  return normalise(out, 0.55);
}

function rim(sr: number) {
  const len = Math.floor(sr * 0.08);
  const out = new Float32Array(len);
  const bp = new Biquad('bandpass', 2400, 2, sr);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    out[i] = Math.sin(TWO_PI * 1720 * t) * Math.exp(-t * 95) * 0.7 + bp.process(noise()) * Math.exp(-t * 420);
  }
  return normalise(out, 0.6);
}

function shaker(sr: number) {
  const len = Math.floor(sr * 0.15);
  const out = new Float32Array(len);
  const hp = new Biquad('highpass', 5200, 0.9, sr);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = t < 0.018 ? t / 0.018 : Math.exp(-(t - 0.018) * 32);
    out[i] = hp.process(noise()) * env;
  }
  return normalise(out, 0.45);
}

function tom(sr: number) {
  const len = Math.floor(sr * 0.45);
  const out = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const f = 98 + 62 * Math.exp(-t * 14);
    ph += (TWO_PI * f) / sr;
    out[i] = Math.sin(ph) * Math.exp(-t * 7.5) + noise() * Math.exp(-t * 200) * 0.1;
  }
  return normalise(out, 0.8);
}

function wood(sr: number) {
  const len = Math.floor(sr * 0.12);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    out[i] = Math.sin(TWO_PI * 880 * t) * Math.exp(-t * 48) + Math.sin(TWO_PI * 1777 * t) * Math.exp(-t * 75) * 0.35;
  }
  return normalise(out, 0.6);
}

/** Voice order matches DRUM_VOICES in seq/model.ts. */
export function renderKit(sr: number): Float32Array[] {
  return [
    kick(sr),
    snare(sr),
    clap(sr),
    metallic(sr, 55, 0.12),
    metallic(sr, 8, 0.5),
    rim(sr),
    shaker(sr),
    tom(sr),
    wood(sr),
  ];
}

/** Stereo reverb impulse: decaying noise with air absorption and a short pre-delay. */
export function renderImpulse(sr: number, seconds = 2.8): [Float32Array, Float32Array] {
  const len = Math.floor(sr * seconds);
  const pre = Math.floor(sr * 0.014);
  const chans: [Float32Array, Float32Array] = [new Float32Array(len), new Float32Array(len)];
  for (const ch of chans) {
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / (len - pre);
      const coeff = 0.9 - t * 0.75; // darker as it decays
      lp += (noise() - lp) * coeff;
      ch[i] = lp * Math.pow(1 - t, 3.4);
    }
  }
  return chans;
}
