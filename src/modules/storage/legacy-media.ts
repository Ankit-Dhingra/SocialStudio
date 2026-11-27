import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import type { PrivateMedia } from './private-media.js';
import type { ScriptSession } from '../ai-script/master-script-service.js';

const roots: Record<string, string> = { 'media/runs': 'media/runs', audio: 'remotion/public/audio', previews: 'remotion/public/previews' };
const types: Record<string, string> = { mp4: 'video/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

export async function copyLegacyMedia(ownerId: string, session: ScriptSession, storage: PrivateMedia) {
  const sources = new Set<string>();
  JSON.stringify(session, (_key, value) => {
    if (typeof value === 'string' && /^\/(?:media\/runs|audio|previews)\/[a-zA-Z0-9/_\-.]+\.(?:mp4|mp3|wav|png|jpg|webp)$/.test(value)) sources.add(value);
    return value;
  });
  if (sources.size > 150) throw new Error('Too many legacy media references in one project.');
  const media: { source: string; key: string }[] = [];
  for (const source of sources) {
    const prefix = Object.keys(roots).find(key => source.startsWith(`/${key}/`))!;
    const relative = source.slice(prefix.length + 2);
    if (relative.split('/').some(segment => !segment || segment === '.' || segment === '..')) continue;
    const directory = await realpath(roots[prefix]).catch(() => undefined);
    if (!directory) continue;
    const candidate = await realpath(path.join(directory, relative)).catch(() => undefined);
    if (!candidate) continue;
    const underRoot = path.relative(directory, candidate);
    if (!underRoot || underRoot.startsWith(`..${path.sep}`) || path.isAbsolute(underRoot)) continue;
    const extension = path.extname(source).slice(1);
    const hash = createHash('sha256').update(`${ownerId}\0${session.id}\0${source}\0`);
    for await (const bytes of createReadStream(candidate)) hash.update(bytes);
    const key = `${hash.digest('hex')}.${extension}`;
    await storage.put(key, candidate, types[extension]);
    media.push({ source, key });
  }
  return media;
}
