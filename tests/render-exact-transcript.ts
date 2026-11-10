import path from 'node:path';
import fs from 'node:fs';
import { synthesizeStoryboardNarration } from '../src/modules/tts/tts-service.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';
import { renderStudioShort } from '../src/modules/render/video-renderer.js';
import { performMediaQA } from '../src/modules/qa/media-qa.js';
import { Storyboard } from '../src/modules/contracts/storyboard.js';
import { pool } from '../src/core.js';

async function runExactTranscriptProduction() {
  console.log('=====================================================');
  console.log('🎬 RENDERING EXACT USER TRANSCRIPT TECH SHORT');
  console.log('=====================================================\n');

  const runId = 'exact-transcript-run';
  const runDir = path.resolve('media/runs', runId);
  if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });

  const exactStoryboard: Storyboard = {
    topic: 'setTimeout(0) is a Lie! Event Loop & Microtasks Explained',
    title: '🔥 JavaScript Interview: Why setTimeout(0) is a Lie!',
    hook: 'Interviewer ne poocha: kya setTimeout(0) immediately execute hota hai?',
    learningObjective: 'Event loop priority: Call Stack vs Microtask Queue vs Macrotask Queue',
    targetAudience: 'Software Engineers & Web Developers',
    format: 'short',
    estimatedDurationSec: 85,
    hashtags: ['#javascript', '#webdev', '#nodejs', '#systemdesign', '#coding'],
    scenes: [
      {
        id: 'scene-1',
        sceneIndex: 0,
        type: 'hook',
        narration:
          'Interviewer ne aapse poocha, JavaScript mein agar main setTimeout ke andar zero milliseconds pass kar du, toh kya callback immediately execute ho jayega? Ab aap kahoge, zero delay hai toh obviously immediately execute hona chahiye. Lekin nahi! Main aapko ek example se samjhata hoon.',
        onScreenText: 'JS INTERVIEW QUESTION',
        technicalKeyPoint: 'setTimeout(0) does NOT execute immediately',
        durationTargetSec: 15,
        visualProps: {
          headline: 'setTimeout(0) Immediately Execute Hoga?',
          questionKicker: 'Zero delay does NOT mean zero waiting!',
          badgeText: 'JS INTERVIEW MASTERCLASS',
          accentColor: '#00F2FE',
          misconceptionAlert: 'Myth: 0ms delay executes right now',
        },
      },
      {
        id: 'scene-2',
        sceneIndex: 1,
        type: 'code',
        narration:
          'Maan lo ye code hai: console.log A, setTimeout B zero delay ke saath, aur console.log C. Ab agar main aapse output poochu, toh aap shayad bologe A, B, C. Lekin actual output aayega A, C, B. Ab sawaal hai, jab delay zero hai toh B last mein kyun print hua?',
        onScreenText: 'Code Execution Puzzle',
        technicalKeyPoint: 'Output is A, C, B not A, B, C',
        durationTargetSec: 17,
        visualProps: {
          filename: 'puzzle.js',
          language: 'javascript',
          code: 'console.log("A");\n\nsetTimeout(() => {\n  console.log("B");\n}, 0);\n\nconsole.log("C");',
          highlightLines: [3, 4, 5],
          explanationCallout: 'Why does B print LAST when delay is 0ms?',
          terminalOutputs: [
            { text: 'A (Synchronous)', badge: 'Call Stack', delayFrames: 20 },
            { text: 'C (Synchronous)', badge: 'Call Stack', delayFrames: 60 },
            { text: 'B (setTimeout 0ms)', badge: 'Task Queue', highlight: true, delayFrames: 120 },
          ],
        },
      },
      {
        id: 'scene-3',
        sceneIndex: 2,
        type: 'queueTimeline',
        narration:
          'Dekho, JavaScript ke paas ek Call Stack hota hai, jisme synchronous code execute hota hai. Sabse pehle console.log A execute hua. Phir JavaScript setTimeout pe pahunchi. Ab important baat: setTimeout callback ko immediately Call Stack mein execute nahi karta. Browser ka timer mechanism us callback ko schedule karta hai, aur JavaScript aage ka code execute karne lagti hai. Isliye console.log C execute ho gaya.',
        onScreenText: 'Call Stack vs Web APIs',
        technicalKeyPoint: 'Browser timer schedules the callback outside Call Stack',
        durationTargetSec: 23,
        visualProps: {
          title: 'V8 Engine Call Stack & Web APIs',
          ruleExplanation: 'setTimeout delegates the callback to browser Web APIs, freeing Call Stack!',
          onScreenText: 'V8 RUNTIME ARCHITECTURE',
        },
      },
      {
        id: 'scene-4',
        sceneIndex: 3,
        type: 'queueTimeline',
        narration:
          'Ab zero milliseconds ka matlab hai ki timer ko koi additional delay request nahi kiya gaya. Timer eligible hone par uska callback task queue mein aa sakta hai. Lekin queue mein aane ka matlab execute hona nahi hai! Event Loop us callback ko tabhi execute karwayega jab current JavaScript task complete ho jayega aur Call Stack available hoga. Isliye B, C ke baad print hua.',
        onScreenText: 'Event Loop & Task Queue',
        technicalKeyPoint: 'Queue != Execute. Event Loop checks if stack is clear.',
        durationTargetSec: 23,
        visualProps: {
          title: 'Event Loop Task Queue Draining',
          ruleExplanation: 'Event loop only moves task queue callbacks when Call Stack is 100% EMPTY!',
          onScreenText: 'EVENT LOOP DISPATCH',
        },
      },
      {
        id: 'scene-5',
        sceneIndex: 4,
        type: 'code',
        narration:
          'Ab ek twist dekho. Agar main isi code mein ek Promise add kar doon: console.log A, setTimeout B, Promise.resolve then D, aur console.log C. Ab output hoga A, C, D, B. Kyun? Kyuki current synchronous code complete hone ke baad JavaScript microtasks process karti hai, jisme Promise callbacks aate hain. Aur uske baad event loop timer callback ko execute kar sakta hai.',
        onScreenText: 'The Twist: Microtasks',
        technicalKeyPoint: 'Promise.then (Microtask) drains BEFORE setTimeout (Macrotask)',
        durationTargetSec: 20,
        visualProps: {
          filename: 'microtasks.js',
          language: 'javascript',
          code: 'console.log("A");\nsetTimeout(() => console.log("B"), 0);\nPromise.resolve().then(() => console.log("D"));\nconsole.log("C");',
          highlightLines: [3],
          explanationCallout: 'Output: A -> C -> D -> B (Microtasks drain FIRST)',
          terminalOutputs: [
            { text: 'A (Synchronous)', badge: 'Call Stack', delayFrames: 20 },
            { text: 'C (Synchronous)', badge: 'Call Stack', delayFrames: 60 },
            { text: 'D (Promise.then)', badge: 'Microtask Queue', highlight: true, delayFrames: 100 },
            { text: 'B (setTimeout 0ms)', badge: 'Macrotask Queue', delayFrames: 150 },
          ],
        },
      },
      {
        id: 'scene-6',
        sceneIndex: 5,
        type: 'summary',
        narration:
          "Toh yaad rakhna: setTimeout zero ka matlab immediately execute karna nahi hai. Iska matlab hai callback ko zero requested delay ke saath schedule karna. Actual execution depend karega Event Loop, current task aur pending microtasks par. That's why zero delay doesn't mean zero waiting!",
        onScreenText: 'Interview Takeaway',
        technicalKeyPoint: "Zero delay doesn't mean zero waiting!",
        durationTargetSec: 10,
        visualProps: {
          headline: 'Senior Dev Takeaways',
          takeaways: [
            'setTimeout(0) schedules, does NOT execute immediately',
            'Event loop waits for Call Stack to 100% clear',
            'Microtasks (Promise) ALWAYS drain before Macrotasks',
            '"Zero delay doesn\'t mean zero waiting!"',
          ],
          callToAction: 'Save this reel for your next JavaScript interview!',
        },
      },
    ],
  };

  console.log('Step 1: Synthesizing narration with Edge-TTS (+20% tempo)...');
  const audioResult = await synthesizeStoryboardNarration(exactStoryboard, runDir);
  console.log(
    `✅ Audio synthesized: Total Duration = ${audioResult.totalDurationSec}s across ${audioResult.clips.length} scenes.\n`
  );

  // Copy clips to remotion public dir for HTTP audio serving
  const publicAudioDir = path.resolve('remotion/public/audio/runs', runId);
  if (!fs.existsSync(publicAudioDir)) fs.mkdirSync(publicAudioDir, { recursive: true });
  for (const clip of audioResult.clips) {
    fs.copyFileSync(clip.filePath, path.join(publicAudioDir, path.basename(clip.filePath)));
  }

  console.log('Step 2: Calculating dynamic frame timeline...');
  const timeline = buildVideoTimeline(exactStoryboard, audioResult.clips, {
    fps: 30,
    scenePaddingFrames: 12,
    audioSrcPrefix: `audio/runs/${runId}`,
    bgmSrc: 'music/tech-ambient.wav',
  });

  console.log(
    `✅ Timeline ready: ${timeline.totalDurationInFrames} frames (${timeline.totalDurationSec} seconds @ 30 fps)`
  );
  for (const seg of timeline.segments) {
    console.log(
      `  - Scene ${seg.sceneIndex + 1} [${seg.sceneType}]: ${seg.durationInFrames} frames (${(seg.durationInFrames / 30).toFixed(2)}s)`
    );
  }

  const targetMp4Path = path.resolve(runDir, 'final-transcript-short.mp4');
  console.log(`\nStep 3: Rendering full motion graphic MP4 video to:\n  ${targetMp4Path}...`);

  const renderResult = await renderStudioShort({
    storyboard: exactStoryboard,
    timeline,
    outputFilePath: targetMp4Path,
    onProgress: (p) => {
      if (p.percent % 10 === 0) {
        console.log(`[Renderer Progress] ${p.percent}% (${p.renderedFrames}/${p.totalFrames} frames)`);
      }
    },
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
    throw new Error('Media QA failed!');
  }

  // Step 5: Seed this video into Postgres videos table as READY_FOR_REVIEW
  const dbId = '00000000-0000-0000-0000-000000000003';
  const mediaPublicPath = `/media/runs/${runId}/final-transcript-short.mp4`;

  await pool.query(
    `INSERT INTO videos (id, topic, title, status, narration, audio_seconds, media_path, qa_report, created_at, updated_at)
     VALUES ($1, $2, $3, 'READY_FOR_REVIEW', $4, $5, $6, $7, now(), now())
     ON CONFLICT (id) DO UPDATE SET
       topic = $2,
       title = $3,
       status = 'READY_FOR_REVIEW',
       narration = $4,
       audio_seconds = $5,
       media_path = $6,
       qa_report = $7,
       updated_at = now()`,
    [
      dbId,
      exactStoryboard.topic,
      exactStoryboard.title,
      exactStoryboard.scenes.map((s) => s.narration).join(' '),
      audioResult.totalDurationSec,
      mediaPublicPath,
      JSON.stringify(qaReport),
    ]
  );
  console.log(`\n✅ Registered video in PostgreSQL: ID ${dbId} -> ${mediaPublicPath}`);
  console.log('🎉 EXACT USER TRANSCRIPT SHORT SUCCESSFULLY PRODUCED & READY IN DASHBOARD!');

  await pool.end();
  process.exit(0);
}

runExactTranscriptProduction().catch((err) => {
  console.error('Render failed:', err);
  process.exit(1);
});
