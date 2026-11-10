import path from 'node:path';
import fs from 'node:fs';
import { synthesizeStoryboardNarration } from '../src/modules/tts/tts-service.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';
import { renderStudioShort } from '../src/modules/render/video-renderer.js';
import { performMediaQA } from '../src/modules/qa/media-qa.js';
import { Storyboard } from '../src/modules/contracts/storyboard.js';
import { pool } from '../src/core.js';

async function runSysDesignReel() {
  console.log('=====================================================');
  console.log('📱 RENDERING SYS.DESIGN.101 RACE CONDITION REEL');
  console.log('=====================================================\n');

  const sysDesignStoryboard: Storyboard = {
    topic: '1 iPhone. 2 Users. Same Second. Concurrency & Race Conditions',
    title: '📱 1 iPhone, 2 Users: 15 LPA vs 45 LPA System Design',
    hook: '1 iPhone bacha hai. 2 log ek sath order click karte hain. Order kisko milega?',
    learningObjective: 'Atomic Database Updates vs Application-level Race Conditions',
    targetAudience: 'Backend Engineers & System Design Aspirants',
    format: 'short',
    estimatedDurationSec: 45,
    hashtags: ['#systemdesign', '#coding', '#softwareengineering', '#database', '#techshorts'],
    scenes: [
      {
        id: 'scene-1',
        sceneIndex: 0,
        type: 'hook',
        narration: 'Interviewer ne poocha: 1 iPhone bacha hai. Aman aur Riya dono ne ek hi second me checkout click kiya. Order kisko milega?',
        onScreenText: 'INTERVIEWER NE POOCHA',
        technicalKeyPoint: 'High concurrency race conditions',
        durationTargetSec: 8,
        visualProps: {
          headline: '1 iPhone. 2 Users. 1 Second.',
          questionKicker: 'Aman vs Riya: Who gets the order?',
          badgeText: 'SYSTEM DESIGN INTERVIEW',
          accentColor: '#FACC15',
          misconceptionAlert: 'Common Mistake: Checking stock in application code',
        },
      },
      {
        id: 'scene-2',
        sceneIndex: 1,
        type: 'raceCondition',
        narration: 'Dekho screen par. Aman ne 18:00:00.412 par click kiya, aur Riya ne sirf 3 millisecond baad! Dono ki request database ki taraf race karti hai.',
        onScreenText: 'LIVE CONCURRENCY RACE',
        technicalKeyPoint: 'Database row contention',
        durationTargetSec: 12,
        visualProps: {
          type: 'raceCondition',
          title: 'SYSTEM DESIGN • CONCURRENCY',
          itemTitle: 'iPhone 16 Pro (Stock: 1)',
          user1Name: 'Aman',
          user2Name: 'Riya',
          atomicQuery: 'UPDATE products SET stock = stock - 1 WHERE id = 1 AND stock > 0;',
        },
      },
      {
        id: 'scene-3',
        sceneIndex: 2,
        type: 'comparison',
        narration: '15 LPA engineer do alag queries likhega: pehle stock check, fir order. Isme race condition se do order ban jayenge! 45 LPA engineer single atomic UPDATE query use karega with WHERE stock > 0.',
        onScreenText: '15 LPA vs 45 LPA ARCHITECTURE',
        technicalKeyPoint: 'Atomic row-level locking',
        durationTargetSec: 14,
        visualProps: {
          type: 'comparison',
          leftTitle: '❌ 15 LPA Approach',
          leftCode: 'if (stock > 0) {\n  createOrder();\n  stock = stock - 1;\n}',
          leftPoints: ['Two separate roundtrips', 'Both pass IF condition', 'Double selling bug!'],
          rightTitle: '✅ 45 LPA Approach',
          rightCode: 'UPDATE products\nSET stock = stock - 1\nWHERE id = 1 AND stock > 0;',
          rightPoints: ['Single Atomic Statement', 'Postgres row-level lock', '100% Concurrency Safe'],
          verdict: 'Postgres row lock ensures only 1 transaction affects 1 row; the second gets 0 rows affected.',
        },
      },
      {
        id: 'scene-4',
        sceneIndex: 3,
        type: 'summary',
        narration: 'Toh yaad rakhna: High-concurrency systems me application logic par bharosa mat karo, hamesha database level atomic updates use karo! Save this reel for your next interview.',
        onScreenText: 'SENIOR TAKEAWAY',
        technicalKeyPoint: 'Kernel-level row locking over application checks',
        durationTargetSec: 8,
        visualProps: {
          headline: 'System Design Golden Rule',
          takeaways: [
            'Never check stock and decrement in separate queries',
            'Use atomic UPDATE ... WHERE stock > 0',
            'Check affected rows count to confirm success',
          ],
          callToAction: 'Save this reel & follow for senior dev breakdowns!',
        },
      },
    ],
  };

  const runDir = path.resolve('media/runs/sysdesign101-run');
  if (!fs.existsSync(runDir)) {
    fs.mkdirSync(runDir, { recursive: true });
  }

  // 1. Synthesize Narration
  console.log('\n[1/4] Synthesizing Voiceover Audio...');
  const audioResult = await synthesizeStoryboardNarration(sysDesignStoryboard, runDir);
  console.log(`✅ Voiceover complete: ${audioResult.totalDurationSec}s across ${audioResult.clips.length} scenes.`);

  // Copy clips into Remotion public directory
  const publicAudioDir = path.resolve('remotion/public/audio/runs/sysdesign101-run');
  fs.mkdirSync(publicAudioDir, { recursive: true });
  for (const clip of audioResult.clips) {
    fs.copyFileSync(clip.filePath, path.join(publicAudioDir, path.basename(clip.filePath)));
  }

  // 2. Build Timeline
  console.log('\n[2/4] Building Frame-Accurate Video Timeline...');
  const timeline = buildVideoTimeline(sysDesignStoryboard, audioResult.clips, {
    fps: 30,
    scenePaddingFrames: 14,
    audioSrcPrefix: 'audio/runs/sysdesign101-run',
  });
  console.log(`✅ Timeline: ${timeline.totalDurationInFrames} frames @ ${timeline.fps}fps (${timeline.totalDurationSec}s)`);

  // 3. Render Studio Short Video
  const outputVideoPath = path.join(runDir, 'sysdesign101-reel.mp4');
  console.log(`\n[3/4] Rendering 1080x1920 9:16 Video to ${outputVideoPath}...`);
  const renderResult = await renderStudioShort({
    storyboard: sysDesignStoryboard,
    timeline,
    outputFilePath: outputVideoPath,
  });
  console.log(`✅ Video rendered: ${renderResult.durationSec}s, ${renderResult.totalFrames} frames.`);

  // 4. Perform Media QA
  console.log('\n[4/4] Performing Media QA Verification...');
  const qaReport = await performMediaQA({
    videoPath: outputVideoPath,
    expectedDurationSec: audioResult.totalDurationSec,
    toleranceSec: 0.5,
  });
  console.log(`QA Report: Passed=${qaReport.passed}, Drift=${qaReport.driftSec}s`);

  // 5. Register in Database for Dashboard
  const videoId = '00000000-0000-0000-0000-000000000004';
  await pool.query(
    `INSERT INTO videos (id, topic, status, storyboard, video_path, qa_report, created_at, updated_at)
     VALUES ($1, $2, 'READY_FOR_REVIEW', $3, $4, $5, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       topic = EXCLUDED.topic,
       status = 'READY_FOR_REVIEW',
       storyboard = EXCLUDED.storyboard,
       video_path = EXCLUDED.video_path,
       qa_report = EXCLUDED.qa_report,
       updated_at = NOW();`,
    [videoId, sysDesignStoryboard.topic, JSON.stringify(sysDesignStoryboard), outputVideoPath, JSON.stringify(qaReport)]
  );

  console.log(`\n🎉 SUCCESS! Video registered in Dashboard with ID ${videoId}`);
  console.log(`Preview ready at: http://127.0.0.1:5173/?videoId=${videoId}`);
}

runSysDesignReel().catch((err) => {
  console.error('Fatal error during render:', err);
  process.exit(1);
});
