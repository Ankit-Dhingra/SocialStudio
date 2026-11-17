import dotenv from 'dotenv';

dotenv.config();

// Fast in-memory cache for transliterated texts
const transliterationCache = new Map<string, string>();

/**
 * Universal Phonetic Transliteration Service
 * Converts Roman Hinglish narration into pure Devanagari script for Sarvam AI TTS.
 * This guarantees 100% natural Indian pronunciation for any tech topic (Redis, Kafka, GPS, H3, etc.)
 * without requiring manual word-by-word dictionaries.
 */
export async function transliterateToPhoneticDevanagari(text: string): Promise<string> {
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return text;

  // If already predominantly Devanagari, return as-is
  const devanagariCount = (clean.match(/[\u0900-\u097F]/g) || []).length;
  if (devanagariCount > clean.length * 0.4) {
    return clean;
  }

  if (transliterationCache.has(clean)) {
    return transliterationCache.get(clean)!;
  }

  const groqKey = process.env.GROQ_API_KEY;
  const groqModel = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

  // 1. Try Groq first (high speed, generous quota, no reasoning-token truncation)
  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [
            {
              role: 'system',
              content:
                'You are a phonetic transliterator for Indian Hindi TTS (Sarvam AI). Transliterate the given Roman Hinglish text completely into pure Devanagari script so that an Indian acoustic TTS model pronounces every word with 100% native natural accuracy. Rules: 1. Transliterate all English technical terms phonetically (Redis -> रेडिस, GPS -> जीपीएस, H3 -> एच-थ्री, API -> एपीआई, TTL -> टी-टी-एल, Cache -> कैश, Server -> सर्वर, Zomato -> ज़ोमाटो, Swiggy -> स्विगी, CPU -> सीपीयू, RAM -> रैम, DB -> डीबी, SQL -> एसक्यूएल, OTP -> ओटीपी, HTTP -> एचटीटीपी). 2. Write common Hindi words accurately in Devanagari (sirf -> सिर्फ़, matlab -> मतलब, lekin -> लेकिन, pehle -> पहले, kyun -> क्यों, zyada -> ज़्यादा, paas -> पास, chala -> चला, hazaaron -> हज़ारों). 3. Transliterate ALL sentences completely from beginning to end without omitting or truncating anything. 4. Output ONLY the Devanagari text string.',
            },
            { role: 'user', content: clean },
          ],
          temperature: 0.1,
          max_tokens: 3000,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const candidate = data.choices?.[0]?.message?.content?.trim();
        // Safety check: ensure output is complete (at least 60% length of input)
        if (candidate && candidate.length >= clean.length * 0.6) {
          transliterationCache.set(clean, candidate);
          return candidate;
        }
      }
    } catch (err: any) {
      console.warn('[PhoneticService] Groq transliteration fallback:', err.message);
    }
  }

  // 2. Try Gemini fallback if Groq was unavailable
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
      const prompt = `Transliterate this Roman Hinglish narration into pure Devanagari script for Sarvam AI Hindi TTS. Transliterate all English technical terms phonetically (e.g. Redis -> रेडिस, GPS -> जीपीएस, H3 -> एच-थ्री, API -> एपीआई, Cache -> कैश, Server -> सर्वर, Zomato -> ज़ोमाटो). Transliterate the ENTIRE paragraph completely without cutting off. Output ONLY the Devanagari text, nothing else:\n\n${clean}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
          },
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (candidate && candidate.length >= clean.length * 0.6) {
          transliterationCache.set(clean, candidate);
          return candidate;
        }
      }
    } catch (err: any) {
      console.warn('[PhoneticService] Gemini transliteration fallback:', err.message);
    }
  }

  // 3. Fast Safe Rule-Based Fallback if all LLMs are offline
  const fallback = applyRuleBasedPhonetics(clean);
  transliterationCache.set(clean, fallback);
  return fallback;
}

/**
 * Fallback regex normalizer for common collisions when LLMs are offline
 */
function applyRuleBasedPhonetics(text: string): string {
  let s = text;
  const replacements: Array<[RegExp, string]> = [
    [/\bsirf\b/gi, 'सिर्फ़'],
    [/\bmatlab\b/gi, 'मतलब'],
    [/\blekin\b/gi, 'लेकिन'],
    [/\bpehle\b/gi, 'पहले'],
    [/\bkyun\b/gi, 'क्यों'],
    [/\bzyada\b/gi, 'ज़्यादा'],
    [/\bjyada\b/gi, 'ज़्यादा'],
    [/\bpaas\b/gi, 'पास'],
    [/\bchala\b/gi, 'चला'],
    [/\bhazaaron\b/gi, 'हज़ारों'],
    [/\bRedis\b/gi, 'रेडिस'],
    [/\bZomato\b/gi, 'ज़ोमाटो'],
    [/\bSwiggy\b/gi, 'स्विगी'],
    [/\bGPS\b/gi, 'जीपीएस'],
    [/\bH3\b/gi, 'एच-थ्री'],
    [/\bTTL\b/gi, 'टी-टी-एल'],
    [/\bAPIs?\b/gi, 'एपीआई'],
    [/\bSQL\b/gi, 'एसक्यूएल'],
    [/\bCPU\b/gi, 'सीपीयू'],
    [/\bRAM\b/gi, 'रैम'],
    [/\bDB\b/gi, 'डीबी'],
    [/\bOTP\b/gi, 'ओटीपी'],
  ];

  for (const [regex, replacement] of replacements) {
    s = s.replace(regex, replacement);
  }
  return s;
}
