import 'dotenv/config';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { z } from 'zod';
import { StoryboardSchema, type Storyboard } from './modules/contracts/storyboard.js';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
export const queue = new Queue('shorts', { connection });

export { StoryboardSchema, type Storyboard };

export const sceneSchema = z.object({
  type: z.enum(['hook', 'diagram', 'code', 'summary']),
  headline: z.string().min(1).max(115),
  narration: z.string().min(1).max(500),
  code: z.string().max(250),
  label: z.string().max(70),
});
export const shortSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().min(5).max(500),
  scenes: z.array(sceneSchema).min(4).max(6),
});
export type Short = z.infer<typeof shortSchema>;

export async function patch(id: string, fields: Record<string, unknown>) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const sql = `UPDATE videos SET ${keys.map((k, i) => `"${k}"=$${i + 1}`).join(', ')}, updated_at=now() WHERE id=$${keys.length + 1}`;
  await pool.query(sql, [...Object.values(fields).map(v => (v && typeof v === 'object' ? JSON.stringify(v) : v)), id]);
}


