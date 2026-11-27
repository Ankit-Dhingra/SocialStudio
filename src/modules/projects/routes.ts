import { Router, json, text, type Request, type Response, type NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { masterScriptService, type ScriptSession } from '../ai-script/master-script-service.js';
import { sessionIdPattern } from '../pipeline/session-owner.js';
import { DirectiveError, prepareVisualImport, visualArtifactRevision, visualDirectiveMaxBytes, visualPromptContext } from '../render/visual-directives.js';
import { verifiedDirectiveExample, visualSourcePack } from '../render/visual-source-pack.js';
import { archiveProject, createProject, getProject, listProjects, replaceProject } from './repository.js';
import type { PrivateMedia } from '../storage/private-media.js';
import { admitGeneration, hasHeldGeneration } from '../jobs/admission.js';
import { quoteBound, type ExecutionConfig } from '../jobs/execution-config.js';
import { narrationBindings } from '../jobs/project-media.js';
import { getOwnedJob, studioJobId } from '../jobs/durable-jobs.js';
import { generationPaused } from '../jobs/generation-control.js';

const pasteInput = z.object({ customScript: z.union([z.string().min(1), z.record(z.string(), z.unknown())]),
  topic: z.string().max(300).optional(), sessionId: z.string().regex(sessionIdPattern).optional() }).strict();
const finalizeInput = z.object({ sessionId: z.string().regex(sessionIdPattern), customMarkdown: z.string().optional() }).strict();

async function present(session: ScriptSession, media: { source?: string | null; key?: string | null }[], storage?: PrivateMedia) {
  const links = new Map<string, string>();
  if (storage) for (const entry of media) {
    if (entry.source && entry.key) links.set(entry.source, await storage.url(entry.key));
  }
  return JSON.parse(JSON.stringify(session, (key, value) => {
    if (key === 'filePath' || key === 'ownerDigest') return undefined;
    if (typeof value === 'string' && /^\/(?:media|audio|previews|output)\//.test(value)) return links.get(value);
    return value;
  }));
}

function handle(action: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    action(req, res).catch((error: unknown) => {
      if (error instanceof DirectiveError) {
        res.status(error.status).json({ error: error.message, issues: error.issues });
      } else next(error);
    });
  };
}

export function projectRouter(storage?: PrivateMedia, generation?: ExecutionConfig) {
  const router = Router();
  const owner = (res: Response): string => res.locals.studioAccount.clerkUserId;
  const verifyNarration = (item: NonNullable<Awaited<ReturnType<typeof getProject>>>) => narrationBindings(item.media, storage);

  const executionInput = z.discriminatedUnion('operation', [
    z.object({ operation: z.literal('script'), topic: z.string().trim().min(1).max(300), angle: z.string().trim().max(300).optional() }).strict(),
    z.object({ operation: z.literal('refine'), projectId: z.string().regex(sessionIdPattern), revision: z.number().int().nonnegative(),
      instruction: z.string().trim().min(1).max(700) }).strict(),
    z.object({ operation: z.literal('motion'), projectId: z.string().regex(sessionIdPattern), revision: z.number().int().nonnegative(),
      visualRevision: z.string().max(128), sceneIndex: z.number().int().nonnegative(),
      scope: z.enum(['scene', 'sequence', 'hook', 'transition', 'ending']) }).strict(),
    z.object({ operation: z.literal('visuals'), projectId: z.string().regex(sessionIdPattern), revision: z.number().int().nonnegative(),
      feedback: z.string().trim().min(1).max(500).optional(), sceneIndex: z.number().int().nonnegative().optional() }).strict(),
    z.object({ operation: z.enum(['audio', 'stills', 'render']), projectId: z.string().regex(sessionIdPattern),
      revision: z.number().int().nonnegative(), visualRevision: z.string().max(128).optional() }).strict(),
  ]);

  router.post('/jobs', json({ limit: '4kb' }), handle(async (req, res) => {
    const parsed = executionInput.safeParse(req.body);
    const requestId = req.get('Idempotency-Key');
    if (!parsed.success || !requestId || !/^[\w-]{16,100}$/.test(requestId)) {
      return res.status(400).json({ error: 'Provide a valid operation, project revision and idempotency key.' });
    }
    const input = parsed.data;
    const { operation } = input;
    const quote = generation?.operations[operation];
    if (!storage || !generation || !quote) return res.status(503).json({ error: 'This generation operation is disabled.' });
    const ownerId = owner(res);
    const projectId = input.operation === 'script'
      ? `session_${createHash('sha256').update(JSON.stringify([ownerId, requestId])).digest('hex')}`
      : input.projectId;
    const revision = input.operation === 'script' ? 0 : input.revision;
    const id = studioJobId(ownerId, projectId, operation, revision, requestId);
    if (await getOwnedJob(ownerId, id)) return res.status(202).json({ id, projectId });
    if (await generationPaused()) return res.status(503).json({ error: 'Generation is paused.' });
    if (await hasHeldGeneration(ownerId)) {
      if (await getOwnedJob(ownerId, id)) return res.status(202).json({ id, projectId });
      return res.status(409).json({ error: 'Another generation is pending.' });
    }
    const project = await getProject(ownerId, projectId);
    let draft: ScriptSession | undefined;
    if (!project && input.operation === 'script') {
      draft = await masterScriptService.buildCustomSession(input.topic, input.topic, undefined, input.angle, projectId);
      draft.topic = input.topic;
      draft.angle = input.angle;
      draft.finalized = false;
    }
    if (!project && !draft) return res.status(404).json({ error: 'Session not found.' });
    if (project && project.revision !== revision) return res.status(409).json({ error: 'The project changed. Reload it before generating.' });
    if ((operation === 'audio' && !project?.session.finalized) ||
        (operation === 'visuals' && (!project?.session.timeline || project.session.voiceoverNeedsRefresh))) {
      return res.status(409).json({ error: 'Complete the preceding stage before generating.' });
    }
    if (input.operation === 'visuals' && input.sceneIndex !== undefined && input.sceneIndex >= (project?.scenesCount ?? 0)) {
      return res.status(400).json({ error: 'The requested scene does not exist.' });
    }
    if (input.operation === 'motion' && input.sceneIndex >= (project?.scenesCount ?? 0)) {
      return res.status(400).json({ error: 'The requested scene does not exist.' });
    }
    if (input.operation === 'stills' || input.operation === 'render' || input.operation === 'motion') {
      const visuals = project?.session.visualAssets;
      if (!visuals?.shots || visuals.fingerprint !== input.visualRevision) {
        return res.status(409).json({ error: 'Review the current visual revision before rendering.' });
      }
    }
    try {
      await admitGeneration({ ownerId, projectId, operation, revision, requestId, credits: quote.credits,
        provider: 'compute', boundMicros: quoteBound(quote), quote, draft,
        input: input.operation === 'visuals' ? { feedback: input.feedback, sceneIndex: input.sceneIndex }
          : input.operation === 'refine' ? { instruction: input.instruction }
          : input.operation === 'motion' ? { sceneIndex: input.sceneIndex, scope: input.scope } : undefined }, generation.caps);
    } catch (error) {
      const message = (error as Error).message;
      if (/^Insufficient generation credits/.test(message)) return res.status(402).json({ error: message });
      if (/^Generation spending limit/.test(message)) return res.status(429).json({ error: message });
      if ((error as { code?: number }).code === 11000 || /^The authorized project/.test(message)) {
        if (await getOwnedJob(ownerId, id)) return res.status(202).json({ id, projectId });
        return res.status(409).json({ error: 'Another generation is pending or the project revision changed.' });
      }
      throw error;
    }
    return res.status(202).json({ id, projectId });
  }));

  router.get('/sessions', handle(async (_req, res) => {
    const items = await listProjects(owner(res));
    res.json(await Promise.all(items.map(async ({ projectId, session, updatedAt, hasAudio, scenesCount, media }) => {
      const duration = session.renderState?.qa?.durationSec ?? session.storyboard?.estimatedDurationSec;
      const mediaKey = media.find(item => item.source === session.renderState?.mediaUrl)?.key;
      return { id: projectId, topic: session.topic, title: session.storyboard?.title ?? session.topic, angle: session.angle,
        finalized: !!session.finalized, hasAudio, scenesCount, hasVideo: !!session.renderState?.mediaUrl,
        mediaUrl: storage && mediaKey ? await storage.url(mediaKey) : null, renderStatus: session.renderState?.status ?? 'idle',
        duration: Number.isFinite(duration) ? `${Math.round(duration)}s` : undefined,
        hasStoryboard: !!session.storyboard, createdAt: session.createdAt, updatedAt };
    })));
  }));

  router.get(['/script/:sessionId', '/status/:sessionId'], handle(async (req, res) => {
    const item = await getProject(owner(res), req.params.sessionId);
    if (!item) return res.status(404).json({ error: 'Session not found.' });
    const session = await present(item.session, item.media, storage);
    if (req.path.toLowerCase().startsWith('/script/')) return res.json({ ...session, revision: item.revision });
    return res.json({ ok: true, sessionId: session.id, session: { ...session, revision: item.revision },
      job: session.job ?? { status: 'idle', stage: 'scripting', progress: 0, message: '' },
      renderState: session.renderState ?? { status: 'idle', progress: 0 }, mediaUrl: session.renderState?.mediaUrl ?? null });
  }));

  router.post('/script/custom', json({ limit: '50kb' }), handle(async (req, res) => {
    const parsed = pasteInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Provide a valid script, topic and optional session ID.' });
    const { customScript, topic, sessionId } = parsed.data;
    const ownerId = owner(res);
    const existing = sessionId ? await getProject(ownerId, sessionId) : null;
    if (sessionId && !existing) return res.status(404).json({ error: 'Session not found.' });
    let session;
    try { session = await masterScriptService.buildCustomSession(customScript, topic, existing?.session); }
    catch { return res.status(422).json({ error: 'The pasted script could not be parsed.' }); }
    if (!existing) await createProject(ownerId, session);
    else if (!await replaceProject(ownerId, session, existing.revision)) {
      return res.status(409).json({ error: 'The project changed. Reload it before saving.' });
    }
    return res.status(201).json(await present(session, []));
  }));

  router.post('/script/finalize', json({ limit: '50kb' }), handle(async (req, res) => {
    const parsed = finalizeInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Provide a valid session ID and script.' });
    const ownerId = owner(res);
    const item = await getProject(ownerId, parsed.data.sessionId);
    if (!item) return res.status(404).json({ error: 'Session not found.' });
    const session = masterScriptService.finalizeStoredScript(item.session, parsed.data.customMarkdown);
    if (!await replaceProject(ownerId, session, item.revision)) return res.status(409).json({ error: 'The project changed. Reload it before saving.' });
    return res.json(await present(session, item.media, storage));
  }));

  router.delete('/session/:sessionId', handle(async (req, res) => {
    if (!await archiveProject(owner(res), req.params.sessionId)) return res.status(404).json({ error: 'Session not found.' });
    return res.json({ success: true, sessionId: req.params.sessionId });
  }));

  router.get('/visual-source-pack/:name', handle(async (req, res) => {
    const bytes = (await visualSourcePack()).get(req.params.name);
    if (!bytes) return res.status(404).json({ error: 'Source file not found.' });
    return res.attachment(req.params.name).send(bytes);
  }));

  router.get('/manual-visual/:sessionId/context', handle(async (req, res) => {
    const item = await getProject(owner(res), req.params.sessionId);
    if (!item) return res.status(404).json({ error: 'Session not found.' });
    return res.json(await visualPromptContext(item.session, await verifiedDirectiveExample(), verifyNarration(item)));
  }));

  router.post(['/manual-visual/:sessionId/validate', '/manual-visual/:sessionId/generate'],
    text({ type: ['text/plain', 'application/json'], limit: visualDirectiveMaxBytes }),
    handle(async (req, res) => {
      const ownerId = owner(res);
      const item = await getProject(ownerId, req.params.sessionId);
      if (!item) return res.status(404).json({ error: 'Session not found.' });
      if (typeof req.body !== 'string') return res.status(400).json({ error: 'Paste a JSON document.' });
      const revision = visualArtifactRevision(item.session);
      const generate = req.path.toLowerCase().endsWith('/generate');
      const { visuals, strippedFence, focalRepairs, connectorRepairs, layoutWarnings } =
        await prepareVisualImport(item.session, req.body, !generate, undefined, verifyNarration(item));
      if (visuals) {
        const session = item.session;
        session.visualAssets = visuals;
        session.updatedAt = Date.now();
        delete session.stillPreviews;
        delete session.motionPreview;
        session.renderState = { status: 'idle', progress: 0 };
        if (await replaceProject(ownerId, session, item.revision)) {
          return res.json({ ok: true, strippedFence, revision, focalRepairs, connectorRepairs, layoutWarnings, visuals, stills: [] });
        }
      } else if ((await getProject(ownerId, item.projectId))?.revision === item.revision) {
        return res.json({ ok: true, strippedFence, revision, focalRepairs, connectorRepairs, layoutWarnings });
      }
      return res.status(409).json({ error: 'The project changed. Copy a fresh visual prompt.' });
    }));
  return router;
}
