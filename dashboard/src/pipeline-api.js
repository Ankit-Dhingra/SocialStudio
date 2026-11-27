const storageKey = 'socialstudio.pipeline-owner';
const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const apiOrigin = new URL(import.meta.env.VITE_API_URL || '/', window.location.origin).origin;
let owner;
let getSessionToken;

export function registerPipelineTokenGetter(getToken) {
  getSessionToken = getToken;
  return () => { if (getSessionToken === getToken) getSessionToken = undefined; };
}

export async function pipelineFetch(url, options = {}) {
  const headers = new Headers(options.headers);
  const target = new URL(url, window.location.origin);
  if (target.origin !== apiOrigin) throw new Error('Invalid Studio API origin.');

  if (clerkEnabled) {
    const token = await getSessionToken?.();
    if (!token) throw new Error('Sign in to continue.');
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(target, { ...options, headers, redirect: 'error' });
  }

  if (!owner) {
    try { owner = localStorage.getItem(storageKey); } catch { /* Browser storage is optional. */ }
    if (!/^[a-f0-9]{64}$/.test(owner || '')) {
      owner = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
      try { localStorage.setItem(storageKey, owner); } catch { /* Keep the credential for this tab. */ }
    }
  }
  headers.set('X-SocialStudio-Owner', owner);
  return fetch(target, { ...options, headers });
}
