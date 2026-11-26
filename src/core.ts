import 'dotenv/config';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { StoryboardSchema, type Storyboard } from './modules/contracts/storyboard.js';

const dbUrl = process.env.DATABASE_URL;
const needsSsl = dbUrl?.includes('sslmode=require') || dbUrl?.includes('neon.tech') || dbUrl?.includes('supabase');

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});
pool.on('error', (err) => {
  // Gracefully log DB warnings without crashing the process
  console.warn('[Postgres Warning]:', err.message);
});

let hasLoggedRedisWarning = false;
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy: () => 30000,
  enableOfflineQueue: false,
  tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
});
connection.on('error', () => {
  // Log once to keep console clean during local standalone development
  if (!hasLoggedRedisWarning) {
    console.log('[Redis] Local Redis offline (running in standalone file-storage mode).');
    hasLoggedRedisWarning = true;
  }
});
export const queue = new Queue('shorts', { connection });

export { StoryboardSchema, type Storyboard };

export async function patch(id: string, fields: Record<string, unknown>) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const sql = `UPDATE videos SET ${keys.map((k, i) => `"${k}"=$${i + 1}`).join(', ')}, updated_at=now() WHERE id=$${keys.length + 1}`;
  await pool.query(sql, [...Object.values(fields).map(v => (v && typeof v === 'object' ? JSON.stringify(v) : v)), id]);
}


