import { Storyboard } from '../contracts/storyboard.js';
import { SynthesizedAudioClip } from '../tts/tts-provider.js';

export interface SceneTimelineSegment {
  sceneId: string;
  sceneIndex: number;
  type: string;
  startFrame: number;
  durationInFrames: number;
  audioDurationMs: number;
  cueFrames?: number[];
  wordFrames?: number[];
  audioSrc: string; // e.g. 'audio/runs/test-run-1/scene-0.mp3'
}

export interface VideoTimeline {
  fps: number;
  totalDurationInFrames: number;
  totalDurationSec: number;
  segments: SceneTimelineSegment[];
  bgmSrc?: string;
  bgmVolumeDucked: number; // default 0.12
}

export function buildVideoTimeline(
  storyboard: Storyboard,
  clips: SynthesizedAudioClip[],
  options: {
    fps?: number;
    scenePaddingFrames?: number;
    bgmSrc?: string;
    audioSrcPrefix?: string;
  } = {}
): VideoTimeline {
  const {
    fps = 30,
    scenePaddingFrames = 12, // 0.4s breathing room between scenes
    bgmSrc,
    audioSrcPrefix = '',
  } = options;

  let currentFrame = 0;
  const segments: SceneTimelineSegment[] = [];

  for (let i = 0; i < storyboard.scenes.length; i++) {
    const scene = storyboard.scenes[i];
    const clip = clips.find((c) => c.sceneIndex === i) || clips[i];

    const audioDurationMs = clip ? clip.durationMs : scene.durationTargetSec * 1000;
    const audioFrames = Math.ceil((audioDurationMs * fps) / 1000);
    const durationInFrames = audioFrames + (i === storyboard.scenes.length - 1 ? Math.max(fps * 2, scenePaddingFrames) : scenePaddingFrames);

    const audioSrc = clip
      ? audioSrcPrefix
        ? `${audioSrcPrefix}/${clip.filePath.split(/[\\/]/).pop()}`
        : clip.filePath
      : '';

    const steps = scene.type === 'collection'
      ? [{ cue: scene.visualProps.cue }]
      : scene.visualProps.steps ?? scene.visualProps.items;

    const cueFrames = Array.isArray(steps) ? steps.map((step, index) => {
      const cue = typeof step?.cue === 'string' ? step.cue.toLowerCase().trim() : '';
      if (cue && clip?.wordTimestamps && clip.wordTimestamps.length > 0) {
        const found = clip.wordTimestamps.find((w) => w.word.toLowerCase().includes(cue));
        if (found) return Math.round(found.start * fps);
      }
      const offset = cue ? scene.narration.toLowerCase().indexOf(cue) : -1;
      if (offset < 0) return Math.round((index * audioFrames) / steps.length);
      const alignment = clip?.alignment;
      const alignedOffset = alignment?.text.indexOf(cue) ?? -1;
      const seconds = alignment?.starts[alignedOffset];
      return seconds !== undefined
        ? Math.round(seconds * fps)
        : Math.round((audioFrames * offset) / scene.narration.length);
    }) : undefined;

    // Word frames mapped from Whisper timestamps or fallback alignment
    const cleanWords = scene.narration
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    let wordFrames: number[] | undefined;
    if (clip?.wordTimestamps && clip.wordTimestamps.length > 0 && cleanWords.length > 0) {
      const wWords = clip.wordTimestamps;
      wordFrames = cleanWords.map((_, idx) => {
        const ratio = cleanWords.length > 1 ? idx / (cleanWords.length - 1) : 0;
        const wIdx = Math.min(wWords.length - 1, Math.round(ratio * (wWords.length - 1)));
        return Math.round(wWords[wIdx].start * fps);
      });
    } else if (clip?.alignment && clip.alignment.text === scene.narration) {
      wordFrames = Array.from(scene.narration.matchAll(/\S+/g), (match) =>
        Math.round(clip.alignment!.starts[match.index!] * fps)
      );
    }

    segments.push({
      wordFrames,
      cueFrames,
      sceneId: scene.id,
      sceneIndex: i,
      type: scene.type,
      startFrame: currentFrame,
      durationInFrames,
      audioDurationMs,
      audioSrc,
    });

    currentFrame += durationInFrames;
  }

  return {
    fps,
    totalDurationInFrames: currentFrame,
    totalDurationSec: Number((currentFrame / fps).toFixed(2)),
    segments,
    bgmSrc,
    bgmVolumeDucked: 0.12,
  };
}
