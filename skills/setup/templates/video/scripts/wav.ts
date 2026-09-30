// 16-bit PCM WAV: one channel (mono) or several of equal length.
export function encodeWav(samples: Float32Array | Float32Array[], rate: number): Buffer {
  const channels = Array.isArray(samples) ? samples : [samples];
  const frames = channels[0].length;
  const data = Buffer.alloc(frames * channels.length * 2);
  for (let i = 0; i < frames; i++) {
    channels.forEach((ch, c) => {
      data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, ch[i])) * 32767), (i * channels.length + c) * 2);
    });
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels.length, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * channels.length * 2, 28);
  h.writeUInt16LE(channels.length * 2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
