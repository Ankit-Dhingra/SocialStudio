import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { ScriptSession } from '../ai-script/master-script-service.js';

const cookieName = 'socialstudio_owner';
export const sessionIdPattern = /^session_[a-zA-Z0-9_-]{1,100}$/;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

function ownerToken(req: Request) {
  const provided = req.get('X-SocialStudio-Owner');
  if (provided && /^[a-f0-9]{64}$/.test(provided)) return provided;
  return new RegExp(`(?:^|;\\s*)${cookieName}=([a-f0-9]{64})(?:;|$)`).exec(req.headers.cookie ?? '')?.[1];
}

export function ownerFor(req: Request, res: Response) {
  const existing = ownerToken(req);
  if (existing) return digest(existing);
  const issued = res.locals.ownerToken as string | undefined;
  if (issued) return digest(issued);
  const token = randomBytes(32).toString('hex');
  res.locals.ownerToken = token;
  res.cookie(cookieName, token, { httpOnly: true, secure: req.secure || process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge: 365 * 86_400_000, path: '/' });
  return digest(token);
}

export function ownsSession(req: Request, session: ScriptSession) {
  const token = ownerToken(req);
  return Boolean(token && session.ownerDigest === digest(token));
}

export function canAdoptLocalSession(req: Request) {
  return Boolean(ownerToken(req)) && process.env.NODE_ENV !== 'production' && /^(?:::ffff:)?127\.0\.0\.1$|^::1$/.test(req.socket.remoteAddress ?? '')
    && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(req.headers.host ?? '')
    && (!req.headers.origin || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(req.headers.origin));
}

export function canProvisionLegacySession(req: Request) {
  const expected = process.env.AUTOMATION_TOKEN;
  const provided = req.get('X-Automation-Token');
  return Boolean(ownerToken(req) && expected && provided &&
    timingSafeEqual(Buffer.from(digest(expected), 'hex'), Buffer.from(digest(provided), 'hex')));
}
