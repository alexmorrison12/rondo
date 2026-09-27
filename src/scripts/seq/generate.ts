/**
 * Generative helpers: Euclidean rhythms, a seeded "dice" that only rolls musical loops,
 * a mood-to-loop composer ("describe a moment, hear it"), and the gentle drift mutation.
 * Deterministic for a given seed/text so the same words always make the same song.
 */
import { MAX_STEPS, emptyPattern, notesFrom, type EngineId, type Pattern } from './model';
import type { ScaleId } from './scales';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Euclidean rhythm E(k, n): k hits spread as evenly as possible over n steps, first hit on step 0. */
export function euclid(pulses: number, steps: number, rotate = 0): boolean[] {
  const k = Math.max(0, Math.min(pulses, steps));
  const aligned = Array.from({ length: steps }, (_, i) => k > 0 && (i * k) % steps < k);
  const r = ((rotate % steps) + steps) % steps;
  return [...aligned.slice(steps - r), ...aligned.slice(0, steps - r)];
}

const pick = <T>(rnd: () => number, arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;

const PROGRESSIONS = [
  [0, 5, 3, 4],
  [0, 3, 4, 4],
  [5, 3, 0, 4],
  [0, 4, 5, 3],
  [0, 2, 5, 4],
  [0, 0, 3, 5],
];

export interface GenOptions {
  valence?: number; // −1 (dark) … 1 (bright)
  energy?: number; // 0 (still) … 1 (driving)
  name?: string;
}

const NAME_BRIGHT = ['Paper', 'Sunlit', 'Easy', 'Open', 'Golden', 'Kite', 'Early', 'Lemon', 'Tin', 'Clear'];
const NAME_MIDDLE = ['Small', 'Round', 'Loose', 'Silver', 'Soft', 'Tidal', 'Warm', 'Far', 'Wandering', 'Second'];
const NAME_DARK = ['Late', 'Slow', 'Blue', 'Hollow', 'Midnight', 'Quiet', 'Velvet', 'Low', 'Rain', 'Last'];
const NAME_NOUN = ['Orbit', 'Ferry', 'Lantern', 'Comet', 'Harbour', 'Engine', 'Garden', 'Signal', 'Window', 'Carousel', 'Tram', 'Tide', 'Radio', 'Meadow', 'Satellite', 'Bicycle', 'Moth', 'Planet', 'Fountain', 'Ladder'];

/** A two-word name that matches the loop's mood, from its own seed (so the same roll, the same name). */
export function loopName(seed: number, valence: number): string {
  const rnd = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const adjectives = valence > 0.35 ? NAME_BRIGHT : valence < -0.35 ? NAME_DARK : NAME_MIDDLE;
  return `${pick(rnd, adjectives)} ${pick(rnd, NAME_NOUN)}`;
}

/** Roll a new, musical loop. */
export function generatePattern(seed: number, opts: GenOptions = {}): Pattern {
  const rnd = mulberry32(seed);
  const valence = opts.valence ?? rnd() * 2 - 1;
  const energy = opts.energy ?? 0.25 + rnd() * 0.6;
  const p = emptyPattern();

  const bright: ScaleId[] = ['major', 'lydian', 'pentatonic', 'mixolydian'];
  const middle: ScaleId[] = ['pentatonic', 'dorian', 'mixolydian', 'minorPentatonic'];
  const dark: ScaleId[] = ['minor', 'dorian', 'hirajoshi', 'phrygian', 'harmonicMinor'];
  p.scale = pick(rnd, valence > 0.35 ? bright : valence < -0.35 ? dark : middle);
  p.key = Math.floor(rnd() * 12);
  p.bpm = Math.round(64 + energy * 76 + (rnd() - 0.5) * 8);
  p.swing = energy < 0.5 ? 0.08 + rnd() * 0.18 : rnd() * 0.12;
  p.space = 0.55 - energy * 0.35 + rnd() * 0.1;
  p.name = opts.name ?? loopName(seed, valence);

  // Pulse (drums)
  const pulse = p.rings[0];
  pulse.steps = 16;
  pulse.engine = 'dust';
  const drums = Array(MAX_STEPS).fill(-1);
  if (energy > 0.3) euclid(energy > 0.7 ? 4 : energy > 0.5 ? 3 : 2, 16).forEach((on, i) => on && (drums[i] = 0));
  const backbeat = energy > 0.45 ? (rnd() > 0.5 ? 1 : 2) : 5;
  [4, 12].forEach((i) => (drums[i] = backbeat));
  const hatHits = euclid(Math.round(3 + energy * 7), 16, 2);
  hatHits.forEach((on, i) => on && drums[i] === -1 && (drums[i] = rnd() > 0.85 ? 4 : energy < 0.35 ? 6 : 3));
  if (rnd() > 0.6) drums[15] = drums[15] === -1 ? 8 : drums[15];
  pulse.notes = drums;
  pulse.volume = 0.72;

  // Root (bass)
  const root = p.rings[1];
  root.steps = pick(rnd, [12, 16, 10, 12]);
  root.engine = 'sub';
  const bassHits = euclid(Math.round(2 + energy * 3), root.steps);
  const bassDegrees = [0, 0, 4, 3, 5, 0];
  root.notes = Array(MAX_STEPS).fill(-1);
  bassHits.forEach((on, i) => on && (root.notes[i] = pick(rnd, bassDegrees)));
  root.notes[0] = 0;
  root.volume = 0.78;

  // Glow (chords)
  const glow = p.rings[2];
  glow.steps = pick(rnd, [8, 8, 16, 6]);
  glow.engine = energy > 0.6 && rnd() > 0.5 ? 'pluck' : 'tape';
  const prog = pick(rnd, PROGRESSIONS);
  glow.notes = Array(MAX_STEPS).fill(-1);
  const chordEvery = glow.steps >= 8 ? glow.steps / 4 : glow.steps / 2;
  for (let c = 0; c * chordEvery < glow.steps; c++) {
    const at = Math.floor(c * chordEvery);
    glow.notes[at] = prog[c % prog.length]!;
  }
  glow.volume = 0.55;

  // Spark (melody): a random walk over the scale on an odd loop length
  const spark = p.rings[3];
  spark.steps = pick(rnd, [7, 5, 9, 11, 7]);
  spark.engine = pick(rnd, ['pluck', 'glass', 'glass'] as EngineId[]);
  const melHits = euclid(Math.max(2, Math.round(spark.steps * (0.35 + energy * 0.3))), spark.steps, Math.floor(rnd() * 3));
  let deg = 4 + Math.floor(rnd() * 3);
  spark.notes = Array(MAX_STEPS).fill(-1);
  melHits.forEach((on, i) => {
    if (!on) return;
    deg = Math.max(2, Math.min(11, deg + pick(rnd, [-2, -1, -1, 1, 1, 2, 3, 0])));
    spark.notes[i] = deg;
  });
  spark.volume = 0.6;
  return p;
}

/* ── Mood → loop ─────────────────────────────────────────────────── */

const LEXICON: [RegExp, number, number][] = [
  // [pattern, valence, energy]
  [/\b(sun|sunny|summer|beach|bright|morning|happy|joy|smile|gold|golden|spring|picnic|coffee)\w*/g, 0.8, 0.5],
  [/\b(party|dance|run|fast|city|neon|club|festival|bus|train|rush|drive|road)\w*/g, 0.4, 0.95],
  [/\b(rain|rainy|grey|gray|sad|alone|lonely|cold|winter|fog|tired|miss|lost)\w*/g, -0.7, 0.25],
  [/\b(night|moon|midnight|dark|stars?|owl|late|dream|sleep|bed)\w*/g, -0.3, 0.2],
  [/\b(calm|quiet|slow|still|breath|breathe|sea|ocean|lake|snow|tea|read|book|sunday)\w*/g, 0.2, 0.1],
  [/\b(love|warm|home|friend|kiss|hug|kitchen|cat|dog)\w*/g, 0.6, 0.35],
  [/\b(angry|storm|thunder|fire|loud|chaos|monday|deadline)\w*/g, -0.5, 0.9],
  [/\b(space|orbit|planet|galaxy|float|cloud|sky|flying)\w*/g, 0.3, 0.3],
];

export function moodToPattern(text: string): Pattern {
  const t = text.toLowerCase();
  let v = 0;
  let e = 0;
  let hits = 0;
  for (const [re, val, en] of LEXICON) {
    const matches = t.match(re)?.length ?? 0;
    if (matches) {
      v += val * matches;
      e += en * matches;
      hits += matches;
    }
  }
  const seed = hashString(t.trim() || 'rondo');
  const rnd = mulberry32(seed);
  const valence = hits ? v / hits : rnd() * 1.2 - 0.4;
  const energy = hits ? e / hits : 0.3 + rnd() * 0.4;
  const clean = text.trim().replace(/\s+/g, ' ');
  const name = clean ? clean.charAt(0).toUpperCase() + clean.slice(1, 40) : 'A quiet moment';
  return generatePattern(seed, { valence, energy, name });
}

/** One gentle mutation: nudge a note in time or pitch, add or remove a ghost. */
export function driftRing(p: Pattern, ringIndex: number, rnd: () => number = Math.random): boolean {
  const ring = p.rings[ringIndex]!;
  const filled: number[] = [];
  const empty: number[] = [];
  for (let i = 0; i < ring.steps; i++) (ring.notes[i]! >= 0 ? filled : empty).push(i);
  if (!filled.length) return false;
  const roll = rnd();
  if (ringIndex === 0) {
    // Drums: move a hat or add/remove a ghost, never touch the backbone.
    const movable = filled.filter((i) => [3, 4, 6, 8].includes(ring.notes[i]!));
    if (roll < 0.5 && movable.length && empty.length) {
      const from = pick(rnd, movable);
      const to = pick(rnd, empty);
      ring.notes[to] = ring.notes[from]!;
      ring.notes[from] = -1;
    } else if (empty.length) {
      ring.notes[pick(rnd, empty)] = pick(rnd, [3, 6, 8]);
    }
    return true;
  }
  const i = pick(rnd, filled);
  if (roll < 0.45) {
    ring.notes[i] = Math.max(0, ring.notes[i]! + pick(rnd, [-2, -1, 1, 2]));
  } else if (roll < 0.8 && empty.length) {
    const to = pick(rnd, empty);
    ring.notes[to] = ring.notes[i]!;
    ring.notes[i] = -1;
  } else if (filled.length > 2) {
    ring.notes[i] = -1;
  } else if (empty.length) {
    ring.notes[pick(rnd, empty)] = ring.notes[i]!;
  }
  return true;
}

/** The flagship loop used on the home page: bright, simple, polymetric (16 · 12 · 8 · 7). */
export function morningOrbit(): Pattern {
  const p = emptyPattern();
  p.name = 'Morning Orbit';
  p.key = 2; // D
  p.scale = 'lydian';
  p.bpm = 92;
  p.swing = 0.14;
  p.space = 0.42;
  p.drift = 0;
  p.rings[0].notes = [0, -1, 3, -1, 2, -1, 3, 6, 0, -1, 3, 0, 2, -1, 3, 8];
  p.rings[0].volume = 0.7;
  p.rings[1].steps = 12;
  p.rings[1].notes = notesFrom('0..0..4..3..');
  p.rings[1].volume = 0.8;
  p.rings[2].steps = 8;
  p.rings[2].notes = notesFrom('0...5...');
  p.rings[2].volume = 0.5;
  p.rings[3].steps = 7;
  p.rings[3].engine = 'glass';
  p.rings[3].notes = notesFrom('7.96.8.');
  p.rings[3].volume = 0.55;
  return p;
}
