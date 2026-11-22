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

function stageRunAudio(location: string, timeline: VideoTimeline) {
  // A development bundle snapshots public/. Later jobs introduce new run-specific assets.
  for (const {audioSrc} of timeline.segments) {
    if (!/^audio\/runs\/[\w./-]+$/.test(audioSrc) || audioSrc.split('/').includes('..')) continue;
    const target = path.join(location, 'public', audioSrc);
    fs.mkdirSync(path.dirname(target), {recursive:true});
    fs.copyFileSync(path.resolve('remotion/public', audioSrc), target);
  }
}

export async function getOrCreateBundle(timeline: VideoTimeline): Promise<string> {
  const prebuilt = path.resolve('dist-remotion');
  const signature = compositionSignature();
  const stamp = path.join(prebuilt, 'composition.sha256');
  if (fs.existsSync(path.join(prebuilt, 'index.html')) && fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === signature) {
    stageRunAudio(prebuilt, timeline);
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
  stageRunAudio(location, timeline);
  return location;
}

export async function renderStudioShort(options: RenderShortOptions): Promise<RenderResult> {
  const { storyboard, timeline, outputFilePath, visualPlan, onProgress } = options;

  const outputDir = path.dirname(outputFilePath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const startTime = Date.now();
  const bundleLocation = await getOrCreateBundle(timeline);
  await stageReelVisuals(bundleLocation, visualPlan);
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

  const totalFrames = composition.durationInFrames;
  console.log(
    `[Renderer] Starting render: ${totalFrames} frames (${(totalFrames / 30).toFixed(2)}s) @ 1080x1920...`
  );

  let lastPercentLogged = 0;

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    x264Preset: 'veryfast',
    crf: 20,
    pixelFormat: 'yuv420p',
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

  const renderTimeMs = Date.now() - startTime;

  if (!fs.existsSync(outputFilePath)) {
    throw new Error(`Render failed: Output file was not created at ${outputFilePath}`);
  }

  const ffprobeBin = findFfprobe();
  const probe = JSON.parse(execFileSync(ffprobeBin, ['-v', 'error', '-show_entries',
    'format=duration:stream=codec_type,width,height,duration', '-of', 'json', outputFilePath], {encoding: 'utf8'}));
  const video = probe.streams.find((stream: {codec_type: string}) => stream.codec_type === 'video');
  if (video?.width !== 1080 || video?.height !== 1920 || !probe.streams.some((s: {codec_type: string}) => s.codec_type === 'audio')) {
    throw new Error('Export must contain a 1080x1920 video stream and an audio stream.');
  }
  const stats = fs.statSync(outputFilePath);
  const fileBuffer = fs.readFileSync(outputFilePath);
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  return {
    outputFilePath,
    fileSizeBytes: stats.size,
    durationSec: Number(video.duration || probe.format.duration),
    totalFrames,
    sha256: hash,
    renderTimeMs,
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
}
type PreviewTarget = Omit<StillPreviewResult, 'url' | 'filePath'> & { filename: string };

export async function renderStillPreviews(
  storyboard: Storyboard,
  timeline: VideoTimeline,
  outputDir: string,
  urlPrefix = '/previews',
  visualPlan?: VisualPlan,
): Promise<StillPreviewResult[]> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const targets = storyboard.scenes.flatMap<PreviewTarget>((scene, idx) => {
    const seg = timeline.segments[idx];
    if (!seg) return [];
    const metadata = { sceneIndex: idx, sceneId: scene.id, type: scene.type };
    return visualPlan ? visualPlan[idx].map(shot => ({
      ...metadata, label: shot.headline, shotId: shot.id, evidence: shot.evidence, filename: `shot-${shot.id}.jpg`,
      frame: seg.startFrame + shot.from + Math.min(shot.duration - 1, Math.max(
        Math.floor(shot.duration * 0.6), Math.max(shot.takeawayFrame, ...shot.reveals, ...shot.movements, ...(shot.focus?.beats.map(beat => beat.from) ?? [])) + Math.round(timeline.fps * 0.23),
      )),
    })) : [{
      ...metadata,
      filename: `scene-${idx}-${scene.type}.jpg`, frame: seg.startFrame + Math.min(120, Math.floor(seg.durationInFrames * 0.4)),
    }];
  });

  const bundleLocation = await getOrCreateBundle(timeline);
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
    for (const { filename, ...target } of targets) {
      const targetPath = path.join(outputDir, filename);

      await renderStill({
        composition,
        serveUrl: bundleLocation,
        frame: target.frame,
        output: targetPath,
        imageFormat: 'jpeg',
        jpegQuality: 93,
        timeoutInMilliseconds: 120000,
        puppeteerInstance,
        inputProps,
      });

      results.push({
        ...target,
        url: `${urlPrefix}/${filename}?t=${Date.now()}`,
        filePath: targetPath,
      });
    }
    return results;
  } finally {
    await puppeteerInstance.close({ silent: true });
  }
}
