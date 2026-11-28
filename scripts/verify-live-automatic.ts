import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { masterScriptService } from '../src/modules/ai-script/master-script-service.js';
import { admitGeneration, grantGenerationCredits, initAdmission, settleGeneration } from '../src/modules/jobs/admission.js';
import { claimJob, finishExecution, getOwnedJob, initJobs, reviewExecution, updateJobLease } from '../src/modules/jobs/durable-jobs.js';
import { createProviderScope, withProviderScope } from '../src/modules/jobs/provider-guard.js';
import { createProject, initProjects } from '../src/modules/projects/repository.js';
import { performMediaQA } from '../src/modules/qa/media-qa.js';
import { AutomaticVisualError, prepareAutomaticVisuals, type AutomaticVisualDraft, type AutomaticVisualReport } from '../src/modules/render/automatic-visual-directives.js';
import { directiveRange } from '../src/modules/render/visual-directive-compiler.js';
import { renderStudioShort } from '../src/modules/render/video-renderer.js';

const attempts = 8;
const microsPerCall = 7000;
const ceiling = attempts * microsPerCall;
const quote = { computeMicros: 0, providers: { groq: { attempts, microsPerCall,
  microsPerMillionUnits: { inputTokens: 150000, outputTokens: 600000 } } } };

async function verify() {
  const sessionId = process.argv[2];
  const original = sessionId && masterScriptService.getSession(sessionId);
  const db = new URL(process.env.STUDIO_BILLING_TEST_MONGODB_URI ?? '');
  const key = (process.env.GROQ_API_KEY ?? '').split(',')[0].trim();
  if (process.env.STUDIO_VERIFY_LIVE_AUTOMATIC !== 'true' || !original || !original.timeline || !key ||
      !['127.0.0.1', 'localhost'].includes(db.hostname)) throw new Error('Live verification requires opt-in, saved audio, a Groq key and loopback MongoDB.');
  const run = randomUUID();
  const output = path.resolve('backups', 'saas-tooling', `live-automatic-${run}`);
  db.pathname = `/studio_live_visual_${run.replaceAll('-', '')}`;
  process.env.REEL_GROQ_VISUAL_TPM = '8000';
  process.env.GROQ_API_KEYS = key;
  process.env.REEL_IMAGE_GENERATION = 'off';
  const session = structuredClone(original);
  delete session.visualAssets;
  delete session.automaticVisualDraft;
  await mkdir(output, { recursive: true });
  await mongoose.connect(db.href);
  await Promise.all([initProjects(), initJobs(), initAdmission()]);
  const owner = 'live-visual-audit';
  await createProject(owner, session);
  await grantGenerationCredits(owner, 'verification', 1, new Date(Date.now() + 3_600_000));
  const id = await admitGeneration({ ownerId: owner, projectId: session.id, revision: 0, requestId: run,
    operation: 'visuals', credits: 1, provider: 'groq', boundMicros: ceiling, quote },
  { dailyMicros: ceiling, monthlyMicros: ceiling, userDailyMicros: ceiling, providerDailyMicros: ceiling });
  const job = await claimJob(id);
  if (!job?.leaseId) throw new Error('Could not claim the reserved verification job.');
  const leaseId = job.leaseId;
  const scope = createProviderScope(id, leaseId, quote, job.createdAt.toISOString().slice(0, 10));
  const heartbeat = setInterval(() => void updateJobLease(id, leaseId, 'renew').catch(() => undefined), 15_000);
  heartbeat.unref();
  const started = Date.now();
  let lastDraft: AutomaticVisualDraft | undefined;
  let report: AutomaticVisualReport | undefined;
  let quality: ReturnType<typeof performMediaQA> | undefined;
  let stopReason: string | undefined;
  let completed = false;
  try {
    const result = await withProviderScope(scope, () => prepareAutomaticVisuals(session, {
      saveDraft: draft => { lastDraft = draft; }, progress: ({ completed, total }) => console.log(`Accepted ${completed}/${total} scenes`),
    }));
    report = result.report;
    const visualPlan = result.visuals.shots;
    const compiled = result.visuals.automaticImport?.normalized;
    if (!compiled) throw new Error('The complete directives were unavailable.');
    await writeFile(path.join(output, 'directives.json'), JSON.stringify(compiled, null, 2));
    if (scope.requiresReview()) throw new Error('Uncertain provider outcome.');
    const render = await renderStudioShort({ storyboard: session.storyboard, timeline: session.timeline, visualPlan,
      outputFilePath: path.join(output, 'automatic.mp4') });
    quality = performMediaQA(render, session.timeline);
    completed = quality.passed;
  } catch (error) {
    if (error instanceof AutomaticVisualError) {
      report = error.report;
      stopReason = error.issues[0]?.message;
    }
  } finally {
    const accepted = new Set<number>();
    for (const sequence of lastDraft?.sequences ?? []) {
      const { from, through } = directiveRange(sequence);
      for (let index = from; index <= through; index++) accepted.add(index + 1);
    }
    const observed = await getOwnedJob(owner, id);
    const calls = observed?.calls.map(({ status, usage, estimatedMicros }) => ({ status, usage, estimatedMicros })) ?? [];
    const failedScenes = session.storyboard.scenes.map((_, i) => i + 1).filter(index => !accepted.has(index));
    const tokens = calls.reduce((total, call) => ({
      input: total.input + (call.usage?.inputTokens ?? 0),
      output: total.output + (call.usage?.outputTokens ?? 0),
    }), { input: 0, output: 0 });
    const prior = new Set<number>();
    const repairAttempts = report?.attempts.filter(attempt => attempt.responses.length > 0).filter(attempt => {
      const scenes = Array.from({ length: attempt.through - attempt.from + 1 }, (_, i) => attempt.from + i);
      const repeated = scenes.some(index => prior.has(index));
      scenes.forEach(index => prior.add(index));
      return repeated;
    }).length;
    const details = { completed, acceptedScenes: [...accepted].sort((a, b) => a - b), failedScenes, repairAttempts, stopReason,
      calls, tokens, estimatedMicros: scope.costs.groq ?? 0, reservedMicros: ceiling,
      elapsedMs: Date.now() - started, mediaQA: quality };
    await writeFile(path.join(output, 'report.json'), JSON.stringify(details, null, 2));
    if (!completed && lastDraft) await writeFile(path.join(output, 'accepted-draft.json'), JSON.stringify(lastDraft, null, 2));
    console.log(JSON.stringify(details));
    console.log(output);
    if (scope.requiresReview()) await reviewExecution(id, leaseId);
    else {
      await mongoose.connection.transaction(async transaction => {
        await finishExecution(id, leaseId, transaction, completed ? {} : undefined);
        await settleGeneration(id, scope.costs.groq ?? 0, completed, transaction, scope.costs);
      });
      await mongoose.connection.dropDatabase();
    }
    clearInterval(heartbeat);
    await mongoose.disconnect();
  }
  if (!completed) process.exitCode = 1;
}

verify().catch(async () => { console.error('Live visual verification stopped. Inspect the local verification report.'); await mongoose.disconnect(); process.exitCode = 1; });
