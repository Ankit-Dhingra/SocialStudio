export interface SynthesizedAudioClip {
  alignment?: { text: string; starts: number[] };
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
