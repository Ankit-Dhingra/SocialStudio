import fs from 'node:fs';
import dotenv from 'dotenv';
import { SarvamTTSProvider } from '../src/modules/tts/sarvam-provider.js';

dotenv.config();

async function main() {
  const sarvamKey = process.env.SARVAM_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!sarvamKey) throw new Error('Missing SARVAM_API_KEY');

  const provider = new SarvamTTSProvider(sarvamKey, 'sunny_hi_reels', 'bulbul:v4-flash', 1.0);
  const testNarration =
    'Kal raat, ek concert ki last seat bachi thi. Maine book kiya. <break time="0.4s"/> Theek usi second, mere dost ne bhi try kiya. <break time="0.4s"/> Meri screen pe Confirmed aaya, uski pe bhi! Lekin seat toh ek hi thi. Ye kaise ho sakta hai?';

  const outPath = 'remotion/public/audio/runs/session_1794686310227_ao6wl/scene-0.mp3';
  console.log('[TTS Test] Synthesizing Scene 0 through SarvamTTSProvider...');

  const clip = await provider.synthesizeClip(testNarration, outPath);
  console.log(`✅ Synthesized clip: ${clip.filePath} (${clip.durationMs}ms, ${clip.fileSizeBytes} bytes)`);

  if (groqKey) {
    console.log('[TTS Test] Transcribing synthesized audio with Groq Whisper to verify full text...');
    const buffer = fs.readFileSync(outPath);
    const blob = new Blob([buffer], { type: 'audio/mp3' });
    const fd = new FormData();
    fd.append('file', blob, 'audio.mp3');
    fd.append('model', 'whisper-large-v3');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: fd,
    });
    const data = (await res.json()) as any;
    console.log('=== VERIFIED WHISPER TRANSCRIPTION ===');
    console.log(data.text);
  }
}

main().catch((err) => {
  console.error('❌ Error verifying TTS:', err);
  process.exit(1);
});
