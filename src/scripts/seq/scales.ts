/**
 * Scales and modes. Every scale maps to a time of day: the web instrument's sky follows the
 * mood of the music (bright modes at noon, dark modes at night).
 */
export type SkyId = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'golden' | 'dusk' | 'evening' | 'night';

export type ScaleId =
  | 'major'
  | 'lydian'
  | 'mixolydian'
  | 'pentatonic'
  | 'dorian'
  | 'minor'
  | 'minorPentatonic'
  | 'phrygian'
  | 'harmonicMinor'
  | 'hirajoshi'
  | 'wholeTone'
  | 'blues';

export interface Scale {
  id: ScaleId;
  name: string;
  intervals: number[];
  sky: SkyId;
  feel: string;
}

export const SCALES: Scale[] = [
  { id: 'major', name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11], sky: 'noon', feel: 'Bright, open' },
  { id: 'lydian', name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11], sky: 'morning', feel: 'Floating, hopeful' },
  { id: 'pentatonic', name: 'Pentatonic', intervals: [0, 2, 4, 7, 9], sky: 'afternoon', feel: 'No wrong notes' },
  { id: 'mixolydian', name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10], sky: 'golden', feel: 'Warm, easy' },
  { id: 'dorian', name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10], sky: 'dusk', feel: 'Cool, soulful' },
  { id: 'minorPentatonic', name: 'Minor pentatonic', intervals: [0, 3, 5, 7, 10], sky: 'dusk', feel: 'Bluesy, safe' },
  { id: 'minor', name: 'Minor', intervals: [0, 2, 3, 5, 7, 8, 10], sky: 'evening', feel: 'Tender, rainy' },
  { id: 'harmonicMinor', name: 'Harmonic minor', intervals: [0, 2, 3, 5, 7, 8, 11], sky: 'evening', feel: 'Dramatic' },
  { id: 'phrygian', name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10], sky: 'night', feel: 'Dark, dusty' },
  { id: 'hirajoshi', name: 'Hirajōshi', intervals: [0, 2, 3, 7, 8], sky: 'night', feel: 'Koto, moonlight' },
  { id: 'wholeTone', name: 'Whole tone', intervals: [0, 2, 4, 6, 8, 10], sky: 'dawn', feel: 'Dreamlike' },
  { id: 'blues', name: 'Blues', intervals: [0, 3, 5, 6, 7, 10], sky: 'golden', feel: 'Gritty, sunny' },
];

export const KEYS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export const scaleById = (id: ScaleId): Scale => SCALES.find((s) => s.id === id) ?? SCALES[0]!;

/** Map a scale degree (0-based, may exceed the scale length) to a MIDI note. */
export function degreeToMidi(degree: number, scale: Scale, key: number, octave: number): number {
  const n = scale.intervals.length;
  const oct = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return 12 * (octave + 1 + oct) + key + scale.intervals[idx]!;
}

export const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);

const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const midiName = (m: number) => `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
