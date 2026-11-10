process.env.NODE_ENV = 'test';
import 'dotenv/config';
import { pool, connection, queue } from '../src/core.js';
import app from '../src/api.js';
import http from 'node:http';

async function runTests() {
  console.log('=====================================================');
  console.log('🧪 RUNNING BRICK 6 INTEGRATION TESTS: QUEUE & API');
  console.log('=====================================================\n');

  // Start HTTP server on test port
  const testPort = 4999;
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(testPort, resolve));
  console.log(`[Test Server] Listening on http://localhost:${testPort}`);

  const baseUrl = `http://localhost:${testPort}`;
  const authToken = process.env.AUTOMATION_TOKEN || 'change-me-in-local-dev';

  let passed = 0;
  let total = 0;

  async function assert(name: string, fn: () => Promise<boolean>) {
    total++;
    try {
      const ok = await fn();
      if (ok) {
        console.log(`  ✔ [PASS] ${name}`);
        passed++;
      } else {
        console.error(`  ✖ [FAIL] ${name}`);
      }
    } catch (err: any) {
      console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
    }
  }

  // Test 1: Health check endpoint
  await assert('Health check reports database and redis connected', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const data = await res.json();
    return res.status === 200 && data.ok === true && data.services?.database === 'connected' && data.services?.redis === 'connected';
  });

  // Test 2: Auth guard on POST /api/videos
  await assert('POST /api/videos rejects requests without valid x-automation-token', async () => {
    const res = await fetch(`${baseUrl}/api/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-automation-token': 'wrong-token' },
      body: JSON.stringify({ topic: 'Valid topic name with enough characters' }),
    });
    return res.status === 401;
  });

  // Test 3: Validation on invalid topic
  await assert('POST /api/videos rejects topics that are too short (< 5 chars)', async () => {
    const res = await fetch(`${baseUrl}/api/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-automation-token': authToken },
      body: JSON.stringify({ topic: 'hi' }),
    });
    return res.status === 400;
  });

  // Test 4: Enqueue valid video
  let createdVideoId = '';
  await assert('POST /api/videos queues job and records entry in PostgreSQL', async () => {
    const res = await fetch(`${baseUrl}/api/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-automation-token': authToken },
      body: JSON.stringify({ topic: 'How PostgreSQL MVCC Vacuum Works Under The Hood' }),
    });
    const data = await res.json();
    if (res.status !== 202 || !data.id || data.status !== 'QUEUED') return false;
    createdVideoId = data.id;

    // Verify in PostgreSQL
    const { rows } = await pool.query('SELECT * FROM videos WHERE id=$1', [createdVideoId]);
    return rows.length === 1 && rows[0].status === 'QUEUED';
  });

  // Test 5: Verify BullMQ Job presence
  await assert('BullMQ Queue contains job with matching video ID', async () => {
    const job = await queue.getJob(createdVideoId);
    return job !== null && job !== undefined && job.data?.id === createdVideoId;
  });

  // Test 6: Fetch single video by ID
  await assert('GET /api/videos/:id returns video record and job progress', async () => {
    const res = await fetch(`${baseUrl}/api/videos/${createdVideoId}`);
    const data = await res.json();
    return res.status === 200 && data.id === createdVideoId && data.status === 'QUEUED';
  });

  // Test 7: List all videos
  await assert('GET /api/videos lists created video', async () => {
    const res = await fetch(`${baseUrl}/api/videos`);
    const data = await res.json();
    return res.status === 200 && Array.isArray(data) && data.some((v: any) => v.id === createdVideoId);
  });

  // Test 8: Approval validation before READY_FOR_REVIEW
  await assert('POST /api/videos/:id/approval rejects video not in READY_FOR_REVIEW state (409 Conflict)', async () => {
    const res = await fetch(`${baseUrl}/api/videos/${createdVideoId}/approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-automation-token': authToken },
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    return res.status === 409;
  });

  // Test 9: Approval succeeds when READY_FOR_REVIEW
  await assert('POST /api/videos/:id/approval accepts video when in READY_FOR_REVIEW state', async () => {
    // Manually transition to READY_FOR_REVIEW for state machine testing
    await pool.query("UPDATE videos SET status='READY_FOR_REVIEW' WHERE id=$1", [createdVideoId]);

    const res = await fetch(`${baseUrl}/api/videos/${createdVideoId}/approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-automation-token': authToken },
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    const data = await res.json();

    const { rows } = await pool.query('SELECT status FROM videos WHERE id=$1', [createdVideoId]);
    return res.status === 200 && data.status === 'APPROVED' && rows[0].status === 'APPROVED';
  });

  // Clean up
  console.log('\nCleaning up test artifacts...');
  await pool.query('DELETE FROM videos WHERE id=$1', [createdVideoId]);
  const job = await queue.getJob(createdVideoId);
  if (job) await job.remove();

  await new Promise<void>((resolve) => server.close(() => resolve()));
  await queue.close();
  await connection.quit();
  await pool.end();

  console.log(`\n=====================================================`);
  console.log(`📊 TEST RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log(`=====================================================`);

  if (passed === total) {
    console.log('🎉 BRICK 6 QUEUE & STATE MACHINE VERIFIED 100%!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
