/**
 * Curated loops for the gallery, landing pages and presets menu.
 * Authors are illustrative placeholders (see the concept note in the footer).
 */
import { morningOrbit } from './generate';
import { drumsFrom, emptyPattern, notesFrom, type EngineId, type Pattern } from './model';
import type { ScaleId } from './scales';

export type Mood = 'Calm' | 'Groove' | 'Dream' | 'Bright';

export type Finish = 'noon' | 'ember' | 'moon' | 'eclipse';

export interface Preset {
  id: string;
  author: string;
  place: string;
  mood: Mood;
  /** The finish this loop is shown on (galleries, thumbnails). */
  finish: Finish;
  pattern: Pattern;
}

interface RingSpec {
  steps: number;
  engine: EngineId;
  notes: string;
  volume?: number;
  offset?: number;
}

function make(
  name: string,
  opts: { key: number; scale: ScaleId; bpm: number; swing?: number; space?: number; drift?: number },
  rings: [RingSpec, RingSpec, RingSpec, RingSpec],
): Pattern {
  const p = emptyPattern();
  p.name = name;
  p.key = opts.key;
  p.scale = opts.scale;
  p.bpm = opts.bpm;
  p.swing = opts.swing ?? 0.1;
  p.space = opts.space ?? 0.4;
  p.drift = opts.drift ?? 0;
  rings.forEach((spec, i) => {
    const r = p.rings[i]!;
    r.steps = spec.steps;
    r.engine = spec.engine;
    r.notes = i === 0 ? drumsFrom(spec.notes) : notesFrom(spec.notes);
    r.volume = spec.volume ?? 0.7;
    r.offset = spec.offset ?? 0;
  });
  return p;
}

export const PRESETS: Preset[] = [
  { id: 'morning-orbit', author: 'Rondo studio', place: 'Lisbon', mood: 'Bright', finish: 'noon', pattern: morningOrbit() },
  {
    id: 'tin-roof',
    finish: 'ember',
    author: 'Maya',
    place: 'Lisbon',
    mood: 'Calm',
    pattern: make('Tin Roof', { key: 9, scale: 'minor', bpm: 78, swing: 0.2, space: 0.55 }, [
      { steps: 16, engine: 'dust', notes: 'r.z.z.rz.zr.z.zw', volume: 0.55 },
      { steps: 12, engine: 'sub', notes: '0.....3..4..', volume: 0.7 },
      { steps: 8, engine: 'tape', notes: '0...5...', volume: 0.5 },
      { steps: 7, engine: 'pluck', notes: '4.2.6.3', volume: 0.6 },
    ]),
  },
  {
    id: 'night-bus',
    finish: 'moon',
    author: 'Jonah',
    place: 'Glasgow',
    mood: 'Groove',
    pattern: make('Night Bus', { key: 5, scale: 'dorian', bpm: 104, swing: 0.16, space: 0.35 }, [
      { steps: 16, engine: 'dust', notes: 'k.h.c.hkh.k.c.ho', volume: 0.75 },
      { steps: 16, engine: 'sub', notes: '0..0..3.4..4..6.', volume: 0.8 },
      { steps: 8, engine: 'tape', notes: '0..3....', volume: 0.45 },
      { steps: 5, engine: 'glass', notes: '7.9.6', volume: 0.5 },
    ]),
  },
  {
    id: 'keplers-kitchen',
    finish: 'eclipse',
    author: 'Ana & Leo, age 9',
    place: 'Porto',
    mood: 'Bright',
    pattern: make("Kepler's Kitchen", { key: 7, scale: 'pentatonic', bpm: 112, swing: 0.05, space: 0.3 }, [
      { steps: 16, engine: 'dust', notes: 'k.w.s.w.k.wks.w.', volume: 0.7 },
      { steps: 12, engine: 'sub', notes: '0..2..3..2..', volume: 0.75 },
      { steps: 6, engine: 'pluck', notes: '0..3..', volume: 0.5 },
      { steps: 7, engine: 'glass', notes: '5687.9.', volume: 0.5 },
    ]),
  },
  {
    id: 'low-tide',
    finish: 'noon',
    author: 'Sade',
    place: 'Accra',
    mood: 'Groove',
    pattern: make('Low Tide', { key: 3, scale: 'mixolydian', bpm: 88, swing: 0.22, space: 0.4 }, [
      { steps: 16, engine: 'dust', notes: 'k.zwz.rzk.zwrz.z', volume: 0.65 },
      { steps: 10, engine: 'sub', notes: '0...4.3...', volume: 0.8 },
      { steps: 8, engine: 'tape', notes: '0...6...', volume: 0.45 },
      { steps: 9, engine: 'pluck', notes: '4.5.7.6.9', volume: 0.55 },
    ]),
  },
  {
    id: 'moon-laundry',
    finish: 'ember',
    author: 'Kenji',
    place: 'Osaka',
    mood: 'Dream',
    pattern: make('Moon Laundry', { key: 4, scale: 'hirajoshi', bpm: 72, swing: 0.1, space: 0.65 }, [
      { steps: 16, engine: 'dust', notes: 'w.....r...w...z.', volume: 0.5 },
      { steps: 12, engine: 'sub', notes: '0.....2.....', volume: 0.6 },
      { steps: 8, engine: 'glass', notes: '0...2...', volume: 0.4 },
      { steps: 7, engine: 'pluck', notes: '5.7.8.6', volume: 0.6 },
    ]),
  },
  {
    id: 'snow-day',
    finish: 'moon',
    author: 'Ines',
    place: 'Oslo',
    mood: 'Calm',
    pattern: make('Snow Day', { key: 0, scale: 'major', bpm: 66, swing: 0, space: 0.7 }, [
      { steps: 16, engine: 'dust', notes: '........z.......', volume: 0.35 },
      { steps: 16, engine: 'sub', notes: '0.......3.......', volume: 0.55 },
      { steps: 16, engine: 'tape', notes: '0.......3.......', volume: 0.45 },
      { steps: 11, engine: 'glass', notes: '9.7.b..8.6.', volume: 0.55 },
    ]),
  },
  {
    id: 'heat-haze',
    finish: 'eclipse',
    author: 'Rafa',
    place: 'Seville',
    mood: 'Groove',
    pattern: make('Heat Haze', { key: 4, scale: 'phrygian', bpm: 96, swing: 0.08, space: 0.3 }, [
      { steps: 16, engine: 'dust', notes: 'k..ck.h.k..ck.hr', volume: 0.75 },
      { steps: 12, engine: 'sub', notes: '0.0..1..0.3.', volume: 0.8 },
      { steps: 6, engine: 'pluck', notes: '0..1..', volume: 0.5 },
      { steps: 7, engine: 'pluck', notes: '7.8.5.4', volume: 0.55 },
    ]),
  },
  {
    id: 'commute-hymn',
    finish: 'noon',
    author: 'Priya',
    place: 'Pune',
    mood: 'Bright',
    pattern: make('Commute Hymn', { key: 2, scale: 'pentatonic', bpm: 120, swing: 0.04, space: 0.35 }, [
      { steps: 16, engine: 'dust', notes: 'k.h.s.hhk.h.s.hz', volume: 0.7 },
      { steps: 16, engine: 'sub', notes: '0.0.....3.3..4..', volume: 0.75 },
      { steps: 8, engine: 'tape', notes: '0...3...', volume: 0.45 },
      { steps: 5, engine: 'glass', notes: '5.7.9', volume: 0.5 },
    ]),
  },
  {
    id: 'seven-sisters',
    finish: 'ember',
    author: 'Mo',
    place: 'Cairo',
    mood: 'Dream',
    pattern: make('Seven Sisters', { key: 2, scale: 'harmonicMinor', bpm: 100, swing: 0.12, space: 0.5 }, [
      { steps: 14, engine: 'dust', notes: 'k..r..k.r..t..', volume: 0.65 },
      { steps: 7, engine: 'sub', notes: '0..4.3.', volume: 0.75 },
      { steps: 7, engine: 'tape', notes: '0...4..', volume: 0.45 },
      { steps: 7, engine: 'glass', notes: '7.6.5.4', volume: 0.5 },
    ]),
  },
  {
    id: 'sunday-paper',
    finish: 'moon',
    author: 'Tom',
    place: 'Leeds',
    mood: 'Calm',
    pattern: make('Sunday Paper', { key: 10, scale: 'mixolydian', bpm: 84, swing: 0.24, space: 0.45 }, [
      { steps: 16, engine: 'dust', notes: 'k..h.zh.k.rh.zh.', volume: 0.6 },
      { steps: 12, engine: 'sub', notes: '0..3..4..3..', volume: 0.7 },
      { steps: 8, engine: 'tape', notes: '0...3...', volume: 0.5 },
      { steps: 9, engine: 'pluck', notes: '4.6.5.7.4', volume: 0.5 },
    ]),
  },
  {
    id: 'blue-hour',
    finish: 'eclipse',
    author: 'Ama',
    place: 'Montréal',
    mood: 'Dream',
    pattern: make('Blue Hour', { key: 1, scale: 'dorian', bpm: 76, swing: 0.18, space: 0.6, drift: 0.25 }, [
      { steps: 16, engine: 'dust', notes: 'k.....r.k.z...r.', volume: 0.55 },
      { steps: 12, engine: 'sub', notes: '0.....4..3..', volume: 0.7 },
      { steps: 16, engine: 'tape', notes: '0.......5.......', volume: 0.5 },
      { steps: 7, engine: 'glass', notes: '9.8.6.a', volume: 0.5 },
    ]),
  },
];

export const presetById = (id: string) => PRESETS.find((p) => p.id === id);
