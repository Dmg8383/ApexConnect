const fs = require('fs');
const path = require('path');

function writeWav(filename, sampleRate, samples) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF chunk descriptor
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20); // AudioFormat PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    let val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    buffer.writeInt16LE(val, 44 + i * 2);
  }

  const dir = path.join(__dirname, 'assets', 'sounds');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(path.join(dir, filename), buffer);
  console.log(`Generated ${filename}`);
}

const sampleRate = 44100;

// 1. WhatsApp-style Tick (Send)
// A very short, low pitched "pop"
const tickDuration = 0.05; // 50ms
const tickSamples = new Float32Array(Math.floor(sampleRate * tickDuration));
for (let i = 0; i < tickSamples.length; i++) {
  const t = i / sampleRate;
  const envelope = Math.exp(-t * 150);
  const freq = 400 * Math.exp(-t * 200);
  tickSamples[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.8;
}
writeWav('send.wav', sampleRate, tickSamples);

// 2. Professional Bell Chime (Receive)
// A soft, decaying bell (two frequencies combined)
const bellDuration = 1.0; // 1 second
const bellSamples = new Float32Array(Math.floor(sampleRate * bellDuration));
for (let i = 0; i < bellSamples.length; i++) {
  const t = i / sampleRate;
  const envelope = Math.exp(-t * 5); // slow decay
  // Mix A5 and E6 for a pleasant chime
  const freq1 = 880;
  const freq2 = 1318.51;
  const s1 = Math.sin(2 * Math.PI * freq1 * t) * 0.5;
  const s2 = Math.sin(2 * Math.PI * freq2 * t) * 0.5;
  bellSamples[i] = (s1 + s2) * envelope * 0.6;
}
writeWav('receive.wav', sampleRate, bellSamples);

// 3. Error sound (short double beep)
const errorDuration = 0.3;
const errorSamples = new Float32Array(Math.floor(sampleRate * errorDuration));
for (let i = 0; i < errorSamples.length; i++) {
  const t = i / sampleRate;
  const envelope = (t < 0.1 || (t > 0.15 && t < 0.25)) ? 1 : 0;
  errorSamples[i] = Math.sin(2 * Math.PI * 400 * t) * envelope * 0.5;
}
writeWav('error.wav', sampleRate, errorSamples);
