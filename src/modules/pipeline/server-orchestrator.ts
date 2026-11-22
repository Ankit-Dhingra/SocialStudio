import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { masterScriptService, ScriptSession } from '../ai-script/master-script-service.js';
import { getTTSProvider, synthesizeStoryboardNarration } from '../tts/tts-service.js';
import { buildVideoTimeline } from '../video/timeline.js';
import { renderStillPreviews, renderStudioShort } from '../render/video-renderer.js';
import { prepareReelVisuals } from '../render/reel-visual-assets.js';
import { performMediaQA } from '../qa/media-qa.js';

export interface PipelineJob {
  id?: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  stage: 'scripting' | 'finalizing' | 'synthesizing' | 'stills' | 'rendering' | 'completed';
  progress: number;
  message: string;
  error?: string;
  mediaUrl?: string;
  qa?: any;
  startedAt: number;
  updatedAt: number;
}

const activeJobs = new Set<string>();

export function isJobRunning(sessionId: string): boolean {
  return activeJobs.has(sessionId);
}

export async function runServerPipeline(sessionId: string): Promise<ScriptSession> {
  if (activeJobs.has(sessionId)) {
    console.log(`[Server Orchestrator] Job for session ${sessionId} is already active.`);
    const s = masterScriptService.getSession(sessionId);
    if (!s) throw new Error(`Session ${sessionId} not found`);
    return s;
  }

  activeJobs.add(sessionId);
  let currentJobId = '';

  try {
    let session = masterScriptService.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    currentJobId = session.job?.id || session.jobId || `job_${randomUUID()}`;
    session.jobId = currentJobId;

    const updateJob = (stage: PipelineJob['stage'], progress: number, message: string) => {
      session = masterScriptService.getSession(sessionId)!;
      session.jobId = session.jobId || currentJobId;
      session.job = {
        id: session.job?.id || session.jobId || currentJobId,
        status: 'running',
        stage,
        progress,
        message,
        startedAt: session.job?.startedAt || Date.now(),
        updatedAt: Date.now(),
      };
      masterScriptService.updateSession(session);
      console.log(`[Server Orchestrator][${sessionId}] Stage: ${stage} (${progress}%) - ${message}`);
    };

    // 1. Scripting Stage (Generate Initial Draft if missing)
    if (!session.finalized && !session.currentMarkdown?.trim()) {
      updateJob('scripting', 10, 'Generating Master Script via AI...');
      const full = await masterScriptService.startScriptSession(session.topic, session.angle, session.id);
      session = masterScriptService.getSession(sessionId)!;
      session.currentMarkdown = full.currentMarkdown;
      session.sections = full.sections;
      session.storyboard = full.storyboard;
      session.messages = full.messages;
      session.jobId = currentJobId;
      masterScriptService.updateSession(session);
    }

    // 2. Finalizing Stage (Lock typed scenes without customMarkdown)
    if (!session.finalized) {
      updateJob('finalizing', 25, 'Finalizing Storyboard scenes...');
      session = await masterScriptService.finalizeScript(session.id);
    }

    // 3. Audio Synthesis Stage
    if (!session.audioResult?.clips?.length || !session.timeline) {
      updateJob('synthesizing', 40, 'Synthesizing the finalized narration...');
      const audioRun = randomUUID();
      const audioDir = path.resolve('remotion/public/audio/runs', session.id, audioRun);
      fs.mkdirSync(audioDir, { recursive: true });

      const storyboard = session.storyboard;
      const audioResult = await synthesizeStoryboardNarration(storyboard, audioDir, getTTSProvider());
      if (masterScriptService.getSession(sessionId)?.storyboard !== storyboard) {
        throw new Error('The finalized script changed while generating voiceover. Start the reel again.');
      }
      const timeline = buildVideoTimeline(storyboard, audioResult.clips, {
        fps: 30,
        audioSrcPrefix: `audio/runs/${session.id}/${audioRun}`,
      });

      const sId = session.id;
      session.audioResult = {
        ...audioResult,
        fullAudioUrl: `/audio/runs/${sId}/${audioRun}/full-narration.mp3`,
        clips: audioResult.clips.map((c) => ({
          ...c,
          url: `/audio/runs/${sId}/${audioRun}/${path.basename(c.filePath)}`,
        })),
      };
      session.timeline = timeline;
      delete session.voiceoverNeedsRefresh;
      delete session.stillPreviews;
      delete session.visualAssets;
      session.renderState = { status: 'idle', progress: 0 };
      masterScriptService.updateSession(session);
    }

    const storyboard = session.storyboard;
    const timeline = session.timeline;
    const isCurrentRevision = () => {
      const current = masterScriptService.getSession(sessionId);
      return current?.storyboard === storyboard && current.timeline === timeline;
    };

    // 4. Stills Previews Stage
    if (!session.visualAssets?.shots || !session.stillPreviews?.length) {
      updateJob('stills', 60, 'Creating scene artwork and rendering previews...');
      const visuals = await prepareReelVisuals(storyboard, timeline, session.visualAssets);
      const previewDir = path.resolve('remotion/public/previews', session.id);
      fs.mkdirSync(previewDir, { recursive: true });

      const stills = await renderStillPreviews(
        storyboard,
        timeline,
        previewDir,
        `/previews/${session.id}`,
        visuals.shots,
      );
      if (!isCurrentRevision()) throw new Error('The finalized script or audio changed while preparing previews. Start the reel again.');
      session.visualAssets = visuals;
      session.stillPreviews = stills;
      masterScriptService.updateSession(session);
    }

    // 5. Video Rendering Stage (1080x1920 MP4)
    if (session.renderState?.status !== 'completed' || !session.renderState?.mediaUrl) {
      updateJob('rendering', 70, 'Starting Remotion 1080x1920 MP4 Video render...');

      const renderFilename = `final-${randomUUID()}.mp4`;
      const targetMp4Path = path.resolve('media/runs', session.id, renderFilename);
      fs.mkdirSync(path.dirname(targetMp4Path), { recursive: true });

      session.renderState = {
        status: 'rendering',
        progress: 5,
      };
      masterScriptService.updateSession(session);

      const renderResult = await renderStudioShort({
        storyboard,
        timeline,
        visualPlan: session.visualAssets?.shots,
        outputFilePath: targetMp4Path,
        onProgress: (p) => {
          if (!isCurrentRevision()) return;
          const percent = Math.min(99, Math.max(1, Math.round(p.percent)));
          session = masterScriptService.getSession(sessionId)!;
          session.renderState = {
            status: 'rendering',
            progress: percent,
          };
          session.job = {
            status: 'running',
            stage: 'rendering',
            progress: 70 + Math.round(percent * 0.28),
            message: `Rendering 1080x1920 MP4 video... ${percent}%`,
            startedAt: session.job?.startedAt || Date.now(),
            updatedAt: Date.now(),
          };
          masterScriptService.updateSession(session);
        },
      });

      if (!isCurrentRevision()) throw new Error('The finalized script or audio changed while rendering. Start the reel again.');
      console.log(`[Server Orchestrator] Video render finished for ${sessionId}. Running Media QA...`);
      const qaReport = performMediaQA(renderResult, timeline);
      if (!qaReport.passed) {
        throw new Error(`Media QA validation failed: ${qaReport.errors.join('. ')}`);
      }

      const mediaUrl = `/media/runs/${session.id}/${renderFilename}`;
      session.renderState = {
        status: 'completed',
        progress: 100,
        mediaUrl,
        qa: qaReport,
      };
      masterScriptService.updateSession(session);
    }

    // 6. Complete
    session = masterScriptService.getSession(sessionId)!;
    session.jobId = session.jobId || currentJobId;
    session.job = {
      id: session.job?.id || session.jobId || currentJobId,
      status: 'completed',
      stage: 'completed',
      progress: 100,
      message: 'Reel ready! 1080x1920 MP4 delivered.',
      mediaUrl: session.renderState?.mediaUrl,
      qa: session.renderState?.qa,
      startedAt: session.job?.startedAt || Date.now(),
      updatedAt: Date.now(),
    };
    masterScriptService.updateSession(session);
    console.log(`🎉 [Server Orchestrator] Reel generation completed for session ${sessionId}! Media: ${session.renderState?.mediaUrl}`);
    return session;
  } catch (err: any) {
    console.error(`❌ [Server Orchestrator Error][${sessionId}]:`, err);
    const session = masterScriptService.getSession(sessionId);
    if (session) {
      session.jobId = session.jobId || currentJobId;
      session.job = {
        id: session.job?.id || session.jobId || currentJobId,
        status: 'failed',
        stage: 'failed',
        progress: 0,
        error: err.message || String(err),
        message: `Pipeline failed: ${err.message || String(err)}`,
        startedAt: session.job?.startedAt || Date.now(),
        updatedAt: Date.now(),
      };
      if (session.renderState?.status === 'rendering') {
        session.renderState = {
          status: 'failed',
          progress: 0,
          error: err.message || String(err),
        };
      }
      masterScriptService.updateSession(session);
    }
    throw err;
  } finally {
    activeJobs.delete(sessionId);
  }
}
