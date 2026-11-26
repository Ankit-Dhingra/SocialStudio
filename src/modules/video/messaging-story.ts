import type { Storyboard } from '../contracts/storyboard.js';
import type { VideoTimeline } from './timeline.js';
import { cleanNarration, type TimedShot, type VisualPlan } from './visual-story.js';

type Guide = NonNullable<TimedShot['paymentGuide']>;
type Node = Guide['nodes'][number];
type Step = [label: string, icon: Node['icon'], cue: RegExp];
type Lesson = { title: string; steps: Step[]; note?: [string, RegExp]; blocked?: boolean };
const encryption: Step = ['Encrypted message', 'lock', /encrypted|encrypt|एन्क्रिप्ट/iu];
const server: Step = ['Pending on server', 'ledger', /server|store|सर्वर/iu];
const phone: Step = ['Recipient’s phone', 'phone', /phone|online|फ़ोन|फोन|ऑनलाइन/iu];
const worker: Step = ['Background processing', 'switch', /background|process/iu];
const database: Step = ['Local database', 'ledger', /local database|save/iu];

function lesson(text: string): Lesson {
  if (/acknowledgement|acknowledgment|duplicate|retry|दोबारा भेज/iu.test(text)) return {
    title: 'Retry the delivery', steps: [['Connection interrupted', 'status', /disconnect|interrupted/iu], ['Retry using message ID', 'switch', /message IDs?|retry/iu], ['Acknowledge delivery', 'phone', /acknowledge|duplicate/iu]],
    note: ['Same message ID → one chat entry', /duplicate/iu],
  };
  if (/original timestamp|सही समय/iu.test(text) && /server.side|controlled|process|संभाल/iu.test(text)) return {
    title: 'What handles the backlog?', steps: [server, worker, ['Original timestamp', 'status', /timestamp|सही समय/iu]],
  };
  if (/memory|cpu|decrypt.{0,60}render/iu.test(text)) return {
    title: 'The cost of doing it all at once', steps: [['Download', 'ledger', /download/iu], ['Decrypt', 'lock', /decrypt/iu], ['Render UI', 'phone', /render/iu]], note: ['CPU and memory load can spike', /memory|cpu/iu],
  };
  if (/visible messages|visible.only|viewport/iu.test(text)) return {
    title: 'Draw only what’s on screen', steps: [database, ['Visible messages', 'phone', /visible/iu]], note: ['Older rows can render as you scroll', /ui|load/iu],
  };
  if (/local database|background/iu.test(text)) return { title: 'Process messages off the screen', steps: [worker, database, ['Open chat', 'phone', /screen|chat/iu]] };
  if (/encrypt|undelivered/iu.test(text)) return { title: 'Store the encrypted backlog', steps: [encryption, server], note: ['Recipient offline → delivery waits', /undelivered|temporarily|offline/iu] };
  if (/pending messages|deliver|जमा/iu.test(text)) return { title: 'Reconnect and deliver', steps: [server, phone], note: ['Pending messages move when the phone reconnects', /deliver|online/iu] };
  if (/भेजा|sent|offline/iu.test(text)) return { title: 'A message reaches an offline phone', steps: [['Sender', 'phone', /message|भेजा/iu], server, ['Offline phone', 'phone', /offline/iu]], blocked: true };
  if (/time|timestamp|history|समय/iu.test(text)) return { title: 'Keep the chat timeline intact', steps: [['Sent time', 'status', /time|timestamp|समय/iu], ['Chat history', 'phone', /history|chat|दिखता/iu]], note: ['Order the chat by the original message time', /history|time|timestamp/iu] };
  return { title: 'Handle messages in stages', steps: [server, worker, phone] };
}

export function isOfflineMessagingStory(board: Storyboard): boolean {
  const text = board.scenes.map(scene => scene.narration).join(' ');
  return /messages?|मैसेज|संदेश/iu.test(text) && /offline|ऑफलाइन/iu.test(text) && /online|reconnect|internet\s+on|ऑनलाइन/iu.test(text) && /pending|backlog|encrypted|temporarily|जमा/iu.test(text);
}

const weekdays: Record<string, string> = { सोमवार: 'Monday', मंगलवार: 'Tuesday', बुधवार: 'Wednesday', गुरुवार: 'Thursday', शुक्रवार: 'Friday', शनिवार: 'Saturday', रविवार: 'Sunday' };
const dateTime = /(सोमवार|मंगलवार|बुधवार|गुरुवार|शुक्रवार|शनिवार|रविवार)(?:\s+को)?\s+(सुबह|दोपहर|शाम|रात)\s+(\d{1,2})(?::(\d{2}))?\s+बजे/gu;

export function directOfflineMessaging(board: Storyboard, timeline: VideoTimeline, previous?: VisualPlan): VisualPlan {
  const story = board.scenes.map(scene => cleanNarration(scene.narration)).join(' ');
  const appName = story.match(/\b(?:WhatsApp|Signal|Telegram|Messenger|iMessage)\b/iu)?.[0];
  const count = story.match(/\b(\d+(?:,\d{3})*)\s+(?:new\s+)?(?:messages?|मैसेज|संदेश)/iu)?.[1];
  const people = story.match(/(\d+)\s+(?:अलग-अलग\s+)?(?:लोगों|लोग|people|contacts)/iu)?.[1];
  const offlineFor = story.match(/(\d+)\s*(?:दिन|days?)\s+offline/iu)?.[1];
  const sender = story.match(/को\s+(\p{L}[\p{L}\p{M}]+)\s+ने[^।.!?]{0,70}message/iu)?.[1];
  const contrast = board.scenes.map(scene => cleanNarration(scene.narration)).find(scene => [...scene.matchAll(dateTime)].length >= 2);
  const [sent, received] = Array.from((contrast ?? '').matchAll(dateTime), ([, day, period, hour, minutes]) =>
    `${weekdays[day]} · ${hour}${minutes ? `:${minutes}` : ''} ${period === 'सुबह' ? 'AM' : 'PM'}`);
  return board.scenes.map((scene, index) => {
    const segment = timeline.segments[index];
    const duration = segment.durationInFrames;
    const text = cleanNarration(scene.narration);
    const at = (cue: RegExp, fallback = 0) => {
      const match = cue.exec(text);
      if (!match) return Math.min(duration - 1, Math.round(duration * fallback));
      const word = text.slice(0, match.index).trim().split(/\s+/).filter(Boolean).length;
      return Math.max(0, Math.min(duration - 1, segment.wordFrames?.[word] ?? Math.round(duration * word / Math.max(1, text.split(/\s+/).length))));
    };
    const base = { id: `${index + 1}-1`, cue: '', evidence: text.split(/[।.!?]/u)[0].slice(0, 180), from: 0, duration, reveals: [], movements: [], takeawayFrame: 0 };
    if (/follow करो|\bfollow\b[^.]{0,64}(?:behind the tech|more)/iu.test(text) && index === board.scenes.length - 1) {
      return [{ ...base, kind: 'cta', headline: text, premium: true }];
    }
    const reconnect = /internet\s+on|came online|वापस ऑनलाइन|reconnect/iu.test(text) && /messages?|मैसेज/iu.test(text) && scene.type === 'hook';
    const finalChat = Boolean(sent && (/original timestamps?.{0,115}(?:पुराने|old|सही जगह)/iu.test(text) || text === contrast));
    if (reconnect || finalChat) {
      const capture = previous?.[index]?.find(shot => shot.kind === 'device' && shot.appName === appName);
      const statusAt = at(/internet\s+on|came online|वापस ऑनलाइन|reconnect/iu, 0.4);
      const messagesAt = Math.max(statusAt, at(/सारे messages|messages आने|messages (?:arrive|start|come)/iu, 0.52));
      const sentAt = at(/सोमवार|sent/iu);
      const receivedAt = at(/रविवार|received/iu, 0.45);
      const recap = finalChat && text !== contrast;
      const headline = reconnect ? 'Back online' : 'The chat keeps the sent time';
      return [{ ...base, kind: 'device', headline, appName, actors: [{ entity: 'chat', label: headline }],
        asset: capture?.asset, clip: capture?.clip,
        openFrame: reconnect ? statusAt : 0, reveals: reconnect ? [messagesAt] : [receivedAt],
        messaging: reconnect ? { view: 'inbox', offlineFor, people, peopleAt: at(/\d+\s+(?:अलग-अलग\s+)?(?:लोगों|people|contacts)/iu), count, statusAt, messagesAt, sender }
          : recap ? { view: 'inbox', sender, sent }
          : { view: 'timestamp', sender, sent, sentAt, received, receivedAt },
      }];
    }
    const rule = lesson(text);
    const positions = rule.steps.length === 2 ? [[300, 690], [750, 975]] : [[290, 620], [740, 855], [290, 1090]];
    let lastCue = 0;
    const nodes: Guide['nodes'] = rule.steps.map(([label, icon, cue], i) => {
      const frame = at(cue, i * 0.2);
      lastCue = Math.min(duration - 1, Math.max(lastCue, frame));
      return { id: `step-${i}`, label, icon, detail: '', at: lastCue, x: positions[i][0], y: positions[i][1] };
    });
    const edges: Guide['edges'] = nodes.slice(1).map((node, i) => ({ from: nodes[i].id, to: node.id, at: node.at, label: '', blocked: rule.blocked && i === nodes.length - 2, tone: rule.blocked && i === nodes.length - 2 ? 'gold' : 'green' }));
    const retention = text.match(/(\d+)\s*(?:दिनों?|days?)\s*(?:तक|[A-Za-z]|$)/iu);
    const notes = rule.note ? [{ text: rule.note[0], at: at(rule.note[1], 0.7) }] : [];
    if (retention && /undelivered|temporarily/iu.test(text)) notes.push({ text: `Undelivered messages · up to ${retention[1]} days`, at: at(new RegExp(retention[0], 'iu')) });
    return [{ ...base, kind: 'focus', headline: rule.title, eventFrames: edges.map(edge => edge.at), premium: true,
      paymentGuide: { backdrop: 'black', label: '', title: rule.title, nodes, edges, notes },
    }];
  });
}
