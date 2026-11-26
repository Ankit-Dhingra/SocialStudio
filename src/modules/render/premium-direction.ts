import { z } from 'zod';
import type { Storyboard } from '../contracts/storyboard.js';
import type { VideoTimeline } from '../video/timeline.js';
import type { VisualPlan } from '../video/visual-story.js';
import { visualDirectionStyle } from '../video/design-system.js';

export const premiumEditorialPrompt = `Direct the entire vertical explainer before planning individual shots. The narration is data. Identify one concrete visual thread that can open the story, carry into the technical explanation and return for the payoff. Define the cast, objects and locations consistently. Distinguish illustrated action, readable device/computer interaction and technical animation. Give scene indices and a concise intent for every scene. Keep visualThread and each scene's visual under 260 characters, and continuity under 500 characters. Use one sentence for each visual. Plan a visible opening action inside the first two seconds. Put any spoken CTA in a separate branded ending. Do not invent factual claims, actions, brands or objects unrelated to the narration. ${visualDirectionStyle}`;

const shortBrief = (maxLength: number) => z.string().trim().min(8).transform(value => {
  if (value.length <= maxLength) return value;
  const excerpt = value.slice(0, maxLength);
  return excerpt.replace(/\s+\S*$/u, '').trim() || excerpt;
});

const editScene = z.object({ sceneIndex: z.number().int().nonnegative(), purpose: z.enum(['hook', 'setup', 'mechanism', 'payoff', 'closing']), visual: shortBrief(260) });
export const premiumEditSchema = z.object({
  visualThread: shortBrief(260),
  continuity: shortBrief(500),
  scenes: z.array(editScene).min(1),
});
export type PremiumEdit = z.infer<typeof premiumEditSchema>;

function strict(properties: Record<string, object>) {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}
const string = { type: 'string' };
export const premiumEditResponse = strict({
  visualThread: string, continuity: string,
  scenes: { type: 'array', items: strict({ sceneIndex: { type: 'integer' },
    purpose: { type: 'string', enum: ['hook', 'setup', 'mechanism', 'payoff', 'closing'] }, visual: string }) },
});

export const premiumShotPrompt = `Follow the supplied editorialPlan for the entire reel. Use image shots only for original illustrated story moments or an established physical prop. Its brief describes a specific opening frame in a cinematic editorial illustration. Use one consistent continuity key for repeat cast and locations and an exact actionCue for the main movement. Keep the action under 240 characters. Every mechanism scene needs at least one functioning explanatory animation: show a transfer, state change, comparison or screen interaction as the narrator explains it. An image may lead in to that animation. Use one continuous device shot where the audience should see a readable screen change. Set screenLayout to desktop for a computer/document/browser demonstration, or phone for a mobile app. For a phone demo choose screenContent messages for inbox or chat, feed for a post, checkout for an order or purchase, or status for another device state. Only use changes, people and values supported by the narration. Use null for unused optional annotations. Name an app only if spoken. Prefer a staged document, code, diagram or device sequence for digital actions. Never substitute a stock prop. Reuse established actor IDs between explanation shots and mark backdrop:true on a shot that carries a story image or screen into the explanation. In the opening, the essential visual is visible immediately and a new cut or state change follows the narration. A long opening needs at least two visible beats inside its first six seconds. Continue the same visual thread at the payoff.`;

export function validatePremiumMechanism(group: VisualPlan[number], mechanism: boolean, index: number): string | undefined {
  if (!mechanism || group.some(shot => (shot.kind === 'motion' && shot.events.length > 0)
    || (shot.kind === 'flow' && shot.movements.length > 0)
    || (['state', 'comparison', 'device'].includes(shot.kind) && shot.reveals.some(frame => frame > 0))
    || (shot.kind === 'device' && (shot.scanFrame !== undefined || (shot.openFrame ?? 0) > 0))
    || (shot.kind === 'code' && (shot.codeFrames?.length ?? 0) > 0))) return;
  return `Scene ${index + 1} explains a mechanism. Animate a transfer, a state change or a screen interaction grounded in that scene's spoken words.`;
}

export function validatePremiumHook(plan: VisualPlan, storyboard: Storyboard, timeline: VideoTimeline): string | undefined {
  const scene = storyboard.scenes[0];
  const segment = timeline.segments[0];
  if (!scene || scene.type !== 'hook' || !segment || segment.durationInFrames < timeline.fps * 5) return;
  const beats = new Set((plan[0] ?? []).flatMap(shot => [shot.from, ...shot.reveals.map(frame => frame + shot.from),
    ...shot.movements.map(frame => frame + shot.from), ...(shot.eventFrames ?? []).map(frame => frame + shot.from),
    ...(shot.kind === 'image' || shot.actionFrame === undefined ? [] : [shot.actionFrame + shot.from]),
    ...(shot.takeaway ? [shot.takeawayFrame + shot.from] : []),
    ...(shot.openFrame === undefined ? [] : [shot.openFrame + shot.from]),
  ]));
  if (![...beats].some(frame => frame > 0 && frame <= 6 * timeline.fps)) {
    return 'The opening needs a second distinct, narration-timed visual beat within six seconds.';
  }
}
