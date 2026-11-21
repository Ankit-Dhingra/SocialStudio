import path from 'node:path';
import fs from 'node:fs';
import { renderStudioShort } from '../src/modules/render/video-renderer.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';
import { Storyboard } from '../src/modules/contracts/storyboard.js';

async function main() {
  const outDir = path.resolve('media/runs/dynamic_lottie_demo');
  fs.mkdirSync(outDir, { recursive: true });
  const outputFilePath = path.join(outDir, 'preview_3d_render.mp4');

  const demoStoryboard: Storyboard = {
    topic: 'How Ride Hailing Apps Match 50,000 Drivers in Realtime',
    title: 'Ride Dispatch 3D Showcase',
    hook: 'Ride Dispatch Hook',
    learningObjective: 'Observe 3D animation rendering with dynamic surge trigger',
    scenes: [
      {
        id: 'scene-1',
        sceneIndex: 0,
        type: 'smartphoneMockup',
        narration: 'Maan lo barish shuru hui aur Uber app me peak monsoon surge trigger ho gaya!',
        onScreenText: 'Monsoon Peak Surge • 50k Rides',
        technicalKeyPoint: 'Dynamic Surge & Real-Time Client Trigger',
        durationTargetSec: 4,
        visualProps: {
          appCategory: 'ride',
          appName: 'UBER RIDE',
          itemName: 'Uber Premier Sedan (AC)',
          itemPrice: '₹420',
          feeLabel: 'PEAK MONSOON SURCHARGE',
          baseDeliveryFee: '₹40',
          surgeDeliveryFee: '₹160',
          surgeMultiplier: '2.5X',
          surgeReason: 'HEAVY RAIN • 1,200+ PASSENGERS WAITING',
          algorithmName: 'Uber H3 Spatial Mesh',
          ctaText: 'CONFIRM UBER PREMIER',
          lottieAsset: 'scooter-3d',
        },
      },
      {
        id: 'scene-2',
        sceneIndex: 1,
        type: 'h3SpatialMap',
        narration: 'Uber ka H3 Hexagonal Grid real-time drivers ko nearest passenger ke sath 2ms me match karta hai!',
        onScreenText: 'Uber H3 Hexagonal Partition • O(1) Match',
        technicalKeyPoint: 'O(1) Hexagonal Spatial Partitioning',
        durationTargetSec: 4,
        visualProps: {
          mode: 'hex-grid',
          title: 'Uber H3 Spatial Hexagonal Partitioning',
          subtitle: 'Divides earth into Resolution-8 hexagons, finding nearest cabs in 2ms in-memory',
          hotHexId: '#H3_HEX_88268',
          orderCount: 65,
          riderCount: 22,
          surgeMultiplier: '2.5X',
          entityLabel: 'Passengers',
          providerLabel: 'Active Cabs',
          entityEmoji: '📍',
          providerEmoji: '🚖',
        },
      },
    ],
  };

  const timeline = buildVideoTimeline(demoStoryboard);
  console.log(`Rendering 3D preview video (${timeline.totalFrames} frames @ 30fps)...`);

  const res = await renderStudioShort({
    storyboard: demoStoryboard,
    timeline,
    outputFilePath,
    onProgress: (p) => {
      if (Math.round(p * 100) % 25 === 0) {
        console.log(`Rendering progress: ${Math.round(p * 100)}%`);
      }
    },
  });

  console.log('Video render finished successfully:', res);
}

main().catch((err) => {
  console.error('Render error:', err);
  process.exit(1);
});
