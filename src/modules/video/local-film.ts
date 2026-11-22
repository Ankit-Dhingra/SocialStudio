import type { Storyboard } from '../contracts/storyboard.js';
import type { VideoTimeline } from './timeline.js';
import { cleanNarration, compileVisualPlan, narrationAnchors, type StoryDirectionOverrides, type TimedShot, type VisualStory } from './visual-story.js';

type Film = Extract<TimedShot, { kind: 'film' }>;
type DraftShot = VisualStory['scenes'][number]['shots'][number];

const physicalBeats: Array<{
  test: RegExp; performance: Film['performance']; title: string; camera: Film['camera']; set: Film['set'];
}> = [
  { test: /\b(?:soundbox|speaker|doorbell|announc\w*|beep\w*|confirmation)\b|आवाज़|आवाज|घंटी|डोरबेल/iu, performance: 'confirm', title: 'Confirmation', camera: 'push-in', set: 'counter' },
  { test: /\b(?:qr|scan\w*|tap\w*|phone)\b|स्कैन|फ़ोन|फोन/iu, performance: 'scan', title: 'Device interaction', camera: 'push-in', set: 'counter' },
  { test: /\b(?:bill|receipt|counter|serves?)\b|चाय के|दुकानदार|बिल/iu, performance: 'serve', title: 'Counter exchange', camera: 'track-left', set: 'counter' },
  { test: /\b(?:tea|chai|coffee|eat\w*|sip\w*|drink\w*|noodles|maggi(?:e)?)\b|चाय(?!वाल)|कॉफ़ी|पीने|खाने|मैगी/iu, performance: 'drink', title: 'At the counter', camera: 'track-right', set: 'counter' },
  { test: /\b(?:rider|driv\w*|scooter|bike|street|road)\b|राइडर|बाइक|सड़क/iu, performance: 'travel', title: 'Travel', camera: 'track-right', set: 'street' },
  { test: /\b(?:opens?|fridge|refrigerator|cupboard|lid|door|darwaza)\b|फ्रिज|दरवाज़|खोल/iu, performance: 'open', title: 'Open the compartment', camera: 'push-in', set: 'room' },
  { test: /\b(?:button|handle|switch|lever|dial|machine)\b|बटन|हैंडल|स्विच/iu, performance: 'operate', title: 'Operate the control', camera: 'push-in', set: 'room' },
];

const termPattern = /\b[A-Z][A-Z0-9]{1,11}\b|\b(?:account|app|database|queue|server|cache|lock|network|worker|request|response|storage|gateway|switch|device|client|stock|inventory|balance|settlement|debit|credit|bank|transaction)\b|बैंक|अकाउंट|पैसे|स्टोर|सर्वर|ऐप|रिक्वेस्ट|पेमेंट|कन्फर्मेशन|स्टॉक/gu;
const question = /\?|(?:लेकिन|असल) सवाल|\b(?:but why|but how|the question)\b/iu;

function literalLabel(text: string, limit = 64) {
  return text.length > limit ? text.slice(0, limit - 1).trimEnd() + '…' : text;
}

export function buildLocalFilmPlan(board: Storyboard, timeline: VideoTimeline, overrides: StoryDirectionOverrides = {}) {
  const scenes = board.scenes.map((scene, sceneIndex): VisualStory['scenes'][number] => {
    const narration = cleanNarration(scene.narration);
    const anchors = narrationAnchors(narration);
    const segment = timeline.segments[sceneIndex];
    const startAt = (word: number) => segment.wordFrames?.[word] ?? Math.round(word * segment.audioDurationMs * timeline.fps / (1000 * Math.max(1, narration.split(' ').length)));
    const shots: DraftShot[] = [];
    let lastFrame = -timeline.fps;
    let lastAction: Film['performance'] | undefined;
    const physicalIntro = sceneIndex < 2 && /\b(?:tea|chai|coffee|stall|rider|scooter|kitchen|fridge|door|darwaza|dukaan|maggi(?:e)?|customer|counter|person|worker|operator)\b|चाय(?!वाल)|दुकान|राइडर|फ्रिज|दरवाज़/iu.test(narration);
    if (physicalIntro) {
      for (const anchor of anchors) {
        if (question.test(anchor.text)) break;
        const beat = physicalBeats.find(entry => entry.test.test(anchor.text));
        const match = beat?.performance === 'confirm' ? beat.test.exec(anchor.text) : null;
        const offset = match ? anchor.text.slice(0, match.index).trim().split(/\s+/).filter(Boolean).length : 0;
        const cue = match ? anchor.text.split(' ')[offset] ?? anchor.id : anchor.id;
        const from = startAt(anchor.start + offset);
        if (!beat || beat.performance === lastAction || from - lastFrame < timeline.fps * 0.8 ||
          segment.durationInFrames - from < timeline.fps * 0.8 || shots.length === 4) continue;
        const edit = overrides[`${sceneIndex + 1}-${shots.length + 1}`];
        shots.push({
          kind: 'film', cue: shots.length ? cue : '', evidence: cue, headline: beat.title,
          set: beat.set, performance: beat.performance, camera: edit?.camera ?? beat.camera,
          action: edit?.action ?? anchor.text,
        });
        lastFrame = from;
        lastAction = beat.performance;
      }
    }
    const explanation = shots.length ? anchors.find(anchor => question.test(anchor.text) &&
      startAt(anchor.start) - lastFrame >= timeline.fps * 0.8 &&
      segment.durationInFrames - startAt(anchor.start) >= timeline.fps * 0.8) : anchors[0];
    if (explanation) {
      const remaining = anchors.filter(anchor => anchor.start >= explanation.start);
      const terms = new Map<string, { label: string; cue: string }>();
      for (const anchor of remaining) {
        for (const match of anchor.text.matchAll(termPattern)) {
          if (terms.size < 4 && !terms.has(match[0].toLowerCase())) terms.set(match[0].toLowerCase(), { label: match[0], cue: anchor.id });
        }
      }
      const items = [...terms.values()];
      if (items.length) {
        shots.push({
          kind: 'motion', cue: shots.length ? explanation.id : '', headline: items[0].label, evidence: explanation.id,
          backdrop: true, reset: true,
          actors: items.map((item, index) => ({ entity: `concept-${sceneIndex}-${index}`, label: item.label, icon: 'service' })),
          events: items.map((item, index) => ({ kind: 'update', entity: `concept-${sceneIndex}-${index}`, value: item.label, cue: item.cue })),
        });
      } else {
        shots.push({
          kind: 'focus', cue: shots.length ? explanation.id : '', evidence: explanation.id,
          headline: literalLabel(explanation.text),
        });
      }
    }
    if (!shots.length) {
      shots.push({ kind: 'focus', cue: '', evidence: anchors[0]?.id ?? '@1', headline: literalLabel(narration) || scene.onScreenText });
    }
    return { sceneIndex, shots };
  });
  return compileVisualPlan({ scenes }, board, timeline, 0, scenes.length, { repairAnnotations: true }).map(group =>
    group.map(shot => shot.kind === 'motion' && shot.reset && shot.actors.every(actor => actor.entity.startsWith('concept-'))
      ? { ...shot, headline: '', reveals: shot.eventFrames ?? [] } : shot));
}
