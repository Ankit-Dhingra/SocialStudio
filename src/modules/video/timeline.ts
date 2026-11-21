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
  speechRanges?: Array<{start: number; end: number}>;
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
  clips: SynthesizedAudioClip[] = [],
  options: {
    fps?: number;
    scenePaddingFrames?: number;
    bgmSrc?: string;
    audioSrcPrefix?: string;
  } = {}
): VideoTimeline {
  const {
    fps = 30,
    scenePaddingFrames = Math.round(fps * 0.06),
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
    const durationInFrames = audioFrames + (i === storyboard.scenes.length - 1 ? Math.max(Math.round(fps * 0.35), scenePaddingFrames) : scenePaddingFrames);

    const audioSrc = clip
      ? audioSrcPrefix
        ? `${audioSrcPrefix}/${clip.filePath.split(/[\\/]/).pop()}`
        : clip.filePath
      : '';

    const cleanWords = tokenize(scene.narration);
    const toFrame = (seconds: number) => Math.max(0, Math.min(audioFrames - 1, Math.round(seconds * fps)));
    const duration = audioDurationMs / 1000;
    const speechRanges: Array<{start: number; end: number}> = [];
    let cursor = 0;
    for (const quiet of clip?.quietIntervals || []) {
      if (quiet.start > cursor) speechRanges.push({start: cursor, end: Math.min(quiet.start, duration)});
      cursor = Math.max(cursor, quiet.end);
    }
    if (cursor < duration) speechRanges.push({start: cursor, end: duration});
    const alignment = clip?.alignment;
    const nativeWords = alignment && Array.from(alignment.text.matchAll(/\S+/g), m => ({
      word: m[0], start: alignment.starts[m.index!], end: alignment.starts[m.index! + m[0].length] ?? duration,
    }));
    const spoken = (nativeWords ?? clip?.wordTimestamps)?.filter(word =>
      typeof word.word === 'string' && Number.isFinite(word.start) && Number.isFinite(word.end)
    ).sort((a, b) => a.start - b.start);
    let wordFrames: number[] | undefined;
    if (spoken?.length && cleanWords.length) {
      const voiceWords = tokenize(clip?.spokenText || scene.spokenNarration || scene.narration);
      // Align in the spoken script first. Expanded acronyms and prices can add several
      // spoken words to one display token. Preserve sentence starts across scripts.
      const useVoice = matchSpokenWords(voiceWords, spoken).size > matchSpokenWords(cleanWords, spoken).size;
      const alignmentWords = useVoice ? voiceWords : cleanWords;
      const times = estimateWordStarts(alignmentWords, spoken, duration);
      const boundaries = (words: string[]) => [0, ...words.flatMap((w,i) =>
        i < words.length-1 && /[.!?।]["'’”]?$/.test(w) ? [i+1] : []), words.length];
      const display = boundaries(cleanWords);
      const voice = boundaries(alignmentWords);
      const sameSentences = display.length === voice.length;
      wordFrames = cleanWords.map((_, index) => {
        const sentence = sameSentences ? display.findIndex(end => end > index)-1 : 0;
        const left = sameSentences ? display[sentence] : 0;
        const right = sameSentences ? display[sentence+1] : cleanWords.length;
        const start = sameSentences ? voice[sentence] : 0;
        const end = sameSentences ? voice[sentence+1] : alignmentWords.length;
        return toFrame(times[start + Math.floor((index-left)*(end-start)/(right-left))]);
      });
    } else if (cleanWords.length && speechRanges.length) {
      // Anchor sentence starts to nearby measured pauses; distribute remaining words over speech only.
      const weights = cleanWords.map(w => Math.sqrt(w.length));
      const sum = weights.reduce((a,b) => a+b, 0);
      const voiced = speechRanges.reduce((a,r) => a+r.end-r.start, 0);
      let elapsed = 0;
      let rangeIndex = 0;
      let consumed = 0;
      wordFrames = weights.map((w,i) => {
        const target = elapsed / sum * voiced;
        elapsed += w;
        while (rangeIndex+1 < speechRanges.length && consumed + speechRanges[rangeIndex].end - speechRanges[rangeIndex].start <= target) {
          consumed += speechRanges[rangeIndex].end - speechRanges[rangeIndex].start;
          rangeIndex++;
        }
        const start = speechRanges[rangeIndex].start + target - consumed;
        return toFrame(start);
      });
      for (let i=1; i<cleanWords.length; i++) {
        if (!/[.!?।]$/.test(cleanWords[i-1])) continue;
        const nearest = speechRanges.find(r => Math.abs(toFrame(r.start)-wordFrames![i]) < fps*0.3 &&
          toFrame(r.start)>=wordFrames![i-1] && toFrame(r.start)<=(wordFrames![i+1] ?? audioFrames));
        if (nearest) wordFrames[i] = toFrame(nearest.start);
      }
    }

    let cues: Array<string | undefined> | undefined;
    if (scene.type === 'collection') cues = [scene.visualProps?.cue];
    if (scene.type === 'requestFlow') cues = scene.visualProps?.steps?.map((step: any) => step.cue ?? step.label);
    if (scene.type === 'queueTimeline') cues = scene.visualProps?.items?.map((item: any) => item.cue ?? item.name);
    if (scene.type === 'smartphoneMockup') {
      const explicitFee = String(scene.visualProps?.surgeDeliveryFee || '').replace(/\D/g, '');
      const primaryTokens = [
        ...(explicitFee ? [explicitFee] : []),
        '80', 'assi', 'अस्सी', 'surge', 'jump', 'spike', 'increase', 'charge', 'rate', 'price'
      ];
      let foundIdx = cleanWords.findIndex(w => {
        const norm = normalize(w);
        return primaryTokens.some(token => norm.includes(token));
      });
      if (foundIdx !== -1) {
        cues = [cleanWords[foundIdx]];
      } else if (scene.visualProps?.surgeDeliveryFee) {
        cues = [scene.visualProps.surgeDeliveryFee];
      }
    }
    if (scene.type === 'raceCondition') {
      // Wire atomic lock transition to race condition scene: prioritize SETNX / mutex over generic lock
      const primaryTokens = ['setnx', 'set en ex', 'mutex', 'atomic'];
      const secondaryTokens = ['lock', 'ex', 'nx'];
      let foundIdx = cleanWords.findIndex(w => {
        const norm = normalize(w);
        return primaryTokens.some(token => norm.includes(token));
      });
      if (foundIdx === -1) {
        foundIdx = cleanWords.findIndex(w => {
          const norm = normalize(w);
          return secondaryTokens.some(token => norm.includes(token));
        });
      }
      if (foundIdx !== -1) {
        cues = [cleanWords[foundIdx]];
      } else {
        cues = ['setnx'];
      }
    }
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
      speechRanges,
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
