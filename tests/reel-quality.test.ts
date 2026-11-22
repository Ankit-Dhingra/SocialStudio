import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { prepareSpeech, speechChunks } from '../src/modules/tts/speech-text.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';
import { musicVolumeAtFrame } from '../src/modules/video/StudioShortComposition.js';
import { buildStoryboardFromParsed, parseTolerantJson } from '../src/modules/ai-script/master-script-service.js';
import { StoryboardSchema } from '../src/modules/contracts/storyboard.js';
import { findFfmpeg } from '../src/modules/tts/sarvam-provider.js';
import { parseCustomScriptToStoryboard } from '../src/modules/ai-script/custom-script-parser.js';
import { compileVisualPlan } from '../src/modules/video/visual-story.js';
import { prepareReelVisuals, stageReelVisuals } from '../src/modules/render/reel-visual-assets.js';
import { randomUUID } from 'node:crypto';

function storyboardFor(narration: string, title = 'Warehouse relay'): ReturnType<typeof StoryboardSchema.parse> {
  return StoryboardSchema.parse({
    title, topic: title, hook: narration, learningObjective: 'Understand the action and its outcome.',
    scenes: [{
      id: 'hook', sceneIndex: 0, type: 'hook', narration,
      onScreenText: title, technicalKeyPoint: 'System behavior', durationTargetSec: 8,
    }],
  });
}

test('the director retries only missing artwork and preserves continuity across shots', async (t) => {
  const board = storyboardFor('The worker enters the warehouse. The worker scans the bin.', `Warehouse relay ${randomUUID()}`);
  const timeline = buildVideoTimeline(board);
  const image = fs.readFileSync('remotion/public/visuals/demo-qr.png');
  const director = { scenes: [{ sceneIndex: 0, shots: [
    { cue: '', kind: 'image', headline: 'Enter the warehouse', evidence: 'The worker enters the warehouse', brief: 'A worker enters the warehouse through its front door', continuity: 'warehouse team' },
    { cue: 'The worker scans the bin', kind: 'image', headline: 'Scan the bin', evidence: 'The worker scans the bin', brief: 'The same worker holds a scanner beside a bin', continuity: 'warehouse team' },
  ] }] };
  const envKeys = ['LLM_PROVIDER', 'GEMINI_API_KEY', 'REEL_IMAGE_GENERATION', 'REEL_IMAGE_PROVIDER', 'REEL_IMAGE_MODEL', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'];
  const state = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key', REEL_IMAGE_GENERATION: 'on', REEL_IMAGE_PROVIDER: 'gemini', REEL_IMAGE_MODEL: 'test-image-model' });
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
  const vars = { LLM_PROVIDER: process.env.LLM_PROVIDER, GEMINI_API_KEY: process.env.GEMINI_API_KEY };
  Object.assign(process.env, { LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key' });
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
      actors: [{ entity: 'worker', label: 'Worker' }, { entity: 'bin', label: 'Bin' }],
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

test('a malformed shot retries only its scene and reports the exact rejected anchor', async (t) => {
  const board = storyboardFor('Do requests ek saath aati hain. Dono ko last seat available dikhti hai.', `Concurrent booking ${randomUUID()}`);
  board.scenes = Array.from({ length: 5 }, (_, sceneIndex) => ({
    ...board.scenes[0], id: `cut-${sceneIndex}`, sceneIndex,
  }));
  const timeline = buildVideoTimeline(board);
  const vars = { LLM_PROVIDER: process.env.LLM_PROVIDER, GEMINI_API_KEY: process.env.GEMINI_API_KEY };
  Object.assign(process.env, { LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key' });
  t.after(() => {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const requests: number[][] = [];
  let repairPasses = false;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    assert.deepEqual(body.generationConfig.responseJsonSchema.required, ['scenes']);
    const prompt = JSON.parse(body.contents[0].parts[0].text);
    const indices: number[] = prompt.scenes.map((scene: { sceneIndex: number }) => scene.sceneIndex);
    requests.push(indices);
    const repair = Boolean(prompt.validationFeedback);
    assert.equal(prompt.scenes[0].anchors[1].text, 'Dono ko last seat available dikhti hai.');
    if (repair) assert.match(prompt.validationFeedback, /Scene 3, shot 1.*supporting phrase/);
    const plan = { scenes: indices.map((sceneIndex) => ({ sceneIndex, shots: [{
      kind: 'state', evidence: sceneIndex === 2 && !repairPasses ? '@99' : '@1', headline: 'Competing requests',
      actors: [{ entity: 'request-a', label: 'Request A' }, { entity: 'request-b', label: 'Request B', cue: '@2' }],
    }] })) };
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(plan) }] } }] });
  });
  await assert.rejects(prepareReelVisuals(board, timeline), /Scene 3, shot 1 needs an exact supporting phrase.*4 validated scenes are saved.*resume at scene 3/);
  repairPasses = true;
  const ready = await prepareReelVisuals(board, timeline);
  t.after(() => fs.rmSync(path.join('media', 'generated-reel-visuals', `${ready.fingerprint}.json`), { force: true }));
  assert.deepEqual(requests, [[0, 1, 2, 3, 4], [2], [2]]);
  assert.deepEqual(ready.shots.flat().map(shot => shot.id), ['1-1', '2-1', '3-1', '4-1', '5-1']);
  assert.ok(ready.shots[2][0].reveals[1] > 0);
});

test('the planner drops unsupported numeric annotations without dropping timed approved values', async (t) => {
  const board = storyboardFor('The server decrements the seat count. It confirms the booking.', `Booking update ${randomUUID()}`);
  board.scenes.push({ ...board.scenes[0], id: 'other-cut', sceneIndex: 1, narration: 'After 10 seconds the lock expires.' });
  const timeline = buildVideoTimeline(board);
  const vars = { LLM_PROVIDER: process.env.LLM_PROVIDER, GEMINI_API_KEY: process.env.GEMINI_API_KEY };
  Object.assign(process.env, { LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key' });
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
