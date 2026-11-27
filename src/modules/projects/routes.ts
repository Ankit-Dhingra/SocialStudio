import { Router, json, text, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { masterScriptService, type ScriptSession } from '../ai-script/master-script-service.js';
import { sessionIdPattern } from '../pipeline/session-owner.js';
import { DirectiveError, prepareVisualImport, visualArtifactRevision, visualDirectiveMaxBytes, visualPromptContext } from '../render/visual-directives.js';
import { verifiedDirectiveExample, visualSourcePack } from '../render/visual-source-pack.js';
import { archiveProject, createProject, getProject, listProjects, replaceProject } from './repository.js';
import type { PrivateMedia } from '../storage/private-media.js';

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

export function projectRouter(storage?: PrivateMedia) {
  const router = Router();
  const owner = (res: Response): string => res.locals.studioAccount.clerkUserId;

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
    if (req.path.toLowerCase().startsWith('/script/')) return res.json(session);
    return res.json({ ok: true, sessionId: session.id, session, job: session.job ?? { status: 'idle', stage: 'scripting', progress: 0, message: '' },
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
    return res.json(await visualPromptContext(item.session, await verifiedDirectiveExample()));
  }));

  router.post('/manual-visual/:sessionId/validate', text({ type: ['text/plain', 'application/json'], limit: visualDirectiveMaxBytes }),
    handle(async (req, res) => {
      const ownerId = owner(res);
      const item = await getProject(ownerId, req.params.sessionId);
      if (!item) return res.status(404).json({ error: 'Session not found.' });
      if (typeof req.body !== 'string') return res.status(400).json({ error: 'Paste a JSON document.' });
      const revision = visualArtifactRevision(item.session);
      const { strippedFence, focalRepairs, connectorRepairs, layoutWarnings } = await prepareVisualImport(item.session, req.body, true);
      if ((await getProject(ownerId, item.projectId))?.revision !== item.revision) {
        return res.status(409).json({ error: 'The project changed. Copy a fresh visual prompt.' });
      }
      return res.json({ ok: true, strippedFence, revision, focalRepairs, connectorRepairs, layoutWarnings });
    }));
  return router;
}
