import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { Storyboard, StoryboardSchema } from '../contracts/storyboard.js';

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
  topic: string;
  angle?: string;
  messages: ChatMessage[];
  currentMarkdown: string;
  sections: ParsedScriptSections;
  storyboard: Storyboard;
  finalized?: boolean;
  audioResult?: any;
  timeline?: any;
  stillPreviews?: any[];
  renderState?: RenderState;
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

  // 4. Remotion Scene JSON
  const jsonBlockMatch = markdown.match(/(?:###?\s*4\.?\s*(?:REMOTION\s*SCENE\s*JSON|Remotion\s*Scene\s*JSON))[\s\S]*?```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch) {
    try {
      sections.remotionSceneJson = JSON.parse(jsonBlockMatch[1].trim());
    } catch (e) {
      console.warn('[MasterScript] Failed to parse Remotion Scene JSON block:', e);
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

function parseTradeoffDilemma(markdown = '') {
  let optionA_Title = '';
  let optionA_Pros = '';
  let optionA_Cons = '';
  let optionB_Title = '';
  let optionB_Pros = '';
  let optionB_Cons = '';

  const optAMatch = markdown.match(/Option A\s*[:\-—]?\s*([^\n\r*]+)/i);
  if (optAMatch) optionA_Title = 'OPTION A: ' + optAMatch[1].trim();

  const optAProsMatch = markdown.match(/Option A[^\n]*\n[\s\S]*?\*?\*?Pros\*?\*?\s*[:\-—]?\s*([^\n\r]+)/i);
  if (optAProsMatch) optionA_Pros = optAProsMatch[1].replace(/^\*?\*?:?\s*/, '').trim();

  const optAConsMatch = markdown.match(/Option A[^\n]*\n[\s\S]*?\*?\*?Cons\*?\*?\s*[:\-—]?\s*([^\n\r]+)/i);
  if (optAConsMatch) optionA_Cons = optAConsMatch[1].replace(/^\*?\*?:?\s*/, '').trim();

  const optBMatch = markdown.match(/Option B\s*[:\-—]?\s*([^\n\r*]+)/i);
  if (optBMatch) optionB_Title = 'OPTION B: ' + optBMatch[1].trim();

  const optBProsMatch = markdown.match(/Option B[^\n]*\n[\s\S]*?\*?\*?Pros\*?\*?\s*[:\-—]?\s*([^\n\r]+)/i);
  if (optBProsMatch) optionB_Pros = optBProsMatch[1].replace(/^\*?\*?:?\s*/, '').trim();

  const optBConsMatch = markdown.match(/Option B[^\n]*\n[\s\S]*?\*?\*?Cons\*?\*?\s*[:\-—]?\s*([^\n\r]+)/i);
  if (optBConsMatch) optionB_Cons = optBConsMatch[1].replace(/^\*?\*?:?\s*/, '').trim();

  return { optionA_Title, optionA_Pros, optionA_Cons, optionB_Title, optionB_Pros, optionB_Cons };
}

function parseCheatSheetPoints(markdown = '') {
  const points: string[] = [];
  const lines = markdown.split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*\d+\.\s*\*\*Concept:\s*([^*]+)\*\*/i) || line.match(/^\s*\d+\.\s*\*\*([^*]+)\*\*/);
    if (m && m[1]) points.push(m[1].trim());
  }
  return points.slice(0, 4);
}

export function buildStoryboardFromParsed(
  topic: string,
  sections: ParsedScriptSections,
  fullMarkdown: string
): Storyboard {
  const jsonMeta = sections.remotionSceneJson?.meta || {};
  const jsonScenes = sections.remotionSceneJson?.scenes || [];

  const scenes = [];

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

      const extractVisualSummary = (v: any, fallback: string): string => {
        if (!v) return fallback;
        if (typeof v === 'string') {
          let s = v.trim();
          if (s.startsWith('[') || s.startsWith('{')) {
            try {
              return extractVisualSummary(JSON.parse(s), fallback);
            } catch {
              s = s.replace(/[\{\}\[\]"']/g, '').replace(/\b(type|id|position|visible|action|element)\b\s*:\s*/gi, '').trim();
            }
          }
          return s || fallback;
        }
        if (Array.isArray(v)) {
          const tags = v
            .map((item) => {
              if (!item) return '';
              if (typeof item === 'string') return item.trim();
              if (typeof item === 'object') {
                return item.id || item.type || item.action || item.element || '';
              }
              return '';
            })
            .filter(Boolean);
          return tags.length > 0 ? tags.slice(0, 4).join(' → ') : fallback;
        }
        if (typeof v === 'object') {
          return v.type || v.id || v.name || fallback;
        }
        return String(v).trim() || fallback;
      };

      let actNarration = extractCleanText(js.narration || actChunks[i] || js.visual || js.text, `Scene ${i + 1} engineering explanation.`);
      if (actNarration.length < 10) actNarration = `${actNarration} - core distributed architecture breakdown.`;

      const rawType = (js.type || '').toLowerCase();
      const actFullText = `${topic} ${rawType} ${actNarration} ${js.onScreenText || ''}`.toLowerCase();

      // Smart semantic scene routing based on narrative content
      let sceneType = 'hook';
      if (i === 0) {
        // Act 1: The Hook
        if (/race|concurrency|lock|seat|ticket|booking|flight/i.test(actFullText)) {
          sceneType = 'raceCondition';
        } else if (/phone|mockup|zomato|swiggy|order|price|surge|delivery|uber|ola|ride/i.test(actFullText)) {
          sceneType = 'smartphoneMockup';
        } else {
          sceneType = 'hook';
        }
      } else if (i === 1) {
        // Act 2: Break the Assumption / Paradox
        if (/hex|h3|spatial|map|honeycomb|geo/i.test(actFullText)) {
          sceneType = 'h3SpatialMap';
        } else if (/compare|diff|vs|versus|naive|instead/i.test(actFullText)) {
          sceneType = 'comparison';
        } else {
          sceneType = 'architecturePipeline';
        }
      } else if (i === 2) {
        // Act 3: Core Architecture Engine
        if (/hex|h3|spatial|map|honeycomb|geo/i.test(actFullText) && scenes[1]?.type !== 'h3SpatialMap') {
          sceneType = 'h3SpatialMap';
        } else if (/code|terminal|query|command|select|update/i.test(actFullText)) {
          sceneType = 'code';
        } else {
          sceneType = 'architecturePipeline';
        }
      } else if (i === 3) {
        // Act 4: Production Edge Case
        if (/compare|diff|vs|versus|stale/i.test(actFullText)) {
          sceneType = 'comparison';
        } else if (/queue|timeline|async|offline/i.test(actFullText)) {
          sceneType = 'queueTimeline';
        } else {
          sceneType = 'architecturePipeline';
        }
      } else if (i === 4) {
        // Act 5: Senior SDE Tradeoff & Recap
        sceneType = 'tradeoffHUD';
      }

      const defaultActTitles = [
        '1 SEAT • 2 BOOKINGS',
        'THE PARALLEL EXECUTION TRAP',
        'REDIS DISTRIBUTED LOCK ENGINE',
        'EDGE CASE: SERVER CRASH & TTL',
        'SENIOR SDE TRADEOFF MATRIX'
      ];

      const rawOnScreen = extractCleanText(js.onScreenText || js.text, defaultActTitles[i] || topic.toUpperCase());
      const onScreenText = rawOnScreen.length > 80 ? rawOnScreen.slice(0, 77) + '...' : (rawOnScreen.length < 3 ? `${rawOnScreen} SYS` : rawOnScreen);
      const technicalKeyPoint = extractVisualSummary(js.visualElements || js.visual, 'Core Architecture Flow');

      const parsedDilemma = parseTradeoffDilemma(sections.tradeoffDilemma || fullMarkdown);
      const parsedPoints = parseCheatSheetPoints(sections.interviewCheatSheet || fullMarkdown);

      // Populate rich topic-aware dynamic visualProps
      let visualProps: Record<string, any> = {
        type: sceneType,
        headline: onScreenText,
        subtext: technicalKeyPoint,
        title: onScreenText,
        subtitle: technicalKeyPoint,
      };

      if (sceneType === 'smartphoneMockup') {
        const isCab = /uber|ola|cab|ride/i.test(actFullText);
        const isSwiggy = /swiggy/i.test(actFullText);
        visualProps = {
          ...visualProps,
          appName: isCab ? 'UBER' : (isSwiggy ? 'SWIGGY' : 'ZOMATO'),
          itemName: isCab ? 'Uber Premier (Airport Ride)' : 'Royal Chicken Dum Biryani',
          locationText: 'HSR Layout, Sector 4',
          itemPrice: isCab ? '₹550' : '₹350',
          baseDeliveryFee: isCab ? '₹250' : '₹30',
          surgeDeliveryFee: isCab ? '₹550' : '₹80',
          surgeMultiplier: '1.8X',
          surgeReason: 'HIGH DEMAND • 120+ ACTIVE ORDERS',
          onScreenText,
        };
      } else if (sceneType === 'h3SpatialMap') {
        visualProps = {
          ...visualProps,
          hotHexId: '#88619A0A4',
          orderCount: 52,
          riderCount: 5,
          surgeMultiplier: '1.8X',
        };
      } else if (sceneType === 'tradeoffHUD') {
        visualProps = {
          ...visualProps,
          optionA_Title: parsedDilemma.optionA_Title || 'OPTION A: HIGH FREQUENCY PINGS (2-5s)',
          optionA_Pros: parsedDilemma.optionA_Pros || 'Real-time accuracy & faster candidate dispatching',
          optionA_Cons: parsedDilemma.optionA_Cons || 'High battery drain on mobile client device',
          optionB_Title: parsedDilemma.optionB_Title || 'OPTION B: LOW FREQUENCY PINGS (30s+)',
          optionB_Pros: parsedDilemma.optionB_Pros || 'Minimal battery consumption & lightweight network load',
          optionB_Cons: parsedDilemma.optionB_Cons || 'Stale location window & supply anomalies',
          interviewPoints: parsedPoints.length > 0 ? parsedPoints : [
            'Balance spatial indexing granularity with network throughput',
            'Use heartbeat freshness checks to mitigate stale data',
            'Decouple client updates via local offline queueing',
            'Optimize cache invalidation for dynamic real-time surges',
          ],
          callToAction: 'Save this reel for your System Design Interview & follow for more!',
        };
      } else if (sceneType === 'architecturePipeline') {
        visualProps = {
          ...visualProps,
          redisLatencyMs: 2.5,
        };
      } else if (sceneType === 'comparison') {
        const isOfflineGps = /offline|stale|gps|network/i.test(actFullText);
        visualProps = {
          ...visualProps,
          leftTitle: isOfflineGps ? 'STALE GPS OVERWRITE' : 'NAIVE DIRECT EXECUTION',
          leftCode: isOfflineGps ? 'rider.location = incoming_payload.coords' : 'SELECT * FROM inventory WHERE id = 1',
          leftPoints: isOfflineGps ? [
            'Older delayed packet arrives late',
            'Overwrites fresh live rider coordinates'
          ] : [
            'Parallel requests collide without lock',
            'Double-spend / inventory below zero'
          ],
          rightTitle: isOfflineGps ? 'MONOTONIC HEARTBEAT SYNC' : 'ATOMIC STATE GUARD',
          rightCode: isOfflineGps ? 'IF packet.timestamp > rider.last_seen UPDATE' : 'SET lock:key token NX EX 10',
          rightPoints: isOfflineGps ? [
            'Timestamps prevent out-of-order writes',
            'Offline local queue syncs gracefully'
          ] : [
            'Atomic single-turn guarantee',
            'Automatic TTL crash protection'
          ],
          verdict: isOfflineGps ? 'Winner: Monotonic Version Check' : 'Winner: Atomic Coordination Lock',
        };
      }

      scenes.push({
        id: `scene-${i + 1}`,
        sceneIndex: i,
        type: sceneType as any,
        narration: actNarration,
        onScreenText,
        technicalKeyPoint,
        durationTargetSec: Math.max(4, Math.min(30, Math.round((js.durationFrames || 210) / 30))),
        visualProps,
      });
    }
  } else {
    const parsedDilemma = parseTradeoffDilemma(sections.tradeoffDilemma || fullMarkdown);
    const parsedPoints = parseCheatSheetPoints(sections.interviewCheatSheet || fullMarkdown);
    // Standard 5-Act Fallback if JSON scene block was missing
    const fallbackTypes = ['smartphoneMockup', 'h3SpatialMap', 'architecturePipeline', 'comparison', 'tradeoffHUD'];
    const actTitles = ['Act 1: The Hook', 'Act 2: The Paradox', 'Act 3: Core Architecture', 'Act 4: The Edge Case', 'Act 5: Tradeoff & Recap'];
    for (let i = 0; i < 5; i++) {
      const type = fallbackTypes[i];
      let visualProps: Record<string, any> = {
        type,
        headline: actTitles[i] || `ACT ${i + 1}`,
        subtext: topic,
        title: actTitles[i] || `ACT ${i + 1}`,
        subtitle: topic,
      };

      if (type === 'tradeoffHUD') {
        visualProps = {
          ...visualProps,
          optionA_Title: parsedDilemma.optionA_Title || 'OPTION A: HIGH FREQUENCY (2-5s)',
          optionA_Pros: parsedDilemma.optionA_Pros || 'Real-time accuracy & faster dispatching',
          optionA_Cons: parsedDilemma.optionA_Cons || 'High battery drain on mobile client',
          optionB_Title: parsedDilemma.optionB_Title || 'OPTION B: LOW FREQUENCY (30s+)',
          optionB_Pros: parsedDilemma.optionB_Pros || 'Minimal battery consumption & lightweight network',
          optionB_Cons: parsedDilemma.optionB_Cons || 'Stale location window & supply anomalies',
          interviewPoints: parsedPoints.length > 0 ? parsedPoints : [
            'Balance spatial indexing granularity with network throughput',
            'Use heartbeat freshness checks to mitigate stale data',
            'Decouple client updates via local offline queueing',
            'Optimize cache invalidation for dynamic real-time surges',
          ],
          callToAction: 'Save this reel for your System Design Interview & follow for more!',
        };
      }

      scenes.push({
        id: `scene-${i + 1}`,
        sceneIndex: i,
        type: type as any,
        narration: actChunks[i] || `Act ${i + 1} engineering explanation for ${topic}.`,
        onScreenText: actTitles[i] || `ACT ${i + 1}`,
        technicalKeyPoint: 'Core Architecture Step',
        durationTargetSec: 14,
        visualProps,
      });
    }
  }

  // Ensure High-Retention Pacing: If any scene's narration has > 22 words, split it into 2 rapid visual screens
  const highRetentionScenes: any[] = [];
  for (let s = 0; s < scenes.length; s++) {
    const sc = scenes[s];
    const words = sc.narration.trim().split(/\s+/);
    // If it's a long scene (> 24 words) and not the final summary, split into 2 rapid-cut visual screens
    if (words.length > 24 && sc.type !== 'summary' && sc.type !== 'tradeoffHUD') {
      const mid = Math.ceil(words.length / 2);
      const part1Text = words.slice(0, mid).join(' ');
      const part2Text = words.slice(mid).join(' ');

      // Sub-beat 1
      highRetentionScenes.push({
        ...sc,
        id: `scene-${highRetentionScenes.length + 1}`,
        sceneIndex: highRetentionScenes.length,
        narration: part1Text,
        durationTargetSec: Math.max(4, Math.round(sc.durationTargetSec / 2)),
      });

      // Sub-beat 2 with complementary visual type
      let nextType = sc.type;
      if (sc.type === 'smartphoneMockup') nextType = 'h3SpatialMap';
      else if (sc.type === 'h3SpatialMap') nextType = 'architecturePipeline';
      else if (sc.type === 'architecturePipeline') nextType = 'comparison';
      else if (sc.type === 'code') nextType = 'queueTimeline';

      highRetentionScenes.push({
        ...sc,
        id: `scene-${highRetentionScenes.length + 1}`,
        sceneIndex: highRetentionScenes.length,
        type: nextType,
        narration: part2Text,
        onScreenText: sc.onScreenText ? `${sc.onScreenText} • DEEP DIVE` : 'ARCHITECTURE STEP',
        technicalKeyPoint: 'Mechanism Breakdown',
        durationTargetSec: Math.max(4, Math.round(sc.durationTargetSec / 2)),
        visualProps: {
          ...sc.visualProps,
          type: nextType,
          headline: `${sc.onScreenText} • DEEP DIVE`,
        },
      });
    } else {
      highRetentionScenes.push({
        ...sc,
        id: `scene-${highRetentionScenes.length + 1}`,
        sceneIndex: highRetentionScenes.length,
      });
    }
  }

  // Ensure smooth closing Outro CTA scene
  const hasOutro = highRetentionScenes.some(
    (s) => /follow|doston|share/i.test(s.narration) && s.type === 'summary'
  );
  if (!hasOutro) {
    const outroIndex = highRetentionScenes.length;
    highRetentionScenes.push({
      id: `scene-${outroIndex + 1}`,
      sceneIndex: outroIndex,
      type: 'summary',
      narration: 'Aise hi real-world system design seekhne ke liye follow karo aur doston ke sath share karo!',
      onScreenText: 'FOLLOW FOR DEEP TECH',
      technicalKeyPoint: 'Save & Share for Interviews',
      durationTargetSec: 5,
      visualProps: {
        type: 'summary',
        headline: 'Follow For More',
        takeaways: [
          'Save this reel for interview revision',
          'Share with your engineering friends',
        ],
        callToAction: 'Aise hi seekhne ke liye follow karo!',
      },
    });
  }

  const finalScenes = highRetentionScenes;
  const safeTitle = (jsonMeta.title || topic).trim().slice(0, 95);
  const safeHook = (finalScenes[0]?.narration || 'Engineering Hook in System Design').slice(0, 200);

  return StoryboardSchema.parse({
    topic: topic.slice(0, 195),
    title: safeTitle.length < 5 ? `${safeTitle} Explained` : safeTitle,
    hook: safeHook.length < 10 ? `${safeHook} in depth breakdown.` : safeHook,
    learningObjective: `Understand architecture, data flows and tradeoffs for ${topic}`,
    targetAudience: 'Software Engineers & Backend Developers',
    format: 'short',
    estimatedDurationSec: Math.max(20, Math.min(180, Number(jsonMeta.durationSeconds) || 78)),
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
            max_tokens: 4096,
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

  async startScriptSession(topic: string, angle?: string): Promise<ScriptSession> {
    const systemPrompt = getMasterPromptTemplate();
    const userPrompt = `TOPIC: ${topic.trim()}\nANGLE: ${angle ? angle.trim() : 'Focus on real-world production failure, edge cases and distributed architecture'}`;

    console.log(`[MasterScript] Generating initial master script for Topic: "${topic}"...`);
    const responseText = await this.callLLM(userPrompt, systemPrompt);

    const sections = parseSectionsFromMarkdown(responseText);
    const storyboard = buildStoryboardFromParsed(topic, sections, responseText);
    const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const session: ScriptSession = {
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
      renderState: { status: 'idle', progress: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    sessions.set(id, session);
    saveSessionToDisk(session);
    return session;
  }

  async chatRefine(sessionId: string, userInstruction: string): Promise<ScriptSession> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found. Please start a new script session.`);
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

    session.messages.push({ role: 'user', content: userInstruction, timestamp: Date.now() });
    session.messages.push({ role: 'assistant', content: updatedResponse, timestamp: Date.now() });
    session.currentMarkdown = updatedResponse;
    session.sections = parseSectionsFromMarkdown(updatedResponse);
    session.storyboard = buildStoryboardFromParsed(session.topic, session.sections, updatedResponse);
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

    if (customMarkdown && customMarkdown.trim()) {
      session.currentMarkdown = customMarkdown;
      session.sections = parseSectionsFromMarkdown(customMarkdown);
      session.storyboard = buildStoryboardFromParsed(session.topic, session.sections, customMarkdown);
    }

    session.finalized = true;
    session.updatedAt = Date.now();
    sessions.set(sessionId, session);
    saveSessionToDisk(session);
    console.log(`[MasterScript] Session ${sessionId} locked and finalized.`);
    return session;
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
