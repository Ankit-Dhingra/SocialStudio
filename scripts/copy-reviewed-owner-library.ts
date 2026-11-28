import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { studioMongoUri } from '../src/modules/accounts/auth-config.js';
import { sessionIdPattern } from '../src/modules/pipeline/session-owner.js';

const database = 'socialstudio';

function atlasUri(value: string | undefined) {
  const uri = studioMongoUri({ ...process.env, NODE_ENV: 'production', MONGODB_URI: value });
  const endpoint = new URL(uri);
  if (endpoint.protocol !== 'mongodb+srv:' || !endpoint.hostname.endsWith('.mongodb.net') ||
    endpoint.pathname !== `/${database}` || !endpoint.username || !endpoint.password) {
    throw new Error('Expected an Atlas SRV connection scoped to the SocialStudio database.');
  }
  return endpoint;
}

async function copyLibrary() {
  const { OWNER_CLERK_USER_ID: ownerId, SOURCE_MONGODB_URI, DESTINATION_MONGODB_URI, DESTINATION_ATLAS_HOST } = process.env;
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const ids = args.filter(arg => arg !== '--apply');
  if (!ownerId || ids.length !== 9 || new Set(ids).size !== ids.length || !ids.every(id => sessionIdPattern.test(id))) {
    throw new Error('Supply the pinned owner ID and nine distinct reviewed project IDs.');
  }
  const sourceUri = atlasUri(SOURCE_MONGODB_URI);
  const destinationUri = atlasUri(DESTINATION_MONGODB_URI);
  if (sourceUri.hostname === destinationUri.hostname || destinationUri.hostname !== DESTINATION_ATLAS_HOST?.toLowerCase()) {
    throw new Error('Verify the separate destination hostname in the SocialStudio Atlas dashboard.');
  }

  const source = new mongoose.mongo.MongoClient(sourceUri.href, { serverSelectionTimeoutMS: 8000 });
  const destination = new mongoose.mongo.MongoClient(destinationUri.href, { serverSelectionTimeoutMS: 8000 });
  try {
    const result = await copyReviewedOwnerLibrary(source.db(database), destination.db(database), destination, ownerId, ids, apply);
    console.log(`${apply ? 'Copied' : 'Verified'} ${result.projects} reviewed projects and ${result.media} existing media bindings. ${result.pending} project records ${apply ? 'inserted' : 'eligible for insertion'}.`);
  } finally {
    await Promise.all([source.close(), destination.close()]);
  }
}

export async function copyReviewedOwnerLibrary(from: mongoose.mongo.Db, to: mongoose.mongo.Db,
  destination: mongoose.mongo.MongoClient, ownerId: string, ids: string[], apply: boolean) {
  const owner = await from.collection('users').findOne({ clerkUserId: ownerId, role: 'owner', status: 'active' });
  const projects = await from.collection('projects').find({
    ownerId, projectId: { $in: ids }, deletedAt: { $exists: false },
  }).toArray();
  if (!owner || projects.length !== ids.length || !ids.every(id => projects.some(project => project.projectId === id))) {
    throw new Error('Source owner or reviewed projects are missing.');
  }
  const reviewedOwner = owner;
  const mediaKeys = new Set<string>();
  for (const project of projects) {
    const media = project.media;
    const exportPath = project.session?.renderState?.mediaUrl;
    if (!Array.isArray(media) || typeof exportPath !== 'string' ||
      !media.some(entry => entry.source === exportPath && entry.key?.endsWith('.mp4'))) {
      throw new Error('A reviewed project is missing its registered export.');
    }
    for (const entry of media) {
      if (!/^[a-f0-9]{64}\.(?:mp4|mp3|wav|png|jpg|webp)$/.test(entry.key) || typeof entry.source !== 'string') {
        throw new Error('A reviewed project has an invalid private media binding.');
      }
      mediaKeys.add(entry.key);
    }
  }
  if (mediaKeys.size !== 113) throw new Error('The source media count differs from the reviewed inventory.');

  async function transfer(transaction?: mongoose.mongo.ClientSession) {
    const options = { session: transaction };
    const users = to.collection('users');
    const items = to.collection('projects');
    const existingUsers = await users.find({
      $or: [{ _id: reviewedOwner._id }, { clerkUserId: ownerId }, { role: 'owner' }],
    }, options).toArray();
    const existingProjects = await items.find({
      $or: [{ projectId: { $in: ids } }, { _id: { $in: projects.map(project => project._id) } }],
    }, options).toArray();
    if (existingUsers.length > 1 || existingUsers.some(record => !isDeepStrictEqual(record, reviewedOwner)) ||
      existingProjects.some(record => !projects.some(project => isDeepStrictEqual(record, project)))) {
      throw new Error('The destination contains conflicting records. Review them before retrying.');
    }
    const pending = projects.filter(project => !existingProjects.some(record => record._id.equals(project._id)));
    if (transaction) {
      if (!existingUsers.length) await users.insertOne(reviewedOwner, options);
      if (pending.length) await items.insertMany(pending, options);
    }
    return { pending: pending.length, ownerMissing: existingUsers.length === 0 };
  }

  const result = apply ? await destination.withSession(session => session.withTransaction(() => transfer(session))) :
    await transfer();
  if (apply) {
    const readback = await transfer();
    if (readback.pending || readback.ownerMissing) throw new Error('Destination readback did not match the source.');
  }
  return { projects: projects.length, media: mediaKeys.size, pending: result.pending };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await copyLibrary().catch(() => {
    console.error('Library copy stopped. Verify the two scoped Atlas connections, the pinned owner, the reviewed project and media counts, and any destination conflicts.');
    process.exitCode = 1;
  });
}
