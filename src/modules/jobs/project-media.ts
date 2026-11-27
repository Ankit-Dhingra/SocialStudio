import { createHash } from 'node:crypto';
import type { PrivateMedia } from '../storage/private-media.js';

export type MediaBinding = { source: string; key: string };

export function narrationBindings(entries: readonly { source?: string | null; key?: string | null }[], storage?: PrivateMedia) {
  const bindings = new Map(entries.map(entry => [entry.source, entry.key]));
  return (source: string) => {
    const key = bindings.get(`/${source}`);
    if (!key || !storage?.verify) return Promise.reject(new Error('Saved narration is unavailable.'));
    return storage.verify(key);
  };
}

export async function publishJobMedia(storage: PrivateMedia, jobId: string, leaseId: string, source: string, file: string) {
  const extension = /\.(mp3|mp4|png|jpg|webp)$/.exec(source)?.[1];
  if (!extension) throw new Error('Unsupported generation artifact.');
  const type = { mp3: 'audio/mpeg', mp4: 'video/mp4', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
  const key = `${createHash('sha256').update(JSON.stringify([jobId, leaseId, source])).digest('hex')}.${extension}`;
  await storage.put(key, file, type[extension as keyof typeof type]);
  return { source, key };
}
