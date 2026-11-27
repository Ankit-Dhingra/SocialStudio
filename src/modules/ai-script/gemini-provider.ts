import { providerFetch } from '../jobs/provider-guard.js';
export interface LLMCallParams {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
}

export class GeminiRequestError extends Error {
  constructor(message: string, readonly retryDelayMs?: number, readonly status?: number) {
    super(message);
  }
}

export async function geminiRequest(url: string, apiKey: string, body: object, timeoutMs: number): Promise<Response> {
  let response: Response;
  try {
    response = await providerFetch('gemini', url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    throw new GeminiRequestError(timedOut ? `Gemini timed out after ${timeoutMs / 1000} seconds.` : 'Could not reach the Gemini API.', 1000);
  }
  if (response.ok) return response;

  const status = response.status;
  const { error } = await response.json().catch(() => ({})) as {
    error?: { status?: string; details?: Array<{ reason?: string; retryDelay?: string }> };
  };
  const details = Array.isArray(error?.details) ? error.details : [];
  const retryFromBody = details.find(detail => typeof detail?.retryDelay === 'string')?.retryDelay?.match(/^(\d+(?:\.\d+)?)s$/)?.[1];
  const retryAfter = response.headers.get('retry-after');
  const seconds = Number(retryAfter ?? retryFromBody);
  const retryAfterMs = Math.ceil(Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter ?? '') - Date.now());
  const retryDelayMs = Number.isFinite(retryAfterMs) ? Math.max(0, retryAfterMs) : undefined;
  const code = `Gemini returned HTTP ${status}.`;
  if (status === 429) {
    const detail = retryDelayMs !== undefined ? ` Retry after ${Math.ceil(retryDelayMs / 1000)} seconds.` : ' Check the project’s quota and billing in Google AI Studio.';
    throw new GeminiRequestError(`${code} The model reached a quota or rate limit.${detail}`, retryDelayMs, status);
  }
  if (status === 401 || status === 403 || details.some(detail => detail?.reason === 'API_KEY_INVALID')) {
    throw new GeminiRequestError(`${code} Check the API key and project permissions.`, undefined, status);
  }
  if (error?.status === 'FAILED_PRECONDITION') throw new GeminiRequestError(`${code} Check billing and regional availability for the Gemini project.`, undefined, status);
  if (status === 404) throw new GeminiRequestError(`${code} The configured model is unavailable to this project.`, undefined, status);
  if (status >= 500) throw new GeminiRequestError(`${code} Gemini is temporarily unavailable.`, retryDelayMs ?? 1000, status);
  throw new GeminiRequestError(`${code} Gemini rejected the request.`, undefined, status);
}

export class GeminiProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  get modelName() { return this.model; }

  async generateJSON(prompt: string, systemInstruction?: string, timeoutMs = 25_000, responseJsonSchema?: object,
    referenceImage?: { mimeType: 'image/png'; data: string },
    options?: { maxOutputTokens: number; onUsage: (usage: unknown, finish?: string) => void }): Promise<string> {
    const model = this.model.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    const body: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts: referenceImage ? [{ text: prompt }, { inlineData: referenceImage }] : [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.6,
        responseJsonSchema,
        maxOutputTokens: options?.maxOutputTokens,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    const res = await geminiRequest(url, this.apiKey, body, timeoutMs);
    const data = await res.json().catch(() => {
      throw new GeminiRequestError('Gemini returned an unreadable API response.');
    });
    const candidate = data.candidates?.[0];
    options?.onUsage(data.usageMetadata, candidate?.finishReason);
    const output = candidate?.content?.parts?.map((part: { text?: string; thought?: boolean }) =>
      part.thought ? '' : part.text ?? '',
    ).join('');
    if (candidate?.finishReason === 'MAX_TOKENS') {
      throw new GeminiRequestError('Gemini stopped before the JSON response was complete.');
    }
    if (!output?.trim()) throw new GeminiRequestError('Gemini returned no JSON output.');
    return output;
  }
}
