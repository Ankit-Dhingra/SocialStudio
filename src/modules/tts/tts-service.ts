import {prepareSpeech} from './speech-text.js';
import {masterVoice} from './master-voice.js';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { Storyboard } from '../contracts/storyboard.js';
import { TTSProvider, SynthesizedAudioClip } from './tts-provider.js';
import { EdgeTTSProvider } from './edge-tts-provider.js';
import { ElevenLabsProvider } from './elevenlabs-provider.js';
import { SarvamTTSProvider } from './sarvam-provider.js';

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
        Number(process.env.SARVAM_PACE || '0.95'),
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
  audioFilePath: string,
  promptText?: string
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
    if (promptText) {
      fd.append('prompt', promptText);
    }

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
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

export interface SynthesizeNarrationOptions {
  align?: boolean;
}

export async function synthesizeStoryboardNarration(
  storyboard: Storyboard,
  runDir: string,
  provider = getTTSProvider(),
  options: SynthesizeNarrationOptions = {},
): Promise<StoryboardAudioResult> {
  const clips: SynthesizedAudioClip[] = [];
  const isHindiProvider = provider.name === 'sarvam' || provider.name === 'edge';
  for (const [sceneIndex, scene] of storyboard.scenes.entries()) {
    const outputPath = path.join(runDir, `scene-${sceneIndex}.mp3`);
    const spokenText = prepareSpeech(scene.spokenNarration || scene.narration, isHindiProvider);
    console.log(`[TTS] Synthesizing Scene ${sceneIndex + 1}/${storyboard.scenes.length} (${scene.type})...`);
    let clip: SynthesizedAudioClip;
    try {
      clip = await provider.synthesizeClip(spokenText, outputPath, { sceneId: scene.id, sceneIndex });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`Scene ${sceneIndex + 1} TTS failed with '${provider.name}': ${detail}`);
    }
    clips.push({ ...clip, sceneId: scene.id, sceneIndex, spokenText });
  }

  for (const clip of clips) {
    masterVoice(clip);
    if (options.align !== false && !clip.alignment && process.env.GROQ_API_KEY) {
      const words = await alignAudioWithGroq(clip.filePath, clip.spokenText);
      if (words.length) clip.wordTimestamps = words;
    }
  }

  const totalDurationMs = clips.reduce((total, clip) => total + clip.durationMs, 0);
  return { clips, totalDurationMs, totalDurationSec: Number((totalDurationMs / 1000).toFixed(2)) };
}
