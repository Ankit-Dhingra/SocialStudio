import mongoose, { Schema, type ClientSession } from 'mongoose';
import { z } from 'zod';
import type { ScriptSession } from '../ai-script/master-script-service.js';
import { sessionIdPattern } from '../pipeline/session-owner.js';

const projects = mongoose.model('StudioProject', new Schema({
  projectId: { type: String, required: true, unique: true, immutable: true },
  ownerId: { type: String, required: true, immutable: true },
  revision: { type: Number, required: true, default: 0 },
  updatedAt: { type: Number, required: true },
  hasAudio: { type: Boolean, required: true },
  scenesCount: { type: Number, required: true },
  deletedAt: Date,
  media: { type: [new Schema({ source: String, key: String }, { _id: false })], default: [] },
  session: { type: Schema.Types.Mixed, required: true },
}, { collection: 'projects' }).index({ ownerId: 1, updatedAt: -1 }));

const migrationShape = z.object({ id: z.string().regex(sessionIdPattern), topic: z.string().min(1),
  createdAt: z.number().finite(), updatedAt: z.number().finite(), currentMarkdown: z.string(),
  messages: z.array(z.unknown()), sections: z.record(z.string(), z.unknown()),
  storyboard: z.object({ title: z.string(), scenes: z.array(z.unknown()) }).passthrough() }).passthrough();

export const initProjects = () => projects.init();

export function getProject(ownerId: string, projectId: string, transaction?: ClientSession) {
  if (!sessionIdPattern.test(projectId)) return Promise.resolve(null);
  return projects.findOne({ ownerId, projectId, deletedAt: { $exists: false } }, null, { session: transaction }).lean().exec();
}

export function listProjects(ownerId: string) {
  return projects.find({ ownerId, deletedAt: { $exists: false } }).sort({ updatedAt: -1, projectId: 1 }).limit(100)
    .select('projectId updatedAt hasAudio scenesCount media session.createdAt session.topic session.angle session.storyboard.title session.storyboard.estimatedDurationSec session.finalized session.renderState.status session.renderState.mediaUrl session.renderState.qa.durationSec')
    .lean().exec();
}

function storedSession(session: ScriptSession) {
  const { ownerDigest: _legacyOwner, ...data } = session;
  if (Buffer.byteLength(JSON.stringify(data)) > 8 * 1024 * 1024) throw new Error('Project metadata exceeds the storage limit.');
  return data;
}

export async function createProject(ownerId: string, session: ScriptSession) {
  await projects.create({ ownerId, projectId: session.id, ...projectFields(storedSession(session)) });
}

export async function replaceProject(ownerId: string, session: ScriptSession, revision: number) {
  const updated = await projects.updateOne({ ownerId, projectId: session.id, revision, deletedAt: { $exists: false } }, {
    $set: projectFields(storedSession(session)), $inc: { revision: 1 },
  });
  return updated.modifiedCount === 1;
}

export async function registerProjectMedia(ownerId: string, sessionId: string, revision: number, media: { source: string; key: string }[]) {
  const result = await projects.updateOne({ ownerId, projectId: sessionId, revision, deletedAt: { $exists: false } }, { $set: { media } });
  return result.matchedCount === 1;
}

export async function archiveProject(ownerId: string, projectId: string) {
  if (!sessionIdPattern.test(projectId)) return false;
  const result = await projects.updateOne({ ownerId, projectId, deletedAt: { $exists: false } }, { $set: { deletedAt: new Date() } });
  return result.modifiedCount === 1;
}

function projectFields(session: Omit<ScriptSession, 'ownerDigest'>) {
  return { session, updatedAt: session.updatedAt, hasAudio: !!session.audioResult?.clips?.length, scenesCount: session.storyboard.scenes.length };
}

export function validateImportedProject(input: unknown) {
  const original = storedSession(migrationShape.parse(input) as unknown as ScriptSession);
  // An interrupted legacy generation is never resumed by loading a migrated project.
  if (original.job?.status === 'running') original.job = { ...original.job, status: 'failed', message: 'Imported from an interrupted legacy run.' };
  if (original.renderState?.status === 'rendering') original.renderState = { status: 'idle', progress: 0 };
  return original;
}

export async function importProject(ownerId: string, input: unknown) {
  const session = validateImportedProject(input);
  try {
    const result = await projects.updateOne({ ownerId, projectId: session.id }, {
      $setOnInsert: { ownerId, projectId: session.id, ...projectFields(session) },
    }, { upsert: true });
    return result.upsertedCount === 1;
  } catch (error) {
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000 && await getProject(ownerId, session.id)) return false;
    throw error;
  }
}
