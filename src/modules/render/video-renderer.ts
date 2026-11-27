import {compositionSignature} from './bundle-signature.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { Storyboard } from '../contracts/storyboard.js';
import { VideoTimeline } from '../video/timeline.js';
import type { VisualPlan } from '../video/visual-story.js';
import { stageReelVisuals } from './reel-visual-assets.js';

export interface RenderShortOptions {
  storyboard: Storyboard;
  timeline: VideoTimeline;
  outputFilePath: string;
  visualPlan?: VisualPlan;
  previewRange?: [startFrame: number, endFrame: number];
  previewScale?: number;
  narrationRoot?: string;
  onProgress?: (progress: { percent: number; renderedFrames: number; totalFrames: number }) => void;
}

export interface RenderResult {
  outputFilePath: string;
  fileSizeBytes: number;
  durationSec: number;
  totalFrames: number;
  sha256: string;
  renderTimeMs: number;
}

let cachedSignature = '';
let cachedBundlePromise: Promise<string> | null = null;

function getChromeExecutable(): string | undefined {
  const envPath = process.env.CHROME_EXECUTABLE;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }
  return undefined;
}

function findFfprobe(): string {
  const candidates = [
    path.resolve('node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe'),
    path.resolve('node_modules/@remotion/compositor-linux-x64-gnu/ffprobe'),
    path.resolve('node_modules/@remotion/compositor-darwin-x64/ffprobe'),
    path.resolve('node_modules/@remotion/compositor-darwin-arm64/ffprobe'),
    'ffprobe',
  ];
  for (const c of candidates) {
    if (c === 'ffprobe' || fs.existsSync(c)) {
      return c;
    }
  }
  return 'ffprobe';
}

function getRenderingConfig() {
  const numCpus = os.cpus()?.length || 4;

  // Concurrency: Use env if provided. On Windows, cap at 2-3 to avoid GPU/DirectX memory crashes under ANGLE.
  const envConcurrency = process.env.REMOTION_CONCURRENCY ? Number(process.env.REMOTION_CONCURRENCY) : undefined;
  const defaultConcurrency = os.platform() === 'win32' ? 2 : Math.max(2, Math.min(6, Math.floor(numCpus * 0.5)));
  const concurrency = envConcurrency && !Number.isNaN(envConcurrency) && envConcurrency > 0
    ? envConcurrency
    : defaultConcurrency;

  // FFmpeg threads for video stitcher
  const ffmpegThreads = Math.max(2, Math.min(8, Math.floor(numCpus * 0.5)));

  // OpenGL backend: 'angle' hardware acceleration on Windows, 'swangle' for headless Linux
  const gl = (process.env.REMOTION_GL as any) || (os.platform() === 'win32' ? 'angle' : 'swangle');

  const browserExecutable = getChromeExecutable();

  return { concurrency, ffmpegThreads, gl, browserExecutable };
}

function stageRunAudio(location: string, timeline: VideoTimeline, narrationRoot = path.resolve('remotion/public')) {
  // A development bundle snapshots public/. Later jobs introduce new run-specific assets.
  for (const {audioSrc} of timeline.segments) {
    if (!/^audio\/runs\/[\w./-]+$/.test(audioSrc) || audioSrc.split('/').includes('..')) continue;
    const target = path.join(location, 'public', audioSrc);
    fs.mkdirSync(path.dirname(target), {recursive:true});
    fs.copyFileSync(path.resolve(narrationRoot, audioSrc), target);
  }
}

export async function getOrCreateBundle(timeline: VideoTimeline, narrationRoot?: string): Promise<string> {
  const prebuilt = path.resolve('dist-remotion');
  const signature = compositionSignature();
  const stamp = path.join(prebuilt, 'composition.sha256');
  if (fs.existsSync(path.join(prebuilt, 'index.html')) && fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === signature) {
    stageRunAudio(prebuilt, timeline, narrationRoot);
    return prebuilt;
  }

  if (!cachedBundlePromise || cachedSignature !== signature) {
    cachedSignature = signature;
    cachedBundlePromise = (async () => {
      console.log('[Renderer] Bundling Remotion project (in-memory cached)...');
      const entryPoint = path.resolve('remotion/index.ts');
      return bundle({
        entryPoint,
        publicDir: path.resolve('remotion/public'),
        webpackOverride: (config) => ({
          ...config,
          resolve: {
            ...config.resolve,
            extensionAlias: {
              '.js': ['.ts', '.tsx', '.js'],
            },
          },
        }),
      });
    })().catch(error => { cachedBundlePromise = null; throw error; });
  }
  const location = await cachedBundlePromise;
  stageRunAudio(location, timeline, narrationRoot);
  return location;
}

export async function removeHostedBundleNarration(run: string) {
  if (!/^hosted-studio-[a-zA-Z0-9]+$/.test(run)) return;
  const cached = await cachedBundlePromise?.catch(() => undefined);
  for (const location of [path.resolve('dist-remotion'), cached]) {
    if (location) await fs.promises.rm(path.join(location, 'public', 'audio', 'runs', run), { recursive: true, force: true });
  }
}

export async function renderStudioShort(options: RenderShortOptions): Promise<RenderResult> {
  const { storyboard, timeline, outputFilePath, visualPlan, onProgress, previewRange } = options;
  validateRenderPlan(storyboard, timeline, visualPlan);
  const incomplete = visualPlan?.flatMap((shots, index) => shots.some(shot => shot.requiresDirection) ? [index + 1] : []);
  if (!previewRange && incomplete?.length) {
    throw new Error(`Scenes ${incomplete.join(', ')} need a usable visual plan. Revise them in the visual preview before exporting.`);
  }

  const outputDir = path.dirname(outputFilePath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const startTime = Date.now();
  const bundleLocation = await getOrCreateBundle(timeline, options.narrationRoot);
  const stagedPlan = previewRange ? visualPlan?.map((group, index) =>
    group.filter(shot => timeline.segments[index].startFrame + shot.from <= previewRange[1])
  ) : visualPlan;
  await stageReelVisuals(bundleLocation, stagedPlan);
  const inputProps = { storyboard, timeline, visualPlan };
  const { concurrency, ffmpegThreads, gl, browserExecutable } = getRenderingConfig();

  console.log(`[Renderer] Optimizing render pipeline: concurrency=${concurrency}, ffmpegThreads=${ffmpegThreads}, gl=${gl}, browser=${browserExecutable || 'remotion-default'}`);

  console.log(`[Renderer] Selecting composition 'StudioShort'...`);
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'StudioShort',
    timeoutInMilliseconds: 300000,
    browserExecutable,
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
      gl,
      disableWebSecurity: true,
    },
    inputProps,
  });

  const totalFrames = previewRange ? previewRange[1] - previewRange[0] + 1 : composition.durationInFrames;
  const scale = previewRange ? options.previewScale ?? 0.5 : 1;
  console.log(
    `[Renderer] Starting ${previewRange ? 'preview' : 'export'}: ${totalFrames} frames (${(totalFrames / timeline.fps).toFixed(2)}s) ...`
  );

  let lastPercentLogged = 0;

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    x264Preset: 'veryfast',
    crf: scale < 1 ? 26 : 20,
    frameRange: previewRange,
    scale,
    pixelFormat: 'yuv420p',
    licenseKey: process.env.REMOTION_PRIVATE_LICENSE_KEY?.trim() || undefined,
    isProduction: previewRange || process.env.REMOTION_PRODUCTION_RENDER === 'false' ? false : undefined,
    outputLocation: outputFilePath,
    concurrency,
    disallowParallelEncoding: true,
    enforceAudioTrack: true,
    timeoutInMilliseconds: 1200000,
    browserExecutable,
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
      gl,
      disableWebSecurity: true,
    },
    inputProps,
    ffmpegOverride: ({ type, args }) => {
      if (type === 'stitcher') {
        const outputIndex = args.length - 1;
        const cloned = [...args];
        cloned.splice(
          outputIndex,
          0,
          '-threads',
          String(ffmpegThreads),
          '-x264-params',
          `threads=${ffmpegThreads}:lookahead_threads=2:rc_lookahead=20`
        );
        return ['-threads', String(ffmpegThreads), ...cloned];
      }
      return ['-threads', String(ffmpegThreads), ...args];
    },
    onProgress: ({ renderedFrames }) => {
      const percent = Math.floor((renderedFrames / totalFrames) * 100);
      if (percent >= lastPercentLogged + 10) {
        lastPercentLogged = percent;
        console.log(`[Renderer Progress] ${percent}% (${renderedFrames}/${totalFrames} frames)`);
      }
      onProgress?.({ percent, renderedFrames, totalFrames });
    },
  });

  const output = inspectReelOutput(outputFilePath, scale);
  if ((output.totalFrames && output.totalFrames !== totalFrames)
    || !Number.isFinite(output.durationSec) || Math.abs(output.durationSec - totalFrames / timeline.fps) > 2 / timeline.fps) {
    throw new Error('Rendered video duration does not match the compiled timeline.');
  }
  return { ...output, totalFrames, renderTimeMs: Date.now() - startTime };
}

function validateRenderPlan(storyboard: Storyboard, timeline: VideoTimeline, visualPlan?: VisualPlan) {
  if (!visualPlan) return;
  if (visualPlan.length !== storyboard.scenes.length || timeline.segments.length !== visualPlan.length) {
    throw new Error('The visual plan does not cover the finalized storyboard and audio.');
  }
  const ids = new Set<string>();
  for (const [index, shots] of visualPlan.entries()) {
    const segment = timeline.segments[index];
    let frame = 0;
    if (segment.sceneId !== storyboard.scenes[index].id) throw new Error(`Scene ${index + 1} has mismatched narration.`);
    for (const shot of shots) {
      if (ids.has(shot.id) || shot.from !== frame || !Number.isInteger(shot.duration) || shot.duration <= 0) {
        throw new Error(`Scene ${index + 1} has invalid shot coverage.`);
      }
      ids.add(shot.id);
      frame += shot.duration;
    }
    if (frame !== segment.durationInFrames) throw new Error(`Scene ${index + 1} does not fill its audio segment.`);
  }
}

function inspectReelOutput(outputFilePath: string, scale = 1): RenderResult {
  if (!fs.existsSync(outputFilePath)) {
    throw new Error(`Render failed: Output file was not created at ${outputFilePath}`);
  }

  const ffprobeBin = findFfprobe();
  const probe = JSON.parse(execFileSync(ffprobeBin, ['-v', 'error', '-show_entries',
    'format=duration:stream=codec_type,codec_name,width,height,duration,nb_frames', '-of', 'json', outputFilePath], {encoding: 'utf8'}));
  const video = probe.streams.find((stream: {codec_type: string}) => stream.codec_type === 'video');
  const audio = probe.streams.find((stream: {codec_type: string}) => stream.codec_type === 'audio');
  if (video?.width !== 1080 * scale || video?.height !== 1920 * scale || video.codec_name !== 'h264' || audio?.codec_name !== 'aac') {
    throw new Error(`Render must contain ${1080 * scale}x${1920 * scale} H.264 video and AAC audio.`);
  }
  const stats = fs.statSync(outputFilePath);
  const fileBuffer = fs.readFileSync(outputFilePath);
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  return {
    outputFilePath,
    fileSizeBytes: stats.size,
    durationSec: Number(video.duration || probe.format.duration),
    totalFrames: Number(video.nb_frames) || 0,
    sha256: hash,
    renderTimeMs: 0,
  };
}

export interface StillPreviewResult {
  sceneIndex: number;
  sceneId: string;
  type: string;
  frame: number;
  url: string;
  filePath: string;
  label?: string;
  shotId?: string;
  evidence?: string;
  motionFrames?: Array<{ frame: number; label: string; url: string; filePath?: string }>;
}
type PreviewTarget = Omit<StillPreviewResult, 'url' | 'filePath' | 'motionFrames'> & {
  filename: string;
  motion?: Array<{ frame: number; label: string }>;
};

export async function renderStillPreviews(
  storyboard: Storyboard,
  timeline: VideoTimeline,
  outputDir: string,
  urlPrefix = '/previews',
  visualPlan?: VisualPlan,
  sceneIndices?: ReadonlySet<number>,
  narrationRoot?: string,
): Promise<StillPreviewResult[]> {
  validateRenderPlan(storyboard, timeline, visualPlan);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const targets = storyboard.scenes.flatMap<PreviewTarget>((scene, idx) => {
    if (sceneIndices && !sceneIndices.has(idx)) return [];
    const seg = timeline.segments[idx];
    if (!seg) return [];
    const metadata = { sceneIndex: idx, sceneId: scene.id, type: scene.type };
    return visualPlan ? visualPlan[idx].map(shot => {
      const start = seg.startFrame + shot.from;
      const event = shot.messaging?.statusAt ?? (shot.kind === 'film' ? shot.actionFrame ?? Math.min(shot.duration - 1, Math.round(timeline.fps * 0.65))
        : shot.scanFrame ?? shot.openFrame ?? shot.actionFrame ?? (shot.eventFrames?.length ? Math.max(...shot.eventFrames) : undefined));
      const finalFrame = start + shot.duration - 1;
      const nextScreen = shot.scanFrame !== undefined ? shot.reveals.find(at => at > shot.scanFrame!) : undefined;
      const layerEnd = shot.layers?.subjects.length
        ? Math.max(...shot.layers.subjects.map(subject => subject.from + subject.duration - 1)) : undefined;
      const operation = shot.operation;
      const operationEnd = operation?.kind === 'group' ? Math.max(...operation.measures.map(measure => measure.from))
        : operation?.kind === 'expiry' ? operation.replaces : operation?.kind === 'selection' ? operation.ends
          : operation?.steps.at(-1)?.from;
      const vectorEnds = shot.vector && [...shot.vector.tracks.map(track => track.start + track.frames),
        ...(shot.vector.connectors ?? []).map(route => route.start + route.frames), ...shot.vector.layers.map(layer => layer.start),
        ...(shot.vector.states ?? []).map(state => state.frame)]
        .map(frame => frame - (shot.vector!.sequenceOffset ?? 0)).filter(frame => frame > 0 && frame < shot.duration);
      const vectorEnd = vectorEnds?.length ? Math.max(...vectorEnds) : undefined;
      const result = vectorEnd ?? operationEnd ?? layerEnd ?? shot.messaging?.messagesAt ?? shot.messaging?.receivedAt ?? nextScreen
        ?? (shot.openFrame === undefined ? event : Math.max(shot.openFrame, ...shot.reveals));
      const motion = event !== undefined ? [
        { label: 'Before', frame: Math.max(start, start + event - Math.round(timeline.fps * 0.15)) },
        { label: 'Action', frame: Math.min(finalFrame, start + event + Math.round(timeline.fps * 0.30), start + (nextScreen ?? shot.duration) - 1) },
        { label: 'After', frame: Math.min(finalFrame, start + (result ?? event) + Math.round(timeline.fps * 0.93)) },
      ] : process.env.REEL_VISUAL_REVIEW_MODEL?.trim() ? [
        { label: 'Beginning', frame: start },
        { label: 'Middle', frame: start + Math.floor((shot.duration - 1) / 2) },
        { label: 'End', frame: finalFrame },
      ] : undefined;
      return {
        ...metadata, label: shot.headline, shotId: shot.id, evidence: shot.evidence, filename: `shot-${shot.id}.jpg`, motion,
        frame: (event === undefined ? undefined : motion?.at(-1)?.frame) ?? start + Math.min(shot.duration - 1, Math.max(
          Math.floor(shot.duration * 0.6), Math.max(shot.takeawayFrame, ...shot.reveals, ...shot.movements, shot.scanFrame ?? 0, ...(shot.focus?.beats.map(beat => beat.from) ?? [])) + Math.round(timeline.fps * 0.23),
        )),
      };
    }) : [{
      ...metadata,
      filename: `scene-${idx}-${scene.type}.jpg`, frame: seg.startFrame + Math.min(120, Math.floor(seg.durationInFrames * 0.4)),
    }];
  });

  const bundleLocation = await getOrCreateBundle(timeline, narrationRoot);
  await stageReelVisuals(bundleLocation, visualPlan);
  const { gl, browserExecutable } = getRenderingConfig();
  const chromiumOptions = { gl, enableMultiProcessOnLinux: true, disableWebSecurity: true };
  const puppeteerInstance = await openBrowser('chrome', { browserExecutable, chromiumOptions });
  const inputProps = { storyboard, timeline, visualPlan };
  try {
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'StudioShort',
      timeoutInMilliseconds: 120000,
      puppeteerInstance,
      inputProps,
    });
    const results: StillPreviewResult[] = [];
    const renderFrame = async (frame: number, filename: string) => {
      await renderStill({
        composition,
        serveUrl: bundleLocation,
        frame,
        output: path.join(outputDir, filename),
        imageFormat: 'jpeg',
        jpegQuality: 93,
        licenseKey: process.env.REMOTION_PRIVATE_LICENSE_KEY?.trim() || undefined,
        isProduction: false,
        timeoutInMilliseconds: 120000,
        puppeteerInstance,
        inputProps,
      });
      return `${urlPrefix}/${filename}?t=${Date.now()}`;
    };
    for (const { filename, motion, ...target } of targets) {
      const url = await renderFrame(target.frame, filename);
      const motionFrames: StillPreviewResult['motionFrames'] = [];
      const rendered = new Map([[target.frame, { url, filePath: path.join(outputDir, filename) }]]);
      for (const beat of motion ?? []) {
        const beatName = `shot-${target.shotId}-${beat.label.toLowerCase()}.jpg`;
        const image = rendered.get(beat.frame) ?? { url: await renderFrame(beat.frame, beatName), filePath: path.join(outputDir, beatName) };
        rendered.set(beat.frame, image);
        motionFrames.push({ ...beat, ...image });
      }
      results.push({
        ...target,
        url,
        filePath: path.join(outputDir, filename),
        motionFrames: motionFrames.length ? motionFrames : undefined,
      });
    }
    return results;
  } finally {
    await puppeteerInstance.close({ silent: true });
  }
}
