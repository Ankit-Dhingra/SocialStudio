import { createHash, randomUUID } from 'node:crypto';
import mongoose, { Schema, type ClientSession } from 'mongoose';
import type { Queue } from 'bullmq';

export type StudioOperation = 'script' | 'audio' | 'visuals' | 'stills' | 'motion' | 'render';
const leaseMs = 60_000;
const maxAttempts = 3;
const jobs = mongoose.model('StudioJob', new Schema({
  _id: { type: String, required: true },
  ownerId: { type: String, required: true },
  projectId: { type: String, required: true },
  operation: { type: String, enum: ['script', 'audio', 'visuals', 'stills', 'motion', 'render'], required: true },
  revision: { type: Number, required: true },
  status: { type: String, enum: ['queued', 'running', 'completed', 'failed', 'needs_review'], default: 'queued', required: true },
  attempts: { type: Number, default: 0, required: true },
  leaseId: String,
  leaseUntil: Date,
  providerInFlight: { type: Boolean, default: false, required: true },
  checkpoint: String,
}, { collection: 'jobs', timestamps: true })
  .index({ status: 1, leaseUntil: 1 })
  .index({ ownerId: 1, projectId: 1, updatedAt: -1 }));

export const initJobs = () => jobs.init();

export function studioJobId(ownerId: string, projectId: string, operation: StudioOperation, revision: number, requestId: string) {
  return createHash('sha256').update(JSON.stringify([ownerId, projectId, operation, revision, requestId])).digest('hex');
}

export async function recordJob(ownerId: string, projectId: string, operation: StudioOperation, revision: number, requestId: string, transaction?: ClientSession) {
  const id = studioJobId(ownerId, projectId, operation, revision, requestId);
  return jobs.findOneAndUpdate({ _id: id }, { $setOnInsert: { ownerId, projectId, operation, revision } },
    { upsert: true, returnDocument: 'after', session: transaction }).lean().exec();
}

export const getOwnedJob = (ownerId: string, id: string) => jobs.findOne({ _id: id, ownerId }).lean().exec();

export async function permitJobSettlement(id: string, success: boolean, transaction: ClientSession) {
  const allowed = success ? ['completed'] as const : ['queued', 'failed'] as const;
  const filter = { _id: id, status: { $in: [...allowed] }, providerInFlight: false };
  if (success) return Boolean(await jobs.exists(filter).session(transaction));
  const result = await jobs.updateOne(filter, { $set: { status: 'failed' } }, { session: transaction });
  return result.matchedCount === 1;
}

export async function reconcileJobs(queue: Pick<Queue, 'add'>, now = new Date()) {
  const expired = { status: 'running' as const, leaseUntil: { $lte: now } };
  const clearLease = { leaseId: 1 as const, leaseUntil: 1 as const };
  await jobs.updateMany({ ...expired, providerInFlight: true }, { $set: { status: 'needs_review' }, $unset: clearLease });
  await jobs.updateMany({ ...expired, providerInFlight: false, attempts: { $gte: maxAttempts } },
    { $set: { status: 'failed' }, $unset: clearLease });
  await jobs.updateMany({ ...expired, providerInFlight: false, attempts: { $lt: maxAttempts } },
    { $set: { status: 'queued' }, $unset: clearLease });

  const pending = await jobs.find({ status: 'queued' }).sort({ updatedAt: 1, _id: 1 }).limit(100).select('_id').lean();
  for (const job of pending) await queue.add('studio', { id: job._id }, { jobId: job._id, removeOnComplete: true, removeOnFail: true });
  return pending.length;
}

export function claimJob(id: string, now = new Date()) {
  return jobs.findOneAndUpdate({ _id: id, status: 'queued', attempts: { $lt: maxAttempts } }, {
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
