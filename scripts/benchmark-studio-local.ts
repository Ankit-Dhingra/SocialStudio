import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import mongoose from 'mongoose';
import { fixtureOwnerEmail, fixtureOwnerId, signedSessions } from '../tests/fixtures/clerk-session.js';
import { accountProfile, connectAccounts, getStudioUser } from '../src/modules/accounts/users.js';

const mongo = new URL(process.env.STUDIO_BILLING_TEST_MONGODB_URI ?? '');
const redisPort = Number(process.env.STUDIO_JOB_TEST_REDIS_PORT);
if (process.env.STUDIO_LOCAL_BENCHMARK !== 'true' || !['127.0.0.1', 'localhost'].includes(mongo.hostname) || !redisPort) {
  throw new Error('Benchmark requires opt-in and isolated loopback MongoDB and Redis.');
}
const suffix = randomUUID().replaceAll('-', '');
mongo.pathname = `/studio_benchmark_${suffix}`;
const fixture = signedSessions();
Object.assign(process.env, {
  NODE_ENV: 'test', SOCIALSTUDIO_AUTH: 'clerk', CLERK_PUBLISHABLE_KEY: fixture.config.publishableKey,
  CLERK_SECRET_KEY: fixture.config.secretKey, CLERK_JWT_KEY: fixture.config.jwtKey,
  FRONTEND_URL: fixture.config.frontendOrigin, OWNER_EMAIL: fixtureOwnerEmail, OWNER_CLERK_USER_ID: fixtureOwnerId,
  MONGODB_URI: mongo.href, REDIS_URL: `redis://127.0.0.1:${redisPort}`, DEMO_PUBLIC_BASE_URL: '', DEMO_MEDIA_DIR: 'media/demo',
  STUDIO_GENERATION_ENABLED: 'false', RAZORPAY_TEST_ENABLED: 'false', PRIVATE_MEDIA_DRIVER: '',
});

function percentile(values: number[], percentage: number) {
  const ordered = [...values].sort((a, b) => a - b);
  return Number(ordered[Math.ceil(percentage * ordered.length) - 1].toFixed(2));
}

async function batch(name: string, count: number, concurrency: number, request: (index: number) => Promise<void>) {
  let next = 0;
  const times: number[] = [];
  const started = performance.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < count) {
      const index = next++;
      const requestStarted = performance.now();
      await request(index);
      times.push(performance.now() - requestStarted);
    }
  }));
  return { name, count, concurrency, p50Ms: percentile(times, .5), p95Ms: percentile(times, .95),
    perSecond: Math.round(count * 1000 / (performance.now() - started)) };
}

async function benchmark() {
  const { app } = await import('../src/api.js');
  const { connection, queue: legacyQueue } = await import('../src/core.js');
  const { masterScriptService } = await import('../src/modules/ai-script/master-script-service.js');
  const { createProject, getProject, initProjects } = await import('../src/modules/projects/repository.js');
  const { initJobs } = await import('../src/modules/jobs/durable-jobs.js');
  const memory = new Redis(redisPort, '127.0.0.1', { maxRetriesPerRequest: null });
  const queue = new Queue(`studio-benchmark-${suffix}`, { connection: memory });
  await connectAccounts(mongo.href);
  await Promise.all([initProjects(), initJobs()]);
  await getStudioUser(fixtureOwnerId, fixture.config, async id => ({
    id, primaryEmailAddress: { emailAddress: fixtureOwnerEmail, verification: { status: 'verified' } },
    externalAccounts: [{ provider: 'google', emailAddress: fixtureOwnerEmail, verification: { status: 'verified' } }],
  }) as Parameters<typeof accountProfile>[0]);
  let lastId = '';
  for (let i = 0; i < 25; i++) {
    const project = await masterScriptService.buildCustomSession('A queue makes pending work visible to an available worker.', `Project ${i}`);
    lastId = project.id;
    await createProject(fixtureOwnerId, project);
  }
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const rssBefore = process.memoryUsage.rss();
  let peakRss = rssBefore;
  const sample = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage.rss()); }, 50);
  try {
    const jobs = mongoose.connection.db!.collection('jobs');
    const before = await jobs.countDocuments();
    const headers = { Origin: fixture.config.frontendOrigin, Authorization: `Bearer ${fixture.token(fixtureOwnerId, 0)}` };
    const demo = await (await fetch(base + '/api/demo/reels')).json() as { reels: { videoUrl: string }[] };
    if (demo.reels.length !== 5) throw new Error('Stage the five demo files first.');
    const get = async (route: string, status: number, headers?: Record<string, string>) => {
      const res = await fetch(base + route, { headers });
      if (res.status !== status) throw new Error(`Expected HTTP ${status} from ${route}.`);
      await res.arrayBuffer();
    };
    await get('/api/pipeline/sessions', 200, headers);
    const results = [
      await batch('guest catalog', 250, 20, () => get('/api/demo/reels', 200)),
      await batch('guest 64 KiB video ranges', 250, 20, i => get(demo.reels[i % 5].videoUrl, 206, { Range: 'bytes=0-65535' })),
      await batch('signed dashboard listing 25 projects', 250, 20, () => get('/api/pipeline/sessions', 200, headers)),
      await batch('MongoDB project read', 250, 20, async () => {
        if (!await getProject(fixtureOwnerId, lastId)) throw new Error('Benchmark project missing.');
      }),
      await batch('Redis queue admission fixture', 100, 10, async i => {
        await queue.add('fixture', { id: i.toString(16).padStart(64, '0') });
      }),
    ];
    const keys = await memory.keys(`bull:${queue.name}:*`);
    let queueBytes = 0;
    for (const key of keys) queueBytes += Number(await memory.memory('USAGE', key));
    const after = await jobs.countDocuments();
    if (after !== before) throw new Error('Read-only traffic created a generation job.');
    console.log(JSON.stringify({ results, rssBefore, peakRss, queueBytes, waiting: await queue.getWaitingCount(), durableJobsAdded: after - before }, null, 2));
  } finally {
    clearInterval(sample);
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await queue.obliterate({ force: true });
    await queue.close();
    memory.disconnect();
    connection.disconnect();
    await legacyQueue.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}

await benchmark();
