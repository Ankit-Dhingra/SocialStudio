import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { z } from 'zod';
import { GeminiProvider } from '../ai-script/gemini-provider.js';
import { GroqProvider, GroqRateLimitError } from '../ai-script/groq-provider.js';
import type { Storyboard, StoryboardScene } from '../contracts/storyboard.js';
import type { VideoTimeline } from '../video/timeline.js';
import { conciseVisualLabel, operationProposal, type SemanticOperation } from '../video/semantic-operation.js';
import { cleanNarration, compileVisualPlan, motionIcons, packetOutcomes, screenActions,
  type NativeScene, type StoryDirectionOverrides, type TimedShot } from '../video/visual-story.js';
import { approvedClosingCard, prepareSceneArtwork, type ReelVisualAssets } from './reel-visual-assets.js';
import { loadApprovedVisualAssets } from './approved-visual-assets.js';
import { vectorCapabilities, vectorCompositionSchema, type TimedVector } from '../video/vector-spec.js';
import { compileVector } from './compile-vector.js';
import { describeResponseSchema } from './describe-response-schema.js';
import { compileSavedSemanticSequences, planSemanticVisuals, type SemanticVisualState } from './semantic-visual-planner.js';
import { loadVisualDirectorReference } from './visual-director-reference.js';

const scenePlanVersion = 'storyboard-scenes-v8';
const directorBatchSize = 4;

const sceneFields = {
  sceneIndex: z.number().int().min(0),
  openingArtwork: z.string().trim().max(240).nullable(),
};
const beatFields = {
  label: z.string().trim().min(1).max(48),
  detail: z.string().trim().max(88),
  cue: z.string().trim().min(1).max(96),
};
const plainBeats = z.array(z.strictObject({ ...beatFields, action: z.null() })).max(4);
const point = z.strictObject({ x: z.number().min(0.08).max(0.90), y: z.number().min(0.14).max(0.76) });
const diagram = z.strictObject({
  nodes: z.array(z.strictObject({
    id: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
    label: z.string().trim().min(1).max(36),
    icon: z.enum(motionIcons),
  })).min(1).max(4),
  events: z.array(z.strictObject({
    kind: z.enum(['send', 'update']),
    source: z.string(),
    target: z.string().nullable(),
    cue: z.string().trim().min(1).max(96),
    value: z.string().trim().min(1).max(40).nullable(),
    outcome: z.enum(packetOutcomes).nullable(),
  })).min(1).max(6),
});
const vectorProposal = z.strictObject({ ...sceneFields, layout: z.literal('vector'), openingArtwork: z.null(), screen: z.null(),
  diagram: z.null(), beats: plainBeats.max(0), throughSceneIndex: z.number().int().min(0).optional(), vector: vectorCompositionSchema });
const sceneProposal = z.union([
  vectorProposal,
  z.strictObject({ ...sceneFields, layout: z.literal('operation'), openingArtwork: z.null(), screen: z.null(),
    diagram: z.null(), beats: plainBeats.max(0), operation: operationProposal }),
  z.strictObject({ ...sceneFields, layout: z.literal('layered'), beats: plainBeats, diagram: z.null(),
    screen: z.null(), openingArtwork: z.null(), backgroundId: z.string(),
    subjects: z.array(z.strictObject({ assetId: z.string(), cue: beatFields.cue,
      start: point, end: point, width: z.number().min(0.10).max(0.48),
      seconds: z.number().min(0.3).max(4) })).min(1).max(3) }),
  z.strictObject({ ...sceneFields, layout: z.literal('cinematic'), diagram: z.null(), screen: z.null(),
    openingArtwork: z.string().trim().min(12).max(240), beats: plainBeats.min(1) }),
  z.strictObject({ ...sceneFields, layout: z.enum(['diagram']), beats: plainBeats, diagram, screen: z.null() }),
  z.strictObject({
    ...sceneFields, layout: z.enum(['device']), diagram: z.null(),
    beats: z.array(z.strictObject({ ...beatFields, action: z.enum(screenActions) })).min(2).max(4),
    screen: z.strictObject({
      appName: z.string().trim().min(1).max(48).nullable(),
      layout: z.enum(['phone', 'desktop']),
      content: z.enum(['messages', 'feed', 'checkout', 'status', 'document']),
    }),
  }),
  z.strictObject({
    ...sceneFields, layout: z.enum(['queue', 'comparison', 'trend', 'beats']),
    beats: plainBeats.min(1), diagram: z.null(), screen: z.null(),
  }),
]);
const proposalSchema = z.strictObject({ scenes: z.array(sceneProposal) });
const { $schema, ...responseSchema } = z.toJSONSchema(proposalSchema, {
  reused: 'ref',
  override: ({ jsonSchema }) => {
    if (Array.isArray(jsonSchema.prefixItems) && jsonSchema.items === false) {
      // Express the same closed tuple without a boolean items schema.
      const length = jsonSchema.prefixItems.length;
      delete jsonSchema.items;
      jsonSchema.minItems = length;
      jsonSchema.maxItems = length;
    }
  },
});
const groqResponseGuide = describeResponseSchema(responseSchema);
type Proposal = z.infer<typeof sceneProposal>;

function parseVectorReply(candidate: Record<string, unknown>) {
  const raw = candidate.vector;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return vectorProposal.safeParse(candidate);
  const vector = { ...raw } as Record<string, unknown>;
  for (const field of ['definitions', 'treatments', 'repeats', 'tracks']) vector[field] ??= [];
  for (const field of ['connectors', 'cameraTrack']) if (vector[field] === null) delete vector[field];
  vector.camera ??= null;
  if (Array.isArray(vector.layers)) {
    const layers = vector.layers as Array<Record<string, unknown>>;
    const ids = new Set(layers.map(layer => layer?.id));
    const parents = new Set(layers.map(layer => layer?.parent).filter(Boolean));
    const wraps = new Map<unknown, string>();
    for (const [index, layer] of layers.entries()) {
      if (!layer || typeof layer.id !== 'string' || !parents.has(layer.id)
        || (layer.shape as { kind?: string } | undefined)?.kind === 'group') continue;
      let wrapperId = `group-${index + 1}`;
      while (ids.has(wrapperId)) wrapperId += '-g';
      ids.add(wrapperId);
      wraps.set(layer.id, wrapperId);
    }
    if (wraps.size) {
      vector.layers = layers.flatMap(layer => {
        if (!layer) return [layer];
        const parent = wraps.get(layer.parent) ?? layer.parent;
        const group = wraps.get(layer.id);
        return group ? [{ id: group, parent, at: layer.at, fill: 'none', stroke: 'none', shape: { kind: 'group' } },
          { ...layer, parent: group, at: null }] : [{ ...layer, parent }];
      });
      if (Array.isArray(vector.tracks)) {
        vector.tracks = vector.tracks.map(track => track && ['move', 'rotate', 'scale', 'opacity', 'follow'].includes(track.kind)
          ? { ...track, target: wraps.get(track.target) ?? track.target } : track);
      }
    }
  }
  return vectorProposal.safeParse({ ...candidate, vector, beats: [],
    openingArtwork: candidate.openingArtwork ?? null, diagram: candidate.diagram ?? null, screen: candidate.screen ?? null,
    throughSceneIndex: candidate.throughSceneIndex ?? undefined });
}

const direction = `Direct a Behind The Tech explainer from locked narration. Use the golden reference for visual hierarchy, technical details and restrained motion. Its coordinates are unrelated to the production 900 by 1120 artboard. Draw original compositions for this topic.
Use the full artboard, foreground on the shared near-black grid, cyan data flow, purple processing, and meaningful success, warning and failure states. No outer backing panel. Use short English technical labels and Roman Hinglish for any ordinary display text. Base labels on the approved title or narration and never invent company metrics.
Return JSON matching outputSchema. The guide uses ? for optional properties and | for alternatives. Omit optional fields when unused. Return exactly one proposal per requested index in order, or one complete vector at the start of a consecutive span. Its throughSceneIndex is the LAST requested zero-based index included, and it replaces all interior proposals. Connect the earlier and later states using stable IDs, placement and data flow.
Use vector for a mechanism requiring original geometry. Name one to four focal layer IDs. Make the focal geometry large. Use technical objects for internal detail, large labels (32–52 artboard units), reusable groups for editable geometry and repeats for grids. Only a group may be a parent. Put vector beats:[], diagram:null, screen:null, openingArtwork:null. Keep a real visible subject at frame zero and animate an actual state change. Translate by offsets from base coordinates. Use one track of each kind per target. Ports attach to stationary visible objects. Use via:[] for automatic orthogonal routing. Connector packets must follow the flow. Values in a numerical vector are illustrative only.
Every cue must be a short exact phrase copied from its own narration. A spanning cue may be prefixed by one-based scene number and |. Use null at for objects visible from the start. Labels and cues serve different purposes.
For real messages or updates, diagram requires actual participants, real transfer words at the cue and an observed outcome. Use beats:[]. Use operation for narrated counts, timed expiry and selection. Use narrated names, facts and verbatim counts. Use device for a real app interaction, with 2–4 timed actions and the app name only when spoken. Comparison and trend require comparable observations, with identical metric units for trend. Use queue for an actual job lifecycle. Use beats only for an explicitly connective transition under two seconds.
For a physical moment, use layered if the approved catalog has a suitable backdrop and moving subject. If artworkAvailable is true and no asset matches, cinematic supports a relevant nine-by-sixteen illustration with grounded beats. Use vector geometry as a meaningful alternative when an asset is unavailable. During repair fix the reported validation problems for the missing indices only. Keep earlier valid scenes intact.`;
type TimedBeat = { label: string; description: string; from: number; action?: (typeof screenActions)[number] };

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function phraseWords(value: string): string[] {
  return cleanNarration(value).normalize('NFKC').toLowerCase().split(/\s+/u)
    .map(word => word.replace(/^[^\p{L}\p{M}\p{N}₹$€£+−-]+|[^\p{L}\p{M}\p{N}₹$€£%]+$/gu, ''));
}

function findPhrase(words: string[], phrase: string, from = 0): number {
  const target = phraseWords(phrase).filter(Boolean);
  return target.length ? words.findIndex((_, index) =>
    index >= from && target.every((word, offset) => word === words[index + offset])) : -1;
}

function shortPhrase(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max + 1).replace(/\s+\S*$/u, '').slice(0, max);
}

function sceneTiming(scene: StoryboardScene, segment: VideoTimeline['segments'][number], fps: number) {
  const narration = cleanNarration(scene.narration).trim();
  const words = phraseWords(narration);
  const frameAt = (word: number) => Math.min(segment.durationInFrames - 1, Math.max(0,
    segment.wordFrames?.[word] ?? Math.round(word * segment.audioDurationMs * fps / (1000 * words.length))));
  return { narration, words, frameAt };
}

function timedSteps(
  beats: Array<Omit<Proposal['beats'][number], 'action'> & { action?: Proposal['beats'][number]['action'] }>,
  timing: ReturnType<typeof sceneTiming>, duration: number, fps: number,
): TimedBeat[] {
  const { words, frameAt } = timing;
  const steps: TimedBeat[] = [];
  let lastWord = -1;
  for (const { label, detail, cue, action } of beats) {
    const word = findPhrase(words, cue, lastWord + 1);
    if (word === -1) continue;
    const supports = (phrase: string) => {
      const match = findPhrase(words, phrase, Math.max(0, word - 5));
      return match >= 0 && match < word + 13;
    };
    if (!action && (!supports(label) || (detail && !supports(detail)))) continue;
    const displayLabel = supports(label) ? label : shortPhrase(cue, 48);
    const description = detail && detail !== displayLabel && supports(detail) ? detail : '';
    const from = frameAt(word);
    const previous = steps.at(-1);
    if (from > duration - Math.round(fps * 0.3) || (previous && from - previous.from < Math.round(fps * 0.35))) continue;
    if (steps.some(step => step.label.toLowerCase() === displayLabel.toLowerCase())) continue;
    steps.push({ label: displayLabel, description, from, ...(action && { action }) });
    lastWord = word;
  }
  return steps;
}

function authoredScene(scene: StoryboardScene, timing: ReturnType<typeof sceneTiming>, duration: number, fps: number): NativeScene | undefined {
  if (scene.type === 'collection') {
    const { items, result, cue } = scene.visualProps;
    const reveal = cue ? findPhrase(timing.words, cue) : -1;
    if (reveal >= 0 && result && items?.length && items.every(item => findPhrase(timing.words, item.label) >= 0)
      && findPhrase(timing.words, result) >= 0) {
      return { kind: 'collection', items, result, from: timing.frameAt(reveal) };
    }
  }
  if (scene.type === 'code') {
    const { code, filename } = scene.visualProps;
    const word = code ? findPhrase(timing.words, code) : -1;
    if (word >= 0 && code && timing.narration.includes(cleanNarration(code))) {
      return { kind: 'code', code, filename, from: timing.frameAt(word) };
    }
  }
  const rows = scene.type === 'queueTimeline' ? scene.visualProps.items?.map(item => ({
    label: item.name, detail: item.detail, cue: item.cue || item.name,
  })) : undefined;
  if (rows?.length && rows.length <= 4) {
    const steps = timedSteps(rows, timing, duration, fps);
    if (steps.length === rows.length && compileQueue(steps, timing.narration)) return { kind: 'queue', steps };
  }
}

function hasMechanism(scene: StoryboardScene): boolean {
  return ['requestFlow', 'architecturePipeline', 'queueTimeline', 'raceCondition', 'h3SpatialMap'].includes(scene.type)
    || (expiresLanguage.test(scene.narration) && replacementLanguage.test(scene.narration));
}

const transferLanguage = /\b(?:send\w*|bhej\w*|forward\w*|rout(?:e|es|ed|ing)|pass(?:es|ed)?|copy|receiv\w*|reaches|transfer\w*|write\w*|read\w*|fetch\w*|retrieve\w*|return\w*|push\w*|publish\w*|save\w*|store\w*|deliver\w*|call\w*|dispatch\w*|enqueue\w*|padho|rakhta|rakhti|jata|jaati)\b|भेज|पहुँच|लौटा|पढ़|लिख/iu;
const expiresLanguage = /\b(?:expir\w*|evict\w*|invalidat\w*|stale|khatam)\b|खत्म|एक्सपायर/iu;
const replacementLanguage = /\b(?:fresh|replac\w*|refresh\w*|recomput\w*|regenerat\w*|naya|new)\b|नया|फिर से/iu;
const countWords: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  twenty: 20, ek: 1, do: 2, teen: 3, chaar: 4, paanch: 5, panch: 5, che: 6, saat: 7, aath: 8, nau: 9,
  das: 10, bees: 20, बीस: 20, पांच: 5, पाँच: 5, दो: 2, एक: 1,
};

function compileOperation(proposal: z.infer<typeof operationProposal>, timing: ReturnType<typeof sceneTiming>,
  duration: number, fps: number): SemanticOperation | undefined {
  const { words, frameAt } = timing;
  const grounded = (label: string) => conciseVisualLabel(label) && findPhrase(words, label) >= 0;
  const locate = (cue: string, after = -1) => findPhrase(words, cue, after + 1);
  const fits = (word: number) => word >= 0 && frameAt(word) < duration - Math.round(fps * 0.32);
  const from = locate(proposal.cue);
  if (!fits(from)) return;
  if (proposal.kind === 'group') {
    if (!grounded(proposal.group) || new Set(proposal.measures.map(metric => metric.label.toLowerCase())).size < proposal.measures.length) return;
    if (proposal.shape === 'hexagon' && !/\bhexagon\w*\b|षट्कोण/iu.test(timing.narration)) return;
    const measures = [];
    for (const measure of proposal.measures) {
      const at = locate(measure.cue, from - 1);
      if (!fits(at) || !grounded(measure.label)) return;
      const amount = measure.spokenAmount.toLowerCase();
      const parsed = /^\d+$/.test(amount) ? Number(amount) : countWords[amount];
      const window = words.slice(Math.max(0, at - 5), at + phraseWords(measure.cue).length + 5);
      if (parsed !== measure.amount || findPhrase(window, measure.spokenAmount) < 0 || findPhrase(window, measure.label) < 0) return;
      measures.push({ label: measure.label, amount: measure.amount, from: frameAt(at), symbol: measure.symbol });
    }
    return { kind: 'group', label: proposal.group, shape: proposal.shape, from: frameAt(from), measures };
  }
  if (proposal.kind === 'expiry') {
    if (!grounded(proposal.resource) || !expiresLanguage.test(proposal.expiresAt) || !replacementLanguage.test(proposal.replacesAt)) return;
    const expires = locate(proposal.expiresAt, from);
    const replaces = expires >= 0 ? locate(proposal.replacesAt, expires) : -1;
    if (!fits(expires) || !fits(replaces) || frameAt(from) >= frameAt(expires) || frameAt(expires) >= frameAt(replaces)) return;
    return { kind: 'expiry', label: proposal.resource, from: frameAt(from), expires: frameAt(expires), replaces: frameAt(replaces) };
  }
  const selected = proposal.candidates.find(label => phraseWords(label).join(' ') === phraseWords(proposal.selected).join(' '));
  if (![proposal.query, proposal.selected, proposal.result, ...proposal.candidates].every(grounded)
    || !selected
    || new Set(proposal.candidates.map(label => label.toLowerCase())).size !== proposal.candidates.length) return;
  if (proposal.outcome === 'miss' && !/\b(?:miss|irrelevant|incorrect|incomplete|wrong|galat|adhura)\b|गलत|अधूरा/iu.test(timing.narration)) return;
  const queryAt = locate(proposal.query);
  const selects = locate(proposal.selectsAt, queryAt);
  const starts = from < selects ? from : queryAt;
  const ends = selects >= 0 ? locate(proposal.resultAt, selects) : -1;
  if (!fits(starts) || !fits(selects) || !fits(ends) || frameAt(starts) >= frameAt(selects) || frameAt(selects) >= frameAt(ends)) return;
  let processor: { label: string; from: number } | undefined;
  if (proposal.processor || proposal.sendsAt) {
    if (!proposal.processor || !proposal.sendsAt || !grounded(proposal.processor)) return;
    const sent = locate(proposal.sendsAt, selects);
    if (!fits(sent) || sent >= ends || !transferLanguage.test(proposal.sendsAt)) return;
    processor = { label: proposal.processor, from: frameAt(sent) };
  }
  return { kind: 'selection', query: proposal.query, from: frameAt(starts), candidates: proposal.candidates,
    selected, selects: frameAt(selects), processor, result: proposal.result, ends: frameAt(ends), outcome: proposal.outcome };
}

function compileDiagram(proposal: Proposal, board: Storyboard, timeline: VideoTimeline, spokenSoFar: string): TimedShot | undefined {
  if (!proposal.diagram) return;
  const index = proposal.sceneIndex;
  const scene = board.scenes[index];
  const words = phraseWords(cleanNarration(scene.narration));
  const context = phraseWords(spokenSoFar);
  const { nodes, events } = proposal.diagram;
  if (nodes.some(node => !conciseVisualLabel(node.label) || findPhrase(context, node.label) < 0
    || !events.some(event => event.source === node.id || event.target === node.id))
    || new Set(nodes.map(node => phraseWords(node.label).join(' '))).size !== nodes.length) return;
  let previousCue = -1;
  const actions = [];
  for (const event of events) {
    const cueIndex = findPhrase(words, event.cue, Math.max(0, previousCue));
    if (cueIndex < 0) return;
    previousCue = cueIndex;
    if (event.kind === 'send') {
      const nearby = words.slice(Math.max(0, cueIndex - 7), cueIndex + phraseWords(event.cue).length + 6);
      const participants = nodes.filter(node => node.id === event.source || node.id === event.target);
      if (participants.length !== 2 || event.target === event.source || !transferLanguage.test(nearby.join(' '))
        || !participants.some(node => findPhrase(nearby, node.label) >= 0)) return;
      actions.push({ kind: 'send', source: event.source, target: event.target, cue: event.cue,
        outcome: event.outcome ?? undefined });
    } else {
      if (!event.value || !conciseVisualLabel(event.value)) return;
      const valueAt = findPhrase(words, event.value, Math.max(0, cueIndex - 5));
      if (valueAt < 0 || valueAt > cueIndex + 12) return;
      const value = event.value;
      const tone = /\b(?:fail(?:ed|ure)?|error|denied|rejected|blocked|not confirmed|nahi hua)\b/iu.test(value) ? 'error'
        : /\b(?:retry|pending|expired|timeout|wait)\b/iu.test(value) ? 'warning'
        : /\b(?:success(?:ful)?|confirmed|ready|verified|accepted|200 ok)\b/iu.test(value) ? 'success'
        : undefined;
      actions.push({ kind: 'update', entity: event.source, value, cue: event.cue, tone });
    }
  }
  const evidence = events[0].cue;
  const headline = conciseVisualLabel(scene.onScreenText) && findPhrase(words, scene.onScreenText) >= 0
    && !nodes.some(node => node.label.toLowerCase() === scene.onScreenText.toLowerCase()) ? scene.onScreenText : null;
  try {
    const [[shot]] = compileVisualPlan({
      scenes: [{ sceneIndex: index, shots: [{ kind: 'motion', cue: '', headline: headline ?? nodes[0].label, evidence,
        actors: nodes.map(node => ({ entity: node.id, label: node.label, icon: node.icon, brand: node.label })), events: actions,
      }] }],
    }, board, timeline, index, index + 1, { repairAnnotations: true });
    if (shot.kind === 'motion') return { ...shot, headline: headline ? shot.headline : '', premium: true };
  } catch {
    // The alternate director can fill this scene if the diagram fails grounding or timing.
  }
}

function buildSceneShot(scene: StoryboardScene, segment: VideoTimeline['segments'][number], fps: number,
  nativeScene: NativeScene | undefined, proposal?: Proposal): TimedShot {
  const timing = sceneTiming(scene, segment, fps);
  const headline = conciseVisualLabel(scene.onScreenText) && findPhrase(timing.words, scene.onScreenText) >= 0
    ? scene.onScreenText : '';
  const base = {
    id: `${scene.sceneIndex + 1}-1`, from: 0, duration: segment.durationInFrames, cue: '',
    evidence: timing.narration.split(/\s+/u).slice(0, 6).join(' '), headline,
    reveals: [], movements: [], takeawayFrame: 0, premium: true,
  };
  const steps = proposal ? timedSteps(proposal.beats, timing, base.duration, fps) : [];
  if (!nativeScene && proposal?.layout === 'device' && proposal.screen && steps.length >= 2) {
    const { appName, layout, content } = proposal.screen;
    return { ...base, kind: 'device', openFrame: steps[0].from, reveals: steps.map(step => step.from),
      evidence: proposal.beats[0].cue,
      appName: appName && findPhrase(timing.words, appName) >= 0 ? appName : undefined,
      screenLayout: layout, screenContent: content,
      screenActions: steps.map(step => step.action ?? 'status'),
      actors: steps.map((step, index) => ({
        entity: `screen-${index}`, label: step.label, value: step.description || undefined,
      })),
    };
  }
  if (!nativeScene && (proposal?.layout === 'comparison' || proposal?.layout === 'trend') && steps.length >= 2) {
    return { ...base, kind: 'comparison', chartStyle: proposal.layout === 'trend' ? 'trend' : undefined,
      reveals: steps.map(step => step.from),
      actors: steps.slice(0, 3).map((step, index) => ({
        entity: `case-${index}`, label: step.label, value: step.description || undefined,
      })),
    };
  }
  const queueSteps = nativeScene?.kind === 'queue' ? nativeScene.steps : proposal?.layout === 'queue' ? steps : [];
  const operation = compileQueue(queueSteps, timing.narration);
  const reveals = nativeScene && ('steps' in nativeScene ? nativeScene.steps.map(step => step.from) : [nativeScene.from]);
  const beat = proposal?.layout === 'beats' ? steps.find(step => conciseVisualLabel(step.label)) : undefined;
  return { ...base, kind: 'focus', nativeScene, operation,
    headline: nativeScene || operation ? '' : beat?.label ?? headline, reveals: reveals ?? [] };
}

function compileQueue(steps: TimedBeat[], narration: string): SemanticOperation | undefined {
  const label = /\b(?:job|task|request|message|event)\b/iu.exec(narration)?.[0];
  if (!label) return;
  const actions = steps.flatMap(step => {
    const text = `${step.label} ${step.description}`;
    const action: 'enqueue' | 'dispatch' | 'complete' | undefined = /\b(?:enqueue\w*|enters|enter|wait\w*|queued)\b|क्यू में/iu.test(text) ? 'enqueue'
      : /\b(?:dequeue\w*|takes|take|accepts|picks?|dispatch\w*|consum\w*)\b|उठा/iu.test(text) ? 'dispatch'
      : /\b(?:complete\w*|done|finished)\b|पूरा/iu.test(text) ? 'complete' : undefined;
    return action ? [{ action, from: step.from }] : [];
  });
  if (actions.length < 2 || new Set(actions.map(step => step.action)).size < 2) return;
  const order = { enqueue: 0, dispatch: 1, complete: 2 };
  if (actions.some((step, index) => index > 0 && order[step.action] <= order[actions[index - 1].action])) return;
  return { kind: 'queue', label, steps: actions };
}

function getDirectors() {
  const primary = process.env.REEL_PREMIUM_DIRECTOR_PROVIDER?.trim() || process.env.REEL_DIRECTOR_PROVIDER?.trim()
    || 'groq';
  const modelOverride = process.env.REEL_PREMIUM_DIRECTOR_MODEL?.trim() || process.env.REEL_DIRECTOR_MODEL?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEYS?.trim() || process.env.GROQ_API_KEY?.trim();
  const gemini = geminiKey && new GeminiProvider(geminiKey, (primary === 'gemini' && modelOverride)
    || process.env.REEL_GEMINI_DIRECTOR_MODEL?.trim() || process.env.GEMINI_MODEL?.trim());
  const groq = groqKey && new GroqProvider(groqKey, (primary === 'groq' && modelOverride)
    || process.env.REEL_GROQ_DIRECTOR_MODEL?.trim() || 'openai/gpt-oss-120b');
  return (primary === 'groq' ? [groq, gemini] : [gemini, groq]).filter(
    (provider): provider is GeminiProvider | GroqProvider => Boolean(provider));
}

export function reviseVisualAssets(visuals: ReelVisualAssets, shots: ReelVisualAssets['shots']): ReelVisualAssets {
  const fingerprint = digest([visuals.inputRevision, shots]);
  return { ...visuals, shots, fingerprint, review: fingerprint === visuals.fingerprint ? visuals.review : undefined };
}

export function storyboardVisualInputRevision(storyboard: Storyboard, timeline: VideoTimeline): string {
  return digest([scenePlanVersion, storyboard, timeline]);
}

export function vectorVisualShot(shot: TimedShot, vector: TimedVector): TimedShot {
  const offset = vector.sequenceOffset ?? 0;
  const localEvents = [...vector.tracks.map(track => track.start), ...(vector.connectors ?? []).map(route => route.start),
    ...vector.layers.map(layer => layer.start), ...(vector.cameraTrack ?? []).map(key => key.start),
    ...(vector.camera ? [vector.camera.start] : []), ...(vector.states ?? []).map(state => state.frame)]
    .map(frame => frame - offset).filter(frame => frame > 0 && frame < shot.duration);
  return { ...shot, vector, headline: '', actionFrame: localEvents.length ? Math.min(...localEvents) : undefined };
}

export function importedVectorShots(storyboard: Storyboard, timeline: VideoTimeline, vectors: Map<number, TimedVector>) {
  return storyboard.scenes.map((scene, index) => [vectorVisualShot(
    buildSceneShot(scene, timeline.segments[index], timeline.fps, undefined), vectors.get(index)!,
  )]);
}

export async function prepareStoryboardVisuals(storyboard: Storyboard, timeline: VideoTimeline,
  previous?: ReelVisualAssets, options: {
    editorFeedback?: string; directions?: StoryDirectionOverrides; sceneIndices?: number[];
    retryUnresolved?: boolean; recompileSavedVisuals?: boolean;
  } = {},
): Promise<ReelVisualAssets> {
  const inputRevision = storyboardVisualInputRevision(storyboard, timeline);
  if (options.recompileSavedVisuals) {
    if (previous?.inputRevision !== inputRevision || !previous.semanticVisual?.sequences.length) {
      throw new Error('No saved semantic visual plans match this narration.');
    }
    const vectors = await compileSavedSemanticSequences(storyboard, timeline, previous.semanticVisual, options.sceneIndices);
    if (!vectors.size) throw new Error('No saved semantic specification covers the requested scenes.');
    return reviseVisualAssets(previous, previous.shots.map((group, index) => {
      const vector = vectors.get(index);
      return vector ? group.map(shot => shot.vector ? { ...shot, vector } : shot) : group;
    }));
  }
  const retryIndices = options.retryUnresolved && previous?.inputRevision === inputRevision
    ? previous.unresolvedScenes ?? [] : [];
  if (previous?.inputRevision === inputRevision && !options.editorFeedback && !retryIndices.length && !options.sceneIndices?.length) {
    if (!options.directions || !Object.keys(options.directions).length) return previous;
    return reviseVisualAssets(previous, previous.shots.map(group => group.map(shot => {
      const edit = options.directions?.[shot.id];
      return edit && (shot.kind === 'image' || shot.kind === 'film') ? { ...shot, ...edit } : shot;
    })));
  }

  const nativeScenes = storyboard.scenes.map((scene, index) => {
    const segment = timeline.segments[index];
    if (!segment || scene.id !== segment.sceneId || segment.durationInFrames < 1) {
      throw new Error(`Scene ${index + 1} does not match the saved voiceover. Generate voiceover for this script first.`);
    }
    return authoredScene(scene, sceneTiming(scene, segment, timeline.fps), segment.durationInFrames, timeline.fps);
  });
  const narration = storyboard.scenes.map(scene => cleanNarration(scene.narration));
  const closing = approvedClosingCard(storyboard);
  const indices = options.sceneIndices ?? (retryIndices.length ? retryIndices : undefined);
  const target = previous?.inputRevision === inputRevision && indices ? new Set(indices) : undefined;
  for (const index of target ?? []) {
    const vector = previous?.shots[index]?.[0]?.vector;
    if (vector?.sequenceStart === undefined || vector.sequenceEnd === undefined) continue;
    for (let i = vector.sequenceStart; i <= vector.sequenceEnd; i++) {
      const candidate = previous?.shots[i]?.[0]?.vector;
      if (candidate?.sequenceStart === vector.sequenceStart && candidate.sequenceEnd === vector.sequenceEnd) target!.add(i);
    }
  }
  const needed = storyboard.scenes.flatMap((scene, index) => index !== closing?.sceneIndex
    && (!target || target.has(index)) && (options.editorFeedback || !nativeScenes[index]) ? [{
    sceneIndex: index, typeHint: scene.type, narration: narration[index],
  }] : []);
  const proposals = new Map<number, Proposal>();
  const diagrams = new Map<number, TimedShot>();
  const operations = new Map<number, SemanticOperation>();
  const vectors = new Map<number, TimedVector>();
  const rejected = new Map<number, string>();
  const artwork = new Map<number, string>();
  const layered = new Map<number, NonNullable<TimedShot['layers']>>();
  const legacy = process.env.REEL_VISUAL_PLANNER === 'legacy';
  let semanticVisual: SemanticVisualState | undefined;
  if (!legacy && needed.length) {
    const all = storyboard.scenes.flatMap((_, index) => index !== closing?.sceneIndex
      && (!nativeScenes[index] || options.editorFeedback && (!target || target.has(index))) ? [index] : []);
    const result = await planSemanticVisuals(storyboard, timeline, inputRevision, all, needed.map(scene => scene.sceneIndex),
      previous?.semanticVisual, options.editorFeedback);
    semanticVisual = result.state;
    for (const [index, vector] of result.vectors) vectors.set(index, vector);
    for (const [index, reason] of result.failures) rejected.set(index, reason);
  }
  const directed = (index: number) => proposals.has(index) || vectors.has(index);
  const directors = legacy ? getDirectors() : [];
  const reference = needed.length && directors.length ? await loadVisualDirectorReference() : undefined;
  const svgReference = reference?.files.get('GOLDEN_REFERENCE.svg')?.toString('utf8');
  const imageReference = reference?.files.get('GOLDEN_REFERENCE.png');
  const legacySystem = `${reference?.master ?? ''}\n\n${reference?.compact ?? ''}\n\n${direction}\nReturn raw structured JSON without Markdown for this request.`;
  const artworkAvailable = process.env.REEL_IMAGE_GENERATION === 'on';
  const approvedAssets = needed.length && legacy ? await loadApprovedVisualAssets() : undefined;
  for (let start = 0; start < needed.length && directors.length; start += directorBatchSize) {
    const scenes = needed.slice(start, start + directorBatchSize);
    let responsiveDirector: (typeof directors)[number] | undefined;
    let limitedDirector: { director: (typeof directors)[number]; retryAt: number } | undefined;
    const request = async (director: (typeof directors)[number], repair = false) => {
      const remaining = scenes.filter(scene => !proposals.has(scene.sceneIndex));
      if (!remaining.length) return;
      const usesGroq = director instanceof GroqProvider;
      const preceding = [];
      for (let index = remaining[0].sceneIndex - 1; index >= 0 && preceding.length < 4; index--) {
        const saved = previous?.inputRevision === inputRevision ? previous.shots[index]?.[0] : undefined;
        const plan = proposals.get(index);
        const vector = vectors.get(index) ?? saved?.vector;
        if (vector) {
          preceding.push({ sceneIndex: index, layout: 'vector', vector: {
            subject: vector.subject, framing: vector.framing,
            focal: vector.layers.filter(layer => vector.focal?.includes(layer.id))
              .map(layer => ({ id: layer.id, shape: layer.shape })),
            layers: vector.layers.map(layer => layer.id),
          } });
          if (vector.sequenceStart !== undefined) index = vector.sequenceStart;
        } else if (plan || saved && !saved.requiresDirection) {
          preceding.push({ sceneIndex: index, layout: plan?.layout ?? saved?.kind,
            nodes: plan?.diagram?.nodes, screen: plan?.screen });
        }
      }
      const prompt = JSON.stringify({ version: scenePlanVersion, title: storyboard.title,
        fullStory: narration, vectorCapabilities, artworkAvailable: artworkAvailable && !repair,
        goldenReference: usesGroq ? svgReference : undefined,
        outputSchema: groqResponseGuide,
        approvedAssets: approvedAssets?.capabilities, repair,
        priorVisuals: preceding.reverse(),
        scenes: remaining.map(scene => ({ ...scene, repairReason: rejected.get(scene.sceneIndex) })),
        editorFeedback: options.editorFeedback });
      const provider = usesGroq ? 'Groq' : 'Gemini';
      const sceneNumbers = remaining.map(scene => scene.sceneIndex + 1).join(', ');
      console.info(`[Storyboard] ${provider} ${director.modelName}, ${repair ? 'repair' : 'plan'} scenes ${sceneNumbers}, ${Buffer.byteLength(prompt)} prompt bytes.`);
      try {
        // SVG coordinate tuples and nested unions use a wider schema than Groq's strict decoder accepts.
        const raw = usesGroq
          ? await director.generateJSON(prompt, legacySystem, 25_000, undefined, { jsonObjectMode: true,
            reasoningEffort: 'low', maxCompletionTokens: remaining.length > 2 ? 3100 : 2600 })
          : await director.generateJSON(prompt, legacySystem, 45_000, undefined, imageReference
            ? { mimeType: 'image/png', data: imageReference.toString('base64') } : undefined);
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed?.scenes)) throw new Error('Invalid scene plan response.');
        responsiveDirector ??= director;
        for (const candidate of [...parsed.scenes].sort((a, b) => Number(a?.sceneIndex) - Number(b?.sceneIndex))) {
          if (candidate?.layout === 'flow' && remaining.some(scene => scene.sceneIndex === candidate.sceneIndex)) {
            rejected.set(candidate.sceneIndex, 'Text steps do not establish a relationship. Use a real operation, entity diagram, code or device interaction.');
          }
          const result = candidate?.layout === 'vector' ? parseVectorReply(candidate) : sceneProposal.safeParse(candidate);
          if (!result.success) {
            if (candidate?.layout === 'vector' && remaining.some(input => input.sceneIndex === candidate.sceneIndex)) {
              rejected.set(candidate.sceneIndex, result.error.issues.slice(0, 3)
                .map(issue => `${issue.path.join('.')}: ${issue.message}`).join(' ').slice(0, 290));
            }
            continue;
          }
          if (!remaining.some(input => input.sceneIndex === result.data.sceneIndex) || proposals.has(result.data.sceneIndex)) continue;
          const proposal = result.data;
          const segment = timeline.segments[proposal.sceneIndex];
          const scene = storyboard.scenes[proposal.sceneIndex];
          if (proposal.layout === 'vector') {
            if (!proposal.vector.framing || !proposal.vector.focal?.length) {
              rejected.set(proposal.sceneIndex, 'Choose a composition framing strategy and name the primary geometry IDs in focal.');
              continue;
            }
            const first = proposal.sceneIndex;
            const last = proposal.throughSceneIndex ?? first;
            const span = Array.from({ length: Math.min(4, last - first + 1) }, (_, offset) => first + offset);
            if (last < first || last - first > 3 || span.some(index => !remaining.some(input => input.sceneIndex === index)
              || proposals.has(index))) {
              rejected.set(first, 'A sequence can only cover consecutive unresolved requested scenes in this batch.');
              continue;
            }
            const timings = span.map(index => sceneTiming(storyboard.scenes[index], timeline.segments[index], timeline.fps));
            const total = timeline.segments[last].startFrame + timeline.segments[last].durationInFrames - segment.startFrame;
            const context = phraseWords(narration.slice(0, last + 1).join(' '));
            const subjectWords = new Set([...phraseWords(storyboard.title), ...context]);
            const normalizedCounts = context.map(word => Object.hasOwn(countWords, word) ? String(countWords[word]) : word);
            try {
              const vector = await compileVector(proposal.vector, {
                fps: timeline.fps, duration: total,
                cueFrame: cue => {
                  const explicit = /^(\d+)\|(.+)$/u.exec(cue);
                  for (const [offset, timing] of timings.entries()) {
                    const index = first + offset;
                    if (explicit && Number(explicit[1]) !== index + 1) continue;
                    const word = findPhrase(timing.words, explicit ? explicit[2] : cue);
                    if (word >= 0) return timeline.segments[index].startFrame - segment.startFrame + timing.frameAt(word);
                  }
                },
                labelGrounded: label => conciseVisualLabel(label) && (findPhrase(context, label) >= 0
                  || (/^\d+\s+\p{L}/u.test(label) && findPhrase(normalizedCounts, label) >= 0)),
                subjectGrounded: subject => conciseVisualLabel(subject)
                  && phraseWords(subject).filter(Boolean).every(word => subjectWords.has(word)),
                technicalLabelGrounded: label => /^[\x20-\x7e]+$/u.test(label) && conciseVisualLabel(label)
                  && (/^(?:chunk|entry|server|packet) [1-9]$/iu.test(label) || phraseWords(label).filter(Boolean).every(word => normalizedCounts.includes(word)
                    || /^(?:document|page|pages|chunk|chunks|vector|vectors|database|db|input|output|entry|packet|model|server|request|response|result|processor|sample|illustrative|example|file|source|target|processing|storage|text|query|content|split|extraction|extract|read|write|verify|verification|match|miss|hit|complete|ready|active|pending|success|specific|full|context|limit|passage|passages|relevant|question|answer|incomplete)$/u.test(word))),
                asset: async id => {
                  if (!approvedAssets) throw new Error('No approved asset catalog.');
                  try {
                    const { asset, credit } = await approvedAssets.resolve(id);
                    return { asset, credit };
                  } catch {
                    throw new Error(`Approved asset ${id} is unavailable. Choose another listed asset or use geometry.`);
                  }
                },
              });
              const previousVector = vectors.get(proposal.sceneIndex - 1) ?? previous?.shots[proposal.sceneIndex - 1]?.[0]?.vector;
              if (previousVector?.framing === 'continuous' && vector.framing === 'continuous'
                && !vector.layers.some(layer => layer.start === 0 && layer.shape.kind !== 'text' && layer.shape.kind !== 'group'
                  && previousVector.layers.some(prior => prior.id === layer.id && digest(prior.shape) === digest(layer.shape)))) {
                throw new Error('Carry at least one visible layer from the previous continuous composition at its established coordinates.');
              }
              if (previousVector && previousVector.subject.toLowerCase() !== vector.subject.toLowerCase()
                && vector.framing !== 'continuous' && previousVector.framing === vector.framing) {
                const geometry = (scene: TimedVector) => digest(scene.layers.filter(layer => layer.shape.kind !== 'text')
                  .map(({ shape }) => shape));
                if (geometry(previousVector) === geometry(vector)) throw new Error('Change the layout and geometry to teach this different mechanism.');
              }
              for (const index of span) {
                vectors.set(index, span.length === 1 ? vector : { ...vector,
                  sequenceOffset: timeline.segments[index].startFrame - segment.startFrame,
                  sequenceStart: first, sequenceEnd: last });
                proposals.set(index, proposal);
              }
            } catch (error) {
              rejected.set(proposal.sceneIndex, error instanceof Error ? error.message.slice(0, 170) : 'Invalid vector composition.');
              continue;
            }
          } else if (proposal.layout === 'diagram') {
            const diagram = compileDiagram(proposal, storyboard, timeline, narration.slice(0, proposal.sceneIndex + 1).join(' '));
            if (!diagram) {
              rejected.set(proposal.sceneIndex, 'Use distinct spoken entities and a real transfer or observed update at an exact cue. Use an operation for counts, selection or expiry.');
              continue;
            }
            diagrams.set(proposal.sceneIndex, diagram);
          } else if (proposal.layout === 'operation') {
            const operation = compileOperation(proposal.operation, sceneTiming(scene, segment, timeline.fps),
              segment.durationInFrames, timeline.fps);
            if (!operation) {
              rejected.set(proposal.sceneIndex, 'Use the exact spoken objects, numerical values and action cues. Keep the operation stages in spoken order.');
              continue;
            }
            operations.set(proposal.sceneIndex, operation);
          } else if (proposal.layout === 'layered') {
            if (!approvedAssets || repair) continue;
            const timing = sceneTiming(scene, segment, timeline.fps);
            try {
              const background = await approvedAssets.resolve(proposal.backgroundId, 'background');
              const subjects = await Promise.all(proposal.subjects.map(async subject => {
                const word = findPhrase(timing.words, subject.cue);
                const from = word < 0 ? -1 : timing.frameAt(word);
                const duration = Math.min(segment.durationInFrames - from, Math.round(subject.seconds * timeline.fps));
                if (from < 0 || duration < 2) throw new Error('Invalid subject cue.');
                const { asset, credit, width, height } = await approvedAssets.resolve(subject.assetId, 'subject');
                const layerHeight = Math.min(0.24, subject.width * 1080 / 1920 * height / width);
                const start = { x: subject.start.x, y: background.motionLaneY ?? subject.start.y };
                const end = { x: subject.end.x, y: background.motionLaneY ?? subject.end.y };
                const offscreen = [start, end].some(({ x, y }) =>
                  x - subject.width / 2 < 0.04 || x + subject.width / 2 > 0.92
                  || y - layerHeight / 2 < 0.08 || y + layerHeight / 2 > 0.72);
                if (offscreen) throw new Error('Subject path crosses the visual safe area.');
                return { asset, credit, from, duration, start, end, width: subject.width, height: layerHeight };
              }));
              artwork.set(proposal.sceneIndex, background.asset);
              layered.set(proposal.sceneIndex, { backgroundCredit: background.credit, subjects });
            } catch {
              continue;
            }
          } else {
            const timing = sceneTiming(scene, segment, timeline.fps);
            const steps = timedSteps(proposal.beats, timing, segment.durationInFrames, timeline.fps);
            if (steps.length < (proposal.layout === 'beats' || proposal.layout === 'cinematic' ? 1 : 2)) continue;
            if (proposal.layout === 'device' && (!proposal.screen || steps.some(step => !step.action || !conciseVisualLabel(step.label)))) continue;
            if (proposal.layout === 'queue' && !compileQueue(steps, timing.narration)) continue;
            if (proposal.layout === 'beats' && (segment.durationInFrames > timeline.fps * 2
              || hasMechanism(scene) || scene.type === 'hook'
              || !steps.some(step => conciseVisualLabel(step.label)))) continue;
            if (proposal.layout === 'comparison' && steps.some(step => !conciseVisualLabel(step.label))) continue;
            if (proposal.layout === 'trend') {
              const metrics = steps.map(step => /^([₹$€£]?)-?\d+(?:\.\d+)?\s*([a-z%]*)$/i.exec(step.description));
              if (steps.length > 3 || steps.some(step => step.label.length > 15)
                || metrics.some(match => !match || match[1] !== metrics[0]?.[1]
                || match[2].toLowerCase() !== metrics[0]?.[2].toLowerCase())) continue;
            }
            if (proposal.layout === 'cinematic') {
              if (!artworkAvailable || repair) continue;
              const asset = await prepareSceneArtwork(proposal.openingArtwork, narration[proposal.sceneIndex]);
              if (!asset) continue;
              artwork.set(proposal.sceneIndex, asset);
            }
          }
          proposals.set(proposal.sceneIndex, proposal);
        }
      } catch (error) {
        if (error instanceof GroqRateLimitError && error.retryAfterMs !== undefined && error.retryAfterMs <= 60_000) {
          const retryAt = Date.now() + error.retryAfterMs;
          if (!limitedDirector || retryAt < limitedDirector.retryAt) limitedDirector = { director, retryAt };
        }
        console.warn(`[Storyboard] ${provider} ${director.modelName} failed for scenes ${sceneNumbers}.`);
      }
    };
    for (const director of directors) await request(director);
    if (responsiveDirector) await request(responsiveDirector, true);
    if (limitedDirector && scenes.some(scene => !proposals.has(scene.sceneIndex))) {
      await sleep(Math.max(0, limitedDirector.retryAt - Date.now()));
      await request(limitedDirector.director);
    }
  }
  if (options.editorFeedback && !proposals.size && !vectors.size) {
    const issues = [...new Set(rejected.values())].slice(0, 3).join(' ');
    throw new Error(`The visual planner could not apply this feedback. The saved revision is still available.${issues ? ` ${issues}` : ''}`);
  }

  const shots = storyboard.scenes.map((scene, index) => {
    if (target && (!target.has(index) || !directed(index))) return previous!.shots[index];
    if (closing?.sceneIndex === index) {
      const [group] = compileVisualPlan({ scenes: [closing] }, storyboard, timeline, index, index + 1);
      return group.map(shot => ({ ...shot, premium: true }));
    }
    const proposal = proposals.get(index);
    const asset = artwork.get(index);
    if (asset && (proposal?.layout === 'cinematic' || proposal?.layout === 'layered')) {
      const layers = layered.get(index);
      const brief = proposal.layout === 'cinematic' ? proposal.openingArtwork : scene.narration;
      const segment = timeline.segments[index];
      const timing = sceneTiming(scene, segment, timeline.fps);
      const storyBeats = proposal.layout === 'cinematic'
        ? timedSteps(proposal.beats, timing, segment.durationInFrames, timeline.fps).filter(beat => conciseVisualLabel(beat.label))
        : [];
      const storyBeat = storyBeats.find(beat => beat.from >= timeline.fps) ?? (storyBeats[0] && {
        ...storyBeats[0], from: Math.max(Math.round(timeline.fps * 1.1), storyBeats[0].from),
      });
      return [{ id: `${index + 1}-1`, kind: 'image', from: 0, duration: timeline.segments[index].durationInFrames,
        cue: '', evidence: proposal.layout === 'cinematic' ? proposal.beats[0].cue : proposal.subjects[0].cue,
        headline: '', brief, continuity: storyboard.title, camera: layers ? 'locked' : 'push-in', action: brief,
        asset, layers, storyBeat, actionFrame: layers?.subjects[0].from ?? storyBeat?.from,
        reveals: [], movements: [], takeawayFrame: 0, premium: true } satisfies TimedShot];
    }
    const shot = diagrams.get(index) ?? buildSceneShot(scene, timeline.segments[index], timeline.fps,
      options.editorFeedback && proposal ? undefined : nativeScenes[index], proposal);
    const vector = vectors.get(index);
    if (vector) return [vectorVisualShot(shot, vector)];
    const operation = operations.get(index);
    if (operation) return [{ ...shot, operation, headline: '',
      actionFrame: operation.kind === 'expiry' ? operation.expires : operation.kind === 'selection' ? operation.selects
        : operation.kind === 'group' ? operation.measures[0].from : operation.steps[0].from }];
    if (!proposal && !nativeScenes[index]) return [{ ...shot, requiresDirection: true }];
    if (shot.kind === 'device' && shot.appName) {
      const capture = previous?.shots[index]?.find(prior => prior.kind === 'device' && prior.appName === shot.appName
        && prior.evidence === shot.evidence && prior.asset && !prior.publicPostUrl);
      if (capture?.asset) return [{ ...shot, asset: capture.asset }];
    }
    return [shot];
  });
  const openingBrief = proposals.get(0)?.openingArtwork;
  const opening = shots[0]?.[0];
  if (openingBrief && opening?.kind === 'focus' && !opening.nativeScene && opening.duration >= timeline.fps * 3) {
    const still = await prepareSceneArtwork(openingBrief, storyboard.scenes[0].narration);
    if (still) {
      const duration = Math.round(timeline.fps * 1.4);
      const continuation = {
        ...opening, id: '1-2', from: duration, duration: opening.duration - duration,
        reveals: opening.reveals.map(frame => Math.max(0, frame - duration)),
      };
      if (opening.focus) {
        const active = opening.focus.beats.reduce((last, beat, index) => beat.from <= duration ? index : last, 0);
        continuation.focus = { beats: opening.focus.beats.slice(Math.max(0, active)).map(beat => ({
          ...beat, from: Math.max(0, beat.from - duration),
        })) };
      }
      shots[0] = [{ ...opening, kind: 'image', brief: openingBrief, continuity: 'opening',
        camera: 'push-in', action: openingBrief, duration, asset: still, nativeScene: undefined, focus: undefined, reveals: [],
      }, continuation];
    }
  }
  const unresolvedScenes = target ? (previous?.unresolvedScenes ?? []).filter(index => !directed(index))
    : needed.filter(scene => !directed(scene.sceneIndex)).map(scene => scene.sceneIndex);
  const hasAccepted = shots.some((group, index) => closing?.sceneIndex !== index && !nativeScenes[index] && !group.some(shot => shot.requiresDirection));
  return reviseVisualAssets({ inputRevision, schemaVersion: legacy ? scenePlanVersion : 'semantic-v1', source: 'automatic', fingerprint: '', shots, status: 'ready',
    direction: unresolvedScenes.length ? (hasAccepted ? 'mixed' : 'local') : 'directed',
    unresolvedScenes,
    semanticVisual: semanticVisual ?? previous?.semanticVisual,
    visualPlanningErrors: { ...Object.fromEntries(Object.entries(previous?.visualPlanningErrors ?? {}).filter(([index]) => !directed(Number(index)))),
      ...Object.fromEntries(rejected) },
    editorFeedback: options.editorFeedback,
  }, shots);
}
