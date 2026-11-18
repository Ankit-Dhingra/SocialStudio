import path from 'node:path';
import fs from 'node:fs';
import { renderStill, selectComposition } from '@remotion/renderer';
import { Storyboard, StoryboardSchema } from '../src/modules/contracts/storyboard.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';

const outDir = path.resolve('output/full_16_scenes');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

export const full16Storyboard: Storyboard = StoryboardSchema.parse({
  topic: 'Zomato & Uber Real-Time Dynamic Surge Pricing Architecture',
  title: 'How Zomato Calculates Surge Pricing Under 50ms',
  hook: 'Aaj wahi restaurant, wahi biryani, par delivery fee 30 se seedha 80 rupaye kaise ho gayi?',
  learningObjective: 'Master Uber H3 spatial indexing, in-memory caching, and decoupled read/write streams.',
  targetAudience: 'Software Engineers & Senior Backend Developers',
  format: 'short',
  estimatedDurationSec: 120,
  hashtags: ['#systemdesign', '#zomato', '#redis', '#backend', '#shorts'],
  scenes: [
    // 1. 3D Smartphone Mockup (Delivery Fee Flip)
    {
      id: 'scene-1',
      sceneIndex: 0,
      type: 'smartphoneMockup',
      narration: 'Aaj wahi restaurant, wahi biryani, par delivery fee tees rupaye se seedha assi rupaye ho gayi!',
      onScreenText: 'DELIVERY FEE: ₹30 -> ₹80',
      technicalKeyPoint: 'Dynamic Surge Multiplier Flip',
      durationTargetSec: 7,
      visualProps: {
        headline: 'HOW ZOMATO DECIDES SURGE FEE',
        subtext: 'Why your delivery fee jumps from ₹30 to ₹80 in seconds',
        appName: 'ZOMATO',
        locationText: 'HSR Layout, Sector 4',
        itemName: 'Royal Chicken Dum Biryani',
        itemPrice: '₹380',
        baseDeliveryFee: '₹30',
        surgeDeliveryFee: '₹80',
        surgeMultiplier: '1.8X',
        surgeReason: 'HIGH DEMAND • 120+ ACTIVE ORDERS',
      },
    },
    // 2. Comparison: The Distance Myth
    {
      id: 'scene-2',
      sceneIndex: 1,
      type: 'comparison',
      narration: 'Zyadatar log sochte hain ki delivery fee distance par depend karti hai. Lekin reality mein ye real-time supply and demand game hai.',
      onScreenText: 'DISTANCE vs REAL-TIME SUPPLY & DEMAND',
      technicalKeyPoint: 'Distance Myth Debunked',
      durationTargetSec: 7,
      visualProps: {
        leftTitle: '❌ THE DISTANCE MYTH',
        leftCode: 'fee = distance_km * 10 // Static calculation',
        leftPoints: ['Assumes static conditions', 'Fails during peak rush or heavy rain', 'Riders get no incentive to move'],
        rightTitle: '✅ REAL-TIME SPATIAL PRICING',
        rightCode: 'fee = base_fee * surge_multiplier(hex_bin)',
        rightPoints: ['In-memory spatial ratio', 'Dynamic 1.2X to 2.5X multiplier', 'Directly balances fleet availability'],
        verdict: 'Dynamic fleet balancing dynamically attracts riders to high-demand areas.',
      },
    },
    // 3. Uber H3 Spatial Honeycomb Map
    {
      id: 'scene-3',
      sceneIndex: 2,
      type: 'h3SpatialMap',
      narration: 'Zomato poore city ko chote chote hexagons mein divide karta hai, jise Uber ka open-source H3 Spatial Indexing kehte hain.',
      onScreenText: 'H3 SPATIAL INDEXING: CITY HEX MESH',
      technicalKeyPoint: 'Hexagonal Spatial Partitioning',
      durationTargetSec: 8,
      visualProps: {
        title: 'H3 SPATIAL INDEXING: HEX MESH',
        subtitle: 'Converting 2D Earth Coordinates to Hexagon IDs',
        hotHexId: '#88619A0A4',
        orderCount: 54,
        riderCount: 4,
        surgeMultiplier: '1.8X',
      },
    },
    // 4. Critical Demand Imbalance Telemetry
    {
      id: 'scene-4',
      sceneIndex: 3,
      type: 'h3SpatialMap',
      narration: 'Har hexagon ki boundary fix hoti hai. Agar kisi hex mein 50 orders hain aur delivery partner sirf char, toh system instant surge trigger karta hai.',
      onScreenText: 'CRITICAL SUPPLY DEFICIT: 54 vs 4',
      technicalKeyPoint: 'Supply/Demand Ratio Telemetry',
      durationTargetSec: 8,
      visualProps: {
        title: 'CRITICAL DEMAND IMBALANCE',
        subtitle: '54 Active Orders vs 4 Available Riders in Hexagon #88619A0A4',
        hotHexId: '#88619A0A4',
        orderCount: 54,
        riderCount: 4,
        surgeMultiplier: '2.0X',
      },
    },
    // 5. GPS Stream to H3 Hash Converter
    {
      id: 'scene-5',
      sceneIndex: 4,
      type: 'architecturePipeline',
      narration: 'Lekin sawaal ye hai: Lakhon riders ke continuous GPS coordinates ko database mein har second kaise map kiya jata hai?',
      onScreenText: 'GPS STREAM -> H3 SPATIAL HASH',
      technicalKeyPoint: 'Continuous Geo-Coordinate Ingestion',
      durationTargetSec: 7,
      visualProps: {
        title: 'GPS COORDINATE TO H3 HASH CONVERTER',
        subtitle: 'Converting (lat, lng) to O(1) in-memory spatial hash keys',
        redisLatencyMs: 3.2,
      },
    },
    // 6. Naive SQL Query Crashing Postgres
    {
      id: 'scene-6',
      sceneIndex: 5,
      type: 'code',
      narration: 'Agar tum SQL query likhoge: SELECT count(*) FROM orders WHERE distance < 2km, toh database second bhar mein crash ho jayega.',
      onScreenText: 'NAIVE SQL QUERY (POSTGRES CRASH)',
      technicalKeyPoint: 'Database Deadlocks from Spatial Joins',
      durationTargetSec: 8,
      visualProps: {
        filename: 'naive_spatial_query.sql',
        code: '-- ❌ NAIVE APPROACH: Exhausts DB Connection Pool\nSELECT count(*)\nFROM active_orders\nWHERE ST_DWithin(geom, ST_MakePoint(77.62, 12.93), 2000);\n-- Latency: 1450ms • Connections: 500/500 MAXED OUT',
        highlightLines: [2, 3, 4],
        terminalOutputs: [
          { text: 'WARNING: Postgres Connection Pool 100% Saturation', badge: 'CRITICAL', highlight: true, delayFrames: 10 },
          { text: 'Slow Query: ST_DWithin took 1,452ms', badge: 'DB LATENCY', delayFrames: 30 },
          { text: 'FATAL: remaining connection slots reserved for superusers', badge: 'CRASH', highlight: true, delayFrames: 55 },
        ],
        explanationCallout: 'Spatial polygon joins do not scale to 100,000 live queries!',
      },
    },
    // 7. The 50ms Read Path (In-Memory Redis)
    {
      id: 'scene-7',
      sceneIndex: 6,
      type: 'architecturePipeline',
      narration: 'Isliye Zomato use karta hai In-Memory Redis Cluster. Read path aur write path ko bilkul alag kar diya jata hai.',
      onScreenText: 'THE ULTRA-FAST READ PATH (< 4MS)',
      technicalKeyPoint: 'Decoupled In-Memory Read Architecture',
      durationTargetSec: 8,
      visualProps: {
        title: 'THE 50MS READ PATH: IN-MEMORY REDIS',
        subtitle: 'Mobile App reads surge multiplier in < 4ms directly from cache',
        redisLatencyMs: 2.1,
      },
    },
    // 8. The Decoupled Async Write Path (Kafka)
    {
      id: 'scene-8',
      sceneIndex: 7,
      type: 'architecturePipeline',
      narration: 'Write path par Apache Kafka aur background workers continuous rider pings process karke Redis hash update karte hain.',
      onScreenText: 'ASYNC WRITE PATH: KAFKA STREAMING',
      technicalKeyPoint: 'Kafka Stream Decoupling',
      durationTargetSec: 8,
      visualProps: {
        title: 'ASYNC WRITE PATH: KAFKA & WORKERS',
        subtitle: '100,000 rider pings streaming without blocking read transactions',
        redisLatencyMs: 1.8,
      },
    },
    // 9. Concurrency Race Hazard
    {
      id: 'scene-9',
      sceneIndex: 8,
      type: 'raceCondition',
      narration: 'Par socho agar barish shuru ho jaye aur hazaron log ek sath order place karein, toh pricing update mein race condition kaise rokte hain?',
      onScreenText: 'PARALLEL CONCURRENCY COLLISION',
      technicalKeyPoint: 'High-Concurrency Collision Hazard',
      durationTargetSec: 8,
      visualProps: {
        title: 'CONCURRENCY • SURGE UPDATE COLLISION',
        itemTitle: 'Hexagon #88619A0A4 (Riders: 4)',
        user1Name: 'Order Service A (Thread 101)',
        user2Name: 'Surge Compute Worker (Thread 204)',
        atomicQuery: 'SET lock:hex:88619A0A4 token_a NX EX 5;',
      },
    },
    // 10. Redis Atomic Distributed Lock
    {
      id: 'scene-10',
      sceneIndex: 9,
      type: 'code',
      narration: 'Redis ka atomic distributed lock use hota hai: SET lock:hex_id unique_token NX EX five, jisse pricing calculation safe rehti hai.',
      onScreenText: 'ATOMIC DISTRIBUTED LOCK (REDIS)',
      technicalKeyPoint: 'Single-Turn Atomicity with SET NX EX',
      durationTargetSec: 8,
      visualProps: {
        filename: 'atomic_distributed_lock.sh',
        code: '# ✅ ATOMIC MUTEX ACQUISITION\nREDIS> SET lock:hex:88619A0A4 "worker_uuid_77" NX EX 5\nOK\n\n# Safely calculate surge ratio without parallel write collision\n# Release lock via Lua script verifying worker_uuid',
        highlightLines: [2, 3],
        terminalOutputs: [
          { text: 'ACQUIRE: Lock granted to worker_uuid_77', badge: 'REDIS NX', highlight: true, delayFrames: 10 },
          { text: 'EXECUTE: Recomputing Hexagon Multiplier -> 1.8X', badge: 'COMPUTE', delayFrames: 30 },
          { text: 'RELEASE: Lua script safely released token', badge: 'LUA SCRIPT', highlight: true, delayFrames: 55 },
        ],
        explanationCallout: 'SET NX EX guarantees only ONE worker computes surge per hex!',
      },
    },
    // 11. Benchmark: Postgres Table Lock vs Redis In-Memory
    {
      id: 'scene-11',
      sceneIndex: 10,
      type: 'comparison',
      narration: 'Postgres table lock latency 500 millisecond badha deta hai, jabki Redis atomic lock sub-millisecond mein complete hota hai.',
      onScreenText: 'POSTGRES LOCK vs REDIS ATOMIC SPEED',
      technicalKeyPoint: 'Sub-Millisecond In-Memory Execution',
      durationTargetSec: 8,
      visualProps: {
        leftTitle: '❌ POSTGRES TABLE LOCK',
        leftCode: 'SELECT * FROM surge_zones WHERE id = 101 FOR UPDATE;',
        leftPoints: ['Locks entire disk row', '540ms latency under high load', 'Blocks concurrent read queries'],
        rightTitle: '✅ REDIS IN-MEMORY ATOMIC',
        rightCode: 'SET lock:hex:101 uuid NX EX 5',
        rightPoints: ['In-memory single threaded execution', 'Sub-millisecond latency (1.4ms)', 'Supports 100,000+ operations/sec'],
        verdict: 'Redis in-memory atomicity prevents checkout screen latency spikes.',
      },
    },
    // 12. Edge Case: Worker Crash & TTL Auto-Recovery
    {
      id: 'scene-12',
      sceneIndex: 11,
      type: 'queueTimeline',
      narration: 'Edge case: Agar pricing compute worker crash ho jaye, toh TTL automatic lock release karke deadlock hone se bacha leta hai.',
      onScreenText: 'EDGE CASE: WORKER CRASH & TTL SAFETY',
      technicalKeyPoint: 'Guaranteed Deadlock Prevention',
      durationTargetSec: 8,
      visualProps: {
        title: 'WORKER CRASH & TTL AUTO-RECOVERY',
        items: [
          { name: '1. Lock Acquisition', priority: 'high', detail: 'Compute Worker acquires lock with 5s TTL' },
          { name: '2. Worker Crash', priority: 'high', detail: 'Worker terminated unexpectedly by OOM Killer' },
          { name: '3. TTL Auto-Expiry', priority: 'medium', detail: 'Redis TTL expires (5 seconds elapsed)' },
          { name: '4. Standby Handover', priority: 'low', detail: 'Standby worker acquires lock seamlessly' },
        ],
      },
    },
    // 13. Edge Case: Offline Rider Monotonic GPS Sync
    {
      id: 'scene-13',
      sceneIndex: 12,
      type: 'queueTimeline',
      narration: 'Agar rider basement mein ho aur network disconnect ho jaye, toh local offline queue monotonic timestamps ke sath baad mein sync hoti hai.',
      onScreenText: 'OFFLINE RIDER MONOTONIC GPS SYNC',
      technicalKeyPoint: 'Out-of-Order Packet Protection',
      durationTargetSec: 8,
      visualProps: {
        title: 'OFFLINE RIDER & OUT-OF-ORDER SYNC',
        items: [
          { name: '1. Network Disconnect', priority: 'high', detail: 'Rider enters basement: SQLite offline queue buffers GPS' },
          { name: '2. Network Reconnect', priority: 'high', detail: 'Rider emerges: Batched packets transmitted to Gateway' },
          { name: '3. Monotonic Timestamp Check', priority: 'medium', detail: 'System validates timestamp > last_seen to drop stale packets' },
          { name: '4. Redis Position Reconciled', priority: 'low', detail: 'Accurate rider count updated in spatial hex bin' },
        ],
      },
    },
    // 14. Senior SDE-3 Tradeoff Decision Matrix
    {
      id: 'scene-14',
      sceneIndex: 13,
      type: 'tradeoffHUD',
      narration: 'System design interview mein tradeoff zaroor pucha jayega: Micro-hex bins use karoge ya Macro zones? Granularity vs Memory load!',
      onScreenText: 'SENIOR SDE-3 TRADEOFF MATRIX',
      technicalKeyPoint: 'Spatial Granularity vs In-Memory Load',
      durationTargetSec: 9,
      visualProps: {
        title: 'THE SYSTEM DESIGN TRADEOFF',
        subtitle: 'Which spatial partitioning strategy would you defend in an interview?',
        optionA_Title: 'OPTION A: MICRO-HEX BINS (H3 RES 9 • 100m)',
        optionA_Pros: 'Hyper-local surge pricing, riders incentivized to cross streets',
        optionA_Cons: 'High Redis memory footprint & 150k key-writes per second',
        optionB_Title: 'OPTION B: MACRO ZONES (H3 RES 6 • 3km)',
        optionB_Pros: 'Ultra-lightweight RAM footprint & low network packet volume',
        optionB_Cons: 'Border pricing anomalies and rider complaints at boundary edges',
        interviewPoints: [
          'H3 Spatial Indexing converts geometric polygons to O(1) string hashes',
          'Redis in-memory caching serves dynamic surge pricing under 4ms',
          'Background Kafka streams decouple client read path from GPS write path',
          'Distributed locks with TTL prevent both race conditions and deadlocks',
        ],
        callToAction: 'Save this reel for your System Design Interview & follow for more!',
      },
    },
    // 15. Interview Summary Cheat-Sheet
    {
      id: 'scene-15',
      sceneIndex: 14,
      type: 'summary',
      narration: 'Summary yaad rakho: H3 Spatial Indexing, Redis in-memory cache, decoupled read-write streaming, aur TTL crash protection.',
      onScreenText: 'INTERVIEW CHEAT-SHEET SUMMARY',
      technicalKeyPoint: 'Mental Model for Interviews',
      durationTargetSec: 7,
      visualProps: {
        headline: 'System Design Interview Recap',
        takeaways: [
          'H3 Spatial Indexing converts geometric polygons to O(1) string hashes',
          'Redis in-memory caching serves dynamic surge pricing in < 4ms',
          'Decoupled Kafka streams prevent database locks during peak demand',
          'Distributed locks with TTL prevent concurrency race conditions and deadlocks',
        ],
        callToAction: 'Save this post to revise before your next SDE interview!',
      },
    },
    // 16. Smooth Outro & Follow CTA
    {
      id: 'scene-16',
      sceneIndex: 15,
      type: 'summary',
      narration: 'Aise hi real-world system design seekhne ke liye follow karo aur doston ke sath share karo!',
      onScreenText: 'FOLLOW FOR DEEP TECH',
      technicalKeyPoint: 'Follow & Share for System Design',
      durationTargetSec: 6,
      visualProps: {
        headline: 'Master Real-World System Design',
        takeaways: [
          'Save this reel for interview revision',
          'Share with your developer friends and batchmates',
        ],
        callToAction: 'Aise hi deep tech concepts seekhne ke liye follow karo!',
      },
    },
  ],
});

// Mock timeline with 7.5s (225 frames) per scene for accurate still frame rendering
const mockTimeline = buildVideoTimeline(
  full16Storyboard,
  full16Storyboard.scenes.map((s, idx) => ({
    filePath: `audio/runs/dummy-${idx}.mp3`,
    durationMs: (s.durationTargetSec || 7.5) * 1000,
  })),
  {
    fps: 30,
    scenePaddingFrames: 5,
    audioSrcPrefix: 'audio/runs/dummy',
  }
);

async function renderFull16Screens() {
  console.log('[Render 16] Selecting composition StudioShort from dist-remotion...');
  const bundleLocation = path.resolve('dist-remotion');

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'StudioShort',
    inputProps: {
      storyboard: full16Storyboard,
      timeline: mockTimeline,
    },
  });

  // Calculate target frame for each scene in the timeline
  // Each scene has seg.startFrame and seg.durationInFrames
  const targets = mockTimeline.segments.map((seg, idx) => {
    const scene = full16Storyboard.scenes[idx];
    // For smartphoneMockup, surge happens at frame >= 75 in sceneFrame
    let offsetInScene = Math.floor(seg.durationInFrames * 0.45);
    if (scene.type === 'smartphoneMockup') {
      offsetInScene = Math.min(seg.durationInFrames - 5, 85);
    } else if (scene.type === 'h3SpatialMap') {
      offsetInScene = 45;
    } else if (scene.type === 'raceCondition') {
      offsetInScene = Math.floor(seg.durationInFrames * 0.65);
    }

    const captureFrame = seg.startFrame + offsetInScene;
    return {
      index: idx + 1,
      name: `screen_${String(idx + 1).padStart(2, '0')}_${scene.type}.jpg`,
      frame: captureFrame,
      type: scene.type,
      label: `Screen ${idx + 1}: ${scene.onScreenText} (${scene.type})`,
    };
  });

  console.log(`\n[Render 16] Rendering ${targets.length} high-resolution (1080x1920) still frames in concurrency of 2...\n`);

  for (let i = 0; i < targets.length; i += 2) {
    const batch = targets.slice(i, i + 2);
    await Promise.all(
      batch.map(async (t) => {
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
            storyboard: full16Storyboard,
            timeline: mockTimeline,
          },
        });
        console.log(`   ✅ Saved: ${t.name}`);
      })
    );
  }

  console.log('\n🎉 ALL 16 HIGH-RESOLUTION SCREENS GENERATED IN output/full_16_scenes/!\n');
}

renderFull16Screens().catch((err) => {
  console.error('[Render 16 Error]', err);
  process.exit(1);
});
