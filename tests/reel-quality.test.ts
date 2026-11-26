import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { prepareSpeech, speechChunks } from '../src/modules/tts/speech-text.js';
import { buildVideoTimeline, repairOpeningWordFrames } from '../src/modules/video/timeline.js';
import { musicVolumeAtFrame } from '../src/modules/video/StudioShortComposition.js';
import { buildStoryboardFromParsed, parseTolerantJson } from '../src/modules/ai-script/master-script-service.js';
import { StoryboardSchema } from '../src/modules/contracts/storyboard.js';
import { findFfmpeg } from '../src/modules/tts/sarvam-provider.js';
import { parseCustomScriptToStoryboard } from '../src/modules/ai-script/custom-script-parser.js';
import { compileVisualPlan } from '../src/modules/video/visual-story.js';
import { buildLocalFilmPlan } from '../src/modules/video/local-film.js';
import { buildMotionStages } from '../src/modules/video/motion-stage.js';
import { prepareReelVisuals, stageReelVisuals } from '../src/modules/render/reel-visual-assets.js';
import { prepareStoryboardVisuals } from '../src/modules/render/storyboard-visuals.js';
import { connectorRoute, nodeSize } from '../src/modules/video/AnimatedConnector.js';
import { vectorCompositionSchema } from '../src/modules/video/vector-spec.js';
import { compileVector } from '../src/modules/render/compile-vector.js';
import { sanitizeVectorAsset } from '../src/modules/render/sanitize-vector-asset.js';
import { canonicalBrandText, reelBrand } from '../src/modules/video/brand.js';
import type { VideoTimeline } from '../src/modules/video/timeline.js';
import { localizeVideoText, toHinglish } from '../src/modules/video/hinglish-text.js';
import { instagramPostUrl, planPublicPostShots } from '../src/modules/render/public-posts.js';
import { randomUUID } from 'node:crypto';

const configuredPlanner = process.env.REEL_VISUAL_PLANNER;
test.before(() => { process.env.REEL_VISUAL_PLANNER = 'legacy'; });
test.after(() => {
  if (configuredPlanner === undefined) delete process.env.REEL_VISUAL_PLANNER;
  else process.env.REEL_VISUAL_PLANNER = configuredPlanner;
});

function storyboardFor(narration: string, title = 'Warehouse relay'): ReturnType<typeof StoryboardSchema.parse> {
  return StoryboardSchema.parse({
    title, topic: title, hook: narration, learningObjective: 'Understand the action and its outcome.',
    scenes: [{
      id: 'hook', sceneIndex: 0, type: 'hook', narration,
      onScreenText: title, technicalKeyPoint: 'System behavior', durationTargetSec: 8,
    }],
  });
}

test('premium routes touch node boundaries and separate return paths', () => {
  const phone = { x: 173, y: 151 };
  const gateway = { x: 673, y: 590 };
  const forward = connectorRoute(phone, gateway, 'orthogonal', -24);
  const reverse = connectorRoute(gateway, phone, 'orthogonal', 24);
  assert.equal(forward.start.x, phone.x + nodeSize.width / 2);
  assert.equal(forward.end.x, gateway.x - nodeSize.width / 2);
  assert.equal(reverse.start.x, forward.end.x);
  assert.notEqual(forward.points?.[1].x, reverse.points?.[1].x);

  const center = { x: 423, y: 372 };
  const compact = connectorRoute(phone, center, 'curve');
  assert.equal(compact.start.y, phone.y + nodeSize.height / 2);
  assert.equal(compact.end.y, center.y - nodeSize.height / 2);
  assert.ok(compact.controls && compact.controls[0].y > compact.start.y);
});

test('SVG specs compile nested geometry, repeated slots and a packet tied to a spoken route', async (t) => {
  const spec = vectorCompositionSchema.parse({
    subject: 'Buffer', definitions: [
      { id: 'tint', kind: 'gradient', from: 'surface', to: 'elevated', axis: 'vertical' },
      { id: 'bounds', kind: 'clip', shape: { kind: 'rect', box: [120, 150, 640, 600], radius: 28 } },
    ], layers: [
      { id: 'body', parent: null, at: null, fill: 'none', stroke: 'none', shape: { kind: 'group' } },
      { id: 'plate', parent: 'body', at: null, fill: 'surface', stroke: 'border',
        shape: { kind: 'rect', box: [120, 150, 640, 600], radius: 28 } },
      { id: 'slot', parent: 'body', at: null, fill: 'elevated', stroke: 'cyan',
        shape: { kind: 'rect', box: [185, 300, 110, 80], radius: 13 } },
      { id: 'path', parent: 'body', at: 'moves', fill: 'none', stroke: 'cyan',
        shape: { kind: 'path', d: 'M 170 530 C 305 590 493 480 683 515' } },
      { id: 'packet', parent: 'body', at: 'moves', fill: 'purple', stroke: 'none',
        shape: { kind: 'circle', center: [170, 530], radius: 12 } },
    ], treatments: [{ target: 'plate', fill: 'tint', clip: 'bounds', mask: null, opacity: 1, strokeWidth: 3, effect: 'shadow' }],
    repeats: [{ target: 'slot', count: 4, columns: 4, dx: 132, dy: 0 }],
    tracks: [{ target: 'path', cue: 'moves', seconds: 1, kind: 'draw' },
      { target: 'packet', cue: 'moves', seconds: 1, kind: 'follow', path: 'path' }], camera: null,
  });
  const options = { fps: 30, duration: 120, cueFrame: (cue: string) => cue === 'moves' ? 50 : undefined,
    labelGrounded: (label: string) => label === 'Buffer', asset: async () => { throw new Error('Unexpected asset'); } };
  const result = await compileVector(spec, options);
  assert.equal(result.layers[4].start, 50);
  assert.equal(result.tracks[1].start, 50);
  assert.equal(result.tracks[1].frames, 30);
  await assert.rejects(compileVector({ ...spec, layers: spec.layers.map(layer => ({ ...layer, at: 'moves' })) }, options), /persistent/);
  await assert.rejects(compileVector({ ...spec, tracks: [...spec.tracks,
    { kind: 'move', target: 'body', from: [0, 0], to: [300, 0], cue: 'moves', seconds: 1 }],
  }, options), /safe canvas/);
  await assert.rejects(compileVector({ ...spec, treatments: spec.treatments.map(item => ({ ...item, mask: 'missing' })) }, options), /mask reference/);
  await assert.rejects(compileVector({ ...spec, definitions: spec.definitions.map(item => item.kind === 'clip'
    ? { ...item, shape: { kind: 'rect', box: [5, 10, 50, 55], radius: 0 } } : item) }, options), /hides its entire layer/);
  assert.equal(vectorCompositionSchema.safeParse({ ...spec, layers: spec.layers.map(layer => ({ ...layer, html: '<script />' })) }).success, false);

  const board = storyboardFor('Buffer holds a packet. The packet moves to the next slot.', 'Buffer');
  const timeline: VideoTimeline = { fps: 30, totalDurationInFrames: 120, totalDurationSec: 4, bgmVolumeDucked: 0.1,
    segments: [{ sceneId: board.scenes[0].id, sceneIndex: 0, type: 'hook', startFrame: 0, durationInFrames: 120,
      audioDurationMs: 4000, audioSrc: 'audio/buffer.mp3', wordFrames: [0, 7, 14, 21, 30, 40, 50, 60, 70, 80, 90] }] };
  const variables = { REEL_PREMIUM_DIRECTOR_PROVIDER: 'groq', GROQ_API_KEYS: 'test-key' };
  const saved = Object.fromEntries(Object.keys(variables).map(name => [name, process.env[name]]));
  Object.assign(process.env, variables);
  t.after(() => { for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  } });
  const request = t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    const prompt = JSON.parse(body.messages.at(-1).content);
    assert.equal(body.response_format.type, 'json_object');
    assert.ok(prompt.vectorCapabilities.primitives.includes('path'));
    assert.match(prompt.outputSchema, /^Reply=/);
    assert.ok(prompt.outputSchema.includes('throughSceneIndex?'));
    const draft = { sceneIndex: 0, layout: 'vector', openingArtwork: null, screen: null, diagram: null, beats: [],
      vector: { ...spec, framing: 'horizontal', focal: ['body'] } };
    return Response.json({ choices: [{ message: { content: JSON.stringify({ scenes: [draft] }) } }] });
  });
  const preview = await prepareStoryboardVisuals(board, timeline);
  assert.equal(request.mock.callCount(), 1);
  assert.deepEqual(preview.unresolvedScenes ?? [], []);
  assert.equal(preview.shots[0][0].vector?.tracks[1].start, 50);
  assert.ok(preview.shots[0][0].vector?.fit);

  const backdrop = { id: 'backdrop', parent: null, at: null, fill: 'surface', stroke: 'border',
    shape: { kind: 'rect', box: [20, 35, 840, 810], radius: 20 } } as const;
  const panelPlan = vectorCompositionSchema.parse({ ...spec, framing: 'horizontal', focal: ['body'],
    layers: [backdrop, ...spec.layers] });
  await assert.rejects(compileVector(panelPlan, options), /outer scene panel/);
  await assert.rejects(compileVector({ ...spec, framing: 'horizontal', focal: ['missing'] }, options), /focal layer/);
});

test('SVG asset ingestion keeps local definitions and rejects active or external markup', () => {
  const svg = '<svg viewBox="0 0 100 50"><defs><clipPath id="crop"><rect x="0" y="0" width="60" height="50"/></clipPath></defs><path clip-path="url(#crop)" d="M0 0L100 30" stroke="#fff"/></svg>';
  const safe = sanitizeVectorAsset(Buffer.from(svg));
  assert.equal(safe.width, 100);
  assert.match(safe.bytes.toString(), /xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  for (const content of [
    '<script>alert(1)</script>', '<image href="https://example.com/x"/>',
    '<circle cx="15" cy="10" r="3" onclick="alert(1)"/>',
    '<circle r="8" fill="url(https://example.com/x)"/>', '<foreignObject/>', '<path d="M0 0L1e309 32"/>',
  ]) assert.throws(() => sanitizeVectorAsset(Buffer.from('<svg viewBox="0 0 100 50">' + content + '</svg>')), /unsafe markup/);
  assert.throws(() => sanitizeVectorAsset(Buffer.from('<!DOCTYPE svg [<!ENTITY xx SYSTEM "file:///local">]><svg viewBox="0 0 100 50"/>')), /unsafe markup/);
});

test('one technical canvas keeps its state and port routes across two narration segments', async (t) => {
  const board = storyboardFor('A file enters processing.', 'File processing');
  board.scenes.push({ ...board.scenes[0], id: 'storage', sceneIndex: 1, narration: 'Store the vector in the database.' });
  const timeline: VideoTimeline = { fps: 30, totalDurationInFrames: 240, totalDurationSec: 8, bgmVolumeDucked: .1,
    segments: board.scenes.map((scene, index) => ({ sceneId: scene.id, sceneIndex: index, type: 'hook',
      startFrame: index * 120, durationInFrames: 120, audioDurationMs: 4000, audioSrc: 'audio/test.mp3',
      wordFrames: [0, 15, 30, 45, 60, 75] })) };
  const object = (id: string, family: string, box: number[], label: string, at: string | null) => ({
    id, parent: null, at, fill: 'none', stroke: 'none', shape: { kind: 'object', family, box, label, detail: null, values: null, tone: 'cyan' },
  });
  const plan = { scenes: [{ sceneIndex: 0, throughSceneIndex: 1, layout: 'vector', beats: [], openingArtwork: null,
    screen: null, diagram: null, vector: { subject: 'file', framing: 'canvas', focal: ['file', 'database'],
      layers: [object('file', 'document', [88, 250, 224, 360], 'File', null),
        object('service', 'service', [470, 300, 280, 90], 'Processing', '1|processing'),
        object('database', 'database', [490, 721, 240, 230], 'Database', '2|database')],
      camera: null, definitions: [], repeats: [], tracks: [], treatments: [],
      connectors: [{ id: 'store', from: { target: 'service', side: 'bottom' }, to: { target: 'database', side: 'top' },
        via: [], cue: '2|database', seconds: 1, tone: 'cyan', packets: 2 }],
    } }] };
  const request = mockSceneDirector(t, plan);
  const preview = await prepareStoryboardVisuals(board, timeline);
  const [first, second] = preview.shots.map(group => group[0].vector);
  assert.deepEqual(preview.unresolvedScenes ?? [], []);
  assert.equal(request.mock.callCount(), 1);
  assert.equal(first?.sequenceOffset, 0);
  assert.equal(second?.sequenceOffset, 120);
  assert.deepEqual(first?.layers, second?.layers);
  assert.equal(second?.connectors?.[0].path, 'M 610 390 L 610 721');
  assert.equal(second?.connectors?.[0].start, 195);
  assert.equal(preview.shots[1][0].actionFrame, 75);
});

function mockSceneDirector(t: TestContext, plan: unknown) {
  const variables = { REEL_PREMIUM_DIRECTOR_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key',
    GROQ_API_KEY: '', GROQ_API_KEYS: '' };
  const saved = Object.fromEntries(Object.keys(variables).map(name => [name, process.env[name]]));
  Object.assign(process.env, variables);
  t.after(() => { for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
  const content = JSON.stringify(plan);
  return t.mock.method(globalThis, 'fetch', async () => Response.json({
    candidates: [{ content: { parts: [{ text: content }] } }],
  }));
}

test('video captions and nested scene text use Roman Hinglish with the original word positions', () => {
  const narration = 'फिर एक event Queue में जाएगा। API ने ₹९० दिखाए।';
  const words = narration.split(' ');
  const captionWords = words.map(toHinglish);
  assert.equal(captionWords.join(' '), 'phir ek event Queue mein jaayega. API ne ₹90 dikhaye.');
  assert.equal(captionWords.length, words.length);

  const original = {
    narration, spokenNarration: narration, headline: 'क्या होगा?',
    nativeScene: { steps: [{ label: 'वर्कर', description: 'स्टेटस अपडेट हुआ।', from: 47 }] },
    takeaways: ['फ़ोन में दिखा'], appName: 'फ़ोन', asset: 'shots/फ़ोन.png',
    evidence: 'स्टेटस अपडेट हुआ।',
  };
  const display = localizeVideoText(original);
  assert.deepEqual(display.nativeScene.steps, [{ label: 'worker', description: 'status update hua.', from: 47 }]);
  assert.deepEqual([display.headline, display.takeaways[0], display.appName], ['kya hoga?', 'phone mein dikha', 'phone']);
  assert.deepEqual([display.spokenNarration, display.asset, display.evidence],
    [original.spokenNarration, original.asset, original.evidence]);
  assert.equal(original.narration, narration);
  const legacyBrand = 'Follow Behind The Tech abhi';
  assert.equal(canonicalBrandText(legacyBrand), `Follow ${reelBrand.name} abhi`);
  assert.equal(canonicalBrandText(legacyBrand).split(' ').length, legacyBrand.split(' ').length);
  assert.equal(canonicalBrandText('Behind The Tech @behindthetech'), 'Behind The Tech');
});

test('an authored queue renders its real stages at spoken cues and pins the previewed plan for export', async (t) => {
  const narration = 'The job enters the queue. The worker takes it. The job is complete.';
  const board = storyboardFor(narration, 'The job lifecycle');
  board.scenes[0] = StoryboardSchema.shape.scenes.element.parse({
    ...board.scenes[0], type: 'queueTimeline', visualProps: {
      title: 'The job lifecycle',
      items: [
        { name: 'enters the queue', detail: '', cue: 'enters the queue' },
        { name: 'worker takes it', detail: '', cue: 'worker takes it' },
        { name: 'job is complete', detail: '', cue: 'job is complete' },
      ],
    },
  });
  const wordFrames = narration.split(' ').map((_, index) => index * 9);
  const timeline: VideoTimeline = { fps: 30, totalDurationInFrames: 150, totalDurationSec: 5, bgmVolumeDucked: 0.12,
    segments: [{ sceneId: board.scenes[0].id, sceneIndex: 0, type: 'queueTimeline', startFrame: 0,
      durationInFrames: 150, audioDurationMs: 5000, audioSrc: 'audio/job.mp3', wordFrames }] };
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected provider request'); });

  const preview = await prepareStoryboardVisuals(board, timeline);
  const shot = preview.shots[0][0];
  assert.equal(shot.nativeScene?.kind, 'queue');
  assert.deepEqual(shot.reveals, [18, 54, 90]);
  assert.equal(buildMotionStages(preview.shots, timeline).has(shot.id), false);
  assert.deepEqual(shot.operation, { kind: 'queue', label: 'job', steps: [
    { action: 'enqueue', from: 18 }, { action: 'dispatch', from: 54 }, { action: 'complete', from: 90 },
  ] });
  assert.strictEqual(await prepareStoryboardVisuals(board, structuredClone(timeline), preview), preview);
  assert.equal(fetch.mock.callCount(), 0);
});

test('the director supplies each screen action and its narration cue for a document scene', async (t) => {
  const plan = { scenes: [{ sceneIndex: 0, layout: 'device', diagram: null, openingArtwork: null,
    screen: { appName: 'ChatGPT', layout: 'desktop', content: 'document' }, beats: [
      { label: 'PDF', detail: '500 pages', cue: 'upload', action: 'attach' },
      { label: 'सवाल', detail: '', cue: 'सवाल', action: 'input' },
      { label: 'जवाब', detail: '', cue: 'जवाब', action: 'result' },
    ] }] };
  const fetch = mockSceneDirector(t, plan);
  const narration = 'ChatGPT पर 500 pages की PDF upload करो, फिर सवाल पूछो और जवाब मिल जाता है।';
  const board = storyboardFor(narration, 'A document question');
  const timeline: VideoTimeline = { fps: 30, totalDurationInFrames: 180, totalDurationSec: 6, bgmVolumeDucked: 0.12,
    segments: [{ sceneId: board.scenes[0].id, sceneIndex: 0, type: 'hook', startFrame: 0,
      durationInFrames: 180, audioDurationMs: 6000, audioSrc: 'audio/document.mp3',
      wordFrames: narration.split(' ').map((_, index) => index * 10) }] };
  const visuals = await prepareStoryboardVisuals(board, timeline);
  const opening = visuals.shots[0][0];
  assert.equal(opening.kind, 'device');
  if (opening.kind !== 'device') throw new Error('Expected a document interaction');
  assert.equal(opening.screenContent, 'document');
  assert.equal(opening.actors[0].value, '500 pages');
  assert.deepEqual(opening.screenActions, ['attach', 'input', 'result']);
  assert.deepEqual(opening.reveals, [60, 90, 120]);
  assert.equal(fetch.mock.callCount(), 1);
});

test('a different script generates a branching motion diagram from its own actors and events', async (t) => {
  const narration = 'A webhook sends the event to a router. The router forwards it to billing and sends a copy to analytics.';
  const storyboard = storyboardFor(narration, 'Webhook fan-out');
  const timeline: VideoTimeline = { fps: 30, totalDurationInFrames: 240, totalDurationSec: 8, bgmVolumeDucked: 0.12,
    segments: [{ sceneId: storyboard.scenes[0].id, sceneIndex: 0, type: 'hook', startFrame: 0,
      durationInFrames: 240, audioDurationMs: 8000, audioSrc: 'audio/webhook.mp3',
      wordFrames: narration.split(' ').map((_, index) => index * 10) }] };
  mockSceneDirector(t, { scenes: [{ sceneIndex: 0, layout: 'diagram', openingArtwork: null, screen: null, beats: [],
    diagram: { nodes: [
      { id: 'webhook', label: 'webhook', icon: 'service' }, { id: 'router', label: 'router', icon: 'server' },
      { id: 'billing', label: 'billing', icon: 'store' }, { id: 'analytics', label: 'analytics', icon: 'database' },
    ], events: [
      { kind: 'send', source: 'webhook', target: 'router', cue: 'sends the event', value: null, outcome: null },
      { kind: 'send', source: 'router', target: 'billing', cue: 'forwards it to billing', value: null, outcome: null },
      { kind: 'send', source: 'router', target: 'analytics', cue: 'sends a copy', value: null, outcome: null },
    ] },
  }] });
  const plan = await prepareStoryboardVisuals(storyboard, timeline);
  const shot = plan.shots[0][0];
  assert.equal(shot.kind, 'motion');
  const stage = buildMotionStages(plan.shots, timeline).get(shot.id);
  assert.deepEqual(stage?.packets.map(packet => [packet.source, packet.target, packet.frame]), [
    ['webhook', 'router', 20], ['router', 'billing', 100], ['router', 'analytics', 150],
  ]);
});

test('scene planning repairs ungrounded storyboard labels and falls back to Gemini on a Groq outage', async (t) => {
  const narration = 'The request enters a queue. Then the worker takes the request. Finally the job is complete.';
  const board = storyboardFor(narration);
  board.scenes[0] = StoryboardSchema.shape.scenes.element.parse({
    ...board.scenes[0], type: 'requestFlow', visualProps: { title: 'Generic Pipeline', steps: [
      { label: 'State Mutex', description: 'Acquires a lease' },
      { label: 'Durable Store', description: 'Commits writes' },
    ] },
  });
  const timeline: VideoTimeline = { fps: 30, totalDurationInFrames: 180, totalDurationSec: 6, bgmVolumeDucked: 0.12,
    segments: [{ sceneId: board.scenes[0].id, sceneIndex: 0, type: 'requestFlow', startFrame: 0,
      durationInFrames: 180, audioDurationMs: 6000, audioSrc: 'audio/job.mp3',
      wordFrames: narration.split(' ').map((_, index) => index * 8) }] };
  const vars = { REEL_PREMIUM_DIRECTOR_PROVIDER: 'groq', REEL_PREMIUM_DIRECTOR_MODEL: 'qwen/qwen3.8-27b',
    GROQ_API_KEYS: 'test-key', GEMINI_API_KEY: 'test-key', REEL_IMAGE_GENERATION: 'off' };
  const saved = Object.fromEntries(Object.keys(vars).map(name => [name, process.env[name]]));
  Object.assign(process.env, vars);
  t.after(() => { for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    calls.push(new URL(url).hostname);
    if (url.includes('api.groq.com')) return new Response('{}', { status: 503 });
    assert.equal(JSON.parse(options.body as string).contents[0].parts[0].text.includes('State Mutex'), false);
    const plan = { scenes: [{ sceneIndex: 0, layout: 'queue', openingArtwork: null, screen: null, diagram: null, beats: [
      { label: 'enters a queue', detail: '', cue: 'enters a queue', action: null },
      { label: 'worker takes the request', detail: '', cue: 'worker takes the request', action: null },
      { label: 'job is complete', detail: '', cue: 'job is complete', action: null },
    ] }] };
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(plan) }] } }] });
  });
  const visuals = await prepareStoryboardVisuals(board, timeline);
  const scene = visuals.shots[0][0].operation;
  assert.equal(scene?.kind, 'queue');
  if (scene?.kind !== 'queue') throw new Error('Expected a queue operation');
  assert.deepEqual(scene.steps.map(step => step.action), ['enqueue', 'dispatch', 'complete']);
  assert.deepEqual(calls, ['api.groq.com', 'generativelanguage.googleapis.com']);
});

test('partial director results retry only missing scenes and targeted edits preserve other shots', async (t) => {
  const first = storyboardFor('The request enters the queue. The worker takes it. The request is complete.');
  const board = StoryboardSchema.parse({ ...first, scenes: [...first.scenes, {
    ...first.scenes[0], id: 'worker', sceneIndex: 1, type: 'architecturePipeline',
    narration: 'The event enters the queue. The worker takes it. The event is complete.',
  }] });
  const [before] = first.scenes;
  const proposals = board.scenes.map((scene, sceneIndex) => ({
    sceneIndex, layout: 'queue', openingArtwork: null, diagram: null, screen: null,
    beats: scene.narration.split('. ').slice(0, 2).map(clause => {
      const label = clause.replace(/\.$/, '');
      return { label, cue: label, detail: '', action: null };
    }),
  }));
  const provider = mockSceneDirector(t, { scenes: [proposals[0]] });
  const requests: Array<{ indexes: number[]; repair: boolean }> = [];
  provider.mock.mockImplementation(async (_url, options) => {
    const payload = JSON.parse(JSON.parse(String(options?.body)).contents[0].parts[0].text);
    const indexes = payload.scenes.map((scene: { sceneIndex: number }) => scene.sceneIndex);
    requests.push({ indexes, repair: payload.repair });
    assert.equal(payload.fullStory[0], before.narration);
    const content = JSON.stringify({ scenes: [proposals[indexes[0]]] });
    return Response.json({ candidates: [{ content: { parts: [{ text: content }] } }] });
  });

  const timeline = buildVideoTimeline(board);
  const preview = await prepareStoryboardVisuals(board, timeline);
  assert.deepEqual(preview.unresolvedScenes, []);
  const edited = await prepareStoryboardVisuals(board, timeline, preview, { sceneIndices: [1], editorFeedback: 'Show the two worker stages.' });
  assert.strictEqual(edited.shots[0], preview.shots[0]);
  const incomplete = { ...preview, unresolvedScenes: [1],
    shots: [preview.shots[0], [{ ...preview.shots[1][0], requiresDirection: true }]] };
  assert.strictEqual(await prepareStoryboardVisuals(board, timeline, incomplete), incomplete);
  const retried = await prepareStoryboardVisuals(board, timeline, incomplete, { retryUnresolved: true });
  assert.strictEqual(retried.shots[0], preview.shots[0]);
  assert.deepEqual(retried.unresolvedScenes, []);
  assert.equal(retried.shots[1][0].requiresDirection, undefined);
  assert.deepEqual(requests, [
    { indexes: [0, 1], repair: false }, { indexes: [1], repair: true },
    { indexes: [1], repair: false }, { indexes: [1], repair: false },
  ]);
});

test('trend scenes accept only grounded observations with the same unit', async (t) => {
  const plan = { scenes: [{ sceneIndex: 0, layout: 'trend', openingArtwork: null, diagram: null, screen: null, beats: [
    { label: 'Pehle minute', cue: 'Pehle minute', detail: '20 ms', action: null },
    { label: 'Doosre minute', cue: 'Doosre minute', detail: '35 ms', action: null },
  ] }] };
  mockSceneDirector(t, plan);
  const valid = storyboardFor('Pehle minute latency 20 ms thi. Doosre minute latency 35 ms thi.', 'Latency during a spike');
  const approved = await prepareStoryboardVisuals(valid, buildVideoTimeline(valid));
  assert.equal(approved.shots[0][0].chartStyle, 'trend');

  const unrelated = storyboardFor('Pehle minute latency 20 ms thi. Doosre minute latency 35 seconds thi.', 'Mixed latency units');
  const rejected = await prepareStoryboardVisuals(unrelated, buildVideoTimeline(unrelated));
  assert.deepEqual(rejected.unresolvedScenes, [0]);
  assert.equal(rejected.shots[0][0].chartStyle, undefined);
});

test('spoken counts become membership visuals after an invented transfer is rejected', async (t) => {
  const board = storyboardFor('H3 marks a hexagon. Inside it, twenty jobs wait and five workers are available.');
  const invalid = { sceneIndex: 0, layout: 'diagram', openingArtwork: null, screen: null, beats: [],
    diagram: { nodes: [{ id: 'h3', label: 'H3', icon: 'map' }, { id: 'jobs', label: 'jobs', icon: 'queue' }],
      events: [{ kind: 'send', source: 'h3', target: 'jobs', cue: 'jobs wait', value: null, outcome: null }] } };
  const repair = { sceneIndex: 0, layout: 'operation', openingArtwork: null, screen: null, diagram: null, beats: [],
    operation: { kind: 'group', group: 'H3', shape: 'hexagon', cue: 'H3 marks',
      measures: [{ label: 'jobs', cue: 'twenty jobs', amount: 20, spokenAmount: 'twenty', symbol: 'jobs' },
        { label: 'workers', cue: 'five workers', amount: 5, spokenAmount: 'five', symbol: 'people' }] } };
  const mock = mockSceneDirector(t, { scenes: [invalid] });
  let calls = 0;
  mock.mock.mockImplementation(async (_url, options) => {
    const prompt = JSON.parse(JSON.parse(String(options?.body)).contents[0].parts[0].text);
    if (calls++) assert.match(prompt.scenes[0].repairReason, /real transfer/);
    const content = JSON.stringify({ scenes: [prompt.repair ? repair : invalid] });
    return Response.json({ candidates: [{ content: { parts: [{ text: content }] } }] });
  });
  const timeline = buildVideoTimeline(board);
  const result = await prepareStoryboardVisuals(board, timeline);
  const shot = result.shots[0][0];
  assert.equal(shot.operation?.kind, 'group');
  if (shot.operation?.kind !== 'group') throw new Error('Expected spatial membership');
  assert.deepEqual(shot.operation.measures.map(measure => measure.amount), [20, 5]);
  assert.equal(buildMotionStages(result.shots, timeline).size, 0);
  assert.equal(shot.headline, '');
});

test('exhausted technical direction keeps narration out of headings and nodes', async (t) => {
  const narration = 'Then the second action happens. After that the final result is visible.';
  const initial = storyboardFor(narration);
  initial.scenes[0] = StoryboardSchema.shape.scenes.element.parse({ ...initial.scenes[0],
    type: 'architecturePipeline', onScreenText: 'Then the second action happens' });
  mockSceneDirector(t, { scenes: [{ sceneIndex: 0, layout: 'flow', openingArtwork: null,
    screen: null, diagram: null, beats: [{ label: 'second action happens', cue: 'second action happens', detail: '', action: null },
      { label: 'final result is visible', cue: 'final result is visible', detail: '', action: null }] }] });
  const timeline = buildVideoTimeline(initial);
  const result = await prepareStoryboardVisuals(initial, timeline);
  const shot = result.shots[0][0];
  assert.deepEqual(result.unresolvedScenes, [0]);
  assert.equal(shot.requiresDirection, true);
  assert.equal(buildMotionStages(result.shots, timeline).size, 0);
  assert.equal(shot.headline, '');
  assert.equal(shot.focus, undefined);
});

test('a retrieval miss uses the actual query, selected passage, processor, and result cues', async (t) => {
  const initial = storyboardFor('The return policy query finds the returns guide and shipping rates. Wrong shipping rates are selected. Send shipping rates to the LLM. The incomplete answer appears.');
  mockSceneDirector(t, { scenes: [{ sceneIndex: 0, layout: 'operation', openingArtwork: null,
    screen: null, diagram: null, beats: [],
    operation: { kind: 'selection', query: 'return policy', cue: 'Wrong shipping rates are selected',
      candidates: ['returns guide', 'shipping rates'], selected: 'Shipping rates',
      selectsAt: 'Wrong shipping rates are selected', processor: 'LLM', sendsAt: 'Send shipping rates to the LLM',
      result: 'incomplete answer', resultAt: 'incomplete answer appears', outcome: 'miss' },
  }] });
  const compiled = await prepareStoryboardVisuals(initial, buildVideoTimeline(initial));
  const operation = compiled.shots[0][0].operation;
  assert.equal(operation?.kind, 'selection');
  if (operation?.kind !== 'selection' || !operation.processor) throw new Error('Expected a selection with a downstream processor');
  assert.equal(operation.selected, 'shipping rates');
  assert.ok(operation.from < operation.selects && operation.selects < operation.processor.from && operation.processor.from < operation.ends);
});

test('a short Groq rate limit retries one incomplete batch after its Retry-After', async (t) => {
  const settings = { REEL_PREMIUM_DIRECTOR_PROVIDER: 'groq', GROQ_API_KEYS: 'fixture', GEMINI_API_KEY: '' };
  const previous = Object.fromEntries(Object.keys(settings).map(name => [name, process.env[name]]));
  Object.assign(process.env, settings);
  t.after(() => { for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
  const initial = storyboardFor('The request enters the queue. Then the worker picks it up.');
  const proposal = { scenes: [{ sceneIndex: 0, layout: 'queue', openingArtwork: null, diagram: null, screen: null, beats: [
    { label: 'enters the queue', cue: 'enters the queue', detail: '', action: null },
    { label: 'worker picks it up', cue: 'worker picks it up', detail: '', action: null },
  ] }] };
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => ++calls === 1
    ? new Response('{}', { status: 429, headers: { 'retry-after': '0' } })
    : Response.json({ choices: [{ message: { content: JSON.stringify(proposal) } }] }));
  const prepared = await prepareStoryboardVisuals(initial, buildVideoTimeline(initial));
  assert.equal(calls, 2);
  assert.deepEqual(prepared.unresolvedScenes, []);
});

test('premium reel plans the visual thread before matching artwork and rejects an inert opening', async (t) => {
  const vars = { GEMINI_API_KEY: 'test-key', REEL_PREMIUM_DIRECTOR_PROVIDER: 'gemini', REEL_IMAGE_PROVIDER: 'gemini', REEL_IMAGE_GENERATION: 'on', REEL_STORY_VIDEO_MODEL: '' };
  const saved = Object.fromEntries(Object.keys(vars).map(name => [name, process.env[name]]));
  Object.assign(process.env, vars);
  t.after(() => { for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  } });
  const png = fs.readFileSync(path.join('remotion', 'public', 'visuals', 'demo-qr.png'));
  let attempts = 0;
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).endsWith('/interactions')) {
      calls.push('video');
      return Response.json({ error: { status: 'RESOURCE_EXHAUSTED' } }, { status: 429 });
    }
    const body = JSON.parse(String(options?.body));
    const stage = body.systemInstruction?.parts?.[0]?.text ?? '';
    if (body.generationConfig?.responseModalities?.includes('IMAGE')) {
      calls.push('art');
      return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] });
    }
    let response;
    const input = JSON.parse(body.contents[0].parts[0].text);
    if (stage.startsWith('Direct the entire')) {
      calls.push('edit');
      response = { visualThread: input.editorFeedback ? 'Follow the parcel toward the loading dock' : 'Follow a parcel through the depot', continuity: 'One yellow parcel on a warehouse conveyor',
        scenes: [{ sceneIndex: 0, purpose: 'hook', visual: 'Show a parcel moving from the conveyor to the loading area. '.repeat(6) }] };
    } else {
      calls.push('shots');
      assert.equal(input.editorialPlan.visualThread, input.editorFeedback ? 'Follow the parcel toward the loading dock' : 'Follow a parcel through the depot');
      assert.ok(input.editorialPlan.scenes[0].visual.length <= 260);
      const image = { kind: 'image', headline: 'A parcel arrives', cue: '', evidence: '@1', brief: 'A yellow parcel on a warehouse conveyor',
        continuity: 'depot-parcel', action: 'A parcel lands on a conveyor', camera: 'push-in' };
      response = { scenes: [{ sceneIndex: 0, shots: ++attempts === 1 ? [image] : [image, {
        kind: 'motion', cue: '@2', evidence: '@2', headline: 'Parcel reaches the dock', backdrop: true,
        actors: [{ entity: 'parcel', label: 'Parcel', icon: 'package' }, { entity: 'dock', label: 'Dock', icon: 'store' }],
        events: [{ kind: 'send', source: 'parcel', target: 'dock', cue: '@2' }],
      }] }] };
    }
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(response) }] } }] });
  });
  const storyboard = storyboardFor('A parcel lands on a conveyor. It moves to the loading dock.', `Parcel route ${randomUUID()}`);
  const timeline = buildVideoTimeline(storyboard);
  const assets = await prepareReelVisuals(storyboard, timeline, undefined, { premium: true });
  assert.deepEqual(calls, ['edit', 'shots', 'shots', 'art']);
  assert.equal(assets.visualThread, 'Follow a parcel through the depot');
  assert.deepEqual(assets.shots[0].map(shot => shot.kind), ['image', 'motion']);
  assert.ok(assets.shots[0][0].asset);
  assert.ok(assets.shots[0].every(shot => shot.premium));
  assert.equal(await prepareReelVisuals(storyboard, timeline, assets, { premium: true, throughFrame: 20 }), assets);
  process.env.REEL_STORY_VIDEO_MODEL = 'gemini-omni-1.2-flash';
  const revised = await prepareReelVisuals(storyboard, timeline, assets, { premium: true, editorFeedback: 'Focus on the loading dock.' });
  assert.notEqual(revised.fingerprint, assets.fingerprint);
  assert.equal(revised.visualThread, 'Follow the parcel toward the loading dock');
  assert.equal(calls.filter(stage => stage === 'video').length, 1);
  assert.ok(revised.shots[0][0].asset);
  assert.equal(revised.shots[0][0].clip, undefined);
  assert.equal(await prepareReelVisuals(storyboard, timeline, revised, { premium: true }), revised);
});

test('offline messaging uses narrated cues and replaces unrelated physical shots', async () => {
  const board = storyboardFor('The phone is offline. Internet ON, messages arrive from 20 people. A pending backlog held 900 messages.', 'Offline messaging');
  const timeline = buildVideoTimeline(board);
  const segment = timeline.segments[0];
  segment.wordFrames = [0, 0, 0, 0, 66, 70, 77, 81, 84, 92, 95, 102, 108, 112, 123, 133, 140];
  segment.speechRanges = [{ start: 0, end: 1.4 }, { start: 2.2, end: 5.5 }];
  const repaired = repairOpeningWordFrames(board, timeline);
  assert.ok(repaired.segments[0].wordFrames![1] > 0);
  assert.equal(repaired.segments[0].wordFrames![4], 66);
  const assets = await prepareReelVisuals(board, repaired, undefined, { localFilm: true });
  const shot = assets.shots[0][0];
  assert.equal(shot.kind, 'device');
  assert.equal(shot.messaging?.count, '900');
  assert.equal(shot.messaging?.people, '20');
  assert.equal(shot.messaging?.statusAt, 66);
  assert.equal(shot.messaging?.messagesAt, 77);
});

test('dashboard previews and export share the directed film and narrated diagrams', async (t) => {
  const board = storyboardFor('The operator opens the fridge. The client sends a request to the server. The firewall blocks the request.', `Firewall demo ${randomUUID()}`);
  board.scenes.push({ ...board.scenes[0], id: 'next', sceneIndex: 1, narration: 'The client retries.' });
  const timeline = buildVideoTimeline(board);
  timeline.segments.forEach((segment, index) => {
    segment.wordFrames = board.scenes[index].narration.split(' ').map((_, word) => word * 8);
  });
  const vars = { GEMINI_API_KEY: 'test-key', REEL_DIRECTOR_PROVIDER: 'gemini', GROQ_API_KEYS: 'test-key' };
  const saved = Object.fromEntries(Object.keys(vars).map(name => [name, process.env[name]]));
  Object.assign(process.env, vars);
  t.after(() => {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  const actors = [
    { entity: 'client', label: 'Client', icon: 'phone' },
    { entity: 'server', label: 'Server', icon: 'server' },
  ];
  const response = { scenes: [
    { sceneIndex: 0, shots: [
      { kind: 'film', headline: 'Opening the fridge', evidence: '@1', action: 'The operator opens the fridge',
        set: 'room', performance: 'open', framing: 'close', camera: 'push-in', actionCue: 'opens the fridge' },
      { kind: 'motion', headline: 'Request is blocked', evidence: '@3', cue: '@2', backdrop: true, actors, events: [
        { kind: 'send', source: 'client', target: 'server', cue: '@3', outcome: 'blocked' },
      ] },
    ] },
    { sceneIndex: 1, shots: [{ kind: 'motion', headline: 'Client retries', evidence: '@1', actors: [actors[0]],
      events: [{ kind: 'update', entity: 'client', cue: '@1', value: 'Retrying' }] }] },
  ] };
  const provider = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    assert.ok(body.generationConfig.responseJsonSchema.properties.scenes.items.properties.shots.items.properties.kind.enum.includes('film'));
    assert.deepEqual(JSON.parse(body.contents[0].parts[0].text).scenes.map((scene: { sceneIndex: number }) => scene.sceneIndex), [0, 1]);
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(response) }] } }] });
  });
  const preview = await prepareReelVisuals(board, timeline, undefined, { localFilm: true, throughFrame: 25 });
  t.after(() => fs.rmSync(path.join('media', 'generated-reel-visuals', `${preview.fingerprint}.json`), { force: true }));
  assert.equal(preview.direction, 'directed');
  const [film, diagram] = preview.shots[0];
  assert.equal(film.kind, 'film');
  assert.equal(film.framing, 'close');
  assert.equal(film.actionFrame, 16);
  assert.equal(diagram.kind, 'motion');
  assert.equal(diagram.backdrop, true);
  assert.deepEqual(diagram.paymentGuide?.edges?.map(edge => [edge.from, edge.to, edge.at, edge.blocked]), [['client', 'server', 64, true]]);
  const edited = await prepareReelVisuals(board, timeline, preview, { localFilm: true,
    overrides: { [film.id]: { action: film.action, camera: 'track-left' } } });
  assert.equal(edited.fingerprint, preview.fingerprint);
  assert.deepEqual(edited.shots[0][0], { ...film, camera: 'track-left' });
  assert.deepEqual(edited.shots[1], preview.shots[1]);
  assert.equal(provider.mock.callCount(), 1);

  const other = storyboardFor('The operator opens the fridge.', `Local direction ${randomUUID()}`);
  const otherTimeline = buildVideoTimeline(other);
  process.env.REEL_DIRECTOR_PROVIDER = 'groq';
  provider.mock.mockImplementation(async url => {
    assert.match(String(url), /api\.groq\.com/u);
    return new Response('{}', { status: 429 });
  });
  const fallback = await prepareReelVisuals(other, otherTimeline, undefined, { localFilm: true });
  assert.equal(fallback.direction, 'local');
  assert.equal(fallback.shots[0][0].kind, 'film');
  assert.deepEqual(await prepareReelVisuals(other, otherTimeline, fallback, { localFilm: true }), fallback);
});

test('a named phone app opens on its cue and reveals the narrated screen value', () => {
  const board = storyboardFor('She opens Acme Market. A book goes into the cart. The total is ₹90.', 'A shopping app');
  const timeline = buildVideoTimeline(board);
  timeline.segments[0].wordFrames = board.scenes[0].narration.split(' ').map((_, index) => index * 8);
  const device = {
    kind: 'device', headline: 'Add a book to the cart', evidence: '@1', appName: 'Acme Market', openCue: 'opens Acme Market',
    actors: [
      { entity: 'cart', label: 'Book in cart', cue: '@2' },
      { entity: 'total', label: 'Total', value: '₹90', cue: '@3' },
    ],
  };
  const compile = (shot: typeof device) => compileVisualPlan({ scenes: [{ sceneIndex: 0, shots: [shot] }] }, board, timeline)[0][0];
  const shot = compile(device);
  assert.equal(shot.openFrame, 8);
  assert.deepEqual(shot.reveals, [32, 80]);
  assert.throws(() => compile({ ...device, appName: 'Different App' }), /app absent from the approved script/);
});

test('a scene that names a public Instagram post gets a phone shot without borrowing other scenes’ references', () => {
  const board = storyboardFor('Open Instagram to see this post: https://www.instagram.com/p/PublicDemo01/');
  board.scenes.push({ ...board.scenes[0], id: 'counter', sceneIndex: 1, narration: 'A counter tracks each request.' });
  const timeline = buildVideoTimeline(board);
  const fallback = buildLocalFilmPlan(board, timeline);
  const [opener, counter] = planPublicPostShots(fallback, board, timeline);
  const shot = opener[0];
  assert.equal(shot.kind, 'device');
  assert.equal(shot.appName, 'Instagram');
  assert.equal(shot.publicPostUrl, 'https://www.instagram.com/p/PublicDemo01/');
  assert.equal(shot.duration, fallback[0][0].duration);
  assert.equal(counter, fallback[1]);
  assert.equal(instagramPostUrl('https://instagram.com.evil.test/p/PublicDemo01/'), undefined);
});

test('the director retries only missing artwork and preserves continuity across shots', async (t) => {
  const board = storyboardFor('The worker enters the warehouse. The worker scans the bin.', `Warehouse relay ${randomUUID()}`);
  const timeline = buildVideoTimeline(board);
  const image = fs.readFileSync('remotion/public/visuals/demo-qr.png');
  const director = { scenes: [{ sceneIndex: 0, shots: [
    { cue: '', kind: 'image', headline: 'Enter the warehouse', evidence: 'The worker enters the warehouse', brief: 'A worker enters the warehouse through its front door', continuity: 'warehouse team' },
    { cue: 'The worker scans the bin', kind: 'image', headline: 'Scan the bin', evidence: 'The worker scans the bin', brief: 'The same worker holds a scanner beside a bin', continuity: 'warehouse team' },
  ] }] };
  const envKeys = ['LLM_PROVIDER', 'GEMINI_API_KEY', 'REEL_DIRECTOR_PROVIDER', 'REEL_IMAGE_GENERATION', 'REEL_IMAGE_PROVIDER', 'REEL_IMAGE_MODEL', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'];
  const state = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key', REEL_DIRECTOR_PROVIDER: 'gemini', REEL_IMAGE_GENERATION: 'on', REEL_IMAGE_PROVIDER: 'gemini', REEL_IMAGE_MODEL: 'test-image-model' });
  t.after(() => {
    for (const [name, value] of Object.entries(state)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  let plans = 0;
  const images: string[] = [];
  const cloudflareCalls: string[] = [];
  let failSecond = true;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).startsWith('https://api.cloudflare.com/')) {
      assert.match(String(url), /\/accounts\/[a-f0-9]{32}\/ai\/run\/@cf\/black-forest-labs\/flux-2-klein-4b$/);
      assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer test-workers-ai-token');
      assert.ok(options?.body instanceof FormData);
      const form = options.body;
      assert.equal(form.get('width'), '720');
      assert.equal(form.get('height'), '1280');
      const prompt = String(form.get('prompt'));
      cloudflareCalls.push(prompt);
      const reference = form.get('input_image_0');
      if (prompt.includes('holds a scanner')) {
        assert.match(prompt, /Use image 0 as a reference/);
        assert.ok(reference instanceof Blob);
        const png = Buffer.from(await reference.arrayBuffer());
        assert.ok(png.readUInt32BE(16) < 512 && png.readUInt32BE(20) < 512);
      } else {
        assert.equal(reference, null);
      }
      return Response.json({ success: true, result: { image: image.toString('base64') } });
    }
    const body = JSON.parse(String(options?.body));
    if (!String(url).includes('/test-image-model:')) {
      plans++;
      assert.match(body.contents[0].parts[0].text, /The worker scans the bin/);
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(director) }] } }] });
    }
    assert.equal(body.generationConfig.imageConfig.aspectRatio, '9:16');
    const parts = body.contents[0].parts;
    const brief = parts[0].text;
    images.push(brief);
    if (brief.includes('holds a scanner')) {
      assert.equal(parts[1].inlineData.data, image.toString('base64'));
      if (failSecond) return new Response('{}', { status: 429 });
    }
    return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: image.toString('base64') } }] } }] });
  });
  await assert.rejects(prepareReelVisuals(board, timeline), /Shot 1-2: Gemini returned HTTP 429.*quota or rate limit/);
  failSecond = false;
  const [preview, exportPlan] = await Promise.all([prepareReelVisuals(board, timeline), prepareReelVisuals(board, timeline)]);
  assert.equal(preview.status, 'ready');
  assert.deepEqual(preview, exportPlan);
  assert.equal(plans, 1);
  assert.equal(images.length, 3);
  assert.equal(images.filter(brief => brief.includes('front door')).length, 1);
  const paths = preview.shots.flat().map(shot => shot.asset!);
  t.after(() => {
    for (const file of paths) fs.rmSync(path.join('media', file), { force: true });
    fs.rmSync(path.join('media', 'generated-reel-visuals', `${preview.fingerprint}.json`), { force: true });
  });
  const bundlePath = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-asset-test-'));
  t.after(() => fs.rmSync(bundlePath, { recursive: true, force: true }));
  await stageReelVisuals(bundlePath, preview.shots);
  for (const file of paths) assert.deepEqual(fs.readFileSync(path.join(bundlePath, 'public', file)), image);

  Object.assign(process.env, { REEL_IMAGE_PROVIDER: 'cloudflare', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_API_TOKEN: 'test-workers-ai-token' });
  const cloudflare = await prepareReelVisuals(board, timeline, preview);
  const workerPaths = cloudflare.shots.flat().map(shot => shot.asset!);
  t.after(() => workerPaths.forEach(file => fs.rmSync(path.join('media', file), { force: true })));
  assert.equal(plans, 1);
  assert.equal(cloudflareCalls.length, 2);
  assert.notEqual(cloudflare.fingerprint, preview.fingerprint);
  assert.notDeepEqual(workerPaths, paths);
  await prepareReelVisuals(board, timeline);
  assert.equal(cloudflareCalls.length, 2);
});

test('long visual plans resume at the failed batch and retry a brief Gemini outage', async (t) => {
  const board = storyboardFor('A worker scans the bin.', `Long warehouse reel ${randomUUID()}`);
  board.scenes = Array.from({ length: 7 }, (_, sceneIndex) => ({
    ...board.scenes[0], id: `cut-${sceneIndex}`, sceneIndex, durationTargetSec: 4,
  }));
  const timeline = buildVideoTimeline(board);
  const vars = { LLM_PROVIDER: process.env.LLM_PROVIDER, GEMINI_API_KEY: process.env.GEMINI_API_KEY, REEL_DIRECTOR_PROVIDER: process.env.REEL_DIRECTOR_PROVIDER };
  Object.assign(process.env, { LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key', REEL_DIRECTOR_PROVIDER: 'gemini' });
  t.after(() => {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const requests: number[][] = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.doesNotMatch(String(url), /test-key/);
    const prompt = JSON.parse(JSON.parse(String(options?.body)).contents[0].parts[0].text);
    const indices = prompt.scenes.map((scene: {sceneIndex: number}) => scene.sceneIndex);
    requests.push(indices);
    if (indices[0] === 5) {
      assert.equal(prompt.establishedEntities.actors.worker, 'Worker');
      assert.equal(prompt.storyContext.length, 5);
      if (requests.length === 2) {
        return Response.json({ error: { message: 'private provider detail' } }, { status: 429, headers: { 'Retry-After': '30' } });
      }
      if (requests.length <= 4) return new Response(null, { status: 503, headers: { 'Retry-After': '0' } });
    }
    const plan = { scenes: indices.map((sceneIndex: number) => ({ sceneIndex, shots: [{
      kind: 'state', cue: '', evidence: 'A worker scans the bin', headline: 'Scan the bin', transfers: [],
      actors: [{ entity: 'worker', label: 'Worker' }, { entity: 'bin', label: 'Bin', cue: 'scans the bin' }],
    }] })) };
    const json = JSON.stringify(plan);
    return Response.json({ candidates: [{ content: { parts: [
      { thought: true, text: 'Provider thought summary' }, { text: json.slice(0, 14) }, { text: json.slice(14) },
    ] } }] });
  });
  await assert.rejects(prepareReelVisuals(board, timeline), (error: Error) => {
    assert.match(error.message, /scenes 6–7.*HTTP 429.*Retry after 30 seconds/);
    assert.match(error.message, /5 validated scenes are saved.*resume at scene 6/);
    assert.doesNotMatch(error.message, /private provider detail/);
    return true;
  });
  const ready = await prepareReelVisuals(board, timeline);
  t.after(() => fs.rmSync(path.join('media', 'generated-reel-visuals', `${ready.fingerprint}.json`), { force: true }));
  assert.deepEqual(requests, [[0, 1, 2, 3, 4], [5, 6], [5, 6], [5, 6], [5, 6]]);
  assert.deepEqual(ready.shots.flat().map(shot => shot.id), ['1-1', '2-1', '3-1', '4-1', '5-1', '6-1', '7-1']);
});

test('an isolated retry reports the failed anchor and a Groq switch resumes the same plan', async (t) => {
  const board = storyboardFor('Do requests ek saath aati hain. Dono ko last seat available dikhti hai.', `Concurrent booking ${randomUUID()}`);
  board.scenes = Array.from({ length: 5 }, (_, sceneIndex) => ({
    ...board.scenes[0], id: `cut-${sceneIndex}`, sceneIndex,
  }));
  const timeline = buildVideoTimeline(board);
  const keys = ['LLM_PROVIDER', 'GEMINI_API_KEY', 'REEL_DIRECTOR_PROVIDER', 'REEL_DIRECTOR_MODEL', 'GROQ_API_KEYS', 'GROQ_MODEL'];
  const vars = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key', REEL_DIRECTOR_PROVIDER: 'gemini' });
  delete process.env.REEL_DIRECTOR_MODEL;
  t.after(() => {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const requests: number[][] = [];
  const providers: string[] = [];
  let repairPasses = false;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const body = JSON.parse(String(options?.body));
    const groq = String(url).startsWith('https://api.groq.com/');
    providers.push(groq ? 'groq' : 'gemini');
    if (!groq && body.generationConfig.responseJsonSchema.properties.updates) {
      const prompt = JSON.parse(body.contents[0].parts[0].text);
      assert.equal(prompt.narration, board.scenes[2].narration);
      requests.push([2]);
      const invalidMotion = {
        headline: 'Competing requests', actors: [{ entity: 'request-a', label: 'Request A', icon: 'service' }],
        updates: [{ entity: 'request-a', cue: '@99', value: 'Sent' }],
      };
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(invalidMotion) }] } }] });
    }
    if (groq) {
      assert.equal(body.model, 'qwen/qwen3.8-27b');
      assert.equal(body.response_format.json_schema.strict, true);
      assert.deepEqual(body.response_format.json_schema.schema.required, ['scenes']);
      assert.ok(body.response_format.json_schema.schema.properties.scenes.items.properties.shots.items.anyOf[0].required.includes('brief'));
    } else {
      assert.deepEqual(body.generationConfig.responseJsonSchema.required, ['scenes']);
    }
    const prompt = JSON.parse(groq ? body.messages[1].content : body.contents[0].parts[0].text);
    const indices: number[] = prompt.scenes.map((scene: { sceneIndex: number }) => scene.sceneIndex);
    requests.push(indices);
    const repair = Boolean(prompt.validationFeedback);
    assert.equal(prompt.scenes[0].anchors[1].text, 'Dono ko last seat available dikhti hai.');
    if (repair) assert.match(prompt.validationFeedback, /Scene 3, shot 1.*supporting phrase/);
    const plan = { scenes: indices.map((sceneIndex) => ({ sceneIndex, shots: [{
      kind: groq ? 'device' : 'state',
      scanCue: groq ? '   ' : undefined,
      evidence: sceneIndex === 2 && !repairPasses ? '@99' : '@1', headline: 'Competing requests',
      actors: [{ entity: 'request-a', label: 'Request A' }, { entity: 'request-b', label: 'Request B', cue: '@2' }],
    }] })) };
    if (groq) return Response.json({ choices: [{ message: { content: JSON.stringify(plan) } }] });
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(plan) }] } }] });
  });
  await assert.rejects(prepareReelVisuals(board, timeline), /Scene 3, shot 1 needs an exact supporting phrase.*4 validated scenes are saved.*resume at scene 3/);
  repairPasses = true;
  Object.assign(process.env, { REEL_DIRECTOR_PROVIDER: 'groq', REEL_DIRECTOR_MODEL: 'qwen/qwen3.8-27b', GROQ_API_KEYS: 'test-groq', GROQ_MODEL: 'qwen/qwen3.8-27b' });
  const ready = await prepareReelVisuals(board, timeline);
  t.after(() => fs.rmSync(path.join('media', 'generated-reel-visuals', `${ready.fingerprint}.json`), { force: true }));
  assert.deepEqual(requests, [[0, 1, 2, 3, 4], [2], [2], [2]]);
  assert.deepEqual(providers, ['gemini', 'gemini', 'gemini', 'groq']);
  assert.deepEqual(ready.shots.flat().map(shot => shot.id), ['1-1', '2-1', '3-1', '4-1', '5-1']);
  assert.equal(ready.shots[2][0].kind, 'device');
  assert.equal(ready.shots[2][0].scanFrame, undefined);
  assert.ok(ready.shots[2][0].reveals[1] > 0);
});

test('the planner drops unsupported numeric annotations without dropping timed approved values', async (t) => {
  const board = storyboardFor('The server decrements the seat count. It confirms the booking.', `Booking update ${randomUUID()}`);
  board.scenes.push({ ...board.scenes[0], id: 'other-cut', sceneIndex: 1, narration: 'After 10 seconds the lock expires.' });
  const timeline = buildVideoTimeline(board);
  const vars = { LLM_PROVIDER: process.env.LLM_PROVIDER, GEMINI_API_KEY: process.env.GEMINI_API_KEY, REEL_DIRECTOR_PROVIDER: process.env.REEL_DIRECTOR_PROVIDER };
  Object.assign(process.env, { LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key', REEL_DIRECTOR_PROVIDER: 'gemini' });
  t.after(() => {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const provider = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    assert.equal(body.generationConfig.responseJsonSchema.properties.scenes.items.properties.shots.items.properties.actors.maxItems, 4);
    const prompt = JSON.parse(body.contents[0].parts[0].text);
    assert.deepEqual(prompt.scenes.map((scene: { spokenNumbers: string[] }) => scene.spokenNumbers), [[], ['10']]);
    const plan = { scenes: [
      { sceneIndex: 0, shots: [{ kind: 'state', headline: 'Confirm the booking', evidence: '@1', takeaway: 'Only 1 seat was left', takeawayCue: '@99', actors: [
        { entity: 'seat-count', label: 'Seat Count', value: '0', cue: '@1' },
        { entity: 'booking', label: 'Booking', value: 'Confirmed', cue: '@2' },
      ] }] },
      { sceneIndex: 1, shots: [{ kind: 'state', headline: 'The lock expires', evidence: '@1', actors: [
        { entity: 'ttl', label: 'Time to live', value: '10 seconds', cue: '@1' },
        { entity: 'lock', label: 'Lock' },
      ] }] },
    ] };
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(plan) }] } }] });
  });
  const ready = await prepareReelVisuals(board, timeline);
  t.after(() => fs.rmSync(path.join('media', 'generated-reel-visuals', `${ready.fingerprint}.json`), { force: true }));
  assert.equal(provider.mock.callCount(), 1);
  const [booking, expiry] = ready.shots.map(shots => shots[0]);
  assert.equal(booking.takeaway, undefined);
  assert.equal(booking.kind, 'state');
  assert.equal(booking.actors[0].value, undefined);
  assert.equal(booking.actors[1].value, 'Confirmed');
  assert.ok(booking.reveals[1] > 0);
  assert.equal(expiry.kind, 'state');
  assert.equal(expiry.actors[0].value, '10 seconds');
});

test('an opener mislabeled as a CTA is repaired and the approved closing line bypasses the model', async (t) => {
  const title = `Warehouse relay ${randomUUID()}`;
  const opener = 'A worker scans the bin. The request reaches the warehouse server.';
  const closing = 'Aise hi engineering examples aur unke backend decisions samajhne ke liye, follow 100 Days of Engineering.';
  const draft = storyboardFor(opener, title);
  const board = StoryboardSchema.parse({
    ...draft, scenes: [...draft.scenes, {
      ...draft.scenes[0], id: 'closing', sceneIndex: 1, type: 'tradeoffHUD',
      narration: closing, visualProps: { callToAction: closing },
    }],
  });
  const timeline = buildVideoTimeline(board);
  const keys = ['LLM_PROVIDER', 'GROQ_API_KEYS', 'REEL_DIRECTOR_PROVIDER', 'REEL_DIRECTOR_MODEL', 'REEL_IMAGE_PROVIDER'];
  const vars = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, {
    LLM_PROVIDER: 'groq', GROQ_API_KEYS: 'test-key',
    REEL_DIRECTOR_PROVIDER: 'groq', REEL_DIRECTOR_MODEL: 'qwen/qwen3.8-27b', REEL_IMAGE_PROVIDER: 'gemini',
  });
  t.after(() => {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const provider = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    const variants = body.response_format.json_schema.schema.properties.scenes.items.properties.shots.items.anyOf;
    assert.ok(!variants.some((variant: { properties: { kind: { enum: string[] } } }) => variant.properties.kind.enum.includes('cta')));
    const prompt = JSON.parse(body.messages[1].content);
    assert.deepEqual(prompt.scenes.map((scene: { sceneIndex: number }) => scene.sceneIndex), [0]);
    const repair = Boolean(prompt.validationFeedback);
    if (repair) assert.match(prompt.validationFeedback, /Scene 1 needs an explanatory shot/);
    const shot = repair ? {
      kind: 'motion', headline: 'The scanned request moves', evidence: '@2',
      actors: [{ entity: 'scanner', label: 'Scanner', icon: 'phone' }, { entity: 'server', label: 'Warehouse server', icon: 'server' }],
      events: [{ kind: 'send', source: 'scanner', target: 'server', cue: '@2' }],
    } : {
      kind: 'cta', headline: 'Follow Warehouse School', evidence: '@1',
    };
    const plan = { scenes: [{ sceneIndex: 0, shots: [shot] }] };
    if (!repair) return Response.json({ error: { code: 'json_validate_failed', failed_generation: JSON.stringify(plan) } }, { status: 400 });
    return Response.json({ choices: [{ message: { content: JSON.stringify(plan) } }] });
  });
  const ready = await prepareReelVisuals(board, timeline);
  t.after(() => fs.rmSync(path.join('media', 'generated-reel-visuals', `${ready.fingerprint}.json`), { force: true }));
  assert.equal(provider.mock.callCount(), 2);
  assert.equal(ready.shots[0][0].kind, 'motion');
  assert.equal(ready.shots[1][0].kind, 'cta');
  assert.equal(ready.shots[1][0].headline, closing);
  assert.equal(board.scenes[0].narration, opener);
  assert.equal(board.scenes[1].narration, closing);
});

test('an empty code shot uses a motion-only repair while spoken commands stay intact', async (t) => {
  const opener = 'A shopper holds up their phone. The reservation appears.';
  const command = 'SELECT status FROM reservations';
  const draft = storyboardFor(opener, `Reservation walkthrough ${randomUUID()}`);
  const board = StoryboardSchema.parse({
    ...draft, scenes: [...draft.scenes, {
      ...draft.scenes[0], id: 'command', sceneIndex: 1, type: 'code',
      narration: `Run ${command} to read the result.`, visualProps: { code: command },
    }],
  });
  const timeline = buildVideoTimeline(board);
  const keys = ['LLM_PROVIDER', 'GROQ_API_KEYS', 'REEL_DIRECTOR_PROVIDER', 'REEL_DIRECTOR_MODEL', 'REEL_IMAGE_PROVIDER'];
  const vars = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, {
    LLM_PROVIDER: 'groq', GROQ_API_KEYS: 'test-key',
    REEL_DIRECTOR_PROVIDER: 'groq', REEL_DIRECTOR_MODEL: 'qwen/qwen3.8-27b', REEL_IMAGE_PROVIDER: 'gemini',
  });
  t.after(() => {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const provider = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    const schema = body.response_format.json_schema.schema;
    const prompt = JSON.parse(body.messages[1].content);
    if (schema.properties.updates) {
      assert.deepEqual(schema.required, ['headline', 'actors', 'updates']);
      assert.deepEqual(schema.properties.updates.items.properties.cue.enum, ['@1', '@2']);
      assert.equal(schema.properties.updates.items.properties.effect, undefined);
      assert.equal(prompt.narration, opener);
      assert.equal(prompt.scenes, undefined);
      const motion = {
        headline: 'The booking appears',
        actors: [{ entity: 'phone', label: 'Shopper phone', icon: 'phone' }],
        updates: [{ entity: 'phone', cue: '@2', value: 'Reservation visible', tone: 'success', effect: 'change' }],
      };
      return Response.json({ choices: [{ message: { content: JSON.stringify(motion) } }] });
    }
    const variants = schema.properties.scenes.items.properties.shots.items.anyOf;
    assert.ok(variants.some((item: { properties: { kind: { enum: string[] } } }) => item.properties.kind.enum.includes('code')));
    assert.deepEqual(prompt.scenes.map((scene: { sceneIndex: number; allowCode: boolean }) => [scene.sceneIndex, scene.allowCode]),
      [[0, false], [1, true]]);
    const scenes = [
      { sceneIndex: 0, shots: [{ kind: 'code', headline: 'The reservation', evidence: '@1', code: '  ' }] },
      { sceneIndex: 1, shots: [{ kind: 'code', headline: 'Read the status', evidence: '@1', code: command }] },
    ];
    return Response.json({ error: { code: 'json_validate_failed', failed_generation: JSON.stringify({ scenes }) } }, { status: 400 });
  });
  const ready = await prepareReelVisuals(board, timeline);
  t.after(() => fs.rmSync(path.join('media', 'generated-reel-visuals', `${ready.fingerprint}.json`), { force: true }));
  assert.equal(provider.mock.callCount(), 2);
  assert.equal(ready.shots[0][0].kind, 'motion');
  assert.ok(ready.shots[0][0].eventFrames?.[0]! > 0);
  assert.deepEqual(ready.shots[0][0].events, [{ kind: 'update', entity: 'phone', cue: '@2', value: 'Reservation visible' }]);
  const code = ready.shots[1][0];
  assert.equal(code.kind, 'code');
  assert.equal(code.code, command);
  assert.equal(board.scenes[0].narration, opener);
});

test('narration anchors keep a negative value tied to its spoken frame', () => {
  const board = storyboardFor('Both requests decrement stock. Stock falls to -1.');
  const timeline = buildVideoTimeline(board);
  timeline.segments[0].wordFrames = [0, 8, 17, 25, 100, 108, 116, 125];
  const entry = {
    kind: 'state', headline: 'Stock after the race', evidence: '@1',
    actors: [{ entity: 'requests', label: 'Requests' }, { entity: 'stock', label: 'Stock', value: '−1', cue: '@2' }],
  };
  const plan = { scenes: [{ sceneIndex: 0, shots: [entry] }] };
  assert.deepEqual(compileVisualPlan(plan, board, timeline)[0][0].reveals, [0, 100]);
  entry.actors[1].value = '1';
  assert.throws(() => compileVisualPlan(plan, board, timeline), /number absent from the approved script/);
});

test('planner annotations distinguish identifiers from quantities and time approved numeric labels', () => {
  const board = storyboardFor('The request contains seat_id_123. The fee rises to ₹90.');
  const timeline = buildVideoTimeline(board);
  timeline.segments[0].wordFrames = [0, 8, 16, 22, 80, 87, 94, 101, 111];
  const entry = {
    kind: 'state', headline: 'Check seat_id_123', evidence: '@1',
    actors: [
      { entity: 'request', label: 'Request' },
      { entity: 'fee', label: 'Fee', value: '₹90', cue: '@2' },
    ],
  };
  const plan = { scenes: [{ sceneIndex: 0, shots: [entry] }] };
  assert.equal(compileVisualPlan(plan, board, timeline)[0][0].headline, 'Check seat_id_123');
  const compile = () => compileVisualPlan(plan, board, timeline, 0, 1, { repairAnnotations: true })[0][0];
  entry.actors[0].label = 'Seat 123';
  entry.headline = 'New fee ₹90';
  entry.actors[1].cue = '@1';
  const revised = compile();
  assert.equal(revised.headline, '');
  assert.equal(revised.takeaway, 'New fee ₹90');
  assert.equal(revised.takeawayFrame, 80);
  assert.deepEqual(revised.reveals, [0, 80]);
  assert.equal(revised.kind, 'state');
  assert.equal(revised.actors[0].label, 'Seat');
  entry.headline = 'Check seat_id_456 for ₹500';
  assert.equal(compile().headline, '');
  assert.equal(compile().takeaway, undefined);
});

test('shot plans use narration timestamps and reject invented or mistimed values', () => {
  const board = storyboardFor('The fee starts at ₹30. The same route now costs ₹90.', 'A delivery quote changes');
  const timeline = buildVideoTimeline(board);
  timeline.segments[0].wordFrames = [0, 4, 8, 16, 27, 55, 59, 65, 74, 82, 105];
  const plan = { scenes: [{ sceneIndex: 0, shots: [
    { kind: 'focus', cue: '', headline: 'The starting fee', evidence: 'The fee starts at ₹30' },
    { kind: 'device', cue: 'The same route', headline: 'A new fee', evidence: 'The same route now costs ₹90', actors: [
      { entity: 'before', label: 'Before' },
      { entity: 'after', label: 'New fee', value: '₹90', cue: 'costs ₹90' },
    ] },
  ] }] };
  const shots = compileVisualPlan(plan, board, timeline)[0];
  assert.equal(shots[0].duration, 55);
  assert.equal(shots[1].from, 55);
  assert.deepEqual(shots[1].reveals, [0, 27]);
  assert.equal(shots[1].duration + shots[0].duration, timeline.totalDurationInFrames);
  const second = plan.scenes[0].shots[1];
  assert.ok(second.actors);
  second.actors[1].value = '₹900';
  assert.throws(() => compileVisualPlan(plan, board, timeline), /absent from the approved script|exact phrase containing its number/);
  second.actors[1].value = '₹90';
  second.actors[1].cue = 'The same route';
  assert.throws(() => compileVisualPlan(plan, board, timeline), /exact phrase containing its number/);
});

test('local direction stages physical actions at spoken cues and then switches to diagram animation', () => {
  const board = storyboardFor('Two friends drink tea. The vendor gives the bill. They scan QR. The speaker beeps. But how did the bank know?', 'A counter transaction');
  const timeline = buildVideoTimeline(board);
  timeline.segments[0].wordFrames = board.scenes[0].narration.split(' ').map((_, index) => index * 12);
  const [shots] = buildLocalFilmPlan(board, timeline, { '1-2': { action: 'Counter exchange', camera: 'pull-back' } });
  assert.deepEqual(shots.map(shot => shot.kind === 'film' ? shot.performance : shot.kind),
    ['drink', 'serve', 'scan', 'confirm', 'motion']);
  const bill = shots[1];
  assert.equal(bill.kind, 'film');
  assert.equal(bill.camera, 'pull-back');
  assert.deepEqual(shots.map(shot => shot.from), [0, 48, 108, 156, 180]);
  assert.ok(shots.every(shot => !shot.asset && !shot.clip));
});

test('a story can keep four distinct camera shots in time with a single approved voice take', () => {
  const board = storyboardFor('The musician opens the case. She lifts the violin. The bow touches the strings. The note rings out.', 'How a violin makes sound');
  const timeline = buildVideoTimeline(board);
  timeline.segments[0].wordFrames = board.scenes[0].narration.split(' ').map((_, index) => index * 8);
  const briefs = [
    ['Open the case', 'Wide view of the musician leaning over a dark violin case.', 'The musician opens the case.'],
    ['Lift the violin', 'Close detail of the musician reaching for the neck of the violin.', 'She lifts the violin.'],
    ['Touch the strings', 'Tight profile of the bow held near the violin strings.', 'The bow touches the strings.'],
    ['Follow the sound', 'Side view of the violin body as the musician holds the bow.', 'The note rings out.'],
  ];
  const cuts = briefs.map(([headline, brief, action], index) => ({
    kind: 'image', headline, brief, action, continuity: 'music-room',
    camera: index === 3 ? 'pull-back' : 'push-in',
    evidence: `@${index + 1}`, cue: index ? `@${index + 1}` : '',
  }));
  const [timed] = compileVisualPlan({ scenes: [{ sceneIndex: 0, shots: cuts }] }, board, timeline);
  assert.deepEqual(timed.map(shot => shot.from), [0, 40, 72, 112]);
  assert.equal(timed.reduce((total, shot) => total + shot.duration, 0), timeline.totalDurationInFrames);
  const last = timed.at(-1);
  assert.equal(last?.kind, 'image');
  assert.equal(last.camera, 'pull-back');
  assert.equal(last.action, 'The note rings out.');
});

test('long focus shots reveal the approved phrases on the existing audio timeline', () => {
  const code = 'SET seat_id_123 unique_value NX PX 10000';
  const explanation = 'NX keeps an existing lock. PX expires the lock after 10 seconds.';
  const board = storyboardFor(`${code}. ${explanation}`);
  board.scenes[0].durationTargetSec = 16;
  const timeline = buildVideoTimeline(board);
  const words = board.scenes[0].narration.split(' ');
  timeline.segments[0].wordFrames = words.map((_, index) => index * 22);
  const plan = { scenes: [{ sceneIndex: 0, shots: [
    { kind: 'code', headline: 'Acquire the lock', evidence: code, code, takeaway: 'Expires in 10 seconds', takeawayCue: 'after 10 seconds' },
    { kind: 'focus', cue: 'NX keeps', headline: 'How the lock works', evidence: 'NX keeps an existing lock', takeaway: 'Expires after 10 seconds', takeawayCue: 'after 10 seconds' },
  ] }] };
  const [command, focus] = compileVisualPlan(plan, board, timeline)[0];
  assert.equal(command.takeaway, undefined);
  assert.equal(focus.kind, 'focus');
  assert.equal(focus.from, 6 * 22);
  assert.ok(focus.duration > timeline.fps * 6);
  assert.deepEqual(focus.focus, {
    code,
    beats: [{ text: 'NX keeps an existing lock.', from: 0 }, { text: 'PX expires the lock after 10 seconds.', from: 5 * 22 }],
  });
  assert.equal(focus.takeaway, 'Expires after 10 seconds');
  assert.ok(focus.takeawayFrame > focus.focus!.beats[1].from);
  assert.equal(command.duration + focus.duration, timeline.totalDurationInFrames);
});

test('another domain can animate a grounded transfer and reject a wrong CTA', () => {
  const board = storyboardFor('A producer publishes the event. Follow Queue School for more.', 'Event delivery');
  const timeline = buildVideoTimeline(board);
  const plan = { scenes: [{ sceneIndex: 0, shots: [
    { kind: 'flow', cue: '', headline: 'Follow the event', evidence: 'A producer publishes the event', actors: [{ entity: 'producer', label: 'Producer' }, { entity: 'event', label: 'Event' }],
      transfers: [{ source: 'producer', target: 'event', cue: 'publishes the event' }] },
    { kind: 'cta', cue: 'Follow Queue School', headline: 'Follow Queue School', evidence: 'Follow Queue School for more' },
  ] }] };
  const shots = compileVisualPlan(plan, board, timeline)[0];
  assert.ok(shots[0].movements[0] > 0);
  assert.equal(shots[1].kind, 'cta');
  plan.scenes[0].shots[1].headline = 'Follow Other School';
  assert.throws(() => compileVisualPlan(plan, board, timeline), /CTA must use the approved narration/);
});

test('competing requests and the final outcome have distinct narration anchors', () => {
  const board = storyboardFor(
    'Buyer A sends a request. Buyer B sends a request. Buyer A gets the lock. After the booking commits, Buyer A is confirmed.',
    'One seat, two buyers',
  );
  const timeline = buildVideoTimeline(board);
  const plan = { scenes: [{ sceneIndex: 0, shots: [{
    kind: 'state', cue: '', headline: 'Two buyers race for the seat', evidence: 'After the booking commits, Buyer A is confirmed',
    actors: [
      { entity: 'buyer-a', label: 'Buyer A', value: 'Confirmed', cue: 'Buyer A is confirmed', tone: 'success' },
      { entity: 'buyer-b', label: 'Buyer B' },
      { entity: 'seat', label: 'Seat', value: 'Locked', cue: 'Buyer A gets the lock' },
    ],
    transfers: [
      { source: 'buyer-a', target: 'seat', cue: 'Buyer A sends a request' },
      { source: 'buyer-b', target: 'seat', cue: 'Buyer B sends a request' },
    ],
  }] }] };
  const [[shot]] = compileVisualPlan(plan, board, timeline);
  assert.ok(shot.movements[1] > shot.movements[0]);
  assert.ok(shot.reveals[2] > shot.movements[1]);
  assert.ok(shot.reveals[0] > shot.reveals[2]);
});

test('motion carries positions and state across cuts and anchors results to the approved voiceover', () => {
  const board = storyboardFor('The retry window starts. The dispatcher makes a request.', 'Warehouse relay');
  board.scenes.push({
    ...board.scenes[0], id: 'recovery', sceneIndex: 1,
    narration: 'Ten seconds pass. The retry window expires. The dispatcher requests access again.',
  });
  const timeline = buildVideoTimeline(board);
  timeline.segments[0].wordFrames = [0, 5, 15, 29, 60, 66, 77, 91, 104];
  timeline.segments[1].wordFrames = [0, 8, 15, 45, 50, 55, 74, 102, 112, 121, 132, 144];
  const gate = { entity: 'window', label: 'Retry window', icon: 'service' };
  const dispatcher = { entity: 'dispatcher', label: 'Dispatcher', icon: 'server' };
  const plan = { scenes: [
    { sceneIndex: 0, shots: [{
      kind: 'motion', headline: 'The retry window starts', evidence: '@1', actors: [gate, dispatcher],
      events: [
        { kind: 'update', entity: 'window', cue: '@1', value: 'Active', effect: 'countdown' },
        { kind: 'send', source: 'dispatcher', target: 'window', cue: '@2', outcome: 'blocked' },
      ],
    }] },
    { sceneIndex: 1, shots: [{
      kind: 'motion', headline: 'The retry opens', evidence: '@2', actors: [dispatcher, gate],
      events: [
        { kind: 'update', entity: 'window', cue: '@2', value: 'Expired', effect: 'expire' },
        { kind: 'send', source: 'dispatcher', target: 'window', cue: '@3', outcome: 'arrive' },
      ],
    }] },
  ] };
  const shots = compileVisualPlan(plan, board, timeline);
  assert.deepEqual(shots.map(([shot]) => shot.eventFrames), [[0, 60], [45, 102]]);
  const stages = buildMotionStages(shots, timeline);
  const first = stages.get('1-1')!;
  const second = stages.get('2-1')!;
  const window = second.nodes.find(node => node.entity === 'window')!;
  assert.equal(window.slot, first.nodes[0].slot);
  assert.equal(window.previous?.value, 'Active');
  assert.equal(window.previous?.until, timeline.segments[1].startFrame + 45);
  assert.equal(first.packets[0].blocked, true);
  assert.equal(second.packets.at(-1)?.blocked, false);
  assert.throws(() => compileVisualPlan({
    scenes: [plan.scenes[0], { sceneIndex: 1, shots: [{ ...plan.scenes[1].shots[0], actors: [gate, { ...dispatcher, brand: 'Invented Brand' }] }] }],
  }, board, timeline), /brand absent/);
  plan.scenes[0].shots[0].events[0].value = '15 seconds';
  assert.throws(() => compileVisualPlan(plan, board, timeline), /number absent/);
});

test('a phone scan starts on the spoken QR cue and gives way to the result', () => {
  const board = storyboardFor('The customer scans the QR. The order appears.', 'At the shop');
  const timeline = buildVideoTimeline(board);
  timeline.segments[0].wordFrames = [0, 10, 18, 26, 34, 83, 90, 102];
  const device = {
    kind: 'device', headline: 'Scan the counter code', evidence: '@1', scanCue: 'QR',
    actors: [
      { entity: 'scan', label: 'Scan', cue: '@1' },
      { entity: 'order', label: 'Order', value: 'Received', cue: '@2' },
    ],
  };
  const plan = { scenes: [{ sceneIndex: 0, shots: [device] }] };
  const [[shot]] = compileVisualPlan(plan, board, timeline);
  assert.equal(shot.scanFrame, 34);
  assert.deepEqual(shot.reveals, [0, 83]);
  for (const scanCue of ['', '  ', null, '@2', '@99']) {
    const optionalPlan = { scenes: [{ sceneIndex: 0, shots: [{ ...device, scanCue }] }] };
    const [[normalPhone]] = compileVisualPlan(optionalPlan, board, timeline);
    assert.equal(normalPhone.kind, 'device');
    assert.equal(normalPhone.scanFrame, undefined);
    assert.deepEqual(normalPhone.reveals, [0, 83]);
  }
});

test('speech preparation preserves a decimal and expands technical notation before stripping markup', () => {
  const text = 'Redis... Kafka <break time="400ms"/> SQL, H3, TTL, SETNX. O(1) in 1.5 ms!';
  const result = prepareSpeech(text, true);
  for (const term of ['रेडिस', 'काफ्का', 'एस क्यू एल', 'एच थ्री', 'टी टी एल', 'सेट एन एक्स', 'बिग ओ वन', '1.5 ms!']) assert.ok(result.includes(term));
  assert.doesNotMatch(result, /[<>]|\.\.\./);
  assert.match(prepareSpeech(text, false), /big oh one/);
  assert.match(prepareSpeech(text, false), /set en ex/);
  assert.match(prepareSpeech(text, false), /Rediss/);
  assert.match(prepareSpeech(text, false), /Kahfka/);
  assert.match(prepareSpeech(text, false), /aitch three/);
});

test('tracing topic, angle, 90-120s deep dive, and authored voice overrides with technical terms', () => {
  const topic = 'How Zomato & Uber Calculate Surge Pricing Under 50ms';
  const angle = 'H3 geospatial indexing, Redis in-memory cache, and distributed locks';
  const board = buildStoryboardFromParsed(topic, {
    remotionSceneJson: {
      meta: { title: 'Surge Pricing Architecture Under 50ms', durationSeconds: 110 },
      scenes: Array.from({ length: 14 }, (_, i) => ({
        id: `scene-${i + 1}`,
        type: i === 0 ? 'smartphoneMockup' : i === 13 ? 'summary' : 'architecturePipeline',
        narration: `Scene ${i + 1}: Redis and Kafka stream geospatial updates using H3 indexing and SETNX with O(1) time complexity.`,
        spokenNarration: i === 9 ? 'Concurrency ke liye Redis aur SETNX atomic lock use karo.' : undefined,
        onScreenText: `SURGE ARCHITECTURE STAGE ${i + 1}`,
        visualProps: i === 0
          ? { appName: 'Zomato', itemName: 'Biryani', baseDeliveryFee: '₹30', surgeDeliveryFee: '₹80', surgeReason: 'High Demand' }
          : i === 13
          ? { headline: 'System Design Recap', takeaways: ['H3 partition', 'Redis cache'] }
          : { title: `Pipeline Stage ${i + 1}`, subtitle: '50ms illustrative design budget' }
      }))
    }
  }, `TOPIC: ${topic}\nANGLE: ${angle}`, angle);

  assert.equal(board.topic, topic);
  assert.equal(board.angle, angle);
  assert.equal(board.estimatedDurationSec, 110);
  assert.equal(board.scenes.length, 14);
  assert.equal(board.scenes[9].spokenNarration, 'Concurrency ke liye Redis aur SETNX atomic lock use karo.');

  // Verify pronunciation expansion on authored override
  const expandedSpoken = prepareSpeech(board.scenes[9].spokenNarration!, true);
  assert.ok(expandedSpoken.includes('रेडिस'));
  assert.ok(expandedSpoken.includes('सेट एन एक्स'));
});

test('long provider requests preserve the unpunctuated tail and sentence order', () => {
  const input = 'Cache the response. क्या हुआ? '.repeat(160) + 'Preserve the last word';
  const chunks = speechChunks(input);
  assert.ok(chunks.every(c => c.length <= 1500));
  assert.equal(chunks.join(' '), input);
});

test('dashboard keeps one authored voice take and its typed diagram', () => {
  const narration = 'Check the same row before writing. '.repeat(7).trim();
  const board = buildStoryboardFromParsed('Concurrent buyers', {
    remotionSceneJson: {
      scenes: [{
        type: 'requestFlow', narration, spokenNarration: 'पहले स्टॉक चेक करो।', onScreenText: 'Guard the write',
        visualProps: { steps: [{ label: 'Check', description: 'Read stock' }, { label: 'Write', description: 'Return affected rows' }] },
      }]
    }
  }, '');
  assert.equal(board.scenes.length, 1);
  assert.equal(board.scenes[0].type, 'requestFlow');
  assert.equal(board.scenes[0].narration, narration);
  assert.equal(board.scenes[0].spokenNarration, 'पहले स्टॉक चेक करो।');
});

test('translated sentence starts, captions and music share the clip clock at 60 fps', () => {
  const board = StoryboardSchema.parse({
    topic: 'Cache test', title: 'Cache test', hook: 'How do quotes expire?',
    learningObjective: 'Explain when cached quotes expire.', scenes: [{
      id: 'a', sceneIndex: 0, type: 'hook',
      narration: 'SQL reads. TTL expires.', spokenNarration: 'एस क्यू एल पढ़े। टीटीएल बीते।',
      technicalKeyPoint: 'Expire quotes', onScreenText: 'Quote expiry'
    }]
  });
  const voice = ['एस', 'क्यू', 'एल', 'पढ़े।', 'टीटीएल', 'बीते।'];
  const timeline = buildVideoTimeline(board, [{
    sceneId: 'a', sceneIndex: 0, format: 'mp3', durationMs: 5000,
    fileSizeBytes: 1234, filePath: 'a.mp3', quietIntervals: [{ start: 1.5, end: 3 }],
    wordTimestamps: voice.map((word, i) => ({ word, start: [0, .2, .4, .8, 3, 4][i], end: [.2, .4, .8, 1.5, 4, 5][i] }))
  }], { fps: 60 });
  assert.equal(timeline.segments[0].wordFrames?.[2], 180);
  assert.ok(musicVolumeAtFrame(timeline, 140) > musicVolumeAtFrame(timeline, 200) * 2);
  assert.equal(musicVolumeAtFrame(timeline, timeline.totalDurationInFrames), 0);
});

test('parseTolerantJson repairs unescaped quotes inside code strings without breaking scene JSON', () => {
  const malformedJson = `{
    "meta": { "title": "Test Surge", "durationSeconds": 105 },
    "scenes": [
      {
        "id": "scene-1",
        "type": "code",
        "narration": "Scene 1: [Visual: Code screen shows mutex] Atomic lock via \`SETNX\`",
        "visualProps": {
          "code": "REDIS> SET lock:hex:88619A0A4 \\"worker_uuid_77\\" NX EX 5\\nOK"
        }
      },
      {
        "id": "scene-2",
        "type": "code",
        "narration": "Unescaped worker quote line coming next",
        "visualProps": {
          "code": "REDIS> SET lock:hex:88619A0A4 "worker_uuid_77" NX EX 5\\nOK"
        }
      }
    ]
  }`;

  // Direct JSON.parse fails on unescaped worker_uuid_77
  assert.throws(() => JSON.parse(malformedJson));

  // parseTolerantJson repairs it cleanly
  const parsed = parseTolerantJson(malformedJson);
  assert.ok(parsed);
  assert.equal(parsed.scenes.length, 2);
  assert.equal(parsed.scenes[0].type, 'code');
  assert.equal(parsed.scenes[1].type, 'code');
});

test('clean spoken text strips visual cues, markdown backticks, scene prefixes, and preserves overrides', () => {
  const rawSpoken = 'Scene 4: [Visual: 3D phone screen flips from ₹30 to ₹80] Now `Redis` executes `SETNX` in O(1)!';
  const cleanedHindi = prepareSpeech(rawSpoken, true);
  assert.doesNotMatch(cleanedHindi, /Scene \d+/i);
  assert.doesNotMatch(cleanedHindi, /\[Visual:[^\]]*\]/i);
  assert.doesNotMatch(cleanedHindi, /[`'"]/);
  assert.ok(cleanedHindi.includes('रेडिस'));
  assert.ok(cleanedHindi.includes('सेट एन एक्स'));
  assert.ok(cleanedHindi.includes('बिग ओ वन'));

  const cleanedEnglish = prepareSpeech(rawSpoken, false);
  assert.doesNotMatch(cleanedEnglish, /Scene \d+/i);
  assert.doesNotMatch(cleanedEnglish, /\[Visual:[^\]]*\]/i);
  assert.ok(cleanedEnglish.includes('Rediss'));
  assert.ok(cleanedEnglish.includes('set en ex'));
  assert.ok(cleanedEnglish.includes('big oh one'));
});

test('timeline builds cueFrames for phone price reveal and race condition lock, and sanitizes generic labels', () => {
  const storyboard = buildStoryboardFromParsed('Surge Pricing Under 50ms', {
    remotionSceneJson: {
      scenes: [
        {
          id: 'scene-1',
          type: 'smartphoneMockup',
          narration: 'Aaj delivery fee tees rupaye se seedha assi rupaye ho gayi!',
          onScreenText: '**₹30 vs ₹80?** • Dynamic Pricing',
          visualProps: {
            appName: 'ZOMATO',
            baseDeliveryFee: '₹30',
            surgeDeliveryFee: '₹80',
            surgeMultiplier: '1.8X',
          },
        },
        {
          id: 'scene-2',
          type: 'raceCondition',
          narration: 'Two workers race to acquire SETNX lock on Redis.',
          onScreenText: 'Atomic Lock Mutex',
          visualProps: {
            itemTitle: 'Concert Seat 101', // generic label from LLM
            atomicQuery: 'SET lock:hex:88619A0A4 "worker_uuid_77" NX EX 5',
          },
        },
        {
          id: 'scene-3',
          type: 'queueTimeline',
          narration: 'Distributed queue stages resolve under 50ms.',
          onScreenText: '**Queue Execution Flow**',
          visualProps: {
            items: [{ name: 'Microtasks', priority: 'high', detail: 'Event loop priority' }], // generic label from LLM
          },
        },
      ],
    },
  }, '');

  // 1. Verify markdown bold ** is stripped from onScreenText
  assert.doesNotMatch(storyboard.scenes[0].onScreenText, /\*\*/);
  assert.equal(storyboard.scenes[0].onScreenText, '₹30 vs ₹80? • Dynamic Pricing');
  assert.doesNotMatch(storyboard.scenes[2].onScreenText, /\*\*/);
  assert.equal(storyboard.scenes[2].onScreenText, 'Queue Execution Flow');

  // 2. Verify generic labels sanitized
  assert.equal(storyboard.scenes[1].visualProps.itemTitle, 'Hex #88619A0A4 Surge Mutex');
  assert.notEqual(storyboard.scenes[2].visualProps.items[0].name, 'Microtasks');
  assert.ok(storyboard.scenes[2].visualProps.items.some((it: any) => it.name.includes('H3') || it.name.includes('Redis')));

  // 3. Verify timeline wires cueFrames
  const audioClips = [
    {
      sceneId: 'scene-1',
      sceneIndex: 0,
      durationMs: 6000,
      format: 'mp3' as const,
      fileSizeBytes: 1000,
      filePath: 'scene-1.mp3',
      wordTimestamps: [
        { word: 'Aaj', start: 0, end: 0.5 },
        { word: 'delivery', start: 0.5, end: 1.0 },
        { word: 'fee', start: 1.0, end: 1.4 },
        { word: 'tees', start: 1.4, end: 1.8 },
        { word: 'rupaye', start: 1.8, end: 2.2 },
        { word: 'se', start: 2.2, end: 2.4 },
        { word: 'seedha', start: 2.4, end: 2.8 },
        { word: 'assi', start: 2.8, end: 3.4 }, // Price jump reveal spoken here at 2.8s (frame 84 @ 30fps)
        { word: 'rupaye', start: 3.4, end: 3.8 },
        { word: 'ho', start: 3.8, end: 4.1 },
        { word: 'gayi!', start: 4.1, end: 4.5 },
      ],
    },
    {
      sceneId: 'scene-2',
      sceneIndex: 1,
      durationMs: 5000,
      format: 'mp3' as const,
      fileSizeBytes: 1000,
      filePath: 'scene-2.mp3',
      wordTimestamps: [
        { word: 'Two', start: 0, end: 0.4 },
        { word: 'workers', start: 0.4, end: 0.8 },
        { word: 'race', start: 0.8, end: 1.2 },
        { word: 'to', start: 1.2, end: 1.4 },
        { word: 'acquire', start: 1.4, end: 1.9 },
        { word: 'SETNX', start: 1.9, end: 2.5 }, // Lock cue spoken here at 1.9s (frame 57 @ 30fps)
        { word: 'lock', start: 2.5, end: 3.0 },
        { word: 'on', start: 3.0, end: 3.2 },
        { word: 'Redis.', start: 3.2, end: 3.7 },
      ],
    },
    {
      sceneId: 'scene-3',
      sceneIndex: 2,
      durationMs: 4000,
      format: 'mp3' as const,
      fileSizeBytes: 1000,
      filePath: 'scene-3.mp3',
    },
  ];

  const timeline = buildVideoTimeline(storyboard, audioClips, { fps: 30 });
  const phoneSeg = timeline.segments[0];
  const lockSeg = timeline.segments[1];

  // Phone cueFrame is wired to 'assi' (2.8s * 30fps = frame 84)
  assert.ok(phoneSeg.cueFrames && phoneSeg.cueFrames.length > 0);
  assert.equal(phoneSeg.cueFrames[0], 84);

  // Lock cueFrame is wired to 'SETNX' (1.9s * 30fps = frame 57)
  assert.ok(lockSeg.cueFrames && lockSeg.cueFrames.length > 0);
  assert.equal(lockSeg.cueFrames[0], 57);
});

test('pasted plain text and creator JSON preserve every line with no added CTA', async () => {
  const hook = 'Last seat. Why? Two people booked it at the same time!';
  const tech = 'Use SET seat_id_123 unique_value NX PX 10000. Then confirm the booking.';
  const script = { title: 'The last concert seat', hook, tech_explained: tech };
  for (const input of [script, JSON.stringify(script), hook + '\n' + tech]) {
    const board = await parseCustomScriptToStoryboard(input);
    assert.equal(board.scenes.map(scene => scene.narration).join(' '), hook + ' ' + tech);
  }
  await assert.rejects(parseCustomScriptToStoryboard('{ "hook": '), /valid creator storyboard/);
  assert.equal(prepareSpeech('Behind The Tech', true), 'बिहाइंड द टेक');
  assert.equal(prepareSpeech('```redis\nSET seat_id_123 token NX PX 10000\n```', false), 'SET seat_id_123 token NX PX 10000');
});

test('TTS and timeline follow approved narration below and above the old 90-120s gate', async (t) => {
  const { synthesizeStoryboardNarration } = await import('../src/modules/tts/tts-service.js');
  const board = storyboardFor('Two people try to book the last seat at a concert.', 'Distributed locks');
  board.scenes = Array.from({ length: 12 }, (_, sceneIndex) => ({
    ...board.scenes[0],
    id: 'approved-' + sceneIndex,
    sceneIndex,
    narration: sceneIndex === 0 ? board.hook : 'Booking request ' + sceneIndex + ' uses SET seat_id_123 unique_value NX PX 10000.',
  }));
  board.scenes.forEach(Object.freeze);
  Object.freeze(board.scenes);
  Object.freeze(board);
  const approved = JSON.stringify(board);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'approved-voiceover-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  for (const seconds of [1, 11]) {
    const seed = path.join(dir, 'seed.mp3');
    const ffmpeg = spawnSync(findFfmpeg(), ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', String(seconds), seed], { encoding: 'utf8', windowsHide: true });
    if (ffmpeg.error) throw ffmpeg.error;
    assert.equal(ffmpeg.status, 0, ffmpeg.stderr);
    const texts: string[] = [];
    const provider: import('../src/modules/tts/tts-provider.js').TTSProvider = {
      name: 'mock-tts',
      async synthesizeClip(text, filePath, options) {
        texts.push(text);
        fs.copyFileSync(seed, filePath);
        return { sceneId: options!.sceneId!, sceneIndex: options!.sceneIndex!, filePath,
          durationMs: seconds * 1000, format: 'mp3', fileSizeBytes: fs.statSync(filePath).size };
      },
    };
    const audio = await synthesizeStoryboardNarration(board, dir, provider, { align: false });
    assert.deepEqual(texts, board.scenes.map(scene => prepareSpeech(scene.narration, false)));
    assert.equal(JSON.stringify(board), approved);
    assert.ok(Math.abs(audio.totalDurationSec - seconds * 12) < 0.6);
    const timeline = buildVideoTimeline(board, audio.clips);
    assert.deepEqual(timeline.segments.map(segment => segment.sceneId), board.scenes.map(scene => scene.id));
    assert.equal(timeline.segments[0].audioDurationMs, audio.clips[0].durationMs);
    const mismatched = [{ ...audio.clips[0], sceneId: 'old-scene' }, ...audio.clips.slice(1)];
    assert.throws(() => buildVideoTimeline(board, mismatched), /does not match the finalized script/);
  }
});

test('legacy rewritten narration restores the approved story and preserves the archived export', async () => {
  const { restoreLegacyNarration } = await import('../src/modules/ai-script/master-script-service.js');
  const narration = 'Two people try to book the last seat at a concert.';
  const board = storyboardFor(narration);
  const legacyScene = { ...board.scenes[0], originalNarration: narration, narration: 'Redis caching has low latency.' };
  const session: import('../src/modules/ai-script/master-script-service.js').ScriptSession = {
    id: 'old-reel', topic: board.topic, messages: [], currentMarkdown: narration, sections: {}, finalized: true,
    storyboard: { ...board, scenes: [legacyScene] }, audioResult: { clips: [] }, timeline: {}, stillPreviews: [{}],
    renderState: { status: 'completed', progress: 100, mediaUrl: '/media/old-reel.mp4' }, createdAt: 0, updatedAt: 0,
  };
  assert.equal(restoreLegacyNarration(session), true);
  assert.equal(session.storyboard.scenes[0].narration, narration);
  assert.equal(session.audioResult, undefined);
  assert.equal(session.timeline, undefined);
  assert.equal(session.stillPreviews, undefined);
  assert.equal(session.voiceoverNeedsRefresh, true);
  assert.equal(session.renderState?.mediaUrl, '/media/old-reel.mp4');
  assert.equal(restoreLegacyNarration(session), false);
});

test('QueueTimelineScene preserves authored event-loop items and applies lock animation only from semantic cue', async () => {
  // 1. Verify Event Loop topic preserves authored Microtasks/Macrotasks without injecting H3 pricing
  const eventLoopTopic = 'How Node.js Event Loop handles Microtasks vs Macrotasks';
  const eventLoopBoard = buildStoryboardFromParsed(eventLoopTopic, {
    remotionSceneJson: {
      scenes: [
        {
          id: 'sc-el-1',
          type: 'queueTimeline',
          narration: 'Microtasks drain completely before the event loop advances to the next macrotask phase.',
          onScreenText: 'Event Loop Queues',
          technicalKeyPoint: 'Microtask vs Macrotask priority execution',
          visualProps: {
            items: [
              { name: 'process.nextTick Queue', priority: 'high', detail: 'Immediate synchronous microtask' },
              { name: 'Promise.then Queue', priority: 'high', detail: 'Microtask drained before macrotasks' },
              { name: 'Timers Macrotask Queue', priority: 'medium', detail: 'setTimeout and setInterval' },
            ],
          },
        },
      ],
    },
  }, '');

  const elScene = eventLoopBoard.scenes[0];
  assert.equal(elScene.type, 'queueTimeline');
  // Must preserve authored event loop items!
  assert.equal(elScene.visualProps.items[0].name, 'process.nextTick Queue');
  assert.equal(elScene.visualProps.items[1].name, 'Promise.then Queue');
  assert.equal(elScene.visualProps.items[2].name, 'Timers Macrotask Queue');
  // Must NOT inject H3 or surge pricing into event loop topic!
  const allElText = JSON.stringify(elScene.visualProps);
  assert.doesNotMatch(allElText, /H3|Hexagon|surge:hex|surge pricing/i);

  // 2. Verify Lock topic sanitizes generic placeholder to valid SET NX EX command
  const lockTopic = 'How Zomato & Uber Calculate Surge Pricing Under 50ms';
  const lockBoard = buildStoryboardFromParsed(lockTopic, {
    remotionSceneJson: {
      scenes: [
        {
          id: 'sc-lock-1',
          type: 'queueTimeline',
          narration: 'Redis TTL auto-expiry prevents deadlocks when worker crashes.',
          onScreenText: 'Redis TTL Mutex',
          technicalKeyPoint: 'Distributed lock auto-expiry',
          visualProps: {
            items: [
              { name: 'Microtasks', priority: 'high', detail: 'Placeholder from LLM' },
            ],
          },
        },
      ],
    },
  }, '');

  const lockScene = lockBoard.scenes[0];
  // Must sanitize generic placeholder in lock topic
  assert.notEqual(lockScene.visualProps.items[0].name, 'Microtasks');
  // Must use valid Redis command syntax 'SET ... NX EX 5', NEVER invalid 'SETNX ... EX 5'
  const lockText = JSON.stringify(lockScene.visualProps);
  assert.match(lockText, /SET hex_mutex:88619A worker_A NX EX 5/i);
  assert.doesNotMatch(lockText, /SETNX\s+hex_mutex:\S+\s+\S+\s+EX\s+5/i);

  // 3. Verify Phone arithmetic consistency from actual fees
  const phoneScene = StoryboardSchema.shape.scenes.element.parse({
    id: 'sc-phone-1',
    sceneIndex: 0,
    type: 'smartphoneMockup',
    narration: 'Aaj delivery fee tees rupaye se assi rupaye ho gayi.',
    onScreenText: '₹30 vs ₹80 • Surge Pricing',
    technicalKeyPoint: 'Dynamic Surge Jump',
    visualProps: {
      itemPrice: '₹300',
      baseDeliveryFee: '₹30',
      surgeDeliveryFee: '₹80',
    },
  });

  const foodPrice = parseInt(phoneScene.visualProps.itemPrice.replace(/\D/g, ''), 10);
  const baseDelivery = parseInt(phoneScene.visualProps.baseDeliveryFee.replace(/\D/g, ''), 10);
  const surgeDelivery = parseInt(phoneScene.visualProps.surgeDeliveryFee.replace(/\D/g, ''), 10);

  const baseTotal = foodPrice + baseDelivery;
  const surgeTotal = foodPrice + surgeDelivery;

  assert.equal(baseTotal, 330, 'Base total must equal 300 + 30 = 330');
  assert.equal(surgeTotal, 380, 'Surge total must equal 300 + 80 = 380');
});

test('long authored storyboards keep every cut in order', () => {
  const scenes = Array.from({ length: 18 }, (_, i) => ({
    type: 'summary', narration: 'Preserve authored narration for scene ' + (i + 1) + '.',
    onScreenText: 'Summary ' + (i + 1),
  }));
  const board = buildStoryboardFromParsed('Warehouse Relay', { remotionSceneJson: { scenes } });
  assert.deepEqual(board.scenes.map(scene => scene.narration), scenes.map(scene => scene.narration));
});

test('Markdown narration stays authoritative when generated scene JSON changes the story', async () => {
  const unrelatedTopic = 'How Node.js Event Loop handles Microtasks vs Macrotasks';
  const unrelatedAngle = 'Call stack execution, microtask queue starvation, and setImmediate vs setTimeout macrotask phases';
  const voiceoverScript = `
Act 1: Single threaded Node.js mein V8 engine synchronous JavaScript code ko call stack par execute karta hai.
Act 2: Lekin asynchronous timers aur network I/O Libuv event loop queues ke through schedule hote hain.
Act 3: Sabse critical difference yeh hai ki microtask queue har synchronous block ke baad turant poori drain hoti hai.
Act 4: Agar hum recursive process.nextTick use karein, toh microtask starvation I/O polling ko permanently freeze kar deta hai.
Act 5: Poll phase ke turant baad setImmediate Check phase mein execute hota hai, jabki setTimeout timers phase mein.
Act 6: Architectural summary: Microtasks drain first, avoid CPU starvation, and use Worker Threads for heavy CPU computation.
`;

  const board = buildStoryboardFromParsed(unrelatedTopic, {
    voiceoverScript,
    remotionSceneJson: { scenes: [{ type: 'hook', narration: 'Generic filler about Zomato and H3.' }] },
  }, '', unrelatedAngle);
  const expected = voiceoverScript.replace(/^Act \d+: /gm, '').replace(/\s+/g, ' ').trim();
  assert.equal(board.scenes.map(scene => scene.narration).join(' '), expected);
  assert.equal(board.angle, unrelatedAngle);

  // Must NOT contain ANY hardcoded Zomato, ₹30, ₹80, Biryani, or H3 references
  const boardText = JSON.stringify(board);
  assert.doesNotMatch(boardText, /Zomato|Biryani|₹30|₹80|H3|Hexagon|88619A0A4/i, 'Unrelated topic must NOT contain Zomato or H3 surge pricing defaults!');

  // Must contain Node.js event loop concepts
  assert.match(boardText, /Microtask|Macrotask|Call Stack|Libuv/i, 'Must contain topic-grounded event loop concepts');

});

test('job ID created before generation survives script finalization', async (t) => {
  const { masterScriptService } = await import('../src/modules/ai-script/master-script-service.js');
  const testSessionId = `session_job_test_${Date.now()}`;
  const initialJobId = `job_test_uuid_${Date.now()}`;
  const diskPath = path.resolve('media/sessions', `${testSessionId}.json`);
  t.after(() => fs.rmSync(diskPath, { force: true }));

  const initialSession: any = {
    id: testSessionId,
    jobId: initialJobId,
    topic: 'How Kafka Handles Partition Rebalancing Under Network Split',
    angle: 'Consumer group protocol and cooperative sticky assignor',
    messages: [{ role: 'user', content: 'Test topic', timestamp: Date.now() }],
    currentMarkdown: '',
    sections: {},
    storyboard: { topic: 'Test', title: 'Test', hook: 'Test', learningObjective: 'Test', scenes: [] },
    finalized: false,
    renderState: { status: 'idle', progress: 0 },
    job: {
      id: initialJobId,
      status: 'running',
      stage: 'scripting',
      progress: 5,
      message: 'Initializing...',
      startedAt: Date.now(),
      updatedAt: Date.now(),
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  masterScriptService.updateSession(initialSession);

  // 1. Verify initial session has jobId
  let s = masterScriptService.getSession(testSessionId);
  assert.equal(s?.jobId, initialJobId);
  assert.equal(s?.job?.id, initialJobId);

  const approved = { title: 'Kafka rebalance', hook: 'A consumer goes offline. Why?', conclusion: 'The group redistributes its partitions.' };
  const finalized = masterScriptService.finalizeScript(testSessionId, JSON.stringify(approved));
  assert.equal(finalized.jobId, initialJobId, 'jobId must survive finalization');
  assert.equal(finalized.job?.id, initialJobId, 'job.id must survive finalization');
  assert.equal(finalized.finalized, true);
  assert.deepEqual(finalized.sevenKeyScript, approved);
  assert.deepEqual(finalized.storyboard.scenes.map(scene => scene.narration), [approved.hook, approved.conclusion]);
});
