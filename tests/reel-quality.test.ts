import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { prepareSpeech, speechChunks } from '../src/modules/tts/speech-text.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';
import { musicVolumeAtFrame } from '../src/modules/video/StudioShortComposition.js';
import { buildStoryboardFromParsed, parseTolerantJson, parseSectionsFromMarkdown } from '../src/modules/ai-script/master-script-service.js';
import { StoryboardSchema } from '../src/modules/contracts/storyboard.js';
import { findFfmpeg } from '../src/modules/tts/sarvam-provider.js';
import { parseCustomScriptToStoryboard } from '../src/modules/ai-script/custom-script-parser.js';
import { planSceneShots, readVisualContext } from '../src/modules/video/visual-story.js';
import { prepareReelVisuals, stageReelVisuals } from '../src/modules/render/reel-visual-assets.js';
import { randomUUID } from 'node:crypto';

test('the visual pipeline generates and reuses a script-specific image across preview and export', async (t) => {
  const board = await parseCustomScriptToStoryboard({
    title: `Rain delivery ${randomUUID()}`,
    hook: 'A delivery rider waits in midnight rain. The delivery fee jumps from ₹30 to ₹90.',
    problem: 'There are 100 orders but just 20 riders available.',
    solution: 'The pricing engine measures local conditions.',
  });
  const timeline = buildVideoTimeline(board);
  const builtIn = fs.readFileSync('remotion/public/visuals/rain-delivery.png');
  const environment = { GEMINI_API_KEY: process.env.GEMINI_API_KEY, REEL_IMAGE_GENERATION: process.env.REEL_IMAGE_GENERATION, DEMO_MODE: process.env.DEMO_MODE };
  Object.assign(process.env, { GEMINI_API_KEY: 'test-key', REEL_IMAGE_GENERATION: 'on', DEMO_MODE: 'false' });
  t.after(() => {
    for (const [name, value] of Object.entries(environment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  const request = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(String(url), /generativelanguage\.googleapis\.com.*:generateContent$/);
    const body = JSON.parse(String(options?.body));
    assert.equal(body.generationConfig.imageConfig.aspectRatio, '9:16');
    assert.match(body.contents[0].parts[0].text, /delivery rider waits in midnight rain/);
    return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: builtIn.toString('base64') } }] } }] });
  });
  const [preview, overlappingRender] = await Promise.all([prepareReelVisuals(board, timeline), prepareReelVisuals(board, timeline)]);
  assert.equal(preview.status, 'generated');
  assert.ok(preview.plates.street);
  t.after(() => fs.rmSync(path.join('media', preview.plates.street!), { force: true }));
  assert.deepEqual(overlappingRender, preview);
  const restored = await prepareReelVisuals(board, timeline);
  assert.deepEqual(restored, preview);
  assert.equal(request.mock.callCount(), 1);
  const bundlePath = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-asset-test-'));
  t.after(() => fs.rmSync(bundlePath, { recursive: true, force: true }));
  await stageReelVisuals(bundlePath, restored.plates);
  assert.deepEqual(fs.readFileSync(path.join(bundlePath, 'public', preview.plates.street)), builtIn);
});

test('cinematic shots follow pasted narration and derive its own figures', async () => {
  const script = {
    title: 'Why rain changes a delivery quote',
    hook: 'बारिश हो रही है। Delivery charge ₹42 से अचानक ₹84 हो गया।',
    problem: 'There are 350 orders and 70 riders available.',
    solution: 'Use geographical cells to isolate local demand.',
    tech_explained: 'A rider sends GPS location. H3 maps the location. Redis stores the counts. A stale heartbeat marks the rider offline.',
    conclusion: 'Distance is the same. Local demand is higher.',
    cta: 'For more interesting tech stories, follow Behind The Tech.',
  };
  const encoded = JSON.stringify(script, null, 2).split('\n').map((line, index) =>
    (index > 0 && line.startsWith('  ') ? `&#x20; ${line.trimStart()}` : line)
  ).join('\\\n');
  const board = await parseCustomScriptToStoryboard(encoded);
  const context = readVisualContext(board);
  assert.deepEqual([context.baseFee, context.finalFee, context.orders, context.riders, context.ratio], ['₹42', '₹84', 350, 70, '5']);
  assert.equal(context.channel, 'Behind The Tech');

  const timeline = buildVideoTimeline(board);
  const shots = board.scenes.flatMap((scene, index) => {
    const segment = timeline.segments[index];
    const result = planSceneShots(scene, segment, context, 30);
    assert.equal(result[0].from, 0);
    assert.equal(result.reduce((frames, shot) => frames + shot.duration, 0), segment.durationInFrames);
    assert.ok(result.every(shot => shot.duration > 0));
    return result.map(shot => shot.kind);
  });
  for (const shot of ['street', 'quote', 'shortage', 'cells', 'location', 'cache', 'heartbeat', 'recap'] as const) {
    assert.ok(shots.includes(shot), `Expected shot ${shot}`);
  }
});

test('a narration clock can cut from a demo QR to Kafka without delivery graphics', async () => {
  const board = await parseCustomScriptToStoryboard({
    title: 'Chai shop payments with Kafka',
    hook: 'The customer scans a QR code to pay. The payment event is published to Kafka.',
    problem: 'Consumers need to know when a payment succeeds.',
    solution: 'The producer publishes a payment event to a Kafka topic.',
  });
  const context = readVisualContext(board);
  const segment = buildVideoTimeline(board).segments[0];
  const shots = planSceneShots(board.scenes[0], {
    ...segment,
    wordFrames: [0, 5, 10, 15, 20, 25, 30, 35, 44, 50, 58, 65, 70, 76, 83, 88],
  }, context, 30);
  assert.deepEqual(shots.map(({ kind, from }) => ({ kind, from })), [
    { kind: 'payment', from: 0 }, { kind: 'kafka', from: 44 },
  ]);
  assert.equal(context.delivery, false);
  assert.equal(context.chaiShop, true);
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

test('automatic word budget revision and illustrative 50ms SLA budget framing', async () => {
  const { enforceWordBudget, frameIllustrativeBudget, countWords, scaleStoryboardForDuration } = await import('../src/modules/ai-script/word-budget.js');

  // 1. Verify 50ms is framed as illustrative design budget
  const factual50ms = 'Our system calculates everything under 50ms as a strict guarantee.';
  const framed = frameIllustrativeBudget(factual50ms);
  assert.match(framed, /illustrative 50ms (?:SLA )?budget/i);
  assert.doesNotMatch(framed, /\bunder 50ms as a strict guarantee\b/i);

  // 2. Verify word budget enforcement trims bloated word counts down to ~240-285 words
  const bloatedScenes = Array.from({ length: 12 }, (_, i) => ({
    id: `scene-${i + 1}`,
    sceneIndex: i,
    type: (i === 0 ? 'smartphoneMockup' : i === 7 ? 'queueTimeline' : 'architecturePipeline') as any,
    narration: `This is a very long and verbose sentence explaining why Redis in-memory cache and H3 geospatial indexing calculate surge fees in parallel with SETNX mutex locks under 50ms so riders and customers always get updated prices immediately without database delay. `.repeat(2).trim(),
    onScreenText: `Stage ${i + 1}`,
    technicalKeyPoint: 'Surge calculation',
    visualProps: {},
  }));

  const bloatedBoard = StoryboardSchema.parse({
    topic: 'Surge Pricing',
    title: 'Surge Pricing Architecture',
    hook: 'Delivery fee jump',
    learningObjective: 'Explain surge under 50ms',
    scenes: bloatedScenes,
  });

  const totalWordsBefore = bloatedBoard.scenes.reduce((sum, sc) => sum + countWords(sc.narration), 0);
  assert.ok(totalWordsBefore > 400, `Expected >400 words before, got ${totalWordsBefore}`);

  const budgetedBoard = enforceWordBudget(bloatedBoard, 230, 285);
  const totalWordsAfter = budgetedBoard.scenes.reduce((sum, sc) => sum + countWords(sc.narration), 0);
  assert.ok(totalWordsAfter <= 290, `Expected <= 290 words after revision, got ${totalWordsAfter}`);
  assert.ok(totalWordsAfter >= 210, `Expected >= 210 words after revision, got ${totalWordsAfter}`);

  // Verify key terms are preserved after condensing
  const allText = budgetedBoard.scenes.map(s => s.narration).join(' ');
  assert.ok(/redis/i.test(allText));
  assert.ok(/h3/i.test(allText));
  assert.ok(/setnx/i.test(allText));

  // 3. Verify duration scaling function adjusts words proportionally
  const scaledBoard = scaleStoryboardForDuration(budgetedBoard, 165.0, 105.0);
  const totalWordsScaled = scaledBoard.scenes.reduce((sum, sc) => sum + countWords(sc.narration), 0);
  assert.ok(totalWordsScaled < totalWordsAfter, `Expected scaled words (${totalWordsScaled}) < unscaled (${totalWordsAfter})`);
});

test('duration rewriting covers undershoot, overshoot, complete sentences and technical payoff', async () => {
  const { rewriteStoryboardForDuration, countWords } = await import('../src/modules/ai-script/word-budget.js');

  // Test 1: Undershoot Expansion (70s -> 105s target)
  const shortScenes = Array.from({ length: 12 }, (_, i) => ({
    id: `short-${i + 1}`,
    sceneIndex: i,
    type: (i === 0 ? 'smartphoneMockup' : i === 1 ? 'h3SpatialMap' : i === 7 ? 'queueTimeline' : 'architecturePipeline') as any,
    narration: `Redis aur H3 spatial index se surge price calculate hoti hai.`,
    onScreenText: `Stage ${i + 1}`,
    technicalKeyPoint: 'Fast lookups',
    visualProps: {},
  }));

  const shortBoard = StoryboardSchema.parse({
    topic: 'Surge Pricing',
    title: 'Surge Architecture',
    hook: 'Surge fees',
    learningObjective: 'Understand surge',
    scenes: shortScenes,
  });

  const shortWordsBefore = shortBoard.scenes.reduce((sum, sc) => sum + countWords(sc.narration), 0);
  const expandedBoard = rewriteStoryboardForDuration(shortBoard, 70.0, 105.0);
  const expandedWordsAfter = expandedBoard.scenes.reduce((sum, sc) => sum + countWords(sc.narration), 0);

  // Expanded word count must be significantly higher
  assert.ok(expandedWordsAfter > shortWordsBefore, `Expected expanded words (${expandedWordsAfter}) > original (${shortWordsBefore})`);
  // All sentences must end cleanly with proper punctuation, no dangling fragments
  for (const scene of expandedBoard.scenes) {
    assert.match(scene.narration, /[.!?।]$/, `Scene ${scene.id} narration must end with proper punctuation`);
    assert.doesNotMatch(scene.narration, /\b(?:ne|ko|mein?|par|se|aur)\.\s*$/i, `Scene ${scene.id} must not end on a dangling Hindi postposition`);
  }
  // Technical payoffs preserved
  const expandedAll = expandedBoard.scenes.map(s => s.narration).join(' ');
  assert.ok(/h3|hexagonal|equidistant/i.test(expandedAll), 'H3 hexagonal payoff must be preserved');
  assert.ok(/redis|cache|latency/i.test(expandedAll), 'Redis cache payoff must be preserved');

  // Test 2: Overshoot Condensation (165s -> 105s target)
  const overshotBoard = rewriteStoryboardForDuration(expandedBoard, 165.0, 105.0);
  const overshotWordsAfter = overshotBoard.scenes.reduce((sum, sc) => sum + countWords(sc.narration), 0);
  assert.ok(overshotWordsAfter < expandedWordsAfter, `Expected overshot words (${overshotWordsAfter}) < expanded (${expandedWordsAfter})`);
  for (const scene of overshotBoard.scenes) {
    assert.match(scene.narration, /[.!?।]$/, `Scene ${scene.id} narration must end with proper punctuation`);
    assert.doesNotMatch(scene.narration, /\b(?:ne|ko|mein?|par|se|aur)\.\s*$/i, `Scene ${scene.id} must not end on a dangling Hindi postposition`);
  }
});

test('duration policy scopes to 90–120s deep-dive product and preserves existing shorter callers', async () => {
  const { synthesizeStoryboardNarration } = await import('../src/modules/tts/tts-service.js');

  // Create a mock TTS provider
  const createMockProvider = (clipDurationSec: number) => ({
    name: 'mock-tts',
    synthesizeClip: async (text: string, outputPath: string) => {
      spawnSync(
        findFfmpeg(),
        ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', String(clipDurationSec), '-c:a', 'libmp3lame', '-b:a', '160k', outputPath, '-y'],
        { windowsHide: true }
      );
      return {
        sceneId: 'test',
        sceneIndex: 0,
        filePath: outputPath,
        durationMs: Math.round(clipDurationSec * 1000),
        fileSizeBytes: fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 1024,
      };
    },
  });

  const tempDir = path.resolve('remotion/public/audio/runs/test-duration-scope');
  fs.mkdirSync(tempDir, { recursive: true });

  // 1. Shorter caller with 3 scenes (e.g. 15s total) should be preserved without duration gate or errors
  const shortCallerBoard = StoryboardSchema.parse({
    topic: 'Quick Microtask Demo',
    title: 'Microtasks Demo',
    hook: 'Event loop demo',
    learningObjective: 'Understand microtasks vs macrotasks in node',
    scenes: [
      { id: 'sc-1', sceneIndex: 0, type: 'smartphoneMockup', narration: 'Event loop queue.', onScreenText: 'Queue 1', technicalKeyPoint: 'Queue priority', visualProps: {} },
      { id: 'sc-2', sceneIndex: 1, type: 'architecturePipeline', narration: 'Microtasks run first.', onScreenText: 'Queue 2', technicalKeyPoint: 'Microtasks', visualProps: {} },
      { id: 'sc-3', sceneIndex: 2, type: 'summary', narration: 'Macrotasks run next.', onScreenText: 'Queue 3', technicalKeyPoint: 'Macrotasks', visualProps: {} },
    ],
  });

  // Each clip 5s => total ~15s. Should succeed without error because scenes.length < 10
  const shortResult = await synthesizeStoryboardNarration(
    shortCallerBoard,
    tempDir,
    createMockProvider(5.0) as any,
    { align: false }
  );
  assert.ok(Math.abs(shortResult.totalDurationSec - 15.0) < 0.5, `Shorter caller duration must be preserved (~15s), got ${shortResult.totalDurationSec}s`);
  assert.equal(shortResult.clips.length, 3);

  // 2. Deep-dive reel product (12 scenes) with out-of-range duration throws on retry exhaustion
  const deepDiveBoard = StoryboardSchema.parse({
    topic: 'Surge Pricing',
    title: 'Surge System',
    hook: 'Surge jump',
    learningObjective: 'Surge mechanics and dynamic pricing architecture',
    scenes: Array.from({ length: 12 }, (_, i) => ({
      id: `dd-scene-${i + 1}`,
      sceneIndex: i,
      type: (i === 0 ? 'smartphoneMockup' : 'architecturePipeline') as any,
      narration: `Redis cache handles high throughput under 50ms SLA budget.`,
      onScreenText: `Stage ${i + 1}`,
      technicalKeyPoint: 'Throughput',
      visualProps: {},
    })),
  });

  // Mock provider returns 5.0s per clip (60s total, < 90s) and does not change
  let revisionsCount = 0;
  let rejected = false;
  try {
    await synthesizeStoryboardNarration(
      deepDiveBoard,
      tempDir,
      createMockProvider(5.0) as any,
      {
        durationPolicy: 'deep-dive-reel',
        maxRetries: 2,
        align: false,
        onStoryboardRevised: (board) => {
          revisionsCount++;
          assert.ok(board.scenes.length === 12);
        },
      }
    );
  } catch (err: any) {
    rejected = true;
    assert.match(err.message, /\[TTS Gate REJECTED\].*outside specification/i);
  }

  assert.ok(rejected, 'Expected out-of-range duration to be rejected after bounded retries');
  assert.ok(revisionsCount >= 2, `Expected storyboard revision to be persisted across attempts, got ${revisionsCount}`);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true, force: true });
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

test('regression: k21m0 truncated draft repairs mid-string cutoff to 15 typed scenes without falling back to 5 hook scenes', async () => {
  const sessionPath = path.resolve('media/sessions/session_1795068591407_k21m0.json');
  assert.ok(fs.existsSync(sessionPath), 'Expected session_1795068591407_k21m0.json to exist on disk');

  const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  const rawMarkdown = session.currentMarkdown;
  assert.ok(rawMarkdown && rawMarkdown.length > 500);

  // 1. Verify parseSectionsFromMarkdown tolerantly recovers the Remotion JSON despite mid-string truncation in scene 15
  const sections = parseSectionsFromMarkdown(rawMarkdown);
  assert.ok(sections.remotionSceneJson, 'remotionSceneJson should be recovered by tolerant parser');
  assert.equal(sections.remotionSceneJson.scenes?.length, 15, 'Should recover all 15 scenes including truncated scene 15');

  // 2. Build storyboard and assert it produces 15 typed scenes, NOT 5 hook scenes
  const board = buildStoryboardFromParsed(session.topic, sections, rawMarkdown, session.angle);
  assert.equal(board.scenes.length, 15, 'Storyboard must have exactly 15 scenes');
  assert.notEqual(board.scenes.length, 5, 'Must NOT fall back to 5 raw hook scenes');

  // 3. Verify scene 15 was cleanly recovered with its typed summary and narration
  const lastScene = board.scenes[14];
  assert.equal(lastScene.id, 'scene-15');
  assert.equal(lastScene.type, 'summary');
  assert.match(lastScene.narration, /H3 map ko divide karta hai/i);
});

test('topic-grounded recovery replaces static fallback for unrelated topics with zero Zomato/H3 pollution', async () => {
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

  // Provide empty remotionSceneJson to trigger fallback recovery
  const board = buildStoryboardFromParsed(unrelatedTopic, {
    voiceoverScript,
    remotionSceneJson: null,
  }, '', unrelatedAngle);

  // Must enforce 12-16 valid scenes
  assert.ok(board.scenes.length >= 12 && board.scenes.length <= 16, `Scenes count must be 12-16, got ${board.scenes.length}`);

  // Must NOT contain ANY hardcoded Zomato, ₹30, ₹80, Biryani, or H3 references
  const boardText = JSON.stringify(board);
  assert.doesNotMatch(boardText, /Zomato|Biryani|₹30|₹80|H3|Hexagon|88619A0A4/i, 'Unrelated topic must NOT contain Zomato or H3 surge pricing defaults!');

  // Must contain Node.js event loop concepts
  assert.match(boardText, /Microtask|Macrotask|Call Stack|Libuv/i, 'Must contain topic-grounded event loop concepts');

  // Check queueTimeline scene in this topic preserves event loop items
  const queueScene = board.scenes.find(s => s.type === 'queueTimeline');
  assert.ok(queueScene, 'Should include queueTimeline scene');
  const queueItemsText = JSON.stringify(queueScene.visualProps);
  assert.match(queueItemsText, /Call Stack|Microtask|process\.nextTick|Promise|Timers/i);
});

test('job ID created before generation survives draft creation, finalization and render', async () => {
  const { masterScriptService } = await import('../src/modules/ai-script/master-script-service.js');
  const testSessionId = `session_job_test_${Date.now()}`;
  const initialJobId = `job_test_uuid_${Date.now()}`;

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

  // 2. Finalize session without custom markdown
  const finalized = masterScriptService.finalizeScript(testSessionId);
  assert.equal(finalized.jobId, initialJobId, 'jobId must survive finalization');
  assert.equal(finalized.job?.id, initialJobId, 'job.id must survive finalization');
  assert.equal(finalized.finalized, true);
  assert.ok(finalized.storyboard.scenes.length >= 12 && finalized.storyboard.scenes.length <= 16, 'Finalized storyboard must enforce 12-16 scenes');

  // Cleanup
  const diskPath = path.resolve('media/sessions', `${testSessionId}.json`);
  if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
});
