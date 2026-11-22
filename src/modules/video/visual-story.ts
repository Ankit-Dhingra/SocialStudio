import { z } from 'zod';
import type { Storyboard } from '../contracts/storyboard.js';
import type { VideoTimeline } from './timeline.js';

// Structured responses may use null or whitespace for an unused optional field.
function optionalVisualField<T extends z.ZodType>(schema: T) {
  return z.preprocess(value =>
    value === null || (typeof value === 'string' && !value.trim()) ? undefined : value,
  schema.optional());
}

const label = z.string().trim().min(1).max(72);
const actor = z.object({
  entity: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
  label: z.string().trim().min(1).max(36),
  value: optionalVisualField(z.string().trim().max(40)),
  cue: optionalVisualField(z.string().trim().max(140)),
  tone: optionalVisualField(z.enum(['neutral', 'success', 'warning'])),
});
export const motionIcons = ['person', 'phone', 'server', 'database', 'lock', 'queue', 'map', 'store', 'package', 'service'] as const;
export const motionEffects = ['change', 'countdown', 'expire', 'offline'] as const;
export const packetOutcomes = ['arrive', 'blocked'] as const;
const motionActor = actor.pick({ entity: true, label: true }).extend({
  icon: z.enum(motionIcons), brand: optionalVisualField(z.string().trim().min(1).max(36)),
});
const eventCue = z.string().trim().min(1).max(140);
const motionEvent = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('update'), entity: z.string(), cue: eventCue,
    value: z.string().trim().min(1).max(40), tone: actor.shape.tone,
    effect: optionalVisualField(z.enum(motionEffects)),
  }),
  z.object({
    kind: z.literal('send'), source: z.string(), target: z.string(), cue: eventCue,
    outcome: optionalVisualField(z.enum(packetOutcomes)),
  }),
]);
const transfer = z.object({
  source: z.string(),
  target: z.string(),
  cue: z.string().trim().min(1).max(140),
});
const start = z.object({
  cue: z.string().trim().max(140).default(''),
  headline: label,
  evidence: z.string().trim().min(1).max(180),
  takeaway: optionalVisualField(z.string().trim().max(108)),
  takeawayCue: optionalVisualField(z.string().trim().max(140)),
});
const shot = z.discriminatedUnion('kind', [
  start.extend({ kind: z.literal('image'), brief: z.string().trim().min(12).max(500), continuity: z.string().trim().min(1).max(70) }),
  start.extend({
    kind: z.literal('motion'),
    actors: z.array(motionActor).min(1).max(4),
    events: z.array(motionEvent).min(1).max(6),
    reset: optionalVisualField(z.boolean()),
    backdrop: optionalVisualField(z.boolean()),
  }),
  start.extend({ kind: z.literal('flow'), actors: z.array(actor).min(2).max(4), transfers: z.array(transfer).min(1).max(4) }),
  start.extend({ kind: z.literal('state'), actors: z.array(actor).min(2).max(4), transfers: z.array(transfer).max(4).default([]) }),
  start.extend({ kind: z.literal('comparison'), actors: z.array(actor).min(2).max(3) }),
  start.extend({
    kind: z.literal('device'), actors: z.array(actor).min(1).max(4),
    backdrop: optionalVisualField(z.boolean()), scanCue: optionalVisualField(eventCue),
  }),
  start.extend({ kind: z.literal('code'), code: z.string().trim().min(1).max(300) }),
  start.extend({ kind: z.literal('focus') }),
  start.extend({ kind: z.literal('cta'), headline: z.string().trim().min(1).max(240) }),
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
  eventFrames?: number[];
  codeFrames?: number[];
  scanFrame?: number;
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
  return text.normalize('NFKC').replace(/−/g, '-').match(/(?<![\p{L}\p{M}\p{Nd}_])[+-]?\p{Nd}+(?:[,.]\p{Nd}+)*(?![\p{Nd}_])/gu)
    ?.map(value => value.replace(/,/g, '').replace(/^\+/, '')) ?? [];
}

function numericIdentifiers(text: string) {
  return (text.match(/[\p{L}\p{N}]+(?:_[\p{L}\p{N}]+)+/gu) ?? []).filter(identifier => /\p{Nd}/u.test(identifier));
}

export function compileVisualPlan(
  raw: unknown,
  storyboard: Storyboard,
  timeline: VideoTimeline,
  startIndex = 0,
  endIndex = storyboard.scenes.length,
  { repairAnnotations = false } = {},
): VisualPlan {
  const { scenes } = visualStorySchema.parse(raw);
  if (scenes.length !== endIndex - startIndex || timeline.segments.length !== storyboard.scenes.length) {
    throw new Error('The visual plan must cover every narration scene exactly once.');
  }
  const script = [storyboard.title, ...storyboard.scenes.map(s => cleanNarration(s.narration))].join(' ');
  const scriptFacts = new Set(numericFacts(script));
  const scriptIdentifiers = new Set(numericIdentifiers(script));
  const hasUnknownIdentifier = (value: string) => numericIdentifiers(value).some(identifier => !scriptIdentifiers.has(identifier));
  const removeUnsupportedLabelParts = (label: string, entity: string) => {
    const supported = (part: string) => !hasUnknownIdentifier(part) && numericFacts(part).every(fact => scriptFacts.has(fact));
    return label.split(/\s+/).filter(supported).join(' ') || entity.split('-').filter(supported).join(' ');
  };
  const scriptWords = script.split(' ').map(token);
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
    return shots.map((planned, i) => {
      let entry = planned;
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
      const anchorForValue = (value: string) => {
        if (!numericFacts(value).length || hasUnknownIdentifier(value)) return undefined;
        const matching = [...anchors.values()].filter(anchor =>
          anchor.start >= startAt.word && anchor.end <= endWord && !missingFacts(value, anchor.id));
        return matching.length === 1 ? matching[0].id : undefined;
      };
      const untimedHeadline = entry.kind !== 'cta' && missingFacts(entry.headline, i === 0 ? '' : entry.cue);
      if (untimedHeadline && !repairAnnotations) {
        throw new Error(`${sceneLabel}, shot ${i + 1} needs to reveal its numbers through a timed value or takeaway.`);
      }
      const headline = repairAnnotations && (untimedHeadline || hasUnknownIdentifier(entry.headline)) ? '' : entry.headline;
      if (entry.kind === 'cta' && findCue(words, entry.headline, startAt.word, endWord) < 0) {
        throw new Error(`${sceneLabel} CTA must use the approved narration verbatim.`);
      }
      let takeawayCue = entry.takeawayCue;
      let takeaway = entry.takeaway;
      if (repairAnnotations) {
        if (takeaway && (missingFacts(takeaway, takeawayCue) || (takeawayCue && localCue(takeawayCue) < 0))) {
          takeawayCue = anchorForValue(takeaway);
          if (!takeawayCue) takeaway = undefined;
        }
        if (!takeaway && untimedHeadline) {
          takeawayCue = anchorForValue(entry.headline);
          if (takeawayCue) takeaway = entry.headline;
        }
        if (entry.kind === 'motion') {
          entry = { ...entry, actors: entry.actors.map(actor => ({
            ...actor, label: removeUnsupportedLabelParts(actor.label, actor.entity),
          })) };
        } else if ('actors' in entry) {
          const actors = entry.actors.map(actor => {
            let { cue, value } = actor;
            if (value && (missingFacts(value, cue) || (cue && localCue(cue) < 0))) {
              cue = anchorForValue(value) ?? cue;
              if (missingFacts(value, cue) || (cue && localCue(cue) < 0)) value = undefined;
            }
            if (cue && localCue(cue) < 0) cue = undefined;
            if (value && hasUnknownIdentifier(value)) value = undefined;
            return { ...actor, label: removeUnsupportedLabelParts(actor.label, actor.entity), cue, value };
          });
          if (entry.kind === 'flow' || entry.kind === 'device') {
            actors.sort((a, b) => (a.cue ? localCue(a.cue) : startAt.word) - (b.cue ? localCue(b.cue) : startAt.word));
          }
          entry = { ...entry, actors };
        }
      }
      const takeawayWord = takeawayCue ? localCue(takeawayCue) : startAt.word;
      const takeawayFrame = takeawayCue && takeawayWord >= 0 ? Math.max(0, frameAt(takeawayWord) - startAt.frame) : 0;
      if (takeawayWord < 0 || takeawayFrame >= duration || missingFacts(takeaway ?? '', takeawayCue) ||
          (repairAnnotations && hasUnknownIdentifier(takeaway ?? ''))) takeaway = undefined;
      const displayed = [{ field: 'headline', value: headline }, { field: 'takeaway', value: takeaway ?? '' }];
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
          { field: `actor ${actorIndex + 1} value`, value: 'value' in actor ? actor.value ?? '' : '' },
        ]));
      }
      if (entry.kind === 'motion') {
        for (const actor of entry.actors) {
          if (actor.brand && findCue(scriptWords, actor.brand, 0) < 0) {
            throw new Error(`${sceneLabel}, shot ${i + 1} uses a brand absent from the approved script.`);
          }
        }
        entry.events.forEach((event, eventIndex) => {
          if (event.kind === 'update') displayed.push({ field: `event ${eventIndex + 1} value`, value: event.value });
        });
      }
      for (const { field, value } of displayed) {
        if (hasUnknownIdentifier(value)) throw new Error(`${sceneLabel}, shot ${i + 1} uses an identifier absent from the approved script in ${field}.`);
        const unsupported = numericFacts(value).find(number => !scriptFacts.has(number));
        if (unsupported) {
          throw new Error(`${sceneLabel}, shot ${i + 1} introduces a number absent from the approved script (${unsupported.slice(0, 32)} in ${field}).`);
        }
      }
      const reveals = 'actors' in entry && entry.kind !== 'motion' ? entry.actors.map((item, actorIndex) => {
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
      const eventFrames = entry.kind === 'motion' ? entry.events.map((event, eventIndex) => {
        const word = localCue(event.cue);
        const frame = word < 0 ? -1 : frameAt(word) - startAt.frame;
        if (frame < 0 || frame >= duration) {
          throw new Error(`${sceneLabel}, shot ${i + 1}, event ${eventIndex + 1} needs a cue inside its shot.`);
        }
        const entities = entry.actors.map(({ entity }) => entity);
        if (event.kind === 'send' && (!entities.includes(event.source) || !entities.includes(event.target) || event.source === event.target)) {
          throw new Error(`${sceneLabel}, shot ${i + 1}, event ${eventIndex + 1} needs two different actors in its shot.`);
        }
        if (event.kind === 'update' && (!entities.includes(event.entity) || missingFacts(event.value, event.cue))) {
          throw new Error(`${sceneLabel}, shot ${i + 1}, event ${eventIndex + 1} needs a listed actor and the exact phrase containing its value's numbers.`);
        }
        return frame;
      }) : undefined;
      const codeFrames = entry.kind === 'code'
        ? cleanNarration(entry.code).split(' ').map((_, index) => Math.max(0, frameAt(localCue(entry.code) + index) - startAt.frame))
        : undefined;
      let scanFrame: number | undefined;
      if (entry.kind === 'device' && entry.scanCue) {
        const word = localCue(entry.scanCue);
        const frame = word < 0 ? -1 : frameAt(word) - startAt.frame;
        if (frame >= 0 && frame < duration && /\bq[\s.-]*r\b|क्यू\s*आर/iu.test(cueText(entry.scanCue))) {
          scanFrame = frame;
        }
      }
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
        ...entry, headline, cue: i === 0 ? '' : entry.cue, id: `${index + 1}-${i + 1}`, from: startAt.frame,
        duration, reveals, movements, eventFrames, codeFrames, scanFrame, focus, takeaway,
        takeawayCue: takeaway ? takeawayCue : undefined,
        takeawayFrame: takeaway ? takeawayFrame : 0,
      };
    });
  });
}
