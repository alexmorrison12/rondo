/**
 * The Rondo sound engine.
 *
 * - Lookahead scheduling ("a tale of two clocks"): a 25 ms JS timer schedules notes ~120 ms
 *   ahead on the sample-accurate audio clock, so timing never depends on the main thread.
 * - Polymeter: every ring advances one sixteenth per step and wraps at its own length.
 * - Voices are either pre-rendered buffers (pluck, glass, drums) or short-lived node graphs
 *   (sub, tape). The same code renders offline for WAV export.
 */
import { audioContext, markPlaying, masterInput } from '../core/sound';
import { driftRing } from '../seq/generate';
import { RINGS, clonePattern, slotAt, type EngineId, type Pattern } from '../seq/model';
import { degreeToMidi, midiToFreq, scaleById } from '../seq/scales';
import { renderGlass, renderImpulse, renderKit, renderPluck } from './dsp';

export interface Hit {
  ring: number;
  slot: number;
  time: number;
}

/** Context-bound voice bank: caches rendered buffers per note, plays any engine. */
class Voices {
  private cache = new Map<string, AudioBuffer>();
  private kit: AudioBuffer[] | null = null;
  constructor(private ctx: BaseAudioContext) {}

  private buffer(key: string, render: () => Float32Array): AudioBuffer {
    let buf = this.cache.get(key);
    if (!buf) {
      const data = render();
      buf = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
      buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      this.cache.set(key, buf);
    }
    return buf;
  }

  private drums(): AudioBuffer[] {
    if (!this.kit) {
      this.kit = renderKit(this.ctx.sampleRate).map((d) => {
        const b = this.ctx.createBuffer(1, d.length, this.ctx.sampleRate);
        b.copyToChannel(d as Float32Array<ArrayBuffer>, 0);
        return b;
      });
    }
    return this.kit;
  }

  private playBuffer(buf: AudioBuffer, dest: AudioNode, t: number, gain: number, pan: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(g).connect(p).connect(dest);
    src.start(t);
  }

  prewarm(engine: EngineId, midis: number[]) {
    if (engine === 'dust') this.drums();
    for (const m of midis) {
      if (engine === 'pluck') this.buffer(`p${m}`, () => renderPluck(this.ctx.sampleRate, midiToFreq(m), m));
      if (engine === 'glass') this.buffer(`g${m}`, () => renderGlass(this.ctx.sampleRate, midiToFreq(m)));
    }
  }

  play(engine: EngineId, notes: number[], drumVoice: number, t: number, dur: number, dest: AudioNode, pan: number, vel = 1) {
    const c = this.ctx;
    switch (engine) {
      case 'dust': {
        const kit = this.drums();
        const buf = kit[((drumVoice % kit.length) + kit.length) % kit.length]!;
        this.playBuffer(buf, dest, t, 0.9 * vel, pan * 0.4);
        return;
      }
      case 'pluck':
        notes.forEach((m, i) =>
          this.playBuffer(
            this.buffer(`p${m}`, () => renderPluck(c.sampleRate, midiToFreq(m), m)),
            dest,
            t + i * 0.014,
            (0.75 * vel) / Math.sqrt(notes.length),
            pan + (i - (notes.length - 1) / 2) * 0.25,
          ),
        );
        return;
      case 'glass':
        notes.forEach((m, i) =>
          this.playBuffer(
            this.buffer(`g${m}`, () => renderGlass(c.sampleRate, midiToFreq(m))),
            dest,
            t,
            (0.55 * vel) / Math.sqrt(notes.length),
            pan + (i - (notes.length - 1) / 2) * 0.3,
          ),
        );
        return;
      case 'sub':
        notes.forEach((m) => this.sub(midiToFreq(m), t, dur, dest, vel / Math.sqrt(notes.length)));
        return;
      case 'tape':
        notes.forEach((m, i) =>
          this.tape(midiToFreq(m), t, dur, dest, (0.5 * vel) / Math.sqrt(notes.length), (i - (notes.length - 1) / 2) * 0.35),
        );
        return;
    }
  }

  /** Round plucky bass: saw through a closing low-pass, plus a sine for weight. */
  private sub(freq: number, t: number, dur: number, dest: AudioNode, vel: number) {
    const c = this.ctx;
    const saw = c.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = freq;
    const sine = c.createOscillator();
    sine.type = 'sine';
    sine.frequency.value = freq;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 7;
    lp.frequency.setValueAtTime(1600, t);
    lp.frequency.exponentialRampToValueAtTime(240, t + 0.22);
    const sawG = c.createGain();
    sawG.gain.value = 0.35;
    const g = c.createGain();
    const end = t + Math.max(0.12, dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.75 * vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.45 * vel, t + 0.18);
    g.gain.setValueAtTime(0.45 * vel, end);
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.09);
    saw.connect(lp).connect(sawG).connect(g);
    sine.connect(g);
    g.connect(dest);
    saw.start(t);
    sine.start(t);
    saw.stop(end + 0.12);
    sine.stop(end + 0.12);
  }

  /** Warm chord voice with slow wow: two detuned oscillators through a soft low-pass. */
  private tape(freq: number, t: number, dur: number, dest: AudioNode, vel: number, pan: number) {
    const c = this.ctx;
    const a = c.createOscillator();
    a.type = 'sawtooth';
    a.frequency.value = freq;
    a.detune.value = -7;
    const b = c.createOscillator();
    b.type = 'triangle';
    b.frequency.value = freq;
    b.detune.value = 6;
    const wow = c.createOscillator();
    wow.frequency.value = 0.9;
    const wowDepth = c.createGain();
    wowDepth.gain.value = 5;
    wow.connect(wowDepth);
    wowDepth.connect(a.detune);
    wowDepth.connect(b.detune);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(2600, t + 0.08);
    lp.frequency.exponentialRampToValueAtTime(1200, t + 0.9);
    const g = c.createGain();
    const end = t + Math.max(0.3, dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.03);
    g.gain.exponentialRampToValueAtTime(vel * 0.45, t + 0.7);
    g.gain.setValueAtTime(vel * 0.45, end);
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.45);
    const p = c.createStereoPanner();
    p.pan.value = pan;
    a.connect(lp);
    b.connect(lp);
    lp.connect(g).connect(p).connect(dest);
    const stop = end + 0.5;
    [a, b, wow].forEach((o) => {
      o.start(t);
      o.stop(stop);
    });
  }
}

/** Master effects: tilt filter → dry + reverb + tempo-synced echo. */
function buildChain(ctx: BaseAudioContext, dest: AudioNode) {
  const input = ctx.createGain();
  input.gain.value = 0.8;
  const tilt = ctx.createBiquadFilter();
  tilt.type = 'lowpass';
  tilt.frequency.value = 18000;
  tilt.Q.value = 0.9;
  const out = ctx.createGain();
  const reverb = ctx.createConvolver();
  const [l, r] = renderImpulse(ctx.sampleRate);
  const ir = ctx.createBuffer(2, l.length, ctx.sampleRate);
  ir.copyToChannel(l as Float32Array<ArrayBuffer>, 0);
  ir.copyToChannel(r as Float32Array<ArrayBuffer>, 1);
  reverb.buffer = ir;
  const reverbSend = ctx.createGain();
  reverbSend.gain.value = 0.35;
  const delay = ctx.createDelay(2);
  const feedback = ctx.createGain();
  feedback.gain.value = 0.28;
  const delayTone = ctx.createBiquadFilter();
  delayTone.type = 'lowpass';
  delayTone.frequency.value = 2400;
  const delaySend = ctx.createGain();
  delaySend.gain.value = 0.12;

  input.connect(tilt);
  tilt.connect(out);
  tilt.connect(reverbSend).connect(reverb).connect(out);
  tilt.connect(delaySend).connect(delay);
  delay.connect(delayTone).connect(feedback).connect(delay);
  delayTone.connect(out);
  out.connect(dest);
  return { input, tilt, out, reverbSend, delay, delaySend, feedback };
}

type Chain = ReturnType<typeof buildChain>;

function ringNotes(p: Pattern, ringIndex: number, note: number): { midis: number[]; drum: number } {
  const ring = p.rings[ringIndex]!;
  if (ring.engine === 'dust') return { midis: [], drum: note };
  const meta = RINGS[ringIndex]!;
  const scale = scaleById(p.scale);
  const octave = ring.engine === 'sub' ? Math.min(meta.octave, 2) : ring.engine === 'glass' ? Math.max(meta.octave, 3) : meta.octave;
  const degrees = meta.chords ? [note, note + 2, note + 4] : [note];
  return { midis: degrees.map((d) => degreeToMidi(d, scale, p.key, octave)), drum: 0 };
}

function stepSeconds(bpm: number) {
  return 60 / bpm / 4;
}

function noteDuration(p: Pattern, ringIndex: number): number {
  const step = stepSeconds(p.bpm);
  const ring = p.rings[ringIndex]!;
  if (ring.engine === 'tape') return step * (RINGS[ringIndex]!.chords ? 3.6 : 2.2);
  if (ring.engine === 'sub') return step * 1.6;
  return step;
}

export class RondoEngine {
  readonly ctx: AudioContext;
  readonly analyser: AnalyserNode;
  pattern: Pattern;
  playing = false;

  private voices: Voices;
  private chain: Chain;
  private ringBus: GainNode[];
  private timer = 0;
  private anchorTime = 0;
  private anchorStep = 0;
  private nextStep = 0;
  private pausedStep = 0;
  private hits: Hit[] = [];
  private changeListeners = new Set<(p: Pattern) => void>();
  private stateListeners = new Set<(playing: boolean) => void>();
  private levelData: Float32Array<ArrayBuffer>;

  constructor(pattern: Pattern) {
    this.ctx = audioContext();
    this.pattern = pattern;
    this.voices = new Voices(this.ctx);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.6;
    this.levelData = new Float32Array(this.analyser.fftSize);
    this.chain = buildChain(this.ctx, this.analyser);
    this.analyser.connect(masterInput());
    this.ringBus = RINGS.map(() => {
      const g = this.ctx.createGain();
      g.connect(this.chain.input);
      return g;
    });
    this.applyMix();
    this.prewarm();
  }

  get stepDuration() {
    return stepSeconds(this.pattern.bpm);
  }

  /** Current position in (fractional) sixteenth steps on the audio clock. */
  stepFloat(): number {
    if (!this.playing) return this.pausedStep;
    return this.anchorStep + (this.ctx.currentTime - this.anchorTime) / this.stepDuration;
  }

  /** Swap the loop. By default it continues from the current position; `keepPosition: false` starts it from the top. */
  setPattern(p: Pattern, { keepPosition = true } = {}) {
    const pos = this.stepFloat();
    this.pattern = p;
    if (this.playing && keepPosition) {
      this.anchorStep = pos;
      this.anchorTime = this.ctx.currentTime;
      // Steps inside the lookahead window are already scheduled: never schedule them twice.
      this.nextStep = Math.max(this.nextStep, Math.ceil(pos));
    } else if (this.playing) {
      this.anchorStep = 0;
      this.anchorTime = this.ctx.currentTime + 0.04;
      this.nextStep = 0;
    } else if (!keepPosition) {
      this.pausedStep = 0;
    }
    this.applyMix();
    this.prewarm();
    this.emitChange();
  }

  /** Call after mutating `pattern` in place. */
  update() {
    this.applyMix();
    this.emitChange();
  }

  setBpm(bpm: number) {
    const pos = this.stepFloat();
    this.pattern.bpm = Math.round(Math.min(180, Math.max(50, bpm)));
    if (this.playing) {
      this.anchorStep = pos;
      this.anchorTime = this.ctx.currentTime;
    }
    this.applyMix();
    this.emitChange();
  }

  /** Tilt: x (−1…1) opens the echo, y (−1…1) opens the filter. */
  setTilt(x: number, y: number) {
    const t = this.ctx.currentTime;
    const cutoff = 500 * Math.pow(36, (y + 1) / 2);
    this.chain.tilt.frequency.setTargetAtTime(cutoff, t, 0.05);
    this.chain.delaySend.gain.setTargetAtTime(0.08 + Math.max(0, x) * 0.3, t, 0.08);
  }

  async start() {
    if (this.playing) return;
    if (this.ctx.state !== 'running') await this.ctx.resume();
    this.playing = true;
    this.anchorTime = this.ctx.currentTime + 0.05;
    this.anchorStep = Math.ceil(this.pausedStep);
    this.nextStep = this.anchorStep;
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 25);
    markPlaying(true);
    this.stateListeners.forEach((l) => l(true));
  }

  stop() {
    if (!this.playing) return;
    this.pausedStep = this.stepFloat();
    this.playing = false;
    window.clearInterval(this.timer);
    markPlaying(false);
    this.stateListeners.forEach((l) => l(false));
  }

  toggle() {
    return this.playing ? (this.stop(), Promise.resolve()) : this.start();
  }

  /** Audition a single note right now (tapping a ring while stopped). */
  audition(ringIndex: number, note: number) {
    if (this.ctx.state !== 'running') return;
    const { midis, drum } = ringNotes(this.pattern, ringIndex, note);
    const ring = this.pattern.rings[ringIndex]!;
    this.voices.play(ring.engine, midis, drum, this.ctx.currentTime + 0.01, noteDuration(this.pattern, ringIndex), this.ringBus[ringIndex]!, 0);
  }

  /** Hits within the last `window` seconds, for LED flashes. */
  recentHits(window = 0.3): Hit[] {
    const now = this.ctx.currentTime;
    return this.hits.filter((h) => h.time <= now && now - h.time < window);
  }

  /** RMS output level 0…1 (for audio-reactive visuals). */
  level(): number {
    this.analyser.getFloatTimeDomainData(this.levelData);
    let sum = 0;
    for (let i = 0; i < this.levelData.length; i++) sum += this.levelData[i]! ** 2;
    return Math.min(1, Math.sqrt(sum / this.levelData.length) * 3.2);
  }

  onChange(fn: (p: Pattern) => void) {
    this.changeListeners.add(fn);
    return () => this.changeListeners.delete(fn);
  }

  onState(fn: (playing: boolean) => void) {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  private emitChange() {
    this.changeListeners.forEach((l) => l(this.pattern));
  }

  private applyMix() {
    const t = this.ctx.currentTime;
    this.pattern.rings.forEach((r, i) => {
      this.ringBus[i]!.gain.setTargetAtTime(r.mute ? 0 : r.volume, t, 0.02);
    });
    this.chain.reverbSend.gain.setTargetAtTime(this.pattern.space * 0.7, t, 0.05);
    this.chain.delay.delayTime.setTargetAtTime(this.stepDuration * 3, t, 0.05);
  }

  private prewarm() {
    const p = this.pattern;
    p.rings.forEach((r, i) => {
      const midis = new Set<number>();
      r.notes.slice(0, r.steps).forEach((n) => n >= 0 && ringNotes(p, i, n).midis.forEach((m) => midis.add(m)));
      this.voices.prewarm(r.engine, [...midis]);
    });
  }

  private timeOfStep(step: number) {
    const base = this.anchorTime + (step - this.anchorStep) * this.stepDuration;
    return step % 2 === 1 ? base + this.pattern.swing * this.stepDuration * 0.66 : base;
  }

  private tick() {
    const horizon = this.ctx.currentTime + 0.12;
    let guard = 0;
    while (this.timeOfStep(this.nextStep) < horizon && guard++ < 64) {
      this.scheduleStep(this.nextStep, this.timeOfStep(this.nextStep));
      this.nextStep++;
    }
    const cutoff = this.ctx.currentTime - 1;
    if (this.hits.length > 96) this.hits = this.hits.filter((h) => h.time > cutoff);
  }

  private scheduleStep(step: number, t: number) {
    const p = this.pattern;
    let mutated = false;
    p.rings.forEach((ring, i) => {
      const slot = slotAt(ring, step);
      if (slot === 0 && step > 0 && p.drift > 0 && Math.random() < p.drift * 0.35) {
        mutated = driftRing(p, i) || mutated;
      }
      if (ring.mute) return;
      const note = ring.notes[slot]!;
      if (note < 0) return;
      const { midis, drum } = ringNotes(p, i, note);
      const pan = i === 3 ? (slot % 2 ? 0.28 : -0.28) : 0;
      const vel = 0.9 + Math.random() * 0.1;
      this.voices.play(ring.engine, midis, drum, Math.max(t, this.ctx.currentTime), noteDuration(p, i), this.ringBus[i]!, pan, vel);
      this.hits.push({ ring: i, slot, time: t });
    });
    if (mutated) {
      this.prewarm();
      this.emitChange();
    }
  }
}

/** Render `bars` of a loop offline (no drift) for WAV export. */
export async function renderLoop(pattern: Pattern, bars = 4, sampleRate = 44100): Promise<AudioBuffer> {
  const p = clonePattern(pattern);
  const step = stepSeconds(p.bpm);
  const steps = bars * 16;
  const tail = 2.5;
  const ctx = new OfflineAudioContext(2, Math.ceil((steps * step + tail) * sampleRate), sampleRate);
  const voices = new Voices(ctx);
  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -4;
  master.ratio.value = 12;
  master.connect(ctx.destination);
  const chain = buildChain(ctx, master);
  chain.reverbSend.gain.value = p.space * 0.7;
  chain.delay.delayTime.value = step * 3;
  const buses = p.rings.map((r) => {
    const g = ctx.createGain();
    g.gain.value = r.mute ? 0 : r.volume;
    g.connect(chain.input);
    return g;
  });
  for (let s = 0; s < steps; s++) {
    const t = 0.02 + s * step + (s % 2 === 1 ? p.swing * step * 0.66 : 0);
    p.rings.forEach((ring, i) => {
      if (ring.mute) return;
      const note = ring.notes[slotAt(ring, s)]!;
      if (note < 0) return;
      const { midis, drum } = ringNotes(p, i, note);
      voices.play(ring.engine, midis, drum, t, noteDuration(p, i), buses[i]!, i === 3 ? (s % 2 ? 0.28 : -0.28) : 0);
    });
  }
  return ctx.startRendering();
}
