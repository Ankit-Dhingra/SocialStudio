import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import test from 'node:test';
import { exampleComposition, visualSourcePack } from '../src/modules/render/visual-source-pack.js';
import { loadVisualDirectorReference, visualDirectorFiles } from '../src/modules/render/visual-director-reference.js';

const audit = process.env.REEL_MANUAL_AUDIT_SESSION;
const exportMedia = process.env.REEL_MANUAL_RENDER_TEST === '1';
const output = path.resolve(process.env.REEL_MANUAL_AUDIT_OUTPUT ||
  (exportMedia ? 'output/manual-visual-import' : 'output/manual-visual-validation'));
const hash = (data: unknown) => createHash('sha256').update(JSON.stringify(data)).digest('hex');

test('the source pack exports the runtime schema and a compiled example', async () => {
  const files = await visualSourcePack();
  const schema = JSON.parse(files.get('SCENE_SCHEMA.json')!.toString());
  const contract = JSON.parse(files.get('CONTRACT_VERSION.json')!.toString());
  const example = JSON.parse(files.get('VALID_EXAMPLE.json')!.toString());
  assert.equal(hash(schema), contract.schemaHash);
  assert.equal(example.directive.schemaHash, contract.schemaHash);
  assert.equal(example.directive.version, contract.version);
  assert(files.get('GOLDEN_REFERENCE.png')!.length > 0);
  for (const name of visualDirectorFiles) {
    assert.deepEqual(files.get(name), await readFile(path.resolve('visual-director', name)), name);
  }
  const reference = await loadVisualDirectorReference();
  assert.equal(contract.artDirectionRevision, reference.revision);
  assert.match(reference.compact, /Technical scenes:/);
  assert.match(reference.compact, /Progressive reveals, smooth camera focus/);
});

test('manual visual API validates, authorizes and preserves a pinned production revision', { skip: !audit }, async () => {
  await mkdir(output, { recursive: true });
  const ledger = { sarvam: 0, whisper: 0, groqVisual: 0, artwork: 0, other: 0 };
  const nativeFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  process.env.NODE_ENV = 'test';
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  process.env.REEL_IMAGE_GENERATION = 'off';
  process.env.REMOTION_PRODUCTION_RENDER = 'false';
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEYS;
  globalThis.fetch = async input => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname.endsWith('sarvam.ai')) ledger.sarvam++;
    else if (url.hostname === 'api.groq.com' && url.pathname.includes('/audio/')) ledger.whisper++;
    else if (url.hostname === 'api.groq.com') ledger.groqVisual++;
    else if (url.hostname === 'api.cloudflare.com' || url.hostname === 'generativelanguage.googleapis.com') ledger.artwork++;
    else ledger.other++;
    throw new Error('External requests are disabled in the manual import audit.');
  };
  const { app } = await import('../src/api.js');
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEYS;
  const { masterScriptService } = await import('../src/modules/ai-script/master-script-service.js');
  const { connection } = await import('../src/core.js');
  const { buildVisualCues } = await import('../src/modules/render/visual-cues.js');
  const saved = masterScriptService.getSession(audit!);
  assert(saved?.timeline?.segments?.length > 1 && saved.audioResult?.clips?.length, `Missing audit artifacts for ${audit}.`);
  const snapshot = async (session: typeof saved) => ({ state: hash([session.storyboard, session.audioResult, session.timeline]),
    media: await Promise.all(session.timeline.segments.map(async (segment: { audioSrc: string }) =>
      createHash('sha256').update(await readFile(path.join('remotion/public', segment.audioSrc))).digest('hex'))) });
  const originalInput = await snapshot(saved);
  const id = `session_${randomUUID()}`;
  const source = { ...structuredClone(saved), id, ownerDigest: undefined, renderState: { status: 'idle' as const, progress: 0 }, job: undefined };
  source.sevenKeyScript = { ...source.sevenKeyScript, title: 'Membership Probe' };
  masterScriptService.updateSession(source);
  const owner = randomBytes(32).toString('hex');
  const second = randomBytes(32).toString('hex');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const endpoint = `/api/pipeline/manual-visual/${id}`;
  const request = async (route: string, body?: unknown, token = owner) => {
    const text = typeof body === 'string';
    const response = await nativeFetch(base + route, { method: body === undefined ? 'GET' : 'POST',
      headers: { 'X-SocialStudio-Owner': token, ...(body === undefined ? {} : { 'Content-Type': text ? 'text/plain' : 'application/json' }) },
      body: body === undefined ? undefined : text ? body : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const errors: Record<string, unknown> = {};
  const expectError = async (name: string, input: string, status: number, hint: RegExp, action = 'validate') => {
    const result = await request(`${endpoint}/${action}`, input);
    assert.equal(result.status, status, `${name}: ${JSON.stringify(result.body)}`);
    assert.match(result.body.error, hint);
    errors[name] = result.body;
  };
  const verify = async (route: string, predicate: (body: any) => boolean, timeoutMs = 330_000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const response = await request(route);
      assert.equal(response.status, 200);
      assert.notEqual(response.body.job?.status, 'failed', JSON.stringify(response.body));
      assert.notEqual(response.body.renderState?.status, 'failed', JSON.stringify(response.body));
      if (predicate(response.body)) return response.body;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    throw new Error(`Render did not finish within ${timeoutMs / 1000} seconds: ${route}`);
  };
  try {
    const context = await request(`${endpoint}/context`);
    assert.equal(context.status, 200, JSON.stringify(context.body).slice(0, 1000));
    const artDirection = await loadVisualDirectorReference();
    assert.equal(context.body.artDirection.revision, artDirection.revision);
    for (const text of [artDirection.master, artDirection.design, artDirection.motion, artDirection.brandInstruction]) {
      assert(context.body.prompt.includes(text));
    }
    assert.equal(context.body.job.brand.name, 'Behind The Tech');
    assert.deepEqual(context.body.job.brand, { name: 'Behind The Tech' });
    assert.doesNotMatch(context.body.artDirection.brand, /Behind the Stack|@behindthetech/i);
    assert.match(context.body.prompt, /one fenced json code block/);
    assert.equal(context.body.job.title, 'Membership Probe');
    assert.equal(context.body.job.storyboardTitle, source.storyboard.title);
    assert.match(context.body.prompt, /job\.title, job\.storyboardTitle, the project brand, or the narration/);
    assert.deepEqual(context.body.job.scenes.map((scene: any) => scene.cues), buildVisualCues(source.storyboard, source.timeline));
    assert.deepEqual(context.body.job.scenes[0].whisper[0], [source.audioResult.clips[0].wordTimestamps[0].word,
      source.audioResult.clips[0].wordTimestamps[0].start, source.audioResult.clips[0].wordTimestamps[0].end]);
    assert(!context.body.prompt.includes(source.timeline.segments[0].audioSrc));
    assert(!context.body.prompt.includes(owner));
    await writeFile(path.join(output, 'visual-prompt.md'), context.body.prompt);
    await writeFile(path.join(output, 'visual-context.json'), JSON.stringify({ job: context.body.job, specification: context.body.specification,
      artDirection: context.body.artDirection }, null, 2));
    assert.equal((await request(`${endpoint}/context`, undefined, second)).status, 404);
    assert.equal((await request(`/api/pipeline/script/${id}`, undefined, second)).status, 404);
    assert.equal((await request('/api/pipeline/render', { sessionId: id }, second)).status, 404);
    assert.equal((await nativeFetch(base + `/media/sessions/${id}.json`)).status, 404);
    const { job, specification } = context.body;
    const catalog = specification.assets.find((item: { id: string }) => item.id === 'brand-redis') ?? specification.assets[0];
    assert(catalog, 'No approved local visuals found for the importer asset test.');
    const sequences = [];
    for (let from = 0; from < job.scenes.length; from += 4) {
      const through = Math.min(from + 3, job.scenes.length - 1);
      const cue = job.scenes[from].cues[1]?.id || job.scenes[from].cues[0].id;
      const composition = exampleComposition('Input', cue);
      if (!from) {
        composition.layers.push({ id: 'approved-asset', parent: null, at: null, fill: 'none', stroke: 'none',
          shape: { kind: 'asset', assetId: 'catalog-image', box: [268, 542, 344, 175], fit: 'contain' } });
        composition.camera = { cue, center: [450, 370], zoom: 1.05, seconds: 0.7 };
      }
      sequences.push({ kind: 'vector', from, through, composition,
        assets: from ? {} : { 'catalog-image': { kind: 'approved', id: catalog.id } } });
    }
    const fixture = { version: specification.version, schemaHash: specification.schemaHash, inputRevision: job.inputRevision, sequences };
    const raw = JSON.stringify(fixture, null, 2);
    await writeFile(path.join(output, 'manual-directive.fixture.json'), raw);
    const alter = (edit: (copy: any) => void) => { const copy = structuredClone(fixture); edit(copy); return JSON.stringify(copy); };
    await expectError('malformed', '{', 422, /Invalid JSON/);
    await expectError('multiple fenced objects', ['```json', raw, '```', '```json', raw, '```'].join('\n'), 422, /Invalid JSON/);
    await expectError('duplicate key', raw.replace('{', '{"version":"discarded",'), 422, /Duplicate or reserved/);
    await expectError('unsafe markup', alter(copy => copy.sequences[0].composition.layers[0].label = '<script>Input</script>'), 422, /markup/i);
    const subjectError = await request(`${endpoint}/validate`, alter(copy => copy.sequences[0].composition.subject = 'Imaginary Rainbow'));
    assert.equal(subjectError.status, 422);
    assert.deepEqual(subjectError.body.issues[0].scenes, job.scenes.slice(0, 4).map((scene: { sceneIndex: number }) => scene.sceneIndex));
    assert.equal(subjectError.body.issues[0].path, '$.sequences.0.composition.subject');
    assert.match(subjectError.body.issues[0].message, /imaginary, rainbow/);
    assert.match(subjectError.body.issues[0].resolution, /Membership Probe/);
    const titleSubject = await request(`${endpoint}/validate`, alter(copy => copy.sequences[0].composition.subject = job.title));
    assert.equal(titleSubject.status, 200, JSON.stringify(titleSubject.body));
    const firstText = (copy: typeof fixture) => copy.sequences[0].composition.layers.map(layer => layer.shape).find(shape => shape.kind === 'text')!;
    const label = await request(`${endpoint}/validate`, alter(copy => firstText(copy).text = 'Mon • 10:00 AM'));
    assert.equal(label.status, 200, JSON.stringify(label.body));
    await expectError('Devanagari label', alter(copy => firstText(copy).text = 'समय'), 422, /Vector labels/);
    const overlap = await request(`${endpoint}/validate`, alter(copy => {
      const composition = copy.sequences[0].composition;
      const heading = composition.layers.find(layer => layer.id === 'heading');
      composition.layers.push({ ...heading, id: 'overlap-label', shape: { ...heading.shape, text: 'Input data' } });
    }));
    assert.equal(overlap.status, 200, JSON.stringify(overlap.body));
    assert.match(overlap.body.layoutWarnings[0].message, /heading.*overlap-label/);
    assert.match(overlap.body.layoutWarnings[0].path, /composition\.layers\.\d+\.shape\.point$/);
    const textLayer = fixture.sequences[0].composition.layers.find(layer => layer.shape.kind === 'text')!;
    const badFocal = await request(`${endpoint}/validate`, alter(copy => copy.sequences[0].composition.focal = [textLayer.id, 'missing']));
    assert.equal(badFocal.status, 422);
    assert.deepEqual(badFocal.body.issues.map((issue: { path: string; message: string }) => [issue.path, issue.message]), [
      ['$.sequences.0.composition.focal.0', `Focal ID "${textLayer.id}" points to a text label.`],
      ['$.sequences.0.composition.focal.1', 'Focal ID "missing" does not match a layer ID.'],
    ]);
    const autoRepair = await request(`${endpoint}/validate`, alter(copy => {
      const focal = copy.sequences[0].composition.focal;
      focal.splice(1, 0, textLayer.id);
      focal.push('missing', focal[0]);
    }));
    assert.equal(autoRepair.status, 200, JSON.stringify(autoRepair.body));
    assert.deepEqual(autoRepair.body.focalRepairs, [{ sequence: 0, removed: [textLayer.id, 'missing', fixture.sequences[0].composition.focal![0]] }]);
    await expectError('unknown operation', alter(copy => copy.sequences[0].composition.tracks.push({ kind: 'eval' })), 422, /Invalid input|expected/i);
    await expectError('stale schema', alter(copy => copy.schemaHash = '0'.repeat(64)), 409, /stale/i);
    await expectError('invalid cue', alter(copy => copy.sequences[0].composition.connectors[0].cue = 's987c9'), 422, /cue/i);
    const badPort = await request(`${endpoint}/validate`, alter(copy => copy.sequences[0].composition.connectors[0].to.target = 'missing'));
    assert.equal(badPort.status, 422);
    assert.equal(badPort.body.issues[0].path, '$.sequences.0.composition.connectors.0.to.target');
    assert.match(badPort.body.error, /transfer.*missing/);
    const repairedPort = await request(`${endpoint}/validate`, alter(copy => {
      const composition = copy.sequences[0].composition;
      composition.layers.push({ ...textLayer, id: 'inside-input', shape: { ...firstText(copy), point: [140, 385] } });
      composition.connectors[0].from.target = 'inside-input';
    }));
    assert.equal(repairedPort.status, 200, JSON.stringify(repairedPort.body));
    assert.deepEqual(repairedPort.body.connectorRepairs, [{ sequence: 0, connector: 'transfer', from: 'input', to: 'output' }]);
    const recoveredLayout = await request(`${endpoint}/validate`, alter(copy => {
      const composition = copy.sequences[0].composition;
      const heading = firstText(copy);
      heading.point = [830, 214];
      composition.layers.push({ ...textLayer, id: 'under-input', shape: { ...heading, point: [160, 520] } });
      const connector = composition.connectors[0];
      connector.from = { target: 'under-input', side: 'bottom' };
      connector.via = [[420, 500]];
    }));
    assert.equal(recoveredLayout.status, 200, JSON.stringify(recoveredLayout.body));
    assert.deepEqual(recoveredLayout.body.connectorRepairs, [{ sequence: 0, connector: 'transfer', from: 'input', to: 'output' }]);
    if (sequences.length > 1) {
      const simultaneousErrors = await request(`${endpoint}/validate`, alter(copy => {
        copy.sequences[0].composition.subject = 'Imaginary Rainbow';
        copy.sequences[1].composition.connectors[0].to.target = 'missing';
      }));
      assert.equal(simultaneousErrors.status, 422);
      assert.deepEqual(simultaneousErrors.body.issues.map((issue: { path: string }) => issue.path), [
        '$.sequences.0.composition.subject', '$.sequences.1.composition.connectors.0.to.target',
      ]);
    }
    await expectError('unsafe asset', alter(copy => copy.sequences[0].assets['catalog-image'].id = 'https://untrusted.invalid/a.svg'), 422, /invalid/i);
    await expectError('missing scenes', alter(copy => copy.sequences.pop()), 422, /coverage/i);
    await expectError('revision mismatch', alter(copy => copy.inputRevision = '0'.repeat(64)), 409, /revision/i);
    assert.equal((await request(`${endpoint}/validate`, raw, second)).status, 404);
    assert.equal((await request(`${endpoint}/generate`, raw, second)).status, 404);
    const validated = await request(`${endpoint}/validate`, '```json\n' + raw + '\n```');
    assert.deepEqual([validated.status, validated.body.strippedFence], [200, true], JSON.stringify(validated.body));
    assert.equal(masterScriptService.getSession(id)?.visualAssets?.fingerprint, source.visualAssets?.fingerprint);
    if (exportMedia) {
      const generation = await request(`${endpoint}/generate`, raw);
      assert.equal(generation.status, 200, JSON.stringify(generation.body).slice(0, 1500));
      const fingerprint = generation.body.visuals.fingerprint;
      const accepted = masterScriptService.getSession(id)!.visualAssets!;
      assert.equal(accepted.source, 'manual');
      assert(accepted.manualImport?.assets[0]?.source?.startsWith('catalog:'));
      assert.deepEqual(accepted.shots[0][0].vector?.layers[1].shape, fixture.sequences[0].composition.layers[1].shape);
      assert.equal(accepted.shots[1][0].vector?.sequenceStart, 0);
      assert.equal(accepted.shots[1][0].vector?.camera?.zoom, 1.05);
      await writeFile(path.join(output, 'accepted-visuals.json'), JSON.stringify(accepted, null, 2));
      const stillFolder = path.join(output, 'frames');
      await mkdir(stillFolder, { recursive: true });
      for (const frame of generation.body.stills) await copyFile(frame.filePath, path.join(stillFolder, path.basename(frame.filePath)));
      await expectError('invalid replacement', '{', 422, /Invalid JSON/, 'generate');
      assert.equal(masterScriptService.getSession(id)?.visualAssets?.fingerprint, fingerprint);
      assert.equal((await request('/api/pipeline/stills', { sessionId: id })).status, 409);
      assert.equal((await request('/api/pipeline/motion-preview', { sessionId: id, sceneIndex: 0 })).status, 409);
      assert.equal((await request('/api/pipeline/motion-preview', { sessionId: id, sceneIndex: 0, scope: 'scene', visualRevision: fingerprint })).status, 202);
      const motion = await verify(`/api/pipeline/motion-preview/${id}`, body => body.preview?.visualRevision === fingerprint);
      await copyFile(path.resolve(motion.preview.mediaUrl.slice(1)), path.join(output, 'motion-preview.mp4'));
      assert.equal((await request('/api/pipeline/render', { sessionId: id, visualRevision: 'stale' })).status, 409);
      assert.equal((await request('/api/pipeline/render', { sessionId: id, visualRevision: fingerprint })).status, 200);
      const final = await verify(`/api/pipeline/render/status/${id}`, body => body.renderState?.status === 'completed', 20 * 60_000);
      assert(final.renderState.qa.passed);
      assert.equal(masterScriptService.getSession(id)?.visualAssets?.fingerprint, fingerprint);
      await copyFile(path.resolve(final.renderState.mediaUrl.slice(1)), path.join(output, 'manual-final.mp4'));
      await writeFile(path.join(output, 'render-verification.json'), JSON.stringify({ fingerprint, motion: motion.preview, final: final.renderState }, null, 2));
    }
    await writeFile(path.join(output, 'validation-errors.json'), JSON.stringify(errors, null, 2));
    assert.deepEqual(await snapshot(saved), originalInput);
    assert.deepEqual(await snapshot(masterScriptService.getSession(id)!), originalInput);
    await writeFile(path.join(output, 'reuse-verification.json'), JSON.stringify({ unchanged: true, ...originalInput }, null, 2));
    assert.deepEqual(ledger, { sarvam: 0, whisper: 0, groqVisual: 0, artwork: 0, other: 0 });
  } finally {
    await writeFile(path.join(output, 'provider-calls.json'), JSON.stringify(ledger, null, 2));
    masterScriptService.deleteSession(id);
    await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
    connection.disconnect();
    globalThis.fetch = nativeFetch;
    process.env = originalEnv;
  }
});

test('automatic Groq semantic planning still reaches the shared compiler with mocked transport', { skip: !audit || exportMedia }, async () => {
  const { masterScriptService } = await import('../src/modules/ai-script/master-script-service.js');
  const { planSemanticVisuals } = await import('../src/modules/render/semantic-visual-planner.js');
  const session = masterScriptService.getSession(audit!);
  assert(session?.timeline);
  const originalEnv = { ...process.env };
  const nativeFetch = globalThis.fetch;
  let calls = 0;
  const artDirection = await loadVisualDirectorReference();
  try {
    process.env.REEL_CREATIVE_DIRECTOR_PROVIDER = 'groq';
    process.env.REEL_SCENE_ENGINEER_PROVIDER = 'groq';
    process.env.GROQ_API_KEYS = 'mock-only-visual';
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), 'https://api.groq.com/openai/v1/chat/completions');
      calls++;
      const prompt = JSON.parse(String(init?.body)).messages[0].content;
      assert(prompt.includes(artDirection.compact));
      assert(prompt.includes(artDirection.master));
      assert.match(prompt, /Return raw structured JSON without Markdown/);
      assert.equal(prompt.includes('{sequences:'), calls === 1);
      assert(!prompt.includes(artDirection.files.get('GOLDEN_REFERENCE.svg')!.toString('utf8')));
      const draft = prompt.includes('{sequences:')
        ? { sequences: [{ from: 0, through: 0, subject: 'Input', objective: 'Show indexed cells and input', layout: 'vertical', modes: ['data'] }] }
        : { subject: 'Input', objects: [{ id: 'input', kind: 'entry', label: 'Input', level: 0 },
          { id: 'bits', kind: 'matrix', label: 'Bit array', level: 1, cells: ['0', '0', '0', '0'] }],
          events: [{ kind: 'flow', cue: 's1c1', from: 'input', to: 'bits' }] };
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(draft) } }], usage: { total_tokens: 400 } });
    };
    const result = await planSemanticVisuals(session.storyboard, session.timeline, 'test-contract', [0], [0]);
    assert.equal(calls, 2);
    assert.equal(result.state.artDirectionRevision, artDirection.revision);
    assert.equal(result.failures.size, 0, JSON.stringify([...result.failures]));
    assert.equal(result.vectors.get(0)?.layers.find(layer => layer.id === 'bits')?.shape.kind, 'object');
  } finally {
    globalThis.fetch = nativeFetch;
    process.env = originalEnv;
  }
});

test('automatic Groq retains accepted ranges and compiles through the canonical importer', {
  skip: audit !== 'session_e9ca863a-a3ee-4345-9e58-4d4860631836' || exportMedia,
}, async () => {
  const { masterScriptService } = await import('../src/modules/ai-script/master-script-service.js');
  const { prepareAutomaticVisuals } = await import('../src/modules/render/automatic-visual-directives.js');
  const { prepareVisualImport } = await import('../src/modules/render/visual-directives.js');
  const { directiveRange } = await import('../src/modules/render/visual-directive-compiler.js');
  const saved = masterScriptService.getSession(audit!);
  assert(saved?.timeline);
  const fixture = JSON.parse(await readFile('output/whatsapp-visual-directive-validated.json', 'utf8'));
  const previous = await prepareVisualImport(saved, JSON.stringify(fixture), false);
  const initial = { ...saved, visualAssets: undefined };
  const { version, schemaHash, inputRevision, sequences } = fixture;
  const missing = sequences.find((sequence: Parameters<typeof directiveRange>[0]) => {
    const range = directiveRange(sequence);
    return range.from === range.through && range.from > 0;
  });
  assert(missing);
  const originalEnv = { ...process.env };
  const nativeFetch = globalThis.fetch;
  const ranges: number[][] = [];
  try {
    process.env.GROQ_API_KEYS = 'mock-only-visual';
    process.env.REEL_GROQ_VISUAL_TPM = '90000';
    process.env.REEL_IMAGE_GENERATION = 'off';
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), 'https://api.groq.com/openai/v1/chat/completions');
      const payload = JSON.parse(String(init?.body));
      assert.equal(payload.model, 'openai/gpt-oss-120b');
      assert.equal(payload.response_format.type, 'json_object');
      const prompt = payload.messages.at(-1).content;
      assert(prompt.includes('<svg'));
      assert(prompt.includes('Behind The Tech'));
      assert(prompt.includes('whisper'));
      const [from, through] = prompt.match(/inclusive zero-based range (\d+)–(\d+)/).slice(1).map(Number);
      ranges.push([from, through]);
      if (ranges.length === 2) return new Response(null, { status: 429, headers: { 'Retry-After': '1' } });
      const wanted = ranges.length === 1 ? sequences.filter((sequence: unknown) => sequence !== missing) :
        sequences.filter((sequence: Parameters<typeof directiveRange>[0]) => {
        const span = directiveRange(sequence);
        return span.from >= from && span.through <= through;
      });
      return Response.json({ choices: [{ finish_reason: 'stop', message: {
        content: JSON.stringify({ version, schemaHash, inputRevision, sequences: wanted }),
      } }], usage: { prompt_tokens: 1500, completion_tokens: 550 } });
    };
    const collected = await prepareAutomaticVisuals(initial);
    assert.equal(collected.visuals.source, 'automatic');
    assert.deepEqual(collected.visuals.shots, previous.visuals?.shots);
    assert.deepEqual(collected.visuals.automaticImport?.normalized, previous.normalized);
    const target = [directiveRange(missing).from, directiveRange(missing).through];
    assert.deepEqual(ranges, [[0, saved.timeline.segments.length - 1], target, target]);
    assert.deepEqual(collected.report.attempts.flatMap(attempt => attempt.responses), [200, 429, 200]);
  } finally {
    globalThis.fetch = nativeFetch;
    process.env = originalEnv;
  }
});
