import { Router, json, type Request, type Response, type NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { grantGenerationCredits, settleGeneration } from './admission.js';
import { markReviewedExecution, recentExecutions } from './durable-jobs.js';
import { generationPaused, setGenerationPaused } from './generation-control.js';

function handle(action: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

const pauseInput = z.object({ paused: z.boolean() }).strict();
const grantInput = z.object({ reference: z.string().uuid(), credits: z.number().int().min(1).max(100_000),
  expiresInDays: z.number().int().min(1).max(365) }).strict();
const planId = z.string().regex(/^[a-z][a-z0-9-]{1,39}$/);
const planGrant = z.object({ reference: z.string().uuid(), planId }).strict();
const planCatalog = z.array(z.object({ id: planId, name: z.string().trim().min(1).max(80),
  credits: z.number().int().min(1).max(100_000), expiresInDays: z.number().int().min(1).max(365) }).strict()).max(20);
const cost = z.number().int().min(0).max(1_000_000_000_000).optional();
const reconcileInput = z.object({ reference: z.string().trim().min(3).max(100).regex(/^[a-zA-Z0-9_. -]+$/),
  spending: z.object({ compute: cost, gemini: cost, groq: cost, sarvam: cost, elevenlabs: cost,
    cloudflare: cost, 'story-video': cost }).strict() }).strict();

export function generationAdminRouter(env = process.env) {
  const router = Router();
  const plans = env.STUDIO_CREDIT_PLANS ? planCatalog.parse(JSON.parse(env.STUDIO_CREDIT_PLANS)) : [];
  if (new Set(plans.map(plan => plan.id)).size !== plans.length) throw new Error('Credit plan IDs must be unique.');
  const readBody = json({ limit: '2kb' });
  const ownerId = (res: Response) => res.locals.studioAccount.clerkUserId as string;
  router.get('/', handle(async (_req, res) => res.json({ paused: await generationPaused(), plans, jobs: await recentExecutions() })));
  router.put('/pause', readBody, handle(async (req, res) => {
    const input = pauseInput.safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: 'Provide the generation pause state.' });
    await setGenerationPaused(input.data.paused, ownerId(res));
    return res.json(input.data);
  }));
  router.post('/credits', readBody, handle(async (req, res) => {
    const input = z.union([grantInput, planGrant]).safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: 'Choose a credit plan or provide credits and an expiry.' });
    const request = input.data;
    const grant = 'planId' in request ? plans.find(plan => plan.id === request.planId) : request;
    if (!grant) return res.status(404).json({ error: 'The selected credit plan is unavailable.' });
    const { reference } = request;
    const { credits, expiresInDays } = grant;
    const expires = new Date(Date.now() + expiresInDays * 86_400_000);
    const granted = await grantGenerationCredits(ownerId(res), `owner-allocation:${reference}`, credits, expires);
    return res.status(granted ? 201 : 200).json({ granted });
  }));
  router.post('/jobs/:id/reconcile', readBody, handle(async (req, res) => {
    const input = reconcileInput.safeParse(req.body);
    if (!/^[a-f0-9]{64}$/.test(req.params.id) || !input.success || !Object.keys(input.data.spending).length) {
      return res.status(400).json({ error: 'Record the verified provider costs and reconciliation reference.' });
    }
    const { reference, spending } = input.data;
    const total = Object.values(spending).reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
    const id = req.params.id;
    try {
      const updated = await mongoose.connection.transaction(async transaction => {
        if (!await markReviewedExecution(id, ownerId(res), reference, spending, transaction)) return false;
        if (!await settleGeneration(id, total, false, transaction, spending)) throw new Error('Missing held reservation.');
        return true;
      });
      if (!updated) return res.status(409).json({ error: 'The job does not have a pending outcome to reconcile.' });
    } catch (error) {
      if (/exceeds the reserved quote/.test((error as Error).message)) {
        return res.status(422).json({ error: 'Verified spending is above the reserved amount. Pause generation and review the provider quote.' });
      }
      throw error;
    }
    return res.json({ reconciled: true });
  }));
  return router;
}
