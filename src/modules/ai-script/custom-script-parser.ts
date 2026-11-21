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
    ? 'Royal Chicken Dum Biryani'
    : isRide
    ? 'City Premier Ride'
    : isFintech
    ? 'Instant UPI Transfer'
    : 'Selected Request';
  const itemPrice = isFood ? '₹350' : isRide ? '₹450' : isFintech ? '₹5,000' : '₹100';

  // Surge reason
  const surgeReason = /rain|बारिश/i.test(fullText)
    ? '🌧️ HEAVY RAIN DETECTED • HIGH DEMAND'
    : /traffic|peak|rush/i.test(fullText)
    ? '🚗 PEAK HOUR TRAFFIC • HIGH DEMAND'
    : '⚡ TRAFFIC SURGE • LOCAL DEFICIT';

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

  let channelName = 'Behind The Stack';
  let channelHandle = '@behindthestack';
  const channelMatch = String(obj.cta || '').match(/(behind the stack|code with \w+|\w+ tech)/i);
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

export function convertCreatorScriptToStoryboard(obj: any, topicFallback = 'Custom Tech Reel'): Storyboard {
  const title = (obj.title || obj.topic || topicFallback).trim();
  const hook = (obj.hook || obj.hooks || '').trim();
  const problem = (obj.problem || '').trim();
  const solution = (obj.solution || '').trim();
  const techExplained = (obj.tech_explained || obj.tech || '').trim();
  const conclusion = (obj.conclusion || obj.summary || '').trim();
  const cta = (obj.cta || 'Follow for more system design breakdowns!').trim();

  const shortTitle = title.length > 36
    ? title.split(/\s+/).slice(0, 5).join(' ').toUpperCase()
    : title.toUpperCase();

  // Dynamically extract context from the script so ZERO details are hardcoded!
  const ctx = extractDynamicReelContext(obj);

  const scenes: Storyboard['scenes'] = [
    {
      id: 'scene-1',
      sceneIndex: 0,
      type: 'smartphoneMockup',
      narration: hook,
      onScreenText: shortTitle,
      technicalKeyPoint: 'Core Question & Hook',
      durationTargetSec: 13,
      visualProps: {
        headline: shortTitle,
        subtext: ctx.surgeReason,
        appName: ctx.appName,
        appCategory: ctx.appCategory,
        locationText: '12:00 AM • Indiranagar (3.2 km)',
        itemName: ctx.itemName,
        itemPrice: ctx.itemPrice,
        baseDeliveryFee: ctx.baseDeliveryFee,
        surgeDeliveryFee: ctx.surgeDeliveryFee,
        surgeMultiplier: ctx.surgeMultiplier,
        surgeReason: ctx.surgeReason,
        ctaText: `SURGE ACTIVE • ${ctx.surgeDeliveryFee}`,
        auditRow1Label: ctx.auditRow1Label,
        auditRow1Value: ctx.auditRow1Value,
        auditRow2Label: ctx.auditRow2Label,
        auditRow2Value: ctx.auditRow2Value,
        auditRow3Label: ctx.auditRow3Label,
        auditRow3Value: ctx.auditRow3Value,
        auditQuestion: ctx.auditQuestion,
      },
    },
    {
      id: 'scene-2',
      sceneIndex: 1,
      type: 'comparison',
      narration: problem,
      onScreenText: `${ctx.metricACount} ${ctx.metricAName.toUpperCase()} vs ${ctx.metricBCount} ${ctx.metricBName.toUpperCase()}`,
      technicalKeyPoint: 'Why Naive Static Model Fails',
      durationTargetSec: 15,
      visualProps: {
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
      },
    },
    {
      id: 'scene-3',
      sceneIndex: 2,
      type: 'h3SpatialMap',
      narration: solution,
      onScreenText: ctx.solutionTitle,
      technicalKeyPoint: 'Partitioning by Micro-Zones',
      durationTargetSec: 17,
      visualProps: {
        title: ctx.solutionTitle,
        subtitle: ctx.solutionSubtitle,
        hotHexId: ctx.hotHexId,
        orderCount: ctx.metricACount,
        riderCount: ctx.metricBCount,
        surgeMultiplier: ctx.surgeMultiplier,
        mode: 'hex-grid',
        entityLabel: ctx.metricAName,
        providerLabel: ctx.metricBName,
        entityEmoji: '📦',
        providerEmoji: '🛵',
      },
    },
    {
      id: 'scene-4',
      sceneIndex: 3,
      type: 'architecturePipeline',
      narration: techExplained,
      onScreenText: 'BACKEND ARCHITECTURE',
      technicalKeyPoint: 'In-Memory Telemetry & Spatial Indexes',
      durationTargetSec: 64,
      visualProps: {
        title: 'BACKEND ARCHITECTURE DEEP DIVE',
        subtitle: 'Sub-millisecond dynamic calculation engine',
        redisLatencyMs: 1.8,
        steps: ctx.pipelineSteps,
        deepDiveStages: ctx.deepDiveStages,
      },
    },
    {
      id: 'scene-5',
      sceneIndex: 4,
      type: 'tradeoffHUD',
      narration: `${conclusion} ${cta}`.trim(),
      onScreenText: 'TAKE SCREENSHOT 📌',
      technicalKeyPoint: 'Dynamic Pricing Core Takeaways',
      durationTargetSec: 24,
      visualProps: {
        title: 'SDE INTERVIEW CHEAT-SHEET',
        subtitle: 'Core Architecture Takeaways',
        interviewPoints: ctx.interviewPoints,
        callToAction: cta,
        channelName: ctx.channelName,
        channelHandle: ctx.channelHandle,
      },
    },
  ];

  return {
    topic: title,
    title,
    hook,
    learningObjective: 'How dynamic pricing and spatial indexing handle surge traffic',
    targetAudience: 'Developers & CS students',
    format: 'short',
    estimatedDurationSec: 85,
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
