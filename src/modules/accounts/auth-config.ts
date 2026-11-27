export function clerkConfig(env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV !== 'production' && env.SOCIALSTUDIO_AUTH !== 'clerk') return undefined;

  const names = ['CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY', 'MONGODB_URI', 'FRONTEND_URL', 'OWNER_EMAIL'] as const;
  const missing = names.filter(name => !env[name]?.trim());
  if (missing.length) throw new Error(`Missing SocialStudio authentication configuration: ${missing.join(', ')}.`);

  const frontend = new URL(env.FRONTEND_URL!);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(frontend.hostname);
  if (frontend.origin !== env.FRONTEND_URL?.replace(/\/$/, '') ||
    (frontend.protocol !== 'https:' && !(local && frontend.protocol === 'http:' && env.NODE_ENV !== 'production'))) {
    throw new Error('FRONTEND_URL must be a valid application origin.');
  }

  const publishableKey = env.CLERK_PUBLISHABLE_KEY!.trim();
  const secretKey = env.CLERK_SECRET_KEY!.trim();
  if (env.NODE_ENV === 'production' && (!publishableKey.startsWith('pk_live_') || !secretKey.startsWith('sk_live_'))) {
    throw new Error('Production requires keys from a Clerk production instance.');
  }

  return {
    frontendOrigin: frontend.origin,
    publishableKey,
    secretKey,
    jwtKey: env.CLERK_JWT_KEY?.trim().replace(/\\n/g, '\n') || undefined,
    mongodbUri: env.MONGODB_URI!.trim(),
    ownerEmail: env.OWNER_EMAIL!.trim().toLowerCase(),
    ownerClerkUserId: env.OWNER_CLERK_USER_ID?.trim() || undefined,
    requireOwnerMfa: env.NODE_ENV === 'production' || env.OWNER_REQUIRE_MFA === 'true',
  };
}

export type ClerkConfig = NonNullable<ReturnType<typeof clerkConfig>>;
