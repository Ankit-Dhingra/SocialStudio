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


function tokenize(text: string): string[] {
  return text.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean);
}

function normalize(word: string): string {
  return word.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');
}

function matchSpokenWords(
  script: string[],
  spoken: NonNullable<SynthesizedAudioClip['wordTimestamps']>,
): Map<number, number> {
  const expected = script.map(normalize);
  const heard = spoken.map(word => normalize(word.word));
  const scores = Array.from({ length: expected.length + 1 }, () => new Uint32Array(heard.length + 1));
  for (let i = expected.length - 1; i >= 0; i--) {
    for (let j = heard.length - 1; j >= 0; j--) {
      scores[i][j] = expected[i] && expected[i] === heard[j]
        ? 1 + scores[i + 1][j + 1]
        : Math.max(scores[i + 1][j], scores[i][j + 1]);
    }
  }

  const anchors = new Map<number, number>();
  let i = 0;
  let j = 0;
  while (i < expected.length && j < heard.length && scores[i][j]) {
    if (expected[i] && expected[i] === heard[j]) {
      anchors.set(i++, j++);
    } else if (scores[i + 1][j] > scores[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return anchors;
}

function estimateWordStarts(
  words: string[],
  spoken: NonNullable<SynthesizedAudioClip['wordTimestamps']>,
  duration: number,
): number[] {
  const anchors = matchSpokenWords(words, spoken);
  const starts = new Array<number>(words.length);
  let previousIndex = -1;
  let previousTime = spoken[0].start;
  const lastWord = spoken[spoken.length - 1];
  // Estimate only unmatched runs, such as Hindi transcribed in Devanagari.
  for (const [index, time] of [
    ...Array.from(anchors, ([index, match]): [number, number] => [index, spoken[match].start]),
    [words.length, Math.min(duration, lastWord.end)] as [number, number],
  ]) {
    const span = Math.max(0, time - previousTime);
    for (let i = previousIndex + 1; i < index; i++) {
      const fraction = previousIndex < 0 ? i / Math.max(1, index) : (i - previousIndex) / (index - previousIndex);
      starts[i] = previousTime + fraction * span;
    }
    if (index < words.length) starts[index] = time;
    previousIndex = index;
    previousTime = time;
  }
  return starts;
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

    const cleanWords = tokenize(scene.narration);
    const toFrame = (seconds: number) => Math.max(0, Math.min(audioFrames - 1, Math.round(seconds * fps)));
    const spoken = clip?.wordTimestamps?.filter(word =>
      typeof word.word === 'string' && Number.isFinite(word.start) && Number.isFinite(word.end)
    ).sort((a, b) => a.start - b.start);
    let wordFrames: number[] | undefined;
    if (spoken?.length && cleanWords.length) {
      const voiceWords = scene.spokenNarration ? tokenize(scene.spokenNarration) : cleanWords;
      const alignmentWords = voiceWords.length === cleanWords.length ? voiceWords : cleanWords;
      wordFrames = estimateWordStarts(alignmentWords, spoken, audioDurationMs / 1000).map(toFrame);
    } else if (clip?.alignment?.text === scene.narration && !scene.narration.includes('<')) {
      wordFrames = Array.from(scene.narration.matchAll(/\S+/g), match =>
        toFrame(clip.alignment!.starts[match.index!])
      );
    }

    let cues: Array<string | undefined> | undefined;
    if (scene.type === 'collection') cues = [scene.visualProps.cue];
    if (scene.type === 'requestFlow') cues = scene.visualProps.steps.map(step => step.cue ?? step.label);
    if (scene.type === 'queueTimeline') cues = scene.visualProps.items.map(item => item.cue ?? item.name);
    const scriptTokens = cleanWords.map(normalize);
    let searchFrom = 0;
    const cueFrames = cues?.map((cue, index, allCues) => {
      const fallback = Math.round((index * audioFrames) / allCues.length);
      if (typeof cue !== 'string') return fallback;

      const phrase = tokenize(cue).map(normalize).filter(Boolean);
      if (!phrase.length) return fallback;
      const match = scriptTokens.findIndex((_, wordIndex) =>
        wordIndex >= searchFrom && phrase.every((word, offset) => scriptTokens[wordIndex + offset] === word)
      );
      if (match === -1) return fallback;
      searchFrom = match + phrase.length;
      return wordFrames?.[match] ?? Math.round((match * audioFrames) / cleanWords.length);
    });

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
