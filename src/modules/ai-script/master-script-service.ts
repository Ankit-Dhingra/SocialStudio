import fs from 'node:fs';
import path from 'node:path';
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
  const allText = `${topic} ${angle || ''} ${fullText}`;
  const isSurge = /surge|zomato|uber|delivery|food|ride|cab|fare|pricing/i.test(allText);
  const isEventLoop = /event\s*loop|microtask|macrotask|call\s*stack|libuv|node(?:\.js)?|javascript|v8|async/i.test(allText);
  const isDatabase = /database|postgres|mysql|sqlite|b-tree|lsm|index|caching|disk|storage|acid|wal/i.test(allText);

  // Clean fullText of markdown headers, cues and tags
  const cleanFullText = fullText
    .replace(/\*\*(?:ACT\s*\d+|Act\s*\d+)[^*]*\*\*/gi, '')
    .replace(/<break\b[^>]*\/?>/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*`_]/g, '')
    .trim();

  // Extract clean spoken sentences
  const rawSentences = cleanFullText
    .split(/(?<=[.!?।])\s+/u)
    .map(s => s.trim())
    .filter(s => s.length > 8 && !/^(?:Scene|Act)\s*\d+/i.test(s));

  let sceneTemplates: Array<{
    type: string;
    keyPoint: string;
    onScreenText: string;
    visualProps: Record<string, any>;
  }>;

  if (isSurge) {
    sceneTemplates = [
      {
        type: 'smartphoneMockup',
        keyPoint: 'Surge delivery fee jump from ₹30 to ₹80',
        onScreenText: '₹30 vs ₹80? • Dynamic Surge Pricing',
        visualProps: {
          appName: 'ZOMATO',
          itemName: 'Royal Chicken Dum Biryani',
          itemPrice: '₹300',
          baseDeliveryFee: '₹30',
          surgeDeliveryFee: '₹80',
          surgeMultiplier: '2.7X',
          surgeReason: 'HIGH DEMAND • 120+ ACTIVE ORDERS',
        },
      },
      {
        type: 'h3SpatialMap',
        keyPoint: 'Naive Radius Scan • Circle Range Search',
        onScreenText: 'Naive Circle Range Scan • O(N) Disk Latency',
        visualProps: {
          mode: 'naive-radius',
          title: 'Naive 5km Circle Range Scan',
          subtitle: 'PostgreSQL Haversine Formula Bottleneck (450ms)',
          orderCount: 95,
          riderCount: 14,
        },
      },
      {
        type: 'comparison',
        keyPoint: 'Naive Disk Search vs Spatial Indexing',
        onScreenText: 'Naive Full Scan vs Hexagon Grid',
        visualProps: {
          leftTitle: 'Naive SQL Full-Scan',
          rightTitle: 'Uber H3 Geospatial Grid',
          leftPoints: [
            'O(N) Haversine distance math',
            'Disk I/O latency spikes under load',
            'Non-equidistant boundary flaws',
          ],
          rightPoints: [
            'O(1) Hexagon index resolution',
            'In-memory Redis cached lookups',
            'Equidistant 6-neighbor lookups',
          ],
          verdict: 'H3 Spatial Indexing scales to millions of requests',
        },
      },
      {
        type: 'h3SpatialMap',
        keyPoint: 'Uber H3 Hexagonal Spatial Indexing',
        onScreenText: 'H3 Hexagonal Mesh • Equidistant Neighbors',
        visualProps: {
          mode: 'hex-grid',
          hotHexId: '88619A0A4',
          orderCount: 84,
          riderCount: 12,
          subtitle: 'Uber H3 Geospatial Indexing',
        },
      },
      {
        type: 'architecturePipeline',
        keyPoint: 'Redis sub-millisecond in-memory cache pipeline',
        onScreenText: 'Data Pipeline • Sub-Millisecond Redis Reads',
        visualProps: {
          title: 'Dynamic Pricing Data Pipeline',
          subtitle: 'Aggregated demand per Hex ID via in-memory cache',
          redisLatencyMs: 2,
          atomicCommand: 'HGETALL surge:hex:88619A0A4',
          steps: [
            { label: 'Mobile App', description: 'Order request dispatched', status: 'completed' },
            { label: 'API Gateway', description: 'H3 Geo-hash resolution', status: 'completed' },
            { label: 'Redis Cache', description: 'Sub-millisecond supply lookup', status: 'active' },
            { label: 'Async Worker', description: 'Dynamic pricing engine', status: 'completed' },
          ],
        },
      },
      {
        type: 'requestFlow',
        keyPoint: 'End-to-End Microsecond Request Flow',
        onScreenText: 'Request Lifecycle • Microsecond Latency',
        visualProps: {
          title: 'Surge Price Calculation Lifecycle',
          steps: [
            { label: '1. GPS Coordinates', description: 'Lat/Long captured from client', cue: 'coordinates' },
            { label: '2. H3 Cell ID', description: 'Resolved to 64-bit integer index', cue: 'H3' },
            { label: '3. Redis Aggregate', description: 'Active orders and supply retrieved', cue: 'Redis' },
            { label: '4. Dynamic Fee Quote', description: 'Final calculated quote returned to app', cue: 'quote' },
          ],
        },
      },
      {
        type: 'h3SpatialMap',
        keyPoint: 'Stale GPS & Offline Rider Detection',
        onScreenText: 'Edge Case • Stale GPS & Heartbeat Filter',
        visualProps: {
          mode: 'stale-heartbeat',
          hotHexId: '88619A0A4',
          orderCount: 60,
          riderCount: 2,
          subtitle: 'Disconnected driver heartbeats filtered from live supply pool',
        },
      },
      {
        type: 'raceCondition',
        keyPoint: 'Concurrent Worker Mutex Conflict',
        onScreenText: 'Race Condition • Concurrent Updates',
        visualProps: {
          itemTitle: 'Hex #88619A0A4 Surge Mutex',
          user1Name: 'Order Worker A',
          user2Name: 'Surge Worker B',
          atomicQuery: 'SET lock:hex:88619A0A4 "worker_uuid_77" NX EX 5',
        },
      },
      {
        type: 'queueTimeline',
        keyPoint: 'Redis TTL Auto-Expiry Prevents Deadlock',
        onScreenText: 'Distributed Mutex • TTL Auto-Expiry',
        visualProps: {
          title: 'Distributed Lock Mutex Lifecycle',
          mode: 'lock',
          items: [
            { name: '1. Lock Held by Worker A', priority: 'medium', detail: 'SET hex_mutex:88619A worker_A NX EX 5' },
            { name: '2. Worker A Crashes / Disconnects', priority: 'high', detail: 'Worker dies ungracefully before lock release' },
            { name: '3. Redis TTL Expiry (5s)', priority: 'high', detail: 'Key evicted automatically by Redis engine' },
            { name: '4. Worker B Acquires Lock', priority: 'medium', detail: 'SET hex_mutex:88619A worker_B NX EX 5 succeeds' },
          ],
        },
      },
      {
        type: 'code',
        keyPoint: 'Atomic Distributed Lock Command',
        onScreenText: 'Atomic Distributed Lock • Lua / SET NX EX',
        visualProps: {
          code: '-- Acquire Distributed Mutex with 5s Safety TTL\nSET lock:hex:88619A0A4 "worker_uuid_77" NX EX 5\n\n-- Release Mutex atomically via Lua Script\nif redis.call("get", KEYS[1]) == ARGV[1] then\n  return redis.call("del", KEYS[1])\nelse\n  return 0\nend',
          language: 'lua',
          lineHighlights: [2, 5, 6],
        },
      },
      {
        type: 'summary',
        keyPoint: 'Architectural Summary: GPS, H3, Redis, Locks',
        onScreenText: 'Architecture Summary • H3 + Redis + Mutex',
        visualProps: {
          headline: 'System Design Architecture Takeaways',
          takeaways: [
            'H3: O(1) GPS to Hex resolution',
            'Redis: Sub-millisecond in-memory cache',
            'Distributed Locks: Mutex prevents race conditions',
            'TTL Guard: Automatic expiry prevents deadlocks',
          ],
        },
      },
      {
        type: 'tradeoffHUD',
        keyPoint: 'Tradeoff: Low Latency vs Data Consistency',
        onScreenText: 'Architecture Tradeoffs • Latency vs Consistency',
        visualProps: {
          title: 'System Design Tradeoffs',
          metricA: 'Real-Time Dynamic Pricing',
          metricB: 'Strong Mutex Consistency',
          scoreA: '99.9%',
          scoreB: 'O(1) Redis',
        },
      },
    ];
  } else if (isEventLoop) {
    sceneTemplates = [
      {
        type: 'hook',
        keyPoint: 'Node.js Single-Threaded Concurrency vs V8 Call Stack',
        onScreenText: 'Node.js Event Loop • Microtasks vs Macrotasks',
        visualProps: { headline: 'How Node.js Handles Concurrency', subtitle: 'Call Stack vs Asynchronous Queues' },
      },
      {
        type: 'architecturePipeline',
        keyPoint: 'V8 Execution Engine and Libuv Event Loop Architecture',
        onScreenText: 'V8 Engine & Libuv Runtime Architecture',
        visualProps: { title: 'Node.js Runtime Internals', subtitle: 'V8 Call Stack, Libuv Event Loop & Threadpool', redisLatencyMs: 0, steps: [{ label: 'V8 Call Stack', description: 'Synchronous JS execution', status: 'active' }, { label: 'Microtask Queue', description: 'process.nextTick & Promises', status: 'completed' }, { label: 'Libuv Loop', description: 'Phased I/O event polling', status: 'completed' }] },
      },
      {
        type: 'queueTimeline',
        keyPoint: 'Synchronous Call Stack vs Microtask Queue Priority',
        onScreenText: 'Call Stack Execution • Microtask Priority',
        visualProps: { title: 'Call Stack & Queue Priority Execution', items: [{ name: '1. V8 Synchronous Call Stack', priority: 'high', detail: 'Immediate frame execution' }, { name: '2. process.nextTick Queue', priority: 'high', detail: 'Runs before standard microtasks' }, { name: '3. Promise.then Microtask Queue', priority: 'high', detail: 'Drained completely after each sync operation' }, { name: '4. Macrotask Queue', priority: 'medium', detail: 'Timers, I/O, Immediate' }] },
      },
      {
        type: 'code',
        keyPoint: 'Microtask Scheduling via Promise.resolve and process.nextTick',
        onScreenText: 'Microtask Scheduling • Code Flow',
        visualProps: { code: 'console.log("1: Sync");\nprocess.nextTick(() => console.log("2: nextTick"));\nPromise.resolve().then(() => console.log("3: Promise"));\nsetTimeout(() => console.log("4: Timer"), 0);', language: 'typescript', lineHighlights: [2, 3] },
      },
      {
        type: 'queueTimeline',
        keyPoint: 'Microtask Queue Drain Phase',
        onScreenText: 'Microtask Drain Phase • Full Queue Flush',
        visualProps: { title: 'Microtask Drain Phase', items: [{ name: 'process.nextTick Queue', priority: 'high', detail: 'Immediate synchronous microtask' }, { name: 'Promise.then Queue', priority: 'high', detail: 'Microtask drained before macrotasks' }, { name: 'Timers Macrotask Queue', priority: 'medium', detail: 'setTimeout and setInterval' }] },
      },
      {
        type: 'architecturePipeline',
        keyPoint: 'Libuv Phased Loop: Timers, Poll, and Check',
        onScreenText: 'Libuv Loop Phases • Timers, Poll, Check',
        visualProps: { title: 'Libuv Event Loop Phased Execution', subtitle: 'Between each phase, Microtask queue drains completely', steps: [{ label: 'Timers Phase', description: 'setTimeout & setInterval callbacks', status: 'completed' }, { label: 'Poll Phase', description: 'Retrieve I/O events & incoming connections', status: 'active' }, { label: 'Check Phase', description: 'setImmediate callbacks execute here', status: 'completed' }, { label: 'Close Phase', description: 'socket.on("close") cleanups', status: 'completed' }] },
      },
      {
        type: 'raceCondition',
        keyPoint: 'Microtask Starvation: Infinite Microtasks Block I/O',
        onScreenText: 'Microtask Starvation • Event Loop Freeze',
        visualProps: { itemTitle: 'Event Loop Starvation Hazard', user1Name: 'Recursive nextTick / Promise', user2Name: 'I/O Polling & Network Callbacks', atomicQuery: 'process.nextTick(recursiveTask); // Starves macrotasks!' },
      },
      {
        type: 'code',
        keyPoint: 'setImmediate vs setTimeout in Poll Phase',
        onScreenText: 'setImmediate vs setTimeout Scheduling',
        visualProps: { code: 'fs.readFile("data.txt", () => {\n  setTimeout(() => console.log("Timer Phase"), 0);\n  setImmediate(() => console.log("Check Phase")); // Guaranteed first!\n});', language: 'typescript', lineHighlights: [3] },
      },
      {
        type: 'architecturePipeline',
        keyPoint: 'Libuv Threadpool Offloading for Disk & Crypto',
        onScreenText: 'Threadpool Offloading • Non-Blocking I/O',
        visualProps: { title: 'Libuv Worker Threadpool (UV_THREADPOOL_SIZE)', subtitle: 'Async FS, DNS, Crypto executed off main thread', steps: [{ label: 'Main Thread', description: 'Dispatches crypto.pbkdf2 / fs.readFile', status: 'completed' }, { label: 'Worker Thread 1', description: 'Executes CPU-intensive disk I/O', status: 'active' }, { label: 'Callback Return', description: 'Result queued back to Poll phase', status: 'completed' }] },
      },
      {
        type: 'queueTimeline',
        keyPoint: 'Complete Phase Iteration & Event Loop Step',
        onScreenText: 'Phase Iteration • Loop Progression',
        visualProps: { title: 'Libuv Event Loop Cycle Completion', items: [{ name: '1. Expired Timers Executed', priority: 'medium', detail: 'Callback queue processed' }, { name: '2. Microtask Queue Flushed', priority: 'high', detail: 'Zero remaining promises' }, { name: '3. I/O Poll Waiting', priority: 'high', detail: 'Epoll/Kqueue kernel event retrieval' }, { name: '4. Check Phase setImmediate', priority: 'medium', detail: 'Immediate execution before next tick' }] },
      },
      {
        type: 'summary',
        keyPoint: 'Event Loop Architecture Summary',
        onScreenText: 'Event Loop Summary • Microtasks Drain First',
        visualProps: { headline: 'Node.js Event Loop Key Takeaways', takeaways: ['Call stack runs synchronously to completion', 'Microtasks (Promises/nextTick) drain before next macrotask', 'setImmediate executes in Check phase right after I/O poll', 'Avoid recursive microtasks to prevent event loop starvation'] },
      },
      {
        type: 'tradeoffHUD',
        keyPoint: 'Tradeoff: Event Loop Concurrency vs Thread Overhead',
        onScreenText: 'Architecture Tradeoffs • Async I/O vs CPU Bound',
        visualProps: { title: 'Node.js Concurrency Tradeoffs', metricA: 'High I/O Throughput', metricB: 'Single-Thread CPU Limit', scoreA: 'O(1) Poll', scoreB: 'Offload CPU' },
      },
    ];
  } else if (isDatabase) {
    sceneTemplates = [
      {
        type: 'hook',
        keyPoint: 'Database Storage Engines and Index Bottlenecks',
        onScreenText: `${topic.slice(0, 45)} • Storage Bottlenecks`,
        visualProps: { headline: 'Database Architecture Internals', subtitle: 'Disk I/O vs In-Memory Performance' },
      },
      {
        type: 'architecturePipeline',
        keyPoint: 'Disk I/O vs In-Memory Page Cache',
        onScreenText: 'Buffer Pool & Page Cache Architecture',
        visualProps: { title: 'Storage Layer Memory Hierarchy', subtitle: 'RAM Buffer Pool, WAL, and Physical Storage Blocks', steps: [{ label: 'Client Query', description: 'SQL parsing & query plan', status: 'completed' }, { label: 'Buffer Pool', description: 'In-memory page cache lookup', status: 'active' }, { label: 'Disk Controller', description: 'Physical NVMe/SSD block read', status: 'completed' }] },
      },
      {
        type: 'code',
        keyPoint: 'Indexed Lookup vs Full Table Scan',
        onScreenText: 'Index Scan vs Sequential Scan',
        visualProps: { code: 'EXPLAIN ANALYZE\nSELECT * FROM orders\nWHERE customer_id = 98124 AND created_at > NOW() - INTERVAL "1 day";', language: 'sql', lineHighlights: [2] },
      },
      {
        type: 'queueTimeline',
        keyPoint: 'Write-Ahead Log (WAL) and Transaction Commit Flow',
        onScreenText: 'Write-Ahead Log • Durability Pipeline',
        visualProps: { title: 'Transaction Durability Pipeline', items: [{ name: '1. Append to WAL Buffer', priority: 'high', detail: 'Sequential write in memory' }, { name: '2. Fsync to WAL File on Disk', priority: 'high', detail: 'Atomic commit durability' }, { name: '3. Update Dirty Page in Buffer Pool', priority: 'medium', detail: 'In-memory page modification' }, { name: '4. Asynchronous Checkpoint Flush', priority: 'low', detail: 'Background table data sync' }] },
      },
      {
        type: 'architecturePipeline',
        keyPoint: 'Index Structure & Node Traversal',
        onScreenText: 'Tree Traversal • O(log N) Search',
        visualProps: { title: 'Index Traversal Architecture', subtitle: 'Balanced node traversal from root to leaf page', steps: [{ label: 'Root Page', description: 'Binary search key boundary', status: 'completed' }, { label: 'Internal Pages', description: 'Branch navigation', status: 'completed' }, { label: 'Leaf Page', description: 'Direct tuple pointer read', status: 'active' }] },
      },
      {
        type: 'raceCondition',
        keyPoint: 'Concurrency Control: Lock Contention vs MVCC',
        onScreenText: 'Concurrency Control • MVCC vs Row Locks',
        visualProps: { itemTitle: 'Row Mutex Contention', user1Name: 'Transaction A (UPDATE)', user2Name: 'Transaction B (UPDATE)', atomicQuery: 'SELECT * FROM accounts WHERE id = 1 FOR UPDATE;' },
      },
      {
        type: 'queueTimeline',
        keyPoint: 'Deadlock Detection and Lock Graph Resolution',
        onScreenText: 'Deadlock Detection • Wait-For Graph',
        visualProps: { title: 'Deadlock Detection & Abort Resolution', items: [{ name: '1. Tx A holds Lock 1, requests Lock 2', priority: 'medium', detail: 'Waiting on Row 2' }, { name: '2. Tx B holds Lock 2, requests Lock 1', priority: 'medium', detail: 'Waiting on Row 1' }, { name: '3. Wait-For Cycle Detected', priority: 'high', detail: 'Engine detects deadlock loop' }, { name: '4. Youngest Transaction Aborted', priority: 'high', detail: 'Tx B rolled back to free locks' }] },
      },
      {
        type: 'architecturePipeline',
        keyPoint: 'Cache Invalidation & Query Execution SLA',
        onScreenText: 'Query Latency SLA • Sub-Millisecond Reads',
        visualProps: { title: 'Query Execution Budget', subtitle: 'Target sub-5ms indexed response time', redisLatencyMs: 1, steps: [{ label: 'Index Lookup', description: 'O(log N) B-Tree seek', status: 'completed' }, { label: 'Heap Fetch', description: 'Direct page pointer retrieval', status: 'active' }, { label: 'Result Serialize', description: 'Return payload over wire', status: 'completed' }] },
      },
      {
        type: 'code',
        keyPoint: 'Covering Index Optimization',
        onScreenText: 'Covering Index • Index-Only Scan',
        visualProps: { code: 'CREATE INDEX idx_orders_cust_date_status\nON orders (customer_id, created_at)\nINCLUDE (status, total_amount);', language: 'sql', lineHighlights: [1, 3] },
      },
      {
        type: 'queueTimeline',
        keyPoint: 'Compaction & Background Maintenance',
        onScreenText: 'Compaction • Vacuum & Space Reclamation',
        visualProps: { title: 'Background Maintenance Pipeline', items: [{ name: '1. Dead Tuples Identification', priority: 'low', detail: 'Scan pages for unreferenced row versions' }, { name: '2. Page Compaction', priority: 'medium', detail: 'Reclaim free space within leaf pages' }, { name: '3. Index Tuple Pruning', priority: 'medium', detail: 'Remove dead pointers from index' }, { name: '4. Statistics Update (ANALYZE)', priority: 'low', detail: 'Refresh query planner histograms' }] },
      },
      {
        type: 'summary',
        keyPoint: 'Database Architecture Summary',
        onScreenText: 'Architecture Summary • Indexes & Memory Hierarchy',
        visualProps: { headline: 'Database Architecture Key Takeaways', takeaways: ['Buffer pool prevents disk I/O bottleneck', 'WAL ensures ACID durability with sequential writes', 'Covering indexes eliminate heap table lookups', 'MVCC prevents read-write blocking contention'] },
      },
      {
        type: 'tradeoffHUD',
        keyPoint: 'Tradeoff: Read Speed vs Write Amplification',
        onScreenText: 'Architecture Tradeoffs • Read Latency vs Write Amplification',
        visualProps: { title: 'Database Indexing Tradeoffs', metricA: 'O(log N) Read Latency', metricB: 'Write Amplification Cost', scoreA: 'Sub-5ms', scoreB: 'Index Update Overhead' },
      },
    ];
  } else {
    // General Backend / System Design
    sceneTemplates = [
      {
        type: 'hook',
        keyPoint: `High Scale Architecture for ${topic}`,
        onScreenText: `${topic.slice(0, 45)} • Architecture Deep Dive`,
        visualProps: { headline: topic, subtitle: angle || 'System Design & Distributed Architecture' },
      },
      {
        type: 'architecturePipeline',
        keyPoint: 'High-Level End-to-End System Architecture',
        onScreenText: 'System Architecture & Request Lifecycle',
        visualProps: { title: `${topic} Request Pipeline`, subtitle: 'End-to-End System Flow', steps: [{ label: 'API Gateway', description: 'Rate limiting & auth validation', status: 'completed' }, { label: 'Core Service', description: 'Domain logic processing', status: 'active' }, { label: 'Storage & Cache', description: 'In-memory state and database commit', status: 'completed' }] },
      },
      {
        type: 'code',
        keyPoint: 'Core Algorithmic Execution',
        onScreenText: 'Core Implementation • Logic Flow',
        visualProps: { code: `// ${topic} core execution handler\nasync function handleRequest(context) {\n  const cached = await cache.get(context.key);\n  if (cached) return cached;\n  return await computeAndPersist(context);\n}`, language: 'typescript', lineHighlights: [3, 4] },
      },
      {
        type: 'queueTimeline',
        keyPoint: 'Request Processing & State Transition Pipeline',
        onScreenText: 'Processing Pipeline • State Transitions',
        visualProps: { title: 'Execution Phase Progression', items: [{ name: '1. Ingestion & Validation', priority: 'high', detail: 'Sanitize incoming payload' }, { name: '2. State Fetch / Cache Lookup', priority: 'high', detail: 'Retrieve working state under 5ms' }, { name: '3. Atomic Mutex & Execution', priority: 'high', detail: 'Execute state transition' }, { name: '4. Persistence & Event Emit', priority: 'medium', detail: 'Commit changes and notify subscribers' }] },
      },
      {
        type: 'architecturePipeline',
        keyPoint: 'In-Memory State vs Persistent Storage Layer',
        onScreenText: 'In-Memory State & Cache Layer',
        visualProps: { title: 'State Management Architecture', subtitle: 'Optimizing hot-path read/write throughput', redisLatencyMs: 2, steps: [{ label: 'L1 In-Memory', description: 'Process-local state buffer', status: 'completed' }, { label: 'L2 Distributed Cache', description: 'Shared cluster state with TTL', status: 'active' }, { label: 'L3 Persistent Store', description: 'Durable database records', status: 'completed' }] },
      },
      {
        type: 'raceCondition',
        keyPoint: 'Concurrency & Race Condition Mutex Guard',
        onScreenText: 'Concurrency Guard • Distributed Mutex',
        visualProps: { itemTitle: `${topic.slice(0, 30)} Mutex`, user1Name: 'Worker Instance 1', user2Name: 'Worker Instance 2', atomicQuery: 'SET lock:resource "worker_77" NX EX 5' },
      },
      {
        type: 'queueTimeline',
        keyPoint: 'Failure Handling & Automatic Lease Expiry',
        onScreenText: 'Failover Recovery • Auto-Expiry Guard',
        visualProps: { title: 'Fault Tolerance & Failover Timeline', items: [{ name: '1. Primary Worker Active', priority: 'medium', detail: 'Heartbeat lease periodically refreshed' }, { name: '2. Worker Crash Detected', priority: 'high', detail: 'Heartbeat missed, network partition' }, { name: '3. Lease TTL Expiry', priority: 'high', detail: 'Lock automatically freed by cluster' }, { name: '4. Standby Worker Acquires Lock', priority: 'medium', detail: 'Processing resumes gracefully' }] },
      },
      {
        type: 'architecturePipeline',
        keyPoint: 'Scalability & SLA Latency Budget',
        onScreenText: 'Latency SLA Budget • High Throughput',
        visualProps: { title: 'System SLA & Latency Budget', subtitle: 'Bounded latency guarantees under load', redisLatencyMs: 3, steps: [{ label: 'Network RTT', description: 'Edge termination', status: 'completed' }, { label: 'Computation', description: 'Sub-millisecond processing', status: 'active' }, { label: 'State Commit', description: 'Atomic write acknowledgement', status: 'completed' }] },
      },
      {
        type: 'code',
        keyPoint: 'Atomic Mutation with Lock Safeguards',
        onScreenText: 'Atomic State Mutation Pattern',
        visualProps: { code: 'const acquired = await redis.set(lockKey, workerId, "NX", "EX", 5);\nif (!acquired) throw new Error("Resource locked, retry backoff");\ntry {\n  await processTask();\n} finally {\n  await releaseLockSafely(lockKey, workerId);\n}', language: 'typescript', lineHighlights: [1, 6] },
      },
      {
        type: 'queueTimeline',
        keyPoint: 'Retry Backoff and Circuit Breaker State',
        onScreenText: 'Circuit Breaker • Exponential Backoff',
        visualProps: { title: 'Resilience & Circuit Breaker', items: [{ name: '1. Transient Upstream Error', priority: 'low', detail: 'Connection timeout or socket error' }, { name: '2. Jittered Exponential Retry', priority: 'medium', detail: 'Backoff 100ms, 200ms, 400ms' }, { name: '3. Circuit Tripped to OPEN', priority: 'high', detail: 'Fail-fast to protect upstream services' }, { name: '4. Half-Open Probe Recovery', priority: 'medium', detail: 'Gradual traffic ramp-up upon health check' }] },
      },
      {
        type: 'summary',
        keyPoint: 'System Design Architecture Summary',
        onScreenText: 'Architecture Summary • Key Takeaways',
        visualProps: { headline: `${topic} Architectural Takeaways`, takeaways: ['In-memory caching offloads hot database reads', 'Distributed mutexes prevent concurrent race conditions', 'Lease TTL guards ensure crash-safe failover', 'Circuit breakers isolate downstream cascading failures'] },
      },
      {
        type: 'tradeoffHUD',
        keyPoint: 'System Tradeoffs: Latency vs Consistency',
        onScreenText: 'Architecture Tradeoffs • Latency vs Consistency',
        visualProps: { title: 'Core Architectural Tradeoffs', metricA: 'Sub-Millisecond Latency', metricB: 'Strong Consistency Guarantee', scoreA: 'High Throughput', scoreB: 'Bounded Eventual Consistency' },
      },
    ];
  }

  const targetCount = sceneTemplates.length; // 12
  const sentencesPerScene = Math.max(1, Math.floor(rawSentences.length / targetCount));

  return sceneTemplates.map((template, idx) => {
    let narration = '';
    if (rawSentences.length > 0) {
      const startIdx = idx * sentencesPerScene;
      const endIdx = idx === targetCount - 1 ? rawSentences.length : (idx + 1) * sentencesPerScene;
      const sceneSentences = rawSentences.slice(startIdx, Math.max(startIdx + 1, endIdx));
      narration = sceneSentences.join(' ');
    }
    if (!narration) {
      narration = `Scene ${idx + 1}: ${template.keyPoint}.`;
    }

    return {
      id: `scene-${idx + 1}`,
      sceneIndex: idx,
      type: template.type,
      narration,
      onScreenText: template.onScreenText,
      technicalKeyPoint: template.keyPoint,
      durationTargetSec: Math.min(60, Math.max(1, Math.round(narration.split(/\s+/).length / 2.5))),
      visualProps: template.visualProps,
    };
  });
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
        const isShop = /shop|store|cart|retail|product|sneaker|headphone|order/i.test(`${topic} ${onScreenText} ${narration}`);
        const isFood = /food|restaurant|biryani|burger|pizza|meal|zomato|swiggy/i.test(`${topic} ${onScreenText} ${narration}`);
        const isRide = /ride|cab|taxi|uber|ola/i.test(`${topic} ${onScreenText} ${narration}`);
        const isFintech = /pay|wallet|bank|stock|crypto|transfer|settle/i.test(`${topic} ${onScreenText} ${narration}`);

        if (!cleanVisualProps.appName) cleanVisualProps.appName = isShop ? 'STORE' : isFood ? 'FOOD' : isRide ? 'RIDE' : isFintech ? 'PAY' : 'APP';
        if (!cleanVisualProps.itemName) cleanVisualProps.itemName = isShop ? 'Wireless ANC Headphones' : isRide ? 'Sedan Ride' : isFood ? 'Order Meal' : 'Selected Item';
        if (!cleanVisualProps.itemPrice) cleanVisualProps.itemPrice = '₹350';
        if (!cleanVisualProps.baseDeliveryFee) cleanVisualProps.baseDeliveryFee = '₹30';
        if (!cleanVisualProps.surgeDeliveryFee) cleanVisualProps.surgeDeliveryFee = '₹80';
        if (!cleanVisualProps.surgeMultiplier) cleanVisualProps.surgeMultiplier = '2.7X';
        if (!cleanVisualProps.surgeReason) cleanVisualProps.surgeReason = isShop ? 'FLASH SALE • LIMITED STOCK' : 'HIGH DEMAND • PEAK TRAFFIC';
      }

      if (type === 'h3SpatialMap') {
        if (!cleanVisualProps.hotHexId) cleanVisualProps.hotHexId = '#ZONE_A4';
        if (!cleanVisualProps.orderCount) cleanVisualProps.orderCount = 84;
        if (!cleanVisualProps.riderCount) cleanVisualProps.riderCount = 12;
        if (!cleanVisualProps.subtitle) cleanVisualProps.subtitle = 'O(1) Spatial Partitioning Grid';
      }

      // Sanitize topic-incorrect generic labels:
      // Preserve authored queue content; only adapt if NOT an event-loop topic and items are missing or generic placeholders
      if (type === 'queueTimeline') {
        const isEventLoopTopic = /event\s*loop|microtask|macrotask|promise|call\s*stack|node/i.test(`${topic} ${onScreenText} ${narration}`);
        const isSurge = /surge|zomato|uber|h3|hex/i.test(`${topic} ${onScreenText} ${narration}`);
        const hasMicrotasks = Array.isArray(cleanVisualProps.items) && cleanVisualProps.items.some((it: any) => /microtask|macrotask|promise/i.test(it.name || it.detail || ''));
        if (!isEventLoopTopic && (!cleanVisualProps.items || cleanVisualProps.items.length === 0 || hasMicrotasks)) {
          if (isSurge) {
            cleanVisualProps.items = [
              { name: '1. Lock Held by Worker A', priority: 'medium', detail: 'SET hex_mutex:88619A worker_A NX EX 5' },
              { name: '2. Worker A Crashes / Disconnects', priority: 'high', detail: 'Worker ungracefully dies before releasing lock' },
              { name: '3. Redis TTL Expiry (5s)', priority: 'high', detail: 'Key automatically evicted by Redis engine' },
              { name: '4. Worker B Acquires Lock', priority: 'medium', detail: 'SET hex_mutex:88619A worker_B NX EX 5 succeeds' },
            ];
          } else {
            cleanVisualProps.items = [
              { name: '1. Request Ingestion', priority: 'medium', detail: 'Payload validation and queue push' },
              { name: '2. Concurrency Lock', priority: 'high', detail: 'SET lock:resource worker_A NX EX 5' },
              { name: '3. Processing Pipeline', priority: 'high', detail: 'Atomic execution under lock guard' },
              { name: '4. State Commit', priority: 'medium', detail: 'Persist output and release lock' },
            ];
          }
        }
      }

      if (type === 'code') {
        const VALID_LANGS = new Set(['javascript', 'typescript', 'python', 'sql', 'bash', 'json', 'lua', 'sh']);
        if (!cleanVisualProps.language || !VALID_LANGS.has(cleanVisualProps.language)) {
          cleanVisualProps.language = 'bash';
        }
        if (!cleanVisualProps.filename) cleanVisualProps.filename = 'distributed_lock.sh';
        if (!cleanVisualProps.code) {
          cleanVisualProps.code = 'REDIS> SET lock:resource "worker_77" NX EX 5\nOK';
        }
      }

      if (type === 'raceCondition') {
        if (!cleanVisualProps.itemTitle || /seat|concert/i.test(cleanVisualProps.itemTitle)) {
          const isSurge = /surge|zomato|uber|h3|hex/i.test(`${topic} ${onScreenText} ${narration}`);
          if (isSurge) {
            cleanVisualProps.itemTitle = 'Hex #88619A0A4 Surge Mutex';
            cleanVisualProps.user1Name = 'Order Worker A';
            cleanVisualProps.user2Name = 'Surge Worker B';
            cleanVisualProps.atomicQuery = 'SET lock:hex:88619A0A4 "worker_uuid_77" NX EX 5';
          } else {
            cleanVisualProps.itemTitle = `${onScreenText || topic} Mutex`;
            cleanVisualProps.user1Name = 'Worker Thread A';
            cleanVisualProps.user2Name = 'Worker Thread B';
            cleanVisualProps.atomicQuery = 'SET mutex:resource "worker_77" NX EX 5';
          }
        }
      }

      if (type === 'architecturePipeline') {
        if (!cleanVisualProps.redisLatencyMs) cleanVisualProps.redisLatencyMs = 2;
        if (!cleanVisualProps.atomicCommand) {
          const isSurge = /surge|zomato|uber|h3|hex/i.test(`${topic} ${onScreenText} ${narration}`);
          cleanVisualProps.atomicCommand = isSurge ? 'SET lock:hex:88619A "worker_77" NX EX 5' : 'SET lock:resource "worker_77" NX EX 5';
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
        if (!Array.isArray(cleanVisualProps.items) || cleanVisualProps.items.length < 2) {
          cleanVisualProps.items = [
            { name: 'Microtask Execution', priority: 'high', detail: 'Priority processing' },
            { name: 'Macrotask Execution', priority: 'medium', detail: 'Scheduled queue processing' },
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
          console.log(`[MasterScript] Successfully recovered Section 4 JSON! Recovered ${sections.remotionSceneJson.scenes.length} scenes.`);
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

    // Enforce 12-16 valid scenes
    if (!session.storyboard?.scenes || session.storyboard.scenes.length < 12 || session.storyboard.scenes.length > 16) {
      if (!session.storyboard?.scenes || session.storyboard.scenes.length === 0) {
        session.storyboard = buildStoryboardFromParsed(session.topic, session.sections, session.currentMarkdown, session.angle);
      } else if (session.storyboard.scenes.length < 12) {
        const allVoiceoverText = (session.sections.voiceoverScript || session.currentMarkdown).trim();
        const topicFallbacks = buildTopicGroundedFallbackScenes(session.topic, session.angle, allVoiceoverText);
        for (let sIdx = session.storyboard.scenes.length; sIdx < 12; sIdx++) {
          const fallbackTemplate = topicFallbacks[sIdx % topicFallbacks.length];
          session.storyboard.scenes.push({
            ...fallbackTemplate,
            id: `scene-${session.storyboard.scenes.length + 1}`,
            sceneIndex: session.storyboard.scenes.length,
          });
        }
      } else if (session.storyboard.scenes.length > 16) {
        session.storyboard.scenes = session.storyboard.scenes.slice(0, 16);
      }
    }

    session.finalized = true;
    session.updatedAt = Date.now();
    sessions.set(sessionId, session);
    saveSessionToDisk(session);
    console.log(`[MasterScript] Session ${sessionId} locked and finalized with ${session.storyboard.scenes.length} scenes.`);
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
