import path from 'node:path';
import dotenv from 'dotenv';
import { Storyboard } from '../contracts/storyboard.js';
import { TTSProvider, SynthesizedAudioClip } from './tts-provider.js';
import { EdgeTTSProvider } from './edge-tts-provider.js';
import { ElevenLabsProvider } from './elevenlabs-provider.js';

dotenv.config();

export interface StoryboardAudioResult {
  totalDurationMs: number;
  totalDurationSec: number;
  clips: SynthesizedAudioClip[];
}

export function getTTSProvider(): TTSProvider {
  const provider = process.env.TTS_PROVIDER || 'edge';

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

    console.log(`[TTS] Synthesizing Scene ${i + 1}/${storyboard.scenes.length} (${scene.type})...`);
    let clip: SynthesizedAudioClip;
    try {
      clip = await provider.synthesizeClip(scene.narration, outputPath, {
        sceneId: scene.id,
        sceneIndex: i,
      });
    } catch (err: any) {
      if (!(provider instanceof EdgeTTSProvider)) {
        console.warn('[TTS] Primary voice unavailable. Regenerating the whole narration with Edge for a consistent voice.');
        return synthesizeStoryboardNarration(storyboard, runDir, new EdgeTTSProvider(process.env.EDGE_TTS_VOICE));
      } else {
        throw err;
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
