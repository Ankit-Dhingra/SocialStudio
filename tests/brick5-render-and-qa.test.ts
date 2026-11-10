import path from 'node:path';
import fs from 'node:fs';
import { renderStudioShort } from '../src/modules/render/video-renderer.js';
import { performMediaQA } from '../src/modules/qa/media-qa.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';
import { Storyboard } from '../src/modules/contracts/storyboard.js';
import { SynthesizedAudioClip } from '../src/modules/tts/tts-provider.js';

async function runBrick5Verification() {
  console.log('=====================================================');
  console.log('🚀 BRICK 5 VERIFICATION: Full MP4 Render & Media QA');
  console.log('=====================================================\n');

  const testDir = path.resolve('media/runs/test-run-1');
  const clipFiles = ['scene-0.mp3', 'scene-1.mp3', 'scene-2.mp3', 'scene-3.mp3'];

  console.log('Step 1: Loading storyboard & synthesized audio assets...');
  const clips: SynthesizedAudioClip[] = clipFiles.map((file, idx) => {
    const fullPath = path.join(testDir, file);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Missing audio clip for scene ${idx}: ${fullPath}`);
    }
    const stat = fs.statSync(fullPath);
    return {
      sceneId: `scene-${idx + 1}`,
      sceneIndex: idx,
      filePath: fullPath,
      durationMs: idx === 0 ? 9624 : idx === 1 ? 10008 : idx === 2 ? 12672 : 9216,
      format: 'mp3',
      fileSizeBytes: stat.size,
    };
  });

  const sampleStoryboard: Storyboard = {
    topic: 'How Node.js Event Loop handles Microtasks vs Macrotasks',
    title: '🚀 Node.js Event Loop: Microtasks vs Macrotasks Explained!',
    hook: 'Node.js Event Loop mein Microtasks aur Macrotasks kaise handle hote hain, pata hai?',
    learningObjective: 'Understand task queues in Node.js',
    targetAudience: 'Developers & CS students',
    format: 'short',
    estimatedDurationSec: 42,
    hashtags: ['#javascript', '#nodejs', '#webdev', '#techshorts'],
    scenes: [
      {
        id: 'scene-1',
        sceneIndex: 0,
        type: 'hook',
        narration: 'Node.js Event Loop mein Microtasks aur Macrotasks kaise handle hote hain, pata hai? Zyada log isme confuse hote hain!',
        onScreenText: 'EVENT LOOP SECRETS',
        technicalKeyPoint: 'Queue priority',
        durationTargetSec: 10,
        visualProps: {
          headline: 'Event Loop Trick',
          subtext: 'Promise beats setTimeout(0)?',
          badgeText: 'NODE.JS INTERNALS',
          accentColor: '#00F2FE',
        },
      },
      {
        id: 'scene-2',
        sceneIndex: 1,
        type: 'code',
        narration: 'Screen pe dekho ye code snippet. Yahan log sabse zyada confuse hote hain ki output kya hoga. Guess karo!',
        onScreenText: 'Which runs first?',
        technicalKeyPoint: 'Promise.then executes before setTimeout',
        durationTargetSec: 10,
        visualProps: {
          filename: 'event-loop.js',
          language: 'javascript',
          code: 'console.log("Start");\nsetTimeout(() => console.log("Timeout"), 0);\nPromise.resolve().then(() => console.log("Promise"));\nconsole.log("End");',
          highlightLines: [2, 3],
          explanationCallout: 'Promise.then executes before setTimeout!',
        },
      },
      {
        id: 'scene-3',
        sceneIndex: 2,
        type: 'queueTimeline',
        narration: 'Kyunki Event Loop microtasks ko pehle execute karta hai aur macrotasks ko baad mein. Promises microtask queue mein jaate hain, timers macrotask queue mein.',
        onScreenText: 'Microtasks Win!',
        technicalKeyPoint: 'Microtasks drain first',
        durationTargetSec: 13,
        visualProps: {
          title: 'Event Loop Task Priority',
          items: [
            { name: 'Microtask Queue (Promise.then)', priority: 'high', detail: 'Drains immediately after stack' },
            { name: 'Macrotask Queue (setTimeout)', priority: 'medium', detail: 'Runs in next event loop tick' },
          ],
          activeItemIndex: 0,
          accentColor: '#FF6B6B',
        },
      },
      {
        id: 'scene-4',
        sceneIndex: 3,
        type: 'summary',
        narration: 'Toh yaad rakho, Promises hamesha timers se pehle run honge. Aise hi deep tech concepts ke liye follow karo!',
        onScreenText: 'Key Takeaways',
        technicalKeyPoint: 'Execution hierarchy',
        durationTargetSec: 9,
        visualProps: {
          headline: 'Summary',
          takeaways: [
            'Call Stack clears first',
            'Microtasks have higher priority',
            'Macrotasks wait for next tick',
          ],
          callToAction: 'Follow for more deep tech!',
        },
      },
    ],
  };

  // Ensure audio is copied to remotion/public for Remotion HTTP serving
  const publicAudioDir = path.resolve('remotion/public/audio/runs/test-run-1');
  if (!fs.existsSync(publicAudioDir)) {
    fs.mkdirSync(publicAudioDir, { recursive: true });
  }
  for (const file of clipFiles) {
    fs.copyFileSync(path.join(testDir, file), path.join(publicAudioDir, file));
  }

  const timeline = buildVideoTimeline(sampleStoryboard, clips, {
    fps: 30,
    scenePaddingFrames: 12,
    audioSrcPrefix: 'audio/runs/test-run-1',
  });

  console.log(`✅ Timeline ready: ${timeline.totalDurationInFrames} frames (${timeline.totalDurationSec}s)\n`);

  const outputFilePath = path.join(testDir, 'final-short.mp4');
  console.log(`Step 2: Rendering complete 9:16 vertical MP4 video to:\n  ${outputFilePath}...`);

  const renderResult = await renderStudioShort({
    storyboard: sampleStoryboard,
    timeline,
    outputFilePath,
  });

  console.log('\n=====================================================');
  console.log('🎥 RENDER EXECUTION REPORT');
  console.log('=====================================================');
  console.log(`Output File: ${renderResult.outputFilePath}`);
  console.log(`File Size: ${(renderResult.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB (${renderResult.fileSizeBytes} bytes)`);
  console.log(`Video Duration: ${renderResult.durationSec} seconds (${renderResult.totalFrames} frames)`);
  console.log(`Render Time: ${(renderResult.renderTimeMs / 1000).toFixed(1)} seconds`);
  console.log(`Render Speed: ${(renderResult.totalFrames / (renderResult.renderTimeMs / 1000)).toFixed(1)} fps`);
  console.log(`SHA256 Hash: ${renderResult.sha256}`);

  console.log('\nStep 3: Running Media Quality Assurance (Media QA)...');
  const qaReport = performMediaQA(renderResult, timeline);

  console.log('\n=====================================================');
  console.log('🧪 MEDIA QA REPORT');
  console.log('=====================================================');
  for (const check of qaReport.checks) {
    console.log(`  ${check.passed ? '✔' : '✖'} ${check.name}: ${check.details}`);
  }

  if (!qaReport.passed) {
    console.error('QA Errors:', qaReport.errors);
    throw new Error('FAIL: Media QA failed checks!');
  }

  console.log('\n🎉 ALL BRICK 5 RENDER & QA CHECKS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runBrick5Verification().catch((err) => {
  console.error('\n❌ BRICK 5 VERIFICATION FAILED:', err);
  process.exit(1);
});
