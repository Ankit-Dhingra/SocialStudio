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
  language: z.enum(['javascript', 'typescript', 'python', 'sql', 'bash', 'json', 'lua', 'sh']).default('typescript'),
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
  mode: z.enum(['lock', 'queue', 'event-loop', 'timeline']).optional(),
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
  leftCode: z.string().optional(),
  leftPoints: z.array(z.string()).min(1).max(4).default(['Direct uncoordinated mutation', 'State inconsistency under peak load']),
  rightTitle: z.string().default('Engineered Architecture'),
  rightCode: z.string().optional(),
  rightPoints: z.array(z.string()).min(1).max(4).default(['In-memory atomic coordination', 'Safe lock lease expiration']),
  verdict: z.string().default('Architectural coordination eliminates race conditions'),
  metricAName: z.string().optional(),
  metricACount: z.number().optional(),
  metricBName: z.string().optional(),
  metricBCount: z.number().optional(),
  deficitRatio: z.string().optional(),
  stampTitle: z.string().optional(),
  stampSubtitle: z.string().optional(),
});

export const SummaryPropsSchema = z.object({
  headline: z.string().default('System Design Takeaways'),
  takeaways: z.array(z.string()).min(2).max(4).default([
    'In-memory atomic primitives eliminate concurrency race conditions',
    'Lease TTL auto-expiry prevents catastrophic process deadlocks',
  ]),
  callToAction: z.string().default('Behind The Tech ko abhi follow karo!'),
});

export const RaceConditionPropsSchema = z.object({
  title: z.string().default('CONCURRENCY • RACE CONDITION'),
  itemTitle: z.string().default('Shared Resource Mutex'),
  user1Name: z.string().default('Worker Thread A'),
  user2Name: z.string().default('Worker Thread B'),
  atomicQuery: z.string().default('// Atomic lock acquisition query'),
  user1Timestamp: z.string().default('19:00:00.120'),
  user2Timestamp: z.string().default('19:00:00.124'),
});

export const SmartphoneMockupPropsSchema = z.object({
  headline: z.coerce.string().default('REAL-TIME CLIENT REQUEST'),
  subtext: z.coerce.string().default('Client state interaction and protocol validation'),
  appName: z.coerce.string().default('APP'),
  appCategory: z.enum(['shop', 'ecommerce', 'delivery', 'food', 'ride', 'fintech', 'generic']).optional(),
  locationText: z.coerce.string().default('Region Central API'),
  itemName: z.coerce.string().default('Resource Allocation'),
  itemEmoji: z.coerce.string().optional(),
  itemPrice: z.coerce.string().optional(),
  feeLabel: z.coerce.string().optional(),
  surgeAmount: z.coerce.string().optional(),
  surgeMultiplier: z.coerce.string().optional(),
  baseDeliveryFee: z.coerce.string().optional(),
  surgeDeliveryFee: z.coerce.string().optional(),
  surgeReason: z.coerce.string().optional(),
  algorithmName: z.coerce.string().optional(),
  ctaText: z.coerce.string().optional(),
  lottieAsset: z.coerce.string().optional(),
  auditRow1Label: z.string().optional(),
  auditRow1Value: z.string().optional(),
  auditRow2Label: z.string().optional(),
  auditRow2Value: z.string().optional(),
  auditRow3Label: z.string().optional(),
  auditRow3Value: z.string().optional(),
  auditQuestion: z.string().optional(),
});

export const H3SpatialMapPropsSchema = z.object({
  mode: z.enum(['hex-grid', 'naive-radius', 'stale-heartbeat']).optional(),
  title: z.coerce.string().default('SPATIAL INDEXING & PARTITION MESH'),
  subtitle: z.coerce.string().default('O(1) Spatial lookup narrows search radius'),
  hexResolution: z.coerce.number().optional(),
  activeHexCount: z.coerce.number().optional(),
  demandCount: z.coerce.number().optional(),
  supplyCount: z.coerce.number().optional(),
  hotHexId: z.coerce.string().default('#ZONE_A4'),
  orderCount: z.coerce.number().default(52),
  riderCount: z.coerce.number().default(5),
  surgeMultiplier: z.coerce.string().default('1.8X'),
  entityLabel: z.coerce.string().optional(),
  providerLabel: z.coerce.string().optional(),
  entityEmoji: z.coerce.string().optional(),
  providerEmoji: z.coerce.string().optional(),
});

export const ArchitecturePipelinePropsSchema = z.object({
  title: z.string().default('DISTRIBUTED ARCHITECTURE PIPELINE'),
  subtitle: z.string().default('In-memory coordination prevents database race conditions'),
  redisLatencyMs: z.number().default(4),
  atomicCommand: z.string().optional(),
  steps: z
    .array(
      z.object({
        label: z.string(),
        description: z.string(),
        status: z.enum(['completed', 'active', 'pending']).default('completed'),
      })
    )
    .optional(),
  deepDiveStages: z.array(z.any()).optional(),
});

export const TradeoffHUDPropsSchema = z.object({
  title: z.string().default('SENIOR SDE TRADEOFF MATRIX'),
  subtitle: z.string().default('Which architecture strategy would you defend in an interview?'),
  optionA_Title: z.string().optional(),
  optionA_Pros: z.string().optional(),
  optionA_Cons: z.string().optional(),
  optionB_Title: z.string().optional(),
  optionB_Pros: z.string().optional(),
  optionB_Cons: z.string().optional(),
  interviewPoints: z.array(z.string()).min(1).max(5).default([
    'Evaluate latency budgets against strict consistency requirements',
    'Use atomic primitives with TTL guards to prevent deadlocks',
    'Design graceful degradation for edge-case network partitions',
  ]),
  callToAction: z.string().default('Behind The Tech ko abhi follow karo!'),
  channelName: z.string().optional(),
  channelHandle: z.string().optional(),
  takeawayTitle: z.string().optional(),
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
  angle: z.string().max(300).optional(),
  title: z.string().min(5).max(100).describe('YouTube Shorts / Reel title with high CTR'),
  hook: z.string().min(10).describe('First 3 seconds Hinglish hook that stops the scroll'),
  learningObjective: z.string().min(10).describe('What viewer understands by the end'),
  targetAudience: z.string().default('Developers & CS students'),
  format: z.literal('short').default('short'),
  estimatedDurationSec: z.number().int().min(10).max(240).default(105),
  scenes: z.array(StoryboardSceneSchema).min(1).max(100),
  hashtags: z.array(z.string()).default(['#tech', '#programming', '#shorts']),
});

export type Storyboard = z.infer<typeof StoryboardSchema>;
