import path from 'node:path';
import fs from 'node:fs';
import { renderStill, selectComposition } from '@remotion/renderer';
import { getOrCreateBundle } from '../src/modules/render/video-renderer.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';

async function main() {
  const outDir = path.resolve('media/runs/verified_scenes');
  fs.mkdirSync(outDir, { recursive: true });

  // Render Distributed Lock Scene: Frame 35 (Worker A crashed & Lease expiring) and Frame 85 (Worker B retry succeeds)
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
  lockTimeline.segments[0].cueFrames = [60];
  const bundleLocation = await getOrCreateBundle(lockTimeline);

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'StudioShort',
    chromiumOptions: { gl: 'angle', disableWebSecurity: true },
    inputProps: {
      storyboard: lockStoryboard,
      timeline: lockTimeline,
    },
  });

  const frameExpiring = path.join(outDir, 'lock_lease_expiring.jpg');
  await renderStill({
    composition,
    serveUrl: bundleLocation,
    frame: 35,
    output: frameExpiring,
  });
  console.log(`✅ Lock Lease Expiring Still: ${frameExpiring} (${fs.statSync(frameExpiring).size} bytes)`);

  const frameRetry = path.join(outDir, 'lock_retry_succeeding.jpg');
  await renderStill({
    composition,
    serveUrl: bundleLocation,
    frame: 85,
    output: frameRetry,
  });
  console.log(`✅ Lock Retry Succeeding Still: ${frameRetry} (${fs.statSync(frameRetry).size} bytes)`);

  // Phone scene before surge and after surge
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
  phoneTimeline.segments[0].cueFrames = [60];

  const phoneComposition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'StudioShort',
    chromiumOptions: { gl: 'angle', disableWebSecurity: true },
    inputProps: {
      storyboard: phoneStoryboard,
      timeline: phoneTimeline,
    },
  });

  const phoneBefore = path.join(outDir, 'phone_before_surge.jpg');
  await renderStill({
    composition: phoneComposition,
    serveUrl: bundleLocation,
    frame: 25,
    output: phoneBefore,
  });
  console.log(`✅ Phone Before Surge Still: ${phoneBefore} (${fs.statSync(phoneBefore).size} bytes)`);

  const phoneAfter = path.join(outDir, 'phone_after_surge.jpg');
  await renderStill({
    composition: phoneComposition,
    serveUrl: bundleLocation,
    frame: 95,
    output: phoneAfter,
  });
  console.log(`✅ Phone After Surge Still: ${phoneAfter} (${fs.statSync(phoneAfter).size} bytes)`);

  console.log('🎉 ALL PAIRED SCENE STILLS SUCCESSFULLY RENDERED!');
}

main().catch(err => {
  console.error('Error rendering paired stills:', err);
  process.exit(1);
});
