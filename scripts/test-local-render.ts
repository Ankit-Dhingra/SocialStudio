import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { Storyboard, StoryboardSchema } from '../src/modules/contracts/storyboard.js';
import { synthesizeStoryboardNarration } from '../src/modules/tts/tts-service.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';
import { renderStudioShort } from '../src/modules/render/video-renderer.js';

dotenv.config();

// Ensure output dirs exist
const runId = 'zomato-surge-test';
const runDir = path.resolve('media/runs', runId);
const outputDir = path.resolve('output');

if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const storyboard: Storyboard = StoryboardSchema.parse({
  topic: 'Zomato Surge Pricing Architecture',
  title: 'How Zomato Calculates Surge Pricing Under 50ms',
  hook: 'Interview mein pucha: Zomato surge pricing kaise kaam karta hai? REJECTED!',
  learningObjective: 'Understand spatial indexing (H3) and in-memory caching for real-time dynamic pricing.',
  targetAudience: 'Software Engineers & Backend Developers',
  format: 'short',
  estimatedDurationSec: 50,
  hashtags: ['#systemdesign', '#backend', '#redis', '#zomato', '#coding'],
  scenes: [
    {
      id: 'scene-1',
      sceneIndex: 0,
      type: 'hook',
      narration: 'Interview mein pucha: Zomato surge pricing kaise kaam karta hai? Tumne bola SQL query. REJECTED! Itni jaldi har request pe DB query? Complete database lock!',
      onScreenText: 'ZOMATO SURGE PRICING',
      technicalKeyPoint: 'Real-Time Spatial Pricing',
      durationTargetSec: 7,
      visualProps: {
        type: 'smartphoneMockup',
        headline: 'HOW ZOMATO DECIDES SURGE FEE',
        subtext: 'Why your delivery fee jumps from ₹30 to ₹80 in seconds',
        appName: 'ZOMATO',
        locationText: 'HSR Layout, Sector 4',
        itemName: 'Royal Chicken Dum Biryani',
        itemPrice: '₹380',
        surgeAmount: '+₹50',
        surgeMultiplier: '1.8X',
        showRejectedStamp: true,
        rejectedFrame: 28,
      },
    },
    {
      id: 'scene-2',
      sceneIndex: 1,
      type: 'requestFlow',
      narration: 'Poore city ko chote chote hexagons mein divide kar dete hain jise H3 Hex Bins kehte hain. Har hexagon ka ek unique in-memory ID hota hai!',
      onScreenText: 'H3 SPATIAL INDEXING',
      technicalKeyPoint: 'H3 Hexagonal Spatial Bins',
      durationTargetSec: 10,
      visualProps: {
        type: 'h3SpatialMap',
        title: 'SPATIAL INDEXING: H3 HEX BINS',
        subtitle: 'Converting 2D Earth Coordinates to In-Memory Hexagon IDs',
        hotHexId: '#88619A0A4',
        orderCount: 54,
        riderCount: 4,
        surgeMultiplier: '1.8X',
      },
    },
    {
      id: 'scene-3',
      sceneIndex: 2,
      type: 'queueTimeline',
      narration: 'System Redis se direct ratio fetch karta hai under 4 milliseconds! Aur background stream workers data aggregate karte hain. Database ko touch hi nahi karte!',
      onScreenText: 'READ PATH vs WRITE PATH',
      technicalKeyPoint: 'Redis In-Memory Lookup',
      durationTargetSec: 12,
      visualProps: {
        type: 'architecturePipeline',
        title: 'REAL-TIME READ PATH vs ASYNC WRITE PATH',
        subtitle: 'How Redis in-memory lookup prevents database deadlocks',
        redisLatencyMs: 4,
      },
    },
    {
      id: 'scene-4',
      sceneIndex: 3,
      type: 'summary',
      narration: 'Ab ata hai tradeoff: Micro-hex accuracy ya low memory load? Interview mein kaunsa choose karoge? Comment mein batao aur reel ko save karlo!',
      onScreenText: 'SYSTEM DESIGN TRADEOFF',
      technicalKeyPoint: 'Granularity vs Throughput Tradeoff',
      durationTargetSec: 10,
      visualProps: {
        type: 'tradeoffHUD',
        title: 'THE SYSTEM DESIGN TRADEOFF',
        subtitle: 'Which architecture would you choose in an interview?',
        optionA_Title: 'OPTION A: MICRO-HEX BINS (500m)',
        optionA_Pros: 'Hyper-accurate local pricing & rider incentives',
        optionA_Cons: 'High Redis RAM & 100k key-writes per second',
        optionB_Title: 'OPTION B: MACRO ZONES (5km)',
        optionB_Pros: 'Ultra-lightweight in-memory footprint',
        optionB_Cons: 'Border pricing anomalies & rider churn',
        interviewPoints: [
          'H3 Spatial Indexing converts geometric polygons to O(1) string hashes',
          'Redis In-Memory caching serves dynamic surge pricing in < 8ms',
          'Background worker streaming decouples read path from write path',
          'Tradeoff: Spatial Granularity vs In-Memory write throughput',
        ],
        callToAction: 'Save this reel for your System Design Interview & follow for more!',
      },
    },
  ],
});

async function runLocalRender() {
  console.log('====================================================');
  console.log('🚀 Starting Local Studio Video Render: Zomato Surge');
  console.log('====================================================');

  // Stage 1: Synthesize Voiceover
  console.log('\n[Stage 1/3] Synthesizing Voiceover Audio...');
  const audioResult = await synthesizeStoryboardNarration(storyboard, runDir);
  console.log(`✅ Voiceover complete! Duration: ${audioResult.totalDurationSec}s across ${audioResult.clips.length} scenes.`);

  // Stage 2: Copy audio assets to Remotion public dirs
  const targetDirs = [
    path.resolve('remotion/public/audio/runs', runId),
    path.resolve('dist-remotion/public/audio/runs', runId),
    path.resolve('dist-remotion/audio/runs', runId),
  ];
  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  for (const clip of audioResult.clips) {
    for (const dir of targetDirs) {
      const dest = path.join(dir, path.basename(clip.filePath));
      fs.copyFileSync(clip.filePath, dest);
    }
  }

  // Stage 3: Build Timeline & Render
  console.log('\n[Stage 2/3] Building Synchronized Kinetic Timeline...');
  const timeline = buildVideoTimeline(storyboard, audioResult.clips, {
    fps: 30,
    scenePaddingFrames: 14,
    audioSrcPrefix: `audio/runs/${runId}`,
  });
  console.log(`✅ Timeline ready: ${timeline.totalDurationInFrames} frames (${timeline.totalDurationSec}s @ 30fps).`);

  const outputMp4 = path.resolve(outputDir, 'zomato_surge_reel.mp4');
  console.log(`\n[Stage 3/3] Rendering Remotion StudioShort -> ${outputMp4}...`);

  const result = await renderStudioShort({
    storyboard,
    timeline,
    outputFilePath: outputMp4,
    onProgress: (p) => {
      process.stdout.write(`\r[Rendering Progress] ${p.percent}% (${p.renderedFrames}/${p.totalFrames} frames)`);
    },
  });

  console.log('\n\n====================================================');
  console.log('🎉 LOCAL RENDER COMPLETE!');
  console.log(`📁 File: ${result.outputFilePath}`);
  console.log(`📊 Size: ${(result.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`⏱️ Duration: ${result.durationSec.toFixed(1)}s`);
  console.log(`⚡ Render Time: ${(result.renderTimeMs / 1000).toFixed(1)}s`);
  console.log('====================================================\n');
}

runLocalRender().catch((err) => {
  console.error('\n❌ Local render error:', err);
  process.exit(1);
});
