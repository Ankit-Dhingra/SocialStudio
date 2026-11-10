import path from 'node:path';
import fs from 'node:fs';
import { synthesizeStoryboardNarration } from '../src/modules/tts/tts-service.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';
import { renderStudioShort } from '../src/modules/render/video-renderer.js';
import { performMediaQA } from '../src/modules/qa/media-qa.js';
import { Storyboard } from '../src/modules/contracts/storyboard.js';

async function runUpgradedFullVideo() {
  console.log('=====================================================');
  console.log('🚀 PRODUCING UPGRADED HIGH-PRODUCTION TECH SHORT');
  console.log('=====================================================\n');

  const upgradedStoryboard: Storyboard = {
    topic: 'How Node.js Event Loop handles Microtasks vs Macrotasks',
    title: '🚀 Node.js Event Loop: V8 Internals Demystified!',
    hook: 'setTimeout(fn, 0) is a Lie! Why Promise.then always wins.',
    learningObjective: 'Under-the-hood V8 task queue draining rules',
    targetAudience: 'Software Engineers & CS Students',
    format: 'short',
    estimatedDurationSec: 54,
    hashtags: ['#javascript', '#nodejs', '#webdev', '#programming', '#techshorts'],
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
        narration: 'Screen pe code dekho. console.log 1 aur 4 Call Stack me directly execute hote hain. Par Promise aur setTimeout me kaun jeetega? Look at the terminal!',
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
            { text: '1 (Synchronous)', badge: 'Call Stack', delayFrames: 15 },
            { text: '4 (Synchronous)', badge: 'Call Stack', delayFrames: 45 },
            { text: '3 (Promise.then)', badge: 'Microtask Queue', highlight: true, delayFrames: 80 },
            { text: '2 (setTimeout)', badge: 'Macrotask Queue', delayFrames: 130 },
          ],
        },
      },
      {
        id: 'scene-3',
        sceneIndex: 2,
        type: 'queueTimeline',
        narration: 'Yahan V8 engine ka golden rule kaam karta hai: Event Loop har ek operation ke baad poori Microtask Queue ko ZERO tak drain karta hai before touching Macrotasks!',
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
        narration: 'Toh production me agar aapne recursive microtask chains banayi toh server freeze ho jayega. Follow for more deep tech breakdowns!',
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

  const runDir = path.resolve('media/runs/test-run-2');
  if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });

  console.log('Step 1: Synthesizing deep technical narration with Edge-TTS...');
  const audioResult = await synthesizeStoryboardNarration(upgradedStoryboard, runDir);
  console.log(`✅ Audio synthesized: Total Duration = ${audioResult.totalDurationSec}s across ${audioResult.clips.length} scenes.\n`);

  // Copy to public folder for Remotion HTTP serving
  const publicAudioDir = path.resolve('remotion/public/audio/runs/test-run-2');
  if (!fs.existsSync(publicAudioDir)) fs.mkdirSync(publicAudioDir, { recursive: true });
  for (const clip of audioResult.clips) {
    const filename = path.basename(clip.filePath);
    fs.copyFileSync(clip.filePath, path.join(publicAudioDir, filename));
  }

  console.log('Step 2: Calculating dynamic frame timeline...');
  const timeline = buildVideoTimeline(upgradedStoryboard, audioResult.clips, {
    fps: 30,
    scenePaddingFrames: 14, // 0.46s breathing room between deep technical concepts
    audioSrcPrefix: 'audio/runs/test-run-2',
  });

  console.log(`✅ Timeline ready: ${timeline.totalDurationInFrames} frames (${timeline.totalDurationSec} seconds @ 30 fps)`);
  for (const seg of timeline.segments) {
    console.log(`  - Scene ${seg.sceneIndex + 1} [${seg.type}]: ${seg.durationInFrames} frames (${(seg.durationInFrames / 30).toFixed(2)}s)`);
  }

  const outputFilePath = path.join(runDir, 'final-upgraded-short.mp4');
  console.log(`\nStep 3: Rendering full motion graphic MP4 video to:\n  ${outputFilePath}...`);

  const renderResult = await renderStudioShort({
    storyboard: upgradedStoryboard,
    timeline,
    outputFilePath,
  });

  console.log('\n=====================================================');
  console.log('🎥 RENDER EXECUTION REPORT');
  console.log('=====================================================');
  console.log(`Output File: ${renderResult.outputFilePath}`);
  console.log(`File Size: ${(renderResult.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Duration: ${renderResult.durationSec}s (${renderResult.totalFrames} frames)`);
  console.log(`Render Time: ${(renderResult.renderTimeMs / 1000).toFixed(1)}s`);
  console.log(`SHA256: ${renderResult.sha256}`);

  console.log('\nStep 4: Executing Media QA...');
  const qaReport = performMediaQA(renderResult, timeline);
  for (const check of qaReport.checks) {
    console.log(`  ${check.passed ? '✔' : '✖'} ${check.name}: ${check.details}`);
  }

  if (!qaReport.passed) {
    throw new Error('FAIL: Upgraded Media QA failed!');
  }

  console.log('\n🎉 UPGRADED HIGH-PRODUCTION SHORT SUCCESSFULLY GENERATED & VERIFIED!');
  process.exit(0);
}

runUpgradedFullVideo().catch((err) => {
  console.error('\n❌ UPGRADED RENDER FAILED:', err);
  process.exit(1);
});
