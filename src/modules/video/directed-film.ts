import type { Storyboard } from '../contracts/storyboard.js';
import { buildMotionStages } from './motion-stage.js';
import type { VideoTimeline } from './timeline.js';
import { cleanNarration, type StoryDirectionOverrides, type TimedShot, type VisualPlan } from './visual-story.js';
import { explainCounterFallback } from './counter-explainer.js';

type Guide = NonNullable<TimedShot['paymentGuide']>;
type GuideNode = Guide['nodes'][number];
const positions = [[305, 680], [765, 680], [305, 1130], [765, 1130], [535, 905]] as const;
const diagramIcons: Record<string, GuideNode['icon']> = {
  phone: 'phone', database: 'ledger', lock: 'lock', queue: 'ledger', service: 'switch', server: 'switch',
};
const tone = { neutral: 'blue', warning: 'gold', success: 'green', error: 'red' } as const;

function filmedPayment(shot: Extract<TimedShot, { kind: 'film' }>, narration: string,
  segment: VideoTimeline['segments'][number], fps: number): TimedShot['checkout'] {
  if (shot.set !== 'counter' || !['scan', 'confirm'].includes(shot.performance)) return;
  const approved = cleanNarration(narration);
  const words = approved.split(' ');
  const end = shot.from + shot.duration;
  const amounts = Array.from(approved.matchAll(/₹\s*\d+(?:[,.]\d+)*/gu), match => {
    const word = approved.slice(0, match.index).trim().split(' ').filter(Boolean).length + (match[0].includes(' ') ? 1 : 0);
    return { value: match[0].replace(/\s+/g, ''), frame: segment.wordFrames?.[word] };
  });
  const amount = amounts.filter(({ frame }) => frame !== undefined && frame < end).at(-1);
  if (amount?.frame === undefined) return;
  const at = (pattern: RegExp) => {
    const word = words.findIndex((text, index) => {
      const frame = segment.wordFrames?.[index];
      return frame !== undefined && frame >= shot.from && frame < end && pattern.test(text);
    });
    return word === -1 ? undefined : segment.wordFrames![word] - shot.from;
  };
  const action = shot.actionFrame ?? Math.min(shot.duration - 1, Math.round(fps * 0.55));
  const confirmation = at(/\b(?:confirmed|received|successfully)\b|प्राप्त/iu);
  return {
    phase: shot.performance === 'scan' ? 'scan' : 'alert',
    amount: amount.value, amountAt: Math.max(0, amount.frame - shot.from), merchant: 'Merchant', payer: '', banks: ['', ''], offset: 0,
    cues: {
      scan: at(/\bscan\w*\b|स्कैन/iu) ?? action,
      authorize: at(/\b(?:authorized|sent)\b|भेजे|पिन/iu) ?? shot.duration + fps,
      confirm: confirmation ?? shot.duration,
      alert: action, question: shot.duration, payer: 0, merchant: 0, payerBank: 0, merchantBank: 0,
    },
  };
}

export function stageDirectedFilm(
  plan: VisualPlan, storyboard: Storyboard, timeline: VideoTimeline, overrides: StoryDirectionOverrides = {},
): VisualPlan {
  const stages = buildMotionStages(plan, timeline);
  const narration = storyboard.scenes.map(scene => scene.narration).join(' ');
  // Match the shipped hardware asset from spoken product context. Other brands use the reusable rig.
  const hasPaytmSoundbox = /(?:\bpaytm\b|पेटीएम)\s+(?:sound\s*box\b|साउंड\s*बॉक्स)/iu.test(narration);
  return plan.map((group, index) => group.map(shot => {
    if (shot.kind === 'film') {
      const edit = overrides[shot.id];
      const checkout = hasPaytmSoundbox
        ? filmedPayment(shot, storyboard.scenes[index].narration, timeline.segments[index], timeline.fps)
        : undefined;
      return { ...shot, ...(edit && { camera: edit.camera, action: edit.action }), checkout };
    }
    const counterGuide = explainCounterFallback(shot, storyboard.scenes[index].narration, narration);
    if (counterGuide) return { ...shot, paymentGuide: counterGuide };
    const stage = stages.get(shot.id);
    if (!stage || stage.nodes.some(node => [node.previous, ...node.updates].some(update =>
      update?.effect && update.effect !== 'change'))) return shot;
    const nodes: GuideNode[] = stage.nodes.map(node => {
      const [x, y] = positions[node.slot] ?? positions[4];
      const updates = [...(node.previous ? [node.previous] : []), ...node.updates].map(update => ({
        at: Math.max(0, update.frame - stage.start), text: update.value, tone: tone[update.tone],
      }));
      return {
        id: node.entity, label: node.label, detail: '', at: Math.max(0, node.entrance), x, y,
        icon: diagramIcons[node.icon] ?? 'status', updates,
      };
    });
    const edges: NonNullable<Guide['edges']> = stage.packets.map(packet => ({
      from: packet.source, to: packet.target, at: packet.frame - stage.start,
      label: '', tone: packet.blocked ? 'gold' : 'blue', blocked: packet.blocked,
    }));
    const notes = shot.takeaway ? [{ at: shot.takeawayFrame, text: shot.takeaway }] : undefined;
    return { ...shot, paymentGuide: { label: '', title: shot.headline, nodes, edges, notes } };
  }));
}
