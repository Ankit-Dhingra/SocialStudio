import path from 'node:path';
import fs from 'node:fs';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';
import { Storyboard } from '../src/modules/contracts/storyboard.js';
import { SynthesizedAudioClip } from '../src/modules/tts/tts-provider.js';

async function runUpgradedPreviews() {
  console.log('Rendering upgraded motion graphic preview frames...');

  const upgradedStoryboard: Storyboard = {
    topic: 'How Node.js Event Loop handles Microtasks vs Macrotasks',
    title: 'Node.js Event Loop: V8 Internals Demystified!',
    hook: 'setTimeout(fn, 0) is a Lie! Why Promise.then always wins.',
    learningObjective: 'Under-the-hood V8 task queue draining rules',
    targetAudience: 'Software Engineers & CS Students',
    format: 'short',
    estimatedDurationSec: 54,
    hashtags: ['#javascript', '#nodejs', '#webdev', '#programming'],
    scenes: [
      {
        id: 'scene-1',
        sceneIndex: 0,
        type: 'hook',
        narration: 'Kyunki JavaScript single threaded hai, sabko lagta hai setTimeout zero turant chalega. Par yahan ek bada twist hai!',
        onScreenText: 'JS INTERNALS TRICK',
        technicalKeyPoint: 'Zero delay does not mean immediate execution',
        durationTargetSec: 10,
        visualProps: {
          headline: 'setTimeout(0) is a Lie!',
          questionKicker: 'Why does Promise.then ALWAYS run first?',
          badgeText: 'V8 INTERNALS DEEP DIVE',
          accentColor: '#00F2FE',
          misconceptionAlert: 'Myth: setTimeout(fn, 0) executes immediately in 0ms',
        },
      },
      {
        id: 'scene-2',
        sceneIndex: 1,
        type: 'code',
        narration: 'Screen pe code dekho. console.log 1 aur 4 Call Stack me directly execute hote hain. Par Promise aur setTimeout me kaun jeetega?',
        onScreenText: 'Live Code Execution Trace',
        technicalKeyPoint: 'Stack vs Task Queues',
        durationTargetSec: 14,
        visualProps: {
          filename: 'event-loop.js',
          language: 'javascript',
          code: 'console.log("1");\nsetTimeout(() => console.log("2"), 0);\nPromise.resolve().then(() => console.log("3"));\nconsole.log("4");',
          highlightLines: [2, 3],
          explanationCallout: 'Microtasks (Promise) drain before any Macrotask (setTimeout)!',
          terminalOutputs: [
            { text: '1 (Synchronous)', badge: 'Call Stack', delayFrames: 10 },
            { text: '4 (Synchronous)', badge: 'Call Stack', delayFrames: 30 },
            { text: '3 (Promise.then)', badge: 'Microtask Queue', highlight: true, delayFrames: 50 },
            { text: '2 (setTimeout)', badge: 'Macrotask Queue', delayFrames: 80 },
          ],
        },
      },
      {
        id: 'scene-3',
        sceneIndex: 2,
        type: 'queueTimeline',
        narration: 'Yahan V8 engine ka golden rule kaam karta hai: Event Loop har ek operation ke baad poori Microtask Queue ko ZERO tak drain karta hai!',
        onScreenText: 'Under The Hood: V8 Engine',
        technicalKeyPoint: 'Microtask starvation rule',
        durationTargetSec: 16,
        visualProps: {
          title: 'V8 Engine Event Loop Internals',
          ruleExplanation: 'V8 drains the ENTIRE Microtask Queue to 0 before executing the next Macrotask!',
          onScreenText: 'V8 RUNTIME ARCHITECTURE',
        },
      },
      {
        id: 'scene-4',
        sceneIndex: 3,
        type: 'summary',
        narration: 'Toh production me agar aapne recursive microtask chains banayi toh server freeze ho jayega. Follow for more deep tech!',
        onScreenText: 'Production Takeaways',
        technicalKeyPoint: 'Avoid microtask recursion',
        durationTargetSec: 14,
        visualProps: {
          headline: 'Senior Dev Takeaways',
          takeaways: [
            'Call Stack clears 100% first',
            'Microtasks have absolute execution priority',
            'Avoid recursive process.nextTick (starvation risk)',
          ],
          callToAction: 'Follow for deep-dive CS internals!',
        },
      },
    ],
  };

  const dummyClips: SynthesizedAudioClip[] = [
    { sceneId: 'scene-1', sceneIndex: 0, filePath: '', durationMs: 10000, format: 'mp3', fileSizeBytes: 50000 },
    { sceneId: 'scene-2', sceneIndex: 1, filePath: '', durationMs: 14000, format: 'mp3', fileSizeBytes: 70000 },
    { sceneId: 'scene-3', sceneIndex: 2, filePath: '', durationMs: 16000, format: 'mp3', fileSizeBytes: 80000 },
    { sceneId: 'scene-4', sceneIndex: 3, filePath: '', durationMs: 14000, format: 'mp3', fileSizeBytes: 70000 },
  ];

  const timeline = buildVideoTimeline(upgradedStoryboard, dummyClips, {
    fps: 30,
    scenePaddingFrames: 12,
  });

  const entryPoint = path.resolve('remotion/index.ts');
  const bundleLocation = await bundle({
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

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'StudioShort',
    inputProps: {
      storyboard: upgradedStoryboard,
      timeline,
    },
  });

  const outputDir = path.resolve('media/runs/upgraded-preview');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // Snapshot 1: Scene 2 - Interactive Console Trace (frame 420)
  const codeFramePath = path.join(outputDir, 'interactive-console-frame.png');
  console.log('Rendering Frame 420 (Interactive Console Scene)...');
  await renderStill({
    composition,
    serveUrl: bundleLocation,
    output: codeFramePath,
    frame: 420,
    inputProps: { storyboard: upgradedStoryboard, timeline },
  });
  console.log(`✅ Saved: ${codeFramePath}`);

  // Snapshot 2: Scene 3 - V8 Engine Architecture Diagram (frame 820)
  const archFramePath = path.join(outputDir, 'v8-architecture-frame.png');
  console.log('Rendering Frame 820 (V8 Engine Architecture Scene)...');
  await renderStill({
    composition,
    serveUrl: bundleLocation,
    output: archFramePath,
    frame: 820,
    inputProps: { storyboard: upgradedStoryboard, timeline },
  });
  console.log(`✅ Saved: ${archFramePath}`);

  console.log('Done! Both upgraded motion graphic snapshots rendered.');
  process.exit(0);
}

runUpgradedPreviews().catch((err) => {
  console.error('Failed to render upgraded previews:', err);
  process.exit(1);
});
