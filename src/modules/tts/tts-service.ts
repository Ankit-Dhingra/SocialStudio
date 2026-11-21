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
import { transliterateToPhoneticDevanagari } from './phonetic-service.js';
import { enforceWordBudget, rewriteStoryboardForDuration, scaleStoryboardForDuration } from '../ai-script/word-budget.js';

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
  fitDuration?: boolean;
  align?: boolean;
  durationPolicy?: 'deep-dive-reel' | 'preserve' | 'custom';
  minDurationSec?: number;
  maxDurationSec?: number;
  targetDurationSec?: number;
  maxRetries?: number;
  onStoryboardRevised?: (storyboard: Storyboard) => void | Promise<void>;
}

export async function synthesizeStoryboardNarration(
  storyboard: Storyboard,
  runDir: string,
  provider = getTTSProvider(),
  options: SynthesizeNarrationOptions = {},
): Promise<StoryboardAudioResult> {
  // Scope duration policy: deep-dive reel requires 90–120s duration gate and word budget.
  // Shorter callers (e.g. 15–45s or <10 scenes) with 'preserve' or default preserve their natural duration.
  const isDeepDive =
    options.durationPolicy === 'deep-dive-reel' ||
    (options.durationPolicy !== 'preserve' && storyboard.scenes.length >= 10);

  const minDurationSec = options.minDurationSec ?? 90.0;
  const maxDurationSec = options.maxDurationSec ?? 120.0;
  const targetDurationSec = options.targetDurationSec ?? 105.0;
  const maxRetries = options.maxRetries ?? 2;

  // 1. Automatic word-budget revision before TTS for deep-dive reels
  if (isDeepDive) {
    enforceWordBudget(storyboard);
    if (options.onStoryboardRevised) {
      await options.onStoryboardRevised(storyboard);
    }
  }

  let attempt = 0;
  let finalResult: StoryboardAudioResult | null = null;

  while (attempt <= (isDeepDive ? maxRetries : 0)) {
    attempt++;
    const clips: SynthesizedAudioClip[] = [];
    let totalDurationMs = 0;

    for (let i = 0; i < storyboard.scenes.length; i++) {
      const scene = storyboard.scenes[i];
      const outputFilename = `scene-${i}.mp3`;
      const outputPath = path.join(runDir, outputFilename);

      // For Sarvam or Indian Hindi TTS, apply Devanagari phonetic terms (hindi = true)
      // to guarantee accurate pronunciation (same -> सेम, Redis -> रेडिस, etc.)
      const isHindiProvider = provider.name === 'sarvam' || provider.name === 'edge';
      const textToSynthesize = prepareSpeech(scene.spokenNarration || scene.narration, isHindiProvider);

      console.log(`[TTS] Synthesizing Scene ${i + 1}/${storyboard.scenes.length} (${scene.type}, attempt ${attempt})...`);
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

      clip.spokenText = textToSynthesize;
      clips.push(clip);
    }

    // Natural tempo (tempo = 1.0)
    for (const clip of clips) {
      masterVoice(clip, 1.0);

      // High-precision alignment using Groq Whisper if available
      if (options.align !== false && !clip.alignment && process.env.GROQ_API_KEY) {
        try {
          const prompt = clip.spokenText || storyboard.scenes[clip.sceneIndex]?.spokenNarration || storyboard.scenes[clip.sceneIndex]?.narration;
          const words = await alignAudioWithGroq(clip.filePath, prompt);
          if (words && words.length > 0) {
            clip.wordTimestamps = words;
            console.log(`  🎯 [Alignment] Aligned ${words.length} spoken words via Groq Whisper for Scene ${clip.sceneIndex + 1}`);
          }
        } catch {
          // Fallback safely to duration interpolation
        }
      }

      totalDurationMs += clip.durationMs;
    }

    const measuredDurationSec = Number((totalDurationMs / 1000).toFixed(2));
    finalResult = {
      totalDurationMs,
      totalDurationSec: measuredDurationSec,
      clips,
    };

    if (!isDeepDive) {
      // Non-deep-dive callers preserve their exact duration without duration gate or retries
      break;
    }

    console.log(`[TTS Gate] Measured total narration duration: ${measuredDurationSec}s (Specification: ${minDurationSec}–${maxDurationSec}s, attempt ${attempt}/${maxRetries + 1})`);

    // Measured 90-120s Duration Gate Check
    if (measuredDurationSec >= minDurationSec && measuredDurationSec <= maxDurationSec) {
      console.log(`✅ [TTS Gate PASSED] Narration duration ${measuredDurationSec}s is firmly within the ${minDurationSec}–${maxDurationSec}s specification!`);
      break;
    }

    if (attempt <= maxRetries) {
      console.warn(`⚠️ [TTS Gate] Narration duration ${measuredDurationSec}s is outside ${minDurationSec}–${maxDurationSec}s. Rewriting complete scene sentences for ${targetDurationSec}s target and resynthesizing at natural tempo...`);
      rewriteStoryboardForDuration(storyboard, measuredDurationSec, targetDurationSec, { minDurationSec, maxDurationSec });
      if (options.onStoryboardRevised) {
        await options.onStoryboardRevised(storyboard);
      }
    } else {
      const errMsg = `[TTS Gate REJECTED] Narration duration ${measuredDurationSec}s is outside specification [${minDurationSec}s–${maxDurationSec}s] after bounded ${maxRetries} retries.`;
      console.error(`❌ ${errMsg}`);
      throw new Error(errMsg);
    }
  }

  return finalResult!;
}
