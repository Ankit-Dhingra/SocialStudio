import path from 'node:path';
import fs from 'node:fs';
import { renderStillPreviews } from '../src/modules/render/video-renderer.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';
import { Storyboard } from '../src/modules/contracts/storyboard.js';
import { searchAndDownloadLottie } from '../src/modules/video/lottie-service.js';

async function main() {
  console.log('--- STEP 1: DYNAMIC ONLINE LOTTIE DISCOVERY & DOWNLOAD ---');
  
  // Topic: Cab / Driver Ride Matching System Design
  const rideLottie = await searchAndDownloadLottie('truck driver courier transit');
  console.log('Discovered Ride Lottie:', rideLottie);

  const lockLottie = await searchAndDownloadLottie('mutex security lock');
  console.log('Discovered Lock Lottie:', lockLottie);

  const serverLottie = await searchAndDownloadLottie('cpu cluster server cache');
  console.log('Discovered Server Lottie:', serverLottie);

  console.log('\n--- STEP 2: CREATING STORYBOARD WITH DYNAMIC LOTTIE ASSETS ---');
  const outDir = path.resolve('media/runs/dynamic_lottie_demo');
  fs.mkdirSync(outDir, { recursive: true });

  const rideStoryboard: Storyboard = {
    topic: 'How Uber & Rapido Match 50,000 Drivers Under 10ms',
    title: 'Ride Hailing Real-Time Dispatch Architecture',
    hook: 'Uber Dispatch Hook',
    learningObjective: 'Understand spatial partition indexing and atomic driver reservation in real-time ride dispatch',
    scenes: [
      {
        id: 'scene-1',
        sceneIndex: 0,
        type: 'smartphoneMockup',
        narration: 'Maan lo barish shuru hui aur Uber app me peak surge activate ho gaya!',
        onScreenText: 'Peak Rain Surge • 50k Ride Requests',
        technicalKeyPoint: 'Dynamic Surge & High-Density Driver Search',
        durationTargetSec: 6,
        visualProps: {
          appCategory: 'ride',
          appName: 'UBER RIDE',
          itemName: 'Uber Premier Sedan (AC)',
          itemPrice: '₹420',
          feeLabel: 'PEAK MONSOON SURCHARGE',
          baseDeliveryFee: '₹40',
          surgeDeliveryFee: '₹160',
          surgeMultiplier: '2.5X',
          surgeReason: 'HEAVY MONSOON • 1,200+ ACTIVE PASSENGERS',
          algorithmName: 'H3 Spatial Mesh & Redis GeoRadius',
          ctaText: 'CONFIRM UBER PREMIER',
          lottieAsset: rideLottie?.id || 'truck',
        },
      },
      {
        id: 'scene-2',
        sceneIndex: 1,
        type: 'h3SpatialMap',
        narration: 'Database par har rider ke liye linear distance calculate karoge toh database crash ho jayega.',
        onScreenText: 'Naive Geo-Radius Full Scan • 820ms Bottleneck',
        technicalKeyPoint: 'Linear Distance O(N) Table Scan Failure',
        durationTargetSec: 6,
        visualProps: {
          mode: 'naive-radius',
          title: 'Naive Geo-Radius Distance Scan',
          subtitle: 'Scanning unindexed lat/long coordinates per request spikes DB CPU to 100%',
          orderCount: 520,
          riderCount: 18,
          entityLabel: 'Riders Waiting',
          providerLabel: 'Drivers Available',
          entityEmoji: '🙋‍♂️',
          providerEmoji: '🚕',
        },
      },
      {
        id: 'scene-3',
        sceneIndex: 2,
        type: 'raceCondition',
        narration: 'Do riders ne ek hi taxi ko ek sath book kiya toh concurrency deadlock ho sakti hai!',
        onScreenText: 'Concurrency Deadlock • Dual Driver Match',
        technicalKeyPoint: 'Atomic Distributed Lock via Redis SET NX EX',
        durationTargetSec: 6,
        visualProps: {
          title: 'CONCURRENCY • DRIVER MUTEX LOCK',
          itemTitle: 'Driver Cab #KA-05-9988 Reservation',
          user1Name: 'Rider A (App)',
          user2Name: 'Rider B (App)',
          atomicQuery: 'SET lock:driver:9988 rider_A NX EX 15',
          user1Timestamp: '18:30:00.102',
          user2Timestamp: '18:30:00.105',
        },
      },
      {
        id: 'scene-4',
        sceneIndex: 3,
        type: 'h3SpatialMap',
        narration: 'Solution hai Uber ka H3 Hexagonal Grid aur In-Memory Redis Geospatial Index!',
        onScreenText: 'Uber H3 Hexagonal Partition • O(1) Candidate Match',
        technicalKeyPoint: 'O(1) Spatial Resolution Resolution-8 H3 Hex Partition',
        durationTargetSec: 6,
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

  console.log('\n--- STEP 3: BUILDING TIMELINE ---');
  const timeline = buildVideoTimeline(rideStoryboard);
  console.log('Timeline created. Total Duration:', timeline.durationSec, 'seconds. Total Segments:', timeline.segments.length);

  console.log('\n--- STEP 4: RENDERING STILL PREVIEWS ---');
  const previewPaths = await renderStillPreviews(rideStoryboard, timeline, outDir);
  console.log('Rendered Previews:', previewPaths);
}

main().catch((err) => {
  console.error('Demo error:', err);
  process.exit(1);
});
