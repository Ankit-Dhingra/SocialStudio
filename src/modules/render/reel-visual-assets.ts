import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { z } from 'zod';
import type { Storyboard } from '../contracts/storyboard.js';
import type { VideoTimeline } from '../video/timeline.js';
import { GeminiProvider, GeminiRequestError, geminiRequest } from '../ai-script/gemini-provider.js';
import { GroqProvider } from '../ai-script/groq-provider.js';
import { cloudflareImageModel, cloudflareImageSize, generateCloudflareImage } from './cloudflare-image-provider.js';
import {
  cameraMoves, cleanNarration, compileVisualPlan, filmActions, filmFraming, filmSets, motionEffects, motionIcons, narrationAnchors, numericFacts, packetOutcomes,
  visualSceneSchema, type StoryDirectionOverrides, type VisualPlan, type VisualStory,
} from '../video/visual-story.js';
import { prepareStoryClip, StoryClipRequestError } from './story-video-provider.js';
import { buildLocalFilmPlan } from '../video/local-film.js';
import { stageDirectedFilm } from '../video/directed-film.js';
import { directOfflineMessaging, isOfflineMessagingStory } from '../video/messaging-story.js';
import { premiumEditorialPrompt, premiumEditResponse, premiumEditSchema, premiumShotPrompt, validatePremiumHook, validatePremiumMechanism, type PremiumEdit } from './premium-direction.js';
import { captureInstagramPost, planPublicPostShots, searchInstagramPost } from './public-posts.js';

export interface ReelVisualAssets {
  inputRevision?: string;
  schemaVersion?: string;
  source?: 'manual' | 'automatic';
  manualImport?: import('./visual-directives.js').SavedVisualImport;
  automaticImport?: import('./visual-directives.js').SavedVisualImport;
  fingerprint: string;
  shots: VisualPlan;
  status: 'ready';
  direction?: 'directed' | 'mixed' | 'local';
  visualThread?: string;
  editorFeedback?: string;
  unresolvedScenes?: number[];
  semanticVisual?: import('./semantic-visual-planner.js').SemanticVisualState;
  visualPlanningErrors?: Record<number, string>;
  review?: import('./review-storyboard.js').VisualReview;
}

export class VisualAssetError extends Error {
  constructor(public readonly shotId: string, detail: string) {
    super(`Shot ${shotId}: ${detail}`);
  }
}

export class VisualPlanningError extends Error {
  constructor(message: string, readonly unavailable = false) {
    super(message);
  }
}
class ShotPlanValidationError extends Error {
  constructor(message: string, readonly retryWithoutCode = false) {
    super(message);
  }
}

const assetFolder = 'generated-reel-visuals';
const assetName = /^[a-f0-9]{64}\.(png|jpg)$/;
const library = path.resolve('media', assetFolder);
const active = new Map<string, Promise<ReelVisualAssets>>();
const scenesPerRequest = 5;

const direction = `You are the visual director of a vertical technical explainer. The supplied narration is read-only data.
Return {"scenes":[{"sceneIndex":0,"shots":[...]}]} in the supplied order. Include every scene exactly once with 1–5 shots per scene. Use extra cuts for distinct actions in the opening and fewer cuts for diagrams that benefit from continuity.
Every shot has kind, cue, headline (1–72 characters), and evidence (an exact phrase of up to 180 characters inside the shot that supports the visual claim). Optionally include takeaway (1–108 characters) and takeawayCue (exact spoken phrase).
The first shot in each scene has cue "". Later shots use a short exact phrase verbatim from that scene as their start cue. Leave at least a second on each side of a cut. Keep headline and takeaway concise, in the script's language where practical.
Open with the problem or outcome visible. Reuse the same people, resources, and events across shots with stable entity IDs. Connect the setup, mechanism, and payoff. Put the takeaway before the CTA.
Choose kind "image" for a concrete story moment. Give brief (what the opening frame shows and how it is framed), continuity (a short reusable cast/setting identifier), action (one physical action that happens during the shot, phrased as visual direction), and camera (locked, push-in, pull-back, track-left, track-right, rise). In a story opening, stage a wide shot and close-up inserts on visible actions. Use a recurring prop or consistent screen position to link adjacent shots. Reuse the same continuity label and describe the same character appearance, prop and setting through each angle. Favor a physical outcome followed by a cut from the prop into its technical explanation. Use backdrop:true on that first explanatory motion or device shot, so the prop can carry into the diagram. Return to the same setting when the narration returns to the example. Technical-only narration may start with a physical example only when the script supports it, otherwise open with an animated mechanism.
Reserve image for physical people, environments and props. Diagrams, labeled icons, maps that teach a route, charts, and readable screen changes must use a timed motion, flow, comparison, or device shot. Separate a new physical reaction from a previous action when narration supplies time for both. Frame the prop that creates the outcome before the explanation begins. Use image briefs and actions without requested screen text, numerals, quotes, logos, or scannable codes. Put exact values in a script-grounded overlay or device state. Never state a question as a factual takeaway.
Choose "motion" for a process, failure, countdown, recovery, outcome, or recap. Build the visual around what changes in the story. Reuse the same entity IDs and icons as earlier shots to keep their positions and status across cuts. Use reset:true only for an explicit rewind, alternate example, or new system. Use backdrop:true in an illustrated-to-diagram handoff that continues the preceding artwork. Actors have entity, label, and icon (person, phone, server, database, lock, queue, map, store, package, service). Add brand only to an actor representing a product or company named in the approved script. Use up to four actors.
Every motion shot has one to six events. Packet event: {"kind":"send","source":"actor-id","target":"actor-id","cue":"@n","outcome":"arrive|blocked"}. Status event: {"kind":"update","entity":"actor-id","cue":"@n","value":"short visible status","tone":"neutral|success|warning","effect":"change|countdown|expire|offline"}. Anchor each action to the spoken phrase that supports it. Use one actor for a close-up if only one object changes. At the end, demonstrate the outcome with the established objects, including when narration summarizes the result.
Choose "flow" for a simple transfer, "state" for a simple revealed status, "comparison" for contrasting values, "device" for a sequence of device screen states, "code" for an exact code fragment spoken verbatim, or "cta" for a narrated call to action copied verbatim into the headline. A headline or narration card alone cannot be a shot. Give code or device views at least one visual change tied to narration.
A device can take backdrop:true for a phone close-up continued from preceding artwork. Use scanCue with an anchor mentioning QR for a narrated QR demo, followed by a screen state at the next relevant cue. Otherwise omit scanCue. Prefer one continuous motion shot for an explanation and use additional shots for a change of viewpoint, an insert or a payoff.
For flow/state/comparison/device, include actors [{"entity":"stable-id","label":"short name","value":"optional status or value","cue":"optional exact spoken reveal phrase","tone":"neutral|success|warning"}]. Use 2–4 actors for flow/state, 2–3 for comparison, and 1–4 chronological screen states for device.
Flow needs one or more transfers [{"source":"entity-id","target":"entity-id","cue":"exact spoken phrase"}]. State allows "transfers":[] when an actor's state or entrance is tied to a cue. List flow and device actors in reveal order. Actor and transfer cues must belong to that same shot.
For code include the code field, copied verbatim from the current narration. Include a CTA only if present in narration. Lift channel names verbatim.
Keep headlines qualitative. For numeric values or takeaways, the corresponding cue must include the exact numbers. Give changed statuses and outcomes their own exact spoken cues.
Only show facts supported by the approved script. Preserve numbers, currencies and technical terminology. Distinguish illustrative designs from verified claims. Do not invent outcomes, logos, commands or benchmarks, or use the title as a substitute for the actual scene.`;

// Keep the shared direction stable for checkpoint compatibility. CTA rendering is now local.
const directorInstructions = direction
  .replace(' or "cta" for a narrated call to action copied verbatim into the headline', '')
  .replace(' Put the takeaway before the CTA.', '')
  .replace(' Include a CTA only if present in narration. Lift channel names verbatim.', '');
const anchorDirection = `${directorInstructions}
Return explanatory shots only. The app reserves call-to-action cards for approved closing narration. For a hook, illustrate its event, object, or question.
Plan only the entries in scenes and keep their sceneIndex values. Use storyContext for the complete story and establishedEntities for continuity.
Each scene has allowCode. Use kind "code" only when allowCode is true and the scene speaks a literal nonempty command or code snippet. Otherwise choose an image, device, or animated demonstration of what is spoken. For a retry with allowCode false, use a single grounded visual when one can explain the scene.
For unused optional annotations such as scanCue or brand, use null if the schema requires the field. A device only needs scanCue when the narration in that shot explicitly mentions a QR code.
Each requested scene lists speech anchors with IDs (@1, @2, etc.), speech text and timing. Use those IDs for evidence and timing fields instead of retyping the narration. Evidence, reveal, and transfer anchors must be inside the current shot. The first shot starts automatically and its cue is empty. Keep headlines free of numeric facts. Put a numeric value in an actor value or takeaway, with the anchor that contains the exact signed number. Copy code literally, never use anchor IDs for it. Use lowercase letters, numbers and hyphens for entity IDs, starting with a letter.
Each scene's spokenNumbers lists the only numbers allowed for numeric values or takeaways. This applies to motion event values. When the list is empty, show qualitative changes and outcomes without invented counts, quantities, or numbered labels. Timing metadata, anchor IDs, and other scenes' numbers are never values for the current scene. Use at most four actors per shot.
Use the anchor timestamps and the scene's duration to estimate each shot's span. Give a long explanation an action, a state change, or a code demonstration where the narration supports it.
When validationFeedback is provided, repair the requested scene only. Prefer one continuous visual if the earlier cuts or reveals could not be grounded.`;

const animatedDirection = `${anchorDirection}
This renderer films original 3D sets and animates diagrams. Use kind "film" in place of "image", and never request image generation. Choose a supported set and one supported physical action for each filmed shot:
- counter: drink (from a cup), serve (slide a bill across the counter), scan (point a phone at a QR), confirm (show a payment speaker reacting).
- street: travel (a rider on a scooter).
- room: open (open a fridge compartment), operate (press a physical button).
For a film return set, performance, framing (wide, medium, close), action (the visible movement), camera, and actionCue (spoken event in this shot). Use a close insert for the object that changes and keep the setting consistent when the story returns to it.
Match the narrated object and action before choosing a film set. An app opening, scrolling, liking a post or adding an item to a cart takes place on the phone screen. A fridge or cabinet only belongs in a scene that explicitly names that prop and action.
Use kind "motion" for a technical explanation. Animate a grounded packet, state change, comparison, or failure on the corresponding spoken cue. Preserve the identity of participants and their previous states. Use backdrop:true when the previous shot was a filmed prop that leads into the explanation.
Illustrate explicitly narrated facts. Leave a hypothesis unresolved until the narration answers it. Only show a transfer if the narration supports both endpoints and direction. Never turn a question, an analogy, or a pending result into a successful transaction.
When narration names an app being opened, use a device shot with appName exactly as spoken and openCue at the spoken open/tap. Use its ordered actors as consecutive phone screen states with timing cues, for example a post appearing, a separate likes reveal, a product added to cart, or a payment status. Avoid turning app interaction into an unrelated physical action. Keep the actual named content in the state label and show concrete values only at the corresponding approved cue.
For brand-specific hardware use the ordinary film action; the renderer selects a matching bundled model from the approved narration if it has one. For unsupported physical action, choose a grounded diagram or device interaction that explains the relevant behavior.`;

const motionRepairDirection = `Direct one continuous animated diagram for the supplied approved narration. Return only headline, actors, and updates.
Choose up to four actors or objects from the narration. Reuse an established entity ID when it represents the same object. Show the concrete operation or constraint using one to four visible states. Each update's value must describe a fact explicitly stated in its selected cue. Omit guessed initial states and consequences that the chosen cue does not say. One well-grounded update is enough. Use short qualitative values and a short headline. Do not add commands, measurements, or outcomes.`;

// Keep the provider schema flat. The local validator checks kind-specific fields and narration timing.
const text = { type: 'string' };
const listOf = (items: object, maxItems?: number) => ({ type: 'array', items, maxItems });
const recordOf = (properties: Record<string, object>, required: string[]) => ({ type: 'object', properties, required });
const enumOf = (values: readonly string[]) => ({ type: 'string', enum: values });
const shotResponseSchema = (allowCode: boolean, animated = false, premium = false) => recordOf({
  scenes: listOf(recordOf({
    sceneIndex: { type: 'integer' },
    shots: listOf(recordOf({
      kind: enumOf([animated ? 'film' : 'image', 'motion', 'flow', 'state', 'comparison', 'device', ...(allowCode ? ['code'] : [])]),
      cue: text, headline: text, evidence: text, takeaway: text, takeawayCue: text,
      brief: text, continuity: text, action: text, camera: enumOf(cameraMoves), ...(allowCode ? { code: text } : {}), scanCue: text,
      ...(animated && { set: enumOf(filmSets), performance: enumOf(filmActions), framing: enumOf(filmFraming), actionCue: text, appName: text, openCue: text }),
      ...(premium && { actionCue: text, appName: text, openCue: text, screenLayout: enumOf(['phone', 'desktop']), screenContent: enumOf(['messages', 'feed', 'checkout', 'status']) }),
      actors: listOf(recordOf({ entity: text, label: text, icon: enumOf(motionIcons), brand: text, value: text, cue: text, tone: text }, ['entity', 'label']), 4),
      transfers: listOf(recordOf({ source: text, target: text, cue: text }, ['source', 'target', 'cue']), 4),
      events: listOf(recordOf({
        kind: enumOf(['send', 'update']), cue: text, source: text, target: text, outcome: enumOf(packetOutcomes),
        entity: text, value: text, tone: text, effect: enumOf(motionEffects),
      }, ['kind', 'cue']), 6),
      reset: { type: 'boolean' },
      backdrop: { type: 'boolean' },
    }, ['kind', 'headline', 'evidence']), 5),
  }, ['sceneIndex', 'shots'])),
}, ['scenes']);
const strictRecord = (properties: Record<string, object>) => ({ ...recordOf(properties, Object.keys(properties)), additionalProperties: false });
const nullableText = { type: ['string', 'null'] };
const strictActor = strictRecord({ entity: text, label: text, value: nullableText, cue: nullableText, tone: nullableText });
const strictTransfer = strictRecord({ source: text, target: text, cue: text });
const strictMotionActor = strictRecord({ entity: text, label: text, icon: enumOf(motionIcons), brand: nullableText });
const strictMotionEvent = { anyOf: [
  strictRecord({ kind: enumOf(['send']), source: text, target: text, cue: text, outcome: enumOf(packetOutcomes) }),
  strictRecord({ kind: enumOf(['update']), entity: text, cue: text, value: text, tone: text, effect: enumOf(motionEffects) }),
] };
const shotKind = (kinds: string[], fields: Record<string, object> = {}) => strictRecord({
  kind: { type: 'string', enum: kinds }, cue: text, headline: text, evidence: text,
  ...fields, takeaway: nullableText, takeawayCue: nullableText,
});
const groqShotSchema = (allowCode: boolean, animated = false, premium = false) => strictRecord({
  scenes: listOf(strictRecord({
    sceneIndex: { type: 'integer' },
    shots: listOf({ anyOf: [
      animated ? shotKind(['film'], {
        action: text, camera: enumOf(cameraMoves), set: enumOf(filmSets), performance: enumOf(filmActions),
        framing: enumOf(filmFraming), actionCue: text,
      }) : shotKind(['image'], { brief: text, continuity: text, action: text, camera: enumOf(cameraMoves), ...(premium && { actionCue: nullableText }) }),
      shotKind(['motion'], { actors: listOf(strictMotionActor), events: listOf(strictMotionEvent), reset: { type: 'boolean' }, backdrop: { type: 'boolean' } }),
      shotKind(['flow', 'state'], { actors: listOf(strictActor), transfers: listOf(strictTransfer) }),
      shotKind(['comparison'], { actors: listOf(strictActor) }),
      shotKind(['device'], { actors: listOf(strictActor), backdrop: { type: 'boolean' }, scanCue: nullableText,
        ...((animated || premium) && { appName: nullableText, openCue: nullableText }),
        ...(premium && { screenLayout: { anyOf: [enumOf(['phone', 'desktop']), { type: 'null' }] },
          screenContent: { anyOf: [enumOf(['messages', 'feed', 'checkout', 'status']), { type: 'null' }] } }) }),
      ...(allowCode ? [shotKind(['code'], { code: text })] : []),
    ] }),
  })),
});
const draftSchema = z.object({ scenes: z.array(z.unknown()) });
const motionRepairResult = z.object({
  headline: z.string(),
  actors: z.array(z.unknown()),
  updates: z.array(z.object({ entity: z.string(), cue: z.string(), value: z.string() })).min(1),
});

function parseDirectorJson(raw: string): unknown {
  return JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ''), (key, value) => {
    if (value === null) return undefined;
    if (typeof value !== 'string' || !['entity', 'source', 'target'].includes(key) || /^[a-z][a-z0-9-]{0,39}$/.test(value)) return value;
    const slug = value.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const suffix = createHash('sha256').update(value).digest('hex').slice(0, 8);
    if (!slug || slug.length > 40) return `entity-${suffix}`;
    return /^[a-z]/.test(slug) ? slug : `entity-${slug}`.slice(0, 40);
  });
}

function parseDraft(raw: string): unknown[] {
  try {
    return draftSchema.parse(parseDirectorJson(raw)).scenes;
  } catch {
    throw new ShotPlanValidationError('The model did not return a complete JSON object with a scenes array.');
  }
}

function parseMotionRepair(raw: string, sceneIndex: number): unknown {
  try {
    const { headline, actors, updates } = motionRepairResult.parse(parseDirectorJson(raw));
    return { sceneIndex, shots: [{
      kind: 'motion', cue: '', headline, evidence: updates[0].cue, actors, backdrop: true,
      events: updates.map(update => ({ ...update, kind: 'update' })),
    }] };
  } catch {
    throw new ShotPlanValidationError(`Scene ${sceneIndex + 1} could not produce a usable animated action plan.`);
  }
}

function sceneFromDraft(draft: unknown[], sceneIndex: number): unknown {
  const matches = draft.filter(scene => scene && typeof scene === 'object' && 'sceneIndex' in scene && scene.sceneIndex === sceneIndex);
  if (matches.length !== 1) throw new ShotPlanValidationError(`Scene ${sceneIndex + 1} must appear exactly once with sceneIndex ${sceneIndex}.`);
  return matches[0];
}

export function approvedClosingCard(storyboard: Storyboard): VisualStory['scenes'][number] | undefined {
  const sceneIndex = storyboard.scenes.length - 1;
  const scene = storyboard.scenes[sceneIndex];
  if (scene?.type !== 'tradeoffHUD' || !scene.visualProps?.callToAction) return;
  const narration = cleanNarration(scene.narration);
  const approved = cleanNarration(scene.visualProps.callToAction);
  if (!narration || narration.length > 240 || (approved !== narration && !approved.endsWith(` ${narration}`))) return;
  return { sceneIndex, shots: [{ kind: 'cta', cue: '', headline: narration, evidence: '@1' }] };
}

function validateScene(candidate: unknown, sceneIndex: number, storyboard: Storyboard, timeline: VideoTimeline, allowCode = true): VisualStory['scenes'][number] {
  const sceneLabel = `Scene ${sceneIndex + 1}`;
  const needsVisual = () => new ShotPlanValidationError(
    `${sceneLabel} needs an explanatory visual. Use its spoken event or state change instead of a code shot.`,
    true,
  );
  const parsed = visualSceneSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue.path.at(-1) === 'code') throw needsVisual();
    throw new ShotPlanValidationError(`${sceneLabel} has an invalid ${issue.path.join('.') || 'shot'} field. ${issue.message}`);
  }
  const narration = cleanNarration(storyboard.scenes[sceneIndex].narration);
  const spoken = new Set(numericFacts(narration));
  const hasUnsupportedNumber = (value = '') => numericFacts(value).some(number => !spoken.has(number));
  const scene = {
    ...parsed.data,
    shots: parsed.data.shots.map(shot => {
      if (shot.kind === 'code' && (!allowCode || !narration.includes(cleanNarration(shot.code)))) throw needsVisual();
      if (shot.kind === 'image') {
        const diagram = /^(?:(?:a|an|the)\s+)?(?:(?:animated|technical|isometric|simple|clean|dark|stylized|abstract|[23]d)\s+)*(?:diagram|flowchart|infographic|chart|timeline|icons?)\b/i.test(shot.brief);
        const direction = `${shot.brief} ${shot.action ?? ''}`;
        const graphics = /\b(?:plain|blank|solid) background\b/i.test(direction) &&
          /\b(?:icons?|labels?|labeled|stamps?|diagrams?|connecting lines?)\b/i.test(direction);
        if (diagram || graphics) throw new ShotPlanValidationError(
          `${sceneLabel} treats a diagram as a filmed shot. Use motion with narration-timed actors and events.`, true,
        );
      }
      if (hasUnsupportedNumber(shot.takeaway)) {
        delete shot.takeaway;
        delete shot.takeawayCue;
      }
      if (shot.kind === 'focus') {
        throw new ShotPlanValidationError(`Scene ${sceneIndex + 1} needs a visual action. Use motion with script-grounded actors and events instead of focus.`);
      }
      if (shot.kind === 'cta') {
        throw new ShotPlanValidationError(`Scene ${sceneIndex + 1} needs an explanatory shot. Plan its spoken event or question as image, motion, or device.`);
      }
      if (shot.kind === 'state' && !shot.transfers.length && !shot.actors.some(actor => actor.cue)) {
        throw new ShotPlanValidationError(`Scene ${sceneIndex + 1} needs a timed actor reveal, status change, or transfer.`);
      }
      if ('actors' in shot && shot.kind !== 'motion') {
        for (const actor of shot.actors) if (hasUnsupportedNumber(actor.value)) delete actor.value;
      }
      return shot;
    }),
  };
  try {
    compileVisualPlan({ scenes: [scene] }, storyboard, timeline, sceneIndex, sceneIndex + 1, { repairAnnotations: true });
  } catch (error) {
    if (error instanceof Error && error.message === `${sceneLabel} contains code outside the shot narration.`) throw needsVisual();
    throw new ShotPlanValidationError(error instanceof Error ? error.message : `Scene ${sceneIndex + 1} failed narration checks.`);
  }
  return scene;
}

async function requestVisualPlan(generate: () => Promise<string>): Promise<string> {
  const outageRetries = 4;
  const waitBudgetMs = 20_000;
  let totalWaitMs = 0;
  for (let attempt = 0; ; attempt++) {
    try {
      return await generate();
    } catch (error) {
      if (!(error instanceof GeminiRequestError) || error.retryDelayMs === undefined) throw error;
      const outage = error.status !== undefined && error.status >= 500;
      if (attempt >= (outage ? outageRetries : 1)) throw error;
      const delay = outage ? Math.max(error.retryDelayMs, 1000 * 2 ** attempt) + Math.floor(Math.random() * 250) : error.retryDelayMs;
      if (totalWaitMs + delay > (outage ? waitBudgetMs : 3000)) throw error;
      totalWaitMs += delay;
      await wait(delay);
    }
  }
}

function describeScenes(start: number, end: number): string {
  return end - start === 1 ? `scene ${end}` : `scenes ${start + 1}–${end}`;
}

async function readPlan(file: string): Promise<string | undefined> {
  return fs.readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
  });
}

async function savePlan(file: string, plan: VisualStory | PremiumEdit): Promise<void> {
  await fs.mkdir(library, { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(plan), { flag: 'wx' });
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

async function cachedPlate(hash: string): Promise<string | undefined> {
  for (const extension of ['png', 'jpg']) {
    const file = `${hash}.${extension}`;
    const existing = await fs.stat(path.join(library, file)).catch(() => undefined);
    if (existing?.isFile() && existing.size > 0) return `${assetFolder}/${file}`;
  }
}

async function generateGeminiImage(apiKey: string, model: string, prompt: string, referencePath?: string): Promise<Buffer> {
  const parts: object[] = [{ text: referencePath ? `${prompt}\nUse the reference for continuity while changing the composition.` : prompt }];
  if (referencePath) {
    parts.push({ inlineData: {
      mimeType: referencePath.endsWith('.png') ? 'image/png' : 'image/jpeg',
      data: (await fs.readFile(referencePath)).toString('base64'),
    } });
  }
  const result = await geminiRequest(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, apiKey, {
    contents: [{ parts }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '9:16', imageSize: '2K' } },
  }, 90_000);
  type ImagePart = { thought?: boolean; inlineData?: { mimeType?: string; data?: string } };
  const response = await result.json() as { candidates?: Array<{ content?: { parts?: ImagePart[] } }> };
  const image = response.candidates?.flatMap(candidate => candidate.content?.parts ?? [])
    .find(part => !part.thought && part.inlineData?.data && /^image\/(png|jpeg)$/.test(part.inlineData.mimeType ?? ''))?.inlineData;
  if (!image?.data) throw new Error('Gemini returned no usable image.');
  return Buffer.from(image.data, 'base64');
}

async function savePlate(hash: string, bytes: Buffer): Promise<string> {
  const extension = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) ? 'png'
    : bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')) ? 'jpg' : undefined;
  if (!extension || bytes.length < 64 || bytes.length > 20 * 1024 * 1024) throw new Error('The artwork provider returned an invalid image file.');

  await fs.mkdir(library, { recursive: true });
  const filename = `${hash}.${extension}`;
  const temporary = path.join(library, `${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporary, bytes, { flag: 'wx' });
    await fs.rename(temporary, path.join(library, filename));
  } finally {
    await fs.rm(temporary, { force: true });
  }
  return `${assetFolder}/${filename}`;
}

export async function prepareSceneArtwork(brief: string, evidence: string): Promise<string | undefined> {
  if (process.env.REEL_IMAGE_GENERATION !== 'on') return;
  const provider = process.env.REEL_IMAGE_PROVIDER?.trim() || 'gemini';
  const model = provider === 'cloudflare' ? cloudflareImageModel : process.env.REEL_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-image';
  const imagePrompt = `Portrait 9:16 cinematic editorial illustration of this scene: ${brief}.
Spoken context: ${evidence}. Compose the main subject near the center with room for captions below. Show one physical moment in a believable environment with natural light and controlled color. No text, logos, diagrams or added technical claims.`;
  const hash = createHash('sha256').update(JSON.stringify([provider, model, imagePrompt])).digest('hex');
  const cached = await cachedPlate(hash);
  if (cached) return cached;
  try {
    const key = process.env.GEMINI_API_KEY;
    if (provider === 'cloudflare') return await savePlate(hash, await generateCloudflareImage(imagePrompt));
    if (provider === 'gemini' && key) return await savePlate(hash, await generateGeminiImage(key, model, imagePrompt));
  } catch {
    console.warn('[Storyboard] Scene artwork was unavailable.');
  }
}

export async function saveAppScreen(bytes: Buffer): Promise<string> {
  return savePlate(createHash('sha256').update(bytes).digest('hex'), bytes);
}

export async function saveVectorAsset(bytes: Buffer): Promise<string> {
  await fs.mkdir(library, { recursive: true });
  const filename = `${createHash('sha256').update(bytes).digest('hex')}.svg`;
  const temporary = path.join(library, `${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporary, bytes, { flag: 'wx' });
    await fs.rename(temporary, path.join(library, filename));
  } finally {
    await fs.rm(temporary, { force: true });
  }
  return `${assetFolder}/${filename}`;
}

async function stagePublicAppScreens(plan: VisualPlan, storyboard: Storyboard, timeline: VideoTimeline, search = true): Promise<VisualPlan> {
  const shots = planPublicPostShots(plan, storyboard, timeline);
  const captures = new Map<string, string | undefined>();
  for (const [sceneIndex, group] of shots.entries()) for (const shot of group) {
    if (shot.kind !== 'device' || shot.appName?.toLowerCase() !== 'instagram' || shot.asset || shot.scanFrame !== undefined) continue;
    try {
      const subject = narrationAnchors(storyboard.scenes[sceneIndex].narration).find(anchor => anchor.id === shot.evidence)?.text ?? shot.evidence;
      const url = shot.publicPostUrl ?? (search && /\bpost\b|पोस्ट/iu.test(subject) ? await searchInstagramPost(subject) : undefined);
      if (!url) continue;
      if (!captures.has(url)) {
        const hash = createHash('sha256').update(`instagram-embed-v1:${url}`).digest('hex');
        const asset = await cachedPlate(hash) ?? await savePlate(hash, await captureInstagramPost(url));
        captures.set(url, asset);
      }
      shot.publicPostUrl = url;
      shot.asset = captures.get(url);
    } catch (error) {
      console.warn('[Public App Screen]', error instanceof Error ? error.message : 'Capture unavailable');
    }
  }
  return shots;
}

export async function prepareSavedReelVisuals(storyboard: Storyboard, timeline: VideoTimeline,
  previous: ReelVisualAssets | undefined, overrides?: StoryDirectionOverrides): Promise<ReelVisualAssets> {
  if (previous?.shots.length === storyboard.scenes.length && previous.shots.flat().every(shot => shot.premium)) return previous;
  if (isOfflineMessagingStory(storyboard)) return offlineMessagingAssets(storyboard, timeline, previous);
  const saved = previous?.shots.length === storyboard.scenes.length ? previous : undefined;
  const base = saved?.shots ?? buildLocalFilmPlan(storyboard, timeline);
  return {
    fingerprint: saved?.fingerprint ?? '', status: 'ready', direction: saved?.direction ?? 'local',
    shots: await stagePublicAppScreens(stageDirectedFilm(base, storyboard, timeline, overrides), storyboard, timeline, false),
  };
}

function offlineMessagingAssets(storyboard: Storyboard, timeline: VideoTimeline, previous?: ReelVisualAssets): ReelVisualAssets {
  const fingerprint = createHash('sha256').update(JSON.stringify(['offline-messaging-v2', storyboard, timeline])).digest('hex');
  return { fingerprint, status: 'ready', direction: 'directed', shots: directOfflineMessaging(storyboard, timeline, previous?.shots) };
}

export async function prepareReelVisuals(
  storyboard: Storyboard,
  timeline: VideoTimeline,
  previous?: ReelVisualAssets,
  options: { throughFrame?: number; overrides?: StoryDirectionOverrides; localFilm?: boolean; premium?: boolean; editorFeedback?: string } = {},
): Promise<ReelVisualAssets> {
  const premium = options.premium === true;
  const animated = options.localFilm === true && !premium;
  if (animated && isOfflineMessagingStory(storyboard)) return offlineMessagingAssets(storyboard, timeline, previous);
  const imageProvider = process.env.REEL_IMAGE_PROVIDER?.trim() || 'gemini';
  if (!animated && imageProvider !== 'gemini' && imageProvider !== 'cloudflare') throw new Error('REEL_IMAGE_PROVIDER must be gemini or cloudflare.');
  const geminiImageModel = process.env.REEL_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-image';
  const model = imageProvider === 'cloudflare' ? cloudflareImageModel : geminiImageModel;
  const videoModel = process.env.REEL_STORY_VIDEO_MODEL?.trim();
  const scriptProvider = process.env.LLM_PROVIDER === 'groq' ? 'groq' : 'gemini';
  const directorProvider = (premium && process.env.REEL_PREMIUM_DIRECTOR_PROVIDER?.trim()) || process.env.REEL_DIRECTOR_PROVIDER?.trim() || scriptProvider;
  if (directorProvider !== 'gemini' && directorProvider !== 'groq') throw new Error('REEL_DIRECTOR_PROVIDER must be gemini or groq.');
  const providerModels = { groq: process.env.GROQ_MODEL?.trim(), gemini: process.env.GEMINI_MODEL?.trim() };
  const directorModel = (premium && process.env.REEL_PREMIUM_DIRECTOR_MODEL?.trim()) || process.env.REEL_DIRECTOR_MODEL?.trim() || providerModels[directorProvider];
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const scenes = storyboard.scenes.map((scene, sceneIndex) => ({
    sceneIndex, narration: cleanNarration(scene.narration),
    durationSec: (timeline.segments[sceneIndex]?.audioDurationMs ?? 0) / 1000,
  }));
  // A dashboard preview and a full export share the complete directed plan.
  const visualLimit = animated || premium ? Number.POSITIVE_INFINITY : options.throughFrame ?? Number.POSITIVE_INFINITY;
  const plannedSceneCount = timeline.segments.filter(segment => segment.startFrame <= visualLimit).length;
  const editorFeedback = premium ? (options.editorFeedback ?? previous?.editorFeedback)?.trim() : undefined;
  const scriptInput = JSON.stringify({ title: storyboard.title, scenes, ...(editorFeedback && { editorFeedback }) });
  const editorialPrompt = editorFeedback
    ? `${premiumEditorialPrompt}\nApply the supplied editorFeedback to visual direction only. Keep all scenes, narration and technical claims grounded in the supplied script.`
    : premiumEditorialPrompt;
  // Keep existing plans and artwork when an independent planning or artwork provider is selected.
  const legacyDirectorModel = directorProvider === scriptProvider ? directorModel : providerModels[scriptProvider];
  const planFingerprint = createHash('sha256').update(JSON.stringify(animated
    ? [animatedDirection, directorProvider, directorModel, scriptInput, timeline]
    : premium ? [anchorDirection, editorialPrompt, premiumShotPrompt, 'premium-v1', directorProvider, directorModel, scriptInput, timeline]
      : [direction, geminiImageModel, scriptProvider, legacyDirectorModel, scriptInput, timeline])).digest('hex');
  const overrides = Object.entries(options.overrides ?? {}).sort(([left], [right]) => left.localeCompare(right));
  const fingerprint = animated ? planFingerprint
    : createHash('sha256').update(JSON.stringify([planFingerprint, imageProvider, model, cloudflareImageSize, videoModel, overrides])).digest('hex');
  const closing = approvedClosingCard(storyboard);
  const hasUnapprovedCta = (plan: VisualPlan) => plan.some((group, sceneIndex) =>
    sceneIndex !== closing?.sceneIndex && group.some(shot => shot.kind === 'cta'));
  if (previous?.fingerprint === fingerprint && previous.shots && !hasUnapprovedCta(previous.shots)) {
    if (animated) {
      if (previous.shots.length === storyboard.scenes.length) {
        const staged = stageDirectedFilm(previous.shots, storyboard, timeline, options.overrides);
        return { ...previous, shots: await stagePublicAppScreens(staged, storyboard, timeline) };
      }
    } else {
      const paths = previous.shots.flat().flatMap(shot => [shot.asset, shot.beatAsset, shot.clip?.asset].filter((file): file is string => Boolean(file)));
      if ((await Promise.all(paths.map(file => fs.access(path.join('media', file)).then(() => true, () => false)))).every(Boolean)) return previous;
    }
  }
  const workKey = animated ? `${fingerprint}:${JSON.stringify(overrides)}` : `${fingerprint}:${premium ? 'full' : options.throughFrame ?? 'full'}`;
  const pending = active.get(workKey);
  if (pending) return pending;
  const work = (async (): Promise<ReelVisualAssets> => {
    const file = path.join(library, `${planFingerprint}.json`);
    const saved = await readPlan(file);
    let shots: VisualPlan | undefined;
    let localScenes: number[] = [];
    let cachedScenes: unknown[] = [];
    let editorialPlan: PremiumEdit | undefined;
    const isMechanism = (index: number) => editorialPlan?.scenes.find(scene => scene.sceneIndex === index)?.purpose === 'mechanism';
    const editFile = path.join(library, `${planFingerprint}.edit.json`);
    if (premium) {
      const savedEdit = await readPlan(editFile);
      if (savedEdit) {
        try { editorialPlan = premiumEditSchema.parse(JSON.parse(savedEdit)); } catch { /* Rebuild an invalid editorial plan. */ }
      }
    }
    if (saved) {
      try {
        cachedScenes = parseDraft(saved);
        const compiled = compileVisualPlan({ scenes: cachedScenes }, storyboard, timeline, 0, storyboard.scenes.length, { repairAnnotations: true });
        if (!hasUnapprovedCta(compiled) && (!premium || (editorialPlan && !validatePremiumHook(compiled, storyboard, timeline)
          && compiled.every((group, index) => !validatePremiumMechanism(group, isMechanism(index), index))))) shots = compiled;
      } catch (error) {
        console.warn('[VisualPlanner] Replanning an invalid cached shot plan:', error instanceof Error ? error.message : 'Invalid plan');
      }
    }
    if (!shots) {
      const directorKey = directorProvider === 'groq'
        ? process.env.GROQ_API_KEYS?.trim() || process.env.GROQ_API_KEY?.trim()
        : apiKey;
      const provider = !directorKey ? undefined : directorProvider === 'groq'
        ? new GroqProvider(directorKey, directorModel)
        : new GeminiProvider(directorKey, directorModel);
      const responseSchema = directorProvider === 'groq' ? groqShotSchema : shotResponseSchema;
      const alternateKey = directorProvider === 'groq' ? apiKey : process.env.GROQ_API_KEYS?.trim() || process.env.GROQ_API_KEY?.trim();
      const backup = !premium || !alternateKey ? undefined : directorProvider === 'groq'
        ? new GeminiProvider(alternateKey, providerModels.gemini) : new GroqProvider(alternateKey, providerModels.groq);
      let preferBackup = false;
      const generate = async (prompt: string, instructions: string, schema: object, backupSchema = schema) => {
        const callBackup = () => backup!.generateJSON(prompt, instructions, 60_000, backupSchema);
        if (backup && (!provider || preferBackup)) return requestVisualPlan(callBackup);
        if (!provider) throw new VisualPlanningError(`Visual planning needs a configured ${directorProvider} API key.`);
        try { return await requestVisualPlan(() => provider.generateJSON(prompt, instructions, 60_000, schema)); }
        catch (error) {
          const status = error instanceof GeminiRequestError ? error.status : Number(error instanceof Error ? /^Groq API error \[(\d+)\]/.exec(error.message)?.[1] : 0);
          if (!backup || (!status || (status !== 429 && status < 500))) throw error;
          preferBackup = true;
          return requestVisualPlan(callBackup);
        }
      };
      if (premium && !editorialPlan) {
        try {
          const raw = await generate(scriptInput, editorialPrompt, premiumEditResponse);
          editorialPlan = premiumEditSchema.parse(parseDirectorJson(raw));
          const indices = editorialPlan.scenes.map(scene => scene.sceneIndex).sort((left, right) => left - right);
          if (indices.length !== scenes.length || indices.some((index, expected) => index !== expected)) {
            throw new Error('The editorial plan needs one entry for each scene.');
          }
          await savePlan(editFile, editorialPlan);
        } catch (error) {
          const detail = error instanceof z.ZodError ? error.issues.map(issue => `${issue.path.join('.')} ${issue.message}`).join(', ')
            : error instanceof Error ? error.message : 'The provider returned an invalid plan.';
          throw new VisualPlanningError(`Could not complete the premium editorial plan. ${detail}`);
        }
      }
      const planned: VisualStory['scenes'] = [];
      let directorUnavailable = !provider;
      const entities = new Map<string, string>();
      const settings = new Set<string>();
      const scenesWithAnchors = scenes.map(scene => ({
        ...scene,
        allowCode: storyboard.scenes[scene.sceneIndex].type === 'code' ||
          /`[^`]+`|\b(?:command|syntax|snippet)\b|\b[\w.]+\([^()]*\)|(?:^|\s)--[a-z]/iu.test(scene.narration),
        spokenNumbers: [...new Set(numericFacts(scene.narration))],
        anchors: narrationAnchors(scene.narration).map(anchor => {
          const segment = timeline.segments[scene.sceneIndex];
          const frame = segment?.wordFrames?.[anchor.start];
          const seconds = frame === undefined
            ? anchor.start / Math.max(1, scene.narration.split(' ').length) * scene.durationSec
            : frame / timeline.fps;
          return { id: anchor.id, text: anchor.text, seconds: Number(seconds.toFixed(2)) };
        }),
      }));
      const rememberContinuity = (scene: VisualStory['scenes'][number]) => {
        for (const shot of scene.shots) {
          if (shot.kind === 'image') settings.add(shot.continuity);
          if ('actors' in shot) for (const actor of shot.actors) entities.set(actor.entity, actor.label);
        }
      };
      const checkpoints: string[] = [];
      for (let start = 0; start < plannedSceneCount; start += scenesPerRequest) {
        const end = Math.min(plannedSceneCount, start + scenesPerRequest);
        const indices = scenes.slice(start, end).map(scene => scene.sceneIndex);
        const approved = new Map<number, VisualStory['scenes'][number]>();
        if (closing && indices.includes(closing.sceneIndex)) approved.set(closing.sceneIndex, closing);
        let label = describeScenes(start, end);
        const requestPlan = async (requestedIndices: number[], validationFeedback?: string) => {
          const requested = new Set(requestedIndices);
          const inputs = scenesWithAnchors.filter(scene => requested.has(scene.sceneIndex));
          label = describeScenes(requestedIndices[0], requestedIndices[requestedIndices.length - 1] + 1);
          const prompt = JSON.stringify({
            title: storyboard.title,
            scenes: inputs,
            storyContext: scenes.filter(scene => !requested.has(scene.sceneIndex)),
            establishedEntities: { actors: Object.fromEntries(entities), settings: [...settings] },
            ...(editorialPlan && { editorialPlan, editorFeedback }),
            validationFeedback,
          });
          const instructions = animated ? animatedDirection : premium ? `${anchorDirection}\n${premiumShotPrompt}` : anchorDirection;
          const allowCode = inputs.some(scene => scene.allowCode);
          const alternateSchema = directorProvider === 'groq' ? shotResponseSchema : groqShotSchema;
          return generate(prompt, instructions, responseSchema(allowCode, animated, premium), alternateSchema(allowCode, animated, premium));
        };
        const requestMotionRepair = async (index: number) => {
          label = describeScenes(index, index + 1);
          const { narration, anchors } = scenesWithAnchors[index];
          const schema = strictRecord({
            headline: text,
            actors: listOf(strictRecord({ entity: text, label: text, icon: enumOf(motionIcons) }), 4),
            updates: listOf(strictRecord({
              entity: text, cue: enumOf(anchors.map(anchor => anchor.id)), value: text,
            }), 4),
          });
          const prompt = JSON.stringify({ narration, anchors, establishedActors: Object.fromEntries(entities) });
          const raw = await generate(prompt, motionRepairDirection, schema);
          return parseMotionRepair(raw, index);
        };
        const checkpoint = path.join(library, `${planFingerprint}.${start}.json`);
        checkpoints.push(checkpoint);
        let checkpointCount = 0;
        let laterCachedScenes: VisualStory['scenes'] = [];
        const saveApproved = async () => {
          if (!approved.size) return;
          await savePlan(checkpoint, { scenes: [
            ...indices.flatMap(index => approved.get(index) ?? []), ...laterCachedScenes,
          ] });
          checkpointCount = approved.size;
        };
        const keepScene = (draft: unknown[], index: number, allowCode = true) => {
          const scene = validateScene(sceneFromDraft(draft, index), index, storyboard, timeline, allowCode);
          if (premium && scene.shots.some(shot => shot.kind === 'film')) {
            throw new ShotPlanValidationError(`Scene ${index + 1} contains a stock physical shot. Choose story artwork, a screen or a diagram.`);
          }
          if (premium && scene.shots.some(shot => shot.kind === 'image' && (!shot.action || !shot.camera))) {
            throw new ShotPlanValidationError(`Scene ${index + 1} needs a specific opening frame, visible action and camera direction for each artwork shot.`);
          }
          if (premium && (index === 0 || isMechanism(index))) {
            const compiled = compileVisualPlan({ scenes: [scene] }, storyboard, timeline, index, index + 1, { repairAnnotations: true });
            const issue = validatePremiumMechanism(compiled[0], isMechanism(index), index)
              ?? (index === 0 ? validatePremiumHook(compiled, storyboard, timeline) : undefined);
            if (issue) throw new ShotPlanValidationError(issue);
          }
          if (animated && scene.shots.some(shot => shot.kind === 'image')) {
            throw new ShotPlanValidationError(`Scene ${index + 1} requires film or an animated diagram.`, true);
          }
          if (animated && scene.shots.some(shot => shot.kind === 'film' && shot.set === 'room' && shot.performance === 'open') &&
              !/\b(?:fridge|refrigerator|cabinet|cupboard|compartment)\b|फ्रिज|अलमारी/iu.test(scenes[index].narration)) {
            throw new ShotPlanValidationError(`Scene ${index + 1} does not narrate a compartment opening. Use the narrated device action or explanation.`, true);
          }
          if (animated && scene.shots.some(shot => shot.kind === 'film' &&
              ((shot.performance === 'scan' && !/\b(?:qr|scan\w*)\b|स्कैन/iu.test(scenes[index].narration)) ||
               (shot.performance === 'confirm' && !/sound\s*box|speaker|साउंड\s*बॉक्स|स्पीकर/iu.test(scenes[index].narration))))) {
            throw new ShotPlanValidationError(`Scene ${index + 1} does not narrate the scan or payment speaker shown. Use a device or motion shot.`, true);
          }
          approved.set(index, scene);
          rememberContinuity(scene);
        };
        try {
          const savedBatch = await readPlan(checkpoint);
          let cached = cachedScenes;
          if (savedBatch) {
            try {
              cached = parseDraft(savedBatch);
              laterCachedScenes = cached.flatMap(entry => {
                const parsed = visualSceneSchema.safeParse(entry);
                return parsed.success && parsed.data.sceneIndex >= end ? [parsed.data] : [];
              });
            } catch (error) {
              if (!(error instanceof ShotPlanValidationError)) throw error;
              console.warn('[VisualPlanner] Ignoring an unreadable partial plan:', error.message);
            }
          }
          const cachedMotionRepairs: number[] = [];
          if (cached.length) {
            for (const index of indices) {
              if (approved.has(index)) continue;
              try {
                keepScene(cached, index);
              } catch (error) {
                if (!(error instanceof ShotPlanValidationError)) throw error;
                if (error.retryWithoutCode) cachedMotionRepairs.push(index);
              }
            }
            checkpointCount = approved.size;
          }
          if (animated && directorUnavailable) {
            planned.push(...approved.values());
            localScenes.push(...indices.filter(index => !approved.has(index)));
            continue;
          }
          for (const index of cachedMotionRepairs) {
            keepScene([await requestMotionRepair(index)], index, false);
            await saveApproved();
          }
          const missing = indices.filter(index => !approved.has(index));
          if (missing.length) {
            const raw = await requestPlan(missing);
            let draft: unknown[];
            try {
              draft = parseDraft(raw);
            } catch (error) {
              if (!(error instanceof ShotPlanValidationError)) throw error;
              draft = parseDraft(await requestPlan(missing, error.message));
            }
            const repairs = new Map<number, ShotPlanValidationError>();
            for (const index of missing) {
              try {
                keepScene(draft, index, scenesWithAnchors[index].allowCode);
              } catch (error) {
                if (!(error instanceof ShotPlanValidationError)) throw error;
                repairs.set(index, error);
              }
            }
            await saveApproved();
            for (const [index, failure] of repairs) {
              console.warn('[VisualPlanner] Retrying a scene:', failure.message);
              if (!failure.retryWithoutCode) {
                try {
                  keepScene(parseDraft(await requestPlan([index], failure.message)), index, scenesWithAnchors[index].allowCode);
                } catch (error) {
                  if (!(error instanceof ShotPlanValidationError)) throw error;
                  keepScene([await requestMotionRepair(index)], index, false);
                }
              } else {
                keepScene([await requestMotionRepair(index)], index, false);
              }
              await saveApproved();
            }
          }
        } catch (error) {
          const groqStatus = error instanceof Error ? /^Groq API error \[(\d+)\]/.exec(error.message) : null;
          if (animated) {
            const status = Number(error instanceof GeminiRequestError ? error.status : groqStatus?.[1]);
            directorUnavailable = directorUnavailable || status === 429 || status === 401 || status === 403 || status >= 500;
            const missing = indices.filter(index => !approved.has(index));
            localScenes.push(...missing);
            console.warn(`[VisualPlanner] Using local direction for scenes ${missing.map(index => index + 1).join(', ')}.`);
            planned.push(...approved.values());
            continue;
          }
          if (error instanceof VisualPlanningError) throw error;
          const detail = error instanceof GeminiRequestError || error instanceof ShotPlanValidationError ? error.message
            : groqStatus ? `Groq returned HTTP ${groqStatus[1]}. Check the configured model and project quota.`
            : 'The model could not produce a valid shot plan for these scenes.';
          const unavailable = error instanceof GeminiRequestError && error.status === 503;
          const firstMissing = checkpointCount === approved.size ? indices.find(index => !approved.has(index)) ?? start : start;
          const savedCount = planned.length + checkpointCount;
          const resume = savedCount ? ` ${savedCount} validated scenes are saved. Generate Previews will resume at scene ${firstMissing + 1}.` : '';
          throw new VisualPlanningError(`Visual planning failed for ${label}. ${detail}${resume}`, unavailable);
        }
        planned.push(...indices.flatMap(index => approved.get(index) ?? []));
      }
      if (localScenes.length) {
        const local = buildLocalFilmPlan(storyboard, timeline);
        for (const scene of planned) {
          local[scene.sceneIndex] = compileVisualPlan({ scenes: [scene] }, storyboard, timeline, scene.sceneIndex,
            scene.sceneIndex + 1, { repairAnnotations: true })[0];
        }
        shots = local;
      } else shots = compileVisualPlan({ scenes: planned }, storyboard, timeline, 0, plannedSceneCount, { repairAnnotations: true });
      if (plannedSceneCount === scenes.length && !localScenes.length) {
        await savePlan(file, { scenes: planned });
        await Promise.all(checkpoints.map(checkpoint => fs.rm(checkpoint, { force: true }).catch(() => undefined)));
      }
    }
    if (animated) {
      return {
        fingerprint, shots: await stagePublicAppScreens(stageDirectedFilm(shots, storyboard, timeline, options.overrides), storyboard, timeline), status: 'ready',
        direction: localScenes.length === 0 ? 'directed' : localScenes.length === scenes.length ? 'local' : 'mixed',
      };
    }
    const continuity = new Map<string, string>();
    let videoUnavailable = false;
    for (const shot of shots.flatMap((group, index) =>
      group.filter(entry => timeline.segments[index].startFrame + entry.from <= visualLimit)
    )) {
      if (shot.kind !== 'image') continue;
      shot.action = options.overrides?.[shot.id]?.action || shot.action || shot.brief;
      shot.camera = options.overrides?.[shot.id]?.camera || shot.camera || 'push-in';
      const prompt = [
        'Generate a cinematic vertical 9:16 frame for an educational reel.',
        'Use stylized 3D animated-film art direction, practical lighting, tactile materials, depth of field and clear silhouettes. Keep the main action centered and the caption area quiet.',
        'Create a distinct foreground prop and depth through foreground, midground and background. Use charcoal shadows and selective color so the scene can cut into a dark animated diagram.',
        'Leave text, numbers, readable screens, logos, and QR codes out of the image.',
        `Reel: ${storyboard.title}`,
        `Action and framing: ${shot.brief}`,
        `Opening pose for the following action: ${shot.action}`,
        `Recurring subjects and setting: ${shot.continuity}`,
        ...(editorialPlan ? [`Reel visual continuity: ${editorialPlan.continuity}`] : []),
      ].join('\n');
      const reference = continuity.get(shot.continuity);
      // Scope the cache to this version of this reel; a retry can resume completed shots.
      const hash = createHash('sha256').update(JSON.stringify([model, imageProvider, cloudflareImageSize, shot.id, prompt, reference])).digest('hex');
      try {
        const getArtwork = async (key: string, instructions: string, reference?: string) => {
          const cached = await cachedPlate(key);
          if (cached) return cached;
          if (process.env.REEL_IMAGE_GENERATION === 'off') throw new Error('Image generation is disabled.');
          const referencePath = reference ? path.join('media', reference) : undefined;
          if (imageProvider === 'gemini' && !apiKey) throw new Error('Gemini artwork requires GEMINI_API_KEY.');
          const bytes = imageProvider === 'cloudflare' ? await generateCloudflareImage(instructions, referencePath)
            : await generateGeminiImage(apiKey!, model, instructions, referencePath);
          return savePlate(key, bytes);
        };
        shot.asset = await getArtwork(hash, prompt, reference);
        if (!reference) continuity.set(shot.continuity, shot.asset);
        if (videoModel && !videoUnavailable) {
          if (!apiKey) throw new Error('Motion clips require GEMINI_API_KEY.');
          try {
            shot.clip = await prepareStoryClip({
              library, assetFolder, image: shot.asset, model: videoModel, apiKey,
              action: shot.action, camera: shot.camera, seconds: shot.duration / timeline.fps,
              ...(premium && shot.actionFrame !== undefined && { actionAtSec: shot.actionFrame / timeline.fps }),
            });
          } catch (error) {
            if (!premium || !(error instanceof StoryClipRequestError) || ![402, 403, 429, 503].includes(error.status)) throw error;
            console.warn(`[VisualArtwork] ${error.message} The remaining shots will use artwork.`);
            videoUnavailable = true;
          }
        }
        if (!shot.clip && premium && shot.actionFrame !== undefined && shot.actionFrame > 0 && shot.duration - shot.actionFrame > timeline.fps * 0.45) {
          const resultPrompt = `${prompt}\nShow the visible result after this one action finishes: ${shot.action}. Use the supplied opening artwork as a reference. Keep the camera framing, characters and environment consistent. Change the object or pose needed to make the action readable.`;
          const resultHash = createHash('sha256').update(JSON.stringify([hash, resultPrompt, shot.asset])).digest('hex');
          shot.beatAsset = await getArtwork(resultHash, resultPrompt, shot.asset);
        }
      } catch (error) {
        throw new VisualAssetError(shot.id, error instanceof Error ? error.message : 'Image generation failed.');
      }
    }
    if (premium) {
      const retained = previous?.shots.flat();
      for (const shot of shots.flat()) {
        if (shot.kind !== 'device' || !shot.appName) continue;
        const capture = retained?.find(item => item.id === shot.id && item.kind === 'device' && item.appName === shot.appName && item.evidence === shot.evidence);
        if (capture?.asset && !capture.publicPostUrl) shot.asset = capture.asset;
      }
      shots = await stagePublicAppScreens(shots, storyboard, timeline);
      for (const shot of shots.flat()) shot.premium = true;
    }
    return { fingerprint, shots, status: 'ready', ...(premium && { direction: 'directed' as const, visualThread: editorialPlan?.visualThread, editorFeedback }) };
  })();
  active.set(workKey, work);
  try {
    return await work;
  } finally {
    active.delete(workKey);
  }
}

export async function stageReelVisuals(bundlePath: string, shots: VisualPlan = []): Promise<void> {
  const destination = path.join(bundlePath, 'public', assetFolder);
  const sources = new Set<string>();
  for (const shot of shots.flat()) {
    for (const layer of shot.vector?.layers ?? []) if (layer.asset) sources.add(layer.asset);
    if (shot.kind === 'image' && !shot.asset) throw new VisualAssetError(shot.id, 'Required artwork is missing.');
    if (shot.kind !== 'image' && !(shot.kind === 'device' && shot.appName)) continue;
    if (shot.asset) sources.add(shot.asset);
    if (shot.beatAsset) sources.add(shot.beatAsset);
    for (const layer of shot.layers?.subjects ?? []) sources.add(layer.asset);
    if (shot.clip) sources.add(shot.clip.asset);
  }
  for (const source of sources) {
    const [folder, filename, extra] = source.split('/');
    if (folder !== assetFolder || !(assetName.test(filename ?? '') || /^[a-f0-9]{64}\.(?:mp4|svg)$/.test(filename ?? '')) || extra !== undefined) {
      throw new Error('Invalid cached reel visual path.');
    }
    await fs.mkdir(destination, { recursive: true });
    const target = path.join(destination, filename);
    if (await fs.access(target).then(() => true, () => false)) continue;
    // Publish atomically so simultaneous preview and export requests never see a partial file.
    const temporary = path.join(destination, `${randomUUID()}.tmp`);
    try {
      await fs.copyFile(path.join(library, filename), temporary);
      await fs.rename(temporary, target);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }
}
