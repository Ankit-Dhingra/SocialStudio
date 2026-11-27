import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { Storyboard, StoryboardSchema, SceneTypeEnum } from '../contracts/storyboard.js';
import { convertCreatorScriptToStoryboard, decodePastedScript, isCreatorScript, parseCustomScriptToStoryboard } from './custom-script-parser.js';
import type { ReelVisualAssets } from '../render/reel-visual-assets.js';
import type { AutomaticVisualDraft } from '../render/automatic-visual-directives.js';
import type { StoryDirectionOverrides } from '../video/visual-story.js';

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
  ownerDigest?: string;
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
  voiceoverNeedsRefresh?: boolean;
  timeline?: any;
  stillPreviews?: any[];
  visualAssets?: ReelVisualAssets;
  automaticVisualDraft?: AutomaticVisualDraft;
  storyDirections?: StoryDirectionOverrides;
  motionPreview?: {
    visualRevision?: string;
    mediaUrl: string;
    sceneIndex: number;
    scope?: 'scene' | 'sequence' | 'hook' | 'transition' | 'ending';
    durationSec: number;
    direction?: ReelVisualAssets['direction'];
    shots: Array<{
      id: string; title: string; kind: string; fromSec: number; action?: string; camera?: string; footage?: boolean;
      appName?: string; hasScreenCapture?: boolean;
    }>;
  };
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
  return fs.readFileSync(new URL('./master-script-prompt.txt', import.meta.url), 'utf8');
}

function saveSessionToDisk(session: ScriptSession, required = false): void {
  try {
    const file = path.join(SESSIONS_DIR, `${session.id}.json`);
    const serialized = JSON.stringify(session, null, 2);
    if (required) {
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        fs.writeFileSync(temporary, serialized, { flag: 'wx', encoding: 'utf8' });
        fs.renameSync(temporary, file);
      } finally { fs.rmSync(temporary, { force: true }); }
    } else fs.writeFileSync(file, serialized, 'utf8');
  } catch (err) {
    if (required) throw err;
    console.warn(`[MasterScript] Warning: failed to save session ${session.id} to disk:`, err);
  }
}

function loadSessionFromDisk(id: string): ScriptSession | undefined {
  try {
    const file = path.join(SESSIONS_DIR, `${id}.json`);
    if (fs.existsSync(file)) {
      const data: ScriptSession = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (restoreLegacyNarration(data)) saveSessionToDisk(data);
      sessions.set(id, data);
      return data;
    }
  } catch (err) {
    console.warn(`[MasterScript] Warning: failed to load session ${id} from disk:`, err);
  }
  return undefined;
}

export function restoreLegacyNarration(session: ScriptSession): boolean {
  const approvedCuts = session.sections?.remotionSceneJson?.scenes;
  const approvedById = new Map<string, { narration?: string }>(
    Array.isArray(approvedCuts) ? approvedCuts.filter(cut => typeof cut?.id === 'string').map(cut => [cut.id, cut]) : [],
  );
  let hasLegacyMarker = false;
  let needsVoiceover = false;
  const scenes = session.storyboard?.scenes?.map(scene => {
    const { originalNarration, ...current } = scene as typeof scene & { originalNarration?: string };
    if (typeof originalNarration !== 'string' || !originalNarration.trim()) return scene;
    hasLegacyMarker = true;
    // The old TTS gate saved the explicitly spoken text in this field when an override existed.
    const approved = approvedById.get(scene.id)?.narration;
    const spokenNarration = scene.spokenNarration === undefined ? undefined : originalNarration;
    const narration = spokenNarration !== undefined && approved && approved !== scene.narration ? approved : originalNarration;
    needsVoiceover ||= narration !== scene.narration || spokenNarration !== scene.spokenNarration;
    return { ...current, narration, spokenNarration };
  });
  if (!hasLegacyMarker || !scenes) return false;
  session.storyboard = { ...session.storyboard, scenes };
  if (needsVoiceover) {
    session.voiceoverNeedsRefresh = true;
    delete session.audioResult;
    delete session.timeline;
    delete session.stillPreviews;
    delete session.visualAssets;
    delete session.automaticVisualDraft;
    delete session.motionPreview;
    delete session.storyDirections;
    if (session.renderState?.status !== 'completed') session.renderState = { status: 'idle', progress: 0 };
  }
  return true;
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

export function buildStoryboardFromParsed(
  topic: string,
  sections: ParsedScriptSections,
  fullMarkdown = '',
  angle?: string,
): Storyboard {
  const jsonMeta = sections.remotionSceneJson?.meta || {};
  const jsonScenes: any[] = Array.isArray(sections.remotionSceneJson?.scenes) ? sections.remotionSceneJson.scenes : [];

  let scenes: any[] = [];

  const voiceover = sections.voiceoverScript?.replace(/^[ \t]*(?:[#*]+[ \t]*)?Act[ \t]+\d+[ \t]*[:—–-][ \t]*/gim, '').trim();
  const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
  const draftNarration = jsonScenes.map(scene => scene?.narration || '').join(' ');
  if (!jsonScenes.length || (voiceover && normalize(voiceover) !== normalize(draftNarration))) {
    const narration = voiceover || fullMarkdown.trim();
    if (!narration) throw new Error('Provide narration before finalizing the script.');
    return { ...convertCreatorScriptToStoryboard({ title: jsonMeta.title || topic, hook: narration }, topic), topic, angle };
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

      const narration = typeof js.narration === 'string' ? js.narration.trim() : '';
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
        spokenNarration: voiceover ? undefined : js.spokenNarration || undefined,
        technicalKeyPoint: keyPoint,
        durationTargetSec: Math.max(1, Math.min(60, Math.round((js.durationFrames || 180) / 30))),
        visualProps: cleanVisualProps,
      });
    }
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
    const responseText = await this.callLLM(userPrompt, systemPrompt);

    // Try parsing as 7-key JSON (Contract V4)
    const sevenKeyObj = tryParseSevenKeyJson(responseText);
    if (sevenKeyObj) {
      console.log(`[MasterScript] Successfully parsed 7-key JSON script: "${sevenKeyObj.title || topic}"`);
      return this.createCustomSession(sevenKeyObj, topic, existingSessionId, angle);
    }

    const sections = parseSectionsFromMarkdown(responseText);
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
    this.finalizeStoredScript(session, customMarkdown);
    sessions.set(sessionId, session);
    saveSessionToDisk(session);
    console.log(`[MasterScript] Session ${sessionId} locked and finalized with ${session.storyboard.scenes.length} scenes.`);
    return session;
  }

  finalizeStoredScript(session: ScriptSession, customMarkdown?: string): ScriptSession {
    if (customMarkdown?.trim() && customMarkdown !== session.currentMarkdown) {
      const sections = parseSectionsFromMarkdown(customMarkdown);
      const approved = decodePastedScript(customMarkdown) ?? tryParseSevenKeyJson(customMarkdown);
      const typed = StoryboardSchema.safeParse(approved);
      const creatorScript = isCreatorScript(approved) ? approved as NonNullable<ScriptSession['sevenKeyScript']> : undefined;
      const storyboard = creatorScript ? convertCreatorScriptToStoryboard(creatorScript, session.topic)
        : typed.success ? typed.data
        : buildStoryboardFromParsed(session.topic, sections, customMarkdown, session.angle);
      this.clearMedia(session);
      session.currentMarkdown = customMarkdown;
      session.sevenKeyScript = creatorScript;
      session.sections = { ...sections, voiceoverScript: storyboard.scenes.map(scene => scene.narration).join('\n\n') };
      session.storyboard = storyboard;
    }

    if (!session.storyboard?.scenes || session.storyboard.scenes.length === 0) {
      session.storyboard = buildStoryboardFromParsed(session.topic, session.sections, session.currentMarkdown, session.angle);
    }

    session.finalized = true;
    session.updatedAt = Date.now();
    return session;
  }

  async createCustomSession(
    customScript: string | Record<string, any>,
    topicFallback = 'Creator Custom Script',
    existingSessionId?: string,
    angleOverride?: string,
    ownerDigest?: string,
  ): Promise<ScriptSession> {
    const existing = existingSessionId ? this.getSession(existingSessionId) : undefined;
    const session = await this.buildCustomSession(customScript, topicFallback, existing, angleOverride, existingSessionId);
    session.ownerDigest = existing?.ownerDigest ?? ownerDigest;
    sessions.set(session.id, session);
    saveSessionToDisk(session);
    console.log(`[MasterScript] Created custom script session ${session.id} with ${session.storyboard.scenes.length} scenes.`);
    return session;
  }

  async buildCustomSession(
    customScript: string | Record<string, any>,
    topicFallback = 'Creator Custom Script',
    existing?: ScriptSession,
    angleOverride?: string,
    existingSessionId?: string,
  ): Promise<ScriptSession> {
    const decoded = typeof customScript === 'string' ? decodePastedScript(customScript) : customScript;
    const structuredScript = decoded && typeof decoded === 'object' && !Array.isArray(decoded)
      ? decoded as Record<string, any>
      : typeof customScript === 'string' ? tryParseSevenKeyJson(customScript) : null;
    const storyboard = await parseCustomScriptToStoryboard(structuredScript ?? customScript, topicFallback);
    const scriptObj = structuredScript ?? { title: topicFallback, hook: customScript };
    const id = existing?.id || existingSessionId || `session_${randomUUID()}`;
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
    return session;
  }

  private clearMedia(session: ScriptSession) {
    delete session.audioResult;
    delete session.voiceoverNeedsRefresh;
    delete session.timeline;
    delete session.stillPreviews;
    delete session.visualAssets;
    delete session.automaticVisualDraft;
    delete session.motionPreview;
    delete session.storyDirections;
    session.renderState = {status: 'idle', progress: 0};
  }

  updateSession(session: ScriptSession, requirePersistence = false): void {
    session.updatedAt = Date.now();
    if (requirePersistence) saveSessionToDisk(session, true);
    sessions.set(session.id, session);
    if (!requirePersistence) saveSessionToDisk(session);
  }

  getSession(sessionId: string): ScriptSession | undefined {
    let session = sessions.get(sessionId);
    if (!session) {
      session = loadSessionFromDisk(sessionId);
    }
    return session;
  }

  deleteSession(sessionId: string): boolean {
    sessions.delete(sessionId);
    try {
      const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch (e) {
      console.warn(`[MasterScript] Failed to delete session file ${sessionId}:`, e);
      return false;
    }
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
