import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
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

  console.log(`[Renderer] Selecting composition 'StudioShort'...`);
  const composition = await selectComposition({
    browserExecutable: process.env.CHROME_EXECUTABLE || undefined,
    serveUrl: bundleLocation,
    id: 'StudioShort',
    timeoutInMilliseconds: 300000,
    chromiumOptions: {
      enableMultiProcessOnLinux: false,
      gl: 'swiftshader',
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
    browserExecutable: process.env.CHROME_EXECUTABLE || undefined,
    serveUrl: bundleLocation,
    codec: 'h264',
    crf: 26,
    pixelFormat: 'yuv420p',
    outputLocation: outputFilePath,
    concurrency: 1,
    enforceAudioTrack: true,
    timeoutInMilliseconds: 300000,
    chromiumOptions: {
      enableMultiProcessOnLinux: false,
      gl: 'swiftshader',
    },
    inputProps: {
      storyboard,
      timeline,
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

  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries',
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
