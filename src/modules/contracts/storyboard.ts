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
]);

export type SceneType = z.infer<typeof SceneTypeEnum>;

// Specific visual props for deterministic Remotion rendering
export const HookPropsSchema = z.object({
  headline: z.string().describe('Short explosive text (3-6 words), e.g. "JS is NOT Multi-threaded!"'),
  subtext: z.string().optional().describe('Curiosity kicker, e.g. "How does async actually work?"'),
  badgeText: z.string().default('TECH EXPLAINED'),
  accentColor: z.string().default('#00F2FE'),
});

export const CodeWalkthroughPropsSchema = z.object({
  filename: z.string().default('example.js'),
  language: z.enum(['javascript', 'typescript', 'python', 'sql', 'bash', 'json']).default('javascript'),
  code: z.string().describe('Clean, formatted snippet (max 6-8 lines for 9:16 safe area)'),
  highlightLines: z.array(z.number()).default([]).describe('1-based line numbers to highlight'),
  explanationCallout: z.string().optional().describe('Brief label pointing to the key line'),
});

export const RequestFlowPropsSchema = z.object({
  title: z.string().describe('Flow title, e.g. "Client -> Redis Cache -> DB"'),
  steps: z.array(
    z.object({
      label: z.string(),
      description: z.string(),
      status: z.enum(['active', 'completed', 'bypassed', 'cached']).default('active'),
    })
  ).min(2).max(4),
});

export const QueueTimelinePropsSchema = z.object({
  title: z.string().describe('Queue or timeline title, e.g. "Event Loop Phases"'),
  items: z.array(
    z.object({
      name: z.string(),
      priority: z.enum(['high', 'medium', 'low', 'microtask', 'macrotask']).default('medium'),
      detail: z.string(),
    })
  ).min(2).max(4),
  activeItemIndex: z.number().default(0),
});

export const CollectionPropsSchema = z.object({
  title: z.string().min(1),
  items: z.array(z.object({label: z.string().min(1), selected: z.boolean()})).min(2).max(12),
  cue: z.string().min(1),
  result: z.string().min(1),
});

export const ComparisonPropsSchema = z.object({
  leftTitle: z.string().describe('Left entity (e.g. Microtask Queue / Cache Hit)'),
  leftPoints: z.array(z.string()).min(1).max(3),
  rightTitle: z.string().describe('Right entity (e.g. Macrotask Queue / Cache Miss)'),
  rightPoints: z.array(z.string()).min(1).max(3),
  verdict: z.string().describe('Key difference in one sentence'),
});

export const SummaryPropsSchema = z.object({
  headline: z.string().describe('Punchy summary headline'),
  takeaways: z.array(z.string()).min(2).max(3),
  callToAction: z.string().default('Follow for more deep tech breakdowns!'),
});

export const VisualPropsSchema = z.union([
  HookPropsSchema,
  CodeWalkthroughPropsSchema,
  RequestFlowPropsSchema,
  QueueTimelinePropsSchema,
  ComparisonPropsSchema,
  SummaryPropsSchema,
  z.record(z.string(), z.unknown()),
]);

// Single Scene in the Storyboard
export const StoryboardSceneSchema = z.object({
  id: z.string().describe('Unique scene identifier like scene-1, scene-2'),
  sceneIndex: z.number().int().min(0),
  type: SceneTypeEnum,
  narration: z
    .string()
    .min(10)
    .describe('Engaging conversational Hinglish voiceover script. Must pronounce tech terms clearly.'),
  onScreenText: z
    .string()
    .min(3)
    .max(120)
    .describe('Prominent English on-screen text / headline for this scene'),
  visualProps: z.record(z.string(), z.unknown()).describe('Typed visual props matching scene type'),
  durationTargetSec: z
    .number()
    .min(1)
    .max(60)
    .default(6)
    .describe('Target duration in seconds for this scene'),
  technicalKeyPoint: z.string().describe('The core factual insight delivered in this scene'),
});

export type StoryboardScene = z.infer<typeof StoryboardSceneSchema>;

// Complete Storyboard Output
export const StoryboardSchema = z.object({
  sourceBrief: z.object({url: z.string().url(), claim: z.string().min(10)}).optional(),
  topic: z.string().min(5).max(200),
  title: z.string().min(5).max(100).describe('YouTube Shorts / Reel title with high CTR'),
  hook: z.string().min(10).describe('First 3 seconds Hinglish hook that stops the scroll'),
  learningObjective: z.string().min(10).describe('What viewer understands by the end'),
  targetAudience: z.string().default('Developers & CS students'),
  format: z.literal('short').default('short'),
  estimatedDurationSec: z.number().int().min(10).max(180).default(45),
  scenes: z.array(StoryboardSceneSchema).min(3).max(7),
  hashtags: z.array(z.string()).default(['#tech', '#programming', '#shorts']),
});

export type Storyboard = z.infer<typeof StoryboardSchema>;
