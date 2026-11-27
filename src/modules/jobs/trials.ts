import { createHash } from 'node:crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import mongoose, { Schema } from 'mongoose';
import { z } from 'zod';
import type { StudioAccount } from '../accounts/users.js';
import { grantGenerationCredits } from './admission.js';
import { generationPaused } from './generation-control.js';

const claims = mongoose.model('GenerationTrialClaim', new Schema({
  _id: String, date: { type: String, required: true }, ownerId: { type: String, required: true },
}, { collection: 'generation_trial_claims', timestamps: true }).index({ ownerId: 1 }, { unique: true }));
const daily = mongoose.model('GenerationTrialDay', new Schema({
  _id: String, count: { type: Number, required: true },
}, { collection: 'generation_trial_days' }));
const policy = z.object({
  credits: z.number().int().min(1).max(1000), validDays: z.number().int().min(1).max(30),
  claimsPerDay: z.number().int().min(1).max(100),
  eligibleClerkIds: z.array(z.string().regex(/^user_[a-zA-Z0-9_]+$/)).min(1).max(500),
}).strict();
export type TrialPolicy = z.infer<typeof policy>;

export function trialPolicy(env = process.env): TrialPolicy | undefined {
  if (env.STUDIO_TRIALS_ENABLED !== 'true') return undefined;
  return policy.parse(JSON.parse(env.STUDIO_TRIALS_CONFIG ?? '{}'));
}

export const initTrials = () => Promise.all([claims.init(), daily.init()]);

function trialIdentity(email: string) {
  const [mailbox, domain] = email.trim().toLowerCase().split('@');
  const gmail = domain === 'gmail.com' || domain === 'googlemail.com';
  const canonical = gmail ? `${mailbox.split('+')[0].replaceAll('.', '')}@gmail.com` : `${mailbox}@${domain}`;
  return createHash('sha256').update(canonical).digest('hex');
}

function handle(action: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

export function trialRouter(config?: TrialPolicy) {
  const router = Router();
  const eligible = (account: StudioAccount) => Boolean(config?.eligibleClerkIds.includes(account.clerkUserId) && account.role === 'member');
  router.get('/', handle(async (_req, res) => {
    const account: StudioAccount = res.locals.studioAccount;
    const claimed = Boolean(config && await claims.exists({ ownerId: account.clerkUserId }));
    return res.json({ enabled: Boolean(config), eligible: eligible(account) && !claimed, claimed });
  }));
  router.post('/claim', handle(async (_req, res) => {
    const account: StudioAccount = res.locals.studioAccount;
    if (!config || await generationPaused()) return res.status(503).json({ error: 'Trials are unavailable.' });
    if (!eligible(account)) return res.status(403).json({ error: 'This account is not eligible for a trial.' });
    const identity = trialIdentity(account.email);
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    try {
      const result = await mongoose.connection.transaction(async transaction => {
        if (await claims.exists({ $or: [{ _id: identity }, { ownerId: account.clerkUserId }] }).session(transaction)) return 'claimed';
        await daily.updateOne({ _id: date }, { $setOnInsert: { count: 0 } }, { upsert: true, session: transaction });
        const count = await daily.updateOne({ _id: date, count: { $lt: config.claimsPerDay } }, { $inc: { count: 1 } }, { session: transaction });
        if (!count.matchedCount) return 'exhausted';
        await claims.create([{ _id: identity, ownerId: account.clerkUserId, date }], { session: transaction });
        const expires = new Date(now.getTime() + config.validDays * 86_400_000);
        if (!await grantGenerationCredits(account.clerkUserId, `trial:${identity}`, config.credits, expires, transaction, true)) {
          throw new Error('The trial grant already exists.');
        }
        return 'granted';
      });
      if (result === 'exhausted') return res.status(429).json({ error: 'Today’s trial allocations have been used.' });
      if (result === 'claimed') return res.status(409).json({ error: 'A trial has already been claimed.' });
      return res.status(201).json({ claimed: true });
    } catch (error) {
      if ((error as { code?: number }).code === 11000 &&
          await claims.exists({ $or: [{ _id: identity }, { ownerId: account.clerkUserId }] })) {
        return res.status(409).json({ error: 'A trial has already been claimed.' });
      }
      throw error;
    }
  }));
  return router;
}
