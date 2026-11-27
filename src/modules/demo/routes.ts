import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { demoReels } from './catalog.js';

const mediaNames = new Set(demoReels.flatMap(({ id }) => [`${id}.mp4`, `${id}.jpg`]));

export function demoRouter(options: { directory?: string; publicBaseUrl?: string } = {}) {
  const router = Router();
  const root = path.resolve(options.directory || 'media/demo');
  const storage = options.publicBaseUrl ? new URL(options.publicBaseUrl) : undefined;
  if (storage && (storage.protocol !== 'https:' || storage.username || storage.password || storage.search || storage.hash)) {
    throw new Error('DEMO_PUBLIC_BASE_URL must be an HTTPS media base URL.');
  }
  const mediaBase = storage ? `${storage.href.replace(/\/+$/, '')}/` : '/api/demo/media/';
  const available = async (name: string) => (await lstat(path.join(root, name)).catch(() => undefined))?.isFile() === true;

  router.get('/reels', async (_req, res) => {
    const items = await Promise.all(demoReels.map(async (reel, index) => {
      const video = `${reel.id}.mp4`;
      const thumbnail = `${reel.id}.jpg`;
      if (!storage && (!await available(video) || !await available(thumbnail))) return undefined;
      return { ...reel, order: index + 1, videoUrl: mediaBase + video, thumbnailUrl: mediaBase + thumbnail };
    }));
    res.set('Cache-Control', 'public, max-age=60').json({ reels: items.filter(Boolean) });
  });

  if (!storage) router.get('/media/:name', async (req, res, next) => {
    const { name } = req.params;
    if (!mediaNames.has(name) || !await available(name)) return next();
    res.set('X-Content-Type-Options', 'nosniff');
    res.sendFile(name, { root, maxAge: '1h', dotfiles: 'deny' }, error => {
      if (error && (error as NodeJS.ErrnoException).code !== 'ECONNABORTED' && !res.destroyed) next(error);
    });
  });

  router.use((_req, res) => { res.status(404).json({ error: 'Demo resource unavailable.' }); });
  return router;
}
