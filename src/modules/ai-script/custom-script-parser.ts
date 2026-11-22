import { Storyboard, StoryboardSchema, StoryboardSceneSchema } from '../contracts/storyboard.js';

export function isCreatorScript(obj: any): boolean {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && !('scenes' in obj) &&
    ['hook', 'hooks', 'problem', 'solution', 'tech_explained', 'tech', 'conclusion', 'summary', 'cta']
      .some(key => typeof obj[key] === 'string' && obj[key].trim());
}

export function decodePastedScript(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    if (/^\s*\{/.test(text) && /&#(?:x20|32);/i.test(text)) {
      try {
        return JSON.parse(text.replace(/&#(?:x20|32);/gi, ' ').replace(/\\+[\t ]*\r?\n/g, '\n'));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

export interface DynamicReelContext {
  appName: string;
  appCategory: 'shop' | 'ecommerce' | 'delivery' | 'food' | 'ride' | 'fintech' | 'generic';
  itemName: string;
  itemPrice: string;
  baseDeliveryFee: string;
  surgeDeliveryFee: string;
  surgeMultiplier: string;
  surgeReason: string;
  auditRow1Label: string;
  auditRow1Value: string;
  auditRow2Label: string;
  auditRow2Value: string;
  auditRow3Label: string;
  auditRow3Value: string;
  auditQuestion: string;
  metricAName: string;
  metricACount: number;
  metricBName: string;
  metricBCount: number;
  deficitRatio: string;
  naiveTitle: string;
  naiveCode: string;
  naivePoints: string[];
  telemetryTitle: string;
  telemetryCode: string;
  telemetryPoints: string[];
  verdict: string;
  solutionTitle: string;
  solutionSubtitle: string;
  hotHexId: string;
  pipelineSteps: Array<{ label: string; description: string; status: 'completed' | 'active' | 'pending' }>;
  deepDiveStages: Array<{
    stagePill: string;
    stageTitle: string;
    card1Tag?: string;
    card1Title?: string;
    card1Desc?: string;
    card1Badge?: string;
    card2Tag?: string;
    card2Title?: string;
    card2Desc?: string;
    card2Badge?: string;
  }>;
  interviewPoints: string[];
  channelName: string;
  channelHandle: string;
}

function extractCodeFromText(text: string, fallbackSubject = 'resource'): { filename: string; code: string; language: string } {
  // 1. Check for backticks
  const backtickMatch = text.match(/`([^`]+)`/);
  if (backtickMatch) {
    const snippet = backtickMatch[1].trim();
    if (snippet.length > 3) {
      const isSql = /select|insert|update|delete|create|explain|from|where/i.test(snippet);
      const isShell = /curl|docker|git|npm|redis-cli|sh|bash/i.test(snippet);
      return {
        filename: isSql ? 'query.sql' : isShell ? 'command.sh' : 'snippet.ts',
        code: snippet,
        language: isSql ? 'sql' : isShell ? 'bash' : 'typescript',
      };
    }
  }
  // 2. Check for SQL verbs
  const sqlMatch = text.match(/(SELECT\s+[\s\S]+?FROM\s+[\w_]+|UPDATE\s+[\w_]+\s+SET\s+[\s\S]+?WHERE|INSERT\s+INTO\s+[\w_]+|CREATE\s+INDEX\s+[\w_]+|EXPLAIN\s+ANALYZE\s+[\s\S]+)/i);
  if (sqlMatch) {
    return {
      filename: 'query.sql',
      code: sqlMatch[1].trim(),
      language: 'sql',
    };
  }
  // 3. Check for CLI commands
  const cmdMatch = text.match(/((?:SET|GET|HSET|LPUSH|RPUSH)\s+[\w:_-]+\s+[\w:_-]+(?:\s+NX)?(?:\s+PX\s+\d+)?|docker\s+run\s+[^\n]+|git\s+commit\s+[^\n]+)/i);
  if (cmdMatch) {
    return {
      filename: 'command.sh',
      code: `$ ${cmdMatch[1].trim()}\nOK`,
      language: 'bash',
    };
  }
  // 4. Dynamic clean code
  const safeSub = fallbackSubject.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  return {
    filename: `${safeSub || 'system'}_service.ts`,
    code: `// Coordinated execution for ${fallbackSubject}\nconst result = await processTransaction({\n  id: "${safeSub}_01",\n  atomic: true\n});\nconsole.log("Success:", result);`,
    language: 'typescript',
  };
}

function extractSubjectEntity(text: string, title = ''): string {
  const combined = `${title} ${text}`;
  const match = combined.match(/\b(seat|ticket|order|payment|transaction|cart|item|stock|user|session|token|mutex|lock|key|message|event|record|cache|partition|buffer|query|node|worker|connection)\b/i);
  return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() : 'Resource';
}

function extractKeyPhrases(text: string): string[] {
  const clean = text.replace(/<[^>]*>/g, '').replace(/[#*`]/g, '').trim();
  const parts = clean.split(/[,;:—\n।!?]|\s+(?:aur|lekin|par|because|and|so|but|ki)\s+/i)
    .map(p => p.trim())
    .filter(p => p.length >= 8 && p.length <= 80);
  return parts.length >= 2 ? parts.slice(0, 3) : [clean.slice(0, 60)];
}

export function extractDynamicReelContext(obj: any): DynamicReelContext {
  const fullText = `${obj.title || ''} ${obj.hook || ''} ${obj.problem || ''} ${obj.solution || ''} ${obj.tech_explained || ''}`.toLowerCase();
  const title = (obj.title || 'System Design').trim();
  const firstWord = title.split(/\s+/)[0]?.toUpperCase() || 'SYSTEM';
  const appName = firstWord.length > 2 ? firstWord : 'SYSTEM';

  const subject = extractSubjectEntity(fullText, title);
  const itemName = `${subject} Allocation`;

  const numbers = Array.from(fullText.matchAll(/\b(\d+)\b/g)).map(m => parseInt(m[1], 10)).filter(n => n > 1 && n < 100000);
  const metricACount = numbers[0] || 100;
  const metricBCount = numbers[1] || 20;

  const naivePhrases = extractKeyPhrases(obj.problem || 'Direct uncoordinated execution fails');
  const solutionPhrases = extractKeyPhrases(obj.solution || 'Distributed coordination maintains state');

  const cta = String(obj.cta || '');
  const channelMatch = cta.match(/\bBehind The Tech\b/i) ?? cta.match(/\bcode with \w+\b|@[\w.]+/i);
  const channelName = channelMatch ? channelMatch[0].replace(/^@/, '') : 'Behind The Tech';
  const channelHandle = `@${channelName.toLowerCase().replace(/\s+/g, '')}`;

  return {
    appName,
    appCategory: 'generic',
    itemName,
    itemPrice: '',
    baseDeliveryFee: '',
    surgeDeliveryFee: '',
    surgeMultiplier: '',
    surgeReason: 'HIGH CONCURRENT LOAD',
    auditRow1Label: 'Client Entity',
    auditRow1Value: `${itemName} ✓`,
    auditRow2Label: 'Endpoint Route',
    auditRow2Value: 'VERIFIED ✓',
    auditRow3Label: 'Concurrency Mutex',
    auditRow3Value: 'GRANTED ✓',
    auditQuestion: 'CONCURRENCY ANOMALY DETECTED',
    metricAName: 'Requests',
    metricACount,
    metricBName: 'Workers',
    metricBCount,
    deficitRatio: `${(metricACount / Math.max(1, metricBCount)).toFixed(1)}X LOAD RATIO`,
    naiveTitle: 'Naive Direct Approach',
    naiveCode: `// Direct uncoordinated write\nawait executeDirectly("${subject.toLowerCase()}");`,
    naivePoints: naivePhrases.slice(0, 3),
    telemetryTitle: 'Distributed Coordinated Model',
    telemetryCode: `// Coordinated atomic write\nawait executeWithCoordination("${subject.toLowerCase()}");`,
    telemetryPoints: solutionPhrases.slice(0, 3),
    verdict: (obj.problem ? splitSentences(obj.problem)[0] : 'Bottleneck: Direct uncoordinated writes cause severe race conditions.').slice(0, 100),
    solutionTitle: 'DISTRIBUTED ARCHITECTURE',
    solutionSubtitle: 'Coordinating high-throughput concurrent requests',
    hotHexId: '#NODE_A4',
    pipelineSteps: [
      { label: 'Client Ingestion', description: 'Incoming concurrent client requests', status: 'completed' },
      { label: 'State Coordination', description: `Atomic ${subject} coordination`, status: 'active' },
      { label: 'Durable Persistence', description: 'Atomic persistence acknowledged', status: 'pending' },
    ],
    deepDiveStages: [
      {
        stagePill: 'STAGE 1/4 • INGESTION',
        stageTitle: 'High-Throughput Request Stream',
        card1Tag: 'CLIENT STREAM',
        card1Title: 'Concurrent Ingestion Stream',
        card1Desc: 'Validated and routed with sub-10ms latency',
        card1Badge: 'STREAMING',
      },
      {
        stagePill: 'STAGE 2/4 • COORDINATION',
        stageTitle: 'Atomic Mutex Coordination',
        card1Tag: 'MUTEX GUARD',
        card1Title: 'Exclusive Critical Section',
        card1Desc: 'Single worker holds key to prevent race condition',
        card1Badge: 'ATOMIC',
      },
      {
        stagePill: 'STAGE 3/4 • STATE PERSISTENCE',
        stageTitle: 'Durable Storage Commit',
        card1Tag: 'PERSISTENCE',
        card1Title: 'Durable State Acknowledged',
        card1Desc: 'Guarantees consistent state without anomalies',
        card1Badge: 'COMMITTED',
      },
      {
        stagePill: 'STAGE 4/4 • FAILOVER GUARD',
        stageTitle: 'Lease TTL & Crash Recovery',
        card1Tag: 'FAILOVER',
        card1Title: 'Auto-Expiry Lease Guard',
        card1Desc: 'Automatically evicts stale locks to prevent deadlocks',
        card1Badge: 'SAFEGUARDED ✅',
      },
    ],
    interviewPoints: [
      ...splitSentences(obj.solution || ''),
      ...splitSentences(obj.tech_explained || ''),
    ].slice(0, 3).map(s => s.slice(0, 95)),
    channelName,
    channelHandle,
  };
}

function splitSentences(text: string): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.!?।])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

function chunkIntoCuts(sentences: string[], maxWords = 24): string[] {
  if (sentences.length === 0) return [];
  const cuts: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const s of sentences) {
    const words = s.split(/\s+/).filter(Boolean).length;
    if (current.length > 0 && currentWords >= 16 && currentWords + words > maxWords) {
      cuts.push(current.join(' '));
      current = [s];
      currentWords = words;
    } else {
      current.push(s);
      currentWords += words;
    }
  }
  if (current.length > 0) cuts.push(current.join(' '));
  return cuts;
}

export function convertCreatorScriptToStoryboard(obj: any, topicFallback = 'Custom Tech Reel'): Storyboard {
  const title = (obj.title || obj.topic || topicFallback).trim();
  const hook = (obj.hook || obj.hooks || '').trim();
  const problem = (obj.problem || '').trim();
  const solution = (obj.solution || '').trim();
  const techExplained = (obj.tech_explained || obj.tech || '').trim();
  const conclusion = (obj.conclusion || obj.summary || '').trim();
  const cta = (obj.cta || '').trim();

  const shortTitle = title.length > 36
    ? title.split(/\s+/).slice(0, 5).join(' ').toUpperCase()
    : title.toUpperCase();

  const ctx = extractDynamicReelContext(obj);

  // Dynamic sentence chunks per section with balanced retention pacing (~25-35 words per cut)
  const hookCuts = chunkIntoCuts(splitSentences(hook), 40);
  const problemCuts = chunkIntoCuts(splitSentences(problem), 32);
  const solutionCuts = chunkIntoCuts(splitSentences(solution), 32);
  const techCuts = chunkIntoCuts(splitSentences(techExplained), 30);
  const conclusionCuts = chunkIntoCuts(splitSentences(conclusion), 40);
  const ctaCuts = chunkIntoCuts(splitSentences(cta), 40);

  const rawScenes: Array<{
    section: 'hook' | 'problem' | 'solution' | 'tech' | 'conclusion' | 'cta';
    narration: string;
    subIndex: number;
    totalSub: number;
  }> = [];

  hookCuts.forEach((n, i) => rawScenes.push({ section: 'hook', narration: n, subIndex: i, totalSub: hookCuts.length }));
  problemCuts.forEach((n, i) => rawScenes.push({ section: 'problem', narration: n, subIndex: i, totalSub: problemCuts.length }));
  solutionCuts.forEach((n, i) => rawScenes.push({ section: 'solution', narration: n, subIndex: i, totalSub: solutionCuts.length }));
  techCuts.forEach((n, i) => rawScenes.push({ section: 'tech', narration: n, subIndex: i, totalSub: techCuts.length }));
  conclusionCuts.forEach((n, i) => rawScenes.push({ section: 'conclusion', narration: n, subIndex: i, totalSub: conclusionCuts.length }));
  ctaCuts.forEach((n, i) => rawScenes.push({ section: 'cta', narration: n, subIndex: i, totalSub: ctaCuts.length }));

  if (rawScenes.length === 0) {
    rawScenes.push({ section: 'hook', narration: hook || title, subIndex: 0, totalSub: 1 });
  }

  const subject = extractSubjectEntity(`${title} ${hook} ${problem}`, title);
  let lastAssignedType = '';

  const scenes = rawScenes.map((item, idx) => {
    const textLower = item.narration.toLowerCase();
    let type: Storyboard['scenes'][number]['type'] = 'architecturePipeline';
    let onScreenText = shortTitle;
    let technicalKeyPoint = 'Architecture Breakdown';
    let visualProps: Record<string, any> = {};

    if (item.section === 'hook') {
      type = 'hook';
      onScreenText = shortTitle;
      technicalKeyPoint = 'The Engineering Mystery';
      visualProps = {
        headline: shortTitle,
        questionKicker: item.narration.slice(0, 110),
        badgeText: 'SYSTEM DESIGN',
        accentColor: '#00F2FE',
      };
    } else if (item.section === 'problem') {
      if (/race\s*condition|concurrency|simultaneous|double\s*booking|contention|conflict/i.test(textLower)) {
        type = 'raceCondition';
        onScreenText = 'RACE CONDITION DETECTED';
        technicalKeyPoint = 'Concurrent Workers Competing for Mutex';
        const codeExtract = extractCodeFromText(item.narration, subject);
        visualProps = {
          title: 'CONCURRENCY COLLISION',
          itemTitle: `${subject} Mutex`,
          user1Name: 'Worker Instance A',
          user2Name: 'Worker Instance B',
          atomicQuery: codeExtract.code,
          onScreenText: 'Simultaneous Requests Collision',
        };
      } else {
        type = 'comparison';
        onScreenText = 'NAIVE vs BOTTLENECK';
        technicalKeyPoint = 'Direct Uncoordinated Failure';
        const problemPhrases = extractKeyPhrases(item.narration);
        visualProps = {
          leftTitle: 'Naive Direct Execution',
          leftPoints: problemPhrases.slice(0, 3),
          rightTitle: 'System Failure Bottleneck',
          rightPoints: ['Direct state mutation fails under peak concurrency', 'Data corruption & inconsistency'],
          verdict: item.narration.slice(0, 95),
        };
      }
    } else if (item.section === 'solution') {
      type = 'architecturePipeline';
      onScreenText = 'ENGINEERED ARCHITECTURE';
      technicalKeyPoint = 'Distributed Coordination Pipeline';
      visualProps = {
        title: `${shortTitle} Solution`,
        subtitle: 'High-throughput coordinated system flow',
        redisLatencyMs: 1.5,
        steps: [
          { label: 'Client Ingestion', description: 'Incoming concurrent requests validated', status: 'completed' },
          { label: 'State Mutex', description: `Atomic ${subject} coordination`, status: 'active' },
          { label: 'Durable Persistence', description: 'Atomic commit to durable store', status: 'pending' },
        ],
      };
    } else if (item.section === 'tech') {
      if (/`[^`]+`|set|select|update|insert|code|query|command|syntax|await|const|function/i.test(textLower)) {
        type = 'code';
        const extracted = extractCodeFromText(item.narration, subject);
        onScreenText = 'CORE IMPLEMENTATION';
        technicalKeyPoint = 'Atomic Logic Execution';
        visualProps = {
          filename: extracted.filename,
          code: extracted.code,
          language: extracted.language,
          explanationCallout: item.narration.slice(0, 85),
        };
      } else if (/step|phase|order|timeline|ttl|expire|recovery|failover|retry|queue/i.test(textLower)) {
        type = 'queueTimeline';
        onScreenText = 'PHASED STATE TIMELINE';
        technicalKeyPoint = 'State Progression Lifecycle';
        const phrases = extractKeyPhrases(item.narration);
        visualProps = {
          title: 'Execution Phase Lifecycle',
          items: phrases.map((p, i) => ({
            name: `Step ${i + 1}`,
            priority: i === 0 ? 'high' : 'medium',
            detail: p,
          })),
        };
      } else {
        type = 'architecturePipeline';
        onScreenText = 'DISTRIBUTED ARCHITECTURE';
        technicalKeyPoint = 'Sub-Millisecond Pipeline State';
        visualProps = {
          title: 'Distributed System Pipeline',
          subtitle: 'In-memory coordination & sub-millisecond execution',
          redisLatencyMs: 1.5,
          steps: [
            { label: 'Ingestion Layer', description: 'Concurrent request buffering', status: 'completed' },
            { label: 'State Coordination', description: 'Atomic state evaluation', status: 'active' },
            { label: 'Durable Store', description: 'Acknowledged write commit', status: 'pending' },
          ],
        };
      }

      // Avoid repeating the exact same type as previous cut
      if (type === lastAssignedType) {
        if (type === 'architecturePipeline') {
          type = 'requestFlow';
          visualProps = { title: visualProps.title, steps: visualProps.steps };
        }
      }
    } else if (item.section === 'conclusion') {
      type = 'summary';
      onScreenText = 'CORE ARCHITECTURAL TAKEAWAY';
      technicalKeyPoint = 'System Recap & Takeaways';
      const conclusionSentences = splitSentences(conclusion);
      visualProps = {
        headline: `${shortTitle} TAKEAWAYS`,
        takeaways: conclusionSentences.length > 0 ? conclusionSentences.slice(0, 3) : [item.narration.slice(0, 90)],
        callToAction: cta,
      };
    } else {
      type = 'tradeoffHUD';
      onScreenText = 'INTERVIEW CHEAT-SHEET';
      technicalKeyPoint = 'Senior SDE Mental Model';
      const cheatPoints = [
        ...splitSentences(solution),
        ...splitSentences(techExplained),
      ].slice(0, 4).map(s => s.slice(0, 90));

      visualProps = {
        title: 'SDE INTERVIEW CHEAT-SHEET',
        subtitle: 'Defend this architecture in your interviews',
        interviewPoints: cheatPoints.length > 0 ? cheatPoints : [
          'Decouple hot paths using in-memory state coordination',
          'Always configure lease auto-expiry to prevent deadlocks',
          'Partition state by resource key to eliminate contention',
        ],
        callToAction: cta,
        channelName: ctx.channelName,
        channelHandle: ctx.channelHandle,
      };
    }

    lastAssignedType = type;

    const words = item.narration.trim().split(/\s+/).filter(Boolean).length;
    const durationTargetSec = Math.max(3, Math.min(20, Math.round(words / 2.35)));

    const scene = {
      id: `scene-${idx + 1}`,
      sceneIndex: idx,
      type,
      narration: item.narration,
      onScreenText,
      technicalKeyPoint,
      durationTargetSec,
      visualProps,
    };
    const validated = StoryboardSceneSchema.safeParse(scene);
    // Keep compatibility with short authored narration and existing creator props.
    return validated.success ? validated.data : scene as Storyboard['scenes'][number];
  });

  const totalDurationSec = scenes.reduce((acc, s) => acc + s.durationTargetSec, 0);

  return {
    topic: title,
    title,
    hook,
    learningObjective: `${shortTitle} • Dynamic System Design Breakdown`,
    targetAudience: 'Developers & CS students',
    format: 'short',
    estimatedDurationSec: totalDurationSec,
    hashtags: ['#systemdesign', '#backend', '#shorts'],
    scenes,
  };
}

export async function parseCustomScriptToStoryboard(
  rawInput: string | Record<string, any>,
  topicFallback = 'Custom Tech Reel'
): Promise<Storyboard> {
  const decoded = typeof rawInput === 'string' ? decodePastedScript(rawInput) : rawInput;
  const validated = StoryboardSchema.safeParse(decoded);
  if (validated.success) return validated.data;
  if (isCreatorScript(decoded)) return convertCreatorScriptToStoryboard(decoded, topicFallback);
  // Plain text uses the same sentence splitter as the creator contract, without an LLM rewrite.
  if (typeof rawInput === 'string' && rawInput.trim() && decoded === undefined && !/^\s*\{\s*"/.test(rawInput)) {
    return convertCreatorScriptToStoryboard({ title: topicFallback, hook: rawInput }, topicFallback);
  }
  throw new Error('Paste a narration script or a valid creator storyboard.');
}
