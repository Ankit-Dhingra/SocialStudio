import { z } from 'zod';

export const SceneTypeEnum = z.enum([
  'hook',
  'code',
  'requestFlow',
  'queueTimeline',
  'comparison',
  'collection',
  'raceCondition',
  'summary',
  'smartphoneMockup',
  'h3SpatialMap',
  'architecturePipeline',
  'tradeoffHUD',
]);

export type SceneType = z.infer<typeof SceneTypeEnum>;

// Guardrail: Rejects raw serialized JSON objects, forcing human-readable titles
export const HumanReadableText = z
  .string()
  .min(3)
  .max(120)
  .refine((val) => !val.trim().startsWith('{') && !val.trim().startsWith('['), {
    message: 'onScreenText must be human-readable text, never a serialized JSON object.',
  })
  .refine((val) => !/"(text|position|color|size|delay|type|id)":/i.test(val), {
    message: 'onScreenText cannot contain raw JSON key-value pairs.',
  });

// Specific Typed Visual Props Schemas
export const HookPropsSchema = z.object({
  headline: z.string().default('TECH EXPLAINED'),
  questionKicker: z.string().default('How does the architecture work under the hood?'),
  badgeText: z.string().default('SYSTEM DESIGN'),
  accentColor: z.string().default('#00F2FE'),
  misconceptionAlert: z.string().optional(),
});

export const CodeWalkthroughPropsSchema = z.object({
  filename: z.string().default('example.ts'),
  language: z.enum(['javascript', 'typescript', 'python', 'sql', 'bash', 'json']).default('typescript'),
  code: z.string().default('console.log("Hello, World!");'),
  highlightLines: z.array(z.number()).default([1]),
  terminalOutputs: z.array(z.object({
    text: z.string(),
    badge: z.string().optional(),
    delayFrames: z.number().optional(),
    highlight: z.boolean().optional(),
  })).optional(),
  explanationCallout: z.string().default('Key line execution'),
});

export const RequestFlowPropsSchema = z.object({
  title: z.string().default('Request Pipeline Flow'),
  steps: z
    .array(
      z.object({
        label: z.string(),
        description: z.string(),
        cue: z.string().optional(),
        status: z.enum(['active', 'completed', 'bypassed', 'cached']).default('active'),
      })
    )
    .min(2)
    .max(5)
    .default([
      { label: 'Client', description: 'Initial request', status: 'active' },
      { label: 'Server', description: 'Execution', status: 'active' },
    ]),
});

export const QueueTimelinePropsSchema = z.object({
  title: z.string().default('Queue Timeline Processing'),
  items: z
    .array(
      z.object({
        name: z.string(),
        priority: z.enum(['high', 'medium', 'low', 'microtask', 'macrotask']).default('medium'),
        detail: z.string(),
        cue: z.string().optional(),
      })
    )
    .min(2)
    .max(5)
    .default([
      { name: 'Microtasks', priority: 'high', detail: 'Priority execution' },
      { name: 'Macrotasks', priority: 'medium', detail: 'Next loop tick' },
    ]),
  activeItemIndex: z.number().default(0),
});

export const CollectionPropsSchema = z.object({
  title: z.string().min(1).default('System Components'),
  items: z
    .array(z.object({ label: z.string().min(1), selected: z.boolean().default(false) }))
    .min(2)
    .max(12)
    .default([
      { label: 'API Gateway', selected: true },
      { label: 'Redis Cache', selected: false },
    ]),
  cue: z.string().default('Components'),
  result: z.string().default('Unified System'),
});

export const ComparisonPropsSchema = z.object({
  leftTitle: z.string().default('Naive Approach'),
  leftCode: z.string().default('SELECT * FROM seats WHERE id = 1'),
  leftPoints: z.array(z.string()).min(1).max(4).default(['Direct database read', 'Race condition on write']),
  rightTitle: z.string().default('Atomic Distributed Lock'),
  rightCode: z.string().default('SET lock:seat_101 user_id NX EX 10'),
  rightPoints: z.array(z.string()).min(1).max(4).default(['Atomic single-turn guarantee', 'Guaranteed lock release on crash']),
  verdict: z.string().default('Winner: Atomic Distributed Lock'),
});

export const SummaryPropsSchema = z.object({
  headline: z.string().default('Mental Model Recap'),
  takeaways: z.array(z.string()).min(2).max(4).default([
    'Atomic commands eliminate concurrency bugs',
    'TTL expiration prevents server-crash deadlocks',
  ]),
  callToAction: z.string().default('Follow for more senior backend engineering breakdowns!'),
});

export const RaceConditionPropsSchema = z.object({
  title: z.string().default('CONCURRENCY • RACE CONDITION'),
  itemTitle: z.string().default('Concert Seat 101 (Stock: 1)'),
  user1Name: z.string().default('You'),
  user2Name: z.string().default('Friend'),
  atomicQuery: z.string().default('UPDATE seats SET stock = 0 WHERE id = 101 AND stock > 0;'),
  user1Timestamp: z.string().default('19:00:00.120'),
  user2Timestamp: z.string().default('19:00:00.124'),
});

export const SmartphoneMockupPropsSchema = z.object({
  headline: z.string().default('HOW APPS HANDLE HIGH DEMAND'),
  subtext: z.string().default('Dynamic pricing and inventory reservation'),
  appName: z.string().default('ZOMATO'),
  locationText: z.string().default('HSR Layout, Sector 4'),
  itemName: z.string().default('Royal Chicken Dum Biryani'),
  itemPrice: z.string().default('₹380'),
  surgeAmount: z.string().default('+₹50'),
  surgeMultiplier: z.string().default('1.8X'),
  baseDeliveryFee: z.string().default('₹30'),
  surgeDeliveryFee: z.string().default('₹80'),
  surgeReason: z.string().default('HIGH DEMAND • 120+ ACTIVE ORDERS'),
});

export const H3SpatialMapPropsSchema = z.object({
  title: z.string().default('GEOSPATIAL H3 INDEXING'),
  subtitle: z.string().default('O(1) Hexagonal lookup narrows query radius'),
  hexResolution: z.number().default(8),
  activeHexCount: z.number().default(14),
  demandCount: z.number().default(40),
  supplyCount: z.number().default(10),
  hotHexId: z.string().default('#88619A0A4'),
  orderCount: z.number().default(52),
  riderCount: z.number().default(5),
  surgeMultiplier: z.string().default('1.8X'),
});

export const ArchitecturePipelinePropsSchema = z.object({
  title: z.string().default('DISTRIBUTED ARCHITECTURE PIPELINE'),
  subtitle: z.string().default('In-memory coordination prevents database race conditions'),
  redisLatencyMs: z.number().default(4),
  atomicCommand: z.string().default('SET lock:seat_101 user_A NX EX 10'),
});

export const TradeoffHUDPropsSchema = z.object({
  title: z.string().default('SENIOR SDE TRADEOFF MATRIX'),
  subtitle: z.string().default('Which architecture strategy would you defend in an interview?'),
  optionA_Title: z.string().default('OPTION A: SHORT TTL (5-10s)'),
  optionA_Pros: z.string().default('Quick crash recovery, minimal deadlock time'),
  optionA_Cons: z.string().default('Premature expiry risk if latency spikes'),
  optionB_Title: z.string().default('OPTION B: LONG TTL (60s+)'),
  optionB_Pros: z.string().default('Guaranteed protection for complex transactions'),
  optionB_Cons: z.string().default('Prolonged deadlocks if server dies'),
  interviewPoints: z.array(z.string()).min(1).max(5).default([
    'Acquire lock atomically using SET NX EX with unique client token',
    'Release lock safely via Lua script verifying token ownership',
    'Use TTL to guard against process crashes and network partitions',
  ]),
  callToAction: z.string().default('Save this reel for your System Design Interview & follow for more!'),
});

// Discriminated Union of Strict Scene Schemas
export const HookSceneSchema = z.object({
  id: z.string(),
  sceneIndex: z.number().int().min(0),
  type: z.literal('hook'),
  narration: z.string().min(10),
  spokenNarration: z.string().trim().min(1).optional(),
  onScreenText: HumanReadableText,
  technicalKeyPoint: z.string(),
  durationTargetSec: z.number().min(1).max(60).default(6),
  visualProps: HookPropsSchema.prefault({}),
});

export const CodeWalkthroughSceneSchema = z.object({
  id: z.string(),
  sceneIndex: z.number().int().min(0),
  type: z.literal('code'),
  narration: z.string().min(10),
  spokenNarration: z.string().trim().min(1).optional(),
  onScreenText: HumanReadableText,
  technicalKeyPoint: z.string(),
  durationTargetSec: z.number().min(1).max(60).default(8),
  visualProps: CodeWalkthroughPropsSchema.prefault({}),
});

export const RequestFlowSceneSchema = z.object({
  id: z.string(),
  sceneIndex: z.number().int().min(0),
  type: z.literal('requestFlow'),
  narration: z.string().min(10),
  spokenNarration: z.string().trim().min(1).optional(),
  onScreenText: HumanReadableText,
  technicalKeyPoint: z.string(),
  durationTargetSec: z.number().min(1).max(60).default(8),
  visualProps: RequestFlowPropsSchema.prefault({}),
});

export const QueueTimelineSceneSchema = z.object({
  id: z.string(),
  sceneIndex: z.number().int().min(0),
  type: z.literal('queueTimeline'),
  narration: z.string().min(10),
  spokenNarration: z.string().trim().min(1).optional(),
  onScreenText: HumanReadableText,
  technicalKeyPoint: z.string(),
  durationTargetSec: z.number().min(1).max(60).default(8),
  visualProps: QueueTimelinePropsSchema.prefault({}),
});

export const ComparisonSceneSchema = z.object({
  id: z.string(),
  sceneIndex: z.number().int().min(0),
  type: z.literal('comparison'),
  narration: z.string().min(10),
  spokenNarration: z.string().trim().min(1).optional(),
  onScreenText: HumanReadableText,
  technicalKeyPoint: z.string(),
  durationTargetSec: z.number().min(1).max(60).default(8),
  visualProps: ComparisonPropsSchema.prefault({}),
});

export const CollectionSceneSchema = z.object({
  id: z.string(),
  sceneIndex: z.number().int().min(0),
  type: z.literal('collection'),
  narration: z.string().min(10),
  spokenNarration: z.string().trim().min(1).optional(),
  onScreenText: HumanReadableText,
  technicalKeyPoint: z.string(),
  durationTargetSec: z.number().min(1).max(60).default(8),
  visualProps: CollectionPropsSchema.prefault({}),
});

export const RaceConditionSceneSchema = z.object({
  id: z.string(),
  sceneIndex: z.number().int().min(0),
  type: z.literal('raceCondition'),
  narration: z.string().min(10),
  spokenNarration: z.string().trim().min(1).optional(),
  onScreenText: HumanReadableText,
  technicalKeyPoint: z.string(),
  durationTargetSec: z.number().min(1).max(60).default(8),
  visualProps: RaceConditionPropsSchema.prefault({}),
});

export const SummarySceneSchema = z.object({
  id: z.string(),
  sceneIndex: z.number().int().min(0),
  type: z.literal('summary'),
  narration: z.string().min(10),
  spokenNarration: z.string().trim().min(1).optional(),
  onScreenText: HumanReadableText,
  technicalKeyPoint: z.string(),
  durationTargetSec: z.number().min(1).max(60).default(8),
  visualProps: SummaryPropsSchema.prefault({}),
});

export const SmartphoneMockupSceneSchema = z.object({
  id: z.string(),
  sceneIndex: z.number().int().min(0),
  type: z.literal('smartphoneMockup'),
  narration: z.string().min(10),
  spokenNarration: z.string().trim().min(1).optional(),
  onScreenText: HumanReadableText,
  technicalKeyPoint: z.string(),
  durationTargetSec: z.number().min(1).max(60).default(8),
  visualProps: SmartphoneMockupPropsSchema.prefault({}),
});

export const H3SpatialMapSceneSchema = z.object({
  id: z.string(),
  sceneIndex: z.number().int().min(0),
  type: z.literal('h3SpatialMap'),
  narration: z.string().min(10),
  spokenNarration: z.string().trim().min(1).optional(),
  onScreenText: HumanReadableText,
  technicalKeyPoint: z.string(),
  durationTargetSec: z.number().min(1).max(60).default(8),
  visualProps: H3SpatialMapPropsSchema.prefault({}),
});

export const ArchitecturePipelineSceneSchema = z.object({
  id: z.string(),
  sceneIndex: z.number().int().min(0),
  type: z.literal('architecturePipeline'),
  narration: z.string().min(10),
  spokenNarration: z.string().trim().min(1).optional(),
  onScreenText: HumanReadableText,
  technicalKeyPoint: z.string(),
  durationTargetSec: z.number().min(1).max(60).default(8),
  visualProps: ArchitecturePipelinePropsSchema.prefault({}),
});

export const TradeoffHUDSceneSchema = z.object({
  id: z.string(),
  sceneIndex: z.number().int().min(0),
  type: z.literal('tradeoffHUD'),
  narration: z.string().min(10),
  spokenNarration: z.string().trim().min(1).optional(),
  onScreenText: HumanReadableText,
  technicalKeyPoint: z.string(),
  durationTargetSec: z.number().min(1).max(60).default(8),
  visualProps: TradeoffHUDPropsSchema.prefault({}),
});

// The Discriminated Union
export const StoryboardSceneSchema = z.discriminatedUnion('type', [
  HookSceneSchema,
  CodeWalkthroughSceneSchema,
  RequestFlowSceneSchema,
  QueueTimelineSceneSchema,
  ComparisonSceneSchema,
  CollectionSceneSchema,
  RaceConditionSceneSchema,
  SummarySceneSchema,
  SmartphoneMockupSceneSchema,
  H3SpatialMapSceneSchema,
  ArchitecturePipelineSceneSchema,
  TradeoffHUDSceneSchema,
]);

export type StoryboardScene = z.infer<typeof StoryboardSceneSchema>;

// Complete Storyboard Output with strict validation
export const StoryboardSchema = z.object({
  sourceBrief: z.object({ url: z.string().url(), claim: z.string().min(10) }).optional(),
  topic: z.string().min(3).max(200),
  title: z.string().min(5).max(100).describe('YouTube Shorts / Reel title with high CTR'),
  hook: z.string().min(10).describe('First 3 seconds Hinglish hook that stops the scroll'),
  learningObjective: z.string().min(10).describe('What viewer understands by the end'),
  targetAudience: z.string().default('Developers & CS students'),
  format: z.literal('short').default('short'),
  estimatedDurationSec: z.number().int().min(10).max(180).default(45),
  scenes: z.array(StoryboardSceneSchema).min(3).max(8),
  hashtags: z.array(z.string()).default(['#tech', '#programming', '#shorts']),
});

export type Storyboard = z.infer<typeof StoryboardSchema>;
