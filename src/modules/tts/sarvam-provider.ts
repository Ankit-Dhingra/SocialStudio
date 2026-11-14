import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import getMp3Duration from 'get-mp3-duration';
import { TTSProvider, SynthesizedAudioClip } from './tts-provider.js';

export class SarvamTTSProvider implements TTSProvider {
  name = 'sarvam';
  private apiKey: string;
  private speaker: string;
  private model: string;
  private pace: number;

  constructor(
    apiKey: string,
    speaker = 'sunny_hi_reels',
    model = 'bulbul:v4-flash',
    pace = 1.0
  ) {
    this.apiKey = apiKey;
    this.speaker = speaker;
    this.model = model;
    this.pace = pace;
  }

  // Generates precise silent WAV audio using FFmpeg
  private generateSilenceWav(durationSec: number, outPath: string) {
    execFileSync('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', 'anullsrc=r=24000:cl=mono',
      '-t', durationSec.toFixed(3),
      outPath,
    ]);
  }

  // Core synthesis for an atomic text chunk with retry logic
  private async synthAtomicChunk(
    text: string,
    outputWavPath: string,
    speaker: string,
    pace: number
  ): Promise<void> {
    const payload = {
      text: text.trim(),
      language_code: speaker.includes('en') ? 'en-IN' : 'hi-IN',
      model: this.model,
      speaker: speaker,
      pace: pace,
      speech_sample_rate: 24000,
    };

    const maxRetries = 3;
    let data: { audios?: string[] } | null = null;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch('https://api.sarvam.ai/text-to-speech', {
          method: 'POST',
          headers: {
            'api-subscription-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errText = await res.text();
          if (res.status >= 500 && attempt < maxRetries) {
            console.warn(`[SarvamTTS] Attempt ${attempt} HTTP ${res.status}. Retrying in ${attempt * 1.5}s...`);
            await new Promise((r) => setTimeout(r, attempt * 1500));
            continue;
          }
          throw new Error(`Sarvam AI error [${res.status}]: ${errText.slice(0, 300)}`);
        }

        data = (await res.json()) as { audios?: string[] };
        break;
      } catch (err: any) {
        lastError = err;
        if (attempt < maxRetries) {
          console.warn(`[SarvamTTS] Network error on attempt ${attempt}: ${err.message}. Retrying...`);
          await new Promise((r) => setTimeout(r, attempt * 1500));
        }
      }
    }

    if (!data || !data.audios || !data.audios[0]) {
      throw lastError || new Error('Sarvam AI returned no audio content');
    }

    const wavBuffer = Buffer.from(data.audios[0], 'base64');
    fs.writeFileSync(outputWavPath, wavBuffer);
  }

  async synthesizeClip(
    text: string,
    outputFilePath: string,
    options?: { voice?: string; sceneId?: string; sceneIndex?: number; pace?: number }
  ): Promise<SynthesizedAudioClip> {
    const dir = path.dirname(outputFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const speaker = options?.voice || this.speaker;
    const pace = options?.pace ?? this.pace;

    // Sanitize Indian currency and numbers to prevent skipping or stretching
    let cleanText = text
      .replace(/₹\s*30\b|30\s*(rupaye|rupees)/gi, 'tees rupaye')
      .replace(/₹\s*80\b|80\s*(rupaye|rupees)|\bassi\s+rupaye\b/gi, '80 rupaye')
      .replace(/₹\s*(\d+)/g, '$1 rupaye')
      .replace(/₹/g, 'rupaye')
      // Technical acronyms and phrasing fixes
      .replace(/\bH3\b|\bH-3\b/g, 'H-Three')
      .replace(/\bTTL\b/g, 'T-T-L')
      .replace(/\bSamjho\s+ek\b/gi, 'Samjho! <break time="450ms"/> Ek')
      .replace(/\bsurge\s+pricing\b/gi, 'surge-pricing');

    // Standardize break tags: <break time="0.4s"/> or <break time="400ms"/> -> __BREAK_400ms__
    cleanText = cleanText.replace(/<break\s+time=["']([\d\.]+)(s|ms)["']\s*\/?>/gi, (_, val, unit) => {
      const ms = unit === 's' ? Math.round(parseFloat(val) * 1000) : parseInt(val, 10);
      return ` __BREAK_${ms}ms__ `;
    });

    const hasExplicitPauses = /__BREAK_\d+ms__/.test(cleanText);

    if (hasExplicitPauses) {
      // Split text into speech chunks and silence gaps
      const tokens = cleanText.split(/(__BREAK_\d+ms__)/g).map((s) => s.trim()).filter(Boolean);
      const concatFiles: string[] = [];
      const prefix = `temp_clip_${Date.now()}`;
      let partIdx = 0;

      try {
        for (const token of tokens) {
          const breakMatch = token.match(/^__BREAK_(\d+)ms__$/);
          if (breakMatch) {
            const ms = parseInt(breakMatch[1], 10);
            const silenceFile = path.join(dir, `${prefix}_sil_${partIdx}_${ms}ms.wav`);
            this.generateSilenceWav(ms / 1000, silenceFile);
            concatFiles.push(silenceFile);
          } else {
            const speechFile = path.join(dir, `${prefix}_spk_${partIdx}.wav`);
            await this.synthAtomicChunk(token, speechFile, speaker, pace);
            concatFiles.push(speechFile);
          }
          partIdx++;
        }

        const concatListPath = path.join(dir, `${prefix}_list.txt`);
        fs.writeFileSync(concatListPath, concatFiles.map((f) => `file '${path.resolve(f).replace(/\\/g, '/')}'`).join('\n'), 'utf8');

        execFileSync('ffmpeg', [
          '-y',
          '-f', 'concat',
          '-safe', '0',
          '-i', concatListPath,
          '-acodec', 'libmp3lame',
          '-b:a', '192k',
          outputFilePath,
        ]);

        if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);
      } finally {
        for (const f of concatFiles) {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        }
      }
    } else {
      // Single chunk synthesis
      const tempWavPath = outputFilePath.replace(/\.mp3$/i, '') + `_temp_${Date.now()}.wav`;
      try {
        await this.synthAtomicChunk(cleanText, tempWavPath, speaker, pace);
        execFileSync('ffmpeg', [
          '-y',
          '-i', tempWavPath,
          '-acodec', 'libmp3lame',
          '-b:a', '192k',
          outputFilePath,
        ]);
      } finally {
        if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);
      }
    }

    const mp3Buffer = fs.readFileSync(outputFilePath);
    const durationMs = getMp3Duration(mp3Buffer);
    const fileSizeBytes = mp3Buffer.length;

    return {
      sceneId: options?.sceneId || 'scene-0',
      sceneIndex: options?.sceneIndex ?? 0,
      filePath: outputFilePath,
      durationMs,
      format: 'mp3',
      fileSizeBytes,
    };
  }
}
