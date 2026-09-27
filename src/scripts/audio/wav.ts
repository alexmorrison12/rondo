/**
 * Master a rendered loop in place: a gentle tanh limiter for stray peaks, then normalise the
 * result to −1 dBFS so exports sit at a sensible level next to other tracks.
 */
export function masterBuffer(buffer: AudioBuffer, ceilingDb = -1): void {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  const knee = 0.8;
  let peak = 0;
  for (const data of channels) {
    for (let i = 0; i < data.length; i++) {
      const x = data[i]!;
      const a = Math.abs(x);
      // Linear below the knee, smoothly saturating above it (continuous slope at the knee).
      const y = a <= knee ? a : knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee));
      data[i] = Math.sign(x) * y;
      if (y > peak) peak = y;
    }
  }
  if (peak <= 0) return;
  const gain = Math.pow(10, ceilingDb / 20) / peak;
  for (const data of channels) for (let i = 0; i < data.length; i++) data[i]! *= gain;
}

/** Encode an AudioBuffer as a 16-bit PCM WAV Blob. */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels = Math.min(2, buffer.numberOfChannels);
  const rate = buffer.sampleRate;
  const frames = buffer.length;
  const bytesPerSample = 2;
  const dataSize = frames * channels * bytesPerSample;
  const out = new ArrayBuffer(44 + dataSize);
  const v = new DataView(out);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));

  str(0, 'RIFF');
  v.setUint32(4, 36 + dataSize, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * channels * bytesPerSample, true);
  v.setUint16(32, channels * bytesPerSample, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, dataSize, true);

  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c]![i]!));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([out], { type: 'audio/wav' });
}
