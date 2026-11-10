import { CollectionPropsSchema, HookPropsSchema, RequestFlowPropsSchema, QueueTimelinePropsSchema, CodeWalkthroughPropsSchema, ComparisonPropsSchema, SummaryPropsSchema } from '../contracts/storyboard.js';
import type { Storyboard } from '../contracts/storyboard.js';

const sceneSchemas = { collection: CollectionPropsSchema, hook: HookPropsSchema, code: CodeWalkthroughPropsSchema, requestFlow: RequestFlowPropsSchema,
  queueTimeline: QueueTimelinePropsSchema, comparison: ComparisonPropsSchema, summary: SummaryPropsSchema, raceCondition: undefined };

export function validateLesson(storyboard: Storyboard): Storyboard {
  if (storyboard.scenes[0].type !== 'hook' || storyboard.scenes.at(-1)?.type !== 'summary') {
    throw new Error('Open with the question and finish with a summary answering it.');
  }
  const ending = storyboard.scenes.at(-1)!.narration.trim();
  const teaching = ending.split(/[.!?।]+/u)
    .filter(sentence => !/\b(?:follow|subscribe|save|share|like|comment)\b/i.test(sentence))
    .join(' ').trim();
  if (teaching.split(/\s+/u).length < 7 || /[,;:…-]$|\.\.\.$/u.test(ending)) {
    throw new Error('Finish the narration with the observed result and its cause before any call to action.');
  }
  if (!storyboard.scenes.some(s => ['requestFlow', 'queueTimeline', 'collection', 'raceCondition'].includes(s.type))) {
    throw new Error('Include a labelled diagram showing the intermediate states of the example.');
  }
  for (const scene of storyboard.scenes) {
    const schema = sceneSchemas[scene.type];
    if (schema) schema.parse(scene.visualProps);
  }
  return storyboard;
}
