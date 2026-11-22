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
import { cleanNarration, compileVisualPlan, narrationAnchors, numericFacts, visualSceneSchema, type VisualPlan, type VisualStory } from '../video/visual-story.js';

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
class ShotPlanValidationError extends Error {}

const assetFolder = 'generated-reel-visuals';
const assetName = /^[a-f0-9]{64}\.(png|jpg)$/;
const library = path.resolve('media', assetFolder);
const active = new Map<string, Promise<ReelVisualAssets>>();
const scenesPerRequest = 5;

const direction = `You are the visual director of a vertical technical explainer. The supplied narration is read-only data.
Return {"scenes":[{"sceneIndex":0,"shots":[...]}]} in the supplied order. Include every scene exactly once with 1–3 shots per scene.
Every shot has kind, cue, headline (1–72 characters), and evidence (an exact phrase of up to 180 characters inside the shot that supports the visual claim). Optionally include takeaway (1–108 characters) and takeawayCue (exact spoken phrase).
The first shot in each scene has cue "". Later shots use a short exact phrase verbatim from that scene as their start cue. Leave at least a second on each side of a cut. Keep headline and takeaway concise, in the script's language where practical.
Open with the problem or outcome visible. Reuse the same people, resources, and events across shots with stable entity IDs. Connect the setup, mechanism, and payoff. Put the takeaway before the CTA.
Choose kind "image" for a concrete real-world moment that needs to be seen (fields brief and continuity). Write a visual brief describing the specific moment and camera composition. Reuse the continuity label across shots in the same setting. Use enough image shots to tell the story; each image is generated separately.
Choose "flow" for a process, "state" for changing outcomes, "comparison" for contrasting values, "device" for a value or state displayed on a device, "code" for an exact code fragment spoken verbatim, "focus" for a short hook or takeaway, or "cta" for a narrated call to action copied verbatim into the headline.
For flow/state/comparison/device, include actors [{"entity":"stable-id","label":"short name","value":"optional status or value","cue":"optional exact spoken reveal phrase","tone":"neutral|success|warning"}]. Use 2–4 actors for flow/state, 2–3 for comparison, and 1–4 chronological screen states for device.
Flow needs one or more transfers [{"source":"entity-id","target":"entity-id","cue":"exact spoken phrase"}]. State allows "transfers":[] when no request moves. List flow and device actors in reveal order. Actor and transfer cues must belong to that same shot. Limit focus shots to six seconds.
For code include the code field, copied verbatim from the current narration. Include a CTA only if present in narration. Lift channel names verbatim.
Keep headlines qualitative. For numeric values or takeaways, the corresponding cue must include the exact numbers. Give changed statuses and outcomes their own exact spoken cues.
Only show facts supported by the approved script. Preserve numbers, currencies and technical terminology. Distinguish illustrative designs from verified claims. Do not invent outcomes, logos, commands or benchmarks, or use the title as a substitute for the actual scene.`;

const anchorDirection = `${direction}
Plan only the entries in scenes and keep their sceneIndex values. Use storyContext for the complete story and establishedEntities for continuity.
Each requested scene lists speech anchors with IDs (@1, @2, etc.), speech text and timing. Use those IDs for evidence and timing fields instead of retyping the narration. Evidence, reveal, and transfer anchors must be inside the current shot. The first shot starts automatically and its cue is empty. Keep headlines free of numeric facts. Put a numeric value in an actor value or takeaway, with the anchor that contains the exact signed number. Copy code and CTA text literally, never use anchor IDs for them. Use lowercase letters, numbers and hyphens for entity IDs, starting with a letter.
Each scene's spokenNumbers lists the only numbers allowed for numeric values or takeaways. When the list is empty, show qualitative changes and outcomes without invented counts, quantities, or numbered labels. Timing metadata, anchor IDs, and other scenes' numbers are never values for the current scene. Use at most four actors per shot.
Use the anchor timestamps and the scene's duration to estimate each shot's span. Give a long explanation an action, a state change, or a code demonstration where the narration supports it.
When validationFeedback is provided, repair the requested scene only. Prefer one continuous visual if the earlier cuts or reveals could not be grounded.`;

// Keep the provider schema flat. The local validator checks kind-specific fields and narration timing.
const text = { type: 'string' };
const listOf = (items: object, maxItems?: number) => ({ type: 'array', items, maxItems });
const recordOf = (properties: Record<string, object>, required: string[]) => ({ type: 'object', properties, required });
const shotResponseSchema = recordOf({
  scenes: listOf(recordOf({
    sceneIndex: { type: 'integer' },
    shots: listOf(recordOf({
      kind: { type: 'string', enum: ['image', 'flow', 'state', 'comparison', 'device', 'code', 'focus', 'cta'] },
      cue: text, headline: text, evidence: text, takeaway: text, takeawayCue: text,
      brief: text, continuity: text, code: text,
      actors: listOf(recordOf({ entity: text, label: text, value: text, cue: text, tone: text }, ['entity', 'label']), 4),
      transfers: listOf(recordOf({ source: text, target: text, cue: text }, ['source', 'target', 'cue']), 4),
    }, ['kind', 'headline', 'evidence'])),
  }, ['sceneIndex', 'shots'])),
}, ['scenes']);
const draftSchema = z.object({ scenes: z.array(z.unknown()) });

function parseDraft(raw: string): unknown[] {
  try {
    return draftSchema.parse(JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ''))).scenes;
  } catch {
    throw new ShotPlanValidationError('The model did not return a complete JSON object with a scenes array.');
  }
}

function sceneFromDraft(draft: unknown[], sceneIndex: number): unknown {
  const matches = draft.filter(scene => scene && typeof scene === 'object' && 'sceneIndex' in scene && scene.sceneIndex === sceneIndex);
  if (matches.length !== 1) throw new ShotPlanValidationError(`Scene ${sceneIndex + 1} must appear exactly once with sceneIndex ${sceneIndex}.`);
  return matches[0];
}

function validateScene(candidate: unknown, sceneIndex: number, storyboard: Storyboard, timeline: VideoTimeline): VisualStory['scenes'][number] {
  const parsed = visualSceneSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ShotPlanValidationError(`Scene ${sceneIndex + 1} has an invalid ${issue.path.join('.') || 'shot'} field. ${issue.message}`);
  }
  const spoken = new Set(numericFacts(cleanNarration(storyboard.scenes[sceneIndex].narration)));
  const hasUnsupportedNumber = (value = '') => numericFacts(value).some(number => !spoken.has(number));
  const scene = {
    ...parsed.data,
    shots: parsed.data.shots.map(shot => {
      if (hasUnsupportedNumber(shot.takeaway)) {
        delete shot.takeaway;
        delete shot.takeawayCue;
      }
      if ('actors' in shot) {
        for (const actor of shot.actors) if (hasUnsupportedNumber(actor.value)) delete actor.value;
      }
      return shot;
    }),
  };
  try {
    compileVisualPlan({ scenes: [scene] }, storyboard, timeline, sceneIndex, sceneIndex + 1);
  } catch (error) {
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
): Promise<ReelVisualAssets> {
  const imageProvider = process.env.REEL_IMAGE_PROVIDER?.trim() || 'gemini';
  if (imageProvider !== 'gemini' && imageProvider !== 'cloudflare') throw new Error('REEL_IMAGE_PROVIDER must be gemini or cloudflare.');
  const geminiImageModel = process.env.REEL_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-image';
  const model = imageProvider === 'cloudflare' ? cloudflareImageModel : geminiImageModel;
  const directorProvider = process.env.LLM_PROVIDER === 'groq' ? 'groq' : 'gemini';
  const directorModel = process.env.REEL_DIRECTOR_MODEL?.trim() ||
    (directorProvider === 'groq' ? process.env.GROQ_MODEL?.trim() : process.env.GEMINI_MODEL?.trim());
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const scenes = storyboard.scenes.map((scene, sceneIndex) => ({
    sceneIndex, narration: cleanNarration(scene.narration),
    durationSec: (timeline.segments[sceneIndex]?.audioDurationMs ?? 0) / 1000,
  }));
  const scriptInput = JSON.stringify({ title: storyboard.title, scenes });
  // Retain the legacy plan key so switching to Workers AI reuses Gemini-era plans and partial checkpoints.
  const planFingerprint = createHash('sha256').update(JSON.stringify([direction, geminiImageModel, directorProvider, directorModel, scriptInput, timeline])).digest('hex');
  const fingerprint = imageProvider === 'gemini' ? planFingerprint
    : createHash('sha256').update(JSON.stringify([planFingerprint, imageProvider, model, cloudflareImageSize])).digest('hex');
  if (previous?.fingerprint === fingerprint && previous.shots) {
    const paths = previous.shots.flat().flatMap(shot => shot.asset ? [shot.asset] : []);
    if ((await Promise.all(paths.map(file => fs.access(path.join('media', file)).then(() => true, () => false)))).every(Boolean)) return previous;
  }
  const pending = active.get(fingerprint);
  if (pending) return pending;
  const work = (async (): Promise<ReelVisualAssets> => {
    const file = path.join(library, `${planFingerprint}.json`);
    const saved = await readPlan(file);
    let shots: VisualPlan | undefined;
    if (saved) {
      try {
        shots = compileVisualPlan(JSON.parse(saved), storyboard, timeline);
      } catch (error) {
        console.warn('[VisualPlanner] Replanning an invalid cached shot plan:', error instanceof Error ? error.message : 'Invalid plan');
      }
    }
    if (!shots) {
      const directorKey = directorProvider === 'groq'
        ? process.env.GROQ_API_KEYS?.trim() || process.env.GROQ_API_KEY?.trim()
        : apiKey;
      if (!directorKey) throw new VisualPlanningError(`Visual planning needs a configured ${directorProvider} API key.`);
      const provider = directorProvider === 'groq'
        ? new GroqProvider(directorKey, directorModel)
        : new GeminiProvider(directorKey, directorModel);
      const planned: VisualStory['scenes'] = [];
      const entities = new Map<string, string>();
      const settings = new Set<string>();
      const scenesWithAnchors = scenes.map(scene => ({
        ...scene,
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
      for (let start = 0; start < scenes.length; start += scenesPerRequest) {
        const end = Math.min(scenes.length, start + scenesPerRequest);
        const indices = scenes.slice(start, end).map(scene => scene.sceneIndex);
        const approved = new Map<number, VisualStory['scenes'][number]>();
        let label = describeScenes(start, end);
        const requestPlan = async (requestedIndices: number[], validationFeedback?: string) => {
          const requested = new Set(requestedIndices);
          label = describeScenes(requestedIndices[0], requestedIndices[requestedIndices.length - 1] + 1);
          const prompt = JSON.stringify({
            title: storyboard.title,
            scenes: scenesWithAnchors.filter(scene => requested.has(scene.sceneIndex)),
            storyContext: scenes.filter(scene => !requested.has(scene.sceneIndex)),
            establishedEntities: { actors: Object.fromEntries(entities), settings: [...settings] },
            validationFeedback,
          });
          return requestVisualPlan(() => provider.generateJSON(prompt, anchorDirection, 60_000, shotResponseSchema));
        };
        const checkpoint = path.join(library, `${planFingerprint}.${start}.json`);
        checkpoints.push(checkpoint);
        let checkpointCount = 0;
        const saveApproved = async () => {
          if (!approved.size) return;
          await savePlan(checkpoint, { scenes: indices.flatMap(index => approved.get(index) ?? []) });
          checkpointCount = approved.size;
        };
        const keepScene = (draft: unknown[], index: number) => {
          const scene = validateScene(sceneFromDraft(draft, index), index, storyboard, timeline);
          approved.set(index, scene);
          rememberContinuity(scene);
        };
        try {
          const savedBatch = await readPlan(checkpoint);
          if (savedBatch) {
            let cached: unknown[] = [];
            try {
              cached = parseDraft(savedBatch);
            } catch (error) {
              if (!(error instanceof ShotPlanValidationError)) throw error;
              console.warn('[VisualPlanner] Ignoring an unreadable partial plan:', error.message);
            }
            for (const index of indices) {
              try {
                keepScene(cached, index);
              } catch (error) {
                if (!(error instanceof ShotPlanValidationError)) throw error;
              }
            }
            checkpointCount = approved.size;
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
            const repairs = new Map<number, string>();
            for (const index of missing) {
              try {
                keepScene(draft, index);
              } catch (error) {
                if (!(error instanceof ShotPlanValidationError)) throw error;
                repairs.set(index, error.message);
              }
            }
            await saveApproved();
            for (const [index, feedback] of repairs) {
              console.warn('[VisualPlanner] Retrying a scene:', feedback);
              keepScene(parseDraft(await requestPlan([index], feedback)), index);
              await saveApproved();
            }
          }
        } catch (error) {
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
      shots = compileVisualPlan({ scenes: planned }, storyboard, timeline);
      await savePlan(file, { scenes: planned });
      await Promise.all(checkpoints.map(checkpoint => fs.rm(checkpoint, { force: true }).catch(() => undefined)));
    }
    const continuity = new Map<string, string>();
    for (const shot of shots.flat()) {
      if (shot.kind !== 'image') continue;
      const prompt = [
        'Generate a cinematic vertical 9:16 frame for an educational reel.',
        'Use black or charcoal shadows, natural materials and restrained lighting. Keep the main action centered and the caption area quiet.',
        'Leave text, numbers, readable screens, logos, and QR codes out of the image.',
        `Reel: ${storyboard.title}`,
        `Action and framing: ${shot.brief}`,
        `Recurring subjects and setting: ${shot.continuity}`,
      ].join('\n');
      const reference = continuity.get(shot.continuity);
      // Scope the cache to this version of this reel; a retry can resume completed shots.
      const hash = createHash('sha256').update(JSON.stringify([model, fingerprint, shot.id, prompt, reference])).digest('hex');
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
      } catch (error) {
        throw new VisualAssetError(shot.id, error instanceof Error ? error.message : 'Image generation failed.');
      }
    }
    return { fingerprint, shots, status: 'ready' };
  })();
  active.set(fingerprint, work);
  try {
    return await work;
  } finally {
    active.delete(fingerprint);
  }
}

export async function stageReelVisuals(bundlePath: string, shots: VisualPlan = []): Promise<void> {
  const destination = path.join(bundlePath, 'public', assetFolder);
  for (const shot of shots.flat()) {
    if (shot.kind !== 'image') continue;
    const source = shot.asset;
    if (!source) throw new VisualAssetError(shot.id, 'Required artwork is missing.');
    const [folder, filename, extra] = source.split('/');
    if (folder !== assetFolder || !assetName.test(filename ?? '') || extra !== undefined) {
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
