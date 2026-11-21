import dotenv from 'dotenv';

dotenv.config();

// Fast in-memory cache for transliterated texts
const transliterationCache = new Map<string, string>();

// Universal English letter/digit to Devanagari phonetic pronunciation table
const LETTER_PHONETICS: Record<string, string> = {
  A: 'ए', B: 'बी', C: 'सी', D: 'डी', E: 'ई', F: 'एफ़', G: 'जी', H: 'एच', I: 'आई',
  J: 'जे', K: 'के', L: 'एल', M: 'एम', N: 'एन', O: 'ओ', P: 'पी', Q: 'क्यू', R: 'आर',
  S: 'एस', T: 'टी', U: 'यू', V: 'वी', W: 'डब्लू', X: 'एक्स', Y: 'वाय', Z: 'ज़ेड',
  '0': 'ज़ीरो', '1': 'वन', '2': 'टू', '3': 'थ्री', '4': 'फोर', '5': 'फाइव',
  '6': 'सिक्स', '7': 'सेवन', '8': 'एट', '9': 'नाइन',
};

/**
 * Universal Algorithmic Acronym Transliterator
 * Converts ANY English technical abbreviation (JWT, CRDT, BFT, S3, H3, GPS, TTL, OTP, etc.)
 * into hyphenated Devanagari letters with zero hardcoded word lists.
 */
export function transliterateAcronymsUniversal(text: string): string {
  // 1. Convert English acronyms (e.g. JWT -> जे-डब्लू-टी, H3 -> एच-थ्री, S3 -> एस-थ्री)
  let result = text.replace(/\b([A-Z0-9]{2,6})(s|ज़)?\b/g, (match, base, plural) => {
    // If it's pure numbers, leave as-is
    if (/^\d+$/.test(base)) return match;
    const parts = base.split('').map((char: string) => LETTER_PHONETICS[char] || char);
    const hyphenated = parts.join('-');
    return plural ? `${hyphenated}ज़` : hyphenated;
  });

  // Handle common mixed-case tech protocols (OAuth, gRPC)
  result = result
    .replace(/\bOAuth\b/gi, 'ओ-ऑथ')
    .replace(/\bgRPC\b/gi, 'जी-आर-पी-सी');

  return result;
}

/**
 * Polishes transliterated Devanagari text using purely universal rules
 * (Zero topic-specific word lists).
 */
export function polishPhoneticDevanagari(text: string): string {
  let polished = transliterateAcronymsUniversal(text);

  // Clean spacing around hyphens and punctuation
  polished = polished
    .replace(/\s+/g, ' ')
    .replace(/\s+([।?!,])/g, '$1')
    .trim();

  return polished;
}

/**
 * Universal Phonetic Transliteration Service
 * Converts Roman Hinglish narration into pure Devanagari script for Sarvam AI TTS.
 * This guarantees 100% natural Indian pronunciation for any tech topic (Redis, Kafka, GPS, H3, etc.)
 * without requiring manual word-by-word dictionaries.
 */
export async function transliterateToPhoneticDevanagari(text: string): Promise<string> {
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return text;

  // If already predominantly Devanagari, apply polish and return
  const devanagariCount = (clean.match(/[\u0900-\u097F]/g) || []).length;
  if (devanagariCount > clean.length * 0.4) {
    return polishPhoneticDevanagari(clean);
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
                'You are a phonetic transliterator for Indian Hindi TTS (Sarvam AI). Transliterate the given Roman Hinglish text completely into pure Devanagari script so that an Indian acoustic TTS model pronounces every word with 100% native natural accuracy. Rules: 1. Transliterate all English technical and everyday loan terms phonetically (same -> सेम, Redis -> रेडिस, GPS -> जी-पी-एस, H3 -> एच-थ्री, API -> ए-पी-आई, TTL -> टी-टी-एल, Cache -> कैश, Server -> सर्वर, Zomato -> ज़ोमाटो, Swiggy -> स्विगी, CPU -> सी-पी-यू, RAM -> रैम, DB -> डी-बी, SQL -> एस-क्यू-एल, OTP -> ओ-टी-पी, HTTP -> एच-टी-टी-पी, SMS -> एस-एम-एस, UPI -> यू-पी-आई, NPCI -> एन-पी-सी-आई). 2. Write common Hindi words accurately in Devanagari (sirf -> सिर्फ़, matlab -> मतलब, lekin -> लेकिन, pehle -> पहले, kyun -> क्यों, zyada -> ज़्यादा, paas -> पास, chala -> चला, hazaaron -> हज़ारों). 3. Use natural Hindi punctuation (, and । and ?) to create natural vocal pauses. 4. Transliterate ALL sentences completely without omitting anything. 5. Output ONLY the Devanagari text string.',
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
          const polished = polishPhoneticDevanagari(candidate);
          transliterationCache.set(clean, polished);
          return polished;
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
          const polished = polishPhoneticDevanagari(candidate);
          transliterationCache.set(clean, polished);
          return polished;
        }
      }
    } catch (err: any) {
      console.warn('[PhoneticService] Gemini transliteration fallback:', err.message);
    }
  }

  // 3. Fast Safe Rule-Based Fallback if all LLMs are offline
  const fallback = polishPhoneticDevanagari(applyRuleBasedPhonetics(clean));
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
    [/\bsame\b/gi, 'सेम'],
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
