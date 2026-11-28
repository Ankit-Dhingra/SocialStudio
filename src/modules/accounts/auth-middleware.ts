import { clerkMiddleware, getAuth } from '@clerk/express';
import type { RequestHandler } from 'express';
import type { ClerkConfig } from './auth-config.js';
import { getStudioUser, VerifiedEmailRequired } from './users.js';

export function studioAuthentication(config: ClerkConfig, loadAccount = getStudioUser): RequestHandler[] {
  const requireBearer: RequestHandler = (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    if (!/^Bearer [^\s,]+$/i.test(req.get('Authorization') ?? '')) {
      res.status(401).json({ error: 'Sign in to continue.' });
      return;
    }
    next();
  };

  return [requireBearer, clerkMiddleware({
    publishableKey: config.publishableKey,
    secretKey: config.secretKey,
    jwtKey: config.jwtKey,
    authorizedParties: [config.frontendOrigin],
  }), async (req, res, next) => {
    try {
      const auth = getAuth(req, { acceptsToken: 'session_token' });
      if (!auth.isAuthenticated || !auth.userId || auth.sessionClaims.azp !== config.frontendOrigin) {
        return res.status(401).json({ error: 'Sign in to continue.' });
      }
      if (config.stagingOwnerOnly && auth.userId !== config.ownerClerkUserId) {
        return res.status(403).json({ error: 'Hosted staging is restricted to the Studio owner.' });
      }
      const account = await loadAccount(auth.userId, config);
      if (config.stagingOwnerOnly && account.role !== 'owner') {
        return res.status(403).json({ error: 'Hosted staging is restricted to the Studio owner.' });
      }
      if (account.status !== 'active') return res.status(403).json({ error: 'This account is unavailable.' });
      res.locals.studioAccount = account;
      res.locals.studioMfaAge = auth.factorVerificationAge?.[1];
      next();
    } catch (error) {
      if (error instanceof VerifiedEmailRequired) return res.status(403).json({ error: 'Verify your email to continue.' });
      console.error('[Auth] Account authentication unavailable.');
      return res.status(503).json({ error: 'Account services temporarily unavailable.' });
    }
  }];
}

export function requireOwner(config: Pick<ClerkConfig, 'requireOwnerMfa'>): RequestHandler {
  return (_req, res, next) => {
    if (res.locals.studioAccount?.role !== 'owner') {
      res.status(403).json({ error: 'Owner access is required.' });
      return;
    }
    const age = res.locals.studioMfaAge;
    if (config.requireOwnerMfa && (!Number.isFinite(age) || age < 0 || age > 15)) {
      res.status(403).json({ error: 'Verify your second factor to continue.' });
      return;
    }
    next();
  };
}
