import 'dotenv/config';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { StoryboardSchema, type Storyboard } from './modules/contracts/storyboard.js';

function configuredUrl(value: string, name: string) {
  try { return new URL(value); }
  catch { throw new Error(`Invalid ${name} configuration.`); }
}

const dbUrl = process.env.DATABASE_URL ? configuredUrl(process.env.DATABASE_URL, 'DATABASE_URL') : undefined;
const needsSsl = Boolean(dbUrl && (process.env.NODE_ENV === 'production' ||
  dbUrl.searchParams.has('sslmode') || dbUrl.hostname.endsWith('.neon.tech') || dbUrl.hostname.includes('.supabase.')));
if (needsSsl) {
  for (const option of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl']) dbUrl?.searchParams.delete(option);
}

export const pool = new Pool({
  connectionString: dbUrl?.href,
  ssl: needsSsl ? { rejectUnauthorized: true } : undefined,
});
pool.on('error', (err) => {
  // Gracefully log DB warnings without crashing the process
  console.warn('[Postgres Warning]:', err.message);
});

let hasLoggedRedisWarning = false;
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
if (process.env.NODE_ENV === 'production' && process.env.REDIS_URL) {
  const connectionUrl = configuredUrl(redisUrl, 'REDIS_URL');
  if (connectionUrl.protocol !== 'rediss:' && !(connectionUrl.protocol === 'redis:' && /^red-[a-z0-9]+$/.test(connectionUrl.hostname))) {
    throw new Error('Production Redis requires TLS or a Render private Key Value address.');
  }
}
export const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy: () => 30000,
  enableOfflineQueue: false,
  tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: true } : undefined,
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


