import path from 'node:path';
import fs from 'node:fs';
import { synthesizeStoryboardNarration } from '../src/modules/tts/tts-service.js';
import { ElevenLabsProvider } from '../src/modules/tts/elevenlabs-provider.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';
import { renderStudioShort } from '../src/modules/render/video-renderer.js';
import { performMediaQA } from '../src/modules/qa/media-qa.js';
import { Storyboard } from '../src/modules/contracts/storyboard.js';
import { pool } from '../src/core.js';

async function produceFlawlessReel() {
  console.log('================================================================');
  console.log('🎯 PRODUCING FLAWLESS NON-AI sys.design.101 REEL WITH ELEVENLABS');
  console.log('================================================================\n');

  const runId = 'flawless-sysdesign-run';
  const runDir = path.resolve('media/runs', runId);
  if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });

  const flawlessStoryboard: Storyboard = {
    topic: '1 iPhone, 2 Log. Order Kisko Milega? (Atomic Update vs Race Condition)',
    title: '📱 1 iPhone, 2 Log: Order Kisko Milega? System Design 101',
    hook: '1 iPhone hai, 2 log sath me order karte hain. Order kisko milega?',
    learningObjective: 'Atomic DB Update: WHERE stock > 0 eliminating race condition',
    targetAudience: 'Software Engineers & Tech Aspirants',
    format: 'short',
    estimatedDurationSec: 62,
    hashtags: ['#systemdesign', '#concurrency', '#coding', '#softwareengineering', '#techshorts'],
    scenes: [
      {
        id: 'scene-1',
        sceneIndex: 0,
        type: 'hook',
        narration:
          'इंटेरव्यूअर ने पूछा: एक iPhone है, दो लोग साथ में आर्डर करते हैं, आर्डर किसको मिलेगा? ये classic race condition है, और इसे atomic update से solve किया जाता है।',
        onScreenText: '1 IPHONE, 2 LOG: ORDER KISKO?',
        technicalKeyPoint: 'Classic concurrency race condition',
        durationTargetSec: 10,
        visualProps: {
          headline: '1 iPhone. 2 Log. Same Second.',
          questionKicker: 'Aman vs Riya: Order kisko milega?',
          badgeText: 'SYSTEM DESIGN 101',
          accentColor: '#FACC15',
          misconceptionAlert: 'Common Mistake: Checking stock in application IF condition',
        },
      },
      {
        id: 'scene-2',
        sceneIndex: 1,
        type: 'raceCondition',
        narration:
          'प्रॉब्लम समझो: अमन और रिया दोनों ने एक साथ चेक किया। दोनों को दिखा 1 बचा है, दोनों का आर्डर बन गया। iPhone 1, orders 2! गलती कहाँ हुई? अमन ने चेक किया stock 1, पर stock कम होने से पहले ही रिया ने भी चेक किया stock अभी भी 1! दोनों को लगा iPhone मेरा है।',
        onScreenText: 'THE FLAW: IPHONE 1, ORDERS 2!',
        technicalKeyPoint: 'Parallel read-modify-write clash',
        durationTargetSec: 16,
        visualProps: {
          type: 'raceCondition',
          title: 'THE FLAW: 15 LPA LOGIC',
          itemTitle: 'iPhone 16 Pro (Stock: 1)',
          user1Name: 'Aman',
          user2Name: 'Riya',
          atomicQuery: 'if (stock > 0) { createOrder(); stock--; }',
        },
      },
      {
        id: 'scene-3',
        sceneIndex: 2,
        type: 'comparison',
        narration:
          'तो fix simple है: चेक और update साथ में करो! इसी को कहते हैं Atomic update! एक ही query में stock कम करो, पर सिर्फ तब जब stock 0 से ज्यादा हो। UPDATE products SET stock = stock - 1 WHERE id = 1 AND stock > 0;',
        onScreenText: 'THE 45 LPA ATOMIC FIX',
        technicalKeyPoint: 'Single Atomic SQL statement',
        durationTargetSec: 14,
        visualProps: {
          type: 'comparison',
          leftTitle: '❌ 15 LPA Approach',
          leftCode: 'if (stock > 0) {\n  createOrder();\n  stock = stock - 1;\n}',
          leftPoints: ['Separate check & update', 'Both read stock = 1', 'Overselling bug!'],
          rightTitle: '✅ 45 LPA Approach',
          rightCode: 'UPDATE products\nSET stock = stock - 1\nWHERE id = 1 AND stock > 0;',
          rightPoints: ['Single Atomic Query', 'Postgres row-level lock', '100% Concurrency Safe'],
          verdict: 'Check and decrement happen in 1 atomic step inside database kernel.',
        },
      },
      {
        id: 'scene-4',
        sceneIndex: 3,
        type: 'raceCondition',
        narration:
          'अमन की क्वेरी पहले पहुँची। Stock 1 था, कंडीशन true, stock 0. Order confirmed! फिर रिया की क्वेरी आई। अब stock zero है, कंडीशन fail. Zero rows updated, Sold out! एक iPhone, सिर्फ एक order!',
        onScreenText: 'EXECUTION: 1 ROW vs 0 ROWS',
        technicalKeyPoint: 'Rows affected feedback in DB',
        durationTargetSec: 14,
        visualProps: {
          type: 'raceCondition',
          title: 'ATOMIC EXECUTION RESOLUTION',
          itemTitle: 'iPhone 16 Pro (Stock: 0)',
          user1Name: 'Aman (1 Row Affected)',
          user2Name: 'Riya (0 Rows Affected)',
          atomicQuery: 'UPDATE products SET stock = stock - 1 WHERE id = 1 AND stock > 0;',
        },
      },
      {
        id: 'scene-5',
        sceneIndex: 4,
        type: 'summary',
        narration:
          'इंटरव्यू में बोलो: Stock check और update एक atomic query में, और 10 लाख requests के लिए आगे Redis queue लगाओ! Interviewer impress! Save this reel for your next interview.',
        onScreenText: 'INTERVIEW GOLDEN RULE',
        technicalKeyPoint: 'Atomic query + Redis queue for scale',
        durationTargetSec: 10,
        visualProps: {
          headline: 'Senior Interview Punchline',
          takeaways: [
            'Check + Update in 1 Atomic Query with WHERE stock > 0',
            'Database row lock guarantees exactly 1 order',
            'For 10 Lakh req/sec: Add Redis queue in front',
          ],
          callToAction: 'Save this reel for your next System Design round!',
        },
      },
    ],
  };

  // 1. Synthesize Audio with ElevenLabs (Adam voice with high expressiveness)
  console.log('[1/4] Synthesizing Voiceover with ElevenLabs (Adam)...');
  const elevenProvider = new ElevenLabsProvider(
    process.env.ELEVENLABS_API_KEY || 'sk_4434981ed4a7f20d9dc7b0809b2c38e5cf9de6c2517b120e',
    'pNInz6obpgDQGcFmaJgB', // Adam
    'eleven_multilingual_v2'
  );

  const audioResult = await synthesizeStoryboardNarration(flawlessStoryboard, runDir, elevenProvider);
  console.log(`✅ ElevenLabs Voiceover Complete: ${audioResult.totalDurationSec}s across ${audioResult.clips.length} scenes.`);

  // Copy clips into Remotion public folder
  const publicAudioDir = path.resolve('remotion/public/audio/runs', runId);
  fs.mkdirSync(publicAudioDir, { recursive: true });
  for (const clip of audioResult.clips) {
    fs.copyFileSync(clip.filePath, path.join(publicAudioDir, path.basename(clip.filePath)));
  }

  // 2. Build Timeline
  console.log('\n[2/4] Building Video Timeline...');
  const timeline = buildVideoTimeline(flawlessStoryboard, audioResult.clips, {
    fps: 30,
    scenePaddingFrames: 14,
    audioSrcPrefix: `audio/runs/${runId}`,
  });
  console.log(`✅ Timeline: ${timeline.totalDurationInFrames} frames (${timeline.totalDurationSec}s @ 30fps).`);

  // 3. Render Studio Short Video
  const outputVideoPath = path.join(runDir, 'flawless-sysdesign-reel.mp4');
  console.log(`\n[3/4] Rendering 1080x1920 Video to ${outputVideoPath}...`);
  const renderResult = await renderStudioShort({
    storyboard: flawlessStoryboard,
    timeline,
    outputFilePath: outputVideoPath,
  });
  console.log(`✅ Render Complete in ${(renderResult.renderTimeMs / 1000).toFixed(1)}s (${(renderResult.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB).`);

  // 4. Media QA
  console.log('\n[4/4] Performing Media QA...');
  const qaReport = performMediaQA(renderResult, timeline);
  console.log(`QA Result: Passed=${qaReport.passed}, Drift=${qaReport.driftSec}s`);

  // 5. Register in Postgres Database
  const dbId = '00000000-0000-0000-0000-000000000005';
  const mediaPublicPath = `/media/runs/${runId}/flawless-sysdesign-reel.mp4`;
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
      flawlessStoryboard.topic,
      flawlessStoryboard.title,
      flawlessStoryboard.scenes.map((s) => s.narration).join(' '),
      audioResult.totalDurationSec,
      mediaPublicPath,
      JSON.stringify(qaReport),
    ]
  );

  console.log(`\n🎉 FLAWLESS PRODUCTION COMPLETE! Registered as ID: ${dbId}`);
  console.log(`Preview ready at: http://127.0.0.1:5173/?videoId=${dbId}`);
  await pool.end();
  process.exit(0);
}

produceFlawlessReel().catch((err) => {
  console.error('Production failed:', err);
  process.exit(1);
});
