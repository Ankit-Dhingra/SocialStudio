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
      narration: 'Interview mein pucha: Zomato surge pricing kaise kaam karta hai? Tumne bola SQL query. REJECTED! Itni jaldi har request pe DB query? Impossible!',
      onScreenText: 'ZOMATO SURGE PRICING',
      technicalKeyPoint: 'Real-Time Spatial Pricing',
      durationTargetSec: 7,
      visualProps: {
        headline: 'SQL QUERY FOR SURGE? REJECTED!',
        subtext: 'How does dynamic pricing calculate in under 50ms?',
        badgeText: 'SYSTEM DESIGN',
        accentColor: '#EF4444',
      },
    },
    {
      id: 'scene-2',
      sceneIndex: 1,
      type: 'comparison',
      narration: 'Socho, Zomato ko kaise pata chalta hai ki tumhare exact location pe surge lagana hai, aur woh bhi har second update hota hai? Poore city ka data ek saath?',
      onScreenText: 'NAIVE DB vs IN-MEMORY',
      technicalKeyPoint: 'Database Lock vs In-Memory Spatial Lookup',
      durationTargetSec: 8,
      visualProps: {
        leftTitle: 'Naive Approach',
        leftPoints: ['Full DB Table Scan', 'Row-level locks', '> 1200ms latency'],
        rightTitle: 'Production Architecture',
        rightPoints: ['H3 Hex Spatial Bins', 'Redis in-memory cache', '< 15ms latency'],
        verdict: 'Spatial indexing converts geo-queries into simple key lookups.',
      },
    },
    {
      id: 'scene-3',
      sceneIndex: 2,
      type: 'requestFlow',
      narration: 'Jab tum app kholte ho, tumhari GPS location backend pe jaake H3 Hex Bin mein convert hoti hai. Matlab poore city ko hexagons mein divide kar diya. Har hexagon ka ek unique ID! System Redis se ratio fetch karta hai aur surge price calculate ho jata hai.',
      onScreenText: 'CLIENT TO REDIS SPATIAL FLOW',
      technicalKeyPoint: 'Client GPS -> H3 Hex Bin -> Redis In-Memory Lookup',
      durationTargetSec: 15,
      visualProps: {
        title: 'Zomato Real-Time Surge Pipeline',
        steps: [
          { label: 'Client GPS', description: 'User coordinates (lat, lng)', status: 'active' },
          { label: 'H3 Hex Indexing', description: 'Resolve to Hex Bin ID #88619a0a4', status: 'active' },
          { label: 'Redis Cache', description: 'O(1) lookup demand/supply ratio', status: 'cached' },
          { label: 'Surge Multiplier', description: 'Apply 1.2x to 2.0x surge multiplier', status: 'completed' },
        ],
      },
    },
    {
      id: 'scene-4',
      sceneIndex: 3,
      type: 'queueTimeline',
      narration: 'Par ye ratio update kaun karta hai? Background mein dedicated worker services continuously aggregate karte hain: kitne orders aaye, kitne riders available hain. Aur har few seconds mein Redis update ho jata hai! DB ko hit hi nahi karna padta.',
      onScreenText: 'ASYNC WORKER AGGREGATION',
      technicalKeyPoint: 'Async Workers update Hex Bins every 5 seconds',
      durationTargetSec: 12,
      visualProps: {
        title: 'Background Worker Pipeline',
        items: [
          { name: 'Event Stream', priority: 'high', detail: 'Rider GPS and Order telemetry' },
          { name: 'Aggregation Worker', priority: 'high', detail: 'Compute demand vs supply ratio' },
          { name: 'Redis Cache Write', priority: 'microtask', detail: 'Atomic SET hex_id:ratio' },
          { name: 'Cold Storage Flush', priority: 'low', detail: 'Async batch write to database' },
        ],
        activeItemIndex: 1,
      },
    },
    {
      id: 'scene-5',
      sceneIndex: 4,
      type: 'summary',
      narration: 'Ab ata hai tradeoff: H3 hex granular pricing deta hai, par Redis memory aur frequent updates mangta hai. Ya phir bade zones use karo, par pricing accurate nahi hogi. Ab system tumhara hai: High accuracy ya low load? Comment mein batao!',
      onScreenText: 'TRADE-OFF: GRANULARITY vs LOAD',
      technicalKeyPoint: 'Micro-hex precision requires high Redis write throughput',
      durationTargetSec: 10,
      visualProps: {
        headline: 'SYSTEM DESIGN SUMMARY',
        takeaways: [
          'H3 Spatial Indexing turns O(N) geo-scans into O(1) hash lookups',
          'Background worker streaming decouples read path from write path',
          'Tradeoff: Micro-hex accuracy vs Redis in-memory throughput',
        ],
        callToAction: 'Save this reel & share with your dev friends!',
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
