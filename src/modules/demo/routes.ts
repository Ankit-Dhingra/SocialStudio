import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { demoReels } from './catalog.js';

const mediaNames = new Set(demoReels.flatMap(({ id }) => [`${id}.mp4`, `${id}.jpg`]));

function publicMediaBase(value?: string) {
  if (!value) return undefined;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Public demo media base URLs must use HTTPS without credentials, query parameters or fragments.');
  }
  return `${url.href.replace(/\/+$/, '')}/`;
}

export function demoRouter(options: { directory?: string; publicBaseUrl?: string; videoBaseUrl?: string; imageBaseUrl?: string } = {}) {
  const router = Router();
  const root = path.resolve(options.directory || 'media/demo');
  const sharedBase = publicMediaBase(options.publicBaseUrl);
  const videoBase = publicMediaBase(options.videoBaseUrl) ?? sharedBase;
  const imageBase = publicMediaBase(options.imageBaseUrl) ?? sharedBase;
  if (Boolean(videoBase) !== Boolean(imageBase)) throw new Error('Public demo media requires both video and image delivery URLs.');
  const localBase = '/api/demo/media/';
  const available = async (name: string) => (await lstat(path.join(root, name)).catch(() => undefined))?.isFile() === true;

  router.get('/reels', async (_req, res) => {
    const items = await Promise.all(demoReels.map(async (reel, index) => {
      const video = `${reel.id}.mp4`;
      const thumbnail = `${reel.id}.jpg`;
      if (!videoBase && (!await available(video) || !await available(thumbnail))) return undefined;
      return { ...reel, order: index + 1, videoUrl: (videoBase ?? localBase) + video, thumbnailUrl: (imageBase ?? localBase) + thumbnail };
    }));
    res.set('Cache-Control', 'public, max-age=60').json({ reels: items.filter(Boolean) });
  });

  if (!videoBase) router.get('/media/:name', async (req, res, next) => {
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
