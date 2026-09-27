/**
 * Loops travel as URLs. A pattern packs into ~60–90 bytes, base64url-encoded into the hash
 * (#l=…), so a shared link *is* the song: no server, no account, nothing to break in ten years.
 *
 * Layout (v1):
 *   [0] version  [1] key  [2] scale  [3] bpm  [4] swing×100  [5] drift×100  [6] space×100
 *   per ring ×4: [steps] [engine] [offset] [volume×100 | mute<<7] then `steps` bytes of notes (0 = empty, n+1 = degree n)
 *   [name length] [utf-8 name bytes]
 */
import { MAX_STEPS, type EngineId, type Pattern, type RingState } from './model';
import { SCALES, type ScaleId } from './scales';

const VERSION = 1;
const ENGINE_IDS: EngineId[] = ['dust', 'sub', 'tape', 'pluck', 'glass'];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function encodePattern(p: Pattern): string {
  const bytes: number[] = [
    VERSION,
    clamp(Math.round(p.key), 0, 11),
    Math.max(0, SCALES.findIndex((s) => s.id === p.scale)),
    clamp(Math.round(p.bpm), 40, 240),
    clamp(Math.round(p.swing * 100), 0, 60),
    clamp(Math.round(p.drift * 100), 0, 100),
    clamp(Math.round(p.space * 100), 0, 100),
  ];
  for (const r of p.rings) {
    const steps = clamp(Math.round(r.steps), 1, MAX_STEPS);
    bytes.push(
      steps,
      Math.max(0, ENGINE_IDS.indexOf(r.engine)),
      ((Math.round(r.offset) % steps) + steps) % steps,
      clamp(Math.round(r.volume * 100), 0, 100) | (r.mute ? 0x80 : 0),
    );
    for (let i = 0; i < steps; i++) {
      const n = r.notes[i] ?? -1;
      bytes.push(n < 0 ? 0 : clamp(n + 1, 1, 255));
    }
  }
  const name = new TextEncoder().encode((p.name ?? '').slice(0, 48));
  bytes.push(name.length, ...name);
  return toBase64Url(Uint8Array.from(bytes));
}

export function decodePattern(code: string): Pattern | null {
  try {
    const b = fromBase64Url(code);
    if (b[0] !== VERSION || b.length < 7 + 4 * 5) return null;
    let i = 7;
    const rings: RingState[] = [];
    for (let r = 0; r < 4; r++) {
      const steps = clamp(b[i++]!, 1, MAX_STEPS);
      const engine = ENGINE_IDS[b[i++]!] ?? 'pluck';
      const offset = b[i++]! % steps;
      const vol = b[i++]!;
      const notes = Array(MAX_STEPS).fill(-1);
      for (let s = 0; s < steps; s++) {
        const v = b[i++];
        if (v === undefined) return null;
        notes[s] = v === 0 ? -1 : v - 1;
      }
      rings.push({ steps, engine, offset, volume: (vol & 0x7f) / 100, mute: Boolean(vol & 0x80), notes });
    }
    const nameLen = b[i++] ?? 0;
    const name = nameLen ? new TextDecoder().decode(b.slice(i, i + nameLen)) : 'Shared loop';
    return {
      name,
      key: clamp(b[1]!, 0, 11),
      scale: (SCALES[b[2]!]?.id ?? 'pentatonic') as ScaleId,
      bpm: clamp(b[3]!, 40, 240),
      swing: clamp(b[4]! / 100, 0, 0.6),
      drift: clamp(b[5]! / 100, 0, 1),
      space: clamp(b[6]! / 100, 0, 1),
      rings: rings as Pattern['rings'],
    };
  } catch {
    return null;
  }
}

/** Read a loop from a URL hash such as "#l=AQA…". */
export function patternFromHash(hash: string): Pattern | null {
  const m = /[#&]l=([A-Za-z0-9_-]+)/.exec(hash);
  return m ? decodePattern(m[1]!) : null;
}
