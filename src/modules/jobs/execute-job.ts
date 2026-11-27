import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import mongoose from 'mongoose';
import { masterScriptService, type ScriptSession } from '../ai-script/master-script-service.js';
import { getProject, replaceProject } from '../projects/repository.js';
import { performMediaQA } from '../qa/media-qa.js';
import { prepareAutomaticVisuals } from '../render/automatic-visual-directives.js';
import { removeHostedBundleNarration, renderStillPreviews, renderStudioShort } from '../render/video-renderer.js';
import type { PrivateMedia } from '../storage/private-media.js';
import { getTTSProvider, synthesizeStoryboardNarration } from '../tts/tts-service.js';
import { findFfmpeg } from '../tts/sarvam-provider.js';
import { buildVideoTimeline, type VideoTimeline } from '../video/timeline.js';
import { settleGeneration } from './admission.js';
import { claimJob, executionCheckpoint, finishExecution, reviewExecution, updateJobLease, type ExecutionInput, type ExecutionQuote, type StudioOperation } from './durable-jobs.js';
import { narrationBindings, publishJobMedia, type MediaBinding } from './project-media.js';
import { createProviderScope, withProviderScope } from './provider-guard.js';
import { generationPaused } from './generation-control.js';

type Inputs = {
  session: ScriptSession; operation: StudioOperation; root: string;
  storage: PrivateMedia; media: MediaBinding[]; publish(source: string, file: string): Promise<void>;
  input?: ExecutionInput;
};

async function executeStage({ session, operation, root, storage, media, publish, input }: Inputs) {
  if (operation === 'script') {
    return masterScriptService.buildGeneratedSession(session.topic, session.angle, session);
  }
  if (operation === 'audio') {
    if (!session.finalized) throw new Error('Approve the script before generating narration.');
    const provider = getTTSProvider();
    if (!['sarvam', 'elevenlabs'].includes(provider.name) || !process.env.GROQ_API_KEY) {
      throw new Error('Hosted narration and alignment providers must be configured.');
    }
    const audio = await synthesizeStoryboardNarration(session.storyboard, root, provider, { requireWhisper: true });
    if (audio.clips.some(clip => !clip.wordTimestamps?.length)) throw new Error('Narration alignment is incomplete.');
    const prefix = `audio/runs/${session.id}/hosted-${path.basename(root)}`;
    session.timeline = buildVideoTimeline(session.storyboard, audio.clips, { fps: 30, audioSrcPrefix: prefix });
    const concat = path.join(root, 'concat.txt');
    const full = path.join(root, 'full-narration.mp3');
    await writeFile(concat, audio.clips.map(clip => `file '${path.basename(clip.filePath)}'`).join('\n'));
    await promisify(execFile)(findFfmpeg(), ['-nostdin', '-f', 'concat', '-safe', '1', '-i', concat, '-c', 'copy', full]);
    const fullAudioUrl = `/${prefix}/full-narration.mp3`;
    await publish(fullAudioUrl, full);
    session.audioResult = { ...audio, fullAudioUrl, clips: await Promise.all(audio.clips.map(async ({ filePath, ...clip }) => {
      const url = `/${prefix}/${path.basename(filePath)}`;
      await publish(url, filePath);
      return { ...clip, url };
    })) };
    delete session.voiceoverNeedsRefresh;
    delete session.visualAssets;
    delete session.automaticVisualDraft;
    delete session.stillPreviews;
    delete session.motionPreview;
    session.renderState = { status: 'idle', progress: 0 };
  } else if (operation === 'visuals') {
    const verified = narrationBindings(media, storage);
    const checks = new Map<string, Promise<void>>();
    const result = await prepareAutomaticVisuals(session, { feedback: input?.feedback,
      scope: input?.sceneIndex === undefined ? undefined : [input.sceneIndex], verifyNarration: source => {
      if (!checks.has(source)) checks.set(source, verified(source));
      return checks.get(source)!;
    } });
    session.visualAssets = result.visuals;
    delete session.automaticVisualDraft;
    delete session.stillPreviews;
    delete session.motionPreview;
    session.renderState = { status: 'idle', progress: 0 };
  } else if (operation === 'stills' || operation === 'render') {
    const timeline = session.timeline as VideoTimeline | undefined;
    const visualPlan = session.visualAssets?.shots;
    if (!timeline || !visualPlan || session.voiceoverNeedsRefresh || !storage.get) {
      throw new Error('Save narration and validated visuals before rendering.');
    }
    const keys = new Map(media.map(binding => [binding.source, binding.key]));
    // Use a lease-local directory and fresh bundle paths, including for legacy audio imported from storage.
    const audioPrefix = `audio/runs/hosted-${path.basename(root)}`;
    const audioDir = path.join(root, audioPrefix);
    await mkdir(audioDir, { recursive: true });
    const segments = await Promise.all(timeline.segments.map(async (segment, index) => {
      const key = keys.get(`/${segment.audioSrc}`);
      if (!key) throw new Error('A stored narration clip is unavailable.');
      const file = `scene-${index}.mp3`;
      await storage.get!(key, path.join(audioDir, file));
      return { ...segment, audioSrc: `${audioPrefix}/${file}` };
    }));
    const hydrated = { ...timeline, segments };
    if (operation === 'stills') {
      const stills = await renderStillPreviews(session.storyboard, hydrated, root,
        `/previews/${session.id}/${path.basename(root)}`, visualPlan, undefined, root);
      session.stillPreviews = await Promise.all(stills.map(async ({ filePath, motionFrames, ...still }) => {
        if (!filePath) throw new Error('A still preview was not written.');
        await publish(still.url, filePath);
        return { ...still, motionFrames: await Promise.all((motionFrames ?? []).map(async ({ filePath: file, ...frame }) => {
          if (!file) throw new Error('A motion frame was not written.');
          await publish(frame.url, file);
          return frame;
        })) };
      }));
    } else {
      const result = await renderStudioShort({ storyboard: session.storyboard, timeline: hydrated,
        visualPlan, narrationRoot: root, outputFilePath: path.join(root, 'final.mp4') });
      const qa = performMediaQA(result, hydrated);
      if (!qa.passed) throw new Error('The rendered artifact did not pass media QA.');
      const mediaUrl = `/media/runs/${session.id}/${path.basename(root)}.mp4`;
      await publish(mediaUrl, result.outputFilePath);
      session.renderState = { status: 'completed', progress: 100, mediaUrl, qa };
    }
  } else {
    throw new Error('Unsupported hosted stage.');
  }
  return session;
}

export async function executeStudioJob(id: string, storage: PrivateMedia, options?: {
  transport?: typeof fetch; authorized?: (ownerId: string, operation: StudioOperation) => Promise<boolean>;
}) {
  if (await generationPaused()) return;
  const job = await claimJob(id);
  if (!job?.leaseId || !job.quote) return;
  const { leaseId } = job;
  const quote = job.quote as ExecutionQuote;
  const reservedDay = job.createdAt.toISOString().slice(0, 10);
  const provider = createProviderScope(id, leaseId, quote, reservedDay, options?.transport);
  const heartbeat = setInterval(() => void updateJobLease(id, leaseId, 'renew').catch(() => undefined), 15_000);
  const start = performance.now();
  const cpu = process.cpuUsage();
  let peakRssBytes = process.memoryUsage.rss();
  const memorySample = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage.rss()); }, 250);
  let root: string | undefined;
  try {
    if (options?.authorized && !await options.authorized(job.ownerId, job.operation as StudioOperation)) {
      throw new Error('The execution is no longer authorized.');
    }
    const project = await getProject(job.ownerId, job.projectId);
    if (!project || project.revision !== job.revision) throw new Error('The reserved project revision is stale.');
    if (new Date().toISOString().slice(0, 10) !== reservedDay) throw new Error('The reserved spending window expired.');
    root = await mkdtemp(path.join(os.tmpdir(), 'studio-'));
    const media = project.media.flatMap(entry => entry.source && entry.key ? [{ source: entry.source, key: entry.key }] : []);
    await executionCheckpoint(id, leaseId, 'executing');
    provider.costs.compute = quote.computeMicros;
    const session = await withProviderScope(provider, () => executeStage({
      session: project.session, operation: job.operation as StudioOperation, root: root!, storage, media, input: job.input,
      publish: async (source, file) => { media.push(await publishJobMedia(storage, id, leaseId, source, file)); },
    }));
    if (provider.requiresReview()) throw new Error('Provider outcome requires reconciliation.');
    session.updatedAt = Date.now();
    const referenced = JSON.stringify(session);
    const relevant = media.filter(binding => referenced.includes(JSON.stringify(binding.source)) ||
      session.timeline?.segments.some((segment: { audioSrc: string }) => `/${segment.audioSrc}` === binding.source));
    await executionCheckpoint(id, leaseId, 'artifacts-stored');
    const { user, system } = process.cpuUsage(cpu);
    const metrics = { elapsedMs: Math.round(performance.now() - start), nodeCpuMs: (user + system) / 1000,
      peakNodeRssBytes: Math.max(peakRssBytes, process.memoryUsage.rss()) };
    const cost = Object.values(provider.costs).reduce((sum, amount) => sum + amount, 0);
    await mongoose.connection.transaction(async transaction => {
      if (!await replaceProject(job.ownerId, session, job.revision, transaction, relevant)) throw new Error('Project changed during generation.');
      await finishExecution(id, leaseId, transaction, metrics);
      if (!await settleGeneration(id, cost, true, transaction, provider.costs)) throw new Error('Missing held reservation.');
    });
  } catch {
    if (provider.requiresReview()) {
      await reviewExecution(id, leaseId);
    } else {
      const cost = Object.values(provider.costs).reduce((sum, amount) => sum + amount, 0);
      await mongoose.connection.transaction(async transaction => {
        await finishExecution(id, leaseId, transaction);
        if (!await settleGeneration(id, cost, false, transaction, provider.costs)) throw new Error('Missing held reservation.');
      });
    }
  } finally {
    clearInterval(heartbeat);
    clearInterval(memorySample);
    if (root) {
      if (job.operation === 'stills' || job.operation === 'render') {
        await removeHostedBundleNarration(`hosted-${path.basename(root)}`).catch(() => console.warn('[Studio worker] Could not clean staged narration.'));
      }
      await rm(root, { recursive: true, force: true });
    }
  }
}
