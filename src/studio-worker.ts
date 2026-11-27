import 'dotenv/config';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import mongoose from 'mongoose';
import { clerkConfig } from './modules/accounts/auth-config.js';
import { connectAccounts, hasActiveAccount } from './modules/accounts/users.js';
import { initAdmission, settleGeneration } from './modules/jobs/admission.js';
import { expiredExecutions, initJobs, reconcileJobs } from './modules/jobs/durable-jobs.js';
import { executeStudioJob } from './modules/jobs/execute-job.js';
import { executionConfig } from './modules/jobs/execution-config.js';
import { generationPaused } from './modules/jobs/generation-control.js';
import { initProjects } from './modules/projects/repository.js';
import { privateMediaFromEnv } from './modules/storage/private-media.js';

async function start() {
  const auth = clerkConfig(process.env);
  const config = executionConfig();
  const storage = privateMediaFromEnv();
  if (!auth || !config || !storage || !process.env.REDIS_URL) throw new Error('Hosted generation configuration is incomplete.');
  const redisUrl = new URL(process.env.REDIS_URL);
  if (process.env.NODE_ENV === 'production' && redisUrl.protocol !== 'rediss:' &&
      !(redisUrl.protocol === 'redis:' && /^red-[a-z0-9]+$/.test(redisUrl.hostname))) {
    throw new Error('Production generation Redis requires a secure connection.');
  }
  await connectAccounts(auth.mongodbUri);
  await Promise.all([initAdmission(), initJobs(), initProjects()]);
  const connection = new Redis(redisUrl.href, { maxRetriesPerRequest: null, connectTimeout: 5000,
    tls: redisUrl.protocol === 'rediss:' ? { rejectUnauthorized: true } : undefined });
  connection.on('error', () => console.error('[Studio worker] Redis unavailable.'));
  const queue = new Queue('studio-generation', { connection });
  queue.on('error', () => console.error('[Studio worker] Queue unavailable.'));
  const worker = new Worker<{ id: string }>('studio-generation', async message => {
    if (/^[a-f0-9]{64}$/.test(message.data.id)) {
      await executeStudioJob(message.data.id, storage, {
        authorized: async (ownerId, operation) => operation !== 'motion' && Boolean(config.operations[operation]) &&
          Boolean(await hasActiveAccount(ownerId)),
      });
    }
  }, { connection, concurrency: 1, lockDuration: 180_000 });
  worker.on('error', () => console.error('[Studio worker] Queue processing unavailable.'));
  worker.on('failed', () => console.error('[Studio worker] Execution interrupted; checking MongoDB state on reconciliation.'));
  let reconciliation: Promise<void> | undefined;
  const reconcile = () => {
    reconciliation ??= (async () => {
      for (const job of await expiredExecutions()) await settleGeneration(job._id, 0, false);
      if (connection.status === 'ready' && !await generationPaused()) await reconcileJobs(queue, new Date(), true);
    })().catch(() => console.error('[Studio worker] Reconciliation unavailable.')).finally(() => { reconciliation = undefined; });
  };
  worker.once('ready', () => { console.log('[Studio worker] Ready.'); reconcile(); });
  const timer = setInterval(reconcile, 5_000);
  const stop = async () => {
    clearInterval(timer);
    await worker.close();
    connection.disconnect();
    await Promise.allSettled([queue.close(), mongoose.disconnect()]);
  };
  process.once('SIGINT', () => void stop());
  process.once('SIGTERM', () => void stop());
}

start().catch(async () => {
  console.error('[Studio worker] Startup failed. Verify generation, MongoDB, Redis and private media configuration.');
  await mongoose.disconnect();
  process.exitCode = 1;
});
