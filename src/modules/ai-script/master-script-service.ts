import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { Storyboard, StoryboardSchema, SceneTypeEnum } from '../contracts/storyboard.js';

dotenv.config();

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface ParsedScriptSections {
  hookOptions?: string;
  voiceoverScript?: string;
  visualDirection?: string;
  remotionSceneJson?: Record<string, any>;
  interviewCheatSheet?: string;
  tradeoffDilemma?: string;
  instagramCaption?: string;
}

export interface RenderState {
  status: 'idle' | 'rendering' | 'completed' | 'failed';
  progress: number;
  error?: string;
  mediaUrl?: string;
  qa?: any;
}

export interface ScriptSession {
  id: string;
  jobId?: string;
  topic: string;
  angle?: string;
  messages: ChatMessage[];
  currentMarkdown: string;
  sevenKeyScript?: {
    title?: string;
    hook?: string;
    problem?: string;
    solution?: string;
    tech_explained?: string;
    conclusion?: string;
    cta?: string;
    [k: string]: any;
  };
  sections: ParsedScriptSections;
  storyboard: Storyboard;
  finalized?: boolean;
  audioResult?: any;
  timeline?: any;
  stillPreviews?: any[];
  renderState?: RenderState;
  job?: any;
  createdAt: number;
  updatedAt: number;
}

const SESSIONS_DIR = path.resolve('media/sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// In-memory sessions store
const sessions = new Map<string, ScriptSession>();

function getMasterPromptTemplate(): string {
  const masterPath = path.resolve('MASTER_SCRIPT_PROMPT.md');
  if (fs.existsSync(masterPath)) {
    return fs.readFileSync(masterPath, 'utf8');
  }
  throw new Error('MASTER_SCRIPT_PROMPT.md not found in workspace root.');
}

function saveSessionToDisk(session: ScriptSession): void {
  try {
    const file = path.join(SESSIONS_DIR, `${session.id}.json`);
    fs.writeFileSync(file, JSON.stringify(session, null, 2), 'utf8');
  } catch (err) {
    console.warn(`[MasterScript] Warning: failed to save session ${session.id} to disk:`, err);
  }
}

function loadSessionFromDisk(id: string): ScriptSession | undefined {
  try {
    const file = path.join(SESSIONS_DIR, `${id}.json`);
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      sessions.set(id, data);
      return data;
    }
  } catch (err) {
    console.warn(`[MasterScript] Warning: failed to load session ${id} from disk:`, err);
  }
  return undefined;
}

export function parseTolerantJson(jsonStr: string): any {
  if (!jsonStr || !jsonStr.trim()) return null;
  let str = jsonStr.trim();

  // Strip code block fences if present
  str = str.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // 1. Direct parse attempt
  try {
    return JSON.parse(str);
  } catch {}

  // 2. Repair unescaped quotes inside single-line key-value pairs
  // e.g. "code": "SET lock "worker_uuid_77" NX EX 5",
  let repaired = str.split('\n').map(line => {
    const match = line.match(/^(\s*"[^"]+"\s*:\s*")(.*)("[\s,]*)$/);
    if (!match) return line;
    const [, prefix, middle, suffix] = match;
    const fixedMiddle = middle.replace(/(?<!\\)"/g, '\\"');
    return prefix + fixedMiddle + suffix;
  }).join('\n');

  // Strip trailing commas before } or ]
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

  try {
    return JSON.parse(repaired);
  } catch {}

  // 3. Stack-based quote and bracket closure for truncated JSON
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{') {
        stack.push('}');
      } else if (ch === '[') {
        stack.push(']');
      } else if (ch === '}' || ch === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === ch) {
          stack.pop();
        }
      }
    }
  }

  let attempt = repaired;
  if (inString) {
    attempt += '"';
  }

  // Remove any trailing dangling colons or incomplete property keys
  attempt = attempt.trim().replace(/,\s*$/, '');
  attempt = attempt.replace(/:\s*$/, ': null');
  attempt = attempt.replace(/"[^"]*"\s*:\s*null$/, '');
  attempt = attempt.replace(/,\s*$/, '');

  // Append closing brackets in reverse order
  const closing = [...stack].reverse().join('');
  attempt += closing;

  try {
    return JSON.parse(attempt);
  } catch (err: any) {
    // If closing failed because the last property key was dangling, try trimming back to the last complete scene
    const lastSceneEnd = attempt.lastIndexOf('},');
    if (lastSceneEnd !== -1) {
      const truncatedToScene = attempt.slice(0, lastSceneEnd + 1) + '\n]\n}';
      try {
        return JSON.parse(truncatedToScene);
      } catch {}
    }
  }

  return null;
}

export function tryParseSevenKeyJson(text: string): Record<string, any> | null {
  if (!text || typeof text !== 'string') return null;
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const obj = JSON.parse(stripped);
    if (obj && typeof obj === 'object' && (obj.hook || obj.hooks || obj.tech_explained || obj.problem || obj.solution)) {
      return obj;
    }
  } catch {}

  const startIdx = text.indexOf('{');
  const endIdx = text.lastIndexOf('}');
  if (startIdx !== -1 && endIdx > startIdx) {
    const candidate = text.substring(startIdx, endIdx + 1);
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj === 'object' && (obj.hook || obj.hooks || obj.tech_explained || obj.problem || obj.solution)) {
        return obj;
      }
    } catch {
      const tolerant = parseTolerantJson(candidate);
      if (tolerant && typeof tolerant === 'object' && (tolerant.hook || tolerant.hooks || tolerant.tech_explained || tolerant.problem || tolerant.solution)) {
        return tolerant;
      }
    }
  }
  return null;
}

export function parseSectionsFromMarkdown(markdown: string): ParsedScriptSections {
  const sections: ParsedScriptSections = {};

  // 1. Hook Options
  const hookMatch = markdown.match(/(?:###?\s*1\.?\s*(?:HOOK\s*OPTIONS|Hook\s*Options))([\s\S]*?)(?:###?\s*2\.?\s*(?:FINAL\s*VOICEOVER|Final\s*Voiceover|VOICEOVER))/i);
  if (hookMatch) sections.hookOptions = hookMatch[1].trim();

  // 2. Final Voiceover Script
  const voMatch = markdown.match(/(?:###?\s*2\.?\s*(?:FINAL\s*VOICEOVER\s*SCRIPT|Final\s*Voiceover\s*Script|VOICEOVER))([\s\S]*?)(?:###?\s*3\.?\s*(?:SCENE[- ]BY[- ]SCENE|Scene[- ]by[- ]scene))/i);
  if (voMatch) sections.voiceoverScript = voMatch[1].trim();

  // 3. Visual Direction
  const visualMatch = markdown.match(/(?:###?\s*3\.?\s*(?:SCENE[- ]BY[- ]SCENE\s*VISUAL\s*DIRECTION|Scene[- ]by[- ]scene\s*visual\s*direction))([\s\S]*?)(?:###?\s*4\.?\s*(?:REMOTION\s*SCENE\s*JSON|Remotion\s*Scene\s*JSON))/i);
  if (visualMatch) sections.visualDirection = visualMatch[1].trim();

  // 4. Remotion Scene JSON (with tolerant parsing for unescaped quotes & truncated fences)
  const sec4Match = markdown.match(/(?:###?\s*4\.?\s*(?:REMOTION\s*SCENE\s*JSON|Remotion\s*Scene\s*JSON))([\s\S]*?)(?:###?\s*5|$)/i);
  if (sec4Match) {
    const rawSec4 = sec4Match[1];
    const codeMatch = rawSec4.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
    const jsonCandidate = codeMatch ? codeMatch[1].trim() : rawSec4.trim();
    const parsed = parseTolerantJson(jsonCandidate);
    if (parsed) {
      sections.remotionSceneJson = parsed;
    } else {
      console.warn('[MasterScript] Failed to parse Remotion Scene JSON block with tolerant parser');
    }
  }

  // 5. Interview Cheat Sheet
  const cheatMatch = markdown.match(/(?:###?\s*5\.?\s*(?:INTERVIEW\s*CHEAT[- ]SHEET|Interview\s*Cheat[- ]Sheet))([\s\S]*?)(?:###?\s*6\.?\s*(?:SDE[- ]3\s*TRADEOFF|Tradeoff))/i);
  if (cheatMatch) sections.interviewCheatSheet = cheatMatch[1].trim();

  // 6. SDE-3 Tradeoff Dilemma
  const tradeoffMatch = markdown.match(/(?:###?\s*6\.?\s*(?:SDE[- ]3\s*TRADEOFF\s*DILEMMA|Tradeoff\s*Dilemma))([\s\S]*?)(?:###?\s*7\.?\s*(?:INSTAGRAM\s*CAPTION|Instagram\s*Caption))/i);
  if (tradeoffMatch) sections.tradeoffDilemma = tradeoffMatch[1].trim();

  // 7. Instagram Caption
  const instaMatch = markdown.match(/(?:###?\s*7\.?\s*(?:INSTAGRAM\s*CAPTION|Instagram\s*Caption)[\s\S]*?)([\s\S]*?)$/i);
  if (instaMatch) sections.instagramCaption = instaMatch[1].trim();

  return sections;
}

export function buildTopicGroundedFallbackScenes(
  topic: string,
  angle?: string,
  fullText: string = '',
): any[] {
  // Clean fullText of markdown headers, cues and tags
  const cleanFullText = fullText
    .replace(/\*\*(?:ACT\s*\d+|Act\s*\d+)[^*]*\*\*/gi, '')
    .replace(/<break\b[^>]*\/?>/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*`_]/g, '')
    .trim();

  // Extract clean spoken sentences
  const rawSentences = cleanFullText
    .split(/(?<=[.!?।\n])\s+/u)
    .map(s => s.replace(/^(?:Scene|Act)\s*\d+[:.\s-]*/i, '').trim())
    .filter(s => s.length > 8);

  const sentences = rawSentences.length > 0 ? rawSentences : [
    `${topic}: Understanding the core engineering mystery.`,
    'High concurrency causes severe race conditions and inconsistent state.',
    'Distributed coordination provides exclusive access and data integrity.',
    'In-memory state and atomic operations execute with sub-millisecond latency.',
    'Failovers and leases automatically protect against deadlocks.',
    'System design takeaways: eliminate race conditions and defend consistency.',
  ];

  // Canonical 12 scenes across the entire voiceover arc
  const targetCuts = 12;

  // If fewer sentences than targetCuts (12), subdivide sentences by clause boundaries
  const expandedSentences: string[] = [];
  for (const s of sentences) {
    if (expandedSentences.length + (sentences.length - expandedSentences.length) < targetCuts && s.length > 40) {
      const parts = s.split(/[,;—–]|\s+(?:aur|lekin|par|because|and|so|but|ki)\s+/i)
        .map(p => p.trim())
        .filter(p => p.length >= 10);
      if (parts.length >= 2) {
        expandedSentences.push(...parts);
        continue;
      }
    }
    expandedSentences.push(s);
  }
  while (expandedSentences.length < targetCuts) {
    expandedSentences.push(sentences[expandedSentences.length % sentences.length]);
  }

  const workingSentences = expandedSentences.length >= targetCuts ? expandedSentences : sentences;
  const sentencesPerCut = Math.max(1, Math.floor(workingSentences.length / targetCuts));

  const scenes: any[] = [];
  const assignedTypes: string[] = [];

  for (let idx = 0; idx < targetCuts; idx++) {
    const startIdx = idx * sentencesPerCut;
    const endIdx = idx === targetCuts - 1 ? workingSentences.length : (idx + 1) * sentencesPerCut;
    let cutSentences = workingSentences.slice(startIdx, Math.max(startIdx + 1, endIdx));
    if (cutSentences.length === 0 || !cutSentences[0]) {
      cutSentences = [workingSentences[idx % workingSentences.length] || topic];
    }
    const narration = cutSentences.join(' ');
    const textLower = narration.toLowerCase();

    let type = 'architecturePipeline';
    let onScreenText = `${topic.slice(0, 36).toUpperCase()}`;
    let keyPoint = cutSentences[0]?.slice(0, 70) || topic.slice(0, 70);
    let visualProps: Record<string, any> = {};

    if (idx === 0) {
      type = 'hook';
      onScreenText = `${topic.slice(0, 36).toUpperCase()}`;
      keyPoint = 'The Engineering Mystery';
      visualProps = {
        headline: topic,
        subtitle: angle || 'System Design & Distributed Architecture',
        questionKicker: cutSentences[0] || topic,
        badgeText: 'SYSTEM DESIGN',
      };
    } else if (idx === targetCuts - 1) {
      type = 'tradeoffHUD';
      onScreenText = 'INTERVIEW CHEAT-SHEET';
      keyPoint = 'Senior SDE Mental Model';
      visualProps = {
        title: 'SDE INTERVIEW CHEAT-SHEET',
        subtitle: 'Key architectural insights for your interviews',
        interviewPoints: workingSentences.slice(1, 4).map(s => s.slice(0, 90)),
        callToAction: 'Behind The Tech ko abhi follow karo!',
      };
    } else if (idx === targetCuts - 2) {
      type = 'summary';
      onScreenText = 'ARCHITECTURAL TAKEAWAYS';
      keyPoint = 'Core System Recap';
      const rawTakeaways = cutSentences.slice(0, 3).map(s => s.slice(0, 100));
      visualProps = {
        headline: `${topic.slice(0, 40)} Takeaways`,
        takeaways: rawTakeaways.length >= 2 ? rawTakeaways : [
          rawTakeaways[0] || `${topic} key architectural takeaway`,
          'Guaranteed state consistency and resilience under high concurrent load',
        ],
        callToAction: 'Behind The Tech ko abhi follow karo!',
      };
    } else if (/race\s*condition|concurrency|simultaneous|double\s*booking|contention|conflict/i.test(textLower)) {
      type = 'raceCondition';
      onScreenText = 'CONCURRENCY COLLISION';
      keyPoint = 'Parallel Workers Competing for Mutex';
      visualProps = {
        title: 'CONCURRENCY COLLISION',
        itemTitle: `${topic.slice(0, 24)} Mutex`,
        user1Name: 'Worker Instance A',
        user2Name: 'Worker Instance B',
        atomicQuery: '// Acquire exclusive atomic lock',
      };
    } else if (/queue|timeline|phase|step|delay|ttl|expire|retry|crash|microtask|macrotask|call\s*stack|event\s*loop/i.test(textLower)) {
      type = 'queueTimeline';
      onScreenText = 'EXECUTION TIMELINE';
      keyPoint = 'Phased State Progression';
      const isEventLoop = /microtask|macrotask|libuv|call\s*stack|nexttick/i.test(`${topic} ${narration}`);
      visualProps = {
        title: isEventLoop ? 'Event Loop & Queue Priority' : 'State Transition Pipeline',
        items: isEventLoop ? [
          { name: '1. V8 Synchronous Call Stack', priority: 'high', detail: 'Immediate execution frame' },
          { name: '2. process.nextTick Queue', priority: 'high', detail: 'Priority microtask queue' },
          { name: '3. Promise.then Microtask Queue', priority: 'high', detail: 'Drained before macrotask phase' },
          { name: '4. Timers Macrotask Queue', priority: 'medium', detail: 'setTimeout and setInterval' },
        ] : cutSentences.slice(0, 4).map((s, i) => ({
          name: `${i + 1}. Step ${i + 1}`,
          priority: i === 0 ? 'high' : 'medium',
          detail: s.slice(0, 80),
        })),
      };
    } else if (/\b(?:code|command|syntax|query|sql|function|handler|await|snippet)\b|\b(?:SELECT|UPDATE|INSERT|SETNX)\b/i.test(textLower)) {
      type = 'code';
      onScreenText = 'CORE IMPLEMENTATION';
      keyPoint = 'Atomic Execution Flow';
      visualProps = {
        filename: 'system_handler.ts',
        code: `// ${topic.slice(0, 30)} execution handler\nasync function handleTransaction(context) {\n  const lock = await acquireLock(context.id);\n  try {\n    return await executeAtomicState(context);\n  } finally {\n    await releaseLock(lock);\n  }\n}`,
        language: 'typescript',
      };
    } else if (/compare|versus|vs|naive|fail|slow|expensive|diff/i.test(textLower)) {
      type = 'comparison';
      onScreenText = 'NAIVE vs ENGINEERED';
      keyPoint = 'Architectural Bottleneck Comparison';
      visualProps = {
        leftTitle: 'Naive Approach',
        leftPoints: ['Uncoordinated execution', 'Bottlenecks under sudden high load'],
        rightTitle: 'Engineered Architecture',
        rightPoints: ['In-memory atomic coordination', 'Predictable sub-millisecond execution'],
        verdict: cutSentences[0]?.slice(0, 90) || 'Architectural coordination eliminates bottlenecks',
      };
    } else {
      type = 'architecturePipeline';
      onScreenText = 'PIPELINE ARCHITECTURE';
      keyPoint = 'System Request Flow';
      visualProps = {
        title: `${topic.slice(0, 32)} Architecture`,
        subtitle: 'End-to-End System Pipeline',
        redisLatencyMs: 1.5,
        steps: [
          { label: 'Client Ingestion', description: 'Incoming client request validated', status: 'completed' },
          { label: 'State Coordination', description: 'In-memory mutex / routing', status: 'active' },
          { label: 'Durable Persistence', description: 'Atomic state commit acknowledged', status: 'pending' },
        ],
      };
    }

    // Prevent immediate consecutive duplicate types
    if (assignedTypes.length > 0 && assignedTypes[assignedTypes.length - 1] === type) {
      if (type === 'architecturePipeline') {
        type = 'requestFlow';
        visualProps = {
          title: 'Request Pipeline Flow',
          steps: [
            { label: 'Client Gateway', description: 'Request routed', status: 'active' },
            { label: 'In-Memory State', description: 'Lock acquired', status: 'completed' },
            { label: 'Storage Commit', description: 'Durable write acknowledged', status: 'cached' },
          ],
        };
      } else {
        type = 'architecturePipeline';
      }
    }
    assignedTypes.push(type);

    scenes.push({
      id: `scene-${idx + 1}`,
      sceneIndex: idx,
      type,
      narration,
      onScreenText,
      technicalKeyPoint: keyPoint,
      durationTargetSec: Math.min(60, Math.max(2, Math.round(narration.split(/\s+/).length / 2.35))),
      visualProps,
    });
  }

  return scenes;
}

export function buildStoryboardFromParsed(
  topic: string,
  sections: ParsedScriptSections,
  fullMarkdown = '',
  angle?: string,
): Storyboard {
  const jsonMeta = sections.remotionSceneJson?.meta || {};
  const jsonScenes = sections.remotionSceneJson?.scenes || [];

  let scenes: any[] = [];

  // Parse acts from voiceover script reliably
  const voText = sections.voiceoverScript || fullMarkdown || '';
  const actChunks: string[] = [];
  for (let a = 1; a <= 6; a++) {
    const actPattern = new RegExp(`(?:Act\\s*${a}|#+\\s*Act\\s*${a})\\s*[-—:]?\\s*([\\s\\S]*?)(?=(?:Act\\s*\\d|#+\\s*Act\\s*\\d|###|---|$)|\$)`, 'i');
    const match = voText.match(actPattern);
    if (match && match[1].trim()) {
      actChunks.push(match[1].trim());
    }
  }

  if (jsonScenes.length > 0) {
    for (let i = 0; i < jsonScenes.length; i++) {
      const js = jsonScenes[i];
      
      // Clean readable text extractor that NEVER leaks raw JSON braces or key-value objects
      const extractCleanText = (v: any, fallback = ''): string => {
        if (!v) return fallback;
        if (typeof v === 'string') {
          let s = v.trim();
          if (s.startsWith('[') || s.startsWith('{')) {
            try {
              return extractCleanText(JSON.parse(s), fallback);
            } catch {
              s = s.replace(/[\{\}\[\]"']/g, '').replace(/\b(text|position|color|size|delay|type|id|side)\b\s*:\s*/gi, '').trim();
            }
          }
          // Strip raw markdown bold/italic asterisks (e.g. **H3 Spatial Indexing** -> H3 Spatial Indexing)
          s = s.replace(/\*{1,2}/g, '').trim();
          return s || fallback;
        }
        if (Array.isArray(v)) {
          const items = v
            .map((item) => {
              if (!item) return '';
              if (typeof item === 'string') return extractCleanText(item, '');
              if (typeof item === 'object') {
                return (
                  item.text ||
                  item.headline ||
                  item.label ||
                  item.title ||
                  item.screen_content ||
                  item.name ||
                  item.value ||
                  ''
                );
              }
              return String(item).trim();
            })
            .filter(Boolean);
          return items.length > 0 ? items.slice(0, 3).join(' • ') : fallback;
        }
        if (typeof v === 'object') {
          return (
            v.text ||
            v.headline ||
            v.label ||
            v.title ||
            v.screen_content ||
            v.name ||
            v.value ||
            fallback
          );
        }
        return String(v).trim() || fallback;
      };

      const narration = extractCleanText(js.narration || actChunks[i], '');
      const onScreenText = extractCleanText(js.onScreenText || js.text, topic).slice(0, 100);
      const keyPoint = extractCleanText(js.technicalKeyPoint || js.visualProps?.subtitle,
        narration.split(/(?<=[.!?।])\s+/u)[0]);
      const typed = SceneTypeEnum.safeParse(js.type);
      const type = typed.success ? typed.data : 'hook';
      const cleanVisualProps: Record<string, any> = {
        headline: onScreenText,
        title: onScreenText,
        subtitle: keyPoint,
        ...(js.visualProps || {})
      };
      if (cleanVisualProps.baseDeliveryFee !== undefined) cleanVisualProps.baseDeliveryFee = String(cleanVisualProps.baseDeliveryFee);
      if (cleanVisualProps.surgeDeliveryFee !== undefined) cleanVisualProps.surgeDeliveryFee = String(cleanVisualProps.surgeDeliveryFee);
      if (cleanVisualProps.itemPrice !== undefined) cleanVisualProps.itemPrice = String(cleanVisualProps.itemPrice);
      if (cleanVisualProps.surgeAmount !== undefined) cleanVisualProps.surgeAmount = String(cleanVisualProps.surgeAmount);
      if (cleanVisualProps.surgeMultiplier !== undefined) cleanVisualProps.surgeMultiplier = String(cleanVisualProps.surgeMultiplier);
      if (cleanVisualProps.orderCount !== undefined) cleanVisualProps.orderCount = Number(cleanVisualProps.orderCount) || 52;
      if (cleanVisualProps.riderCount !== undefined) cleanVisualProps.riderCount = Number(cleanVisualProps.riderCount) || 5;

      if (type === 'smartphoneMockup') {
        if (!cleanVisualProps.appName) cleanVisualProps.appName = topic.split(/\s+/)[0]?.toUpperCase() || 'APP';
        if (!cleanVisualProps.itemName) cleanVisualProps.itemName = onScreenText || `${topic.slice(0, 30)} Request`;
      }

      if (type === 'h3SpatialMap') {
        if (!cleanVisualProps.hotHexId) cleanVisualProps.hotHexId = '#ZONE_A4';
        if (!cleanVisualProps.orderCount) cleanVisualProps.orderCount = 64;
        if (!cleanVisualProps.riderCount) cleanVisualProps.riderCount = 12;
        if (!cleanVisualProps.subtitle) cleanVisualProps.subtitle = 'O(1) Spatial Partitioning Grid';
      }

      if (type === 'queueTimeline') {
        if (!cleanVisualProps.items || cleanVisualProps.items.length === 0) {
          cleanVisualProps.items = [
            { name: '1. Ingestion & Validation', priority: 'medium', detail: 'Validate incoming request payload' },
            { name: '2. Concurrency Lock', priority: 'high', detail: 'Acquire exclusive lock on resource' },
            { name: '3. State Execution', priority: 'high', detail: 'Execute atomic state transition' },
            { name: '4. Persistence Commit', priority: 'medium', detail: 'Commit state update and release lock' },
          ];
        }
      }

      if (type === 'code') {
        const VALID_LANGS = new Set(['javascript', 'typescript', 'python', 'sql', 'bash', 'json', 'lua', 'sh']);
        if (!cleanVisualProps.language || !VALID_LANGS.has(cleanVisualProps.language)) {
          cleanVisualProps.language = 'typescript';
        }
        if (!cleanVisualProps.filename) cleanVisualProps.filename = 'handler.ts';
        if (!cleanVisualProps.code) {
          cleanVisualProps.code = `// Execute ${topic.slice(0, 30)}\nconst result = await handleTransaction(request);\nconsole.log("Success:", result);`;
        }
      }

      if (type === 'raceCondition') {
        const isSurgeTopic = /surge\s*pricing|zomato.*surge|uber.*surge/i.test(topic);
        if (isSurgeTopic && (!cleanVisualProps.itemTitle || /seat|concert/i.test(cleanVisualProps.itemTitle))) {
          cleanVisualProps.itemTitle = 'Hex #88619A0A4 Surge Mutex';
          cleanVisualProps.user1Name = 'Order Worker A';
          cleanVisualProps.user2Name = 'Surge Worker B';
          cleanVisualProps.atomicQuery = 'SET lock:hex:88619A0A4 "worker_uuid_77" NX EX 5';
        } else {
          if (!cleanVisualProps.itemTitle) {
            cleanVisualProps.itemTitle = `${onScreenText || topic.slice(0, 24)} Mutex`;
          }
          if (!cleanVisualProps.user1Name) cleanVisualProps.user1Name = 'Worker Instance 1';
          if (!cleanVisualProps.user2Name) cleanVisualProps.user2Name = 'Worker Instance 2';
          if (!cleanVisualProps.atomicQuery) cleanVisualProps.atomicQuery = '// Atomic lock acquisition';
        }
      }

      if (type === 'architecturePipeline') {
        if (!cleanVisualProps.redisLatencyMs) cleanVisualProps.redisLatencyMs = 1.5;
        if (!cleanVisualProps.atomicCommand) {
          cleanVisualProps.atomicCommand = `// Pipeline step for ${topic.slice(0, 24)}`;
        }
        if (Array.isArray(cleanVisualProps.steps)) {
          const VALID_STATUSES = new Set(['completed', 'active', 'pending']);
          cleanVisualProps.steps = cleanVisualProps.steps.slice(0, 5).map((st: any) => ({
            label: String(st?.label || 'Step'),
            description: String(st?.description || 'Pipeline execution'),
            status: VALID_STATUSES.has(st?.status) ? st.status : 'completed',
          }));
        }
      }

      if (type === 'queueTimeline') {
        const VALID_PRIORITIES = new Set(['high', 'medium', 'low', 'microtask', 'macrotask']);
        const isSurgeTopic = /surge\s*pricing|zomato.*surge|uber.*surge/i.test(topic);
        const hasMicrotasks = Array.isArray(cleanVisualProps.items) && cleanVisualProps.items.some((it: any) => /microtask|macrotask/i.test(it.name || it.detail || ''));

        if (isSurgeTopic && hasMicrotasks) {
          cleanVisualProps.items = [
            { name: '1. Lock Held by Worker A', priority: 'medium', detail: 'SET hex_mutex:88619A worker_A NX EX 5' },
            { name: '2. Worker A Crashes / Disconnects', priority: 'high', detail: 'Worker ungracefully dies before releasing lock' },
            { name: '3. Redis TTL Expiry (5s)', priority: 'high', detail: 'Key automatically evicted by Redis engine' },
            { name: '4. Worker B Acquires Lock', priority: 'medium', detail: 'SET hex_mutex:88619A worker_B NX EX 5 succeeds' },
          ];
        } else if (!Array.isArray(cleanVisualProps.items) || cleanVisualProps.items.length < 2) {
          cleanVisualProps.items = [
            { name: 'Step 1: Ingestion & Lock', priority: 'high', detail: 'Acquire atomic state lock' },
            { name: 'Step 2: Processing & Commit', priority: 'medium', detail: 'Execute state transition' },
          ];
        } else {
          cleanVisualProps.items = cleanVisualProps.items.slice(0, 5).map((it: any) => {
            let prio = String(it?.priority || 'medium').toLowerCase();
            if (!VALID_PRIORITIES.has(prio)) {
              if (/high|crit|p0|p1|urgent/i.test(prio)) prio = 'high';
              else if (/low|p3|p4|back/i.test(prio)) prio = 'low';
              else if (/micro/i.test(prio)) prio = 'microtask';
              else if (/macro/i.test(prio)) prio = 'macrotask';
              else prio = 'medium';
            }
            return {
              name: String(it?.name || it?.label || 'Queue Item'),
              priority: prio,
              detail: String(it?.detail || it?.description || 'Execution step'),
              cue: it?.cue ? String(it.cue) : undefined,
            };
          });
        }
      }

      if (type === 'collection') {
        if (!Array.isArray(cleanVisualProps.items) || cleanVisualProps.items.length < 2) {
          cleanVisualProps.items = [
            { label: 'Component A', selected: true },
            { label: 'Component B', selected: false },
          ];
        } else {
          cleanVisualProps.items = cleanVisualProps.items.slice(0, 12).map((it: any) => ({
            label: String(it?.label || it?.name || 'Item'),
            selected: Boolean(it?.selected),
          }));
        }
        if (!cleanVisualProps.title) cleanVisualProps.title = onScreenText || 'System Components';
        if (!cleanVisualProps.cue) cleanVisualProps.cue = cleanVisualProps.items[0]?.label || 'Components';
        if (!cleanVisualProps.result) cleanVisualProps.result = 'Unified System';
      }

      if (type === 'comparison') {
        if (!cleanVisualProps.leftTitle) cleanVisualProps.leftTitle = 'Naive Approach';
        if (!cleanVisualProps.leftCode) cleanVisualProps.leftCode = 'SELECT * FROM items WHERE id = 1';
        if (!Array.isArray(cleanVisualProps.leftPoints) || cleanVisualProps.leftPoints.length < 1) {
          cleanVisualProps.leftPoints = ['Direct synchronous read', 'Race condition on write'];
        } else {
          cleanVisualProps.leftPoints = cleanVisualProps.leftPoints.map(String).slice(0, 4);
        }
        if (!cleanVisualProps.rightTitle) cleanVisualProps.rightTitle = 'Optimized Architecture';
        if (!cleanVisualProps.rightCode) cleanVisualProps.rightCode = 'SET lock:item_101 user_A NX EX 10';
        if (!Array.isArray(cleanVisualProps.rightPoints) || cleanVisualProps.rightPoints.length < 1) {
          cleanVisualProps.rightPoints = ['In-memory atomic guarantee', 'Safe lock expiration'];
        } else {
          cleanVisualProps.rightPoints = cleanVisualProps.rightPoints.map(String).slice(0, 4);
        }
        if (!cleanVisualProps.verdict) cleanVisualProps.verdict = 'Winner: Optimized Architecture';
      }

      if (type === 'summary') {
        if (!cleanVisualProps.headline) cleanVisualProps.headline = 'Mental Model Recap';
        if (!Array.isArray(cleanVisualProps.takeaways) || cleanVisualProps.takeaways.length < 2) {
          cleanVisualProps.takeaways = [
            'Atomic in-memory checks eliminate race conditions',
            'Distributed lock TTL prevents system deadlocks',
          ];
        } else {
          cleanVisualProps.takeaways = cleanVisualProps.takeaways.map(String).slice(0, 4);
          if (cleanVisualProps.takeaways.length < 2) {
            cleanVisualProps.takeaways.push('Resilient failure handling');
          }
        }
        if (!cleanVisualProps.callToAction) {
          cleanVisualProps.callToAction = 'Save this for system design interviews & follow for more!';
        }
      }

      if (type === 'tradeoffHUD') {
        if (!Array.isArray(cleanVisualProps.interviewPoints) || cleanVisualProps.interviewPoints.length < 1) {
          cleanVisualProps.interviewPoints = [
            'Evaluate latency vs memory overhead tradeoffs',
            'Ensure atomic state transitions across nodes',
            'Use TTL leases to prevent deadlocks on node failure',
          ];
        } else {
          cleanVisualProps.interviewPoints = cleanVisualProps.interviewPoints.map(String).slice(0, 5);
        }
      }

      if (type === 'requestFlow') {
        const VALID_STATUSES = new Set(['active', 'completed', 'bypassed', 'cached']);
        if (!Array.isArray(cleanVisualProps.steps) || cleanVisualProps.steps.length < 2) {
          cleanVisualProps.steps = [
            { label: 'Client Gateway', description: 'Incoming request dispatch', status: 'active' },
            { label: 'In-Memory State', description: 'Sub-millisecond verification', status: 'completed' },
          ];
        } else {
          cleanVisualProps.steps = cleanVisualProps.steps.slice(0, 5).map((st: any) => ({
            label: String(st?.label || 'Step'),
            description: String(st?.description || 'Pipeline execution'),
            status: VALID_STATUSES.has(st?.status) ? st.status : 'completed',
            cue: st?.cue ? String(st.cue) : undefined,
          }));
          if (cleanVisualProps.steps.length < 2) {
            cleanVisualProps.steps.push({ label: 'Storage / Cache', description: 'In-memory state lookup', status: 'completed' });
          }
        }
      }

      scenes.push({
        id: `scene-${i+1}`, sceneIndex: i, type, narration, onScreenText,
        spokenNarration: js.spokenNarration || undefined,
        technicalKeyPoint: keyPoint,
        durationTargetSec: Math.max(1, Math.min(60, Math.round((js.durationFrames || 180) / 30))),
        visualProps: cleanVisualProps,
      });
    }
  } else {
    // If provider Remotion JSON was truncated or failed to parse, decompose the voiceover into 12 canonical topic-grounded typed scenes
    const allVoiceoverText = (sections.voiceoverScript || actChunks.join(' ') || fullMarkdown).trim();
    scenes = buildTopicGroundedFallbackScenes(topic, angle, allVoiceoverText);
  }

  // Bound to 12-16 scenes
  if (scenes.length > 16) {
    scenes = scenes.slice(0, 16);
  }

  const finalScenes = scenes;
  const safeTitle = (jsonMeta.title || topic).trim().slice(0, 95);
  const safeHook = (finalScenes[0]?.narration || 'Engineering Hook in System Design').slice(0, 200);

  return StoryboardSchema.parse({
    topic: topic.slice(0, 195),
    angle: angle || (fullMarkdown.match(/ANGLE:\s*([^\n\r]+)/i)?.[1]?.trim()) || undefined,
    title: safeTitle.length < 5 ? `${safeTitle} Explained` : safeTitle,
    hook: safeHook.length < 10 ? `${safeHook} in depth breakdown.` : safeHook,
    learningObjective: `Understand architecture, data flows and tradeoffs for ${topic}`,
    targetAudience: 'Software Engineers & Backend Developers',
    format: 'short',
    estimatedDurationSec: Math.round(Math.max(20, Math.min(240, Number(jsonMeta.durationSeconds) || 105))),
    hashtags: ['#systemdesign', '#backend', '#softwareengineering', '#techshorts', '#coding'],
    scenes: finalScenes,
  });
}

export class MasterScriptService {
  private geminiKey: string;
  private model: string;

  constructor() {
    this.geminiKey = process.env.GEMINI_API_KEY || '';
    this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  private async callLLM(prompt: string, systemInstruction: string): Promise<string> {
    // 1. Try Gemini first if key available
    if (this.geminiKey) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.geminiKey}`;

        const body = {
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text;
        } else {
          console.warn(`[MasterScript] Gemini returned HTTP ${res.status}, falling back to Groq...`);
        }
      } catch (err: any) {
        console.warn(`[MasterScript] Gemini request failed (${err.message}), falling back to Groq...`);
      }
    }

    // 2. High-speed Groq fallback with generous quota
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 8192,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) return text;
        } else {
          console.warn(`[MasterScript] Groq returned HTTP ${res.status}`);
        }
      } catch (err: any) {
        console.warn(`[MasterScript] Groq fallback failed: ${err.message}`);
      }
    }

    throw new Error('All LLM providers (Gemini & Groq) failed or rate limits exceeded.');
  }

  async startScriptSession(topic: string, angle?: string, existingSessionId?: string): Promise<ScriptSession> {
    const systemPrompt = getMasterPromptTemplate();
    const userPrompt = `TOPIC: ${topic.trim()}\nANGLE: ${angle ? angle.trim() : 'Focus on real-world production failure, edge cases and distributed architecture'}`;

    console.log(`[MasterScript] Generating initial master script for Topic: "${topic}"...`);
    let responseText = await this.callLLM(userPrompt, systemPrompt);

    // Try parsing as 7-key JSON (Contract V4)
    const sevenKeyObj = tryParseSevenKeyJson(responseText);
    if (sevenKeyObj) {
      console.log(`[MasterScript] Successfully parsed 7-key JSON script: "${sevenKeyObj.title || topic}"`);
      return this.createCustomSession(sevenKeyObj, topic, existingSessionId, angle);
    }

    let sections = parseSectionsFromMarkdown(responseText);

    // Automatic recovery if Section 4 JSON was truncated or has fewer than 10 scenes
    const sceneCount = sections.remotionSceneJson?.scenes?.length || 0;
    if (sceneCount < 10) {
      console.warn(`[MasterScript] Provider response truncated or incomplete (${sceneCount} scenes). Initiating automatic LLM regeneration for Section 4 Remotion Scene JSON...`);
      try {
        const repairPrompt = `The previous Remotion Scene JSON in Section 4 was truncated or had only ${sceneCount} scenes (target is 10 to 12 scenes for a 75-85 second reel).
Here is the Final Voiceover Script:
${sections.voiceoverScript || responseText}
${sections.visualDirection || ''}

Generate ONLY the valid Section 4 Remotion Scene JSON containing 10 to 12 scenes corresponding to the 5 acts in the voiceover script.
Rules:
- Output strictly valid JSON enclosed inside \`\`\`json ... \`\`\`
- Escape any double quotes inside string fields (like code, filenames, labels, titles) as \\\"
- The JSON object must have "meta" (title, durationSeconds: 80) and "scenes" (array of 10-12 scenes with id, sceneIndex, type, narration, onScreenText, technicalKeyPoint, durationFrames, visualProps).
- Valid scene types: smartphoneMockup, h3SpatialMap, architecturePipeline, raceCondition, code, comparison, queueTimeline, tradeoffHUD, summary.
- The scenes must tell ONE continuous story without repeated summary scenes in the middle. The recap summary must only be at Scene 11, followed by Scene 12 tradeoffHUD.`;

        const repairResponse = await this.callLLM(repairPrompt, 'You are an expert system design video animator. Output ONLY valid JSON inside ```json ... ```.');
        const parsedDirect = parseTolerantJson(repairResponse);
        if (parsedDirect?.scenes && Array.isArray(parsedDirect.scenes) && parsedDirect.scenes.length >= 10) {
          sections.remotionSceneJson = parsedDirect;
          console.log(`[MasterScript] Successfully recovered Section 4 JSON! Recovered ${parsedDirect.scenes.length} scenes.`);
          if (responseText.match(/###?\s*4\.?\s*(?:REMOTION\s*SCENE\s*JSON|Remotion\s*Scene\s*JSON)/i)) {
            responseText = responseText.replace(
              /(###?\s*4\.?\s*(?:REMOTION\s*SCENE\s*JSON|Remotion\s*Scene\s*JSON))[\s\S]*?(?=###?\s*5|$)/i,
              `$1\n\n\`\`\`json\n${JSON.stringify(sections.remotionSceneJson, null, 2)}\n\`\`\`\n\n`
            );
          } else {
            responseText += `\n\n### 4. REMOTION SCENE JSON\n\`\`\`json\n${JSON.stringify(sections.remotionSceneJson, null, 2)}\n\`\`\`\n\n`;
          }
        }
      } catch (repairErr: any) {
        console.warn(`[MasterScript] Automatic repair attempt failed: ${repairErr.message}`);
      }

      // If still fewer than 10 scenes, use canonical 12-scene decomposition of the authentic voiceover
      if (!sections.remotionSceneJson?.scenes || sections.remotionSceneJson.scenes.length < 10) {
        const allVoiceoverText = (sections.voiceoverScript || responseText).trim();
        const fullScenes = buildTopicGroundedFallbackScenes(topic, angle, allVoiceoverText);
        sections.remotionSceneJson = {
          meta: { title: topic, durationSeconds: 80 },
          scenes: fullScenes,
        };
        console.log(`[MasterScript] Applied canonical 12-scene voiceover-grounded storyboard across all 5 acts.`);
      }
    }

    const storyboard = buildStoryboardFromParsed(topic, sections, responseText, angle);
    const existingSession = existingSessionId ? this.getSession(existingSessionId) : undefined;
    const id = existingSessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const session: ScriptSession = {
      ...(existingSession || {}),
      id,
      topic,
      angle,
      messages: [
        {
          role: 'user',
          content: `TOPIC: ${topic}${angle ? ` | ANGLE: ${angle}` : ''}`,
          timestamp: Date.now(),
        },
        {
          role: 'assistant',
          content: responseText,
          timestamp: Date.now(),
        },
      ],
      currentMarkdown: responseText,
      sections,
      storyboard,
      finalized: false,
      renderState: existingSession?.renderState || { status: 'idle', progress: 0 },
      createdAt: existingSession?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    this.clearMedia(session);
    sessions.set(id, session);
    saveSessionToDisk(session);
    return session;
  }

  async chatRefine(sessionId: string, userInstruction: string): Promise<ScriptSession> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found. Please start a new script session.`);
    }

    if (session.sevenKeyScript) {
      const systemPrompt =
        getMasterPromptTemplate() +
        `\n\nCRITICAL EDITING INSTRUCTION:
The user is requesting a refinement, edit, or tweak to the current 7-key JSON script.
Apply the user's specific feedback directly into the script.
Maintain the exact seven fields in valid JSON format:
{
  "title": "...",
  "hook": "...",
  "problem": "...",
  "solution": "...",
  "tech_explained": "...",
  "conclusion": "...",
  "cta": "..."
}
Output ONLY the raw valid JSON object.`;

      const prompt = `Current 7-Key Script JSON:\n${JSON.stringify(session.sevenKeyScript, null, 2)}\n\nUser Revision Request:\n${userInstruction}\n\nDeliver the updated complete 7-key JSON script:`;

      console.log(`[MasterScript] Refining 7-key script for session ${sessionId}...`);
      const responseText = await this.callLLM(prompt, systemPrompt);
      const updatedObj = tryParseSevenKeyJson(responseText);
      if (updatedObj) {
        return this.createCustomSession(updatedObj, session.topic, sessionId, session.angle);
      }
    }

    const systemPrompt =
      getMasterPromptTemplate() +
      `\n\nCRITICAL EDITING INSTRUCTION:
The user is requesting a refinement, edit, or tweak to the current script.
Maintain the exact 7-part format and technical rigor from the Master Prompt.
Apply the user's specific feedback directly into the script.
Always return the full updated 7 sections so the script remains complete and self-contained.`;

    const chatContext = `Current Script:\n${session.currentMarkdown}\n\nUser Revision Request:\n${userInstruction}\n\nProvide the complete updated script reflecting these changes:`;

    console.log(`[MasterScript] Refining session ${sessionId} with user instruction: "${userInstruction.slice(0, 50)}..."`);
    const updatedResponse = await this.callLLM(chatContext, systemPrompt);

    const sections = parseSectionsFromMarkdown(updatedResponse);
    const storyboard = buildStoryboardFromParsed(session.topic, sections, updatedResponse, session.angle);
    session.messages.push({ role: 'user', content: userInstruction, timestamp: Date.now() });
    session.messages.push({ role: 'assistant', content: updatedResponse, timestamp: Date.now() });
    session.currentMarkdown = updatedResponse;
    session.sections = sections;
    session.storyboard = storyboard;
    this.clearMedia(session);
    session.finalized = false;
    session.updatedAt = Date.now();

    sessions.set(sessionId, session);
    saveSessionToDisk(session);
    return session;
  }

  finalizeScript(sessionId: string, customMarkdown?: string): ScriptSession {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found.`);
    }

    if (customMarkdown?.trim() && customMarkdown !== session.currentMarkdown) {
      const sections = parseSectionsFromMarkdown(customMarkdown);
      const storyboard = buildStoryboardFromParsed(session.topic, sections, customMarkdown, session.angle);
      this.clearMedia(session);
      session.currentMarkdown = customMarkdown;
      session.sections = sections;
      session.storyboard = storyboard;
    }

    if (!session.storyboard?.scenes || session.storyboard.scenes.length === 0) {
      session.storyboard = buildStoryboardFromParsed(session.topic, session.sections, session.currentMarkdown, session.angle);
    }

    session.finalized = true;
    session.updatedAt = Date.now();
    sessions.set(sessionId, session);
    saveSessionToDisk(session);
    console.log(`[MasterScript] Session ${sessionId} locked and finalized with ${session.storyboard.scenes.length} scenes.`);
    return session;
  }

  async createCustomSession(
    customScript: string | Record<string, any>,
    topicFallback = 'Creator Custom Script',
    existingSessionId?: string,
    angleOverride?: string
  ): Promise<ScriptSession> {
    const { parseCustomScriptToStoryboard } = await import('./custom-script-parser.js');
    let scriptObj: Record<string, any> = {};
    if (typeof customScript === 'string') {
      try {
        scriptObj = JSON.parse(customScript);
      } catch {
        const parsed = tryParseSevenKeyJson(customScript);
        scriptObj = parsed || { title: topicFallback, hook: customScript };
      }
    } else {
      scriptObj = customScript;
    }

    const storyboard = await parseCustomScriptToStoryboard(scriptObj, topicFallback);
    const existing = existingSessionId ? this.getSession(existingSessionId) : undefined;
    const id = existingSessionId || `session_${randomUUID()}`;
    const rawText = typeof customScript === 'string' ? customScript : JSON.stringify(scriptObj, null, 2);

    const session: ScriptSession = {
      ...(existing || {}),
      id,
      topic: scriptObj.title || storyboard.title || topicFallback,
      angle: angleOverride || existing?.angle || 'Behind The Tech Tech Reel',
      messages: existing?.messages || [
        { role: 'assistant', content: 'Script parsed and validated successfully.' }
      ],
      currentMarkdown: rawText,
      sevenKeyScript: scriptObj,
      sections: {
        voiceoverScript: storyboard.scenes.map((s) => s.narration).join('\n\n'),
        remotionSceneJson: {
          meta: { title: storyboard.title, durationSeconds: storyboard.estimatedDurationSec },
          scenes: storyboard.scenes,
        },
      },
      storyboard,
      finalized: true,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    this.clearMedia(session);
    sessions.set(id, session);
    saveSessionToDisk(session);
    console.log(`[MasterScript] Created custom script session ${id} with ${storyboard.scenes.length} scenes.`);
    return session;
  }

  private clearMedia(session: ScriptSession) {
    delete session.audioResult;
    delete session.timeline;
    delete session.stillPreviews;
    session.renderState = {status: 'idle', progress: 0};
  }

  updateSession(session: ScriptSession): void {
    session.updatedAt = Date.now();
    sessions.set(session.id, session);
    saveSessionToDisk(session);
  }

  getSession(sessionId: string): ScriptSession | undefined {
    let session = sessions.get(sessionId);
    if (!session) {
      session = loadSessionFromDisk(sessionId);
    }
    return session;
  }

  listSessions(): ScriptSession[] {
    try {
      const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
      const list: ScriptSession[] = [];
      for (const f of files) {
        const id = f.replace('.json', '');
        const s = this.getSession(id);
        if (s) list.push(s);
      }
      return list.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return Array.from(sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    }
  }
}

export const masterScriptService = new MasterScriptService();
