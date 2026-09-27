import { describe, expect, it } from 'vitest';
import { masterBuffer } from '../src/scripts/audio/wav';
import { encodePattern, patternFromHash } from '../src/scripts/seq/codec';
import { generatePattern, loopName, morningOrbit } from '../src/scripts/seq/generate';

/** Just enough of AudioBuffer for the mastering pass. */
function fakeBuffer(channels: number[][]): AudioBuffer {
  const data = channels.map((c) => Float32Array.from(c));
  return { numberOfChannels: data.length, getChannelData: (i: number) => data[i]! } as unknown as AudioBuffer;
}

describe('WAV mastering', () => {
  it('normalises the peak to −1 dBFS', () => {
    const buf = fakeBuffer([[0, 0.25, -0.5, 0.1]]);
    masterBuffer(buf);
    const peak = Math.max(...buf.getChannelData(0).map(Math.abs));
    expect(peak).toBeCloseTo(10 ** (-1 / 20), 5);
  });

  it('never clips, however hot the render', () => {
    const buf = fakeBuffer([
      [0, 1.8, -2.4, 0.9],
      [3, -3, 0.2, 0],
    ]);
    masterBuffer(buf);
    for (const ch of [0, 1]) for (const x of buf.getChannelData(ch)) expect(Math.abs(x)).toBeLessThanOrEqual(10 ** (-1 / 20) + 1e-6);
  });

  it('leaves silence silent', () => {
    const buf = fakeBuffer([[0, 0, 0]]);
    masterBuffer(buf);
    expect([...buf.getChannelData(0)]).toEqual([0, 0, 0]);
  });
});

describe('loop names', () => {
  it('names a roll the same way every time', () => {
    expect(loopName(42, 0.5)).toBe(loopName(42, 0.5));
    expect(generatePattern(7).name).toBe(generatePattern(7).name);
  });

  it('uses two words and never the old placeholder', () => {
    for (let seed = 1; seed < 200; seed++) {
      const name = generatePattern(seed).name;
      expect(name).not.toBe('Rolled loop');
      expect(name.split(' ')).toHaveLength(2);
    }
  });
});

describe('signed share links', () => {
  it('still decode the loop when name and time ride along', () => {
    const code = encodePattern(morningOrbit());
    const back = patternFromHash(`#l=${code}&f=Alex&t=2140`);
    expect(back?.name).toBe('Morning Orbit');
  });
});
