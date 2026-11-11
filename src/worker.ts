import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { Worker, Job } from 'bullmq';
import { pool, connection, queue, patch, StoryboardSchema, type Storyboard } from './core.js';
import { generateHinglishScript } from './modules/ai-script/script-generator.js';
import { synthesizeStoryboardNarration } from './modules/tts/tts-service.js';
import { buildVideoTimeline } from './modules/video/timeline.js';
import { renderStudioShort } from './modules/render/video-renderer.js';
import { performMediaQA } from './modules/qa/media-qa.js';

export interface VideoJobData {
  id: string;
}

export const worker = new Worker<VideoJobData>(
  'shorts',
  async (job: Job<VideoJobData>) => {
    const id = job.data.id;
    console.log(`[Worker] Started processing video job ${id}...`);

    try {
      const { rows } = await pool.query('SELECT * FROM videos WHERE id=$1', [id]);
      if (!rows[0]) {
        throw new Error(`Video with ID ${id} not found in database`);
      }

      const row = rows[0];
      if (row.status === 'APPROVED' || row.status === 'READY_FOR_REVIEW') {
        console.log(`[Worker] Video ${id} is already in state '${row.status}'. Skipping.`);
        return;
      }

      // ==========================================
      // STAGE 1: SCRIPT GENERATION
      // ==========================================
      await patch(id, { status: 'SCRIPTING', error: null });
      await job.updateProgress(10);
      console.log(`[Worker:${id}] [Stage 1] Scripting topic: "${row.topic}"...`);

      let storyboard: Storyboard;
      if (row.script) {
        const parsed = StoryboardSchema.safeParse(row.script);
        if (parsed.success) {
          console.log(`[Worker:${id}] Using existing storyboard from database.`);
          storyboard = parsed.data;
        } else {
          console.warn(`[Worker:${id}] Existing script invalid; regenerating with AI...`);
          storyboard = await generateHinglishScript({ topic: row.topic, targetDurationSec: 55 });
        }
      } else {
        storyboard = await generateHinglishScript({ topic: row.topic, targetDurationSec: 55 });
      }

      await patch(id, {
        script: storyboard,
        title: storyboard.title,
        status: 'NARRATING',
      });
      await job.updateProgress(25);

      // ==========================================
      // STAGE 2: VOICE SYNTHESIS (EDGE-TTS / ELEVENLABS)
      // ==========================================
      console.log(`[Worker:${id}] [Stage 2] Synthesizing audio for ${storyboard.scenes.length} scenes...`);
      const runDir = path.resolve('media/runs', id);
      if (!fs.existsSync(runDir)) {
        fs.mkdirSync(runDir, { recursive: true });
      }

      const audioResult = await synthesizeStoryboardNarration(storyboard, runDir);
      console.log(`[Worker:${id}] Audio synthesized: ${audioResult.totalDurationSec}s total across ${audioResult.clips.length} scenes.`);

      // Copy audio clips to remotion public dir and pre-bundled dist-remotion dir for browser serving
      const targetDirs = [
        path.resolve('remotion/public/audio/runs', id),
        path.resolve('dist-remotion/public/audio/runs', id),
        path.resolve('dist-remotion/audio/runs', id),
      ];
      for (const dir of targetDirs) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }
      for (const clip of audioResult.clips) {
        for (const dir of targetDirs) {
          const dest = path.join(dir, path.basename(clip.filePath));
          fs.copyFileSync(clip.filePath, dest);
        }
      }

      const fullNarrationText = storyboard.scenes.map((s) => s.narration).join(' ');
      await patch(id, {
        narration: fullNarrationText,
        audio_seconds: audioResult.totalDurationSec,
        status: 'RENDERING',
      });
      await job.updateProgress(45);

      // ==========================================
      // STAGE 3: TIMELINE & MOTION GRAPHICS RENDERING
      // ==========================================
      console.log(`[Worker:${id}] [Stage 3] Calculating frame timeline...`);
      const timeline = buildVideoTimeline(storyboard, audioResult.clips, {
        fps: 30,
        scenePaddingFrames: 14,
        audioSrcPrefix: `audio/runs/${id}`,
      });

      console.log(`[Worker:${id}] Timeline: ${timeline.totalDurationInFrames} frames (${timeline.totalDurationSec}s @ 30 fps).`);
      const targetMp4Path = path.resolve('media/runs', id, 'final-short.mp4');

      console.log(`[Worker:${id}] Rendering composition StudioShort to ${targetMp4Path}...`);
      const renderResult = await renderStudioShort({
        storyboard,
        timeline,
        outputFilePath: targetMp4Path,
        onProgress: (p) => {
          const overallProgress = 45 + Math.round(p.percent * 0.45); // 45% -> 90%
          job.updateProgress(overallProgress);
        },
      });

      console.log(`[Worker:${id}] Render completed in ${(renderResult.renderTimeMs / 1000).toFixed(1)}s (${(renderResult.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB).`);
      await job.updateProgress(90);

      // ==========================================
      // STAGE 4: AUTOMATED MEDIA QA PIPELINE
      // ==========================================
      console.log(`[Worker:${id}] [Stage 4] Running Media QA verification...`);
      const qaReport = performMediaQA(renderResult, timeline);
      if (!qaReport.passed) {
        const failures = qaReport.checks.filter((c) => !c.passed).map((c) => `${c.name}: ${c.details}`).join('; ');
        throw new Error(`Media QA Verification Failed: ${failures}`);
      }

      console.log(`[Worker:${id}] Media QA PASSED! (Duration: ${qaReport.durationSec}s, SHA256: ${renderResult.sha256.slice(0, 16)}...)`);
      await job.updateProgress(98);

      // ==========================================
      // STAGE 5: STORE RESULTS & MARK READY
      // ==========================================
      const mediaPublicUrl = `/media/runs/${id}/final-short.mp4`;
      await patch(id, {
        status: 'READY_FOR_REVIEW',
        media_path: mediaPublicUrl,
        qa_report: qaReport,
        error: null,
      });

      await job.updateProgress(100);
      console.log(`🎉 [Worker:${id}] Video successfully produced and ready for review at ${mediaPublicUrl}`);
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`❌ [Worker:${id}] Job failed:`, errorMsg);
      await patch(id, {
        status: 'FAILED',
        error: errorMsg,
      });
      throw err;
    }
  },
  {
    connection,
    concurrency: 1, // Single video at a time for deterministic GPU/CPU allocation
    lockDuration: 600000, // 10 minutes lock duration for video rendering
    lockRenewTime: 30000, // Renew lock every 30s
    stalledInterval: 120000, // 2 minutes check interval
    maxStalledCount: 3,
  }
);

worker.on('ready', async () => {
  console.log('🚀 [Worker] BullMQ Worker ready to process video jobs (Queue: "shorts", Concurrency: 1)');
  try {
    const activeJobs = await queue.getActive();
    for (const j of activeJobs) {
      console.log(`[Worker Startup] Clearing orphaned active job ${j.id} from previous container`);
      try {
        await j.moveToFailed(new Error('Job interrupted by container restart'), '0', true);
      } catch (e: any) {
        console.warn(`[Worker Startup] Could not fail job ${j.id}:`, e.message);
      }
    }
  } catch (err: any) {
    console.warn('[Worker Startup] Failed to check active jobs:', err.message);
  }
});

worker.on('error', (err) => {
  console.error('❌ [Worker] Worker level error:', err);
});

worker.on('failed', async (job, err) => {
  console.error(`❌ [Worker] Job ${job?.id} failed with error:`, err.message);
  if (job?.data?.id) {
    try {
      await patch(job.data.id, {
        status: 'FAILED',
        error: err.message || 'Video generation job failed or stalled in queue',
      });
    } catch (e: any) {
      console.error(`Failed to update DB on job failure:`, e.message);
    }
  }
});
