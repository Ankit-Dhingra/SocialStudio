import { z } from 'zod';
import type { Storyboard } from '../contracts/storyboard.js';
import type { VideoTimeline } from './timeline.js';

const label = z.string().trim().min(1).max(72);
const actor = z.object({
  entity: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
  label: z.string().trim().min(1).max(36),
  value: z.string().trim().max(40).optional(),
  cue: z.string().trim().max(140).optional(),
  tone: z.enum(['neutral', 'success', 'warning']).optional(),
});
const transfer = z.object({
  source: z.string(),
  target: z.string(),
  cue: z.string().trim().min(1).max(140),
});
const start = z.object({
  cue: z.string().trim().max(140).default(''),
  headline: label,
  evidence: z.string().trim().min(1).max(180),
  takeaway: z.string().trim().max(108).optional(),
  takeawayCue: z.string().trim().max(140).optional(),
});
const shot = z.discriminatedUnion('kind', [
  start.extend({ kind: z.literal('image'), brief: z.string().trim().min(12).max(500), continuity: z.string().trim().min(1).max(70) }),
  start.extend({ kind: z.literal('flow'), actors: z.array(actor).min(2).max(4), transfers: z.array(transfer).min(1).max(4) }),
  start.extend({ kind: z.literal('state'), actors: z.array(actor).min(2).max(4), transfers: z.array(transfer).max(4).default([]) }),
  start.extend({ kind: z.literal('comparison'), actors: z.array(actor).min(2).max(3) }),
  start.extend({ kind: z.literal('device'), actors: z.array(actor).min(1).max(4) }),
  start.extend({ kind: z.literal('code'), code: z.string().trim().min(1).max(300) }),
  start.extend({ kind: z.enum(['focus', 'cta']) }),
]);
export const visualSceneSchema = z.object({
  sceneIndex: z.number().int().nonnegative(),
  shots: z.array(shot).min(1).max(3),
});
export const visualStorySchema = z.object({ scenes: z.array(visualSceneSchema).min(1) });

export type VisualStory = z.infer<typeof visualStorySchema>;
export type TimedShot = z.infer<typeof shot> & {
  id: string;
  from: number;
  duration: number;
  asset?: string;
  reveals: number[];
  movements: number[];
  takeawayFrame: number;
  focus?: { beats: Array<{ text: string; from: number }>; code?: string };
};
export type VisualPlan = TimedShot[][];

export function cleanNarration(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function narrationAnchors(narration: string, maxWords = 9): Array<{ id: string; text: string; start: number; end: number }> {
  const words = cleanNarration(narration).split(' ').filter(Boolean);
  const anchors = [];
  let start = 0;
  for (const [index, word] of words.entries()) {
    if (index - start >= maxWords - 1 || /[.!?।,;:]["'’”]?$/.test(word) || index === words.length - 1) {
      anchors.push({ id: `@${anchors.length + 1}`, text: words.slice(start, index + 1).join(' '), start, end: index + 1 });
      start = index + 1;
    }
  }
  return anchors;
}

const token = (word: string) => word.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}₹$€£]/gu, '');
function findCue(words: string[], phrase: string, from: number, end = words.length): number {
  const cue = cleanNarration(phrase).split(' ').map(token).filter(Boolean);
  if (!cue.length) return -1;
  return words.findIndex((_, i) => i >= from && i + cue.length <= end && cue.every((word, j) => word === words[i + j]));
}

// Preserve exact digits while treating comma-separated numbers as a single value.
export function numericFacts(text: string): string[] {
  return text.normalize('NFKC').replace(/−/g, '-').match(/(?<![\p{L}\p{Nd}])[+-]?\p{Nd}+(?:[,.]\p{Nd}+)*/gu)
    ?.map(value => value.replace(/,/g, '').replace(/^\+/, '')) ?? [];
}

export function compileVisualPlan(
  raw: unknown,
  storyboard: Storyboard,
  timeline: VideoTimeline,
  startIndex = 0,
  endIndex = storyboard.scenes.length,
): VisualPlan {
  const { scenes } = visualStorySchema.parse(raw);
  if (scenes.length !== endIndex - startIndex || timeline.segments.length !== storyboard.scenes.length) {
    throw new Error('The visual plan must cover every narration scene exactly once.');
  }
  const scriptFacts = new Set(numericFacts([storyboard.title, ...storyboard.scenes.map(s => cleanNarration(s.narration))].join(' ')));
  return scenes.map(({ sceneIndex, shots }, batchIndex) => {
    const index = startIndex + batchIndex;
    const scene = storyboard.scenes[index];
    const segment = timeline.segments[index];
    const sceneLabel = `Scene ${index + 1}`;
    if (sceneIndex !== index || segment.sceneId !== scene.id || segment.durationInFrames <= 0) {
      throw new Error(`${sceneLabel} does not match the locked narration timeline.`);
    }
    const narration = cleanNarration(scene.narration);
    const narrationWords = narration.split(' ');
    const words = narrationWords.map(token);
    const anchors = new Map(narrationAnchors(narration).map(anchor => [anchor.id, anchor]));
    const cueText = (phrase = '') => anchors.get(phrase)?.text ?? phrase;
    const findSceneCue = (phrase: string, from: number, end = words.length) => {
      const anchor = anchors.get(phrase);
      if (anchor) return anchor.start >= from && anchor.end <= end ? anchor.start : -1;
      if (/^@\d+$/.test(phrase)) return -1;
      return findCue(words, phrase, from, end);
    };
    const frameAt = (word: number) => segment.wordFrames?.[word] ??
      Math.round(word / Math.max(1, words.length) * segment.audioDurationMs * timeline.fps / 1000);
    let lastWord = -1;
    const starts = shots.map((entry, i) => {
      const word = i === 0 ? 0 : findSceneCue(entry.cue, lastWord + 1);
      if (word < 0 || (i === 0 && word !== 0)) {
        throw new Error(`${sceneLabel}, shot ${i + 1} needs an exact cue in narration order.`);
      }
      lastWord = word;
      return { word, frame: i === 0 ? 0 : frameAt(word) };
    });
    return shots.map((entry, i) => {
      const startAt = starts[i];
      const next = starts[i + 1];
      const duration = (next?.frame ?? segment.durationInFrames) - startAt.frame;
      if (duration < Math.min(Math.round(timeline.fps * 0.6), segment.durationInFrames)) {
        throw new Error(`${sceneLabel}, shot ${i + 1} has too little time before the next cue.`);
      }
      const endWord = next?.word ?? words.length;
      const localCue = (phrase: string) => findSceneCue(phrase, startAt.word, endWord);
      if (localCue(entry.evidence) < 0) throw new Error(`${sceneLabel}, shot ${i + 1} needs an exact supporting phrase from its narration.`);
      const missingFacts = (value: string, cue = '') => numericFacts(value).some(fact => !numericFacts(cueText(cue)).includes(fact));
      if (missingFacts(entry.headline, i === 0 ? '' : entry.cue)) {
        throw new Error(`${sceneLabel}, shot ${i + 1} needs to reveal its numbers through a timed value or takeaway.`);
      }
      if (entry.kind === 'cta' && findCue(words, entry.headline, startAt.word, endWord) < 0) {
        throw new Error(`${sceneLabel} CTA must use the approved narration verbatim.`);
      }
      const takeawayWord = entry.takeawayCue ? localCue(entry.takeawayCue) : startAt.word;
      const takeawayFrame = entry.takeawayCue && takeawayWord >= 0 ? Math.max(0, frameAt(takeawayWord) - startAt.frame) : 0;
      const takeaway = takeawayWord >= 0 && takeawayFrame < duration && !missingFacts(entry.takeaway ?? '', entry.takeawayCue)
        ? entry.takeaway : undefined;
      const displayed = [{ field: 'headline', value: entry.headline }, { field: 'takeaway', value: takeaway ?? '' }];
      if (entry.kind === 'code') {
        if (!narration.includes(cleanNarration(entry.code))) throw new Error(`${sceneLabel} contains code absent from its narration.`);
        displayed.push({ field: 'code', value: entry.code });
      }
      if ('actors' in entry) {
        if (new Set(entry.actors.map(a => a.entity)).size !== entry.actors.length) {
          throw new Error(`${sceneLabel}, shot ${i + 1} repeats an entity ID.`);
        }
        displayed.push(...entry.actors.flatMap((actor, actorIndex) => [
          { field: `actor ${actorIndex + 1} label`, value: actor.label },
          { field: `actor ${actorIndex + 1} value`, value: actor.value ?? '' },
        ]));
      }
      for (const { field, value } of displayed) {
        const unsupported = numericFacts(value).find(number => !scriptFacts.has(number));
        if (unsupported) {
          throw new Error(`${sceneLabel}, shot ${i + 1} introduces a number absent from the approved script (${unsupported.slice(0, 32)} in ${field}).`);
        }
      }
      const reveals = 'actors' in entry ? entry.actors.map((item, actorIndex) => {
        if (missingFacts(item.value ?? '', item.cue)) {
          throw new Error(`${sceneLabel}, shot ${i + 1}, item ${actorIndex + 1} needs the exact phrase containing its number.`);
        }
        if (!item.cue) return 0;
        const word = localCue(item.cue);
        if (word < 0) throw new Error(`${sceneLabel}, shot ${i + 1}, item ${actorIndex + 1} has an unmatched reveal cue.`);
        return Math.max(0, frameAt(word) - startAt.frame);
      }) : entry.kind === 'code' ? [Math.max(0, frameAt(localCue(entry.code)) - startAt.frame)] : [];
      if (entry.kind === 'code' && localCue(entry.code) < 0) throw new Error(`${sceneLabel} contains code outside the shot narration.`);
      if (reveals.some((frame, actorIndex) => frame >= duration || ((entry.kind === 'flow' || entry.kind === 'device') && actorIndex > 0 && frame < reveals[actorIndex - 1]))) {
        throw new Error(`${sceneLabel}, shot ${i + 1} has a reveal outside its shot or an out-of-order flow.`);
      }
      const movements = 'transfers' in entry ? entry.transfers.map(transfer => {
        const source = entry.actors.findIndex(a => a.entity === transfer.source);
        const target = entry.actors.findIndex(a => a.entity === transfer.target);
        const word = localCue(transfer.cue);
        if (source < 0 || target < 0 || source === target || word < 0) {
          throw new Error(`${sceneLabel}, shot ${i + 1} has an ungrounded transfer.`);
        }
        const frame = Math.max(0, frameAt(word) - startAt.frame);
        if (frame >= duration) throw new Error(`${sceneLabel}, shot ${i + 1} has a transfer outside its shot.`);
        return frame;
      }) : [];
      let focus: TimedShot['focus'];
      if (entry.kind === 'focus' && duration > timeline.fps * 6) {
        const beatStarts = [startAt.word, ...narrationAnchors(narration, 16).map(anchor => anchor.start).filter(word =>
          word > startAt.word && word < endWord && frameAt(word) < startAt.frame + duration)];
        const preceding = shots[i - 1];
        focus = {
          beats: beatStarts.map((word, beatIndex) => ({
            text: narrationWords.slice(word, beatStarts[beatIndex + 1] ?? endWord).join(' '),
            from: beatIndex === 0 ? 0 : Math.max(0, frameAt(word) - startAt.frame),
          })),
          code: preceding?.kind === 'code' ? preceding.code : undefined,
        };
      }
      return {
        ...entry, cue: i === 0 ? '' : entry.cue, id: `${index + 1}-${i + 1}`, from: startAt.frame,
        duration, reveals, movements, focus, takeaway, takeawayCue: takeaway ? entry.takeawayCue : undefined,
        takeawayFrame: takeaway ? takeawayFrame : 0,
      };
    });
  });
}
