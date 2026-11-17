import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { TTSProvider, SynthesizedAudioClip } from './tts-provider.js';

const sampleRate = 24000;

function findFfmpeg(): string {
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

function getWavDuration(filePath: string): number | null {
  try {
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(44);
    fs.readSync(fd, header, 0, 44, 0);
    fs.closeSync(fd);
    if (header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WAVE') {
      const byteRate = header.readUInt32LE(28);
      const dataSize = header.readUInt32LE(40);
      if (byteRate > 0 && dataSize > 0) {
        return dataSize / byteRate;
      }
    }
  } catch {}
  return null;
}

function durationSeconds(filePath: string): number {
  const wavDuration = getWavDuration(filePath);
  if (wavDuration !== null && Number.isFinite(wavDuration) && wavDuration > 0) {
    return wavDuration;
  }

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
    private pace = 1.0,
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
            text, speaker, pace, model: this.model, language_code: languageCode,
            speech_sample_rate: sampleRate, output_audio_codec: 'wav',
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
        if (wordCount >= 5 && duration < wordCount * 0.15 / Math.max(1, pace)) {
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

    // Sarvam does not interpret SSML. Keep explicit breaks local, and leave
    // punctuation and wording intact so the model can use sentence context.
    const parts = text.split(/(<break\s+time=["']\d+(?:\.\d+)?(?:ms|s)["']\s*\/?>)/gi);
    const workDir = fs.mkdtempSync(path.join(dir, 'sarvam-'));
    try {
      const files: string[] = [];
      let speechParts = 0;
      for (const part of parts) {
        const token = part.trim();
        if (!token) continue;

        const name = `${files.length}.wav`;
        const filePath = path.join(workDir, name);
        const pause = token.match(/^<break\s+time=["']([\d.]+)(ms|s)["']\s*\/?>$/i);
        if (pause) {
          const seconds = Number(pause[1]) / (pause[2].toLowerCase() === 'ms' ? 1000 : 1);
          if (seconds === 0) continue;
          const ffmpegBin = findFfmpeg();
          execFileSync(ffmpegBin, [
            '-loglevel', 'error', '-f', 'lavfi', '-i', `anullsrc=r=${sampleRate}:cl=mono`,
            '-t', String(seconds), filePath,
          ]);
        } else {
          await this.synthesizeChunk(token, filePath, speaker, pace);
          speechParts++;
        }
        files.push(name);
      }
      if (!speechParts) throw new Error('No narration text to synthesize');

      const listPath = path.join(workDir, 'concat.txt');
      fs.writeFileSync(listPath, files.map(file => `file '${file}'`).join('\n'));
      const stagedMp3 = path.join(workDir, 'narration.mp3');
      const ffmpegBin = findFfmpeg();
      execFileSync(ffmpegBin, [
        '-loglevel', 'error', '-f', 'concat', '-i', listPath,
        '-c:a', 'libmp3lame', '-b:a', '192k', stagedMp3,
      ]);
      const durationMs = Math.round(durationSeconds(stagedMp3) * 1000);
      const fileSizeBytes = fs.statSync(stagedMp3).size;
      fs.renameSync(stagedMp3, outputFilePath);
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
