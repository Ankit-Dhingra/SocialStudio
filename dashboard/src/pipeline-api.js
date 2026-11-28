const storageKey = 'socialstudio.pipeline-owner';
export const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
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

async function readResult(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Studio request failed (HTTP ${response.status}).`);
  return data;
}

export async function hostedProject(toApiUrl, id) {
  return readResult(await pipelineFetch(toApiUrl(`/api/pipeline/script/${encodeURIComponent(id)}`), { cache: 'no-store' }));
}

export async function runHostedJob(toApiUrl, input, onStatus) {
  const request = await readResult(await pipelineFetch(toApiUrl('/api/pipeline/jobs'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(input),
  }));
  const deadline = Date.now() + 20 * 60_000;
  while (Date.now() < deadline) {
    const status = await readResult(await pipelineFetch(toApiUrl(`/api/pipeline/jobs/${request.id}`)));
    onStatus?.(status);
    if (status.status === 'completed') return hostedProject(toApiUrl, request.projectId);
    if (status.status === 'needs_review') throw new Error('A provider result needs review. Your credits are reserved while it is reconciled.');
    if (status.status === 'failed') throw new Error('Generation failed. This job did not consume credits.');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('This job is still processing. Reopen the project to see the latest saved result.');
}
