/**
 * Sound is strictly opt-in. One AudioContext for the whole page, created lazily on the
 * first user gesture after the visitor turns sound on. The preference persists; on a
 * later visit the context resumes on the first tap/keypress (browsers require a gesture).
 */
import { persisted } from './store';

export const soundPref = persisted<boolean>('sound', false);

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let uiBus: GainNode | null = null;
let noise: AudioBuffer | null = null;
let playing = 0;

type SoundListener = (state: { on: boolean; running: boolean; playing: boolean }) => void;
const listeners = new Set<SoundListener>();

function notify() {
  const state = { on: soundPref.get(), running: ctx?.state === 'running', playing: playing > 0 };
  listeners.forEach((l) => l(state));
}

export function onSoundState(fn: SoundListener): () => void {
  listeners.add(fn);
  fn({ on: soundPref.get(), running: ctx?.state === 'running', playing: playing > 0 });
  return () => listeners.delete(fn);
}

export function audioContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 0.9;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    master.connect(limiter).connect(ctx.destination);
    uiBus = ctx.createGain();
    uiBus.gain.value = 0.35;
    uiBus.connect(master);
    ctx.addEventListener('statechange', notify);
  }
  return ctx;
}

/** Where music engines connect. */
export function masterInput(): GainNode {
  audioContext();
  return master!;
}

export function isSoundReady(): boolean {
  return soundPref.get() && ctx?.state === 'running';
}

export async function setSound(on: boolean): Promise<void> {
  soundPref.set(on);
  if (on) {
    const c = audioContext();
    if (c.state !== 'running') await c.resume().catch(() => undefined);
  } else if (ctx && ctx.state === 'running') {
    await ctx.suspend().catch(() => undefined);
  }
  notify();
}

/** Ensure audio is running (call from inside a user gesture). Turns sound on. */
export async function ensureSound(): Promise<AudioContext> {
  await setSound(true);
  return audioContext();
}

/** Something started/stopped making music (drives the header bars). */
export function markPlaying(isPlaying: boolean): void {
  playing = Math.max(0, playing + (isPlaying ? 1 : -1));
  notify();
}

export function initSound(): void {
  soundPref.subscribe(() => notify(), false);
  if (soundPref.get()) {
    const resume = () => {
      if (soundPref.get()) audioContext().resume().then(notify, notify);
      window.removeEventListener('pointerdown', resume, true);
      window.removeEventListener('keydown', resume, true);
    };
    window.addEventListener('pointerdown', resume, true);
    window.addEventListener('keydown', resume, true);
  }
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden && playing === 0) ctx.suspend().catch(() => undefined);
    else if (!document.hidden && soundPref.get()) ctx.resume().catch(() => undefined);
  });
}

/* ── UI sounds: quiet, short, sparse ─────────────────────────────── */

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (!noise) {
    noise = c.createBuffer(1, c.sampleRate * 0.25, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** Mechanical detent tick for ring rotation. */
export function uiTick(pitch = 1): void {
  if (!isSoundReady()) return;
  const c = audioContext();
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3200 * pitch;
  bp.Q.value = 6;
  const g = c.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  src.connect(bp).connect(g).connect(uiBus!);
  src.start(t);
  src.stop(t + 0.04);
}

/** Two soft sine partials: an earned star. */
export function uiChime(): void {
  if (!isSoundReady()) return;
  const c = audioContext();
  const t = c.currentTime;
  [1318.5, 1975.5, 2637].forEach((f, i) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = c.createGain();
    const start = t + i * 0.07;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.18 / (i + 1), start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, start + 1.2);
    o.connect(g).connect(uiBus!);
    o.start(start);
    o.stop(start + 1.25);
  });
}

/** A soft pop: add to bag, toggles. */
export function uiPop(up = true): void {
  if (!isSoundReady()) return;
  const c = audioContext();
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(up ? 420 : 620, t);
  o.frequency.exponentialRampToValueAtTime(up ? 880 : 300, t + 0.09);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o.connect(g).connect(uiBus!);
  o.start(t);
  o.stop(t + 0.16);
}
