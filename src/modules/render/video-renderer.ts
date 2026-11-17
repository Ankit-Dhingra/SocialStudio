import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { Storyboard } from '../contracts/storyboard.js';
import { VideoTimeline } from '../video/timeline.js';

export interface RenderShortOptions {
  storyboard: Storyboard;
  timeline: VideoTimeline;
  outputFilePath: string;
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

  // Concurrency: Use env if provided, or scale intelligently (min 2, max 8, default ~50% of cores)
  const envConcurrency = process.env.REMOTION_CONCURRENCY ? Number(process.env.REMOTION_CONCURRENCY) : undefined;
  const concurrency = envConcurrency && !Number.isNaN(envConcurrency) && envConcurrency > 0
    ? envConcurrency
    : Math.max(2, Math.min(8, Math.floor(numCpus * 0.5)));

  // FFmpeg threads for video stitcher
  const ffmpegThreads = Math.max(2, Math.min(8, Math.floor(numCpus * 0.5)));

  // OpenGL backend: 'angle' hardware acceleration on Windows, 'swangle' for headless Linux
  const gl = (process.env.REMOTION_GL as any) || (os.platform() === 'win32' ? 'angle' : 'swangle');

  const browserExecutable = getChromeExecutable();

  return { concurrency, ffmpegThreads, gl, browserExecutable };
}

async function getOrCreateBundle(): Promise<string> {
  const prebuilt = path.resolve('dist-remotion');
  if (fs.existsSync(path.join(prebuilt, 'index.html'))) {
    return prebuilt;
  }

  if (cachedBundlePromise) {
    return cachedBundlePromise;
  }

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
  })();

  return cachedBundlePromise;
}

export async function renderStudioShort(options: RenderShortOptions): Promise<RenderResult> {
  const { storyboard, timeline, outputFilePath, onProgress } = options;

  const outputDir = path.dirname(outputFilePath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const startTime = Date.now();
  const bundleLocation = await getOrCreateBundle();
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
    inputProps: {
      storyboard,
      timeline,
    },
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
    disallowParallelEncoding: false,
    enforceAudioTrack: true,
    timeoutInMilliseconds: 1200000,
    browserExecutable,
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
      gl,
      disableWebSecurity: true,
    },
    inputProps: {
      storyboard,
      timeline,
    },
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
}

export async function renderStillPreviews(
  storyboard: Storyboard,
  timeline: VideoTimeline,
  outputDir: string,
  urlPrefix = '/previews'
): Promise<StillPreviewResult[]> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const bundleLocation = await getOrCreateBundle();
  const { gl, browserExecutable } = getRenderingConfig();

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'StudioShort',
    timeoutInMilliseconds: 120000,
    browserExecutable,
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
      gl,
      disableWebSecurity: true,
    },
    inputProps: {
      storyboard,
      timeline,
    },
  });

  const results: StillPreviewResult[] = [];
  // Render in controlled batches of 2 to avoid overwhelming headless Chrome memory & socket pools
  const concurrency = 2;

  for (let i = 0; i < storyboard.scenes.length; i += concurrency) {
    const batch = storyboard.scenes.slice(i, i + concurrency);
    const batchPromises = batch.map(async (scene, bIdx) => {
      const idx = i + bIdx;
      const seg = timeline.segments[idx];
      if (!seg) return null;

      // Capture representative frame at peak action (40% into the scene duration)
      const frame = seg.startFrame + Math.min(120, Math.floor(seg.durationInFrames * 0.4));
      const filename = `scene-${idx}-${scene.type}.jpg`;
      const targetPath = path.join(outputDir, filename);

      await renderStill({
        composition,
        serveUrl: bundleLocation,
        frame,
        output: targetPath,
        imageFormat: 'jpeg',
        jpegQuality: 85,
        timeoutInMilliseconds: 120000,
        browserExecutable,
        inputProps: { storyboard, timeline },
        chromiumOptions: {
          gl,
          disableWebSecurity: true,
        },
      });

      return {
        sceneIndex: idx,
        sceneId: scene.id,
        type: scene.type,
        frame,
        url: `${urlPrefix}/${filename}?t=${Date.now()}`,
        filePath: targetPath,
      };
    });

    const batchResults = await Promise.all(batchPromises);
    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }

  return results;
}
