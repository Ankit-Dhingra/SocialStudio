import { motionFrameRange, motionPreviewMetadata } from './modules/render/motion-preview.js';
import mongoose from 'mongoose';
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
import { buildVideoTimeline, repairOpeningWordFrames } from './modules/video/timeline.js';
import { renderStillPreviews, renderStudioShort } from './modules/render/video-renderer.js';
import { renderReviewedPreviews } from './modules/render/review-storyboard.js';
import { saveAppScreen } from './modules/render/reel-visual-assets.js';
import { prepareStoryboardVisuals, reviseVisualAssets, storyboardVisualInputRevision } from './modules/render/storyboard-visuals.js';
import { storyDirectionSchema } from './modules/video/visual-story.js';
import { performMediaQA } from './modules/qa/media-qa.js';
import { runServerPipeline, isJobRunning } from './modules/pipeline/server-orchestrator.js';
import { canAdoptLocalSession, canProvisionLegacySession, ownerFor, ownsSession, sessionIdPattern, validLegacyAutomation } from './modules/pipeline/session-owner.js';
import { DirectiveError, prepareVisualImport, visualArtifactRevision, visualDirectiveMaxBytes, visualPromptContext } from './modules/render/visual-directives.js';
import { AutomaticVisualError, prepareAutomaticVisuals, type AutomaticProgress } from './modules/render/automatic-visual-directives.js';
import { verifiedDirectiveExample, visualSourcePack } from './modules/render/visual-source-pack.js';
import { execFileSync } from 'node:child_process';
import express from 'express';
import cors from 'cors';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { pool, queue, connection } from './core.js';
import { clerkConfig, portfolioConfig } from './modules/accounts/auth-config.js';
import { requireOwner, studioAuthentication } from './modules/accounts/auth-middleware.js';
import { connectAccounts } from './modules/accounts/users.js';
import { demoRouter } from './modules/demo/routes.js';
import { projectRouter } from './modules/projects/routes.js';
import { initProjects } from './modules/projects/repository.js';
import { privateMediaFromEnv } from './modules/storage/private-media.js';
import { monitorRedis } from './modules/jobs/redis-health.js';
import { getOwnedJob, initJobs } from './modules/jobs/durable-jobs.js';
import { executionConfig } from './modules/jobs/execution-config.js';
import { generationAdminRouter } from './modules/jobs/admin-routes.js';
import { initTrials, trialPolicy, trialRouter } from './modules/jobs/trials.js';
import { availableGenerationCredits, initAdmission } from './modules/jobs/admission.js';
import { razorpayTestConfig } from './modules/payments/razorpay.js';
import { initTestBilling } from './modules/payments/ledger.js';
import { razorpayWebhook, testBillingRouter } from './modules/payments/routes.js';

const portfolio = portfolioConfig(process.env);
const authConfig = portfolio ? undefined : clerkConfig(process.env);
const hostedClosed = Boolean(authConfig || portfolio);
const privateMedia = authConfig ? privateMediaFromEnv() : undefined;
const testBilling = authConfig ? razorpayTestConfig() : undefined;
const generation = authConfig ? executionConfig() : undefined;
const trial = privateMedia && generation?.caps.trialDailyMicros ? trialPolicy() : undefined;
let redisHealth: ReturnType<typeof monitorRedis> | undefined;
let draining = false;
export const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: authConfig?.frontendOrigin ?? portfolio?.frontendOrigin ?? '*' }));
app.use('/api/demo', demoRouter({ directory: process.env.DEMO_MEDIA_DIR, publicBaseUrl: process.env.DEMO_PUBLIC_BASE_URL,
  videoBaseUrl: process.env.DEMO_PUBLIC_VIDEO_BASE_URL, imageBaseUrl: process.env.DEMO_PUBLIC_IMAGE_BASE_URL }));
if (privateMedia?.router) app.use('/api/private-media', privateMedia.router);
if (testBilling) app.use('/api/billing/test/webhook', razorpayWebhook(testBilling));

if (authConfig) {
  app.use('/api', ...studioAuthentication(authConfig));
  app.get('/api/account', (_req, res) => {
    const { _id, email, displayName, role, status, plan, trialEligibility } = res.locals.studioAccount;
    res.json({ id: _id, email, displayName, role, status, plan, trialEligibility });
  });
  app.get('/api/admin/access', requireOwner(authConfig), (_req, res) => res.json({ allowed: true }));
  app.get('/api/admin/redis-health', requireOwner(authConfig), (_req, res) => res.json(redisHealth?.read() ?? { status: 'disabled' }));
  app.use('/api/admin/generation', requireOwner(authConfig), generationAdminRouter());
  app.use('/api/credits/trial', trialRouter(trial));
  app.get('/api/credits/balance', (_req, res, next) => {
    availableGenerationCredits(res.locals.studioAccount.clerkUserId).then(available => res.json({ available })).catch(next);
  });
  app.get('/api/pipeline/jobs/:id', (req, res, next) => {
    if (!/^[a-f0-9]{64}$/.test(req.params.id)) return res.status(404).json({ error: 'Job not found.' });
    getOwnedJob(res.locals.studioAccount.clerkUserId, req.params.id).then(job => {
      if (!job) return res.status(404).json({ error: 'Job not found.' });
      return res.json({ id: job._id, projectId: job.projectId, operation: job.operation, status: job.status,
        attempts: job.attempts, checkpoint: job.checkpoint, updatedAt: job.updatedAt });
    }).catch(next);
  });
  app.use('/api/pipeline', projectRouter(privateMedia, generation));
  if (testBilling) app.use('/api/billing/test', testBillingRouter(testBilling));
  app.use('/api', (_req, res) => {
    res.status(403).json({ error: 'This operation is unavailable in the hosted Studio.' });
  });
} else if (portfolio) {
  app.use('/api', (_req, res) => {
    res.set('Cache-Control', 'private, no-store');
    res.status(403).json({ error: 'Studio sign-in and generation are unavailable in portfolio mode.' });
  });
}

const jsonBody = express.json({ limit: '50kb' });
app.use((req, res, next) => /^\/api\/pipeline\/manual-visual\//i.test(req.path) ? next() : jsonBody(req, res, next));

// Serve rendered videos and media assets
if (!hostedClosed) {
  for (const directory of ['runs', 'previews', 'generated-reel-visuals']) {
    app.use(`/media/${directory}`, express.static(path.resolve('media', directory)));
  }
  app.use('/audio', express.static(path.resolve('remotion/public/audio')));
  app.use('/previews', express.static(path.resolve('remotion/public/previews')));
  app.use('/output', express.static(path.resolve('output')));
}

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

if (authConfig) app.get('/ready', async (_req, res) => {
  if (draining) return res.status(503).json({ status: 'draining' });
  try {
    if (!mongoose.connection.db) throw new Error('Database is unavailable.');
    await mongoose.connection.db.command({ ping: 1 }, { timeoutMS: 2_000 });
    const redis = redisHealth?.read().status ??
      (generation || process.env.REDIS_HEALTH_CHECK === 'true' ? 'unavailable' : 'disabled');
    if (redis !== 'disabled' && redis !== 'ok') return res.status(503).json({ status: 'unavailable', database: 'ok', redis });
    return res.json({ status: 'ready', database: 'ok', redis });
  } catch {
    return res.status(503).json({ status: 'unavailable', database: 'unavailable' });
  }
});
else if (portfolio) app.get('/ready', (_req, res) => {
  if (draining) return res.status(503).json({ status: 'draining' });
  return res.json({ status: 'ready', mode: 'portfolio' });
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

app.use('/api/pipeline', (req, res, next) => {
  let urlSession;
  try { urlSession = decodeURIComponent(req.path).split('/').find(part => part.startsWith('session_')); }
  catch { return res.status(400).json({ error: 'Invalid session ID.' }); }
  const id = urlSession ?? req.body?.sessionId;
  if (id === undefined || id === null || id === '') return next();
  if (typeof id !== 'string' || !sessionIdPattern.test(id)) return res.status(400).json({ error: 'Invalid session ID.' });
  const session = masterScriptService.getSession(id);
  if ((authConfig || session?.ownerDigest) && (!session || !ownsSession(req, session))) {
    return res.status(404).json({ error: 'Session not found.' });
  }
  next();
});

// 1. List pipeline sessions
app.get('/api/pipeline/sessions', (req, res) => {
  try {
    const list = masterScriptService.listSessions().filter(session =>
      (!authConfig && !session.ownerDigest) || ownsSession(req, session)).map((s) => ({
      id: s.id,
      jobId: s.jobId || s.job?.id,
      topic: s.topic,
      angle: s.angle,
      title: s.storyboard?.title || s.topic,
      finalized: s.finalized || false,
      hasAudio: Boolean(s.audioResult),
      hasVideo: Boolean(s.renderState?.mediaUrl),
      mediaUrl: s.renderState?.mediaUrl || null,
      renderStatus: s.renderState?.status || 'idle',
      duration: Number.isFinite(s.renderState?.qa?.durationSec)
        ? `${Math.round(s.renderState?.qa.durationSec)}s`
        : s.storyboard?.estimatedDurationSec ? `${s.storyboard.estimatedDurationSec}s` : undefined,
      scenesCount: s.storyboard?.scenes?.length || 0,
      sevenKeyScript: s.sevenKeyScript,
      hasStoryboard: Boolean(s.storyboard?.scenes?.length),
      job: s.job,
      updatedAt: s.updatedAt,
      createdAt: s.createdAt,
    }));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete pipeline session
app.delete('/api/pipeline/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const ok = masterScriptService.deleteSession(sessionId);
    res.json({ success: ok, sessionId });
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
    session.ownerDigest = ownerFor(req, res);
    masterScriptService.updateSession(session);
    res.status(201).json(session);
  } catch (err: any) {
    console.error('[API /pipeline/script/start Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2b. Start session from Creator Custom Script (6-Key / 7-Key JSON or text)
app.post('/api/pipeline/script/custom', async (req, res) => {
  const { customScript, topic, sessionId } = req.body;
  if (!customScript) {
    return res.status(400).json({ error: 'Please provide customScript (6-Key JSON or text).' });
  }
  try {
    const ownerDigest = sessionId ? undefined : ownerFor(req, res);
    const session = await masterScriptService.createCustomSession(customScript, topic, sessionId, undefined, ownerDigest);
    res.status(201).json(session);
  } catch (err: any) {
    console.error('[API /pipeline/script/custom Error]:', err);
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
  if (!session.finalized) {
    return res.status(409).json({ error: 'Finalize the script before creating voiceover.' });
  }

  if (spokenNarration !== undefined && (
    !Array.isArray(spokenNarration) ||
    spokenNarration.length !== session.storyboard.scenes.length ||
    spokenNarration.some(value => typeof value !== 'string' || value.length > 2500)
  )) {
    return res.status(400).json({ error: 'Voice text must contain one entry per scene, up to 2500 characters each.' });
  }

  const storyboard = session.storyboard;
  if (spokenNarration?.some((value: string, index: number) =>
    value.trim() !== (storyboard.scenes[index].spokenNarration?.trim() || '')
  )) {
    return res.status(409).json({ error: 'Save and finalize narration edits before creating voiceover.' });
  }
  const audioRun = `${sessionId}/${randomUUID()}`;
  try {
    console.log(`[Pipeline] Synthesizing audio for session ${sessionId}...`);
    const runDir = path.resolve('remotion/public/audio/runs', audioRun);
    if (!fs.existsSync(runDir)) {
      fs.mkdirSync(runDir, { recursive: true });
    }

    const ttsProvider = getTTSProvider();
    const audioResult = await synthesizeStoryboardNarration(storyboard, runDir, ttsProvider);

    // Copy to media runs and dist-remotion so all clients can serve it
    const mediaAudioDir = path.resolve('media/runs', audioRun, 'audio');
    const distDirs = [
      mediaAudioDir,
      path.resolve('dist-remotion/public/audio/runs', audioRun),
      path.resolve('dist-remotion/audio/runs', audioRun),
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
      fullAudioUrl = `/audio/runs/${audioRun}/full-narration.mp3`;
    } catch (concatErr) {
      console.warn('[Pipeline] Full narration concat warning:', concatErr);
    }

    // Build timeline
    const timeline = buildVideoTimeline(storyboard, audioResult.clips, {
      fps: 30,
      audioSrcPrefix: `audio/runs/${audioRun}`,
    });

    // Update session
    if (masterScriptService.getSession(sessionId)?.storyboard !== storyboard) return res.status(409).json({error: 'Script changed while synthesizing. Generate audio for the current revision.'});
    session.stillPreviews = [];
    delete session.visualAssets;
    delete session.motionPreview;
    delete session.storyDirections;
    delete session.voiceoverNeedsRefresh;
    session.renderState = {status: 'idle', progress: 0};
    session.audioResult = {
      ...audioResult,
      fullAudioUrl,
      clips: audioResult.clips.map((c) => ({
        ...c,
        durationSec: Number((c.durationMs / 1000).toFixed(2)),
        url: `/audio/runs/${audioRun}/${path.basename(c.filePath)}`,
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

const stillPreviewJobs = new Set<string>();
type AutomaticVisualJob = {
  progress: AutomaticProgress;
  result?: { status: number; body: object };
};
const automaticVisualJobs = new Map<string, AutomaticVisualJob>();

// 6.5. Generate Still Previews (fast 3-4s visual verification without full render)
app.post('/api/pipeline/stills', async (req, res) => {
  const { sessionId, useSavedDirection, editorFeedback, sceneIndex, sceneIndices, recompileSavedVisuals, visualMode } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required.' });
  }
  if (editorFeedback !== undefined && (typeof editorFeedback !== 'string' || !editorFeedback.trim() || editorFeedback.length > 500 || useSavedDirection === true)) {
    return res.status(400).json({ error: 'Enter up to 500 characters of feedback on the visual plan.' });
  }
  if (recompileSavedVisuals === true && editorFeedback !== undefined) {
    return res.status(400).json({ error: 'Recompiling a saved plan cannot be combined with requesting a new visual plan.' });
  }

  const session = masterScriptService.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  const automatic = visualMode === 'automatic';
  const leavingManual = session.visualAssets?.source === 'manual' && automatic;
  if (session.visualAssets?.source === 'manual' && !leavingManual) {
    return res.status(409).json({ error: 'Use the accepted manual revision, import corrected JSON, or explicitly choose Automatic.' });
  }
  const scope = sceneIndices ?? (sceneIndex === undefined ? undefined : [sceneIndex]);
  if (scope !== undefined && (!Array.isArray(scope) || !scope.length || scope.length > session.storyboard.scenes.length
    || scope.some(index => !Number.isInteger(index) || !session.storyboard.scenes[index])
    || new Set(scope).size !== scope.length || sceneIndex !== undefined && sceneIndices !== undefined || useSavedDirection === true)) {
    return res.status(400).json({ error: 'Select existing, distinct scenes for visual planning.' });
  }

  if (!session.audioResult?.clips?.length) {
    return res.status(400).json({
      error: 'Audio not synthesized yet. Please synthesize voiceover before generating visual previews.',
    });
  }
  const motion = motionPreviewJobs.get(sessionId);
  const activeAutomatic = automaticVisualJobs.get(sessionId);
  if (automatic && stillPreviewJobs.has(sessionId) && activeAutomatic && !activeAutomatic.result
    && !editorFeedback && scope === undefined && !useSavedDirection && !recompileSavedVisuals) {
    return res.status(202).json({ ok: true, automaticProgress: activeAutomatic.progress });
  }
  if (stillPreviewJobs.has(sessionId) || (motion && motion.status !== 'failed')) {
    return res.status(409).json({ error: 'A visual preview is already running.' });
  }
  if (session.renderState?.status === 'rendering') return res.status(409).json({ error: 'Wait for the current video export to finish.' });

  const job: AutomaticVisualJob | undefined = automatic ? {
    progress: { completed: 0, total: session.storyboard.scenes.length, message: 'Preparing the saved visual context…' },
  } : undefined;
  if (job) automaticVisualJobs.set(sessionId, job);
  const reply = (status: number, body: object) => {
    if (job) job.result = { status, body };
    else res.status(status).json(body);
  };
  stillPreviewJobs.add(sessionId);
  const run = async () => {
    try {
      if (automatic && !session.timeline) {
        return reply(409, { error: 'The saved narration timeline is required for automatic visual generation.' });
      }
      if (!session.timeline) {
        session.timeline = buildVideoTimeline(session.storyboard, session.audioResult?.clips || [], {
          fps: 30,
          audioSrcPrefix: `audio/runs/${sessionId}`,
        });
        masterScriptService.updateSession(session);
      }

      const storyboard = session.storyboard;
      const timeline = !automatic && process.env.REEL_VISUAL_PLANNER === 'legacy'
        ? repairOpeningWordFrames(storyboard, session.timeline) : session.timeline;
      session.timeline = timeline;
      const directions = session.storyDirections;
      const isCurrentRevision = () => {
        const current = masterScriptService.getSession(sessionId);
        return current?.storyboard === storyboard && current.timeline === timeline && current.storyDirections === directions;
      };
      const previous = leavingManual ? undefined : session.visualAssets;
      if (scope !== undefined && (previous?.inputRevision !== storyboardVisualInputRevision(storyboard, timeline) ||
        (automatic && previous?.automaticImport?.artifactRevision !== visualArtifactRevision(session)))) {
        return reply(409, { error: 'Generate a visual preview for this script and audio before editing a single scene.' });
      }
      const generated = job ? await prepareAutomaticVisuals(session, {
        scope, feedback: editorFeedback, recompile: recompileSavedVisuals === true || useSavedDirection === true,
        current: isCurrentRevision, progress: progress => { job.progress = progress; },
        saveDraft: draft => {
          session.automaticVisualDraft = draft;
          masterScriptService.updateSession(session);
        },
      }) : undefined;
      const planned = generated?.visuals ?? await prepareStoryboardVisuals(storyboard, timeline, previous, {
        editorFeedback, sceneIndices: scope, recompileSavedVisuals: recompileSavedVisuals === true,
        retryUnresolved: useSavedDirection !== true && !editorFeedback,
      });
      if (!isCurrentRevision()) {
        return reply(409, { error: 'The script or audio changed while preparing visuals.' });
      }
      const previewRun = randomUUID();
      const previewDir = path.resolve('remotion/public/previews', sessionId, previewRun);
      console.log(`[Pipeline] Generating still previews for session ${sessionId}...`);
      const refresh = previous?.inputRevision === planned.inputRevision && session.stillPreviews?.length &&
        (scope ?? (!editorFeedback && useSavedDirection !== true ? previous?.unresolvedScenes : undefined));
      const selected = !automatic && Array.isArray(refresh) && refresh.length
        ? new Set<number>([...refresh, ...planned.shots.flatMap((group, index) => group !== previous?.shots[index] ? [index] : [])]) : undefined;
      const previousStills = session.stillPreviews ?? [];
      if (!automatic && !leavingManual && previous?.fingerprint !== planned.fingerprint) {
        delete session.motionPreview;
        session.stillPreviews = previousStills.filter(still => planned.shots[still.sceneIndex] === previous?.shots[still.sceneIndex]);
      }
      if (!automatic && !leavingManual) {
        session.visualAssets = planned;
        masterScriptService.updateSession(session);
      }
      if (job) job.progress = {
        completed: storyboard.scenes.length, total: storyboard.scenes.length, message: 'Rendering still previews…',
      };
      const { stills: newStills, visuals } = automatic ? {
        stills: await renderStillPreviews(storyboard, timeline, previewDir, `/previews/${sessionId}/${previewRun}`, planned.shots),
        visuals: planned,
      } : await renderReviewedPreviews(
        storyboard,
        timeline,
        planned,
        previewDir,
        `/previews/${sessionId}/${previewRun}`,
        selected,
      );
      const replacedScenes = new Set(newStills.map(still => still.sceneIndex));
      const stills = selected ? [...previousStills.filter(still => !replacedScenes.has(still.sceneIndex)), ...newStills]
        .sort((a, b) => a.sceneIndex - b.sceneIndex || a.frame - b.frame) : newStills;

      if (!isCurrentRevision()) {
        return reply(409, { error: 'The script or audio changed while rendering visual previews.' });
      }
      if (leavingManual && visuals.unresolvedScenes?.length) {
        return reply(422, { error: 'Automatic planning did not complete. The accepted manual preview is still available.',
          planningErrors: visuals.visualPlanningErrors });
      }
      if (previous?.fingerprint !== visuals.fingerprint) delete session.motionPreview;
      if (editorFeedback) delete session.storyDirections;
      session.visualAssets = visuals;
      session.stillPreviews = stills;
      if (automatic) {
        delete session.automaticVisualDraft;
        if (previous?.fingerprint !== visuals.fingerprint) session.renderState = { status: 'idle', progress: 0 };
      }
      masterScriptService.updateSession(session);

      reply(200, {
        ok: true,
        stills,
        ...(generated && { automaticReport: generated.report }),
        visuals: { fingerprint: visuals.fingerprint, source: 'automatic', status: visuals.status, direction: visuals.direction, shotCount: visuals.shots.flat().length,
          visualThread: visuals.visualThread, unresolvedScenes: visuals.unresolvedScenes, review: visuals.review,
          planningErrors: visuals.visualPlanningErrors },
      });
    } catch (err: any) {
      if (err instanceof AutomaticVisualError) return reply(err.status, {
        error: err.message, issues: err.issues, automaticReport: err.report,
      });
      if (err instanceof DirectiveError) return reply(err.status, { error: err.message,
        issues: automatic ? err.issues.map(issue => ({ ...issue,
          resolution: issue.resolution?.replace('reopen Manual mode', 'retry Automatic Groq')
            .replace('use Refresh Context in Advanced Settings', 'retry Automatic Groq'),
        })) : err.issues,
      });
      console.error(`[Pipeline Stills Error]:`, err);
      reply(500, { error: err.message });
    } finally {
      stillPreviewJobs.delete(sessionId);
      if (job) setTimeout(() => {
        if (automaticVisualJobs.get(sessionId) === job) automaticVisualJobs.delete(sessionId);
      }, 15 * 60 * 1000).unref();
    }
  };
  if (job) {
    void run();
    return res.status(202).json({ ok: true, automaticProgress: job.progress });
  }
  await run();
});

app.get('/api/pipeline/stills/:sessionId', (req, res) => {
  const session = masterScriptService.getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  const automatic = automaticVisualJobs.get(session.id);
  res.json({
    stills: session.stillPreviews || [],
    automaticProgress: automatic?.progress,
    automaticResult: automatic?.result,
  });
});

type MotionPreviewJob = {
  status: 'planning' | 'rendering' | 'failed';
  progress: number;
  error?: string;
};
const motionPreviewJobs = new Map<string, MotionPreviewJob>();
const motionPreviewRequest = z.object({
  sessionId: z.string().min(1),
  sceneIndex: z.number().int().nonnegative().default(0),
  scope: z.enum(['scene', 'sequence', 'hook', 'transition', 'ending']).default('sequence'),
  visualRevision: z.string().optional(),
  directions: z.record(z.string().regex(/^\d+-\d+$/), storyDirectionSchema).default({}),
});

function visualDirectiveFailure(res: express.Response, error: unknown) {
  if (error instanceof DirectiveError) return res.status(error.status).json({ error: error.message, issues: error.issues });
  console.error('[Manual Visual Directive]', error);
  return res.status(500).json({ error: 'Could not prepare the manual visuals. The accepted revision is still available.' });
}

app.get('/api/pipeline/visual-source-pack', async (_req, res) => {
  try {
    const files = await visualSourcePack();
    res.json({ files: [...files].map(([name, bytes]) => ({ name, encoding: name.endsWith('.png') ? 'base64' : 'utf8',
      contents: bytes.toString(name.endsWith('.png') ? 'base64' : 'utf8') })) });
  } catch (error) { visualDirectiveFailure(res, error); }
});

app.get('/api/pipeline/visual-source-pack/:name', async (req, res) => {
  try {
    const bytes = (await visualSourcePack()).get(req.params.name);
    if (!bytes) return res.status(404).json({ error: 'Source-pack file not found.' });
    res.attachment(req.params.name).send(bytes);
  } catch (error) { visualDirectiveFailure(res, error); }
});

const importBody = express.text({ type: ['text/plain', 'application/json'], limit: visualDirectiveMaxBytes });
app.post('/api/pipeline/manual-visual/:sessionId/claim', (req, res) => {
  if (!canProvisionLegacySession(req)) return res.status(403).json({ error: 'Operator authorization and a browser owner credential are required.' });
  const session = masterScriptService.getSession(req.params.sessionId);
  if (!session || session.ownerDigest) return res.status(404).json({ error: 'Unowned session not found.' });
  try {
    masterScriptService.updateSession({ ...session, ownerDigest: ownerFor(req, res) }, true);
    res.json({ ok: true });
  } catch (error) { visualDirectiveFailure(res, error); }
});

app.get('/api/pipeline/manual-visual/:sessionId/context', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const session = masterScriptService.getSession(req.params.sessionId);
  if (!session || (session.ownerDigest ? !ownsSession(req, session) : !canAdoptLocalSession(req))) {
    return res.status(404).json({ error: 'Session not found or unavailable for manual import.' });
  }
  try {
    const active = session.ownerDigest ? session : { ...session, ownerDigest: ownerFor(req, res) };
    if (active !== session) masterScriptService.updateSession(active, true);
    res.json(await visualPromptContext(active, await verifiedDirectiveExample()));
  }
  catch (error) { visualDirectiveFailure(res, error); }
});

app.post('/api/pipeline/manual-visual/:sessionId/:action(validate|generate)', (req, res, next) => {
  importBody(req, res, error => {
    if (error) return res.status(413).json({ error: 'Paste a JSON document no larger than 256 KB.' });
    next();
  });
}, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const session = masterScriptService.getSession(req.params.sessionId);
  if (!session || !ownsSession(req, session)) return res.status(404).json({ error: 'Session not found.' });
  const generate = req.params.action === 'generate';
  if (generate && (stillPreviewJobs.has(session.id) || isJobRunning(session.id) || session.renderState?.status === 'rendering'
    || ['planning', 'rendering'].includes(motionPreviewJobs.get(session.id)?.status ?? ''))) {
    return res.status(409).json({ error: 'Wait for the current visual job to finish.' });
  }
  const revision = visualArtifactRevision(session);
  const previous = session.visualAssets;
  const current = () => masterScriptService.getSession(session.id) === session && session.visualAssets === previous
    && visualArtifactRevision(session) === revision;
  if (generate) stillPreviewJobs.add(session.id);
  try {
    const { visuals, strippedFence, focalRepairs, connectorRepairs, layoutWarnings } = await prepareVisualImport(session, req.body, !generate);
    if (!current()) return res.status(409).json({ error: 'The job changed. Copy a fresh visual prompt and try again.' });
    if (!visuals) return res.json({ ok: true, strippedFence, revision, focalRepairs, connectorRepairs, layoutWarnings });
    const previewRun = randomUUID();
    const stills = await renderStillPreviews(session.storyboard, session.timeline,
      path.resolve('remotion/public/previews', session.id, previewRun), `/previews/${session.id}/${previewRun}`, visuals.shots);
    if (!current()) return res.status(409).json({ error: 'The job changed while rendering. The previous preview was preserved.' });
    masterScriptService.updateSession({ ...session, visualAssets: visuals, stillPreviews: stills,
      motionPreview: undefined, storyDirections: undefined, renderState: { status: 'idle', progress: 0 } }, true);
    return res.json({ ok: true, strippedFence, stills, focalRepairs, connectorRepairs, layoutWarnings, visuals: { source: visuals.source, fingerprint: visuals.fingerprint,
      inputRevision: visuals.inputRevision, status: visuals.status, direction: visuals.direction, unresolvedScenes: [] } });
  } catch (error) { return visualDirectiveFailure(res, error); }
  finally { if (generate) stillPreviewJobs.delete(session.id); }
});

app.get('/api/pipeline/motion-preview/:sessionId', (req, res) => {
  const session = masterScriptService.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  res.json({ job: motionPreviewJobs.get(session.id), preview: session.motionPreview });
});

app.put('/api/pipeline/app-screen/:sessionId/:shotId', express.raw({ type: ['image/png', 'image/jpeg'], limit: '5mb' }), async (req, res) => {
  const { sessionId, shotId } = req.params;
  const session = masterScriptService.getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  const preview = session.motionPreview;
  const previewShot = preview?.shots.find(shot => shot.id === shotId && shot.appName);
  const visuals = session.visualAssets;
  const shot = visuals?.shots.flat().find(shot => shot.id === shotId);
  if (!visuals || !previewShot || shot?.kind !== 'device' || shot.appName !== previewShot.appName || shot.scanFrame !== undefined) {
    return res.status(400).json({ error: 'Choose an app shot from the current motion preview.' });
  }
  const hasRunningJob = () => stillPreviewJobs.has(sessionId) || session.renderState?.status === 'rendering' ||
    ['planning', 'rendering'].includes(motionPreviewJobs.get(sessionId)?.status ?? '');
  if (hasRunningJob()) return res.status(409).json({ error: 'Wait for the current render to finish.' });
  const bytes = req.body;
  if (!Buffer.isBuffer(bytes) || bytes.length < 64 ||
      !(bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) || bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')))) {
    return res.status(400).json({ error: 'Choose a PNG or JPEG screenshot.' });
  }
  try {
    const asset = await saveAppScreen(bytes);
    if (session.motionPreview !== preview || session.visualAssets !== visuals || hasRunningJob()) {
      return res.status(409).json({ error: 'The shot changed while saving the capture. Open the current motion preview.' });
    }
    session.visualAssets = reviseVisualAssets(visuals, visuals.shots.map(group => group.map(current =>
      current.id === shotId ? { ...current, asset } : current)));
    delete session.motionPreview;
    delete session.stillPreviews;
    masterScriptService.updateSession(session);
    return res.json({ ok: true });
  } catch (error) {
    console.error('[App screen]', error);
    return res.status(500).json({ error: 'Could not save the screenshot.' });
  }
});

app.post('/api/pipeline/motion-preview', (req, res) => {
  const request = motionPreviewRequest.safeParse(req.body);
  if (!request.success) return res.status(400).json({ error: 'Choose a session and a valid start scene.' });
  const { sessionId, sceneIndex, scope, directions, visualRevision } = request.data;
  const session = masterScriptService.getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  const storyboard = session.storyboard;
  const manual = session.visualAssets?.source === 'manual' ? session.visualAssets : undefined;
  if (manual && (manual.fingerprint !== visualRevision || Object.keys(directions).length
    || manual.manualImport?.artifactRevision !== visualArtifactRevision(session))) {
    return res.status(409).json({ error: 'Select the current accepted manual preview revision.' });
  }
  const automatic = session.visualAssets?.automaticImport ? session.visualAssets : undefined;
  if (automatic && (automatic.fingerprint !== visualRevision || Object.keys(directions).length
    || automatic.automaticImport?.artifactRevision !== visualArtifactRevision(session))) {
    return res.status(409).json({ error: 'Select the current accepted Automatic Groq preview revision.' });
  }
  const timeline = !manual && !automatic && session.timeline && process.env.REEL_VISUAL_PLANNER === 'legacy'
    ? repairOpeningWordFrames(storyboard, session.timeline) : session.timeline;
  const sceneStart = timeline?.segments[sceneIndex]?.startFrame;
  if (!timeline || !session.audioResult || sceneStart === undefined) {
    return res.status(400).json({ error: 'Generate voiceover and select a valid start scene.' });
  }
  const active = motionPreviewJobs.get(sessionId);
  if (active && active.status !== 'failed') return res.status(409).json({ error: 'A motion preview is already running.', job: active });
  if (stillPreviewJobs.has(sessionId)) return res.status(409).json({ error: 'Wait for the still previews to finish.' });
  if (session.renderState?.status === 'rendering') return res.status(409).json({ error: 'Wait for the current video export to finish.' });
  const editedShots = Object.keys(directions);
  if (editedShots.some(id => !session.motionPreview?.shots.some(shot => shot.id === id && ['film', 'image'].includes(shot.kind)))) {
    return res.status(400).json({ error: 'Edit a story shot from the current motion preview.' });
  }
  session.timeline = timeline;
  const mediaUrl = `/media/runs/${sessionId}/motion-${randomUUID()}.mp4`;
  const job: MotionPreviewJob = { status: 'planning', progress: 0 };
  motionPreviewJobs.set(sessionId, job);
  const currentRevision = () => {
    const current = masterScriptService.getSession(sessionId);
    return current?.storyboard === storyboard && current.timeline === timeline;
  };

  void (async () => {
    try {
      const previous = session.visualAssets;
      const visuals = manual ?? automatic ?? await prepareStoryboardVisuals(storyboard, timeline, previous, { directions });
      if (!currentRevision()) return;
      const range = motionFrameRange(timeline, visuals.shots, sceneIndex, scope);
      job.status = 'rendering';
      const rendered = await renderStudioShort({
        storyboard, timeline, visualPlan: visuals.shots,
        outputFilePath: path.resolve(mediaUrl.slice(1)), previewRange: range,
        onProgress: progress => { job.progress = progress.percent; },
      });
      if (!currentRevision()) return;
      session.visualAssets = visuals;
      if (previous?.fingerprint !== visuals.fingerprint) delete session.stillPreviews;
      session.motionPreview = motionPreviewMetadata(storyboard, timeline, visuals, sceneIndex, scope, range, mediaUrl, rendered.durationSec);
      masterScriptService.updateSession(session);
    } catch (error) {
      if (!currentRevision()) return;
      console.error('[Motion Preview]', error);
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Motion preview failed.';
    } finally {
      if (job.status !== 'failed') motionPreviewJobs.delete(sessionId);
    }
  })();
  res.status(202).json({ job });
});

// 7. Video rendering (1080x1920 MP4)
app.post('/api/pipeline/render', async (req, res) => {
  const { sessionId, visualRevision } = req.body;
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

  if (session.renderState?.status === 'rendering') return res.status(409).json({error: 'A render is already running.'});
  if (stillPreviewJobs.has(sessionId)) return res.status(409).json({ error: 'Wait for the still previews to finish.' });
  const previewJob = motionPreviewJobs.get(sessionId);
  if (previewJob && previewJob.status !== 'failed') return res.status(409).json({ error: 'Wait for the motion preview to finish.' });
  const storyboard = session.storyboard;
  const manual = session.visualAssets?.source === 'manual' ? session.visualAssets : undefined;
  if (manual && (manual.fingerprint !== visualRevision || manual.manualImport?.artifactRevision !== visualArtifactRevision(session))) {
    return res.status(409).json({ error: 'Select the current accepted manual preview revision before exporting.' });
  }
  const automatic = session.visualAssets?.automaticImport ? session.visualAssets : undefined;
  if (automatic && (automatic.fingerprint !== visualRevision || automatic.automaticImport?.artifactRevision !== visualArtifactRevision(session))) {
    return res.status(409).json({ error: 'Select the current accepted Automatic Groq preview revision before exporting.' });
  }
  const renderTimeline = !manual && !automatic && process.env.REEL_VISUAL_PLANNER === 'legacy'
    ? repairOpeningWordFrames(storyboard, session.timeline) : session.timeline;
  const saved = session.visualAssets;
  if (visualRevision !== undefined && (!saved || saved.fingerprint !== visualRevision ||
    saved.inputRevision !== storyboardVisualInputRevision(storyboard, renderTimeline))) {
    return res.status(409).json({ error: 'The reviewed visual plan changed. Open the current preview before exporting.' });
  }
  if (visualRevision !== undefined && saved?.unresolvedScenes?.length) {
    return res.status(409).json({ error: 'Resolve the flagged visual scenes before exporting.',
      unresolvedScenes: saved.unresolvedScenes });
  }
  session.timeline = renderTimeline;
  const isCurrentRevision = () => {
    const current = masterScriptService.getSession(sessionId);
    return current?.storyboard === storyboard && current.timeline === renderTimeline;
  };
  const renderFilename = `final-${randomUUID()}.mp4`;
  // Set rendering status
  session.renderState = {
    status: 'rendering',
    progress: 5,
  };
  masterScriptService.updateSession(session);

  const targetMp4Path = path.resolve('media/runs', sessionId, renderFilename);

  // Trigger rendering asynchronously
  (async () => {
    let acceptingProgress = true;
    try {
      console.log(`[Pipeline] Rendering StudioShort for session ${sessionId}...`);
      const planned = visualRevision === undefined ? await prepareStoryboardVisuals(storyboard, renderTimeline, saved) : saved!;
      if (!isCurrentRevision()) return;
      const shouldReview = process.env.REEL_VISUAL_REVIEW_MODEL?.trim() && visualRevision === undefined && !planned.review;
      const previewRun = shouldReview ? randomUUID() : undefined;
      const reviewed = previewRun ? await renderReviewedPreviews(storyboard, renderTimeline, planned,
        path.resolve('remotion/public/previews', session.id, previewRun), `/previews/${session.id}/${previewRun}`) : undefined;
      if (!isCurrentRevision()) return;
      const visuals = reviewed?.visuals ?? planned;
      if (saved?.fingerprint !== visuals.fingerprint) {
        delete session.stillPreviews;
        delete session.motionPreview;
      }
      if (reviewed) session.stillPreviews = reviewed.stills;
      session.visualAssets = visuals;
      masterScriptService.updateSession(session);
      if (visuals.schemaVersion === 'semantic-v1' && visuals.unresolvedScenes?.length) {
        throw new Error(`Resolve visual scenes ${visuals.unresolvedScenes.map(index => index + 1).join(', ')} before exporting.`);
      }
      if (process.env.REEL_VISUAL_REVIEW_MODEL?.trim() && visualRevision === undefined && visuals.review?.status !== 'passed') {
        throw new Error('Visual review needs attention. Inspect the generated previews before approving export.');
      }
      const renderResult = await renderStudioShort({
        storyboard,
        timeline: renderTimeline,
        visualPlan: visuals.shots,
        outputFilePath: targetMp4Path,
        onProgress: (p) => {
          if (!acceptingProgress || !isCurrentRevision()) return;
          session.renderState = {
            status: 'rendering',
            progress: Math.min(99, Math.max(1, Math.round(p.percent))),
          };
          masterScriptService.updateSession(session);
        },
      });
      acceptingProgress = false;

      console.log(`[Pipeline] Video render finished for session ${sessionId}. Running Media QA...`);
      if (!isCurrentRevision()) return;
      const qaReport = performMediaQA(renderResult, renderTimeline);
      if (!qaReport.passed) throw new Error(qaReport.errors.join('. '));

      const mediaUrl = `/media/runs/${sessionId}/${renderFilename}`;
      session.renderState = {
        status: 'completed',
        progress: 100,
        mediaUrl,
        qa: qaReport,
      };
      masterScriptService.updateSession(session);
      console.log(`🎉 [Pipeline] Video ready at ${mediaUrl}!`);
    } catch (err: any) {
      acceptingProgress = false;
      if (!isCurrentRevision()) return;
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
    visuals: session.visualAssets?.shots && {
      status: session.visualAssets.status, direction: session.visualAssets.direction, shotCount: session.visualAssets.shots.flat().length,
    },
  });
});

// 9. Server-Orchestrated Full Reel Generation (Persisted background job)
app.post('/api/pipeline/generate-reel', async (req, res) => {
  try {
    const { topic, angle, sessionId } = req.body;
    let targetSessionId = sessionId;
    const jobId = req.body.jobId || `job_${randomUUID()}`;

    if (!targetSessionId) {
      if (!topic || !topic.trim()) {
        return res.status(400).json({ error: 'Topic is required.' });
      }
      const tempId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      targetSessionId = tempId;
      const initialSession: any = {
        id: tempId,
        ownerDigest: ownerFor(req, res),
        jobId,
        topic: topic.trim(),
        angle: (angle || '').trim(),
        messages: [{ role: 'user', content: `TOPIC: ${topic.trim()}`, timestamp: Date.now() }],
        currentMarkdown: '',
        sections: {},
        storyboard: { topic: topic.trim(), title: topic.trim(), hook: '', learningObjective: '', scenes: [] },
        finalized: false,
        renderState: { status: 'idle', progress: 0 },
        job: {
          id: jobId,
          status: 'running',
          stage: 'scripting',
          progress: 5,
          message: 'Initializing server pipeline job...',
          startedAt: Date.now(),
          updatedAt: Date.now(),
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      masterScriptService.updateSession(initialSession);
    }

    const session = masterScriptService.getSession(targetSessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.visualAssets?.source === 'manual') {
      return res.status(409).json({ error: 'Use the accepted manual visual revision to preview or export this job.' });
    }

    // Initialize or refresh job state
    if (!session.job || session.job.status === 'failed') {
      const activeJobId = session.jobId || session.job?.id || jobId;
      session.jobId = activeJobId;
      session.job = {
        id: activeJobId,
        status: 'running',
        stage: 'scripting',
        progress: 5,
        message: 'Initializing server pipeline job...',
        startedAt: Date.now(),
        updatedAt: Date.now(),
      };
      masterScriptService.updateSession(session);
    }

    // Launch background execution independently of client connection
    runServerPipeline(targetSessionId).catch((err) => {
      console.error(`[Server Pipeline Background Failure][${targetSessionId}]:`, err);
    });

    res.json({
      ok: true,
      sessionId: targetSessionId,
      session,
      job: session.job,
    });
  } catch (err: any) {
    console.error('[Generate Reel Endpoint Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// 10. Pipeline Job & Session Status (Pollable after reload)
app.get('/api/pipeline/status/:sessionId', (req, res) => {
  const session = masterScriptService.getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Resume stalled running job if server process was restarted
  if (
    !authConfig &&
    session.job?.status === 'running' &&
    session.visualAssets?.source !== 'manual' &&
    session.renderState?.status !== 'completed' &&
    !isJobRunning(session.id)
  ) {
    console.log(`[Server Orchestrator] Resuming stalled job for session ${session.id}...`);
    runServerPipeline(session.id).catch((err) => {
      console.error(`[Server Pipeline Resume Failure][${session.id}]:`, err);
    });
  }

  res.json({
    ok: true,
    sessionId: session.id,
    session,
    job: session.job || { status: 'idle', stage: 'scripting', progress: 0, message: '' },
    renderState: session.renderState || { status: 'idle', progress: 0 },
    mediaUrl: session.renderState?.mediaUrl || null,
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
  return validLegacyAutomation(req);
}

// Preview the exact storyboard and its opening voice before committing to a full render.
app.post('/api/previews', async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({error: 'Invalid automation token'});
  const input = z.union([
    z.object({customScript: z.string().min(20).max(40000)}),
    z.object({topic: z.string().min(5).max(200), angle: z.string().optional()}),
  ]).safeParse(req.body);
  if (!input.success) return res.status(400).json({error: 'Enter a topic or a complete script.'});
  try {
    const storyboard = 'customScript' in input.data
      ? await parseCustomScriptToStoryboard(input.data.customScript)
      : await generateHinglishScript({topic: input.data.topic, angle: input.data.angle, targetDurationSec: 105});
    const id = randomUUID();
    const dir = path.resolve('media/previews', id);
    const {clips} = await synthesizeStoryboardNarration(
      {...storyboard, scenes: storyboard.scenes.slice(0,1)}, dir, getTTSProvider(), {align:false}
    );
    res.json({storyboard, audioUrl: `/media/previews/${id}/${path.basename(clips[0].filePath)}`});
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
      angle: z.string().min(3).max(300).optional(),
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
      { id, topic, angle: parsed.data.angle },
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
app.get('/api/queue/status', async (_req, res) => {
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
    if (/^\/(?:api|media|audio|previews|output)(?:\/|$)/i.test(req.path)) {
      return next();
    }
    res.sendFile(path.join(dashboardDist, 'index.html'));
  });
}

// Error middleware
app.use((err: any, _req: any, res: any, next: any) => {
  if (res.headersSent) return next(err);
  if (hostedClosed) {
    if (err.status === 413) return res.status(413).json({ error: 'Request body is too large.' });
    if (err.status === 400) return res.status(400).json({ error: 'Invalid request body.' });
    console.error('[API] Unhandled request error.');
    return res.status(500).json({ error: 'Internal server error.' });
  }
  console.error('[API Error]:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

const port = Number(process.env.PORT || process.env.API_PORT || 4000);
if (authConfig && process.env.NODE_ENV !== 'test') {
  await connectAccounts(authConfig.mongodbUri).then(async () => {
    await Promise.all([initProjects(), initJobs(), initAdmission()]);
    if (trial) await initTrials();
    if (testBilling) await initTestBilling();
  }).catch(() => { throw new Error('SocialStudio database connection failed.'); });
}
export const server =
  process.env.NODE_ENV === 'test'
    ? null
    : app.listen(port, process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1', () => {
        console.log(`🚀 SocialStudio API running at http://localhost:${port}`);
        if (authConfig && process.env.REDIS_URL && (generation || process.env.REDIS_HEALTH_CHECK === 'true')) redisHealth = monitorRedis(connection);
        if (hostedClosed) return;

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

if (hostedClosed && server) {
  const stop = () => {
    if (draining) return;
    draining = true;
    redisHealth?.stop();
    const deadline = setTimeout(() => server.closeAllConnections(), 10_000);
    deadline.unref();
    server.close(async () => {
      clearTimeout(deadline);
      if (authConfig) {
        connection.disconnect();
        await Promise.allSettled([queue.close(), pool.end(), mongoose.disconnect()]);
      }
      console.log('[API] Shutdown complete.');
    });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

export default app;
