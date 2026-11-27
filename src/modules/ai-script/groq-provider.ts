import { providerFetch } from '../jobs/provider-guard.js';
const structuredOutputModels = new Set(['qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'meta-models/muse-spark-open']);
const visualKeyCooldowns = new Map<string, number>();
const responsiveVisualKeys = new Map<string, string>();

export class GroqRateLimitError extends Error {
  constructor(readonly retryAfterMs?: number) {
    super('Groq API error [429]');
  }
}

export class GroqRequestError extends Error {
  constructor(readonly status: number, message = `Groq API error [${status}]`) { super(message); }
}

export class GroqProvider {
  private apiKeys: string[];
  private model: string;

  constructor(apiKeyOrKeys: string | string[], model = 'qwen/qwen3.8-27b') {
    if (Array.isArray(apiKeyOrKeys)) {
      this.apiKeys = apiKeyOrKeys;
    } else {
      this.apiKeys = apiKeyOrKeys.includes(',')
        ? apiKeyOrKeys.split(',').map((k) => k.trim())
        : [apiKeyOrKeys.trim()];
    }
    this.model = model;
  }

  get modelName() { return this.model; }

  async generateJSON(prompt: string, systemInstruction?: string, timeoutMs?: number, responseJsonSchema?: object,
    options?: { jsonObjectMode?: boolean; maxCompletionTokens?: number; reasoningEffort?: 'low';
      onUsage?: (usage: unknown, finish?: string) => void; onResponse?: (status: number, headers: Headers) => void;
      failFastOnTransportError?: boolean }): Promise<string> {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const responseFormat = responseJsonSchema && !options?.jsonObjectMode && structuredOutputModels.has(this.model)
      ? { type: 'json_schema', json_schema: { name: 'reel_shot_plan', strict: true, schema: responseJsonSchema } }
      : { type: 'json_object' };

    const messages = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    let lastError: Error | null = null;
    let shortestRateLimit: GroqRateLimitError | undefined;

    const preferred = options?.onUsage ? responsiveVisualKeys.get(this.model) : undefined;
    const keys = preferred && this.apiKeys.includes(preferred)
      ? [preferred, ...this.apiKeys.filter(key => key !== preferred)] : this.apiKeys;
    // Reuse the responsive key for visual requests and honor observed cooldowns.
    for (const key of keys) {
      const cooldownKey = `${this.model}:${key}`;
      const cooldown = options?.onUsage ? visualKeyCooldowns.get(cooldownKey) : undefined;
      const remaining = (cooldown ?? 0) - Date.now();
      if (remaining > 0) {
        lastError = new GroqRateLimitError(remaining);
        if ((shortestRateLimit?.retryAfterMs ?? Infinity) > remaining) shortestRateLimit = lastError;
        continue;
      }
      if (cooldown !== undefined) visualKeyCooldowns.delete(cooldownKey);
      try {
        const res = await providerFetch('groq', url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            response_format: responseFormat,
            max_completion_tokens: options?.maxCompletionTokens ?? (responseJsonSchema ? 3200 : undefined),
            reasoning_effort: /^openai\/gpt-oss-(20b|120b)$/.test(this.model) ? options?.reasoningEffort : undefined,
            temperature: 0.6,
          }),
          signal: timeoutMs === undefined ? undefined : AbortSignal.timeout(timeoutMs),
        });
        options?.onResponse?.(res.status, res.headers);

        if (!res.ok) {
          const details = await res.json().catch(() => undefined);
          const rejectedDraft = details?.error?.failed_generation;
          if (responseFormat.type === 'json_schema' && details?.error?.code === 'json_validate_failed' && typeof rejectedDraft === 'string') {
            // The visual planner can retain valid scenes even when the provider rejects the whole response.
            return rejectedDraft;
          }
          if (res.status === 429) {
            const header = res.headers.get('retry-after');
            const seconds = header ? Number(header) : Number.NaN;
            const milliseconds = Number.isFinite(seconds) ? seconds * 1000
              : header ? Date.parse(header) - Date.now() : Number.NaN;
            throw new GroqRateLimitError(Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : undefined);
          }
          if (res.status === 413 && options?.onUsage) throw new GroqRequestError(413);
          throw new GroqRequestError(res.status);
        }

        const data = await res.json();
        const choice = data.choices?.[0];
        options?.onUsage?.(data.usage, choice?.finish_reason);
        if (options?.onUsage && choice?.finish_reason === 'length') {
          throw new GroqRequestError(422, 'Provider truncated the visual JSON response.');
        }
        const content = choice?.message?.content;
        if (!content) {
          throw new Error('Groq returned no JSON output.');
        }

        if (options?.onUsage) responsiveVisualKeys.set(this.model, key);
        return content;
      } catch (err: any) {
        if (options?.failFastOnTransportError && !(err instanceof GroqRateLimitError) && !(err instanceof GroqRequestError)) throw err;
        if (options?.onUsage && err instanceof GroqRequestError && [413, 422].includes(err.status)) throw err;
        lastError = err;
        if (options?.onUsage && err instanceof GroqRateLimitError) {
          visualKeyCooldowns.set(cooldownKey, Date.now() + Math.max(1000, err.retryAfterMs ?? 30_000));
        }
        if (err instanceof GroqRateLimitError && err.retryAfterMs !== undefined
          && (shortestRateLimit?.retryAfterMs === undefined || err.retryAfterMs < shortestRateLimit.retryAfterMs)) shortestRateLimit = err;
        console.warn(`Groq key failure (${err.message.slice(0, 100)}). Trying next key if available...`);
      }
    }

    throw (options?.jsonObjectMode && shortestRateLimit) || lastError || new Error('All Groq keys failed');
  }
}
