import { createHash } from 'node:crypto';
import mongoose, { Schema, type ClientSession } from 'mongoose';
import { permitJobSettlement, recordJob, studioJobId, type ExecutionInput, type ExecutionQuote, type Provider, type StudioOperation } from './durable-jobs.js';
import { createProject, getProject } from '../projects/repository.js';
import type { ScriptSession } from '../ai-script/master-script-service.js';

const grants = mongoose.model('GenerationCreditGrant', new Schema({
  _id: { type: String, required: true }, ownerId: { type: String, required: true },
  available: { type: Number, required: true }, issued: { type: Number, required: true }, expiresAt: { type: Date, required: true },
  trial: { type: Boolean, default: false },
}, { collection: 'generation_credit_grants', timestamps: true }).index({ ownerId: 1, expiresAt: 1 }));
const budgets = mongoose.model('GenerationBudget', new Schema({
  _id: { type: String, required: true }, held: { type: Number, default: 0 }, spent: { type: Number, default: 0 },
}, { collection: 'generation_budgets' }));
const reservations = mongoose.model('GenerationReservation', new Schema({
  _id: { type: String, required: true }, ownerId: { type: String, required: true },
  grantDebits: [{ _id: false, grantId: { type: String, required: true }, credits: { type: Number, required: true } }],
  budgetKeys: [{ type: String, required: true }], boundMicros: { type: Number, required: true },
  budgetBounds: Schema.Types.Mixed,
  actualMicros: Number, state: { type: String, enum: ['held', 'spent', 'released'], default: 'held' },
}, { collection: 'generation_reservations', timestamps: true })
  .index({ ownerId: 1, state: 1 })
  .index({ ownerId: 1 }, { unique: true, partialFilterExpression: { state: 'held' } }));

export const initAdmission = () => Promise.all([grants.init(), budgets.init(), reservations.init()]);
export const hasHeldGeneration = (ownerId: string) => reservations.exists({ ownerId, state: 'held' });
const boundedInteger = (value: number, minimum = 1) => Number.isSafeInteger(value) && value >= minimum && value <= 1_000_000_000_000;

export async function grantGenerationCredits(ownerId: string, reference: string, credits: number, expiresAt: Date,
  transaction?: ClientSession, trial = false) {
  if (!boundedInteger(credits) || !reference || !Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) throw new Error('Invalid credit grant.');
  const id = createHash('sha256').update(JSON.stringify([ownerId, reference])).digest('hex');
  const result = await grants.updateOne({ _id: id }, { $setOnInsert: { ownerId, issued: credits, available: credits, expiresAt, trial } },
    { upsert: true, session: transaction });
  return result.upsertedCount === 1;
}

export async function availableGenerationCredits(ownerId: string, now = new Date()) {
  const [sum] = await grants.aggregate<{ available: number }>([
    { $match: { ownerId, expiresAt: { $gt: now } } }, { $group: { _id: null, available: { $sum: '$available' } } },
  ]);
  return sum?.available ?? 0;
}

export async function generationCreditUsage(ownerId: string, now = new Date()) {
  const [balances, utilization] = await Promise.all([
    grants.aggregate<{ available: number; expired: number; nextExpiry: Date | null }>([
      { $match: { ownerId, available: { $gt: 0 } } },
      { $group: {
        _id: null,
        available: { $sum: { $cond: [{ $gt: ['$expiresAt', now] }, '$available', 0] } },
        expired: { $sum: { $cond: [{ $lte: ['$expiresAt', now] }, '$available', 0] } },
        nextExpiry: { $min: { $cond: [{ $gt: ['$expiresAt', now] }, '$expiresAt', null] } },
      } },
    ]),
    reservations.aggregate<{ _id: 'held' | 'spent'; credits: number }>([
      { $match: { ownerId, state: { $in: ['held', 'spent'] } } },
      { $unwind: '$grantDebits' },
      { $group: { _id: '$state', credits: { $sum: '$grantDebits.credits' } } },
    ]),
  ]);
  return {
    available: balances[0]?.available ?? 0,
    expired: balances[0]?.expired ?? 0,
    nextExpiry: balances[0]?.nextExpiry ?? null,
    reserved: utilization.find(item => item._id === 'held')?.credits ?? 0,
    used: utilization.find(item => item._id === 'spent')?.credits ?? 0,
  };
}

type Admission = { ownerId: string; projectId: string; operation: StudioOperation; revision: number; requestId: string;
  provider: Provider | 'compute'; credits: number; boundMicros: number; quote?: ExecutionQuote; input?: ExecutionInput; draft?: ScriptSession };
export type Caps = { dailyMicros: number; monthlyMicros: number; userDailyMicros: number; providerDailyMicros: number; trialDailyMicros?: number };

export async function admitGeneration(input: Admission, caps: Caps, now = new Date()) {
  if (![input.credits, input.boundMicros, ...Object.values(caps)].every(value => boundedInteger(value))) throw new Error('Invalid generation quote or limits.');
  const { ownerId, projectId, operation, revision, requestId, credits, boundMicros } = input;
  const id = studioJobId(ownerId, projectId, operation, revision, requestId);
  const day = now.toISOString().slice(0, 10);
  const thresholds = new Map([ [`day:${day}`, caps.dailyMicros], [`month:${day.slice(0, 7)}`, caps.monthlyMicros],
    [`user:${ownerId}:${day}`, caps.userDailyMicros] ]);
  const providerBounds = input.quote ? { compute: input.quote.computeMicros, ...Object.fromEntries(
    Object.entries(input.quote.providers).map(([provider, limit]) => [provider, limit.attempts * limit.microsPerCall]),
  ) } : { [input.provider]: boundMicros };
  const amounts = new Map([...thresholds.keys()].map(key => [key, boundMicros]));
  if (Object.values(providerBounds).some(amount => !boundedInteger(amount, 0)) ||
      Object.values(providerBounds).reduce((sum, amount) => sum + amount, 0) !== boundMicros) throw new Error('Invalid provider bounds.');
  for (const [provider, amount] of Object.entries(providerBounds)) {
    if (!amount) continue;
    const key = `provider:${provider}:${day}`;
    thresholds.set(key, caps.providerDailyMicros);
    amounts.set(key, amount);
  }

  await mongoose.connection.transaction(async transaction => {
    if (await reservations.exists({ _id: id }).session(transaction)) return;
    const project = await getProject(ownerId, projectId, transaction);
    if (!project && operation === 'script' && revision === 0 && input.draft?.id === projectId) {
      await createProject(ownerId, input.draft, transaction);
    } else if (!project || project.revision !== revision) throw new Error('The authorized project revision is unavailable.');
    const eligible = await grants.find({ ownerId, expiresAt: { $gt: now }, available: { $gt: 0 } })
      .where(caps.trialDailyMicros ? {} : { trial: { $ne: true } })
      .sort({ expiresAt: 1, _id: 1 }).limit(100).session(transaction);
    let remaining = credits;
    let trial = false;
    const grantDebits = [];
    for (const grant of eligible) {
      const amount = Math.min(remaining, grant.available);
      await grants.updateOne({ _id: grant._id }, { $inc: { available: -amount } }, { session: transaction });
      grantDebits.push({ grantId: grant._id, credits: amount });
      trial ||= grant.trial;
      remaining -= amount;
      if (remaining === 0) break;
    }
    if (remaining) throw new Error('Insufficient generation credits.');
    const limits = new Map(thresholds);
    const held = new Map(amounts);
    if (trial && caps.trialDailyMicros) {
      limits.set(`trial:${day}`, caps.trialDailyMicros);
      held.set(`trial:${day}`, boundMicros);
    }
    for (const [key, cap] of limits) {
      const amount = held.get(key)!;
      await budgets.updateOne({ _id: key }, { $setOnInsert: { held: 0, spent: 0 } }, { upsert: true, session: transaction });
      const result = await budgets.updateOne({ _id: key, $expr: { $lte: [{ $add: ['$held', '$spent', amount] }, cap] } },
        { $inc: { held: amount } }, { session: transaction });
      if (!result.matchedCount) throw new Error('Generation spending limit exceeded.');
    }
    await reservations.create([{ _id: id, ownerId, grantDebits, budgetKeys: [...limits.keys()],
      budgetBounds: Object.fromEntries(held), boundMicros }], { session: transaction });
    await recordJob(ownerId, projectId, operation, revision, requestId, transaction, input.quote, input.input);
  });
  return id;
}

export async function settleGeneration(id: string, actualMicros: number, consumeCredits: boolean,
  session?: ClientSession, breakdown?: Partial<Record<Provider | 'compute', number>>) {
  if (!boundedInteger(actualMicros, 0)) throw new Error('A verified provider cost is required for settlement.');
  const settle = async (transaction: ClientSession) => {
    const reservation = await reservations.findOne({ _id: id, state: 'held' }).session(transaction);
    if (!reservation) return false;
    if (reservation.budgetBounds && (actualMicros > reservation.boundMicros ||
        (breakdown && Object.values(breakdown).reduce((sum, amount) => sum + amount, 0) !== actualMicros))) {
      throw new Error('Cost exceeds the reserved quote.');
    }
    if (!await permitJobSettlement(id, consumeCredits, transaction)) throw new Error('Generation has no safe terminal outcome.');
    for (const key of reservation.budgetKeys) {
      const bound = reservation.budgetBounds?.[key] ?? reservation.boundMicros;
      const provider = key.startsWith('provider:') ? key.split(':')[1] as Provider | 'compute' : undefined;
      const spent = breakdown && provider ? breakdown[provider] ?? 0 : actualMicros;
      if (!boundedInteger(spent, 0) || (reservation.budgetBounds && key.startsWith('provider:') && breakdown && spent > bound)) {
        throw new Error('Provider cost exceeds the reserved quote.');
      }
      await budgets.updateOne({ _id: key }, { $inc: { held: -bound, spent } }, { session: transaction });
    }
    if (!consumeCredits) for (const debit of reservation.grantDebits) {
      await grants.updateOne({ _id: debit.grantId }, { $inc: { available: debit.credits } }, { session: transaction });
    }
    reservation.actualMicros = actualMicros;
    reservation.state = consumeCredits ? 'spent' : 'released';
    await reservation.save({ session: transaction });
    return true;
  };
  return session ? settle(session) : mongoose.connection.transaction(settle);
}
