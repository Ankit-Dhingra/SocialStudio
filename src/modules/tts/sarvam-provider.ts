import {speechChunks} from './speech-text.js';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { TTSProvider, SynthesizedAudioClip } from './tts-provider.js';

const sampleRate = 24000;

export function findFfmpeg(): string {
  const candidates = [
    path.resolve('node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe'),
    path.resolve('node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg'),
    path.resolve('node_modules/@remotion/compositor-darwin-x64/ffmpeg'),
    path.resolve('node_modules/@remotion/compositor-darwin-arm64/ffmpeg'),
    'ffmpeg',
  ];
  for (const c of candidates) {
    if (c === 'ffmpeg' || fs.existsSync(c)) {
      return c;
    }
  }
  return 'ffmpeg';
}

function findFfprobe(): string {
  const candidates = [
    path.resolve('node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe'),
    path.resolve('node_modules/@remotion/compositor-linux-x64-gnu/ffprobe'),
    path.resolve('node_modules/@remotion/compositor-darwin-x64/ffprobe'),
    path.resolve('node_modules/@remotion/compositor-darwin-arm64/ffprobe'),
    'ffprobe',
  ];
  for (const c of candidates) {
    if (c === 'ffprobe' || fs.existsSync(c)) {
      return c;
    }
  }
  return 'ffprobe';
}

export function durationSeconds(filePath: string): number {
  const ffprobeBin = findFfprobe();
  const result = execFileSync(ffprobeBin, [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath,
  ], { encoding: 'utf8' });
  const duration = Number(result.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('Audio has no valid duration');
  }
  return duration;
}

export class SarvamTTSProvider implements TTSProvider {
  name = 'sarvam';

  constructor(
    private apiKey: string,
    private speaker = 'sunny_hi_reels',
    private model = 'bulbul:v4-flash',
    private pace = 0.95,
    private languageCode?: string,
  ) {}

  private async synthesizeChunk(text: string, filePath: string, speaker: string, pace: number) {
    const languageCode = this.languageCode ?? (speaker.split('_')[1] === 'en' ? 'en-IN' : 'hi-IN');
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await fetch('https://api.sarvam.ai/text-to-speech', {
          method: 'POST',
          headers: {
            'api-subscription-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            speaker,
            pace,
            model: this.model,
            language_code: languageCode,
            speech_sample_rate: sampleRate,
            output_audio_codec: 'wav',
          }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
          const error = new Error(`Sarvam AI error [${response.status}]: ${(await response.text()).slice(0, 300)}`);
          if (response.status < 500 && response.status !== 429) {
            throw Object.assign(error, { permanent: true });
          }
          throw error;
        }

        const { audios } = await response.json() as { audios?: string[] };
        if (!audios?.[0]) throw new Error('Sarvam AI returned no audio');
        fs.writeFileSync(filePath, Buffer.from(audios[0], 'base64'));
        const duration = durationSeconds(filePath);
        const wordCount = text.split(/\s+/).filter(word => /[\p{L}\p{N}]/u.test(word)).length;
        if (wordCount >= 5 && duration < wordCount * 0.12 / Math.max(1, pace)) {
          throw new Error(`Sarvam returned only ${duration.toFixed(2)}s for ${wordCount} words`);
        }
        return;
      } catch (error) {
        if (attempt >= 3 || (error as { permanent?: boolean }).permanent) throw error;
        console.warn(`[SarvamTTS] Attempt ${attempt} failed, retrying: ${(error as Error).message}`);
        await delay(attempt * 1000);
      }
    }
  }

  async synthesizeClip(
    text: string,
    outputFilePath: string,
    options?: { voice?: string; sceneId?: string; sceneIndex?: number; pace?: number },
  ): Promise<SynthesizedAudioClip> {
    const dir = path.dirname(outputFilePath);
    fs.mkdirSync(dir, { recursive: true });
    const speaker = options?.voice || this.speaker;
    const pace = options?.pace ?? this.pace;

    // Convert SSML breaks and tags into natural punctuation for smooth, human-like neural TTS flow.
    // This prevents unnatural tempo jumps and dead silent gaps between sentence fragments.
    const cleanText = text.trim();
    if (!cleanText) throw new Error('No narration text to synthesize');

    const workDir = fs.mkdtempSync(path.join(dir, 'sarvam-'));
    try {
      const ffmpegBin = findFfmpeg();

      // If text fits in standard single neural request (< 1500 chars), synthesize directly in one pass
      if (cleanText.length <= 1500) {
        const rawWav = path.join(workDir, 'raw.wav');
        await this.synthesizeChunk(cleanText, rawWav, speaker, pace);
        execFileSync(ffmpegBin, [
          '-loglevel', 'error', '-y', '-i', rawWav,
          '-c:a', 'libmp3lame', '-b:a', '192k', outputFilePath,
        ]);
      } else {
        // For very long text, split ONLY at natural sentence boundaries (।, ?, !)
        const matches = speechChunks(cleanText);
        const files: string[] = [];

        for (let i = 0; i < matches.length; i++) {
          const chunk = matches[i].trim();
          if (!chunk) continue;
          const chunkName = `chunk-${i}.wav`;
          const chunkPath = path.join(workDir, chunkName);
          await this.synthesizeChunk(chunk, chunkPath, speaker, pace);
          files.push(chunkName);
        }

        const listPath = path.join(workDir, 'concat.txt');
        fs.writeFileSync(listPath, files.map(f => `file '${f}'`).join('\n'));
        execFileSync(ffmpegBin, [
          '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
          '-c:a', 'libmp3lame', '-b:a', '192k', outputFilePath,
        ]);
      }

      const durationMs = Math.round(durationSeconds(outputFilePath) * 1000);
      const fileSizeBytes = fs.statSync(outputFilePath).size;

      return {
        sceneId: options?.sceneId || 'scene-0',
        sceneIndex: options?.sceneIndex ?? 0,
        filePath: outputFilePath,
        durationMs,
        format: 'mp3',
        fileSizeBytes,
      };
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  }
}
