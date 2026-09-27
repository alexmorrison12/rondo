/**
 * The musical model of a Rondo: four concentric rings, outermost first.
 * Each ring loops at its own length (polymeter), so rings drift apart and realign.
 */
import type { ScaleId } from './scales';

export type EngineId = 'dust' | 'sub' | 'tape' | 'pluck' | 'glass';

export interface RingState {
  /** Loop length, 1–16 steps. */
  steps: number;
  engine: EngineId;
  /** Always 16 slots; only the first `steps` are used. −1 = empty, otherwise a scale degree (or drum voice). */
  notes: number[];
  /** Rotation in steps (turning the physical ring). */
  offset: number;
  /** 0–1 */
  volume: number;
  mute: boolean;
}

export interface Pattern {
  name: string;
  key: number;
  scale: ScaleId;
  bpm: number;
  /** 0–0.6: delays off-beat sixteenths. */
  swing: number;
  /** 0–1: probability the loop mutates itself each cycle. */
  drift: number;
  /** 0–1: reverb send. */
  space: number;
  rings: [RingState, RingState, RingState, RingState];
}

export interface RingMeta {
  id: 'pulse' | 'root' | 'glow' | 'spark';
  name: string;
  role: string;
  colorVar: string;
  /** Base octave for melodic engines. */
  octave: number;
  /** Plays diatonic triads instead of single notes. */
  chords: boolean;
  maxDegree: number;
}

export const RINGS: RingMeta[] = [
  { id: 'pulse', name: 'Pulse', role: 'Drums', colorVar: '--ember', octave: 3, chords: false, maxDegree: 8 },
  { id: 'root', name: 'Root', role: 'Bass', colorVar: '--sunlit', octave: 2, chords: false, maxDegree: 9 },
  { id: 'glow', name: 'Glow', role: 'Chords', colorVar: '--tide', octave: 3, chords: true, maxDegree: 9 },
  { id: 'spark', name: 'Spark', role: 'Melody', colorVar: '--lilac', octave: 4, chords: false, maxDegree: 12 },
];

export const ENGINES: { id: EngineId; name: string; blurb: string }[] = [
  { id: 'dust', name: 'Dust', blurb: 'An analogue-modelled kit: soft kick, papery snare, nine voices.' },
  { id: 'sub', name: 'Sub', blurb: 'A round, plucky bass that never muddies the mix.' },
  { id: 'tape', name: 'Tape', blurb: 'Warm chords with a little wow and flutter.' },
  { id: 'pluck', name: 'Pluck', blurb: 'A physically modelled string. Nylon at the bottom, harp at the top.' },
  { id: 'glass', name: 'Glass', blurb: 'FM bells that ring out like a wine glass.' },
];

export const DRUM_VOICES = ['Kick', 'Snare', 'Clap', 'Hat', 'Open hat', 'Rim', 'Shaker', 'Tom', 'Wood'];

export const MAX_STEPS = 16;

export function emptyRing(index: number): RingState {
  const defaults: [number, EngineId][] = [
    [16, 'dust'],
    [12, 'sub'],
    [8, 'tape'],
    [7, 'pluck'],
  ];
  const [steps, engine] = defaults[index]!;
  return { steps, engine, notes: Array(MAX_STEPS).fill(-1), offset: 0, volume: 0.8, mute: false };
}

export function emptyPattern(): Pattern {
  return {
    name: 'Untitled loop',
    key: 0,
    scale: 'pentatonic',
    bpm: 96,
    swing: 0.12,
    drift: 0,
    space: 0.35,
    rings: [emptyRing(0), emptyRing(1), emptyRing(2), emptyRing(3)],
  };
}

export const clonePattern = (p: Pattern): Pattern => structuredClone(p);

export function noteCount(p: Pattern): number {
  return p.rings.reduce((n, r) => n + r.notes.slice(0, r.steps).filter((x) => x >= 0).length, 0);
}

/** Index of the note under the playhead for a ring at a global step. */
export function slotAt(ring: RingState, globalStep: number): number {
  return (((globalStep + ring.offset) % ring.steps) + ring.steps) % ring.steps;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
export const lcm = (a: number, b: number) => (a * b) / gcd(a, b);

/** How many sixteenth-note steps until all active rings line up again. */
export function cycleLength(p: Pattern): number {
  return p.rings
    .filter((r) => r.notes.slice(0, r.steps).some((n) => n >= 0))
    .reduce((acc, r) => lcm(acc, r.steps), 1);
}

/** Build a 16-slot note array from a compact string: digits/letters are degrees, "." is empty. */
export function notesFrom(spec: string): number[] {
  const out = Array(MAX_STEPS).fill(-1);
  [...spec.replace(/\s/g, '')].slice(0, MAX_STEPS).forEach((ch, i) => {
    if (ch === '.') return;
    const v = parseInt(ch, 36);
    out[i] = Number.isNaN(v) ? -1 : v;
  });
  return out;
}

/** Drum spec: k kick, s snare, c clap, h hat, o open hat, r rim, z shaker, t tom, w wood, "." rest. */
export function drumsFrom(spec: string): number[] {
  const map: Record<string, number> = { k: 0, s: 1, c: 2, h: 3, o: 4, r: 5, z: 6, t: 7, w: 8 };
  const out = Array(MAX_STEPS).fill(-1);
  [...spec.replace(/\s/g, '')].slice(0, MAX_STEPS).forEach((ch, i) => {
    out[i] = map[ch] ?? -1;
  });
  return out;
}
