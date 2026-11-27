import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { recordProviderResponse, startProviderCall, type ExecutionQuote, type Provider } from './durable-jobs.js';
import { generationPaused } from './generation-control.js';

type Spending = Partial<Record<Provider | 'compute', number>>;
const scope = new AsyncLocalStorage<ReturnType<typeof createProviderScope>>();

function usageFields(data: unknown): Record<string, number> {
  if (!data || typeof data !== 'object') return {};
  const result: Record<string, number> = {};
  const payload = data as Record<string, unknown>;
  for (const name of ['usage', 'usageMetadata', 'usage_metadata', 'audio_duration', 'duration']) {
    const value = payload[name];
    const fields: [string, unknown][] = value && typeof value === 'object' ? Object.entries(value) : [[name, value]];
    for (const [key, quantity] of fields) {
      if (/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) && typeof quantity === 'number' && Number.isFinite(quantity) && quantity >= 0) {
        result[key] = quantity;
      }
    }
  }
  const input = result.prompt_tokens ?? result.promptTokenCount;
  const output = result.completion_tokens ?? result.candidatesTokenCount;
  const audio = result.audio_duration ?? result.duration;
  if (input !== undefined) result.inputTokens = input;
  if (output !== undefined) result.outputTokens = output + (result.thoughtsTokenCount ?? 0);
  if (audio !== undefined) result.audioSeconds = audio;
  return result;
}

function requestCharacters(provider: Provider, body: RequestInit['body']) {
  if (!['sarvam', 'elevenlabs'].includes(provider) || typeof body !== 'string') return undefined;
  try {
    const text: unknown = JSON.parse(body).text;
    if (typeof text === 'string') return Array.from(text).length;
  } catch { /* The provider validates its request body. */ }
}

export function createProviderScope(jobId: string, leaseId: string, quote: ExecutionQuote, reservedDay: string, transport: typeof fetch = globalThis.fetch) {
  const attempts: Partial<Record<Provider, number>> = {};
  const costs: Spending = {};
  let unresolved = false;
  let pending = false;
  return {
    costs,
    requiresReview: () => unresolved || pending,
    async request(provider: Provider, input: Parameters<typeof fetch>[0], init?: RequestInit) {
      const limit = quote.providers[provider];
      const count = attempts[provider] ?? 0;
      if (unresolved || pending || !limit || count >= limit.attempts) throw new Error('The provider request is outside the authorized quote.');
    if (new Date().toISOString().slice(0, 10) !== reservedDay) throw new Error('The reserved spending window expired.');
      pending = true;
      const id = randomUUID();
      try {
        if (await generationPaused()) throw new Error('Generation is paused.');
      } catch (error) {
        pending = false;
        throw error;
      }
      try {
        if (!await startProviderCall(jobId, leaseId, { id, provider, boundMicros: limit.microsPerCall })) {
          throw new Error('The provider execution lease expired.');
        }
        attempts[provider] = count + 1;
        const deadline = AbortSignal.timeout(90_000);
        const response = await transport(input, {
          ...init, redirect: 'error', signal: init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline,
        });
        if (response.status >= 500 || response.status === 408 || response.status === 409) unresolved = true;
        const isJson = response.headers.get('content-type')?.includes('json');
        const usage = response.ok && isJson ? usageFields(await response.clone().json().catch(() => undefined)) : {};
        const characters = requestCharacters(provider, init?.body);
        if (characters !== undefined) usage.requestCharacters = characters;
        if (provider === 'groq' && usage.audioSeconds !== undefined) usage.audioSeconds = Math.max(10, usage.audioSeconds);
        const rates = Object.entries(limit.microsPerMillionUnits ?? {});
        const measured = response.ok && rates.length > 0 && rates.every(([unit]) => Number.isFinite(usage[unit]));
        const estimatedMicros = measured ? Math.ceil(rates.reduce((sum, [unit, rate]) => sum + usage[unit] * rate / 1_000_000, 0))
          : limit.microsPerCall;
        if (estimatedMicros > limit.microsPerCall) unresolved = true;
        if (!await recordProviderResponse(jobId, leaseId, id, response.status, usage, estimatedMicros, measured ? 'usage' : 'ceiling')) unresolved = true;
        costs[provider] = (costs[provider] ?? 0) + estimatedMicros;
        if (unresolved) throw new Error('Provider outcome requires reconciliation.');
        return response;
      } catch {
        unresolved = true;
        throw new Error('Provider outcome requires reconciliation.');
      } finally {
        pending = false;
      }
    },
  };
}

export const withProviderScope = <T>(context: ReturnType<typeof createProviderScope>, action: () => T) => scope.run(context, action);

export function providerFetch(provider: Provider, input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> {
  const context = scope.getStore();
  if (context) return context.request(provider, input, init);
  if (process.env.NODE_ENV === 'production' || process.env.SOCIALSTUDIO_AUTH === 'clerk') {
    throw new Error('Hosted provider calls require a reserved execution.');
  }
  return globalThis.fetch(input, init);
}
