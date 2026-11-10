import fs from 'node:fs';
import path from 'node:path';
import getMp3Duration from 'get-mp3-duration';
import { TTSProvider, SynthesizedAudioClip } from './tts-provider.js';

export class ElevenLabsProvider implements TTSProvider {
  name = 'elevenlabs';
  private apiKey: string;
  private voiceId: string;
  private model: string;

  constructor(apiKey: string, voiceId: string, model = 'eleven_multilingual_v2') {
    this.apiKey = apiKey;
    this.voiceId = voiceId;
    this.model = model;
  }

  async synthesizeClip(
    text: string,
    outputFilePath: string,
    options?: { voice?: string; sceneId?: string; sceneIndex?: number }
  ): Promise<SynthesizedAudioClip> {
    const voiceId = options?.voice || this.voiceId;
    const dir = path.dirname(outputFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: this.model,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
          style: 0.25,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`ElevenLabs error [${res.status}]: ${err.slice(0, 300)}`);
    }

    const data = await res.json();
    const buffer = Buffer.from(data.audio_base64, 'base64');
    const alignment = data.alignment && {
      text: data.alignment.characters.join(''),
      starts: data.alignment.character_start_times_seconds,
    };
    fs.writeFileSync(outputFilePath, buffer);

    const durationMs = getMp3Duration(buffer);
    const fileSizeBytes = buffer.length;

    return {
      sceneId: options?.sceneId || 'scene-0',
      sceneIndex: options?.sceneIndex ?? 0,
      alignment,
      filePath: outputFilePath,
      durationMs,
      format: 'mp3',
      fileSizeBytes,
    };
  }
}
