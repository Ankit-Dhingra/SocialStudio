import path from 'node:path';
import fs from 'node:fs';
import { renderStillPreviews } from '../src/modules/render/video-renderer.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';
import { Storyboard } from '../src/modules/contracts/storyboard.js';

async function main() {
  const outDir = path.resolve('media/runs/shop_workflow_preview');
  fs.mkdirSync(outDir, { recursive: true });

  const shopStoryboard: Storyboard = {
    topic: 'How Flash Sale E-Commerce Stores Handle 100k Orders Under 50ms',
    title: 'Flash Sale E-Commerce Architecture',
    hook: 'Flash Sale Hook',
    learningObjective: 'Understand how e-commerce stores handle flash sales with zero race conditions',
    scenes: [
      {
        id: 'scene-1',
        sceneIndex: 0,
        type: 'smartphoneMockup',
        narration: 'Maan lo Big Billion Day shuru hua aur last headphone par checkout price achanak surge ho gaya!',
        onScreenText: 'Flash Sale Surge • 100k Checkouts',
        technicalKeyPoint: 'E-Commerce Flash Sale Surge Trigger',
        durationTargetSec: 6,
        visualProps: {
          appCategory: 'shop',
          appName: 'AMAZON STORE',
          itemName: 'Sony WH-1000XM5 Wireless Headphones',
          itemPrice: '₹24,990',
          feeLabel: 'EXPRESS FLASH SALE SURCHARGE',
          baseDeliveryFee: '₹0',
          surgeDeliveryFee: '₹1,500',
          surgeMultiplier: '1.6X',
          surgeReason: 'FLASH SALE • 5,000+ BUYERS IN CART',
          algorithmName: 'Redis Distributed Mutex & Token Bucket',
          ctaText: 'BUY NOW WITH 1-CLICK',
        },
      },
      {
        id: 'scene-2',
        sceneIndex: 1,
        type: 'h3SpatialMap',
        narration: 'Pehle naive approach dekho: database mein physical rows lock karke scan karna.',
        onScreenText: 'Naive SQL Full-Table Scan • 650ms Contention',
        technicalKeyPoint: 'Full Disk Table Scan Bottleneck',
        durationTargetSec: 6,
        visualProps: {
          mode: 'naive-radius',
          title: 'Naive SQL Full-Table Inventory Scan',
          subtitle: 'Querying physical database rows per checkout causes 650ms lock contention',
          orderCount: 450,
          riderCount: 12,
        },
      },
      {
        id: 'scene-3',
        sceneIndex: 2,
        type: 'comparison',
        narration: 'Naive disk lock versus in-memory atomic token decrement.',
        onScreenText: 'Disk Lock vs In-Memory Atomic Token',
        technicalKeyPoint: 'Storage Layer Comparison',
        durationTargetSec: 6,
        visualProps: {
          leftTitle: 'Naive SQL Row Locking',
          leftCode: 'SELECT stock FROM inventory WHERE sku = 9982 FOR UPDATE;',
          leftPoints: [
            'Exclusive row locks on disk',
            'Connection pool exhaustion at 50k RPS',
            'Deadlock cascades across concurrent carts',
          ],
          rightTitle: 'In-Memory Atomic Decrement',
          rightCode: 'DECRBY stock:sku:9982 1',
          rightPoints: [
            'Sub-millisecond memory mutation',
            'Zero disk I/O lock contention',
            'Scales to 100,000+ checkout ops/sec',
          ],
          verdict: 'In-Memory Redis Token Bucket scales flash sales effortlessly',
        },
      },
      {
        id: 'scene-4',
        sceneIndex: 3,
        type: 'h3SpatialMap',
        narration: 'Warehouse fulfillment network ko partition kiya regional hubs mein.',
        onScreenText: 'Warehouse Fulfillment Mesh • O(1) Routing',
        technicalKeyPoint: 'Regional Fulfillment Partitioning',
        durationTargetSec: 6,
        visualProps: {
          mode: 'hex-grid',
          title: 'Warehouse Regional Fulfillment Mesh',
          subtitle: 'O(1) Regional partition narrows search from all hubs to nearest warehouse',
          hotHexId: '#HUB_DELHI_04',
          orderCount: 120,
          riderCount: 18,
          entityLabel: 'Cart Orders',
          providerLabel: 'Hub Stock',
          entityEmoji: '🛍️',
          providerEmoji: '🏬',
          surgeMultiplier: '2.4X',
        },
      },
      {
        id: 'scene-5',
        sceneIndex: 4,
        type: 'architecturePipeline',
        narration: 'Data pipeline stream client checkout se async payment worker tak aligned packets flow karti hai.',
        onScreenText: 'Laser Data Pipeline • Sub-Millisecond Stream',
        technicalKeyPoint: 'End-to-End Flash Sale Checkout Flow',
        durationTargetSec: 6,
        visualProps: {
          title: 'Flash Sale Checkout Pipeline',
          subtitle: 'High-throughput order reservation pipeline',
          steps: [
            { label: 'Store App', description: 'User clicks 1-Click Buy', status: 'completed' },
            { label: 'API Gateway', description: 'Rate limit & token bucket', status: 'completed' },
            { label: 'Redis Stock', description: 'Atomic stock decrement (DECRBY)', status: 'active' },
            { label: 'Kafka Stream', description: 'Async payment & invoice event', status: 'completed' },
          ],
        },
      },
      {
        id: 'scene-6',
        sceneIndex: 5,
        type: 'h3SpatialMap',
        narration: 'Agar kisi warehouse terminal ka network disconnect ho jaye toh stale node exclude ho jata hai.',
        onScreenText: 'Edge Case • Offline Warehouse Node Excluded',
        technicalKeyPoint: 'Stale Terminal Heartbeat Filter',
        durationTargetSec: 6,
        visualProps: {
          mode: 'stale-heartbeat',
          title: 'Edge Case: Offline Warehouse Terminal',
          subtitle: 'Disconnected warehouse node excluded from live stock fulfillment pool',
          hotHexId: '#HUB_OFFLINE',
          orderCount: 85,
          riderCount: 0,
          entityLabel: 'Pending Items',
          providerLabel: 'Offline Node',
          entityEmoji: '📦',
          providerEmoji: '🏪',
        },
      },
      {
        id: 'scene-7',
        sceneIndex: 6,
        type: 'raceCondition',
        narration: 'Do buyers ek hi aakhri item ke liye race karte hain.',
        onScreenText: 'Race Condition • Two Buyers For Last Item',
        technicalKeyPoint: 'Inventory Race Condition Mutex',
        durationTargetSec: 6,
        visualProps: {
          itemTitle: 'Last Available Headphones (Stock: 1)',
          user1Name: 'Buyer A (Mumbai)',
          user2Name: 'Buyer B (Bengaluru)',
          atomicQuery: 'SET lock:inventory:sku_99 "buyer_a_token" NX EX 5',
        },
      },
      {
        id: 'scene-8',
        sceneIndex: 7,
        type: 'queueTimeline',
        narration: 'Worker crash hone par Redis TTL lock auto-expire karta hai taaki system deadlock na ho.',
        onScreenText: 'Distributed Lock • TTL Lease Failover',
        technicalKeyPoint: 'Distributed Mutex TTL Expiry',
        durationTargetSec: 6,
        visualProps: {
          title: 'Distributed Lock Lease Lifecycle',
          mode: 'lock',
          items: [
            { name: '1. Lock Acquired by Worker A', priority: 'medium', detail: 'SET lock:inventory:sku_99 token_A NX EX 5' },
            { name: '2. Worker A Server Crashes', priority: 'high', detail: 'Worker ungracefully dies before committing order' },
            { name: '3. Redis Lease TTL Expiry (5s)', priority: 'high', detail: 'Distributed lock automatically freed by TTL' },
            { name: '4. Worker B Acquires Lock', priority: 'medium', detail: 'SET lock:inventory:sku_99 token_B NX EX 5 succeeds' },
          ],
        },
      },
    ],
  };

  const timeline = buildVideoTimeline(shopStoryboard, []);
  console.log('Rendering all 8 shop screens to high-res stills...');
  const previews = await renderStillPreviews(shopStoryboard, timeline, outDir);
  console.log(`Rendered ${previews.length} stills successfully to ${outDir}:`);
  for (const p of previews) {
    console.log(`- Scene ${p.sceneIndex} (${p.type}): ${p.filePath}`);
  }
}

main().catch((err) => {
  console.error('Render error:', err);
  process.exit(1);
});
