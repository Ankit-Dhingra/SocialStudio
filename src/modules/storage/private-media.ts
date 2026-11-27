import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Router } from 'express';

const keyPattern = /^(?:tmp-)?[a-f0-9]{64}\.(?:mp4|mp3|wav|png|jpg|webp)$/;
const linkLifetime = 15 * 60;
const maxAssetBytes = 100 * 1024 * 1024;

export interface PrivateMedia {
  put(key: string, source: string, contentType: string): Promise<void>;
  url(key: string): Promise<string>;
  router?: ReturnType<typeof Router>;
}

function assertKey(key: string) {
  if (!keyPattern.test(key)) throw new Error('Invalid private media key.');
}

export function localPrivateMedia(root: string, signingSecret: string, clock = Date.now): PrivateMedia {
  if (signingSecret.length < 32) throw new Error('PRIVATE_MEDIA_SIGNING_KEY must contain at least 32 characters.');
  root = path.resolve(root);
  const sign = (key: string, expires: number) => createHmac('sha256', signingSecret).update(`${key}:${expires}`).digest();
  const router = Router();
  router.get('/:key', (req, res, next) => {
    const { key } = req.params;
    const { expires, signature } = req.query;
    const now = Math.floor(clock() / 1000);
    res.set({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
    if (!keyPattern.test(key) || typeof expires !== 'string' || !/^\d{1,12}$/.test(expires) ||
        Number(expires) <= now || Number(expires) > now + linkLifetime || typeof signature !== 'string' ||
        !/^[a-f0-9]{64}$/.test(signature) || !timingSafeEqual(sign(key, Number(expires)), Buffer.from(signature, 'hex'))) {
      return res.sendStatus(404);
    }
    lstat(path.join(root, key)).then(info => {
      if (!info.isFile()) return res.sendStatus(404);
      res.sendFile(key, { root, cacheControl: false, dotfiles: 'deny' }, error => {
        if (error && (error as NodeJS.ErrnoException).code !== 'ECONNABORTED' && !res.destroyed) next(error);
      });
    }).catch(error => { if (error.code === 'ENOENT') res.sendStatus(404); else next(error); });
  });
  router.use((_req, res) => { res.sendStatus(404); });

  return {
    router,
    async put(key, source) {
      assertKey(key);
      await checkSource(source);
      await mkdir(root, { recursive: true });
      const temporary = path.join(root, randomUUID());
      try {
        await pipeline(createReadStream(source), createWriteStream(temporary, { flags: 'wx', mode: 0o600 }));
        await rename(temporary, path.join(root, key));
      } finally { await rm(temporary, { force: true }); }
    },
    async url(key) {
      assertKey(key);
      const expires = Math.floor(clock() / 1000) + linkLifetime;
      return `/api/private-media/${key}?expires=${expires}&signature=${sign(key, expires).toString('hex')}`;
    },
  };
}

async function checkSource(source: string) {
  const info = await lstat(source);
  if (!info.isFile() || info.size < 1 || info.size > maxAssetBytes) throw new Error('Invalid private media source size or type.');
  return info.size;
}

export function privateMediaFromEnv(env: NodeJS.ProcessEnv = process.env): PrivateMedia | undefined {
  if (!env.PRIVATE_MEDIA_DRIVER) return undefined;
  if (env.PRIVATE_MEDIA_DRIVER === 'local' && env.NODE_ENV !== 'production') {
    return localPrivateMedia(env.PRIVATE_MEDIA_DIR || 'media/private', env.PRIVATE_MEDIA_SIGNING_KEY ?? '');
  }
  if (env.PRIVATE_MEDIA_DRIVER !== 'r2') throw new Error('Production private media must use the R2 driver.');
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PRIVATE_BUCKET } = env;
  if (!R2_ACCOUNT_ID || !/^[a-f0-9]{32}$/.test(R2_ACCOUNT_ID) || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY ||
      !R2_PRIVATE_BUCKET || !env.R2_DEMO_BUCKET || R2_PRIVATE_BUCKET === env.R2_DEMO_BUCKET) {
    throw new Error('Required private R2 configuration is invalid or missing.');
  }
  const client = new S3Client({
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, region: 'auto', forcePathStyle: true,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }, requestChecksumCalculation: 'WHEN_REQUIRED',
  });
  return {
    async put(key, source, contentType) {
      assertKey(key);
      const size = await checkSource(source);
      await client.send(new PutObjectCommand({ Bucket: R2_PRIVATE_BUCKET, Key: key, Body: createReadStream(source),
        ContentType: contentType, ContentLength: size, CacheControl: 'private, no-store' }));
    },
    async url(key) {
      assertKey(key);
      return getSignedUrl(client, new GetObjectCommand({ Bucket: R2_PRIVATE_BUCKET, Key: key }), { expiresIn: linkLifetime });
    },
  };
}

export async function cleanLocalTemporaryMedia(root: string, cutoff: number) {
  const entries = await readdir(root, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith('tmp-') || !keyPattern.test(entry.name)) continue;
    const file = path.join(root, entry.name);
    if ((await lstat(file)).mtimeMs >= cutoff) continue;
    await rm(file, { force: true });
    removed++;
  }
  return removed;
}
