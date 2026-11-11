import 'dotenv/config';
import { parseCustomScriptToStoryboard } from './modules/ai-script/custom-script-parser.js';
import { generateHinglishScript } from './modules/ai-script/script-generator.js';
import { getTTSProvider } from './modules/tts/tts-service.js';
import express from 'express';
import cors from 'cors';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import { pool, queue, connection } from './core.js';

const app = express();
app.use(express.json({ limit: '50kb' }));
app.use(cors({ origin: '*' })); // Allow dashboard, n8n, and local dev clients

// Serve rendered videos and media assets
app.use('/media', express.static(path.resolve('media')));

// Lightweight health ping for UptimeRobot / Render keep-alive (fast, zero-overhead)
app.get(['/health', '/ping', '/'], (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'SocialStudio API',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Deep health check endpoint (validates Postgres & Redis connectivity)
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    const redisPong = await connection.ping();
    res.json({
      ok: true,
      services: {
        database: 'connected',
        redis: redisPong === 'PONG' ? 'connected' : 'error',
      },
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

// List videos
app.get('/api/videos', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM videos ORDER BY created_at DESC LIMIT 100');
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single video by ID
app.get('/api/videos/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM videos WHERE id=$1', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Also fetch job progress from BullMQ if available
    const job = await queue.getJob(req.params.id);
    const progress = job ? job.progress : null;

    res.json({
      ...rows[0],
      job_progress: progress,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper for token authorization
function checkAuth(req: express.Request): boolean {
  const token = req.headers['x-automation-token'];
  const expected = process.env.AUTOMATION_TOKEN || 'change-me-in-local-dev';
  // If no auth token required in local dev, allow, else verify
  return !process.env.AUTOMATION_TOKEN || token === expected;
}

// Preview the exact storyboard and its opening voice before committing to a full render.
app.post('/api/previews', async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({error: 'Invalid automation token'});
  const input = z.union([
    z.object({customScript: z.string().min(20).max(40000)}),
    z.object({topic: z.string().min(5).max(200)}),
  ]).safeParse(req.body);
  if (!input.success) return res.status(400).json({error: 'Enter a topic or a complete script.'});
  try {
    const storyboard = 'customScript' in input.data
      ? await parseCustomScriptToStoryboard(input.data.customScript)
      : await generateHinglishScript({topic: input.data.topic, targetDurationSec: 55});
    const id = randomUUID();
    const clip = path.resolve('media/previews', id, 'opening.mp3');
    await getTTSProvider().synthesizeClip(storyboard.scenes[0].narration, clip);
    res.json({storyboard, audioUrl: `/media/previews/${id}/opening.mp3`});
  } catch (err: any) {
    res.status(422).json({error: err.message});
  }
});

// Create and enqueue a new video generation job (Topic or Custom Script)
app.post('/api/videos', async (req, res) => {
  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Invalid x-automation-token' });
  }

  const parsed = z
    .object({
      topic: z.string().min(5).max(300).optional(),
      example: z.enum(['react-state', 'checkout', 'retrieval']).optional(),
      scheduleKey: z.string().min(1).max(200).optional(),
      customScript: z.string().min(20).max(40000).optional(),
    })
    .refine((data) => data.topic || data.customScript || data.example, {
      message: 'Either topic or customScript must be provided',
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request payload', details: parsed.error.issues });
  }

  const id = parsed.data.scheduleKey
    ? createHash('sha256').update('studio:daily:' + parsed.data.scheduleKey).digest('hex').slice(0, 32)
        .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
    : randomUUID();
  try {
    let topic = parsed.data.topic || 'Custom Script Reel';
    let preparsedScript = null;

    const customScript = parsed.data.customScript || (parsed.data.example
      ? await readFile(path.resolve('examples', parsed.data.example + '.json'), 'utf8')
      : undefined);
    if (customScript) {
      try {
        preparsedScript = await parseCustomScriptToStoryboard(customScript, topic);
        topic = preparsedScript.topic || topic;
      } catch (e: any) {
        return res.status(422).json({
          error: 'Failed to parse custom script into storyboard',
          message: e.message,
        });
      }
    }

    const inserted = await pool.query(
      'INSERT INTO videos(id, topic, title, script, status) VALUES($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING RETURNING id',
      [
        id,
        topic,
        preparsedScript?.title || topic,
        preparsedScript ? JSON.stringify(preparsedScript) : null,
        'QUEUED',
      ]
    );

    if (!inserted.rowCount) {
      const existing = (await pool.query('SELECT id, topic, status FROM videos WHERE id=$1', [id])).rows[0];
      if (existing.topic !== topic) return res.status(409).json({error: 'Schedule key already belongs to another topic.'});
      if (existing.status !== 'QUEUED' || await queue.getJob(id)) return res.json(existing);
    }

    await queue.add(
      'generate',
      { id },
      {
        jobId: id,
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      }
    );

    res.status(202).json({
      id,
      topic,
      title: preparsedScript?.title || topic,
      status: 'QUEUED',
      isCustomScript: Boolean(preparsedScript),
      message: 'Video generation job successfully queued',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Approve or Reject video
app.post('/api/videos/:id/approval', async (req, res) => {
  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Invalid x-automation-token' });
  }

  const state = z.enum(['APPROVED', 'REJECTED']).safeParse(req.body.status);
  if (!state.success) {
    return res.status(400).json({ error: "Invalid status. Must be 'APPROVED' or 'REJECTED'." });
  }

  try {
    const { rows } = await pool.query(
      "UPDATE videos SET status=$1, updated_at=now() WHERE id=$2 AND status='READY_FOR_REVIEW' RETURNING id, status",
      [state.data, req.params.id]
    );

    if (!rows.length) {
      return res.status(409).json({ error: 'Video must be in READY_FOR_REVIEW status to be approved or rejected.' });
    }

    res.status(200).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Retry a failed or rejected video
app.post('/api/videos/:id/retry', async (req, res) => {
  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Invalid x-automation-token' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM videos WHERE id=$1', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Video not found' });
    }

    await pool.query("UPDATE videos SET status='QUEUED', error=null, updated_at=now() WHERE id=$1", [
      req.params.id,
    ]);

    await queue.add(
      'generate',
      { id: req.params.id },
      {
        jobId: `${req.params.id}-retry-${Date.now()}`,
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      }
    );

    res.status(202).json({ id: req.params.id, status: 'QUEUED', message: 'Job re-enqueued' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Error middleware
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[API Error]:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

const port = Number(process.env.PORT || process.env.API_PORT || 4000);
export const server =
  process.env.NODE_ENV === 'test'
    ? null
    : app.listen(port, () => {
        console.log(`🚀 SocialStudio API running at http://localhost:${port}`);

        // Auto-initialize DB schema if needed on startup
        try {
          const schemaPath = path.resolve('db/schema.sql');
          if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            pool.query(schemaSql)
              .then(() => console.log('✔ [DB] Schema verified.'))
              .catch((err) => console.warn('[DB AutoInit Warning]:', err.message));
          }
        } catch (e: any) {
          console.warn('[DB AutoInit Warning]:', e.message);
        }

        // In single-container cloud deployment, start the worker in-process
        if (process.env.START_WORKER !== 'false') {
          import('./worker.js')
            .then(() => console.log('⚡ [Worker] Background BullMQ worker active in-process.'))
            .catch((err) => console.error('❌ [Worker] Failed to start worker:', err));
        }
      });

export default app;
