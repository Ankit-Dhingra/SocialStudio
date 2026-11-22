const structuredOutputModels = new Set(['qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'meta-models/muse-spark-open']);

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

  async generateJSON(prompt: string, systemInstruction?: string, timeoutMs?: number, responseJsonSchema?: object): Promise<string> {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const responseFormat = responseJsonSchema && structuredOutputModels.has(this.model)
      ? { type: 'json_schema', json_schema: { name: 'reel_shot_plan', strict: true, schema: responseJsonSchema } }
      : { type: 'json_object' };

    const messages = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    let lastError: Error | null = null;

    // Try keys sequentially if one hits rate limits
    for (const key of this.apiKeys) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            response_format: responseFormat,
            max_completion_tokens: responseJsonSchema ? 3200 : undefined,
            temperature: 0.6,
          }),
          signal: timeoutMs === undefined ? undefined : AbortSignal.timeout(timeoutMs),
        });

        if (!res.ok) {
          const details = await res.json().catch(() => undefined);
          const rejectedDraft = details?.error?.failed_generation;
          if (responseFormat.type === 'json_schema' && details?.error?.code === 'json_validate_failed' && typeof rejectedDraft === 'string') {
            // The visual planner can retain valid scenes even when the provider rejects the whole response.
            return rejectedDraft;
          }
          throw new Error(`Groq API error [${res.status}]`);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('Groq returned no JSON output.');
        }

        return content;
      } catch (err: any) {
        lastError = err;
        console.warn(`Groq key failure (${err.message.slice(0, 100)}). Trying next key if available...`);
      }
    }

    throw lastError || new Error('All Groq keys failed');
  }
}
