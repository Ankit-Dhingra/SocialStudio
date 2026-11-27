import { generateKeyPairSync, sign } from 'node:crypto';
import type { ClerkConfig } from '../../src/modules/accounts/auth-config.js';

export const fixtureFrontendOrigin = 'https://studio.example.test';
export const fixtureOwnerEmail = 'owner@example.test';
export const fixtureOwnerId = 'user_verified_owner';

export function signedSessions() {
  const clerkHostname = 'app.clerk.accounts.dev';
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const config: ClerkConfig = {
    frontendOrigin: fixtureFrontendOrigin, publishableKey: `pk_test_${Buffer.from(`${clerkHostname}$`).toString('base64')}`,
    secretKey: 'sk_test_mock', jwtKey: publicKey.export({ format: 'pem', type: 'spki' }),
    mongodbUri: 'unused', ownerEmail: fixtureOwnerEmail, ownerClerkUserId: fixtureOwnerId, requireOwnerMfa: true,
  };
  const token = (sub: string, secondFactorAge = -1, azp = fixtureFrontendOrigin) => {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT', kid: 'studio-test', cat: 'cl_B7d4PD111AAA' };
    const claims = { sub, azp, sid: `sess_${sub}`, sts: 'active', fva: [0, secondFactorAge],
      iss: `https://${clerkHostname}`, iat: now, nbf: now - 5, exp: now + 60, v: 2 };
    const message = [header, claims].map(part => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.');
    return `${message}.${sign('RSA-SHA256', Buffer.from(message), privateKey).toString('base64url')}`;
  };
  return { config, token };
}
