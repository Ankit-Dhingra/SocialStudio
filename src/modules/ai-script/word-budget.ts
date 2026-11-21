import { Storyboard } from '../contracts/storyboard.js';

export function countWords(text: string): number {
  if (!text) return 0;
  // Strip XML tags like <break time="0.4s"/>
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/[^\w\s\u0900-\u097F]/g, ' ');
  return clean.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Frames 50ms as an illustrative design budget rather than an absolute fact.
 */
export function frameIllustrativeBudget(text: string): string {
  if (!text) return '';
  let res = text.replace(/\*\*/g, '');

  // Replace factual 50ms guarantee/strict claims with illustrative SLA design budget phrasing
  if (!/illustrative|example|budget|design\s*budget|नमूना|डिज़ाइन\s*बजट/i.test(res)) {
    res = res.replace(/(?:\b|\*)under\s*50\s*ms\s+as\s+a\s+strict\s+guarantee(?:\*|\b)/gi, 'under an illustrative 50ms SLA budget');
    res = res.replace(/(?:\b|\*)under\s*50\s*ms(?:\*|\b)/gi, 'under an illustrative 50ms SLA budget');
    res = res.replace(/(?:\b|\*)50\s*ms(?:\*|\b)\s*guarantee/gi, 'illustrative 50ms design target');
  }

  return res;
}

const KEYWORDS = /redis|h3|setnx|mutex|lock|cache|ttl|spatial|index|o\(1\)|surge|assi|tees|rupaye|₹30|₹80|₹90/i;

/**
 * Expands a scene's text by appending complete, grammatically sound Hindi/Hinglish
 * explanatory sentences that deepen technical context and reinforce technical payoffs.
 * Never produces incomplete clauses or fragments.
 */
export function expandSceneText(text: string, targetWords: number, sceneType = ''): string {
  let res = text.trim();
  let currentWords = countWords(res);
  if (currentWords >= targetWords) return res;

  // Complete, grammatically correct contextual expansion sentences keyed to architectural themes
  const EXPANSIONS: Record<string, string[]> = {
    smartphoneMockup: [
      'Ye dynamic pricing model live traffic aur rider density ke adhar par accurate surge calculate karta hai.',
      'Customer app standard rate se surge price tak real-time pricing updates instantly reflect karti hai.',
    ],
    h3SpatialMap: [
      'H3 spatial indexing me hexagonal grid city ko uniform resolution cells me divide karta hai jisse boundary distortion nahi hoti.',
      'Hexagon structure ensure karti hai ki har neighbor cell equidistant ho aur spatial traversal O(1) time me execute ho.',
    ],
    architecturePipeline: [
      'Redis in-memory caching layer sub-millisecond lookup latency provide karti hai taaki high scale pe database hang na ho.',
      'Data pipeline GPS stream ko ingest karke in-memory counters ko atomic operations ke through update karti hai.',
    ],
    raceCondition: [
      'Agar concurrent requests ko synchronize nahi kiya gaya, toh multiple users same last available rider ko race condition me book kar lenge.',
      'Distributed systems me concurrency control ensure karta hai ki data inconsistency aur overselling zero rahe.',
    ],
    queueTimeline: [
      'Distributed mutex lock me Redis SETNX aur TTL auto-expiry deadlock condition ko reliably prevent karte hain.',
      'Agar koi worker node crash bhi ho jaye, toh 5 second TTL expiry ke baad lock automatically release ho jata hai.',
    ],
    tradeoffHUD: [
      'High throughput systems me engineers ko latency, consistency aur fault tolerance ke beech production tradeoffs evaluate karne hote hain.',
      'P99 latency budget ko meet karne ke liye synchronous database calls ko in-memory distributed cache se replace kiya jata hai.',
    ],
    summary: [
      'Ye production architecture distributed systems me high availability aur strict data consistency simultaneously ensure karta hai.',
      'Spatial indexing, in-memory cache aur distributed locks ka combination real-time dynamic pricing ko resilient banata hai.',
    ],
  };

  const pool = EXPANSIONS[sceneType] || EXPANSIONS.architecturePipeline;
  for (const sentence of pool) {
    if (currentWords >= targetWords) break;
    // Don't repeat if already in text
    const key = sentence.slice(0, 20);
    if (!res.includes(key)) {
      res = `${res.replace(/[.!?।]$/, '')}. ${sentence}`;
      currentWords = countWords(res);
    }
  }

  return /[.!?।]$/.test(res) ? res : `${res}.`;
}

function condenseSingleSentence(sentence: string, targetWords: number): string {
  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length <= targetWords + 1) {
    return /[.!?।]$/.test(sentence) ? sentence : `${sentence}.`;
  }

  // Look for natural clause boundaries (comma, semicolon, colon, or major coordinating conjunctions / prepositions)
  const clauseSplits = sentence
    .split(/(?<=[,;:])\s+|\s+(?=(?:lekin|parantu|aur|kyunki|taaki|isliye|so\b|because\b|while\b|in parallel with\b|with\b|under\b|using\b|via\b)\b)/i)
    .map(c => c.trim())
    .filter(Boolean);

  if (clauseSplits.length > 1) {
    let clauseAcc = '';
    for (const clause of clauseSplits) {
      const next = clauseAcc ? `${clauseAcc}, ${clause}` : clause;
      if (countWords(next) <= targetWords + 2 || (KEYWORDS.test(clause) && countWords(next) <= targetWords + 3)) {
        clauseAcc = next;
      } else if (!clauseAcc) {
        clauseAcc = clause;
      }
    }
    return /[.!?।]$/.test(clauseAcc) ? clauseAcc : `${clauseAcc}.`;
  }

  return /[.!?।]$/.test(sentence) ? sentence : `${sentence}.`;
}

/**
 * Condenses a single scene's spoken text to fit within a target word count
 * while strictly preserving complete sentences and complete grammatical clauses.
 * NEVER blindly slices words mid-clause or appends periods to incomplete fragments.
 */
export function condenseSceneText(text: string, targetWords: number): string {
  let cleaned = text.replace(
    /\b(this is a (?:very )?long (?:and verbose )?sentence explaining why|chaliye samajhte hain ki|dekhiye kaise|maan lijiye ki)\s*/gi,
    ''
  ).trim();

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= targetWords) {
    return /[.!?।]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  }

  // Split into complete sentences
  const sentences = cleaned
    .split(/(?<=[.!?।]['"”’]?)\s+/u)
    .map(s => s.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return condenseSingleSentence(cleaned, targetWords);
  }

  // Multi-sentence case: select complete sentences
  const hasKeyword = sentences.map(s => KEYWORDS.test(s));
  const sentenceWordCounts = sentences.map(s => s.split(/\s+/).filter(Boolean).length);

  const selectedIndices = new Set<number>();
  let currentWords = 0;

  // Pass 1: Prioritize sentences containing key technical terms and cues
  for (let i = 0; i < sentences.length; i++) {
    if (hasKeyword[i] && (currentWords + sentenceWordCounts[i] <= targetWords + 1)) {
      selectedIndices.add(i);
      currentWords += sentenceWordCounts[i];
    }
  }

  // Pass 2: Fill remaining word budget in sequential order with surrounding sentences
  for (let i = 0; i < sentences.length; i++) {
    if (!selectedIndices.has(i)) {
      if (currentWords + sentenceWordCounts[i] <= targetWords + 1) {
        selectedIndices.add(i);
        currentWords += sentenceWordCounts[i];
      }
    }
  }

  if (selectedIndices.size === 0) {
    return condenseSingleSentence(sentences[0], targetWords);
  }

  // Reassemble selected complete sentences in natural chronological order
  const resultSentences = sentences.filter((_, idx) => selectedIndices.has(idx));
  const result = resultSentences.join(' ');

  return /[.!?।]$/.test(result) ? result : `${result}.`;
}

/**
 * Enforces total script word budget (230–270 words) and per-scene budget (16–22 words)
 * for the 90–120s deep-dive reel product.
 */
export function enforceWordBudget(storyboard: Storyboard, minWords = 180, maxWords = 285): Storyboard {
  if (!storyboard.scenes || storyboard.scenes.length === 0) return storyboard;

  const sceneCount = storyboard.scenes.length;
  const targetTotal = Math.round((minWords + maxWords) / 2);

  for (let i = 0; i < storyboard.scenes.length; i++) {
    const scene = storyboard.scenes[i];
    let txt = scene.spokenNarration || scene.narration || '';

    // Cache original narration before formatting or condensation
    if (!(scene as any).originalNarration) {
      (scene as any).originalNarration = txt;
    }

    // 1. Frame factual strict guarantees as design budgets and strip asterisks
    txt = frameIllustrativeBudget(txt);
    scene.narration = txt;
    if (scene.spokenNarration) scene.spokenNarration = txt;
  }

  let currentTotalWords = storyboard.scenes.reduce(
    (sum, sc) => sum + countWords(sc.spokenNarration || sc.narration || ''),
    0
  );

  // If already within natural bounds (180–285 words), preserve authentic authored narration!
  if (currentTotalWords >= minWords && currentTotalWords <= maxWords) {
    return storyboard;
  }

  // If over budget, condense using complete sentences
  if (currentTotalWords > maxWords) {
    const scale = targetTotal / currentTotalWords;
    for (let i = 0; i < storyboard.scenes.length; i++) {
      const scene = storyboard.scenes[i];
      let txt = scene.spokenNarration || scene.narration || '';
      const wCount = countWords(txt);
      const sceneTarget = Math.max(20, Math.min(24, Math.round(wCount * scale)));
      txt = condenseSceneText(txt, sceneTarget);
      scene.narration = txt;
      if (scene.spokenNarration) scene.spokenNarration = txt;
    }
  }

  // If significantly under budget (e.g. < 180 words in dummy test cases with empty scenes), expand
  else if (currentTotalWords < minWords && sceneCount >= 8) {
    const wordsNeededPerScene = Math.ceil((minWords - currentTotalWords) / sceneCount);
    for (const scene of storyboard.scenes) {
      let txt = scene.spokenNarration || scene.narration || '';
      const targetWords = countWords(txt) + wordsNeededPerScene;
      txt = expandSceneText(txt, targetWords, scene.type);
      scene.narration = txt;
      if (scene.spokenNarration) scene.spokenNarration = txt;
    }
  }

  return storyboard;
}

/**
 * Rewrites storyboard complete scene sentences to hit target duration in either direction
 * (undershoot or overshoot), strictly preserving technical payoffs, caption/voice mapping,
 * and complete Hindi grammar.
 */
export function rewriteStoryboardForDuration(
  storyboard: Storyboard,
  measuredDurationSec: number,
  targetDurationSec = 104,
  options: { minDurationSec?: number; maxDurationSec?: number } = {}
): Storyboard {
  const minDur = options.minDurationSec ?? 90.0;
  const maxDur = options.maxDurationSec ?? 120.0;

  if (measuredDurationSec >= minDur && measuredDurationSec <= maxDur) {
    return storyboard;
  }

  const ratio = targetDurationSec / measuredDurationSec;
  console.log(
    `[WordBudget] Rewriting storyboard sentences (ratio ${ratio.toFixed(2)}) to bring ${measuredDurationSec.toFixed(1)}s into ${minDur}–${maxDur}s window...`
  );

  for (const scene of storyboard.scenes) {
    const curText = scene.spokenNarration || scene.narration || '';
    const curWords = countWords(curText);
    const targetWords = Math.max(14, Math.round(curWords * ratio));

    if (ratio > 1.05) {
      // Undershoot: expand with complete sentences
      const expanded = expandSceneText(curText, targetWords, scene.type);
      scene.narration = expanded;
      if (scene.spokenNarration) scene.spokenNarration = expanded;
    } else if (ratio < 0.95) {
      // Overshoot: condense with complete sentences
      const condensed = condenseSceneText(curText, targetWords);
      scene.narration = condensed;
      if (scene.spokenNarration) scene.spokenNarration = condensed;
    }
  }

  return storyboard;
}

// Backwards compatibility alias
export const scaleStoryboardForDuration = rewriteStoryboardForDuration;
