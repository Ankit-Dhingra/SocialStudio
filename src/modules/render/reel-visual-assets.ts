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
  cameraMoves, cleanNarration, compileVisualPlan, motionEffects, motionIcons, narrationAnchors, numericFacts, packetOutcomes,
  visualSceneSchema, type StoryDirectionOverrides, type VisualPlan, type VisualStory,
} from '../video/visual-story.js';
import { prepareStoryClip } from './story-video-provider.js';
import { buildLocalFilmPlan } from '../video/local-film.js';

export interface ReelVisualAssets {
  fingerprint: string;
  shots: VisualPlan;
  status: 'ready';
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

const motionRepairDirection = `Direct one continuous animated diagram for the supplied approved narration. Return only headline, actors, and updates.
Choose up to four actors or objects from the narration. Reuse an established entity ID when it represents the same object. Show the concrete operation or constraint using one to four visible states. Each update's value must describe a fact explicitly stated in its selected cue. Omit guessed initial states and consequences that the chosen cue does not say. One well-grounded update is enough. Use short qualitative values and a short headline. Do not add commands, measurements, or outcomes.`;

// Keep the provider schema flat. The local validator checks kind-specific fields and narration timing.
const text = { type: 'string' };
const listOf = (items: object, maxItems?: number) => ({ type: 'array', items, maxItems });
const recordOf = (properties: Record<string, object>, required: string[]) => ({ type: 'object', properties, required });
const enumOf = (values: readonly string[]) => ({ type: 'string', enum: values });
const shotResponseSchema = (allowCode: boolean) => recordOf({
  scenes: listOf(recordOf({
    sceneIndex: { type: 'integer' },
    shots: listOf(recordOf({
      kind: enumOf(['image', 'motion', 'flow', 'state', 'comparison', 'device', ...(allowCode ? ['code'] : [])]),
      cue: text, headline: text, evidence: text, takeaway: text, takeawayCue: text,
      brief: text, continuity: text, action: text, camera: enumOf(cameraMoves), ...(allowCode ? { code: text } : {}), scanCue: text,
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
const groqShotSchema = (allowCode: boolean) => strictRecord({
  scenes: listOf(strictRecord({
    sceneIndex: { type: 'integer' },
    shots: listOf({ anyOf: [
      shotKind(['image'], { brief: text, continuity: text, action: text, camera: enumOf(cameraMoves) }),
      shotKind(['motion'], { actors: listOf(strictMotionActor), events: listOf(strictMotionEvent), reset: { type: 'boolean' }, backdrop: { type: 'boolean' } }),
      shotKind(['flow', 'state'], { actors: listOf(strictActor), transfers: listOf(strictTransfer) }),
      shotKind(['comparison'], { actors: listOf(strictActor) }),
      shotKind(['device'], { actors: listOf(strictActor), backdrop: { type: 'boolean' }, scanCue: nullableText }),
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

function approvedClosingCard(storyboard: Storyboard): VisualStory['scenes'][number] | undefined {
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

async function savePlan(file: string, plan: VisualStory): Promise<void> {
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

export async function prepareReelVisuals(
  storyboard: Storyboard,
  timeline: VideoTimeline,
  previous?: ReelVisualAssets,
  options: { throughFrame?: number; overrides?: StoryDirectionOverrides; localFilm?: boolean } = {},
): Promise<ReelVisualAssets> {
  if (options.localFilm) {
    const fingerprint = createHash('sha256').update(JSON.stringify(['local-film', storyboard, timeline, options.overrides])).digest('hex');
    return { fingerprint, shots: buildLocalFilmPlan(storyboard, timeline, options.overrides), status: 'ready' };
  }
  const imageProvider = process.env.REEL_IMAGE_PROVIDER?.trim() || 'gemini';
  if (imageProvider !== 'gemini' && imageProvider !== 'cloudflare') throw new Error('REEL_IMAGE_PROVIDER must be gemini or cloudflare.');
  const geminiImageModel = process.env.REEL_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-image';
  const model = imageProvider === 'cloudflare' ? cloudflareImageModel : geminiImageModel;
  const videoModel = process.env.REEL_STORY_VIDEO_MODEL?.trim();
  const scriptProvider = process.env.LLM_PROVIDER === 'groq' ? 'groq' : 'gemini';
  const directorProvider = process.env.REEL_DIRECTOR_PROVIDER?.trim() || scriptProvider;
  if (directorProvider !== 'gemini' && directorProvider !== 'groq') throw new Error('REEL_DIRECTOR_PROVIDER must be gemini or groq.');
  const providerModels = { groq: process.env.GROQ_MODEL?.trim(), gemini: process.env.GEMINI_MODEL?.trim() };
  const directorModel = process.env.REEL_DIRECTOR_MODEL?.trim() || providerModels[directorProvider];
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const scenes = storyboard.scenes.map((scene, sceneIndex) => ({
    sceneIndex, narration: cleanNarration(scene.narration),
    durationSec: (timeline.segments[sceneIndex]?.audioDurationMs ?? 0) / 1000,
  }));
  const visualLimit = options.throughFrame ?? Number.POSITIVE_INFINITY;
  const plannedSceneCount = timeline.segments.filter(segment => segment.startFrame <= visualLimit).length;
  const scriptInput = JSON.stringify({ title: storyboard.title, scenes });
  // Keep existing plans and artwork when an independent planning or artwork provider is selected.
  const legacyDirectorModel = directorProvider === scriptProvider ? directorModel : providerModels[scriptProvider];
  const planFingerprint = createHash('sha256').update(JSON.stringify([direction, geminiImageModel, scriptProvider, legacyDirectorModel, scriptInput, timeline])).digest('hex');
  const overrides = Object.entries(options.overrides ?? {}).sort(([left], [right]) => left.localeCompare(right));
  const fingerprint = createHash('sha256').update(JSON.stringify([planFingerprint, imageProvider, model, cloudflareImageSize, videoModel, overrides])).digest('hex');
  const closing = approvedClosingCard(storyboard);
  const hasUnapprovedCta = (plan: VisualPlan) => plan.some((group, sceneIndex) =>
    sceneIndex !== closing?.sceneIndex && group.some(shot => shot.kind === 'cta'));
  if (previous?.fingerprint === fingerprint && previous.shots && !hasUnapprovedCta(previous.shots)) {
    const paths = previous.shots.flat().flatMap(shot => [shot.asset, shot.clip?.asset].filter((file): file is string => Boolean(file)));
    if ((await Promise.all(paths.map(file => fs.access(path.join('media', file)).then(() => true, () => false)))).every(Boolean)) return previous;
  }
  const workKey = `${fingerprint}:${options.throughFrame ?? 'full'}`;
  const pending = active.get(workKey);
  if (pending) return pending;
  const work = (async (): Promise<ReelVisualAssets> => {
    const file = path.join(library, `${planFingerprint}.json`);
    const saved = await readPlan(file);
    let shots: VisualPlan | undefined;
    let cachedScenes: unknown[] = [];
    if (saved) {
      try {
        cachedScenes = parseDraft(saved);
        const compiled = compileVisualPlan({ scenes: cachedScenes }, storyboard, timeline, 0, storyboard.scenes.length, { repairAnnotations: true });
        if (!hasUnapprovedCta(compiled)) shots = compiled;
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
      const planned: VisualStory['scenes'] = [];
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
          if (!provider) throw new VisualPlanningError(`Visual planning needs a configured ${directorProvider} API key.`);
          const requested = new Set(requestedIndices);
          const inputs = scenesWithAnchors.filter(scene => requested.has(scene.sceneIndex));
          label = describeScenes(requestedIndices[0], requestedIndices[requestedIndices.length - 1] + 1);
          const prompt = JSON.stringify({
            title: storyboard.title,
            scenes: inputs,
            storyContext: scenes.filter(scene => !requested.has(scene.sceneIndex)),
            establishedEntities: { actors: Object.fromEntries(entities), settings: [...settings] },
            validationFeedback,
          });
          return requestVisualPlan(() => provider.generateJSON(prompt, anchorDirection, 60_000, responseSchema(inputs.some(scene => scene.allowCode))));
        };
        const requestMotionRepair = async (index: number) => {
          if (!provider) throw new VisualPlanningError(`Visual planning needs a configured ${directorProvider} API key.`);
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
          const raw = await requestVisualPlan(() => provider.generateJSON(prompt, motionRepairDirection, 60_000, schema));
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
          if (error instanceof VisualPlanningError) throw error;
          const groqStatus = error instanceof Error && /^Groq API error \[(\d+)\]/.exec(error.message);
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
      shots = compileVisualPlan({ scenes: planned }, storyboard, timeline, 0, plannedSceneCount, { repairAnnotations: true });
      if (plannedSceneCount === scenes.length) {
        await savePlan(file, { scenes: planned });
        await Promise.all(checkpoints.map(checkpoint => fs.rm(checkpoint, { force: true }).catch(() => undefined)));
      }
    }
    const continuity = new Map<string, string>();
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
      ].join('\n');
      const reference = continuity.get(shot.continuity);
      // Scope the cache to this version of this reel; a retry can resume completed shots.
      const hash = createHash('sha256').update(JSON.stringify([model, imageProvider, cloudflareImageSize, shot.id, prompt, reference])).digest('hex');
      try {
        shot.asset = await cachedPlate(hash);
        if (!shot.asset) {
          if (process.env.REEL_IMAGE_GENERATION === 'off') throw new Error('Image generation is disabled.');
          const referencePath = reference ? path.join('media', reference) : undefined;
          if (imageProvider === 'gemini' && !apiKey) throw new Error('Gemini artwork requires GEMINI_API_KEY.');
          const bytes = imageProvider === 'cloudflare' ? await generateCloudflareImage(prompt, referencePath)
            : await generateGeminiImage(apiKey!, model, prompt, referencePath);
          shot.asset = await savePlate(hash, bytes);
        }
        if (!reference) continuity.set(shot.continuity, shot.asset);
        if (videoModel) {
          if (!apiKey) throw new Error('Motion clips require GEMINI_API_KEY.');
          shot.clip = await prepareStoryClip({
            library, assetFolder, image: shot.asset, model: videoModel, apiKey,
            action: shot.action, camera: shot.camera, seconds: shot.duration / timeline.fps,
          });
        }
      } catch (error) {
        throw new VisualAssetError(shot.id, error instanceof Error ? error.message : 'Image generation failed.');
      }
    }
    return { fingerprint, shots, status: 'ready' };
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
    if (shot.kind !== 'image') continue;
    if (!shot.asset) throw new VisualAssetError(shot.id, 'Required artwork is missing.');
    sources.add(shot.asset);
    if (shot.clip) sources.add(shot.clip.asset);
  }
  for (const source of sources) {
    const [folder, filename, extra] = source.split('/');
    if (folder !== assetFolder || !(assetName.test(filename ?? '') || /^[a-f0-9]{64}\.mp4$/.test(filename ?? '')) || extra !== undefined) {
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
