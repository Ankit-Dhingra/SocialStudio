import fs from 'node:fs';
import path from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import getMp3Duration from 'get-mp3-duration';
import { TTSProvider, SynthesizedAudioClip } from './tts-provider.js';

export class EdgeTTSProvider implements TTSProvider {
  name = 'edge-tts';
  private defaultVoice: string;

  constructor(defaultVoice = 'hi-IN-MadhurNeural') {
    this.defaultVoice = defaultVoice;
  }

  async synthesizeClip(
    text: string,
    outputFilePath: string,
    options?: { voice?: string; sceneId?: string; sceneIndex?: number; rate?: string; pitch?: string }
  ): Promise<SynthesizedAudioClip> {
    const voice = options?.voice || this.defaultVoice;
    const rate = options?.rate || '+10%'; // 1.10x speed for natural conversational cadence
    const pitch = options?.pitch || '+2Hz';
    const dir = path.dirname(outputFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Clean up technical terms and symbols so neural voice speaks naturally
    const spokenText = text
      .replace(/\bconsole\.log\b/gi, 'console dot log')
      .replace(/\bsetTimeout\b/gi, 'set timeout')
      .replace(/=>/g, 'arrow')
      .replace(/[{}()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    // Pass rate and pitch options to toStream
    const { audioStream } = tts.toStream(spokenText, { rate, pitch });

    await new Promise<void>((resolve, reject) => {
      const fileStream = fs.createWriteStream(outputFilePath);
      audioStream.pipe(fileStream);
      fileStream.on('finish', () => resolve());
      fileStream.on('error', (err) => reject(err));
      audioStream.on('error', (err: any) => reject(err));
    });

    const buffer = fs.readFileSync(outputFilePath);
    const durationMs = getMp3Duration(buffer);
    const fileSizeBytes = buffer.length;

    if (fileSizeBytes < 1000 || durationMs <= 0) {
      throw new Error(`Synthesized audio file invalid or empty: size=${fileSizeBytes}B, duration=${durationMs}ms`);
    }

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
