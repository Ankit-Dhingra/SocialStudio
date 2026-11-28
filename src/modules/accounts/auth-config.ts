export function studioMongoUri(env: NodeJS.ProcessEnv) {
  const mongodbUri = env.MONGODB_URI?.trim();
  if (!mongodbUri) throw new Error('MONGODB_URI is required.');
  if (env.NODE_ENV === 'production') {
    const options = new URLSearchParams(mongodbUri.split('?')[1]?.toLowerCase());
    const disablesTls = ['tls', 'ssl'].some(name => options.getAll(name).includes('false'));
    const bypassesVerification = ['tlsinsecure', 'tlsallowinvalidcertificates', 'tlsallowinvalidhostnames']
      .some(name => options.getAll(name).includes('true'));
    const usesTls = mongodbUri.startsWith('mongodb+srv://') || ['tls', 'ssl'].some(name => options.getAll(name).includes('true'));
    if (!usesTls || disablesTls || bypassesVerification || env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
      throw new Error('Production requires MongoDB TLS with verified certificates and hostnames.');
    }
  }

  return mongodbUri;
}

export function clerkConfig(env: NodeJS.ProcessEnv) {
  const productionRuntime = env.NODE_ENV === 'production';
  const staging = env.SOCIALSTUDIO_DEPLOYMENT === 'staging';
  if (staging && !productionRuntime) throw new Error('Hosted staging requires the production runtime.');
  if (!productionRuntime && env.SOCIALSTUDIO_AUTH !== 'clerk') return undefined;

  const names = ['CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY', 'MONGODB_URI', 'FRONTEND_URL', 'OWNER_EMAIL'] as const;
  const missing = names.filter(name => !env[name]?.trim());
  if (missing.length) throw new Error(`Missing SocialStudio authentication configuration: ${missing.join(', ')}.`);

  const frontend = new URL(env.FRONTEND_URL!);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(frontend.hostname);
  if (frontend.origin !== env.FRONTEND_URL?.replace(/\/$/, '') ||
    (frontend.protocol !== 'https:' && !(local && frontend.protocol === 'http:' && !productionRuntime))) {
    throw new Error('FRONTEND_URL must be a valid application origin.');
  }

  const publishableKey = env.CLERK_PUBLISHABLE_KEY!.trim();
  const secretKey = env.CLERK_SECRET_KEY!.trim();
  const ownerClerkUserId = env.OWNER_CLERK_USER_ID?.trim() || undefined;
  if (staging) {
    if (!publishableKey.startsWith('pk_test_') || !secretKey.startsWith('sk_test_') || !ownerClerkUserId) {
      throw new Error('Hosted staging requires Clerk development keys and a pinned owner.');
    }
    if (env.STUDIO_GENERATION_ENABLED === 'true' || env.STUDIO_TRIALS_ENABLED === 'true') {
      throw new Error('Hosted staging keeps generation and trials disabled.');
    }
  } else if (productionRuntime && (!publishableKey.startsWith('pk_live_') || !secretKey.startsWith('sk_live_'))) {
    throw new Error('Production requires keys from a Clerk production instance.');
  }
  const mongodbUri = studioMongoUri(env);

  return {
    frontendOrigin: frontend.origin,
    publishableKey,
    secretKey,
    jwtKey: env.CLERK_JWT_KEY?.trim().replace(/\\n/g, '\n') || undefined,
    mongodbUri,
    ownerEmail: env.OWNER_EMAIL!.trim().toLowerCase(),
    ownerClerkUserId,
    requireOwnerMfa: productionRuntime || env.OWNER_REQUIRE_MFA === 'true',
    ...(staging && { stagingOwnerOnly: true }),
  };
}

export type ClerkConfig = NonNullable<ReturnType<typeof clerkConfig>>;
