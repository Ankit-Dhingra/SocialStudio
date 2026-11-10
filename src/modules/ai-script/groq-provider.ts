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

  async generateJSON(prompt: string, systemInstruction?: string): Promise<string> {
    const url = 'https://api.groq.com/openai/v1/chat/completions';

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
            response_format: { type: 'json_object' },
            temperature: 0.6,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Groq API error [${res.status}]: ${errorText}`);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error(`Empty response from Groq API: ${JSON.stringify(data)}`);
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
