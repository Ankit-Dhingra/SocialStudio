import type { Storyboard } from '../contracts/storyboard.js';
import type { SceneTimelineSegment } from './timeline.js';

export type ShotKind =
  | 'street' | 'quote' | 'shortage' | 'location' | 'cells' | 'index' | 'cache' | 'engine' | 'pricing'
  | 'heartbeat' | 'recap' | 'pickup' | 'payment' | 'kafka' | 'lock' | 'end' | 'scene';

export interface StoryShot {
  kind: ShotKind;
  from: number;
  duration: number;
}

export type PlateRole = 'street' | 'pickup' | 'payment' | 'opening';
export type ReelPlates = Partial<Record<PlateRole, string>>;

const feePattern = /[₹$€£]\s*\d[\d,]*(?:\.\d+)?/g;
const rainPattern = /\brain(?:y|fall|ing)?\b|बारिश/i;
const deliveryPattern = /\b(?:delivery|riders?|orders?)\b|डिलीवरी|राइडर/i;
const numericMetric = (text: string, label: string) => {
  const match = text.match(new RegExp(`(\\d[\\d,]*)\\s+(?:${label})\\b`, 'i'));
  return match ? Number(match[1].replace(/,/g, '')) : undefined;
};

export function readVisualContext(storyboard: Storyboard) {
  const narration = storyboard.scenes.map(scene => scene.narration).join(' ');
  const text = `${storyboard.title} ${narration}`;
  const fees = [...new Set([...narration.matchAll(feePattern)].map(match => match[0].replace(/\s+/g, '')))];
  const feeChange = narration.match(/([₹$€£]\s*\d[\d,]*(?:\.\d+)?)\s*(?:से|to|→|->)\s*(?:अचानक\s*)?([₹$€£]\s*\d[\d,]*(?:\.\d+)?)/iu);
  const brandedApp = text.match(/\b(?:Zomato|Uber Eats|Uber|Swiggy|DoorDash|Deliveroo|Blinkit|Zepto)\b/i)?.[0];
  const cta = storyboard.scenes.find(scene => scene.type === 'tradeoffHUD');
  const channel = cta?.narration.match(/\bBehind The Tech\b/i)?.[0] ?? cta?.visualProps.channelName;
  const orders = numericMetric(narration, '(?:pending\\s+)?orders?');
  const riders = numericMetric(narration, '(?:available\\s+)?riders?');
  return {
    delivery: deliveryPattern.test(text) && /\bsurge\b|pricing|delivery (?:fee|charge)|dynamic pric/i.test(text),
    rain: rainPattern.test(text),
    eta: /\bETA\b|estimated delivery time/i.test(text),
    rules: /pricing rules|configured rules/i.test(text),
    midnight: /\bmidnight\b|\b12\s*(?:am|a\.m\.)|रात\s+के\s+12\s+बजे/i.test(text),
    chaiShop: /\bchai\b|चाय/i.test(text) && /\b(?:shop|stall|counter)\b|दुकान/i.test(text),
    kafka: /\bKafka\b/i.test(text),
    channel: channel && cta?.narration.toLowerCase().includes(channel.toLowerCase()) ? channel : undefined,
    app: brandedApp,
    orders,
    riders,
    ratio: orders !== undefined && riders && Number.isFinite(orders / riders)
      ? new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(orders / riders)
      : undefined,
    baseFee: feeChange?.[1].replace(/\s+/g, '') ?? narration.match(/\bbase(?: delivery)? (?:fee|charge)\s*([₹$€£]\s*\d[\d,.]*)/i)?.[1].replace(/\s+/g, ''),
    finalFee: feeChange?.[2].replace(/\s+/g, ''),
    extraFee: narration.match(/([₹$€£]\s*\d[\d,.]*)\s+(?:additional|extra)|(?:additional|extra)\s*([₹$€£]\s*\d[\d,.]*)/i)?.slice(1).find(Boolean)?.replace(/\s+/g, ''),
    fees,
    h3: /\bH3\b/i.test(text),
    redis: /\bRedis\b/i.test(text),
  };
}

export type VisualContext = ReturnType<typeof readVisualContext>;

function resolveShot(phrase: string, context: VisualContext, isRecap: boolean, isOpening: boolean): ShotKind {
  if (/\bdark[ -]store\b/i.test(phrase)) return 'pickup';
  if (/\bQR(?: code)?\b|क्यू\s*आर/i.test(phrase) && /\b(?:scan\w*|UPI|payment|pay)\b|पेमेंट|स्कैन/i.test(phrase)) return 'payment';
  if (context.delivery) {
    if (isRecap && /distance|(?:local|current) demand|availability|supply.demand|delivery conditions/i.test(phrase)) return 'recap';
    if (/heartbeat|timestamp|offline|stale|पुरानी GPS|active delivery status/i.test(phrase)) return 'heartbeat';
    if (/\b(?:Redis|cache)\b/i.test(phrase)) return 'cache';
    if (/\bH3\b|spatial index/i.test(phrase)) return 'index';
    if (/geographical cells?|\bcell\b/i.test(phrase) && !/pricing engine/i.test(phrase)) return 'cells';
    if (/\bGPS\b|telemetry|location and availability/i.test(phrase)) return 'location';
    if (/base delivery fee|additional charge|app.{0,24}[₹$€£]/i.test(phrase)) return 'pricing';
    if (/pricing engine|estimated delivery time|pricing rules/i.test(phrase)) return 'engine';
    if (/\b\d[\d,]*\s+(?:pending\s+)?orders?\b|\b\d[\d,]*\s+(?:available\s+)?riders?\b|shortage|supply.demand|city.{0,10}search/i.test(phrase)) return 'shortage';
    if (/delivery (?:fee|charge)|extra\s*[₹$€£]|restaurant|distance/i.test(phrase) && context.fees.length) return 'quote';
    if (context.rain && (isOpening || rainPattern.test(phrase))) return 'street';
    if (/local conditions|geographical areas|location.based/i.test(phrase)) return 'cells';
  }
  if (context.kafka && /\b(?:Kafka|partitions?|offsets?|consumer lag)\b/i.test(phrase) && /\b(?:publish\w*|producer\w*|consumer\w*|event\w*|topic\w*|partition\w*)\b/i.test(phrase)) return 'kafka';
  if (/\bSET\s*NX\b/i.test(phrase) && /lock|book|atomic|mutex/i.test(phrase)) return 'lock';
  return 'scene';
}

export function planSceneShots(
  scene: Storyboard['scenes'][number],
  segment: SceneTimelineSegment,
  context: VisualContext,
  fps: number,
): StoryShot[] {
  const narration = scene.narration.replace(/<[^>]+>/g, ' ').trim();
  // Sentence boundaries keep the visual beat on the same words as the caption clock.
  const clauses = narration.split(/(?<=[!?।.]|,)\s+/).filter(Boolean);
  const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;
  const totalWords = Math.max(1, countWords(narration));
  const starts: Array<{ kind: ShotKind; from: number }> = [];
  let wordIndex = 0;
  const isRecap = scene.type === 'summary' || /takeaway|recap/i.test(scene.onScreenText);
  const isCallToAction = scene.type === 'tradeoffHUD'
    && /\b(?:follow|subscribe)\b|फॉलो|सब्सक्राइब/i.test(narration);
  const minimumShotFrames = Math.round(fps * 0.8);
  for (const clause of clauses) {
    const last = starts.at(-1);
    const kind = isCallToAction ? 'end' : resolveShot(clause, context, isRecap, scene.sceneIndex === 0 && wordIndex === 0);
    const frame = segment.wordFrames?.[wordIndex] ?? Math.round(wordIndex / totalWords * segment.durationInFrames);
    wordIndex += countWords(clause);
    if (!last) {
      starts.push({ kind, from: 0 });
    } else if (kind !== 'scene' && kind !== last.kind && frame - last.from >= minimumShotFrames && segment.durationInFrames - frame >= minimumShotFrames) {
      starts.push({ kind, from: frame });
    }
  }
  if (!starts.length) starts.push({ kind: 'scene', from: 0 });
  return starts.map((shot, index) => ({
    ...shot,
    duration: (starts[index + 1]?.from ?? segment.durationInFrames) - shot.from,
  }));
}
