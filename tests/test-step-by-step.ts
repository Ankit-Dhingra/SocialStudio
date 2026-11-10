console.log('Step 0: starting test');
import 'dotenv/config';
import { Pool } from 'pg';
import { Redis } from 'ioredis';

async function step1() {
  console.log('Step 1: connecting pg...');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const p = await pool.query('SELECT 1 as num');
  console.log('PG OK:', p.rows[0]);
  await pool.end();

  console.log('Step 2: connecting redis...');
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
  const pong = await redis.ping();
  console.log('Redis OK:', pong);

  console.log('Step 3: BullMQ Queue...');
  const { Queue } = await import('bullmq');
  const queue = new Queue('test-queue', { connection: redis });
  const cnt = await queue.count();
  console.log('Queue OK:', cnt);

  await queue.close();
  await redis.quit();
  console.log('ALL PASSED!');
  process.exit(0);
}

step1().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
