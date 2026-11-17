import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';

// Route OS temporary files to container disk rather than tmpfs (RAM)
const diskTmpDir = path.resolve('media/tmp');
if (!fs.existsSync(diskTmpDir)) {
  fs.mkdirSync(diskTmpDir, { recursive: true });
}
process.env.TMPDIR = diskTmpDir;
process.env.TEMP = diskTmpDir;
process.env.TMP = diskTmpDir;

// Ensure Remotion's bundled ffmpeg and ffprobe are on PATH
const remotionBinDirs = [
  path.resolve('node_modules/@remotion/compositor-win32-x64-msvc'),
  path.resolve('node_modules/@remotion/compositor-linux-x64-gnu'),
  path.resolve('node_modules/@remotion/compositor-darwin-x64'),
  path.resolve('node_modules/@remotion/compositor-darwin-arm64'),
];
for (const binDir of remotionBinDirs) {
  if (fs.existsSync(binDir) && !process.env.PATH?.includes(binDir)) {
    process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH}`;
  }
}

import { parseCustomScriptToStoryboard } from './modules/ai-script/custom-script-parser.js';
import { generateHinglishScript } from './modules/ai-script/script-generator.js';
import { masterScriptService } from './modules/ai-script/master-script-service.js';
import { getTTSProvider, synthesizeStoryboardNarration } from './modules/tts/tts-service.js';
import { buildVideoTimeline } from './modules/video/timeline.js';
import { renderStudioShort, renderStillPreviews } from './modules/render/video-renderer.js';
import { performMediaQA } from './modules/qa/media-qa.js';
import { execFileSync } from 'node:child_process';
import express from 'express';
import cors from 'cors';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { pool, queue, connection } from './core.js';

const app = express();
app.use(express.json({ limit: '50kb' }));
app.use(cors({ origin: '*' })); // Allow dashboard, n8n, and local dev clients

// Serve rendered videos and media assets
app.use('/media', express.static(path.resolve('media')));
// Serve Remotion audio assets
app.use('/audio', express.static(path.resolve('remotion/public/audio')));
// Serve Remotion visual stills and screenshots
app.use('/previews', express.static(path.resolve('remotion/public/previews')));

// Serve compiled Dashboard frontend
const dashboardDist = path.resolve('dashboard/dist');
if (fs.existsSync(dashboardDist)) {
  app.use(express.static(dashboardDist));
}

// Lightweight health ping for UptimeRobot / Render keep-alive (fast, zero-overhead)
app.get(['/health', '/ping'], (_req, res) => {
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

    // Attach live BullMQ progress and detect stalled/interrupted jobs
    const enriched = await Promise.all(
      rows.map(async (row) => {
        if (['QUEUED', 'SCRIPTING', 'NARRATING', 'RENDERING'].includes(row.status)) {
          try {
            const job = await queue.getJob(row.id);
            if (job) {
              const state = await job.getState();
              if (state === 'failed') {
                const failReason = job.failedReason || 'Job failed in queue';
                await pool.query('UPDATE videos SET status=$1, error=$2, updated_at=now() WHERE id=$3', [
                  'FAILED',
                  failReason,
                  row.id,
                ]);
                return { ...row, status: 'FAILED', error: failReason, job_progress: job.progress };
              }
              return { ...row, job_progress: job.progress };
            } else {
              // If status is in-flight but no job exists in Redis after 3 minutes
              const ageSec = (Date.now() - new Date(row.updated_at || row.created_at).getTime()) / 1000;
              if (ageSec > 180) {
                const errorMsg = 'Process was interrupted or container restarted. Click Retry to re-run.';
                await pool.query('UPDATE videos SET status=$1, error=$2, updated_at=now() WHERE id=$3', [
                  'FAILED',
                  errorMsg,
                  row.id,
                ]);
                return { ...row, status: 'FAILED', error: errorMsg };
              }
            }
          } catch {}
        }
        return row;
      })
    );

    res.json(enriched);
  } catch (err: any) {
    // Graceful fallback when DB is offline during local development
    res.json([]);
  }
});

// ==============================================================================
// MASTER SCRIPT PIPELINE ENDPOINTS (General Tech Reels & Chatbot Refinement)
// ==============================================================================

// 1. List pipeline sessions
app.get('/api/pipeline/sessions', (_req, res) => {
  try {
    const list = masterScriptService.listSessions().map((s) => ({
      id: s.id,
      topic: s.topic,
      angle: s.angle,
      title: s.storyboard?.title || s.topic,
      finalized: s.finalized || false,
      hasAudio: Boolean(s.audioResult),
      hasVideo: Boolean(s.renderState?.mediaUrl),
      renderStatus: s.renderState?.status || 'idle',
      updatedAt: s.updatedAt,
      createdAt: s.createdAt,
    }));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Start initial master script generation
app.post('/api/pipeline/script/start', async (req, res) => {
  const { topic, angle } = req.body;
  if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
    return res.status(400).json({ error: 'Please enter a valid technical topic.' });
  }
  try {
    const session = await masterScriptService.startScriptSession(topic, angle);
    res.status(201).json(session);
  } catch (err: any) {
    console.error('[API /pipeline/script/start Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. ChatGPT-style refinement chat
app.post('/api/pipeline/script/chat', async (req, res) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message are required.' });
  }
  try {
    const session = await masterScriptService.chatRefine(sessionId, message);
    res.json(session);
  } catch (err: any) {
    console.error('[API /pipeline/script/chat Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Get session state
app.get('/api/pipeline/script/:sessionId', (req, res) => {
  const session = masterScriptService.getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session);
});

// 5. Finalize script
app.post('/api/pipeline/script/finalize', (req, res) => {
  const { sessionId, customMarkdown } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required.' });
  }
  try {
    const session = masterScriptService.finalizeScript(sessionId, customMarkdown);
    res.json(session);
  } catch (err: any) {
    console.error('[API /pipeline/script/finalize Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Voiceover synthesis with Sarvam AI (strictly on-demand to protect credits)
app.post('/api/pipeline/audio/synthesize', async (req, res) => {
  const { sessionId, spokenNarration } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required.' });
  }

  const session = masterScriptService.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (spokenNarration !== undefined && (
    !Array.isArray(spokenNarration) ||
    spokenNarration.length !== session.storyboard.scenes.length ||
    spokenNarration.some(value => typeof value !== 'string' || value.length > 2500)
  )) {
    return res.status(400).json({ error: 'Voice text must contain one entry per scene, up to 2500 characters each.' });
  }

  const storyboard = spokenNarration === undefined ? session.storyboard : {
    ...session.storyboard,
    scenes: session.storyboard.scenes.map((scene, index) => ({
      ...scene,
      spokenNarration: spokenNarration[index].trim() || undefined,
    })),
  };

  try {
    console.log(`[Pipeline] Synthesizing audio for session ${sessionId}...`);
    const runDir = path.resolve('remotion/public/audio/runs', sessionId);
    if (!fs.existsSync(runDir)) {
      fs.mkdirSync(runDir, { recursive: true });
    }

    const ttsProvider = getTTSProvider();
    const audioResult = await synthesizeStoryboardNarration(storyboard, runDir, ttsProvider);

    // Copy to media runs and dist-remotion so all clients can serve it
    const mediaAudioDir = path.resolve('media/runs', sessionId, 'audio');
    const distDirs = [
      mediaAudioDir,
      path.resolve('dist-remotion/public/audio/runs', sessionId),
      path.resolve('dist-remotion/audio/runs', sessionId),
    ];
    for (const d of distDirs) {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    }

    for (const clip of audioResult.clips) {
      for (const d of distDirs) {
        fs.copyFileSync(clip.filePath, path.join(d, path.basename(clip.filePath)));
      }
    }

    // Concatenate into full narration mp3
    let fullAudioUrl = '';
    try {
      const concatListPath = path.join(runDir, 'concat_list.txt');
      const lines = audioResult.clips.map((c) => `file '${path.resolve(c.filePath).replace(/\\/g, '/')}'`);
      fs.writeFileSync(concatListPath, lines.join('\n'), 'utf8');

      const fullNarrationPath = path.join(runDir, 'full-narration.mp3');
      execFileSync('ffmpeg', [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-c', 'copy',
        fullNarrationPath,
      ]);

      for (const d of distDirs) {
        fs.copyFileSync(fullNarrationPath, path.join(d, 'full-narration.mp3'));
      }
      fullAudioUrl = `/audio/runs/${sessionId}/full-narration.mp3`;
    } catch (concatErr) {
      console.warn('[Pipeline] Full narration concat warning:', concatErr);
    }

    // Build timeline
    const timeline = buildVideoTimeline(storyboard, audioResult.clips, {
      fps: 30,
      scenePaddingFrames: 5,
      audioSrcPrefix: `audio/runs/${sessionId}`,
    });

    // Update session
    session.storyboard = storyboard;
    session.audioResult = {
      ...audioResult,
      fullAudioUrl,
      clips: audioResult.clips.map((c) => ({
        ...c,
        url: `/audio/runs/${sessionId}/${path.basename(c.filePath)}`,
      })),
    };
    session.timeline = timeline;
    masterScriptService.updateSession(session);

    res.json({
      ok: true,
      audioResult: session.audioResult,
      timeline,
      fullAudioUrl,
    });
  } catch (err: any) {
    console.error(`[Pipeline Audio Synthesis Error]:`, err);
    res.status(500).json({ error: err.message });
  }
});

// 6.5. Generate Still Previews (fast 3-4s visual verification without full render)
app.post('/api/pipeline/stills', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required.' });
  }

  const session = masterScriptService.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (!session.timeline) {
    session.timeline = buildVideoTimeline(session.storyboard, session.audioResult?.clips || [], {
      fps: 30,
      scenePaddingFrames: 5,
      audioSrcPrefix: `audio/runs/${sessionId}`,
    });
    masterScriptService.updateSession(session);
  }

  try {
    const previewDir = path.resolve('remotion/public/previews', sessionId);
    console.log(`[Pipeline] Generating still previews for session ${sessionId}...`);
    const stills = await renderStillPreviews(
      session.storyboard,
      session.timeline,
      previewDir,
      `/previews/${sessionId}`
    );

    session.stillPreviews = stills;
    masterScriptService.updateSession(session);

    res.json({
      ok: true,
      stills,
    });
  } catch (err: any) {
    console.error(`[Pipeline Stills Error]:`, err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pipeline/stills/:sessionId', (req, res) => {
  const session = masterScriptService.getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({
    stills: session.stillPreviews || [],
  });
});

// 7. Video rendering (1080x1920 MP4)
app.post('/api/pipeline/render', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required.' });
  }

  const session = masterScriptService.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (!session.timeline || !session.audioResult) {
    return res.status(400).json({
      error: 'Audio not synthesized yet. Please synthesize voiceover before rendering the video.',
    });
  }

  // Set rendering status
  session.renderState = {
    status: 'rendering',
    progress: 5,
  };
  masterScriptService.updateSession(session);

  const targetMp4Path = path.resolve('media/runs', sessionId, 'final-short.mp4');

  // Trigger rendering asynchronously
  (async () => {
    try {
      console.log(`[Pipeline] Rendering StudioShort for session ${sessionId}...`);
      const renderResult = await renderStudioShort({
        storyboard: session.storyboard,
        timeline: session.timeline,
        outputFilePath: targetMp4Path,
        onProgress: (p) => {
          session.renderState = {
            status: 'rendering',
            progress: Math.min(99, Math.max(1, Math.round(p.percent))),
          };
          masterScriptService.updateSession(session);
        },
      });

      console.log(`[Pipeline] Video render finished for session ${sessionId}. Running Media QA...`);
      const qaReport = performMediaQA(renderResult, session.timeline);

      const mediaUrl = `/media/runs/${sessionId}/final-short.mp4`;
      session.renderState = {
        status: 'completed',
        progress: 100,
        mediaUrl,
        qa: qaReport,
      };
      masterScriptService.updateSession(session);
      console.log(`🎉 [Pipeline] Video ready at ${mediaUrl}!`);
    } catch (err: any) {
      console.error(`❌ [Pipeline] Render failed for session ${sessionId}:`, err);
      session.renderState = {
        status: 'failed',
        progress: 0,
        error: err.message || String(err),
      };
      masterScriptService.updateSession(session);
    }
  })();

  res.json({
    ok: true,
    message: 'Rendering started',
    renderState: session.renderState,
  });
});

// 8. Render status check
app.get('/api/pipeline/render/status/:sessionId', (req, res) => {
  const session = masterScriptService.getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({
    renderState: session.renderState || { status: 'idle', progress: 0 },
  });
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

    // Clean any orphaned or active job for this video in queue
    try {
      const existingJob = await queue.getJob(req.params.id);
      if (existingJob) {
        await existingJob.remove();
      }
    } catch {}

    await pool.query("UPDATE videos SET status='QUEUED', error=null, updated_at=now() WHERE id=$1", [
      req.params.id,
    ]);

    await queue.add(
      'generate',
      { id: req.params.id },
      {
        jobId: `${req.params.id}-${Date.now()}`,
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      }
    );

    res.status(202).json({ id: req.params.id, status: 'QUEUED', message: 'Job re-enqueued' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Inspect queue state
app.get('/api/queue/status', async (req, res) => {
  try {
    const [activeCount, waitingCount, failedCount, completedCount, activeJobs, isPaused] = await Promise.all([
      queue.getActiveCount(),
      queue.getWaitingCount(),
      queue.getFailedCount(),
      queue.getCompletedCount(),
      queue.getActive(),
      queue.isPaused(),
    ]);

    res.json({
      isPaused,
      activeCount,
      waitingCount,
      failedCount,
      completedCount,
      activeJobs: activeJobs.map((j) => ({ id: j.id, name: j.name, progress: j.progress })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reset the entire queue and set abandoned in-flight videos to FAILED
app.post('/api/queue/reset', async (req, res) => {
  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Invalid x-automation-token' });
  }

  try {
    const activeJobs = await queue.getActive();
    for (const j of activeJobs) {
      try {
        await j.moveToFailed(new Error('Queue reset by admin'), '0', true);
      } catch {}
    }
    await queue.drain();
    await queue.clean(0, 1000, 'failed');
    await queue.clean(0, 1000, 'active');

    await pool.query(
      "UPDATE videos SET status='FAILED', error='Reset by user request', updated_at=now() WHERE status IN ('QUEUED', 'SCRIPTING', 'NARRATING', 'RENDERING')"
    );

    res.json({ ok: true, message: 'Queue and stuck in-flight videos have been reset successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

if (fs.existsSync(dashboardDist)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/media') || req.path.startsWith('/audio')) {
      return next();
    }
    res.sendFile(path.join(dashboardDist, 'index.html'));
  });
}

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

        // In single-container cloud deployment, start the worker in-process if requested
        if (process.env.START_WORKER === 'true') {
          import('./worker.js')
            .then(() => console.log('⚡ [Worker] Background BullMQ worker active in-process.'))
            .catch((err) => console.error('❌ [Worker] Failed to start worker:', err));
        }
      });

export default app;
