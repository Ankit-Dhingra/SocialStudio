import { z } from 'zod';
import type { Caps } from './admission.js';
import type { ExecutionQuote, Provider } from './durable-jobs.js';

const size = z.number().int().min(1).max(1_000_000_000_000);
const counters = z.enum(['inputTokens', 'outputTokens', 'audioSeconds', 'requestCharacters']);
const call = z.object({ attempts: z.number().int().min(1).max(32), microsPerCall: size,
  microsPerMillionUnits: z.partialRecord(counters, size).optional() }).strict();
const providers = z.object({ gemini: call.optional(), groq: call.optional(), sarvam: call.optional(),
  elevenlabs: call.optional(), cloudflare: call.optional(), 'story-video': call.optional() }).strict();
const operation = z.object({ credits: size, computeMicros: size.or(z.literal(0)), providers }).strict();
const configuration = z.object({
  caps: z.object({ dailyMicros: size, monthlyMicros: size, userDailyMicros: size, providerDailyMicros: size,
    trialDailyMicros: size.optional() }).strict(),
  operations: z.object({ script: operation.optional(), refine: operation.optional(), audio: operation.optional(), visuals: operation.optional(),
    stills: operation.optional(), motion: operation.optional(), render: operation.optional() }).strict(),
}).strict();

export type ExecutionConfig = { caps: Caps; operations: z.infer<typeof configuration>['operations'] };
export type HostedOperation = keyof ExecutionConfig['operations'];

export function executionConfig(env = process.env): ExecutionConfig | undefined {
  if (env.STUDIO_GENERATION_ENABLED !== 'true') return undefined;
  const parsed = configuration.parse(JSON.parse(env.STUDIO_GENERATION_CONFIG ?? '{}'));
  const permitted: Record<HostedOperation, Provider[]> = {
    script: ['gemini', 'groq'], refine: ['gemini', 'groq'], audio: ['sarvam', 'groq', 'elevenlabs'], visuals: ['groq'],
    stills: [], motion: [], render: [],
  };
  for (const [name, quote] of Object.entries(parsed.operations)) {
    const allowed = permitted[name as HostedOperation];
    const selected = Object.keys(quote.providers);
    if (quoteBound(quote) < 1 || quoteBound(quote) > 1_000_000_000_000 ||
      selected.some(provider => !allowed.includes(provider as Provider)) ||
      ((name === 'script' || name === 'refine') && !selected.length) || (name === 'visuals' && !quote.providers.groq) ||
      (name === 'audio' && (!quote.providers.groq || !(quote.providers.sarvam || quote.providers.elevenlabs)))) {
      throw new Error('Invalid hosted generation quote.');
    }
  }
  return parsed;
}

export const quoteBound = (quote: ExecutionQuote) => quote.computeMicros +
  Object.values(quote.providers).reduce((sum, limit) => sum + limit.attempts * limit.microsPerCall, 0);
