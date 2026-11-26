const storageKey = 'socialstudio.pipeline-owner';
let owner;

export function pipelineFetch(url, options = {}) {
  if (!owner) {
    try { owner = localStorage.getItem(storageKey); } catch { /* Browser storage is optional. */ }
    if (!/^[a-f0-9]{64}$/.test(owner || '')) {
      owner = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
      try { localStorage.setItem(storageKey, owner); } catch { /* Keep the credential for this tab. */ }
    }
  }
  const headers = new Headers(options.headers);
  headers.set('X-SocialStudio-Owner', owner);
  return fetch(url, { ...options, headers });
}
