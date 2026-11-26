import { cleanNarration, type TimedShot } from './visual-story.js';

type Guide = NonNullable<TimedShot['paymentGuide']>;
type Node = Guide['nodes'][number];
type Step = [label: string, icon: Node['icon']];
type Diagram = { title: string; steps: Step[]; routes: Array<[number, number]>; status?: [number, string, boolean] };

const diagrams: Array<[RegExp, Diagram]> = [
  [/\b(?:duplicate[- ]event|duplicate[- ]like|unique record|deduplicat\w*)\b/iu, {
    title: 'Count each like once', steps: [['Like event', 'phone'], ['Check event identity', 'lock'], ['Like counter', 'ledger']],
    routes: [[0, 1], [1, 2]], status: [1, 'Duplicate → ignored', true],
  }],
  [/\beventual consistency\b/iu, {
    title: 'Eventual consistency', steps: [['Local display', 'phone'], ['Background update', 'switch'], ['Shared total', 'ledger']],
    routes: [[0, 1], [1, 2]], status: [2, 'Catches up', false],
  }],
  [/\bqueue\b.{0,140}\bworkers?\b/iu, {
    title: 'Queue the incoming events', steps: [['Like events', 'phone'], ['Event queue', 'ledger'], ['Workers', 'switch']],
    routes: [[0, 1], [1, 2]], status: [1, 'Waiting to process', false],
  }],
  [/\b(?:sharded counters?|distribute)\b|अलग-अलग counters/iu, {
    title: 'Split the counting work', steps: [['Incoming likes', 'phone'], ['Counter A', 'ledger'], ['Counter B', 'ledger'], ['Counter C', 'ledger']],
    routes: [[0, 1], [0, 2], [0, 3]],
  }],
  [/\b(?:counter|counts?|likes?|total)\b.{0,100}(?:जोड़|\b(?:sum|aggregate)\b)|जोड़.{0,46}\btotal\b/iu, {
    title: 'Combine the partial counts', steps: [['Partial count A', 'ledger'], ['Partial count B', 'ledger'], ['Combined total', 'switch']],
    routes: [[0, 2], [1, 2]],
  }],
  [/\b(?:counter|database)\b.{0,90}\bbottleneck\b|उसी एक counter/iu, {
    title: 'One counter becomes a bottleneck', steps: [['Incoming likes', 'phone'], ['Single counter', 'ledger']],
    routes: [[0, 1]], status: [1, 'Requests wait', true],
  }],
  [/\btotal\b.{0,60}\bcache\b/iu, {
    title: 'Serve the total from cache', steps: [['Computed total', 'ledger'], ['Cache', 'switch'], ['Reader', 'phone']],
    routes: [[0, 1], [1, 2]],
  }],
];

export function explainCounterFallback(shot: TimedShot, narration: string, reelNarration: string): Guide | undefined {
  if (shot.kind !== 'focus' && !(shot.kind === 'device' && !shot.appName && shot.scanFrame === undefined) &&
      !(shot.kind === 'motion' && shot.actors.every(actor => actor.entity.startsWith('concept-')))) return;
  if (!/\blikes\b|लाइक/iu.test(reelNarration)) return;
  const diagram = diagrams.find(([pattern]) => pattern.test(cleanNarration(narration)))?.[1];
  if (!diagram) return;
  const positions = diagram.steps.length === 4
    ? [[535, 680], [290, 990], [765, 990], [535, 1220]]
    : diagram.steps.length === 3 ? [[290, 700], [765, 885], [290, 1100]] : [[290, 740], [765, 945]];
  return {
    label: '', title: diagram.title,
    nodes: diagram.steps.map(([label, icon], index) => ({
      id: String(index), label, icon, detail: '', at: Math.round(shot.duration * 0.055 * index), x: positions[index][0], y: positions[index][1],
      updates: diagram.status?.[0] === index ? [{ at: Math.round(shot.duration * 0.58), text: diagram.status[1], tone: diagram.status[2] ? 'gold' : 'green' }] : [],
    })),
    edges: diagram.routes.map(([from, to], index) => ({
      from: String(from), to: String(to), at: Math.round(shot.duration * (0.21 + 0.15 * index)), label: '', tone: 'blue',
    })),
  };
}
