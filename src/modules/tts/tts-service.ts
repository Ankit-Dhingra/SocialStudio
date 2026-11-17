import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { Storyboard } from '../contracts/storyboard.js';
import { TTSProvider, SynthesizedAudioClip } from './tts-provider.js';
import { EdgeTTSProvider } from './edge-tts-provider.js';
import { ElevenLabsProvider } from './elevenlabs-provider.js';
import { SarvamTTSProvider } from './sarvam-provider.js';
import { transliterateToPhoneticDevanagari } from './phonetic-service.js';

dotenv.config();

export interface StoryboardAudioResult {
  totalDurationMs: number;
  totalDurationSec: number;
  clips: SynthesizedAudioClip[];
}

export function getTTSProvider(): TTSProvider {
  const provider = process.env.TTS_PROVIDER || 'sarvam';

  if (provider === 'sarvam') {
    const key = process.env.SARVAM_API_KEY;
    if (key) {
      return new SarvamTTSProvider(
        key,
        process.env.SARVAM_SPEAKER || 'sunny_hi_reels',
        process.env.SARVAM_MODEL || 'bulbul:v4-flash',
        Number(process.env.SARVAM_PACE || '1'),
        process.env.SARVAM_LANGUAGE_CODE || undefined
      );
    }
    console.warn('Sarvam API key missing in environment; falling back to edge-tts.');
  }

  if (provider === 'elevenlabs') {
    const key = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    if (key && voiceId) {
      return new ElevenLabsProvider(key, voiceId, process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2');
    }
    console.warn('ElevenLabs credentials missing; falling back to free Edge-TTS neural voice.');
  }

  const defaultVoice = process.env.EDGE_TTS_VOICE || 'hi-IN-MadhurNeural';
  return new EdgeTTSProvider(defaultVoice);
}

export async function alignAudioWithGroq(
  audioFilePath: string
): Promise<Array<{ word: string; start: number; end: number }>> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !fs.existsSync(audioFilePath)) return [];

  try {
    const buffer = fs.readFileSync(audioFilePath);
    const blob = new Blob([buffer], { type: 'audio/mp3' });
    const fd = new FormData();
    fd.append('file', blob, path.basename(audioFilePath));
    fd.append('model', 'whisper-large-v3');
    fd.append('response_format', 'verbose_json');
    fd.append('timestamp_granularities[]', 'word');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
    });
    if (!res.ok) {
      console.warn(`[Groq Whisper Alignment] HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as any;
    return data.words || [];
  } catch (err: any) {
    console.warn(`[Groq Whisper Alignment Error]:`, err.message);
    return [];
  }
}

export async function synthesizeStoryboardNarration(
  storyboard: Storyboard,
  runDir: string,
  provider = getTTSProvider()
): Promise<StoryboardAudioResult> {
  const clips: SynthesizedAudioClip[] = [];
  let totalDurationMs = 0;

  for (let i = 0; i < storyboard.scenes.length; i++) {
    const scene = storyboard.scenes[i];
    const outputFilename = `scene-${i}.mp3`;
    const outputPath = path.join(runDir, outputFilename);

    // If using Sarvam, ensure spoken text is in phonetic Devanagari for 100% pronunciation accuracy
    let textToSynthesize = scene.spokenNarration;
    if (provider.name === 'sarvam') {
      if (!textToSynthesize || !/[\u0900-\u097F]/.test(textToSynthesize)) {
        console.log(`[TTS] Transliterating Scene ${i + 1} to universal phonetic Devanagari for Sarvam AI...`);
        textToSynthesize = await transliterateToPhoneticDevanagari(scene.narration);
        scene.spokenNarration = textToSynthesize;
      }
    } else {
      textToSynthesize = textToSynthesize || scene.narration;
    }

    console.log(`[TTS] Synthesizing Scene ${i + 1}/${storyboard.scenes.length} (${scene.type})...`);
    let clip: SynthesizedAudioClip;
    try {
      clip = await provider.synthesizeClip(textToSynthesize, outputPath, {
        sceneId: scene.id,
        sceneIndex: i,
      });
    } catch (err: any) {
      console.error(`\n❌ [TTS Error] Provider '${provider.name}' failed on Scene ${i + 1}:`, err.message);
      throw new Error(`TTS generation failed with '${provider.name}': ${err.message}. Check your API keys and quotas.`);
    }

    // High-precision alignment using Groq Whisper if available
    if (process.env.GROQ_API_KEY) {
      try {
        const words = await alignAudioWithGroq(outputPath);
        if (words && words.length > 0) {
          clip.wordTimestamps = words;
          console.log(`  🎯 [Alignment] Aligned ${words.length} spoken words via Groq Whisper for Scene ${i + 1}`);
        }
      } catch {
        // Fallback safely to duration interpolation
      }
    }

    clips.push(clip);
    totalDurationMs += clip.durationMs;
  }

  return {
    totalDurationMs,
    totalDurationSec: Number((totalDurationMs / 1000).toFixed(2)),
    clips,
  };
}
