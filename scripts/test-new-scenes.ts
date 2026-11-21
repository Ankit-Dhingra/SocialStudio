import path from 'node:path';
import fs from 'node:fs';
import { renderStillPreviews } from '../src/modules/render/video-renderer.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';
import { Storyboard } from '../src/modules/contracts/storyboard.js';

async function run() {
  const outDir = path.resolve('media/runs/new_scenes_preview');
  fs.mkdirSync(outDir, { recursive: true });

  const testStoryboard: Storyboard = {
    topic: 'How Zomato & Uber Calculate Surge Pricing Under 50ms',
    title: 'Surge Pricing Architecture Demo',
    hook: 'Surge Pricing Hook',
    learningObjective: 'End to end dynamic pricing visual progression',
    scenes: [
      {
        id: 'sc-1',
        sceneIndex: 0,
        type: 'smartphoneMockup',
        narration: 'Maan lo barish shuru hui aur delivery fee achanak ₹30 se ₹80 ho gayi!',
        onScreenText: '₹30 vs ₹80? • Dynamic Surge Pricing',
        technicalKeyPoint: 'Dynamic Surge Pricing Trigger',
        durationTargetSec: 6,
        visualProps: {
          appName: 'ZOMATO',
          itemName: 'Royal Chicken Dum Biryani',
          itemPrice: '₹300',
          baseDeliveryFee: '₹30',
          surgeDeliveryFee: '₹80',
          surgeMultiplier: '2.7X',
          surgeReason: 'HIGH DEMAND • 120+ ACTIVE ORDERS',
        },
      },
      {
        id: 'sc-2',
        sceneIndex: 1,
        type: 'h3SpatialMap',
        narration: 'Pehle naive approach dekho: pooray shahar ka 5km radius scan karna.',
        onScreenText: 'Naive Circle Range Scan • O(N) Disk Latency',
        technicalKeyPoint: 'Naive Circle Range Bottleneck',
        durationTargetSec: 6,
        visualProps: {
          mode: 'naive-radius',
          title: 'Naive 5km Circle Range Scan',
          subtitle: 'PostgreSQL Haversine Formula Bottleneck (450ms)',
          orderCount: 95,
          riderCount: 14,
        },
      },
      {
        id: 'sc-3',
        sceneIndex: 2,
        type: 'h3SpatialMap',
        narration: 'Isliye map ko divide karte hain Uber H3 hexagonal grid mein.',
        onScreenText: 'H3 Hexagonal Mesh • Equidistant Neighbors',
        technicalKeyPoint: 'Uber H3 Geospatial Indexing',
        durationTargetSec: 6,
        visualProps: {
          mode: 'hex-grid',
          hotHexId: '88619A0A4',
          orderCount: 84,
          riderCount: 12,
          subtitle: 'Uber H3 Geospatial Indexing',
        },
      },
      {
        id: 'sc-4',
        sceneIndex: 3,
        type: 'architecturePipeline',
        narration: 'Har hex cell ka aggregate demand data Redis in-memory cache mein stream hota hai.',
        onScreenText: 'Data Pipeline • Sub-Millisecond Redis Reads',
        technicalKeyPoint: 'In-Memory State Caching',
        durationTargetSec: 6,
        visualProps: {
          title: 'Dynamic Pricing Data Pipeline',
          subtitle: 'Aggregated demand per Hex ID via in-memory cache',
          redisLatencyMs: 2,
          atomicCommand: 'HGETALL surge:hex:88619A0A4',
          steps: [
            { label: 'Mobile App', description: 'Order request dispatched', status: 'completed' },
            { label: 'API Gateway', description: 'H3 Geo-hash resolution', status: 'completed' },
            { label: 'Redis Cache', description: 'Sub-millisecond supply lookup', status: 'active' },
            { label: 'Async Worker', description: 'Dynamic pricing engine', status: 'completed' },
          ],
        },
      },
      {
        id: 'sc-5',
        sceneIndex: 4,
        type: 'h3SpatialMap',
        narration: 'Lekin agar kisi rider ka internet chala jaye toh stale GPS heartbeat filter ho jata hai.',
        onScreenText: 'Edge Case • Stale GPS & Heartbeat Filter',
        technicalKeyPoint: 'Stale GPS and Disconnected Driver Heartbeat Filter',
        durationTargetSec: 6,
        visualProps: {
          mode: 'stale-heartbeat',
          hotHexId: '88619A0A4',
          orderCount: 60,
          riderCount: 2,
          subtitle: 'Disconnected driver heartbeats filtered from live supply pool',
        },
      },
      {
        id: 'sc-6',
        sceneIndex: 5,
        type: 'queueTimeline',
        narration: 'Aur agar calculate karte waqt worker crash ho jaye toh Redis TTL lock ko release kar deta hai.',
        onScreenText: 'Distributed Mutex • TTL Auto-Expiry',
        technicalKeyPoint: 'Distributed Lock TTL Expiry',
        durationTargetSec: 6,
        visualProps: {
          title: 'Distributed Lock Mutex Lifecycle',
          mode: 'lock',
          items: [
            { name: '1. Lock Held by Worker A', priority: 'medium', detail: 'SET hex_mutex:88619A worker_A NX EX 5' },
            { name: '2. Worker A Crashes / Disconnects', priority: 'high', detail: 'Worker dies ungracefully before lock release' },
            { name: '3. Redis TTL Expiry (5s)', priority: 'high', detail: 'Key evicted automatically by Redis engine' },
            { name: '4. Worker B Acquires Lock', priority: 'medium', detail: 'SET hex_mutex:88619A worker_B NX EX 5 succeeds' },
          ],
        },
      },
    ],
  };

  const timeline = buildVideoTimeline(testStoryboard, []);
  console.log('Rendering new visual scenes to stills...');
  const previews = await renderStillPreviews(testStoryboard, timeline, outDir);
  console.log(`Rendered ${previews.length} stills successfully!`);
  for (const p of previews) {
    console.log(`- Scene ${p.sceneIndex}: ${p.filePath}`);
  }
}

run().catch((err) => {
  console.error('Render preview error:', err);
  process.exit(1);
});
