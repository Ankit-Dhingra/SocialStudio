import mongoose, { Schema } from 'mongoose';
import { createHash } from 'node:crypto';
import { clerkClient } from '@clerk/express';
import type { ClerkConfig } from './auth-config.js';

const userSchema = new Schema({
  clerkUserId: { type: String, required: true, unique: true, immutable: true },
  email: { type: String, required: true },
  displayName: { type: String, required: true },
  role: { type: String, enum: ['owner', 'member'], default: 'member', required: true },
  status: { type: String, enum: ['active', 'suspended'], default: 'active', required: true },
  plan: { type: String, default: null },
  trialEligibility: { type: String, enum: ['unassessed', 'eligible', 'claimed', 'ineligible'], default: 'unassessed' },
}, { timestamps: true });

userSchema.index({ role: 1 }, { unique: true, partialFilterExpression: { role: 'owner' } });
const StudioUser = mongoose.model('User', userSchema);

export const hasActiveOwner = (clerkUserId: string) => StudioUser.exists({ clerkUserId, role: 'owner', status: 'active' });
export const hasActiveAccount = (clerkUserId: string) => StudioUser.exists({ clerkUserId, status: 'active' });

export async function connectAccounts(uri: string) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8_000, maxPoolSize: 10 });
  await StudioUser.init();
}

export class VerifiedEmailRequired extends Error {}
export class OwnerIdentityMismatch extends Error {}

type ClerkProfile = Awaited<ReturnType<typeof clerkClient.users.getUser>>;

export function verifiedOwnerGoogleSubjectHash(profile: ClerkProfile, id: string, ownerEmail: string) {
  const primary = profile.primaryEmailAddress;
  const google = profile.externalAccounts.filter(account => ['google', 'oauth_google'].includes(account.provider) &&
    account.verification?.status === 'verified' && account.emailAddress.trim().toLowerCase() === ownerEmail);
  if (profile.id !== id || primary?.verification?.status !== 'verified' ||
    primary.emailAddress.trim().toLowerCase() !== ownerEmail || google.length !== 1 || !google[0].providerUserId) {
    throw new OwnerIdentityMismatch();
  }
  return createHash('sha256').update(google[0].providerUserId).digest('hex');
}

export function accountProfile(profile: ClerkProfile, config: Pick<ClerkConfig, 'ownerEmail' | 'ownerClerkUserId'>) {
  const primary = profile.primaryEmailAddress;
  if (primary?.verification?.status !== 'verified') throw new VerifiedEmailRequired();
  const email = primary.emailAddress.trim().toLowerCase();
  const ownerCandidate = email === config.ownerEmail &&
    (!config.ownerClerkUserId || profile.id === config.ownerClerkUserId) &&
    profile.externalAccounts.some(account => ['google', 'oauth_google'].includes(account.provider) &&
      account.emailAddress.trim().toLowerCase() === email && account.verification?.status === 'verified');

  return {
    email,
    displayName: [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim().slice(0, 200) || 'SocialStudio user',
    ownerCandidate,
  };
}

export async function getStudioUser(clerkUserId: string, config: ClerkConfig,
  loadProfile = (id: string) => clerkClient.users.getUser(id)) {
  if (config.priorOwnerId && config.ownerGoogleSubjectHash) {
    if (clerkUserId === config.priorOwnerId) throw new OwnerIdentityMismatch();
    if (clerkUserId === config.ownerClerkUserId) {
      const profile = await loadProfile(clerkUserId);
      if (verifiedOwnerGoogleSubjectHash(profile, clerkUserId, config.ownerEmail) !== config.ownerGoogleSubjectHash) {
        throw new OwnerIdentityMismatch();
      }
      // Refuse to collapse an existing second Studio account into the original owner account.
      const [owner, duplicate] = await Promise.all([
        StudioUser.findOne({ clerkUserId: config.priorOwnerId, role: 'owner', status: 'active', email: config.ownerEmail }),
        StudioUser.exists({ clerkUserId }),
      ]);
      if (!owner || duplicate) throw new OwnerIdentityMismatch();
      return owner;
    }
  }
  const existing = await StudioUser.findOne({ clerkUserId });
  if (existing) {
    if (existing.role === 'owner' && config.ownerClerkUserId && clerkUserId !== config.ownerClerkUserId) {
      throw new OwnerIdentityMismatch();
    }
    return existing;
  }

  const profile = await loadProfile(clerkUserId);
  if (profile.id !== clerkUserId) throw new Error('Clerk profile identifier mismatch.');
  const { email, displayName, ownerCandidate } = accountProfile(profile, config);

  const upsert = (role: 'owner' | 'member') => StudioUser.findOneAndUpdate({ clerkUserId }, {
    $setOnInsert: { clerkUserId, email, displayName, role },
  }, { upsert: true, returnDocument: 'after', runValidators: true, requireFilter: true }).orFail();

  try {
    return await upsert(ownerCandidate ? 'owner' : 'member');
  } catch (error) {
    if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 11000) throw error;
    const concurrentlyCreated = await StudioUser.findOne({ clerkUserId });
    if (concurrentlyCreated) return concurrentlyCreated;
    if (!ownerCandidate) throw error;
    return upsert('member');
  }
}

export type StudioAccount = Awaited<ReturnType<typeof getStudioUser>>;
