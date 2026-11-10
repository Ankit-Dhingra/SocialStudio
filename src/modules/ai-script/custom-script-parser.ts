import { validateLesson } from './validate-lesson.js';
import { Storyboard, StoryboardSchema } from '../contracts/storyboard.js';
import { GeminiProvider } from './gemini-provider.js';
import { GroqProvider } from './groq-provider.js';

export async function parseCustomScriptToStoryboard(
  rawInput: string | Record<string, any>,
  topicFallback = 'Custom Tech Reel'
): Promise<Storyboard> {
  if (typeof rawInput === 'object' && rawInput !== null) {
    const validated = StoryboardSchema.safeParse(rawInput);
    if (validated.success) {
      try {
        return validateLesson(validated.data);
      } catch {
        return validated.data;
      }
    }
  }

  let parsedJson: unknown;
  try {
    if (typeof rawInput === 'string') {
      parsedJson = JSON.parse(rawInput);
    }
  } catch {
    // Free-form narration is structured below.
  }
  if (parsedJson !== undefined) {
    const validated = StoryboardSchema.safeParse(parsedJson);
    if (validated.success) {
      try {
        return validateLesson(validated.data);
      } catch {
        return validated.data;
      }
    }
  }

  const scriptText = typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput);

  // 2. Use LLM to structure user's custom script into our precise 4-scene Storyboard
  const systemPrompt = `You are an expert technical director converting a user's ChatGPT reel script into a structured JSON Storyboard.
Preserve the user's words and chronology. Identify the concrete question and its resolution.
Use a labelled requestFlow with 2–4 steps {label, description, cue} to show a mechanism;
cue must be a phrase spoken in this scene. Use a queueTimeline with items {name,detail}
for ordered states. Use code when the script supplies a snippet. End with a summary
showing the result and why it follows. Never add unrelated examples, code or claims.
3. Return ONLY pure JSON matching this exact structure:
{
  "topic": string,
  "title": string,
  "hook": string,
  "learningObjective": string,
  "targetAudience": string,
  "format": "short",
  "estimatedDurationSec": 50,
  "hashtags": ["#systemdesign", "#techshorts"],
  "scenes": [
    {
      "id": "scene-1",
      "sceneIndex": 0,
      "type": "hook",
      "narration": "Exact user narration text",
      "onScreenText": "3-5 word headline",
      "technicalKeyPoint": "Key point",
      "durationTargetSec": 10,
      "visualProps": {
        "headline": "...",
        "badgeText": "SYSTEM DESIGN"
      }
    }
  ]
}`;

  const prompt = `Convert this user-provided script into the JSON format:
${scriptText}`;

  // Try Gemini Flash first (fastest)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const gemini = new GeminiProvider(geminiKey, process.env.GEMINI_MODEL || 'gemini-2.5-flash');
      const response = await gemini.generateJSON(prompt, systemPrompt);
      const cleaned = response.replace(/^```json/m, '').replace(/^```/m, '').replace(/```$/m, '').trim();
      const obj = JSON.parse(cleaned);
      const validated = StoryboardSchema.safeParse(obj);
      if (validated.success) {
        try {
          return validateLesson(validated.data);
        } catch {
          return validated.data;
        }
      }
    } catch (e: any) {
      console.warn('Gemini script parser failed; falling back to Groq:', e.message);
    }
  }

  // Fallback to Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const groq = new GroqProvider(groqKey, process.env.GROQ_MODEL || 'qwen/qwen3.8-27b');
    const response = await groq.generateJSON(prompt, systemPrompt);
    const cleaned = response.replace(/^```json/m, '').replace(/^```/m, '').replace(/```$/m, '').trim();
    const obj = JSON.parse(cleaned);
    const validated = StoryboardSchema.safeParse(obj);
    if (validated.success) {
      try {
        return validateLesson(validated.data);
      } catch {
        return validated.data;
      }
    }
  }

  throw new Error('Could not parse user script into valid Storyboard.');
}
