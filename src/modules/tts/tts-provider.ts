export interface SynthesizedAudioClip {
  quietIntervals?: Array<{start: number; end: number}>;
  spokenText?: string;
  alignment?: { text: string; starts: number[] };
  wordTimestamps?: Array<{ word: string; start: number; end: number }>;
  sceneId: string;
  sceneIndex: number;
  filePath: string;
  durationMs: number;
  format: 'mp3';
  fileSizeBytes: number;
}

export interface TTSProvider {
  name: string;
  synthesizeClip(
    text: string,
    outputFilePath: string,
    options?: { voice?: string; sceneId?: string; sceneIndex?: number }
  ): Promise<SynthesizedAudioClip>;
}
