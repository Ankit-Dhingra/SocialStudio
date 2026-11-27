import { createHash } from 'node:crypto';
import mongoose, { Schema } from 'mongoose';
import { permitJobSettlement, recordJob, studioJobId, type StudioOperation } from './durable-jobs.js';
import { getProject } from '../projects/repository.js';

const grants = mongoose.model('GenerationCreditGrant', new Schema({
  _id: { type: String, required: true }, ownerId: { type: String, required: true },
  available: { type: Number, required: true }, issued: { type: Number, required: true }, expiresAt: { type: Date, required: true },
}, { collection: 'generation_credit_grants', timestamps: true }).index({ ownerId: 1, expiresAt: 1 }));
const budgets = mongoose.model('GenerationBudget', new Schema({
  _id: { type: String, required: true }, held: { type: Number, default: 0 }, spent: { type: Number, default: 0 },
}, { collection: 'generation_budgets' }));
const reservations = mongoose.model('GenerationReservation', new Schema({
  _id: { type: String, required: true }, ownerId: { type: String, required: true },
  grantDebits: [{ _id: false, grantId: { type: String, required: true }, credits: { type: Number, required: true } }],
  budgetKeys: [{ type: String, required: true }], boundMicros: { type: Number, required: true },
  actualMicros: Number, state: { type: String, enum: ['held', 'spent', 'released'], default: 'held' },
}, { collection: 'generation_reservations', timestamps: true })
  .index({ ownerId: 1 }, { unique: true, partialFilterExpression: { state: 'held' } }));

export const initAdmission = () => Promise.all([grants.init(), budgets.init(), reservations.init()]);
const boundedInteger = (value: number, minimum = 1) => Number.isSafeInteger(value) && value >= minimum && value <= 1_000_000_000_000;

export async function grantGenerationCredits(ownerId: string, reference: string, credits: number, expiresAt: Date) {
  if (!boundedInteger(credits) || !reference || !Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) throw new Error('Invalid credit grant.');
  const id = createHash('sha256').update(JSON.stringify([ownerId, reference])).digest('hex');
  const result = await grants.updateOne({ _id: id }, { $setOnInsert: { ownerId, issued: credits, available: credits, expiresAt } }, { upsert: true });
  return result.upsertedCount === 1;
}

export async function availableGenerationCredits(ownerId: string, now = new Date()) {
  const [sum] = await grants.aggregate<{ available: number }>([
    { $match: { ownerId, expiresAt: { $gt: now } } }, { $group: { _id: null, available: { $sum: '$available' } } },
  ]);
  return sum?.available ?? 0;
}

type Admission = { ownerId: string; projectId: string; operation: StudioOperation; revision: number; requestId: string;
  provider: 'gemini' | 'groq' | 'sarvam' | 'compute'; credits: number; boundMicros: number };
type Caps = { dailyMicros: number; monthlyMicros: number; userDailyMicros: number; providerDailyMicros: number };

export async function admitGeneration(input: Admission, caps: Caps, now = new Date()) {
  if (![input.credits, input.boundMicros, ...Object.values(caps)].every(value => boundedInteger(value))) throw new Error('Invalid generation quote or limits.');
  const { ownerId, projectId, operation, revision, requestId, credits, boundMicros } = input;
  const id = studioJobId(ownerId, projectId, operation, revision, requestId);
  const day = now.toISOString().slice(0, 10);
  const thresholds = new Map([ [`day:${day}`, caps.dailyMicros], [`month:${day.slice(0, 7)}`, caps.monthlyMicros],
    [`user:${ownerId}:${day}`, caps.userDailyMicros], [`provider:${input.provider}:${day}`, caps.providerDailyMicros] ]);

  await mongoose.connection.transaction(async transaction => {
    if (await reservations.exists({ _id: id }).session(transaction)) return;
    const project = await getProject(ownerId, projectId, transaction);
    if (!project || project.revision !== revision) throw new Error('The authorized project revision is unavailable.');
    const eligible = await grants.find({ ownerId, expiresAt: { $gt: now }, available: { $gt: 0 } })
      .sort({ expiresAt: 1, _id: 1 }).limit(100).session(transaction);
    let remaining = credits;
    const grantDebits = [];
    for (const grant of eligible) {
      const amount = Math.min(remaining, grant.available);
      await grants.updateOne({ _id: grant._id }, { $inc: { available: -amount } }, { session: transaction });
      grantDebits.push({ grantId: grant._id, credits: amount });
      remaining -= amount;
      if (remaining === 0) break;
    }
    if (remaining) throw new Error('Insufficient generation credits.');
    for (const [key, cap] of thresholds) {
      await budgets.updateOne({ _id: key }, { $setOnInsert: { held: 0, spent: 0 } }, { upsert: true, session: transaction });
      const result = await budgets.updateOne({ _id: key, $expr: { $lte: [{ $add: ['$held', '$spent', boundMicros] }, cap] } },
        { $inc: { held: boundMicros } }, { session: transaction });
      if (!result.matchedCount) throw new Error('Generation spending limit exceeded.');
    }
    await reservations.create([{ _id: id, ownerId, grantDebits, budgetKeys: [...thresholds.keys()], boundMicros }], { session: transaction });
    await recordJob(ownerId, projectId, operation, revision, requestId, transaction);
  });
  return id;
}

export async function settleGeneration(id: string, actualMicros: number, consumeCredits: boolean) {
  if (!boundedInteger(actualMicros, 0)) throw new Error('A verified provider cost is required for settlement.');
  return mongoose.connection.transaction(async transaction => {
    const reservation = await reservations.findOne({ _id: id, state: 'held' }).session(transaction);
    if (!reservation) return false;
    if (!await permitJobSettlement(id, consumeCredits, transaction)) throw new Error('Generation has no safe terminal outcome.');
    for (const key of reservation.budgetKeys) {
      await budgets.updateOne({ _id: key }, { $inc: { held: -reservation.boundMicros, spent: actualMicros } }, { session: transaction });
    }
    if (!consumeCredits) for (const debit of reservation.grantDebits) {
      await grants.updateOne({ _id: debit.grantId }, { $inc: { available: debit.credits } }, { session: transaction });
    }
    reservation.actualMicros = actualMicros;
    reservation.state = consumeCredits ? 'spent' : 'released';
    await reservation.save({ session: transaction });
    return true;
  });
}
