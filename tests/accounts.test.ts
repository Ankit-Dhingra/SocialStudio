import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import mongoose from 'mongoose';
import { clerkConfig, type ClerkConfig } from '../src/modules/accounts/auth-config.js';
import { requireOwner, studioAuthentication } from '../src/modules/accounts/auth-middleware.js';
import { accountProfile, connectAccounts, getStudioUser, type StudioAccount, VerifiedEmailRequired } from '../src/modules/accounts/users.js';
import { ownerFor, ownsSession } from '../src/modules/pipeline/session-owner.js';
import type { ScriptSession } from '../src/modules/ai-script/master-script-service.js';
import { getProject, importProject, initProjects, replaceProject } from '../src/modules/projects/repository.js';
import { claimJob, getOwnedJob, initJobs, reconcileJobs, recordJob, updateJobLease } from '../src/modules/jobs/durable-jobs.js';
import { Queue } from 'bullmq';

import { fixtureOwnerEmail as email, fixtureOwnerId as ownerId, fixtureFrontendOrigin as frontendOrigin, signedSessions } from './fixtures/clerk-session.js';
const mongoTestUrl = process.env.STUDIO_ACCOUNTS_TEST_MONGODB_URI;

test('Clerk configuration fails closed for hosted Studio', () => {
  assert.equal(clerkConfig({ NODE_ENV: 'development' }), undefined);
  assert.throws(() => clerkConfig({ NODE_ENV: 'production' }), /CLERK_SECRET_KEY/);
  const config = {
    NODE_ENV: 'production', CLERK_PUBLISHABLE_KEY: 'pk_test_fake', CLERK_SECRET_KEY: 'sk_test_fake',
    MONGODB_URI: 'mongodb://localhost/studio', FRONTEND_URL: frontendOrigin, OWNER_EMAIL: email,
  };
  assert.throws(() => clerkConfig(config), /production instance/);
  assert.throws(() => clerkConfig({ ...config, FRONTEND_URL: `${frontendOrigin}/projects` }), /application origin/);
  const live = { ...config, CLERK_PUBLISHABLE_KEY: 'pk_live_fixture', CLERK_SECRET_KEY: 'sk_live_fixture' };
  assert.throws(() => clerkConfig(live), /verified certificates/);
  assert.throws(() => clerkConfig({ ...live, MONGODB_URI: 'mongodb+srv://atlas.example.test/studio?tlsAllowInvalidCertificates=true' }), /verified certificates/);
  assert.doesNotThrow(() => clerkConfig({ ...live, MONGODB_URI: 'mongodb+srv://atlas.example.test/studio' }));
  const staging = { ...config, SOCIALSTUDIO_DEPLOYMENT: 'staging', OWNER_CLERK_USER_ID: ownerId,
    MONGODB_URI: 'mongodb+srv://atlas.example.test/studio' };
  assert.equal(clerkConfig(staging)?.stagingOwnerOnly, true);
  assert.equal(clerkConfig(staging)?.requireOwnerMfa, true);
  assert.throws(() => clerkConfig({ ...staging, OWNER_CLERK_USER_ID: '' }), /pinned owner/);
  assert.throws(() => clerkConfig({ ...staging, ...live }), /Clerk development keys/);
  assert.throws(() => clerkConfig({ ...staging, FRONTEND_URL: 'http://localhost:5173' }), /application origin/);
  assert.throws(() => clerkConfig({ ...staging, MONGODB_URI: 'mongodb://localhost/studio' }), /verified certificates/);
  assert.throws(() => clerkConfig({ ...staging, STUDIO_GENERATION_ENABLED: 'true' }), /generation and trials disabled/);
  assert.throws(() => clerkConfig({ ...staging, NODE_ENV: 'development' }), /production runtime/);
});

test('owner eligibility requires a verified Clerk email, linked verified Google identity, and an optional pinned ID', () => {
  const profile = {
    id: ownerId, firstName: 'Studio', lastName: 'Owner',
    primaryEmailAddress: { emailAddress: email.toUpperCase(), verification: { status: 'verified' } },
    externalAccounts: [{ provider: 'oauth_google', emailAddress: email, verification: { status: 'verified' } }],
    publicMetadata: { role: 'member' }, unsafeMetadata: { role: 'owner' },
  } as Parameters<typeof accountProfile>[0];
  assert.equal(accountProfile(profile, { ownerEmail: email, ownerClerkUserId: undefined }).ownerCandidate, true);
  assert.equal(accountProfile(profile, { ownerEmail: email, ownerClerkUserId: 'user_other' }).ownerCandidate, false);
  assert.equal(accountProfile({ ...profile, externalAccounts: [] }, { ownerEmail: email, ownerClerkUserId: undefined }).ownerCandidate, false);
  assert.throws(() => accountProfile({ ...profile, primaryEmailAddress: null },
    { ownerEmail: email, ownerClerkUserId: undefined }), VerifiedEmailRequired);
});

test('Clerk session verification gates owner actions and isolates session ownership', async () => {
  const { config, token } = signedSessions();
  const app = express();
  const requestedUsers: string[] = [];
  app.use('/api', ...studioAuthentication(config, async clerkUserId => {
    requestedUsers.push(clerkUserId);
    return { clerkUserId, role: clerkUserId === ownerId ? 'owner' : 'member',
      status: clerkUserId === 'user_suspended' ? 'suspended' : 'active' } as StudioAccount;
  }));
  let reel: ScriptSession | undefined;
  app.post('/api/reel', (req, res) => {
    reel = { ownerDigest: ownerFor(req, res) } as ScriptSession;
    res.status(201).end();
  });
  app.get('/api/reel', (req, res) => res.sendStatus(reel && ownsSession(req, reel) ? 200 : 404));
  app.get('/api/admin', requireOwner(config), (_req, res) => res.sendStatus(200));
  app.get('/staging/account', ...studioAuthentication({ ...config, stagingOwnerOnly: true, ownerClerkUserId: ownerId },
    async clerkUserId => ({ clerkUserId, role: 'owner', status: 'active' } as StudioAccount)),
  (_req, res) => res.sendStatus(200));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const request = async (path: string, accessToken?: string, method = 'GET') => {
    const headers = new Headers({ Origin: frontendOrigin, 'X-Clerk-User-Id': ownerId,
      'X-Role': 'owner', 'X-SocialStudio-Owner': 'a'.repeat(64) });
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    const response = await fetch(`${base}${path}`, { headers, method, redirect: 'manual' });
    return response.status;
  };

  try {
    assert.equal(await request('/api/admin'), 401);
    const member = token('user_member');
    assert.equal(await request('/api/admin', token('user_member', 0, 'https://other.example.test')), 401);
    assert.equal(await request('/api/admin', member), 403);
    assert.equal(await request('/api/admin', token(ownerId)), 403);
    assert.equal(await request('/api/admin', token(ownerId, 1)), 200);
    assert.equal(await request('/staging/account', member), 403);
    assert.equal(await request('/staging/account', token(ownerId, 1)), 200);
    assert.equal(await request('/api/reel', member, 'POST'), 201);
    assert.equal(await request('/api/reel', member), 200);
    assert.equal(await request('/api/reel', token(ownerId, 1)), 404);
    assert.equal(await request('/api/reel', token('user_suspended')), 403);
    assert.deepEqual(requestedUsers, ['user_member', ownerId, ownerId, 'user_member', 'user_member', ownerId, 'user_suspended']);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('MongoDB stores one account per Clerk ID, one owner, and no signup entitlement', { skip: !mongoTestUrl }, async () => {
  const db = new URL(mongoTestUrl!);
  db.pathname = `/socialstudio_accounts_test_${crypto.randomUUID().replaceAll('-', '')}`;
  const config: ClerkConfig = {
    frontendOrigin, publishableKey: 'unused', secretKey: 'unused', jwtKey: undefined,
    mongodbUri: db.href, ownerEmail: email, ownerClerkUserId: undefined, requireOwnerMfa: true,
  };
  const profile = async (id: string) => ({
    id, firstName: 'Studio', lastName: 'Tester',
    primaryEmailAddress: { emailAddress: email, verification: { status: 'verified' } },
    externalAccounts: [{ provider: 'google', emailAddress: email, verification: { status: 'verified' } }],
  } as Parameters<typeof accountProfile>[0]);

  try {
    await connectAccounts(config.mongodbUri);
    await initProjects();
    await initJobs();
    const accounts = await Promise.all(Array.from({ length: 5 }, () => getStudioUser(ownerId, config, profile)));
    assert.equal(new Set(accounts.map(account => String(account._id))).size, 1);
    assert(accounts.every(account => account.role === 'owner' && account.status === 'active'));

    const member = await getStudioUser('user_other', config, profile);
    assert.equal(member.role, 'member');
    assert.equal(member.plan, null);
    assert.equal(member.trialEligibility, 'unassessed');
    assert.equal(member.clerkUserId, 'user_other');

    await mongoose.disconnect();
    await connectAccounts(config.mongodbUri);
    const savedOwner = await getStudioUser(ownerId, config, async () => { throw new Error('Unexpected Clerk lookup.'); });
    assert.equal(savedOwner.role, 'owner');
    assert.equal(String(savedOwner._id), String(accounts[0]._id));

    const signed = signedSessions();
    const originalEnv = process.env;
    process.env = { ...process.env, NODE_ENV: 'test', SOCIALSTUDIO_AUTH: 'clerk', FRONTEND_URL: frontendOrigin,
      CLERK_PUBLISHABLE_KEY: signed.config.publishableKey, CLERK_SECRET_KEY: signed.config.secretKey,
      CLERK_JWT_KEY: signed.config.jwtKey, OWNER_EMAIL: email, OWNER_CLERK_USER_ID: ownerId,
      OWNER_REQUIRE_MFA: 'true', MONGODB_URI: config.mongodbUri, REDIS_URL: 'redis://127.0.0.1:6379' };
    const { app } = await import('../src/api.js');
    const { connection } = await import('../src/core.js');
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const request = (route: string, clerkUserId?: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      headers.set('Origin', frontendOrigin);
      if (clerkUserId) headers.set('Authorization', `Bearer ${signed.token(clerkUserId, 0)}`);
      return fetch(base + route, { ...init, headers });
    };
    let createdSessionId: string | undefined;
    try {
      assert.equal((await request('/api/pipeline/sessions')).status, 401);
      const ready = await request('/ready');
      assert.equal(ready.status, 200);
      assert.equal((await ready.json()).database, 'ok');
      assert.equal((await request('/api/videos', undefined, { method: 'POST' })).status, 401);
      assert.equal((await request('/api/pipeline/audio/synthesize', ownerId, { method: 'POST' })).status, 403);
      assert.equal((await request('/output/old-video.mp4')).status, 404);
      assert.equal((await request('/api/admin/access', 'user_other')).status, 403);
      assert.equal((await request('/api/admin/access', ownerId)).status, 200);
      assert.equal((await (await request('/api/account', ownerId)).json()).role, 'owner');
      assert.equal((await (await request('/api/account', 'user_other')).json()).role, 'member');

      const created = await request('/api/pipeline/script/custom', 'user_other', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customScript: 'A queue stores work until a worker is ready to process it.' }),
      });
      assert.equal(created.status, 201);
      createdSessionId = (await created.json()).id;
      assert.match(createdSessionId!, /^session_/);
      const record = await getProject('user_other', createdSessionId!);
      assert(record);
      assert.equal(await replaceProject('user_other', record.session, record.revision), true);
      assert.equal(await replaceProject('user_other', record.session, record.revision), false);
      const legacy = { ...record.session, id: 'session_legacy_import_fixture', ownerDigest: 'legacy-credential',
        job: { status: 'running' }, renderState: { status: 'rendering', progress: 42 } };
      assert.equal(await importProject(ownerId, legacy), true);
      assert.equal(await importProject(ownerId, legacy), false);
      assert.equal(await getProject('user_other', legacy.id), null);
      const migrated = await getProject(ownerId, legacy.id);
      assert.equal(migrated?.session.ownerDigest, undefined);
      assert.equal(migrated?.session.job.status, 'failed');
      assert.equal(migrated?.session.renderState.status, 'idle');
      const recorded = await recordJob('user_other', createdSessionId!, 'visuals', 1, 'fixture-request');
      const same = await recordJob('user_other', createdSessionId!, 'visuals', 1, 'fixture-request');
      assert(recorded && same);
      assert.equal(recorded._id, same._id);
      assert.equal(await getOwnedJob(ownerId, recorded._id), null);
      const ids = new Set();
      const queue = { add: async (_name: string, data: { id: string }) => ids.add(data.id) } as unknown as Pick<Queue, 'add'>;
      if (process.env.STUDIO_JOB_TEST_REDIS_PORT) {
        const isolatedQueue = new Queue(`studio-recovery-${crypto.randomUUID()}`, {
          connection: { host: '127.0.0.1', port: Number(process.env.STUDIO_JOB_TEST_REDIS_PORT) },
        });
        try {
          await isolatedQueue.waitUntilReady();
          assert.equal(await reconcileJobs(isolatedQueue), 1);
          assert.equal(await isolatedQueue.getWaitingCount(), 1);
          await isolatedQueue.drain();
          assert.equal(await isolatedQueue.getWaitingCount(), 0);
          assert.equal(await reconcileJobs(isolatedQueue), 1);
          assert.equal(await reconcileJobs(isolatedQueue), 1);
          assert.equal(await isolatedQueue.getWaitingCount(), 1);
        } finally { await isolatedQueue.obliterate({ force: true }); await isolatedQueue.close(); }
      }
      assert.equal(await reconcileJobs(queue), 1);
      assert.deepEqual([...ids], [recorded._id]);
      ids.clear();
      assert.equal(await reconcileJobs(queue), 1);
      assert.deepEqual([...ids], [recorded._id]);
      const startedAt = new Date();
      const claims = (await Promise.all([claimJob(recorded._id, startedAt), claimJob(recorded._id, startedAt)])).filter(Boolean);
      assert.equal(claims.length, 1);
      assert.equal(await updateJobLease(recorded._id, claims[0]!.leaseId!, 'checkpoint', 'timeline', startedAt), true);
      const expiredAt = new Date(startedAt.getTime() + 61_000);
      assert.equal(await reconcileJobs(queue, expiredAt), 1);
      const resumed = await claimJob(recorded._id, expiredAt);
      assert.equal(resumed?.checkpoint, 'timeline');
      assert.equal(await updateJobLease(recorded._id, claims[0]!.leaseId!, 'complete', undefined, expiredAt), false);
      assert.equal(await updateJobLease(recorded._id, resumed!.leaseId!, 'provider-start', undefined, expiredAt), true);
      assert.equal(await reconcileJobs(queue, new Date(expiredAt.getTime() + 61_000)), 0);
      assert.equal((await getOwnedJob('user_other', recorded._id))?.status, 'needs_review');
      assert.equal((await request(`/api/pipeline/jobs/${recorded._id}`, ownerId)).status, 404);
      const jobStatus = await request(`/api/pipeline/jobs/${recorded._id}`, 'user_other');
      assert.equal((await jobStatus.json()).status, 'needs_review');
      assert.equal((await request(`/api/pipeline/status/${createdSessionId}`, 'user_other')).status, 200);
      assert.equal((await request(`/api/pipeline/status/${createdSessionId}`, ownerId)).status, 404);
      for (const [id, hasReel] of [['user_other', true], [ownerId, false]] as const) {
        const response = await request('/api/pipeline/sessions', id);
        assert.equal(response.status, 200);
        const reels = await response.json() as Array<{ id: string }>;
        assert.equal(reels.some(reel => reel.id === createdSessionId), hasReel);
      }
      assert.equal((await request(`/api/pipeline/session/${createdSessionId}`, ownerId, { method: 'DELETE' })).status, 404);
      assert.equal((await request(`/api/pipeline/session/${createdSessionId}`, 'user_other', { method: 'DELETE' })).status, 200);
      assert.equal((await request(`/api/pipeline/status/${createdSessionId}`, 'user_other')).status, 404);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      connection.disconnect();
      process.env = originalEnv;
    }
  } finally {
    try { if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase(); }
    finally { await mongoose.disconnect(); }
  }
});
