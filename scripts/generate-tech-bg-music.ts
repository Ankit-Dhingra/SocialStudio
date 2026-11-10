import fs from 'node:fs';
import path from 'node:path';

function createAmbientTechTrack(): Buffer {
  const sampleRate = 44100;
  const durationSec = 65; // 65 seconds loop
  const numSamples = sampleRate * durationSec;
  const numChannels = 2;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Musical Chord Frequencies (Modern Lofi / Ambient Tech in C Minor)
  // Chords: Cm9 (C, Eb, G, Bb, D), Abmaj7 (Ab, C, Eb, G), Fm9 (F, Ab, C, Eb, G), Bb7 (Bb, D, F, Ab)
  const chordProgression = [
    [130.81, 155.56, 196.00, 233.08, 293.66], // Cm9
    [103.83, 130.81, 155.56, 196.00, 246.94], // Abmaj7
    [87.31, 103.83, 130.81, 155.56, 196.00],  // Fm9
    [116.54, 146.83, 174.61, 233.08, 261.63], // Bb7
  ];

  const chordDuration = 4.0; // 4 seconds per chord

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const chordIndex = Math.floor((t / chordDuration) % chordProgression.length);
    const chord = chordProgression[chordIndex];
    const chordPhase = (t % chordDuration) / chordDuration;

    // Soft envelope with smooth fade
    const env = Math.sin(chordPhase * Math.PI) * 0.12;

    // Warm chord pad synthesis (sine + gentle harmonics)
    let sampleL = 0;
    let sampleR = 0;

    for (let c = 0; c < chord.length; c++) {
      const freq = chord[c];
      const pan = (c / (chord.length - 1)) * 0.4 + 0.3; // Stereo spread
      const wave = Math.sin(2 * Math.PI * freq * t) * 0.7 + Math.sin(2 * Math.PI * (freq * 2) * t) * 0.2;
      sampleL += wave * (1 - pan);
      sampleR += wave * pan;
    }

    // Add subtle deep sub-bass pulse
    const rootFreq = chord[0] / 2;
    const subBass = Math.sin(2 * Math.PI * rootFreq * t) * 0.08 * (0.8 + 0.2 * Math.sin(2 * Math.PI * 2 * t));
    sampleL += subBass;
    sampleR += subBass;

    // Master envelope for overall track (smooth fade in and out)
    const trackFade = Math.min(1, t / 1.5) * Math.min(1, (durationSec - t) / 2.0);
    const finalL = Math.max(-1, Math.min(1, (sampleL * env + subBass * 0.5) * trackFade * 0.7));
    const finalR = Math.max(-1, Math.min(1, (sampleR * env + subBass * 0.5) * trackFade * 0.7));

    buffer.writeInt16LE(Math.floor(finalL * 32767), offset);
    buffer.writeInt16LE(Math.floor(finalR * 32767), offset + 2);
    offset += 4;
  }

  return buffer;
}

const outDir = path.resolve('remotion/public/music');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const filePath = path.join(outDir, 'tech-ambient.wav');
const wavBuffer = createAmbientTechTrack();
fs.writeFileSync(filePath, wavBuffer);
console.log(`✅ Synthesized ambient tech background track: ${filePath} (${(wavBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);
