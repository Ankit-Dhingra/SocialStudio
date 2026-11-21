import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Storyboard } from '../contracts/storyboard.js';
import type { VideoTimeline } from '../video/timeline.js';
import { planSceneShots, readVisualContext, type PlateRole, type ReelPlates } from '../video/visual-story.js';

export interface ReelVisualAssets {
  fingerprint: string;
  plates: ReelPlates;
  status: 'generated' | 'mixed' | 'library';
  warning?: string;
}

const assetFolder = 'generated-reel-visuals';
const assetName = /^[a-f0-9]{64}\.(png|jpg)$/;
const library = path.resolve('media', assetFolder);
const active = new Map<string, Promise<ReelVisualAssets>>();

const directions: Record<PlateRole, string> = {
  street: 'Establish the actual place and weather described in the narration. If the subject is a rider, show the rider and delivery vehicle at mid-height.',
  pickup: 'Show the narrated pickup in progress at the described location, with the rider and pickup goods in the same frame.',
  payment: 'Show the narrated payment scene, with the phone and human action toward the left. Leave room on the right for a separately rendered demo QR.',
  opening: 'Visualize the real-world situation or analogy in the narration as a single establishing shot. For a purely abstract mechanism, depict one simple physical metaphor without attempting a technical diagram.',
};

export function planPlatePrompts(storyboard: Storyboard, timeline: VideoTimeline): Map<PlateRole, string> {
  const context = readVisualContext(storyboard);
  const prompts = new Map<PlateRole, string>();
  for (const [index, scene] of storyboard.scenes.entries()) {
    const segment = timeline.segments[index];
    if (!segment) continue;
    const shots = planSceneShots(scene, segment, context, timeline.fps);
    const roles = new Set<PlateRole>();
    for (const { kind } of shots) {
      if (kind === 'street' || kind === 'pickup' || kind === 'payment') roles.add(kind);
      if (context.delivery && context.rain && (kind === 'quote' || kind === 'location' || kind === 'recap')) roles.add('street');
    }
    if (index === 0 && shots[0]?.kind === 'scene' && !roles.size) roles.add('opening');
    for (const role of roles) {
      if (prompts.has(role) || prompts.size >= 3) continue;
      const brief = scene.narration.replace(/<[^>]+>/g, ' ').slice(0, 550);
      prompts.set(role, [
        'Create one photorealistic film still for a vertical 9:16 technical explainer.',
        'Use a consistent grade: rich near-black shadows, slate midtones, restrained warm highlights and realistic lighting.',
        'Place the subject in the middle third. Keep upper and lower areas quiet for titles and captions.',
        'Exclude all readable text, logos, payment codes and UI. Those are rendered separately.',
        directions[role],
        `Reel title: ${storyboard.title.slice(0, 160)}`,
        `Narrated moment (reference only): ${brief}`,
      ].join('\n'));
    }
  }
  return prompts;
}

async function cachedPlate(hash: string): Promise<string | undefined> {
  for (const extension of ['png', 'jpg']) {
    const file = `${hash}.${extension}`;
    const existing = await fs.stat(path.join(library, file)).catch(() => undefined);
    if (existing?.isFile() && existing.size > 0) return `${assetFolder}/${file}`;
  }
}

async function generatePlate(apiKey: string, model: string, prompt: string, hash: string): Promise<string> {
  const result = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '9:16', imageSize: '2K' } },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!result.ok) throw new Error(`Gemini image generation returned HTTP ${result.status}.`);
  type ImagePart = { thought?: boolean; inlineData?: { mimeType?: string; data?: string } };
  const response = await result.json() as { candidates?: Array<{ content?: { parts?: ImagePart[] } }> };
  const image = response.candidates?.flatMap(candidate => candidate.content?.parts ?? [])
    .find(part => !part.thought && part.inlineData?.data && /^image\/(png|jpeg)$/.test(part.inlineData.mimeType ?? ''))?.inlineData;
  if (!image?.data) throw new Error('Gemini returned no usable image.');

  const bytes = Buffer.from(image.data, 'base64');
  const extension = image.mimeType === 'image/png' ? 'png' : 'jpg';
  const validHeader = extension === 'png'
    ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    : bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'));
  if (!validHeader || bytes.length > 20 * 1024 * 1024) throw new Error('Gemini returned an invalid image file.');

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
  const prompts = planPlatePrompts(storyboard, timeline);
  const model = process.env.REEL_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-image';
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const enabled = process.env.DEMO_MODE !== 'true' && process.env.REEL_IMAGE_GENERATION !== 'off';
  const fingerprint = createHash('sha256').update(JSON.stringify([model, enabled, Boolean(apiKey), [...prompts]])).digest('hex');
  if (previous?.fingerprint === fingerprint) return previous;
  const pending = active.get(fingerprint);
  if (pending) return pending;
  const work = (async (): Promise<ReelVisualAssets> => {
    const plates: ReelPlates = {};
    let warning: string | undefined;
    for (const [role, prompt] of prompts) {
      if (!enabled) break;
      const hash = createHash('sha256').update(`${model}\n${prompt}`).digest('hex');
      try {
        const cached = await cachedPlate(hash);
        if (cached) plates[role] = cached;
        else if (apiKey) plates[role] = await generatePlate(apiKey, model, prompt, hash);
        else warning = 'Gemini image generation needs GEMINI_API_KEY.';
      } catch (error) {
        warning = error instanceof Error ? error.message : 'Image generation failed.';
        console.warn('[Reel visuals]', warning);
        break;
      }
    }
    const count = Object.keys(plates).length;
    return { fingerprint, plates, status: count ? (count === prompts.size ? 'generated' : 'mixed') : 'library', warning };
  })();
  active.set(fingerprint, work);
  try {
    return await work;
  } finally {
    active.delete(fingerprint);
  }
}

export async function stageReelVisuals(bundlePath: string, plates: ReelPlates = {}): Promise<void> {
  const destination = path.join(bundlePath, 'public', assetFolder);
  for (const source of Object.values(plates)) {
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
