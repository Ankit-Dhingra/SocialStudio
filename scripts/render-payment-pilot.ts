import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Storyboard } from '../src/modules/contracts/storyboard.js';
import { renderStudioShort } from '../src/modules/render/video-renderer.js';
import { buildLocalFilmPlan } from '../src/modules/video/local-film.js';
import type { VideoTimeline } from '../src/modules/video/timeline.js';
import { cleanNarration, type TimedShot } from '../src/modules/video/visual-story.js';
import { performMediaQA } from '../src/modules/qa/media-qa.js';
import { paymentWalkthrough } from './payment-walkthrough.js';

const sessionId = process.argv[2];
const full = process.argv.includes('--full');
if (!sessionId || !/^session_[a-f0-9-]+$/i.test(sessionId)) {
  throw new Error('Pass the saved UPI draft session ID as the first argument.');
}
const { storyboard, timeline } = JSON.parse(await readFile(path.resolve('media/sessions', `${sessionId}.json`), 'utf8')) as {
  storyboard: Storyboard; timeline: VideoTimeline;
};
function frameAt(sceneIndex: number, phrase: string) {
  const narration = cleanNarration(storyboard.scenes[sceneIndex].narration);
  const character = narration.indexOf(phrase);
  if (character < 0) throw new Error(`The approved narration is missing the cue "${phrase}".`);
  const prefix = narration.slice(0, character).trim();
  const word = prefix ? prefix.split(' ').length : 0;
  const segment = timeline.segments[sceneIndex];
  const frame = segment.wordFrames?.[word];
  if (frame === undefined) throw new Error(`The saved voiceover has no timing for "${phrase}".`);
  return segment.startFrame + frame;
}

// This authored pilot covers the approved tea-stall example. Other scripts use their own plans.
const begin = frameAt(0, 'अमन ने QR');
const alert = frameAt(0, 'आवाज़');
const question = frameAt(0, 'लेकिन सवाल');
const nextScene = timeline.segments[1].startFrame;
const end = frameAt(1, 'HDFC') + Math.round(timeline.fps * 1.15);
const data = {
  amount: '₹20',
  merchant: 'Chai seller',
  payer: 'Aman',
  banks: ['SBI', 'HDFC'] as [string, string],
  cues: {
    begin,
    scan: frameAt(0, 'scan किया'),
    authorize: frameAt(0, 'भेजे'),
    confirm: frameAt(0, 'और तुरंत'),
    alert,
    question,
    payer: frameAt(0, 'अमन के बैंक'),
    merchant: frameAt(0, 'चायवाले के बैंक'),
    payerBank: frameAt(1, 'SBI'),
    merchantBank: frameAt(1, 'HDFC'),
  },
};
type Checkout = NonNullable<TimedShot['checkout']>;
function shot(sceneIndex: number, index: number, start: number, until: number, phase: Checkout['phase'], headline: string): TimedShot {
  return {
    id: `${sceneIndex + 1}-pilot-${index}`, kind: 'film', headline, cue: '', evidence: storyboard.scenes[sceneIndex].narration,
    action: headline, performance: 'scan', camera: 'push-in', set: 'counter',
    from: start - timeline.segments[sceneIndex].startFrame, duration: until - start,
    reveals: [], movements: [], takeawayFrame: 0, checkout: {
      ...data, phase, offset: start,
      ...(full && sceneIndex === 1 && { closeQuestionAt: frameAt(1, 'नहीं') }),
    },
  };
}
const visualPlan = buildLocalFilmPlan(storyboard, timeline);
visualPlan[0] = [
  ...(!full ? visualPlan[0].filter(entry => entry.from + entry.duration <= begin) : []),
  shot(0, 1, full ? 0 : begin, nextScene, 'story', 'Scan, soundbox confirmation, and the payment question'),
];
visualPlan[1] = [shot(1, 1, nextScene, nextScene + timeline.segments[1].durationInFrames, 'banks', 'Identify the payer and merchant banks')];
if (full) {
  for (let scene = 2; scene < storyboard.scenes.length; scene++) {
    const segment = timeline.segments[scene];
    const guide = paymentWalkthrough(scene, phrase => frameAt(scene, phrase) - segment.startFrame);
    const timing = [
      ...guide.nodes.flatMap(node => [node.at, ...(node.updates ?? []).map(update => update.at)]),
      ...(guide.edges ?? []).map(edge => edge.at), ...(guide.notes ?? []).map(note => note.at),
      ...(guide.receiptAt === undefined ? [] : [guide.receiptAt]),
    ];
    if (timing.some(frame => frame < 0 || frame >= segment.durationInFrames)) {
      throw new Error(`An authored cue falls outside scene ${scene + 1}.`);
    }
    visualPlan[scene] = [{
      ...shot(scene, 1, segment.startFrame, segment.startFrame + segment.durationInFrames, 'banks', guide.title),
      paymentGuide: guide,
    }];
  }
}
if (process.argv.includes('--check-plan')) {
  console.log(visualPlan.map((shots, index) => ({
    scene: index + 1, shots: shots.map(entry => entry.headline), audio: timeline.segments[index].audioSrc,
  })));
  process.exit(0);
}
const file = `${full ? 'upi-full' : 'payment-pilot'}-${randomUUID()}.mp4`;
const result = await renderStudioShort({
  storyboard, timeline, visualPlan, outputFilePath: path.resolve('media/runs', sessionId, file),
  ...(full ? {} : { previewRange: [begin, end], previewScale: 1 }),
});
if (full) {
  const qa = performMediaQA(result, timeline);
  if (!qa.passed) throw new Error(qa.errors.join('. '));
}
console.log(JSON.stringify({ mediaUrl: `/media/runs/${sessionId}/${file}`, durationSec: result.durationSec }));
