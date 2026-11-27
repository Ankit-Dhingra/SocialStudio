import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as wait } from 'node:timers/promises';
import { Queue, Worker } from 'bullmq';
import express from 'express';
import mongoose from 'mongoose';
import { masterScriptService } from '../src/modules/ai-script/master-script-service.js';
import { requireOwner, studioAuthentication } from '../src/modules/accounts/auth-middleware.js';
import type { StudioAccount } from '../src/modules/accounts/users.js';
import { generationAdminRouter } from '../src/modules/jobs/admin-routes.js';
import { availableGenerationCredits, grantGenerationCredits, initAdmission, settleGeneration } from '../src/modules/jobs/admission.js';
import { getOwnedJob, initJobs, reconcileJobs } from '../src/modules/jobs/durable-jobs.js';
import { executeStudioJob } from '../src/modules/jobs/execute-job.js';
import { publishJobMedia } from '../src/modules/jobs/project-media.js';
import { initTrials, trialRouter } from '../src/modules/jobs/trials.js';
import { createProject, initProjects, registerProjectMedia } from '../src/modules/projects/repository.js';
import { projectRouter } from '../src/modules/projects/routes.js';
import { directiveRange } from '../src/modules/render/visual-directive-compiler.js';
import { visualArtifactRevision } from '../src/modules/render/visual-directives.js';
import { localPrivateMedia } from '../src/modules/storage/private-media.js';
import type { VideoTimeline } from '../src/modules/video/timeline.js';
import { fixtureOwnerId as owner, signedSessions } from './fixtures/clerk-session.js';

const mongo = process.env.STUDIO_BILLING_TEST_MONGODB_URI;
const redis = Number(process.env.STUDIO_JOB_TEST_REDIS_PORT);
const savedNarration = process.env.REEL_MANUAL_AUDIT_SESSION;

test('owner-scoped submissions run through BullMQ with saved audio, manual and automatic visuals, and atomic settlement',
  { skip: !mongo || !redis || !savedNarration, timeout: 1_200_000 }, async t => {
    const uri = new URL(mongo!);
    const suffix = randomUUID().replaceAll('-', '');
    uri.pathname = `/studio_execution_${suffix}`;
    await mongoose.connect(uri.href);
    await Promise.all([initProjects(), initJobs(), initAdmission(), initTrials()]);
    const root = await mkdtemp(path.join(os.tmpdir(), 'studio-test-'));
    const app = express();
    const storage = localPrivateMedia(root, 'local-integration-signing-secret-long-enough');
    app.use('/api/private-media', storage.router!);
    const signed = signedSessions();
    app.use('/api', ...studioAuthentication(signed.config, async clerkUserId => ({
      clerkUserId, role: clerkUserId === owner ? 'owner' : 'member', status: 'active',
      email: clerkUserId === 'user_alias' ? 'trial.member+alias@googlemail.com' : 'trialmember@gmail.com',
    }) as StudioAccount));
    app.use('/api/admin/generation', requireOwner(signed.config), generationAdminRouter());
    app.use('/api/credits/trial', trialRouter({
      credits: 3, claimsPerDay: 1, validDays: 7, eligibleClerkIds: ['user_unrelated', 'user_alias'],
    }));
    app.use('/api/pipeline', projectRouter(storage, {
      caps: { dailyMicros: 10_000, monthlyMicros: 50_000, userDailyMicros: 5000, providerDailyMicros: 4000, trialDailyMicros: 1 },
      operations: { visuals: { credits: 2, computeMicros: 10, providers: { groq: { attempts: 2, microsPerCall: 50,
        microsPerMillionUnits: { inputTokens: 1000, outputTokens: 2000 } } } },
        refine: { credits: 2, computeMicros: 0, providers: { groq: { attempts: 1, microsPerCall: 100 } } },
        motion: { credits: 1, computeMicros: 15, providers: {} },
        render: { credits: 3, computeMicros: 50, providers: {} } },
    }));
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const queueName = `studio-test-${suffix}`;
    const connection = { host: '127.0.0.1', port: redis, maxRetriesPerRequest: null };
    const queue = new Queue(queueName, { connection });
    const renderQueue = new Queue(`${queueName}-render`, { connection });
    const generationOperations = ['visuals', 'refine'] as const;
    const renderOperations = ['motion', 'render'] as const;
    const fixture = JSON.parse(await readFile('output/whatsapp-visual-directive-validated.json', 'utf8'));
    let reply: typeof fixture;
    let failTransport = false;
    let calls = 0;
    const transport: typeof fetch = async (url, init) => {
      assert.equal(String(url), 'https://api.groq.com/openai/v1/chat/completions');
      const body = JSON.parse(String(init?.body));
      if (body.messages.at(-1).content.includes('User Revision Request:')) {
        return Response.json({ choices: [{ message: { content: JSON.stringify(reply) } }] });
      }
      assert.equal(body.model, 'openai/gpt-oss-120b');
      calls++;
      if (failTransport) throw new Error('fixture transport timeout');
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(reply) } }],
        usage: { prompt_tokens: 1500, completion_tokens: 550 } });
    };
    const worker = new Worker<{ id: string }>(queueName, message => executeStudioJob(message.data.id, storage, { transport, operations: [...generationOperations] }),
      { connection, lockDuration: 180_000 });
    const renderer = new Worker<{ id: string }>(renderQueue.name, message => executeStudioJob(message.data.id, storage, {
      operations: [...renderOperations], transport: async () => { throw new Error('Render queue attempted provider egress.'); },
    }), { connection, lockDuration: 180_000 });
    let workerError: Error | undefined;
    worker.on('error', error => { workerError = error; });
    renderer.on('error', error => { workerError = error; });
    const request = (route: string, init: RequestInit = {}, identity = 'owner') => {
      const headers = new Headers(init.headers);
      headers.set('Origin', signed.config.frontendOrigin);
      const subject = identity === 'other' ? 'user_unrelated' : identity === 'alias' ? 'user_alias' : owner;
      if (identity !== 'anonymous') headers.set('Authorization', `Bearer ${signed.token(subject,
        identity === 'owner' ? 0 : -1)}`);
      return fetch(base + route, { ...init, headers });
    };
    const submit = (body: object, idempotencyKey = randomUUID(), identity = 'owner') =>
      request('/api/pipeline/jobs', { method: 'POST', headers: {
        'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey,
      }, body: JSON.stringify(body) }, identity);
    const waitForJob = async (id: string, terminal: string) => {
      await Promise.all([
        reconcileJobs(queue, new Date(), true, [...generationOperations]),
        reconcileJobs(renderQueue, new Date(), true, [...renderOperations]),
      ]);
      for (let attempt = 0; attempt < 2700; attempt++) {
        if (workerError) throw workerError;
        const job = await getOwnedJob(owner, id);
        if (job && !['queued', 'running'].includes(job.status)) {
          assert.equal(job.status, terminal, JSON.stringify({ status: job.status, checkpoint: job.checkpoint, calls: job.calls }));
          return job;
        }
        await wait(200);
      }
      throw new Error('The queued generation did not reach a terminal state.');
    };
    const original = { GROQ_API_KEY: process.env.GROQ_API_KEY, GROQ_API_KEYS: process.env.GROQ_API_KEYS, REEL_GROQ_VISUAL_TPM: process.env.REEL_GROQ_VISUAL_TPM };
    process.env.GROQ_API_KEY = 'fixture-key-never-sent';
    process.env.GROQ_API_KEYS = 'fixture-key-never-sent';
    process.env.REEL_GROQ_VISUAL_TPM = '90000';
    try {
      const legacy = masterScriptService.getSession(savedNarration!);
      assert(legacy?.timeline);
      const first = fixture.sequences[0];
      const count = directiveRange(first).through + 1;
      const addProject = async (ownerId = owner) => {
        const session = structuredClone(legacy);
        session.id = `session_${randomUUID()}`;
        const timeline = session.timeline as VideoTimeline;
        timeline.segments = timeline.segments.slice(0, count);
        const last = timeline.segments.at(-1)!;
        timeline.totalDurationInFrames = last.startFrame + last.durationInFrames;
        timeline.totalDurationSec = timeline.totalDurationInFrames / timeline.fps;
        session.audioResult.clips = session.audioResult.clips.slice(0, count);
        delete session.audioResult.fullAudioUrl;
        session.audioResult.totalDurationMs = Math.round(timeline.totalDurationSec * 1000);
        session.audioResult.totalDurationSec = timeline.totalDurationSec;
        session.storyboard.scenes = session.storyboard.scenes.slice(0, count);
        delete session.visualAssets;
        delete session.automaticVisualDraft;
        delete session.stillPreviews;
        delete session.motionPreview;
        delete session.job;
        session.renderState = { status: 'idle', progress: 0 };
        await createProject(ownerId, session);
        const media = await Promise.all(timeline.segments.map(segment => publishJobMedia(storage, session.id, 'fixture',
          `/${segment.audioSrc}`, path.resolve('remotion/public', segment.audioSrc))));
        assert(await registerProjectMedia(ownerId, session.id, 0, media));
        return { session, artifact: { ...fixture, inputRevision: visualArtifactRevision(session), sequences: [first] } };
      };
      const manual = await addProject();
      const visualRoute = `/api/pipeline/manual-visual/${manual.session.id}`;
      assert.equal((await request(`${visualRoute}/context`, {}, 'other')).status, 404);
      const imported = await request(`${visualRoute}/generate`, { method: 'POST', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(manual.artifact) });
      assert.equal(imported.status, 200, await imported.clone().text());
      const manualVisuals = (await imported.json()).visuals;
      assert.equal(manualVisuals.source, 'manual');
      assert.equal(calls, 0);
      const automatic = await addProject();
      const visualInput = { operation: 'visuals', projectId: automatic.session.id, revision: 0 };
      assert.equal((await submit(visualInput, randomUUID(), 'anonymous')).status, 401);
      assert.equal((await submit(visualInput, randomUUID(), 'other')).status, 404);
      assert.equal((await submit(visualInput)).status, 402);
      assert.equal((await request('/api/admin/generation', {}, 'owner-without-mfa')).status, 403);
      assert.equal((await request('/api/admin/generation', {}, 'other')).status, 403);
      const claim = (identity: string) => request('/api/credits/trial/claim', { method: 'POST' }, identity);
      assert.equal((await claim('owner')).status, 403);
      assert.equal((await claim('other')).status, 201);
      assert.equal((await claim('other')).status, 409);
      assert.equal((await claim('alias')).status, 409);
      assert.equal(await availableGenerationCredits('user_unrelated'), 3);
      const trialProject = await addProject('user_unrelated');
      assert.equal((await submit({ operation: 'visuals', projectId: trialProject.session.id, revision: 0 },
        randomUUID(), 'other')).status, 429);
      assert.equal(await availableGenerationCredits('user_unrelated'), 3);
      const pause = (paused: boolean) => request('/api/admin/generation/pause', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paused }),
      });
      assert.equal((await pause(true)).status, 200);
      assert.equal((await submit(visualInput)).status, 503);
      assert.equal((await pause(false)).status, 200);
      assert(await grantGenerationCredits(owner, 'test-grant', 20, new Date(Date.now() + 3_600_000)));
      reply = automatic.artifact;
      const key = randomUUID();
      const submission = await submit(visualInput, key);
      assert.equal(submission.status, 202, await submission.clone().text());
      const { id } = await submission.json();
      assert.equal((await (await submit(visualInput, key)).json()).id, id);
      assert((await Promise.all(Array.from({ length: 12 }, () => submit(visualInput)))).every(response => response.status === 409));
      assert.equal(await availableGenerationCredits(owner), 18);
      const completed = await waitForJob(id, 'completed');
      assert.equal(completed.checkpoint, 'persisted');
      assert.equal(calls, 1);
      assert.equal(completed.calls[0].usage.prompt_tokens, 1500);
      assert.equal(completed.calls[0].estimatedMicros, 3);
      assert.equal(completed.calls[0].basis, 'usage');
      assert.equal(await settleGeneration(id, 0, true), false);
      assert.equal(await availableGenerationCredits(owner), 18);
      const automaticProject = await (await request(`/api/pipeline/script/${automatic.session.id}`)).json();
      assert.equal(automaticProject.visualAssets.source, 'automatic');
      assert.deepEqual(automaticProject.visualAssets.shots, manualVisuals.shots);
      const clip = automaticProject.audioResult.clips[0].url;
      assert.equal((await fetch(base + clip.split('?')[0])).status, 404);
      const signed = await fetch(base + clip, { headers: { Range: 'bytes=0-31' } });
      assert.equal(signed.status, 206);
      assert.equal((await signed.arrayBuffer()).byteLength, 32);

      if (process.env.STUDIO_HOSTED_RENDER_TEST === 'true') {
        for (const [project, fingerprint] of [[manual.session, manualVisuals.fingerprint], [automatic.session, automaticProject.visualAssets.fingerprint]] as const) {
          const render = await submit({ operation: 'render', projectId: project.id, revision: 1, visualRevision: fingerprint });
          assert.equal(render.status, 202, await render.clone().text());
          const renderJob = await waitForJob((await render.json()).id, 'completed');
          const output = await (await request(`/api/pipeline/script/${project.id}`)).json();
          assert.equal(output.renderState.qa.passed, true);
          assert.equal((await fetch(base + output.renderState.mediaUrl, { headers: { Range: 'bytes=0-1023' } })).status, 206);
          t.diagnostic(JSON.stringify({ source: output.visualAssets.source, media: output.renderState.qa.fileSizeBytes,
            durationSec: output.renderState.qa.durationSec, ...renderJob.metrics }));
        }
        assert.equal(await availableGenerationCredits(owner), 12);
        const motion = { operation: 'motion', projectId: manual.session.id, revision: 2, sceneIndex: 0, scope: 'hook',
          visualRevision: manualVisuals.fingerprint };
        assert.equal((await submit({ ...motion, visualRevision: 'stale' })).status, 409);
        const previewJob = await submit(motion);
        assert.equal(previewJob.status, 202);
        const preview = await waitForJob((await previewJob.json()).id, 'completed');
        assert.equal(preview.calls.length, 0);
        const updated = await (await request(`/api/pipeline/script/${manual.session.id}`)).json();
        assert.equal(updated.motionPreview.visualRevision, motion.visualRevision);
        assert(updated.motionPreview.durationSec > 0 && updated.motionPreview.durationSec <= 15);
        assert.equal((await fetch(base + updated.motionPreview.mediaUrl, { headers: { Range: 'bytes=0-1023' } })).status, 206);
        t.diagnostic(JSON.stringify({ source: 'motion', durationSec: updated.motionPreview.durationSec, ...preview.metrics }));
      }
      failTransport = true;
      const uncertain = await addProject();
      const timeout = await submit({ operation: 'visuals', projectId: uncertain.session.id, revision: 0 });
      assert.equal(timeout.status, 202);
      const pending = await waitForJob((await timeout.json()).id, 'needs_review');
      assert.equal(pending.calls.length, 1);
      assert.equal(calls, 2);
      assert.equal(await reconcileJobs(queue), 0);
      await assert.rejects(settleGeneration(pending._id, 0, false), /safe terminal outcome/);
      const reconciliation = () => request(`/api/admin/generation/jobs/${pending._id}/reconcile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: 'fixture-invoice', spending: { groq: 7 } }),
      });
      assert.equal((await reconciliation()).status, 200);
      assert.equal((await reconciliation()).status, 409);
      assert.equal((await getOwnedJob(owner, pending._id))?.status, 'failed');
      failTransport = false;
      reply = { ...legacy.sevenKeyScript, title: 'Refined verification title' };
      const target = await addProject();
      const refinement = await submit({ operation: 'refine', projectId: target.session.id, revision: 0, instruction: 'Change the title.' });
      assert.equal(refinement.status, 202);
      const refined = await waitForJob((await refinement.json()).id, 'completed');
      assert.equal(refined.calls.length, 1);
      const refinedProject = await (await request(`/api/pipeline/script/${target.session.id}`)).json();
      assert.equal(refinedProject.sevenKeyScript.title, 'Refined verification title');
    } finally {
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      await worker.close();
      await renderer.close();
      await queue.obliterate({ force: true });
      await queue.close();
      await renderQueue.obliterate({ force: true });
      await renderQueue.close();
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      await rm(root, { recursive: true, force: true });
    }
  });
