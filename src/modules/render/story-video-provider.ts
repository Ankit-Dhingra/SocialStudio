import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { cameraMoves } from '../video/visual-story.js';

const exec = promisify(execFile);
const endpoint = 'https://generativelanguage.googleapis.com/v1beta/interactions';

export class StoryClipRequestError extends Error {
  constructor(readonly status: number, detail: string) {
    super(`Motion clip provider returned HTTP ${status}.${detail}`);
  }
}

async function videoDuration(file: string): Promise<number> {
  const localProbe = path.resolve(`node_modules/@remotion/compositor-${process.platform}-${process.arch}${process.platform === 'win32' ? '-msvc/ffprobe.exe' : process.platform === 'linux' ? '-gnu/ffprobe' : '/ffprobe'}`);
  const probe = await fs.access(localProbe).then(() => localProbe, () => 'ffprobe');
  const { stdout } = await exec(probe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=duration,width,height', '-of', 'json', file]);
  const stream = JSON.parse(stdout).streams?.[0];
  const duration = Number(stream?.duration);
  if (!(duration >= 1 && duration <= 20 && stream.width > 0 && stream.height > stream.width)) {
    throw new Error('The video provider returned an invalid portrait clip.');
  }
  return duration;
}

type ClipOptions = {
  library: string;
  assetFolder: string;
  image: string;
  model: string;
  apiKey: string;
  action: string;
  camera: typeof cameraMoves[number];
  seconds: number;
  actionAtSec?: number;
};

export async function prepareStoryClip(options: ClipOptions): Promise<{ asset: string; seconds: number }> {
  const duration = Math.max(3, Math.min(15, Math.ceil(options.seconds)));
  const prompt = [
    'Use the supplied image as the opening frame of one continuous portrait shot in the same stylized animated film.',
    'Preserve the cast, costumes, objects, lighting, geography and visual style throughout.',
    `Action: ${options.action}. Camera move: ${options.camera}.`,
    ...(options.actionAtSec === undefined ? [] : [`Begin the main action about ${options.actionAtSec.toFixed(2)} seconds into the shot.`]),
    `Complete the key action within the first ${Math.min(duration, options.seconds).toFixed(1)} seconds.`,
    'Keep the action clearly readable and preserve the framing until the final moment.',
    'No edits, captions, readable screen text, new characters, dialogue, or additional story events.',
  ].join(' ');
  const hash = createHash('sha256').update(JSON.stringify([options.model, options.image, prompt, duration])).digest('hex');
  const name = `${hash}.mp4`;
  const target = path.join(options.library, name);
  const cached = await fs.access(target).then(() => videoDuration(target), () => undefined);
  if (cached) return { asset: `${options.assetFolder}/${name}`, seconds: cached };

  const art = await fs.readFile(path.join(options.library, path.basename(options.image)));
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey },
    signal: AbortSignal.timeout(300_000),
    body: JSON.stringify({
      model: options.model,
      store: false,
      input: [
        { type: 'image', data: art.toString('base64'), mime_type: options.image.endsWith('.png') ? 'image/png' : 'image/jpeg' },
        { type: 'text', text: prompt },
      ],
      generation_config: { video_config: { task: 'image_to_video' } },
      response_format: { type: 'video', aspect_ratio: '9:16', resolution: '720p', duration: `${duration}s`, delivery: 'inline' },
    }),
  });
  if (!response.ok) {
    const error = await response.json().then(body => body.error, () => undefined) as {
      status?: string; details?: Array<{ violations?: Array<{ quotaId?: string; quotaValue?: string }> }>
    } | undefined;
    const limits = error?.details?.flatMap(detail => detail.violations ?? []).map(violation =>
      [violation.quotaId, violation.quotaValue].filter(Boolean).join(' ')).filter(Boolean);
    const detail = limits?.length ? ` Quota: ${limits.join(', ')}.` : error?.status ? ` ${error.status}.` : '';
    throw new StoryClipRequestError(response.status, detail);
  }
  type VideoContent = { type?: string; data?: string };
  const result = await response.json() as {
    output_video?: VideoContent;
    outputs?: VideoContent[];
    steps?: Array<{ type: string; content?: VideoContent[] }>;
  };
  const contents = result.steps?.filter(step => step.type === 'model_output').flatMap(step => step.content ?? []) ?? result.outputs ?? [];
  const data = result.output_video?.data ?? contents.find(content => content.type === 'video')?.data;
  if (!data || data.length > 40_000_000) throw new Error('The motion clip provider returned no usable video.');
  const temporary = path.join(options.library, `${randomUUID()}.mp4`);
  try {
    await fs.writeFile(temporary, Buffer.from(data, 'base64'), { flag: 'wx' });
    const seconds = await videoDuration(temporary);
    await fs.rename(temporary, target);
    return { asset: `${options.assetFolder}/${name}`, seconds };
  } finally {
    await fs.rm(temporary, { force: true });
  }
}
