import fs from 'node:fs';
import path from 'node:path';

function writeWav(filePath: string, sampleRate: number, numChannels: number, samples: Float32Array) {
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.floor(s * 32767), offset);
    offset += 2;
  }

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated SFX: ${filePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

// 1. Whoosh SFX (Soft filtered whoosh transition ~0.35s)
function createWhoosh(sampleRate = 44100): Float32Array {
  const duration = 0.35;
  const length = Math.floor(sampleRate * duration);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / length;
    const env = Math.sin(t * Math.PI) ** 2;
    const noise = Math.random() * 2 - 1;
    const sweep = Math.sin(2 * Math.PI * (200 + 1200 * t) * (i / sampleRate));
    out[i] = (noise * 0.4 + sweep * 0.6) * env * 0.45;
  }
  return out;
}

// 2. Pop SFX (Punchy bubble/code pop ~0.12s)
function createPop(sampleRate = 44100): Float32Array {
  const duration = 0.12;
  const length = Math.floor(sampleRate * duration);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / length;
    const env = Math.exp(-t * 28);
    const freq = 650 * (1 - t * 0.6);
    out[i] = Math.sin(2 * Math.PI * freq * (i / sampleRate)) * env * 0.65;
  }
  return out;
}

// 3. Ding SFX (Clear crystalline success bell ~0.6s)
function createDing(sampleRate = 44100): Float32Array {
  const duration = 0.6;
  const length = Math.floor(sampleRate * duration);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / length;
    const env = Math.exp(-t * 8);
    const fundamental = Math.sin(2 * Math.PI * 1760 * (i / sampleRate)); // A6
    const overtone = Math.sin(2 * Math.PI * 3520 * (i / sampleRate)) * 0.4;
    out[i] = (fundamental + overtone) * env * 0.55;
  }
  return out;
}

// 4. Buzzer SFX (Quick error buzz ~0.25s)
function createBuzzer(sampleRate = 44100): Float32Array {
  const duration = 0.25;
  const length = Math.floor(sampleRate * duration);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / length;
    const env = Math.exp(-t * 10);
    // Rough low sawtooth
    const phase = ((i / sampleRate) * 110) % 1;
    const saw = phase * 2 - 1;
    out[i] = saw * env * 0.4;
  }
  return out;
}

const dirs = [
  path.resolve('remotion/public/sfx'),
  path.resolve('media/raw_assets/sfx'),
];

for (const dir of dirs) {
  writeWav(path.join(dir, 'whoosh.wav'), 44100, 1, createWhoosh());
  writeWav(path.join(dir, 'pop.wav'), 44100, 1, createPop());
  writeWav(path.join(dir, 'ding.wav'), 44100, 1, createDing());
  writeWav(path.join(dir, 'buzzer.wav'), 44100, 1, createBuzzer());
}
console.log('✅ SFX Pack generated successfully!');
