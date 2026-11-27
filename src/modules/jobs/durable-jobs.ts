import { createHash, randomUUID } from 'node:crypto';
import mongoose, { Schema, type ClientSession } from 'mongoose';
import type { Queue } from 'bullmq';

export type StudioOperation = 'script' | 'refine' | 'audio' | 'visuals' | 'stills' | 'motion' | 'render';
export type MotionScope = 'scene' | 'sequence' | 'hook' | 'transition' | 'ending';
export type Provider = 'gemini' | 'groq' | 'sarvam' | 'elevenlabs' | 'cloudflare' | 'story-video';
export type ProviderQuote = { attempts: number; microsPerCall: number; microsPerMillionUnits?: Record<string, number> };
export type ExecutionQuote = { providers: Partial<Record<Provider, ProviderQuote>>; computeMicros: number };
export type ExecutionInput = { feedback?: string; sceneIndex?: number; instruction?: string; scope?: MotionScope };
const leaseMs = 60_000;
const maxAttempts = 3;
const jobs = mongoose.model('StudioJob', new Schema({
  _id: { type: String, required: true },
  ownerId: { type: String, required: true },
  projectId: { type: String, required: true },
  operation: { type: String, enum: ['script', 'refine', 'audio', 'visuals', 'stills', 'motion', 'render'], required: true },
  revision: { type: Number, required: true },
  status: { type: String, enum: ['queued', 'running', 'completed', 'failed', 'needs_review'], default: 'queued', required: true },
  attempts: { type: Number, default: 0, required: true },
  leaseId: String,
  leaseUntil: Date,
  providerInFlight: { type: Boolean, default: false, required: true },
  checkpoint: String,
  quote: Schema.Types.Mixed,
  input: Schema.Types.Mixed,
  calls: { type: [Schema.Types.Mixed], default: [] },
  metrics: Schema.Types.Mixed,
  reconciliation: Schema.Types.Mixed,
}, { collection: 'jobs', timestamps: true })
  .index({ status: 1, leaseUntil: 1 })
  .index({ ownerId: 1, projectId: 1, updatedAt: -1 }));

export const initJobs = () => jobs.init();

export function studioJobId(ownerId: string, projectId: string, operation: StudioOperation, revision: number, requestId: string) {
  return createHash('sha256').update(JSON.stringify([ownerId, projectId, operation, revision, requestId])).digest('hex');
}

export async function recordJob(ownerId: string, projectId: string, operation: StudioOperation, revision: number, requestId: string,
  transaction?: ClientSession, quote?: ExecutionQuote, input?: ExecutionInput) {
  const id = studioJobId(ownerId, projectId, operation, revision, requestId);
  return jobs.findOneAndUpdate({ _id: id }, { $setOnInsert: { ownerId, projectId, operation, revision, quote, input } },
    { upsert: true, returnDocument: 'after', session: transaction }).lean().exec();
}

export const getOwnedJob = (ownerId: string, id: string) => jobs.findOne({ _id: id, ownerId }).lean().exec();
export const recentExecutions = () => jobs.find({ quote: { $exists: true } }).sort({ updatedAt: -1 }).limit(50)
  .select('operation status checkpoint updatedAt calls metrics reconciliation').lean().exec();

export async function markReviewedExecution(id: string, reviewer: string, reference: string,
  spending: Record<string, number>, transaction: ClientSession) {
  const result = await jobs.updateOne({ _id: id, status: 'needs_review', quote: { $exists: true } },
    { $set: { status: 'failed', providerInFlight: false, reconciliation: { reviewer, reference, spending, at: new Date() } } },
    { session: transaction });
  return result.modifiedCount === 1;
}

function activeLease(id: string, leaseId: string) {
  return { _id: id, leaseId, status: 'running' as const, leaseUntil: { $gt: new Date() } };
}

export async function startProviderCall(id: string, leaseId: string, call: { id: string; provider: Provider; boundMicros: number }) {
  const result = await jobs.updateOne(activeLease(id, leaseId),
    { $set: { providerInFlight: true, checkpoint: 'provider-request' }, $push: { calls: { ...call, startedAt: new Date() } } });
  return result.matchedCount === 1;
}

export async function recordProviderResponse(id: string, leaseId: string, callId: string, status: number, usage: Record<string, number>,
  estimatedMicros: number, basis: 'usage' | 'ceiling') {
  const result = await jobs.updateOne({ ...activeLease(id, leaseId), 'calls.id': callId },
    { $set: { 'calls.$.status': status, 'calls.$.usage': usage, 'calls.$.estimatedMicros': estimatedMicros, 'calls.$.basis': basis } });
  return result.matchedCount === 1;
}

export async function finishExecution(id: string, leaseId: string, transaction: ClientSession, metrics?: Record<string, number>) {
  const completion = metrics ? { status: 'completed', checkpoint: 'persisted', metrics } : { status: 'failed', checkpoint: 'failed' };
  const result = await jobs.updateOne(activeLease(id, leaseId), {
    $set: { ...completion, providerInFlight: false }, $unset: { leaseId: 1, leaseUntil: 1 },
  }, { session: transaction });
  if (!result.matchedCount) throw new Error('The execution lease expired.');
}

export async function reviewExecution(id: string, leaseId: string) {
  await jobs.updateOne(activeLease(id, leaseId), {
    $set: { status: 'needs_review' }, $unset: { leaseId: 1, leaseUntil: 1 },
  });
}

export async function executionCheckpoint(id: string, leaseId: string, checkpoint: string) {
  const result = await jobs.updateOne(activeLease(id, leaseId), { $set: { checkpoint } });
  if (!result.matchedCount) throw new Error('The execution lease expired.');
}

export async function expiredExecutions() {
  return jobs.find({ status: 'failed', quote: { $exists: true }, checkpoint: 'retry-exhausted' }).limit(100).select('_id').lean();
}

export async function permitJobSettlement(id: string, success: boolean, transaction: ClientSession) {
  const allowed = success ? ['completed'] as const : ['queued', 'failed'] as const;
  const filter = { _id: id, status: { $in: [...allowed] }, providerInFlight: false };
  if (success) return Boolean(await jobs.exists(filter).session(transaction));
  const result = await jobs.updateOne(filter, { $set: { status: 'failed', checkpoint: 'released' } }, { session: transaction });
  return result.matchedCount === 1;
}

export async function reconcileJobs(queue: Pick<Queue, 'add'>, now = new Date(), hostedOnly = false, operations?: StudioOperation[]) {
  const mode = { ...(hostedOnly && { quote: { $exists: true } }), ...(operations && { operation: { $in: operations } }) };
  const expired = { ...mode, status: 'running' as const, leaseUntil: { $lte: now } };
  const clearLease = { leaseId: 1 as const, leaseUntil: 1 as const };
  await jobs.updateMany({ ...expired, providerInFlight: true }, { $set: { status: 'needs_review' }, $unset: clearLease });
  await jobs.updateMany({ ...expired, providerInFlight: false, attempts: { $gte: maxAttempts } },
    { $set: { status: 'failed', checkpoint: 'retry-exhausted' }, $unset: clearLease });
  await jobs.updateMany({ ...expired, providerInFlight: false, attempts: { $lt: maxAttempts } },
    { $set: { status: 'queued' }, $unset: clearLease });

  const pending = await jobs.find({ status: 'queued', ...mode }).sort({ updatedAt: 1, _id: 1 }).limit(100).select('_id attempts').lean();
  for (const job of pending) {
    const jobId = hostedOnly && job.attempts ? `${job._id}-${job.attempts}` : job._id;
    await queue.add('studio', { id: job._id }, { jobId, removeOnComplete: true, removeOnFail: true });
  }
  return pending.length;
}

export function claimJob(id: string, now = new Date(), operations?: StudioOperation[]) {
  return jobs.findOneAndUpdate({ _id: id, status: 'queued', attempts: { $lt: maxAttempts },
    ...(operations && { operation: { $in: operations } }) }, {
    $set: { status: 'running', leaseId: randomUUID(), leaseUntil: new Date(now.getTime() + leaseMs) }, $inc: { attempts: 1 },
  }, { returnDocument: 'after' }).lean().exec();
}

export async function updateJobLease(id: string, leaseId: string, action: 'renew' | 'provider-start' | 'checkpoint' | 'complete' | 'fail',
  checkpoint?: string, now = new Date()) {
  if (!leaseId) return false;
  const set = { leaseUntil: new Date(now.getTime() + leaseMs) } as Record<string, string | boolean | Date>;
  const filter = { _id: id, leaseId, status: 'running', leaseUntil: { $gt: now } } as Record<string, unknown>;
  if (action === 'provider-start') { filter.providerInFlight = false; set.providerInFlight = true; }
  if (action === 'checkpoint') {
    if (!checkpoint || checkpoint.length > 100) return false;
    set.checkpoint = checkpoint;
    set.providerInFlight = false;
  }
  if (action === 'complete' || action === 'fail') {
    filter.providerInFlight = false;
    delete set.leaseUntil;
    set.status = action === 'complete' ? 'completed' : 'failed';
    const result = await jobs.updateOne(filter, { $set: set, $unset: { leaseId: 1, leaseUntil: 1 } });
    return result.modifiedCount === 1;
  }
  const result = await jobs.updateOne(filter, { $set: set });
  return result.matchedCount === 1;
}
