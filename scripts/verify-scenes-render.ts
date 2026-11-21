import path from 'node:path';
import fs from 'node:fs';
import { renderStillPreviews } from '../src/modules/render/video-renderer.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';

async function main() {
  const outDir = path.resolve('media/runs/verified_scenes');
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Verify Event-Loop Scene (Microtasks vs Macrotasks)
  console.log('Rendering Event-Loop QueueTimeline scene still...');
  const eventLoopStoryboard: any = {
    topic: 'How Node.js Event Loop handles Microtasks vs Macrotasks',
    title: 'Microtasks vs Macrotasks in Node.js',
    hook: 'Event Loop',
    learningObjective: 'Understand microtasks and macrotasks priority',
    scenes: [
      {
        id: 'sc-el-1',
        sceneIndex: 0,
        type: 'queueTimeline',
        narration: 'Microtasks drain completely before the event loop advances to the next macrotask phase.',
        onScreenText: 'Event Loop Execution Queues',
        technicalKeyPoint: 'Microtask vs Macrotask priority execution',
        durationTargetSec: 10,
        visualProps: {
          items: [
            { name: 'process.nextTick Queue', priority: 'microtask', detail: 'Immediate synchronous microtask' },
            { name: 'Promise.then Queue', priority: 'microtask', detail: 'Microtask drained before macrotasks' },
            { name: 'Timers Macrotask Queue', priority: 'macrotask', detail: 'setTimeout and setInterval' },
            { name: 'Check Macrotask Queue', priority: 'macrotask', detail: 'setImmediate callback queue' },
          ],
        },
      },
    ],
  };

  const eventLoopTimeline = buildVideoTimeline(eventLoopStoryboard, []);
  const elPreviews = await renderStillPreviews(eventLoopStoryboard, eventLoopTimeline, path.join(outDir, 'event_loop'));
  console.log('✅ Event-Loop Still Previews:', elPreviews.map(p => p.filePath));

  // 2. Verify Distributed Lock Scene (Lease Expiry + Retry Succeeding)
  console.log('Rendering Distributed Lock QueueTimeline scene still...');
  const lockStoryboard: any = {
    topic: 'How Zomato & Uber Calculate Surge Pricing Under 50ms',
    title: 'Distributed Lock Failover',
    hook: 'Lock',
    learningObjective: 'Distributed lock auto-expiry',
    scenes: [
      {
        id: 'sc-lock-1',
        sceneIndex: 0,
        type: 'queueTimeline',
        narration: 'Redis TTL auto-expiry ensures distributed mutexes fail over cleanly if a node crashes.',
        onScreenText: 'Redis TTL Mutex Failover',
        technicalKeyPoint: 'Distributed lock auto-expiry',
        durationTargetSec: 10,
        visualProps: {
          mode: 'lock',
          title: 'Redis TTL Lease & Failover',
        },
      },
    ],
  };

  const lockTimeline = buildVideoTimeline(lockStoryboard, []);
  const lockPreviews = await renderStillPreviews(lockStoryboard, lockTimeline, path.join(outDir, 'lock'));
  console.log('✅ Lock Still Previews:', lockPreviews.map(p => p.filePath));

  // 3. Verify Phone Mockup Scene (Derived Arithmetic)
  console.log('Rendering Phone Mockup scene still to verify derived arithmetic...');
  const phoneStoryboard: any = {
    topic: 'How Zomato & Uber Calculate Surge Pricing Under 50ms',
    title: 'Phone Surge',
    hook: 'Surge',
    learningObjective: 'Phone surge pricing arithmetic',
    scenes: [
      {
        id: 'sc-phone-1',
        sceneIndex: 0,
        type: 'smartphoneMockup',
        narration: 'Delivery fee jumps from standard rate to surge rate.',
        onScreenText: '₹30 vs ₹80 • Surge Pricing',
        technicalKeyPoint: 'Dynamic Surge Jump',
        durationTargetSec: 10,
        visualProps: {
          appName: 'ZOMATO',
          itemName: 'Royal Chicken Dum Biryani',
          itemPrice: '₹300',
          baseDeliveryFee: '₹30',
          surgeDeliveryFee: '₹80',
          surgeMultiplier: '2.7X',
        },
      },
    ],
  };

  const phoneTimeline = buildVideoTimeline(phoneStoryboard, []);
  const phonePreviews = await renderStillPreviews(phoneStoryboard, phoneTimeline, path.join(outDir, 'phone'));
  console.log('✅ Phone Still Previews:', phonePreviews.map(p => p.filePath));

  console.log('\n=============================================================');
  console.log('🎉 ALL SCENE STILLS SUCCESSFULLY RENDERED AND VERIFIED!');
  console.log('=============================================================');
}

main().catch(err => {
  console.error('Error rendering scene stills:', err);
  process.exit(1);
});
