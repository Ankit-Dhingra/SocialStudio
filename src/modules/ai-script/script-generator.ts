import { readFile } from 'node:fs/promises';
import { validateLesson } from './validate-lesson.js';
import dotenv from 'dotenv';
import { Storyboard, StoryboardSchema } from '../contracts/storyboard.js';
import { buildHinglishScriptPrompt } from './prompt.js';
import { GeminiProvider } from './gemini-provider.js';
import { GroqProvider } from './groq-provider.js';

dotenv.config();

export interface GenerateScriptOptions {
  topic: string;
  targetDurationSec?: number;
  provider?: 'gemini' | 'groq';
  mockTopicAware?: boolean;
}

function cleanJsonResponse(raw: string): string {
  let cleaned = raw.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

/**
 * Topic relevance sanity check:
 * Ensures the generated script discusses keywords from the requested topic,
 * preventing silent fallback or hallucinated unrelated content.
 */
function verifyTopicRelevance(topic: string, storyboard: Storyboard): { relevant: boolean; reason?: string } {
  // Normalize topic terms
  const stopWords = new Set(['how', 'what', 'why', 'the', 'works', 'behind', 'scenes', 'in', 'and', 'for', 'to', 'a', 'is', 'an', 'vs', 'with', 'by']);
  const topicTokens = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  const scriptFullText = [
    ...storyboard.scenes.map((s) => `${s.narration} ${s.onScreenText} ${s.technicalKeyPoint}`),
  ]
    .join(' ')
    .toLowerCase();

  const foundTokens = topicTokens.filter((token) => {
    if (scriptFullText.includes(token)) return true;
    // Check root stem (e.g. microtasks -> microtask, handles -> handle)
    const stem = token.replace(/s$/, '').replace(/es$/, '');
    if (stem.length > 2 && scriptFullText.includes(stem)) return true;
    return false;
  });



  if (topicTokens.length > 0 && foundTokens.length === 0) {
    return {
      relevant: false,
      reason: `Topic coverage too low (0%). Expected tokens [${topicTokens.join(', ')}], found none.`,
    };
  }

  return { relevant: true };
}

export async function generateHinglishScript(options: GenerateScriptOptions): Promise<Storyboard> {
  const { topic, targetDurationSec = 45, provider = (process.env.LLM_PROVIDER as 'gemini' | 'groq') || 'gemini' } = options;

  if (!topic || topic.trim().length < 5) {
    throw new Error('Topic must be at least 5 characters long');
  }

  const reference = [
    { matches: /setcount|react.*(?:state|updater|batch)/i, file: 'react-state' },
    { matches: /(?:stock|inventory|oversell).*(?:update|race|buyer)|(?:postgres|conditional update).*(?:stock|buyer)/i, file: 'checkout' },
    { matches: /(?:retrieval|rag).*(?:chunk|pdf)|(?:chunk|pdf).*(?:rag|retrieval)/i, file: 'retrieval' },
  ].find(entry => entry.matches.test(topic));
  let brief: Storyboard['sourceBrief'];
  if (reference) {
    const file = new URL('../../../examples/' + reference.file + '.json', import.meta.url);
    brief = StoryboardSchema.parse(JSON.parse(await readFile(file, 'utf8'))).sourceBrief;
  }
  const prompt = buildHinglishScriptPrompt(topic.trim(), targetDurationSec) + (brief
    ? '\nVerified source and scope: ' + JSON.stringify(brief) + '\nKeep every conclusion consistent with these facts.'
    : '');
  const systemInstruction =
    'You are a high-retention technical educator creating 9:16 viral tech shorts scripts with conversational Hinglish narration and strict JSON output.';

  let useGemini = provider === 'gemini' && Boolean(process.env.GEMINI_API_KEY);
  let groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  async function requestDraft(draftPrompt: string): Promise<string> {
    if (useGemini) {
      const gemini = new GeminiProvider(process.env.GEMINI_API_KEY!, process.env.GEMINI_MODEL || 'gemini-2.5-flash');
      try {
        return await gemini.generateJSON(draftPrompt, systemInstruction);
      } catch (error) {
        if (!process.env.GROQ_API_KEY) throw error;
        useGemini = false;
        console.warn('Gemini unavailable. Using Groq for this storyboard.');
      }
    }
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('No configured script provider is available.');
    try {
      return await new GroqProvider(key, groqModel).generateJSON(draftPrompt, systemInstruction);
    } catch (error) {
      if (error instanceof Error && error.message.includes('[429]')) {
        console.warn('[Groq RateLimit 429] Backing off 5s and switching to fallback model...');
        await new Promise((resolve) => setTimeout(resolve, 5000));
        groqModel = process.env.GROQ_FALLBACK_MODEL || 'llama-3.1-8b-instant';
        return new GroqProvider(key, groqModel).generateJSON(draftPrompt, systemInstruction);
      }
      throw error;
    }
  }

  let feedback = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await requestDraft(prompt + feedback);
    try {
      const storyboard = StoryboardSchema.parse(JSON.parse(cleanJsonResponse(raw)));
      validateLesson(storyboard);
      const relevance = verifyTopicRelevance(topic, storyboard);
      if (!relevance.relevant) throw new Error(relevance.reason);
      return { ...storyboard, topic: topic.trim(), sourceBrief: brief };
    } catch (error) {
      feedback = '\nRevise the storyboard. Correct these validation errors: ' + String(error);
    }
  }
  throw new Error(feedback.trim());
}
