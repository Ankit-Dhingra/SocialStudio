import path from 'node:path';
import fs from 'node:fs';
import { renderStill, selectComposition } from '@remotion/renderer';
import { Storyboard, StoryboardSchema } from '../src/modules/contracts/storyboard.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';

const outDir = path.resolve('output/demo_scenes');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const storyboard: Storyboard = StoryboardSchema.parse({
  topic: 'Zomato Surge Pricing Architecture',
  title: 'How Zomato Calculates Surge Pricing Under 50ms',
  hook: 'Interview mein pucha: Zomato surge pricing kaise kaam karta hai? REJECTED!',
  learningObjective: 'Understand spatial indexing (H3) and in-memory caching for real-time dynamic pricing.',
  targetAudience: 'Software Engineers & Backend Developers',
  format: 'short',
  estimatedDurationSec: 50,
  hashtags: ['#systemdesign', '#backend', '#redis', '#zomato'],
  scenes: [
    {
      id: 'scene-1',
      sceneIndex: 0,
      type: 'hook',
      narration: 'Interview mein pucha: Zomato surge pricing kaise kaam karta hai? Tumne bola SQL query. REJECTED!',
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
        rejectedFrame: 30,
      },
    },
    {
      id: 'scene-2',
      sceneIndex: 1,
      type: 'requestFlow',
      narration: 'Poore city ko chote chote hexagons mein divide kar dete hain jise H3 Hex Bins kehte hain.',
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
      narration: 'System Redis se ratio fetch karta hai. Background workers data stream karte hain.',
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
      narration: 'Ab ata hai tradeoff: Micro-hex accuracy ya low memory load? Comment mein batao!',
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

// Mock timeline with 10s per scene for preview rendering
const mockTimeline = buildVideoTimeline(
  storyboard,
  storyboard.scenes.map((s, idx) => ({
    filePath: `audio/runs/dummy-${idx}.mp3`,
    durationMs: 9000,
  })),
  {
    fps: 30,
    scenePaddingFrames: 10,
    audioSrcPrefix: 'audio/runs/dummy',
  }
);

async function renderDemoFrames() {
  console.log('[Preview] Selecting composition StudioShort from dist-remotion...');
  const bundleLocation = path.resolve('dist-remotion');

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'StudioShort',
    inputProps: {
      storyboard,
      timeline: mockTimeline,
    },
  });

  // Calculate mid-frame for each scene in the timeline
  const targets = [
    { name: 'scene_1_phone_mockup.jpg', frame: 45, label: 'Act 1: 3D Smartphone Mockup + REJECTED Stamp' },
    { name: 'scene_2_h3_spatial_map.jpg', frame: 380, label: 'Act 2 & 3: H3 Spatial City Hexagon Map' },
    { name: 'scene_3_architecture_pipeline.jpg', frame: 670, label: 'Act 4: Architecture Flow & Redis In-Memory' },
    { name: 'scene_4_tradeoff_cheat_sheet.jpg', frame: 950, label: 'Act 5: Interview Tradeoff & Cheat-Sheet' },
  ];

  console.log('\n[Preview] Rendering 4 high-res 1080x1920 demo scene snapshots...\n');

  for (const t of targets) {
    const outPath = path.join(outDir, t.name);
    console.log(`📸 Rendering ${t.label} at frame ${t.frame} -> ${t.name}...`);
    await renderStill({
      composition,
      serveUrl: bundleLocation,
      output: outPath,
      frame: t.frame,
      imageFormat: 'jpeg',
      chromiumOptions: {
        enableMultiProcessOnLinux: true,
        gl: 'swangle',
        disableWebSecurity: true,
      },
      inputProps: {
        storyboard,
        timeline: mockTimeline,
      },
    });
    console.log(`   ✅ Saved: ${outPath}`);
  }

  console.log('\n🎉 ALL DEMO SCENE SNAPSHOTS GENERATED IN output/demo_scenes/!\n');
}

renderDemoFrames().catch((err) => {
  console.error('[Preview Error]', err);
  process.exit(1);
});
