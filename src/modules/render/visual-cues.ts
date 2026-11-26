import type { Storyboard } from '../contracts/storyboard.js';
import type { VideoTimeline } from '../video/timeline.js';
import { cleanNarration } from '../video/visual-story.js';

export interface VisualCue {
  id: string;
  scene: number;
  text: string;
  startFrame: number;
  endFrame: number;
  startMs: number;
  endMs: number;
  wordFrom: number;
  wordTo: number;
}

export function buildVisualCues(storyboard: Storyboard, timeline: VideoTimeline): VisualCue[][] {
  return storyboard.scenes.map((scene, index) => {
    const segment = timeline.segments[index];
    if (!segment || segment.sceneId !== scene.id || segment.durationInFrames < 1) {
      throw new Error(`Scene ${index + 1} does not match its saved audio timeline.`);
    }
    const words = cleanNarration(scene.narration).split(/\s+/u).filter(Boolean);
    const marks = segment.wordFrames;
    if (!marks?.length || marks.length !== words.length || !marks.every(Number.isFinite)) {
      throw new Error(`Scene ${index + 1} is missing matching saved word timestamps.`);
    }
    const result: VisualCue[] = [];
    let from = 0;
    for (let word = 0; word < words.length; word++) {
      const length = word - from + 1;
      if (word < words.length - 1 && length < 8
        && !(length >= 3 && /[,.!?;।]$/u.test(words[word]))) continue;
      const startFrame = segment.startFrame + Math.max(0, marks[from]);
      const endFrame = segment.startFrame + Math.min(segment.durationInFrames, marks[word + 1] ?? segment.durationInFrames);
      result.push({ id: `s${index + 1}c${result.length + 1}`, scene: index, text: words.slice(from, word + 1).join(' '),
        startFrame, endFrame, startMs: Math.round(startFrame * 1000 / timeline.fps), endMs: Math.round(endFrame * 1000 / timeline.fps),
        wordFrom: from, wordTo: word + 1 });
      from = word + 1;
    }
    return result;
  });
}
