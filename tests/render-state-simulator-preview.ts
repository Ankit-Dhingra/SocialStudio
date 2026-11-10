import path from 'node:path';
import fs from 'node:fs';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';
import { Storyboard } from '../src/modules/contracts/storyboard.js';
import { SynthesizedAudioClip } from '../src/modules/tts/tts-provider.js';

async function runSimulatorPreview() {
  console.log('Rendering State-Machine Simulator Preview Frame...');

  const storyboard: Storyboard = {
    topic: 'How Node.js Event Loop handles Microtasks vs Macrotasks',
    title: 'Node.js Event Loop State Machine Trace',
    hook: 'setTimeout 0 is a lie!',
    learningObjective: 'Understand the deterministic state transitions of the Event Loop',
    targetAudience: 'Software Engineers',
    format: 'short',
    estimatedDurationSec: 54,
    hashtags: ['#javascript', '#nodejs'],
    scenes: [
      { id: 'scene-1', sceneIndex: 0, type: 'hook', narration: 'Intro', onScreenText: 'HOOK', technicalKeyPoint: '', durationTargetSec: 10, visualProps: { headline: 'setTimeout(0) is a Lie!' } },
      { id: 'scene-2', sceneIndex: 1, type: 'code', narration: 'Code trace', onScreenText: 'CODE', technicalKeyPoint: '', durationTargetSec: 14, visualProps: { code: 'console.log("1");\nsetTimeout(() => console.log("2"), 0);\nPromise.resolve().then(() => console.log("3"));\nconsole.log("4");' } },
      { id: 'scene-3', sceneIndex: 2, type: 'queueTimeline', narration: 'V8 State Machine', onScreenText: 'STATE SIMULATOR', technicalKeyPoint: '', durationTargetSec: 18, visualProps: {} },
      { id: 'scene-4', sceneIndex: 3, type: 'summary', narration: 'Summary', onScreenText: 'RECAP', technicalKeyPoint: '', durationTargetSec: 12, visualProps: { headline: 'Summary' } },
    ],
  };

  const dummyClips: SynthesizedAudioClip[] = [
    { sceneId: 'scene-1', sceneIndex: 0, filePath: '', durationMs: 10000, format: 'mp3', fileSizeBytes: 50000 },
    { sceneId: 'scene-2', sceneIndex: 1, filePath: '', durationMs: 14000, format: 'mp3', fileSizeBytes: 70000 },
    { sceneId: 'scene-3', sceneIndex: 2, filePath: '', durationMs: 18000, format: 'mp3', fileSizeBytes: 80000 },
    { sceneId: 'scene-4', sceneIndex: 3, filePath: '', durationMs: 12000, format: 'mp3', fileSizeBytes: 70000 },
  ];

  const timeline = buildVideoTimeline(storyboard, dummyClips, { fps: 30 });

  const entryPoint = path.resolve('remotion/index.ts');
  const bundleLocation = await bundle({
    entryPoint,
    publicDir: path.resolve('remotion/public'),
    webpackOverride: (config) => ({
      ...config,
      resolve: { ...config.resolve, extensionAlias: { '.js': ['.ts', '.tsx', '.js'] } },
    }),
  });

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'StudioShort',
    inputProps: { storyboard, timeline },
  });

  const outputDir = path.resolve('media/runs/simulator-preview');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // Frame 1150 is during Scene 3 (QueueTimeline - EventLoopStateSimulator Step 4)
  const outputPath = path.join(outputDir, 'event-loop-state-machine.png');
  console.log('Rendering Frame 1150 (EventLoopStateSimulator: Step 4 - Microtask Checkpoint)...');

  await renderStill({
    composition,
    serveUrl: bundleLocation,
    output: outputPath,
    frame: 1150,
    inputProps: { storyboard, timeline },
  });

  console.log(`✅ State-Machine frame rendered at: ${outputPath}`);
  process.exit(0);
}

runSimulatorPreview().catch((err) => {
  console.error(err);
  process.exit(1);
});
