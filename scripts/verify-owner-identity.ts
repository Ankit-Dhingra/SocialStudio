import { createClerkClient } from '@clerk/express';
import mongoose from 'mongoose';
import { studioMongoUri } from '../src/modules/accounts/auth-config.js';
import { connectAccounts, hasActiveOwner, verifiedOwnerGoogleSubjectHash } from '../src/modules/accounts/users.js';
import { listProjects } from '../src/modules/projects/repository.js';

async function main() {
  const { CLERK_DEV_SECRET_KEY, CLERK_SECRET_KEY, OWNER_PRIOR_CLERK_USER_ID, OWNER_CLERK_USER_ID } = process.env;
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!CLERK_DEV_SECRET_KEY?.startsWith('sk_test_') || !CLERK_SECRET_KEY?.startsWith('sk_live_') ||
    !OWNER_PRIOR_CLERK_USER_ID || !OWNER_CLERK_USER_ID || OWNER_PRIOR_CLERK_USER_ID === OWNER_CLERK_USER_ID || !ownerEmail) {
    throw new Error('Supply both Clerk instance secrets, the two distinct reviewed Clerk IDs, and the expected owner email.');
  }
  const development = createClerkClient({ secretKey: CLERK_DEV_SECRET_KEY });
  const production = createClerkClient({ secretKey: CLERK_SECRET_KEY });
  const [prior, claimant] = await Promise.all([
    development.users.getUser(OWNER_PRIOR_CLERK_USER_ID),
    production.users.getUser(OWNER_CLERK_USER_ID),
  ]);
  const hash = verifiedOwnerGoogleSubjectHash(prior, OWNER_PRIOR_CLERK_USER_ID, ownerEmail);
  if (hash !== verifiedOwnerGoogleSubjectHash(claimant, OWNER_CLERK_USER_ID, ownerEmail)) {
    throw new Error('The pinned Clerk accounts have different verified Google subjects.');
  }
  await connectAccounts(studioMongoUri({ ...process.env, NODE_ENV: 'production' }));
  if (!await hasActiveOwner(OWNER_PRIOR_CLERK_USER_ID)) throw new Error('The prior Studio owner is missing or inactive.');
  if (await mongoose.connection.db!.collection('users').findOne({ clerkUserId: OWNER_CLERK_USER_ID })) {
    throw new Error('The production identity already has an application account. Review it before considering a migration.');
  }
  const projects = await listProjects(OWNER_PRIOR_CLERK_USER_ID);
  console.log(`Verified both Clerk identities against the same Google subject. Existing owner projects visible: ${projects.length}.`);
  console.log(`OWNER_GOOGLE_SUBJECT_HASH=${hash}`);
}

try {
  await main();
} catch {
  console.error('Owner verification failed. Check the two pinned IDs, verified Google links, Atlas owner and production account status.');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
