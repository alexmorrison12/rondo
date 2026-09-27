import { describe, expect, it } from 'vitest';
import { decodePattern, encodePattern, patternFromHash } from '../src/scripts/seq/codec';
import { euclid, generatePattern, moodToPattern, morningOrbit } from '../src/scripts/seq/generate';
import { cycleLength, lcm, slotAt } from '../src/scripts/seq/model';
import { PRESETS } from '../src/scripts/seq/presets';
import { degreeToMidi, scaleById } from '../src/scripts/seq/scales';

describe('loop codec', () => {
  it('round-trips every preset through a URL', () => {
    for (const { pattern } of PRESETS) {
      const code = encodePattern(pattern);
      expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
      const back = decodePattern(code)!;
      expect(back.name).toBe(pattern.name);
      expect(back.scale).toBe(pattern.scale);
      expect(back.bpm).toBe(pattern.bpm);
      back.rings.forEach((r, i) => {
        const src = pattern.rings[i]!;
        expect(r.steps).toBe(src.steps);
        expect(r.engine).toBe(src.engine);
        expect(r.notes.slice(0, r.steps)).toEqual(src.notes.slice(0, src.steps));
      });
    }
  });

  it('keeps links short enough to share', () => {
    expect(encodePattern(morningOrbit()).length).toBeLessThan(120);
  });

  it('reads a loop from a hash and rejects garbage', () => {
    const code = encodePattern(morningOrbit());
    expect(patternFromHash(`#l=${code}`)?.name).toBe('Morning Orbit');
    expect(decodePattern('not-a-loop')).toBeNull();
    expect(patternFromHash('#nothing')).toBeNull();
  });
});

describe('rhythm maths', () => {
  it('spreads Euclidean pulses evenly', () => {
    expect(euclid(4, 16).filter(Boolean)).toHaveLength(4);
    expect(euclid(3, 8)).toEqual([true, false, false, true, false, false, true, false]);
  });

  it('computes when four rings realign', () => {
    expect(lcm(16, 12)).toBe(48);
    expect(cycleLength(morningOrbit())).toBe(336);
  });

  it('maps the playhead to the right slot when a ring is turned', () => {
    const ring = { ...morningOrbit().rings[0], offset: 3 };
    expect(slotAt(ring, 0)).toBe(3);
    expect(slotAt(ring, 13)).toBe(0);
  });

  it('maps scale degrees to MIDI across octaves', () => {
    const major = scaleById('major');
    expect(degreeToMidi(0, major, 0, 4)).toBe(60);
    expect(degreeToMidi(7, major, 0, 4)).toBe(72);
    expect(degreeToMidi(2, major, 2, 4)).toBe(66);
  });
});

describe('generators', () => {
  it('is deterministic: same words, same song', () => {
    expect(encodePattern(moodToPattern('rain on the window'))).toBe(encodePattern(moodToPattern('rain on the window')));
  });

  it('always rolls something playable', () => {
    for (let seed = 1; seed < 40; seed++) {
      const p = generatePattern(seed);
      expect(p.bpm).toBeGreaterThanOrEqual(50);
      expect(p.bpm).toBeLessThanOrEqual(180);
      expect(p.rings.some((r) => r.notes.slice(0, r.steps).some((n) => n >= 0))).toBe(true);
    }
  });
});
