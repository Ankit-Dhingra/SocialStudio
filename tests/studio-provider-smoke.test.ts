import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import mongoose from 'mongoose';
import { geminiRequest } from '../src/modules/ai-script/gemini-provider.js';
import { GroqProvider } from '../src/modules/ai-script/groq-provider.js';
import { masterScriptService } from '../src/modules/ai-script/master-script-service.js';
import { admitGeneration, grantGenerationCredits, initAdmission, settleGeneration } from '../src/modules/jobs/admission.js';
import { claimJob, finishExecution, getOwnedJob, initJobs, reviewExecution, type Provider } from '../src/modules/jobs/durable-jobs.js';
import { createProviderScope, withProviderScope } from '../src/modules/jobs/provider-guard.js';
import { createProject, initProjects } from '../src/modules/projects/repository.js';
import { alignAudioWithGroq } from '../src/modules/tts/tts-service.js';
import { SarvamTTSProvider } from '../src/modules/tts/sarvam-provider.js';

const uri = process.env.STUDIO_BILLING_TEST_MONGODB_URI;
const enabled = process.env.STUDIO_PROVIDER_SMOKE === 'true';

test('opt-in provider smoke uses one reserved request per API and synthetic content', { skip: !enabled || !uri, timeout: 120_000 }, async t => {
  assert(process.env.GEMINI_API_KEY && process.env.GROQ_API_KEY && process.env.SARVAM_API_KEY, 'Configure development API keys.');
  const db = new URL(uri!);
  assert(['127.0.0.1', 'localhost'].includes(db.hostname), 'The smoke ledger must run on loopback.');
  db.pathname = `/studio_smoke_${randomUUID().replaceAll('-', '')}`;
  await mongoose.connect(db.href);
  await Promise.all([initAdmission(), initJobs(), initProjects()]);
  const root = await mkdtemp(path.join(os.tmpdir(), 'studio-smoke-'));
  const prompt = 'Return a JSON object with the key "ready" and the boolean value true.';
  const audio = path.join(root, 'synthetic.mp3');
  const results: boolean[] = [];
  async function smoke(name: string, provider: Provider, action: () => Promise<unknown>) {
    const ownerId = `smoke-${name}`;
    const project = await masterScriptService.buildCustomSession(prompt);
    await createProject(ownerId, project);
    await grantGenerationCredits(ownerId, 'smoke-test', 1, new Date(Date.now() + 3_600_000));
    const boundMicros = 20_000;
    const quote = { providers: { [provider]: { attempts: 1, microsPerCall: boundMicros } }, computeMicros: 0 };
    const id = await admitGeneration({ ownerId, projectId: project.id, revision: 0, requestId: randomUUID(),
      operation: 'script', provider, credits: 1, boundMicros, quote },
    { dailyMicros: 100_000, monthlyMicros: 100_000, userDailyMicros: boundMicros, providerDailyMicros: 60_000 });
    const job = await claimJob(id);
    assert(job?.leaseId);
    const scope = createProviderScope(id, job.leaseId, quote, job.createdAt.toISOString().slice(0, 10));
    let succeeded = false;
    try {
      await withProviderScope(scope, action);
      succeeded = !scope.requiresReview();
    } catch { /* Print only statuses and numeric usage. */ }
    const observed = await getOwnedJob(ownerId, id);
    assert.equal(observed?.calls.length, 1);
    const { status, usage } = observed.calls[0];
    t.diagnostic(JSON.stringify({ name, status, succeeded, usage }));
    results.push(succeeded);
    if (scope.requiresReview()) await reviewExecution(id, job.leaseId);
    else {
      const spent = scope.costs[provider] ?? 0;
      await mongoose.connection.transaction(async transaction => {
        await finishExecution(id, job.leaseId!, transaction, succeeded ? {} : undefined);
        await settleGeneration(id, spent, succeeded, transaction, scope.costs);
      });
    }
    return succeeded;
  }

  try {
    await smoke('gemini', 'gemini', async () => {
      const response = await geminiRequest('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        process.env.GEMINI_API_KEY!, { contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 96, thinkingConfig: { thinkingBudget: 0 }, responseMimeType: 'application/json' } }, 15_000);
      assert(JSON.parse((await response.json()).candidates[0].content.parts[0].text).ready);
    });
    const groq = (model: string) => new GroqProvider([process.env.GROQ_API_KEY!], model).generateJSON(
      prompt, undefined, 15_000, undefined, { maxCompletionTokens: 256, reasoningEffort: 'low', failFastOnTransportError: true });
    await smoke('groq-script', 'groq', async () => {
      assert(JSON.parse(await groq(process.env.GROQ_MODEL || 'openai/gpt-oss-120b').then(value => value.trim())).ready);
    });
    await smoke('groq-visual-model', 'groq', async () => {
      assert(JSON.parse(await groq('openai/gpt-oss-120b').then(value => value.trim())).ready);
    });
    const spoke = await smoke('sarvam', 'sarvam', async () => {
      const provider = new SarvamTTSProvider(process.env.SARVAM_API_KEY!);
      const clip = await provider.synthesizeClip('नमस्ते। यह एक छोटा परीक्षण है।', audio, { sceneId: 'smoke', sceneIndex: 0 });
      assert(clip.durationMs > 0 && clip.durationMs < 10_000);
    });
    if (spoke) {
      await smoke('groq-whisper', 'groq', async () => assert((await alignAudioWithGroq(audio)).length > 0));
    }
    assert.equal(results.length, 5);
    assert(results.every(Boolean), 'Inspect the provider statuses above.');
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await rm(root, { recursive: true });
  }
});
