import { validateLesson } from './validate-lesson.js';
import { Storyboard, StoryboardSchema } from '../contracts/storyboard.js';
import { GeminiProvider } from './gemini-provider.js';
import { GroqProvider } from './groq-provider.js';

export function isCreatorScript(obj: any): boolean {
  return typeof obj === 'object' && obj !== null && (
    Boolean(obj.hook || obj.hooks) &&
    Boolean(obj.problem) &&
    Boolean(obj.solution)
  );
}

export interface DynamicReelContext {
  appName: string;
  appCategory: 'shop' | 'ecommerce' | 'delivery' | 'food' | 'ride' | 'fintech' | 'generic';
  itemName: string;
  itemPrice: string;
  baseDeliveryFee: string;
  surgeDeliveryFee: string;
  surgeMultiplier: string;
  surgeReason: string;
  auditRow1Label: string;
  auditRow1Value: string;
  auditRow2Label: string;
  auditRow2Value: string;
  auditRow3Label: string;
  auditRow3Value: string;
  auditQuestion: string;
  metricAName: string;
  metricACount: number;
  metricBName: string;
  metricBCount: number;
  deficitRatio: string;
  naiveTitle: string;
  naiveCode: string;
  naivePoints: string[];
  telemetryTitle: string;
  telemetryCode: string;
  telemetryPoints: string[];
  verdict: string;
  solutionTitle: string;
  solutionSubtitle: string;
  hotHexId: string;
  pipelineSteps: Array<{ label: string; description: string; status: 'completed' | 'active' | 'pending' }>;
  deepDiveStages: Array<{
    stagePill: string;
    stageTitle: string;
    card1Tag?: string;
    card1Title?: string;
    card1Desc?: string;
    card1Badge?: string;
    card2Tag?: string;
    card2Title?: string;
    card2Desc?: string;
    card2Badge?: string;
  }>;
  interviewPoints: string[];
  channelName: string;
  channelHandle: string;
}

export function extractDynamicReelContext(obj: any): DynamicReelContext {
  const fullText = `${obj.title || ''} ${obj.hook || ''} ${obj.problem || ''} ${obj.solution || ''} ${obj.tech_explained || ''}`.toLowerCase();

  // 1. Domain Detection
  const isFood = /food|zomato|swiggy|restaurant|biryani|meal|delivery/i.test(fullText);
  const isRide = /ride|cab|uber|ola|driver|traffic|fleet|dispatch/i.test(fullText);
  const isFintech = /upi|pay|payment|bank|wallet|money|stripe|razorpay/i.test(fullText);
  const appCategory = isFood ? 'food' : isRide ? 'ride' : isFintech ? 'fintech' : 'generic';

  // 2. App Name Extraction
  let appName = 'SYSTEM DESIGN';
  if (/zomato/i.test(fullText)) appName = 'ZOMATO';
  else if (/swiggy/i.test(fullText)) appName = 'SWIGGY';
  else if (/uber/i.test(fullText)) appName = 'UBER';
  else if (/ola/i.test(fullText)) appName = 'OLA';
  else if (/netflix/i.test(fullText)) appName = 'NETFLIX';
  else if (/upi|phonepe|gpay/i.test(fullText)) appName = 'BHIM UPI';
  else if (/whatsapp/i.test(fullText)) appName = 'WHATSAPP';
  else if (/redis/i.test(fullText)) appName = 'REDIS';
  else if (obj.title) {
    const firstWord = obj.title.trim().split(/\s+/)[0].toUpperCase();
    if (firstWord.length > 2) appName = firstWord;
  }

  // 3. Price & Multiplier Extraction
  const priceMatches = Array.from(String(obj.hook || '').matchAll(/[₹$]?\s*(\d+)/g))
    .map((m) => parseInt(m[1], 10))
    .filter((n) => n > 5 && n < 10000);

  let baseDeliveryFee = '₹30';
  let surgeDeliveryFee = '₹90';
  if (priceMatches.length >= 2) {
    baseDeliveryFee = `₹${priceMatches[0]}`;
    surgeDeliveryFee = `₹${priceMatches[1]}`;
  } else if (priceMatches.length === 1) {
    baseDeliveryFee = `₹${priceMatches[0]}`;
    surgeDeliveryFee = `₹${priceMatches[0] * 3}`;
  }
  const baseNum = parseInt(baseDeliveryFee.replace(/\D/g, ''), 10) || 30;
  const surgeNum = parseInt(surgeDeliveryFee.replace(/\D/g, ''), 10) || 90;
  const surgeMultiplier = `${(surgeNum / Math.max(1, baseNum)).toFixed(1)}X`;

  // Item details
  const itemName = isFood
    ? 'Food Delivery Order'
    : isRide
    ? 'City Cab Ride'
    : isFintech
    ? 'Instant Payment Transfer'
    : `${appName} Resource Request`;
  const itemPrice = isFood ? '₹350' : isRide ? '₹450' : isFintech ? '₹5,000' : '₹100';

  // Surge reason
  const surgeReason = /rain|बारिश/i.test(fullText)
    ? 'HEAVY RAIN DETECTED • HIGH DEMAND'
    : /traffic|peak|rush/i.test(fullText)
    ? 'PEAK HOUR TRAFFIC • HIGH DEMAND'
    : 'TRAFFIC SURGE • LOCAL DEFICIT';

  // 4. Audit Rows (Cut 0.2)
  const auditRow1Label = isFood ? '🏪 Restaurant' : isRide ? '🚗 Service' : isFintech ? '💳 Account' : '📦 Entity';
  const auditRow1Value = isFood ? `${itemName} (SAME) ✓` : 'SAME ✓';
  const auditRow2Label = isFood ? '🏠 Drop Location' : isRide ? '📍 Destination' : isFintech ? '🏦 Target Bank' : '📍 Destination';
  const auditRow2Value = isFood ? 'Indiranagar (SAME) ✓' : 'SAME ✓';
  const auditRow3Label = isFood ? '📏 Distance' : isRide ? '📏 Distance' : isFintech ? '🔒 Protocol' : '📏 Parameter';
  const auditRow3Value = isFood ? '3.2 KM (UNCHANGED) ✓' : 'UNCHANGED ✓';

  const auditQuestion = /extra\s*[₹$]?\s*\d+/i.test(obj.hook || '')
    ? `EXTRA +₹${surgeNum - baseNum} KAHAN SE AAYE? 🤔`
    : 'WHY DID THIS SUDDENLY SPIKE? 🤔';

  // 5. Problem Metrics (Scene 1)
  const ordersMatch = String(obj.problem || '').match(/(\d+)\s*(orders|requests|req|txns|queries|users)/i);
  const ridersMatch = String(obj.problem || '').match(/(\d+)\s*(riders|drivers|servers|nodes|workers|threads|connections)/i);
  const metricACount = ordersMatch ? parseInt(ordersMatch[1], 10) : 100;
  const metricAName = ordersMatch ? ordersMatch[2] : (isFood ? 'Orders' : isRide ? 'Rides' : 'Requests');
  const metricBCount = ridersMatch ? parseInt(ridersMatch[1], 10) : 20;
  const metricBName = ridersMatch ? ridersMatch[2] : (isFood ? 'Riders' : isRide ? 'Drivers' : 'Nodes');
  const deficitRatio = `${(metricACount / Math.max(1, metricBCount)).toFixed(1)}X DEFICIT`;

  const naiveTitle = isFood || isRide ? 'Distance-Only Model' : 'Synchronous Master Lock';
  const naiveCode = isFood || isRide ? 'fee = distance * ₹10' : 'SELECT * FOR UPDATE';
  const naivePoints = isFood || isRide
    ? ['Blind to sudden rainstorms', 'Fails to detect rider shortage', 'Zero incentive for riders to move']
    : ['Single thread bottleneck', 'Database connection starvation', 'High latency under peak traffic'];

  const telemetryTitle = isFood || isRide ? 'Real Demand Deficit' : 'Distributed In-Memory Telemetry';
  const telemetryCode = `ratio = ${metricACount} ${metricAName.toLowerCase()} / ${metricBCount} ${metricBName.toLowerCase()} = ${(metricACount / Math.max(1, metricBCount)).toFixed(1)}x`;
  const telemetryPoints = [
    `${metricACount} ${metricAName} vs ONLY ${metricBCount} ${metricBName}`,
    'City-wide search crashes database',
    'Requires local dynamic pricing signal',
  ];
  const verdict = 'Bottleneck: Static models fail during sudden demand spikes.';

  // 6. Solution Props (Scene 2)
  const solutionTitle = isFood || isRide ? 'LOCATION-BASED DYNAMIC PRICING' : 'DISTRIBUTED IN-MEMORY SHARDING';
  const solutionSubtitle = isFood || isRide
    ? 'Partitioning city into H3 hexagonal micro-zones'
    : 'Partitioning high-throughput state into in-memory clusters';
  const hotHexId = '#88619A0A4';
  const pipelineSteps: { label: string; description: string; status: 'completed' | 'active' | 'pending' }[] = [
    { label: 'Micro-Zones (H3)', description: 'Partition city into O(1) cells', status: 'completed' },
    { label: 'Live Telemetry', description: `Track ${metricACount} ${metricAName} vs ${metricBCount} ${metricBName}`, status: 'active' },
    { label: 'Pricing Engine', description: `Calculates dynamic fee = ₹${surgeNum}`, status: 'pending' },
  ];

  // 7. Tech Explained Stages (Scene 3)
  const deepDiveStages = [
    {
      stagePill: 'STAGE 1/5 • TELEMETRY INGESTION',
      stageTitle: 'Live Ingestion & Heartbeat Stream',
      card1Tag: 'CLIENT TELEMETRY STREAM',
      card1Title: 'GPS: 12.9352° N, 77.6245° E',
      card1Desc: 'Status: ACTIVE & AVAILABLE 🟢 (Ping interval: 5 seconds)',
      card1Badge: 'STREAMING',
      card2Tag: 'INGESTION GATEWAY',
      card2Title: 'Kafka Event Stream Buffer',
      card2Desc: '15,000+ driver heartbeats/second with sub-10ms processing latency',
      card2Badge: 'BUFFERED',
    },
    {
      stagePill: 'STAGE 2/5 • SPATIAL INDEXING & MESH',
      stageTitle: 'O(1) Spatial Hexagon Hashing',
      card1Tag: 'UBER H3 SPATIAL INDEXING',
      card1Title: 'h3.geoToH3(12.9352, 77.6245, res=8) ➔ "#88619A0A4"',
      card1Desc: 'Coordinates map to in-memory 64-bit integer Hex ID in O(1) time.',
      card1Badge: 'O(1) SPEED',
      card2Tag: 'HONEYCOMB PARTITION MESH',
      card2Title: 'Hex Cell #88619A0A4',
      card2Desc: '3.0X Surge Hotspot isolated from neighboring 1.0X normal cells.',
      card2Badge: 'ISOLATED',
    },
    {
      stagePill: 'STAGE 3/5 • IN-MEMORY CACHE STATE',
      stageTitle: 'Redis In-Memory Demand Telemetry',
      card1Tag: 'REDIS IN-MEMORY CACHE',
      card1Title: `Pending Orders: ${metricACount} | Available Riders: ${metricBCount}`,
      card1Desc: `Demand Ratio: ${metricACount} ÷ ${metricBCount} = ${(metricACount / Math.max(1, metricBCount)).toFixed(1)} Orders / Rider`,
      card1Badge: '< 1.8ms LATENCY',
      card2Tag: 'IMBALANCE ALERT',
      card2Title: 'Severe Local Deficit Detected',
      card2Desc: 'Surge multiplier triggered to balance fleet distribution.',
      card2Badge: 'DEFICIT ALERT',
    },
    {
      stagePill: 'STAGE 4/5 • PRICING ENGINE FORMULA',
      stageTitle: 'Dynamic Delivery Fee Calculation',
      card1Tag: 'PRICING ENGINE EVALUATION',
      card1Title: `Base Fee ₹${baseNum} + Rain ₹30 + Deficit ₹${surgeNum - baseNum - 30 > 0 ? surgeNum - baseNum - 30 : 30} = ₹${surgeNum}`,
      card1Desc: `Calculates dynamic surge fee of ₹${surgeNum} instantly under 50ms.`,
      card1Badge: `TOTAL: ₹${surgeNum}`,
      card2Tag: 'CUSTOMER APP CHECKOUT',
      card2Title: `Delivery Fee: ₹${surgeNum}`,
      card2Desc: 'App displays updated fee with real-time rain surge notification.',
      card2Badge: 'UPDATED',
    },
    {
      stagePill: 'STAGE 5/5 • GHOST RIDER EDGE CASE',
      stageTitle: 'Heartbeat Guard Against Ghost Riders',
      card1Tag: 'CRITICAL ARCHITECTURAL CATCH',
      card1Title: 'The "Ghost Rider" Stale Cache Bug',
      card1Desc: 'Rider goes offline in rain ➔ Old GPS remains cached in Redis!',
      card1Badge: 'BUG RISK',
      card2Tag: 'ENGINEERING SAFEGUARD',
      card2Title: 'Heartbeat TTL & Timestamp Verification',
      card2Desc: 'If (now - last_ping) > 30s ➔ Evict rider from Redis pool instantly.',
      card2Badge: 'VERIFIED ✅',
    },
  ];

  // 8. Cheat Sheet & CTA (Scene 4)
  const interviewPoints = [
    'Dynamic pricing is driven by supply-demand elasticity, not distance alone',
    'H3 spatial indexing converts coordinate lookups to O(1) hex IDs',
    'Heartbeat TTL guards against stale ghost rider caches in Redis',
  ];

  let channelName = 'Behind The Tech';
  let channelHandle = '@behindthestack';
  const channelMatch = String(obj.cta || '').match(/(Behind The Tech|code with \w+|\w+ tech)/i);
  if (channelMatch) {
    channelName = channelMatch[1].trim();
    channelHandle = `@${channelName.toLowerCase().replace(/\s+/g, '')}`;
  }

  return {
    appName,
    appCategory,
    itemName,
    itemPrice,
    baseDeliveryFee,
    surgeDeliveryFee,
    surgeMultiplier,
    surgeReason,
    auditRow1Label,
    auditRow1Value,
    auditRow2Label,
    auditRow2Value,
    auditRow3Label,
    auditRow3Value,
    auditQuestion,
    metricAName,
    metricACount,
    metricBName,
    metricBCount,
    deficitRatio,
    naiveTitle,
    naiveCode,
    naivePoints,
    telemetryTitle,
    telemetryCode,
    telemetryPoints,
    verdict,
    solutionTitle,
    solutionSubtitle,
    hotHexId,
    pipelineSteps,
    deepDiveStages,
    interviewPoints,
    channelName,
    channelHandle,
  };
}

function splitSentences(text: string): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.!?।])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

function chunkIntoCuts(sentences: string[], maxWords = 24): string[] {
  if (sentences.length === 0) return [];
  const cuts: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const s of sentences) {
    const words = s.split(/\s+/).filter(Boolean).length;
    if (current.length > 0 && currentWords >= 16 && currentWords + words > maxWords) {
      cuts.push(current.join(' '));
      current = [s];
      currentWords = words;
    } else {
      current.push(s);
      currentWords += words;
    }
  }
  if (current.length > 0) cuts.push(current.join(' '));
  return cuts;
}

export function convertCreatorScriptToStoryboard(obj: any, topicFallback = 'Custom Tech Reel'): Storyboard {
  const title = (obj.title || obj.topic || topicFallback).trim();
  const hook = (obj.hook || obj.hooks || '').trim();
  const problem = (obj.problem || '').trim();
  const solution = (obj.solution || '').trim();
  const techExplained = (obj.tech_explained || obj.tech || '').trim();
  const conclusion = (obj.conclusion || obj.summary || '').trim();
  const cta = (obj.cta || 'Behind The Tech ko abhi follow karo!').trim();

  const shortTitle = title.length > 36
    ? title.split(/\s+/).slice(0, 5).join(' ').toUpperCase()
    : title.toUpperCase();

  const fullText = `${title} ${hook} ${problem} ${solution} ${techExplained}`.toLowerCase();
  
  // Stricter domain detection so general tech scripts aren't misclassified as food surge
  const priceMatches = Array.from(String(hook).matchAll(/[₹$]?\s*(\d+)/g))
    .map((m) => parseInt(m[1], 10))
    .filter((n) => n > 5 && n < 10000);

  const isSurge = (/zomato|swiggy|delivery\s*(?:charge|fee)|surge\s*pricing/i.test(fullText) || (/uber|ola/i.test(fullText) && /surge|pricing|fare/i.test(fullText))) && priceMatches.length >= 2;
  const isRedis = /redis|lock|redlock|mutex|distributed lock|concurrency|race condition|double booking/i.test(fullText);
  const isKafka = /kafka|consumer|partition|broker|rebalance|topic|offset/i.test(fullText);
  const isDatabase = /database|postgres|mysql|sqlite|mvcc|vacuum|dead tuple|table bloat|index|btree/i.test(fullText);

  const ctx = extractDynamicReelContext(obj);

  // Dynamic sentence chunks per section with balanced retention pacing (~30-40 words per cut)
  const hookCuts = chunkIntoCuts(splitSentences(hook), 45);
  const problemCuts = chunkIntoCuts(splitSentences(problem), 35);
  const solutionCuts = chunkIntoCuts(splitSentences(solution), 35);
  const techCuts = chunkIntoCuts(splitSentences(techExplained), 32);
  const conclusionCuts = chunkIntoCuts(splitSentences(conclusion), 45);
  const ctaCuts = chunkIntoCuts(splitSentences(cta), 45);

  const rawScenes: Array<{
    section: 'hook' | 'problem' | 'solution' | 'tech' | 'conclusion' | 'cta';
    narration: string;
    subIndex: number;
    totalSub: number;
  }> = [];

  hookCuts.forEach((n, i) => rawScenes.push({ section: 'hook', narration: n, subIndex: i, totalSub: hookCuts.length }));
  problemCuts.forEach((n, i) => rawScenes.push({ section: 'problem', narration: n, subIndex: i, totalSub: problemCuts.length }));
  solutionCuts.forEach((n, i) => rawScenes.push({ section: 'solution', narration: n, subIndex: i, totalSub: solutionCuts.length }));
  techCuts.forEach((n, i) => rawScenes.push({ section: 'tech', narration: n, subIndex: i, totalSub: techCuts.length }));
  conclusionCuts.forEach((n, i) => rawScenes.push({ section: 'conclusion', narration: n, subIndex: i, totalSub: conclusionCuts.length }));
  ctaCuts.forEach((n, i) => rawScenes.push({ section: 'cta', narration: n, subIndex: i, totalSub: ctaCuts.length }));

  if (rawScenes.length === 0) {
    rawScenes.push({ section: 'hook', narration: hook || title, subIndex: 0, totalSub: 1 });
  }

  // 2. Map every chunk dynamically to an engaging, non-repeating visual component
  let lastAssignedType = '';

  const scenes: Storyboard['scenes'] = rawScenes.map((item, idx) => {
    const textLower = item.narration.toLowerCase();
    let type: Storyboard['scenes'][number]['type'] = 'architecturePipeline';
    let onScreenText = shortTitle;
    let technicalKeyPoint = 'Architecture Breakdown';
    let visualProps: Record<string, any> = {};

    if (item.section === 'hook') {
      if (item.subIndex === 0 && isSurge) {
        type = 'smartphoneMockup';
        onScreenText = `${ctx.baseDeliveryFee} VS ${ctx.surgeDeliveryFee}? • SURGE PRICING`;
        technicalKeyPoint = 'Client Dynamic Pricing Anomaly';
        visualProps = {
          headline: onScreenText,
          subtext: ctx.surgeReason,
          appName: ctx.appName,
          appCategory: ctx.appCategory,
          itemName: ctx.itemName,
          itemPrice: ctx.itemPrice,
          baseDeliveryFee: ctx.baseDeliveryFee,
          surgeDeliveryFee: ctx.surgeDeliveryFee,
          surgeMultiplier: ctx.surgeMultiplier,
          surgeReason: ctx.surgeReason,
          ctaText: `LIVE ANOMALY • ${ctx.appName}`,
        };
      } else {
        type = 'hook';
        onScreenText = shortTitle;
        technicalKeyPoint = 'The Engineering Mystery';
        visualProps = {
          headline: shortTitle,
          questionKicker: item.narration.slice(0, 110),
          badgeText: isRedis ? 'CONCURRENCY BUG' : isSurge ? 'DYNAMIC PRICING' : isKafka ? 'STREAMING PUZZLE' : isDatabase ? 'DATABASE INTERNALS' : 'SYSTEM DESIGN',
          accentColor: '#00F2FE',
        };
      }
    } else if (item.section === 'problem') {
      if (item.subIndex === 0) {
        if (/race\s*condition|concurrency|simultaneous|double\s*booking|last\s*seat|conflict/i.test(textLower) || isRedis) {
          type = 'raceCondition';
          onScreenText = 'RACE CONDITION DETECTED';
          technicalKeyPoint = 'Two Workers Competing for Same Mutex';
          visualProps = {
            title: 'CONCURRENCY COLLISION',
            itemTitle: 'Concert Seat #123 (Stock = 1)',
            user1Name: 'User A (Worker 1)',
            user2Name: 'User B (Worker 2)',
            atomicQuery: 'SET lock:seat_123 uuid NX PX 10000;',
            onScreenText: 'Simultaneous Requests Collision',
          };
        } else {
          type = 'comparison';
          onScreenText = `${ctx.metricACount} ${ctx.metricAName.toUpperCase()} vs ${ctx.metricBCount} ${ctx.metricBName.toUpperCase()}`;
          technicalKeyPoint = 'Static Model Breakdown Under Peak Traffic';
          visualProps = {
            leftTitle: ctx.naiveTitle,
            leftCode: ctx.naiveCode,
            leftPoints: ctx.naivePoints,
            rightTitle: ctx.telemetryTitle,
            rightCode: ctx.telemetryCode,
            rightPoints: ctx.telemetryPoints,
            verdict: ctx.verdict,
            metricAName: ctx.metricAName,
            metricACount: ctx.metricACount,
            metricBName: ctx.metricBName,
            metricBCount: ctx.metricBCount,
            deficitRatio: ctx.deficitRatio,
          };
        }
      } else {
        type = 'comparison';
        onScreenText = 'DATABASE OVERLAP ANOMALY';
        technicalKeyPoint = 'Unsynchronised Decrement Leads to -1 Stock';
        visualProps = {
          leftTitle: 'Request 1 (User A)',
          leftCode: 'SELECT stock -> 1\nUPDATE stock = 0',
          leftPoints: ['Reads stock = 1 before commit', 'Proceeds with checkout'],
          rightTitle: 'Request 2 (User B)',
          rightCode: 'SELECT stock -> 1\nUPDATE stock = -1',
          rightPoints: ['Reads stale stock = 1 in parallel', 'Result: Double Booking Overlap!'],
          verdict: 'Result: Seat count drops below zero without a mutex.',
        };
      }
    } else if (item.section === 'solution') {
      if (item.subIndex === 0) {
        if (isSurge) {
          type = 'h3SpatialMap';
          onScreenText = ctx.solutionTitle;
          technicalKeyPoint = 'O(1) Spatial Hexagon Partitioning';
          visualProps = {
            title: ctx.solutionTitle,
            subtitle: ctx.solutionSubtitle,
            hotHexId: ctx.hotHexId,
            orderCount: ctx.metricACount,
            riderCount: ctx.metricBCount,
            surgeMultiplier: ctx.surgeMultiplier,
            mode: 'hex-grid',
            entityLabel: ctx.metricAName,
            providerLabel: ctx.metricBName,
          };
        } else {
          type = 'architecturePipeline';
          onScreenText = 'DISTRIBUTED LOCK ARCHITECTURE';
          technicalKeyPoint = 'Single Mutex In-Memory Coordination';
          visualProps = {
            title: 'DISTRIBUTED MUTEX PATTERN',
            subtitle: 'Only one worker can hold the key',
            redisLatencyMs: 1.2,
            steps: [
              { label: '1. Acquire Key', description: 'SET NX conditional atomic write', status: 'active' },
              { label: '2. Exclusive Hold', description: 'Worker holds mutex resource', status: 'completed' },
              { label: '3. DB Mutation', description: 'Safely decrement stock in DB', status: 'pending' },
            ],
          };
        }
      } else {
        type = 'requestFlow';
        onScreenText = 'EXCLUSIVE MUTEX ACCESS';
        technicalKeyPoint = 'Competing Workers Queued or Rejected';
        visualProps = {
          title: 'PARALLEL REQUEST COORDINATION',
          steps: [
            { label: 'User A Request', description: 'Lock acquired • 200 OK', status: 'completed' },
            { label: 'User B Request', description: 'Key held • Blocked / Rejected', status: 'active' },
            { label: 'Database Integrity', description: 'Stock decremented exactly once', status: 'pending' },
          ],
        };
      }
    } else if (item.section === 'tech') {
      if (/set\s*(?:seat|lock|nx|px)|px\s*\d+|command|nx|code|syntax|query|lua/i.test(textLower)) {
        type = 'code';
        onScreenText = 'ATOMIC REDIS COMMAND';
        technicalKeyPoint = 'SET lock_id unique_token NX PX 10000';
        visualProps = {
          filename: 'redis_mutex.ts',
          code: 'const acquired = await redis.set(\n  `lock:seat_123`,\n  workerToken,\n  "NX",\n  "PX", 10000\n);',
          highlightLines: [2, 3, 4],
          terminalOutputs: [
            { text: '> SET lock:seat_123 9a2b NX PX 10000', badge: 'REDIS', highlight: true },
            { text: 'OK (Lock acquired in 1.2ms)', badge: 'SUCCESS' },
          ],
          explanationCallout: 'NX = only if not exists • PX = 10s auto-expiry',
        };
      } else if (/offline|stale|ghost|crash|deadlock|timeout|ttl|expire|catch/i.test(textLower)) {
        type = 'queueTimeline';
        onScreenText = 'CRITICAL DEADLOCK SAFEGUARD';
        technicalKeyPoint = 'Auto-Expiry TTL Prevents Deadlocks';
        visualProps = {
          title: 'LEASE AUTO-EXPIRY & RECOVERY',
          items: [
            { name: '1. Lock Acquired', detail: 'Worker holds mutex with 10s TTL' },
            { name: '2. Worker Node Crashes', detail: 'Server dies before manual lock release' },
            { name: '3. Redis Evicts Key', detail: 'TTL auto-expires in memory after 10s' },
            { name: '4. Deadlock Averted', detail: 'Resource unblocked for subsequent workers' },
          ],
          activeItemIndex: 2,
        };
      } else if (/gps|heartbeat|stream|ingestion|app sends|telemetry|confirm|booking/i.test(textLower)) {
        type = 'requestFlow';
        onScreenText = 'ATOMIC EXECUTION FLOW';
        technicalKeyPoint = 'Client State Transition';
        visualProps = {
          title: 'DISTRIBUTED EXECUTION LIFECYCLE',
          steps: [
            { label: 'Acquire Mutex', status: 'completed' },
            { label: 'Execute Critical Section', status: 'active' },
            { label: 'Release / Auto-Expire', status: 'pending' },
          ],
        };
      } else {
        type = 'architecturePipeline';
        onScreenText = 'IN-MEMORY CACHE & ENGINE';
        technicalKeyPoint = 'Sub-Millisecond Pipeline State';
        visualProps = {
          title: 'DISTRIBUTED ENGINE ARCHITECTURE',
          subtitle: 'In-memory coordination & sub-millisecond execution',
          redisLatencyMs: 1.5,
          steps: [
            { label: 'Client Ingestion', description: 'Incoming reservation requests', status: 'completed' },
            { label: 'In-Memory Mutex', description: 'Atomic SET NX coordination', status: 'active' },
            { label: 'Relational DB', description: 'Guaranteed durable write', status: 'pending' },
          ],
        };
      }

      // Avoid repeating the exact same type as previous cut
      if (type === lastAssignedType) {
        if (type === 'architecturePipeline') type = 'requestFlow';
        else if (type === 'code') type = 'queueTimeline';
      }
    } else if (item.section === 'conclusion') {
      type = 'summary';
      onScreenText = 'CORE ARCHITECTURAL TAKEAWAY';
      technicalKeyPoint = 'Concurrency Synchronization';
      visualProps = {
        headline: 'SENIOR SDE MENTAL MODEL',
        takeaways: [
          'State should be guarded in-memory with atomic primitives (SET NX)',
          'All locks MUST carry an auto-expiring TTL lease to prevent deadlocks',
          'Eliminating race conditions protects database consistency under load',
        ],
        callToAction: cta,
      };
    } else {
      type = 'tradeoffHUD';
      onScreenText = 'TAKE SCREENSHOT';
      technicalKeyPoint = 'System Design SDE Cheat-Sheet';
      visualProps = {
        title: 'SDE INTERVIEW CHEAT-SHEET',
        subtitle: 'Defend this architecture in your interviews',
        interviewPoints: [
          'Use Redis SET NX PX for single-instance distributed locking',
          'Always supply a unique worker token for safe release verification',
          'Configure safety TTL based on max P99 critical section execution time',
          'Use Redlock algorithm if synchronizing across multiple Redis masters',
        ],
        callToAction: cta,
        channelName: ctx.channelName,
        channelHandle: ctx.channelHandle,
      };
    }

    lastAssignedType = type;

    const words = item.narration.trim().split(/\s+/).filter(Boolean).length;
    const durationTargetSec = Math.max(3, Math.min(20, Math.round(words / 2.35)));

    return {
      id: `scene-${idx + 1}`,
      sceneIndex: idx,
      type,
      narration: item.narration,
      onScreenText,
      technicalKeyPoint,
      durationTargetSec,
      visualProps,
    };
  });

  const totalDurationSec = scenes.reduce((acc, s) => acc + s.durationTargetSec, 0);

  return {
    topic: title,
    title,
    hook,
    learningObjective: `${shortTitle} • Dynamic System Design Breakdown`,
    targetAudience: 'Developers & CS students',
    format: 'short',
    estimatedDurationSec: totalDurationSec,
    hashtags: ['#systemdesign', '#backend', '#shorts'],
    scenes,
  };
}

export async function parseCustomScriptToStoryboard(
  rawInput: string | Record<string, any>,
  topicFallback = 'Custom Tech Reel'
): Promise<Storyboard> {
  // 1. Direct creator script check (Zero LLM, 100% deterministic)
  if (typeof rawInput === 'object' && rawInput !== null) {
    if (isCreatorScript(rawInput)) {
      return convertCreatorScriptToStoryboard(rawInput, topicFallback);
    }
    const validated = StoryboardSchema.safeParse(rawInput);
    if (validated.success) {
      try {
        return validateLesson(validated.data);
      } catch {
        return validated.data;
      }
    }
  }

  let parsedJson: unknown;
  try {
    if (typeof rawInput === 'string') {
      parsedJson = JSON.parse(rawInput);
    }
  } catch {
    // Free-form narration is structured below.
  }
  if (parsedJson !== undefined) {
    if (isCreatorScript(parsedJson)) {
      return convertCreatorScriptToStoryboard(parsedJson, topicFallback);
    }
    const validated = StoryboardSchema.safeParse(parsedJson);
    if (validated.success) {
      try {
        return validateLesson(validated.data);
      } catch {
        return validated.data;
      }
    }
  }

  const scriptText = typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput);

  // 2. Use LLM to structure user's custom script into our precise 4-scene Storyboard
  const systemPrompt = `You are an expert technical director converting a user's ChatGPT reel script into a structured JSON Storyboard.
Preserve the user's words and chronology. Identify the concrete question and its resolution.
Use a labelled requestFlow with 2–4 steps {label, description, cue} to show a mechanism;
cue must be a phrase spoken in this scene. Use a queueTimeline with items {name,detail}
for ordered states. Use code when the script supplies a snippet. End with a summary
showing the result and why it follows. Never add unrelated examples, code or claims.
3. Return ONLY pure JSON matching this exact structure:
{
  "topic": string,
  "title": string,
  "hook": string,
  "learningObjective": string,
  "targetAudience": string,
  "format": "short",
  "estimatedDurationSec": 50,
  "hashtags": ["#systemdesign", "#techshorts"],
  "scenes": [
    {
      "id": "scene-1",
      "sceneIndex": 0,
      "type": "hook",
      "narration": "Exact user narration text",
      "onScreenText": "3-5 word headline",
      "technicalKeyPoint": "Key point",
      "durationTargetSec": 10,
      "visualProps": {
        "headline": "...",
        "badgeText": "SYSTEM DESIGN"
      }
    }
  ]
}`;

  const prompt = `Convert this user-provided script into the JSON format:
${scriptText}`;

  // Try Gemini Flash first (fastest)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const gemini = new GeminiProvider(geminiKey, process.env.GEMINI_MODEL || 'gemini-2.5-flash');
      const response = await gemini.generateJSON(prompt, systemPrompt);
      const cleaned = response.replace(/^```json/m, '').replace(/^```/m, '').replace(/```$/m, '').trim();
      const obj = JSON.parse(cleaned);
      const validated = StoryboardSchema.safeParse(obj);
      if (validated.success) {
        try {
          return validateLesson(validated.data);
        } catch {
          return validated.data;
        }
      }
    } catch (e: any) {
      console.warn('Gemini script parser failed; falling back to Groq:', e.message);
    }
  }

  // Fallback to Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const groq = new GroqProvider(groqKey, process.env.GROQ_MODEL || 'qwen/qwen3.8-27b');
    const response = await groq.generateJSON(prompt, systemPrompt);
    const cleaned = response.replace(/^```json/m, '').replace(/^```/m, '').replace(/```$/m, '').trim();
    const obj = JSON.parse(cleaned);
    const validated = StoryboardSchema.safeParse(obj);
    if (validated.success) {
      try {
        return validateLesson(validated.data);
      } catch {
        return validated.data;
      }
    }
  }

  throw new Error('Could not parse user script into valid Storyboard.');
}
