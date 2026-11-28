import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, mkdir, open, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { v2 as cloudinary } from 'cloudinary';
import { Router } from 'express';

const keyPattern = /^(?:tmp-)?[a-f0-9]{64}\.(?:mp4|mp3|wav|png|jpg|webp)$/;
const linkLifetime = 15 * 60;
const maxAssetBytes = 100 * 1024 * 1024;
const cloudinaryVideoBytes = 100_000_000;
const cloudinaryImageBytes = 10_000_000;

export interface PrivateMedia {
  put(key: string, source: string, contentType: string): Promise<void>;
  url(key: string): Promise<string>;
  verify?(key: string): Promise<void>;
  get?(key: string, target: string): Promise<void>;
  router?: ReturnType<typeof Router>;
}

function assertKey(key: string) {
  if (!keyPattern.test(key)) throw new Error('Invalid private media key.');
}

function cloudinaryUploadLimit(value: string | undefined, maximum: number, setting: string) {
  if (value === undefined || value === '') return maximum;
  const limit = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(limit) || limit < 1 || limit > maximum) {
    throw new Error(`${setting} must be a positive byte count up to ${maximum}.`);
  }
  return limit;
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
    async verify(key) {
      assertKey(key);
      await checkSource(path.join(root, key));
    },
    async get(key, target) {
      assertKey(key);
      const source = path.join(root, key);
      await checkSource(source);
      await pipeline(createReadStream(source), createWriteStream(target, { flags: 'wx', mode: 0o600 }));
    },
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

async function checkSource(source: string, maxBytes = maxAssetBytes) {
  const info = await lstat(source);
  if (!info.isFile() || info.size < 1 || info.size > maxBytes) throw new Error('Invalid private media source size or type.');
  return info.size;
}

export function privateMediaFromEnv(env: NodeJS.ProcessEnv = process.env): PrivateMedia | undefined {
  if (!env.PRIVATE_MEDIA_DRIVER) return undefined;
  if (env.PRIVATE_MEDIA_DRIVER === 'local' && env.NODE_ENV !== 'production') {
    return localPrivateMedia(env.PRIVATE_MEDIA_DIR || 'media/private', env.PRIVATE_MEDIA_SIGNING_KEY ?? '');
  }
  if (env.PRIVATE_MEDIA_DRIVER !== 'cloudinary') throw new Error('Hosted private media must use the Cloudinary driver.');
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  const prefix = env.CLOUDINARY_PRIVATE_PREFIX ?? 'socialstudio-private';
  if (!cloudName || !/^[a-z0-9][a-z0-9_-]*$/.test(cloudName) || !apiKey || !/^\d+$/.test(apiKey) ||
      !apiSecret?.trim() || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(prefix)) {
    throw new Error('Required private Cloudinary configuration is invalid or missing.');
  }
  const credentials = { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret };
  const deliveryType = 'authenticated' as const;
  const imageUploadLimit = cloudinaryUploadLimit(env.CLOUDINARY_MAX_IMAGE_UPLOAD_BYTES, cloudinaryImageBytes,
    'CLOUDINARY_MAX_IMAGE_UPLOAD_BYTES');
  const videoUploadLimit = cloudinaryUploadLimit(env.CLOUDINARY_MAX_VIDEO_UPLOAD_BYTES, cloudinaryVideoBytes,
    'CLOUDINARY_MAX_VIDEO_UPLOAD_BYTES');

  function asset(key: string) {
    assertKey(key);
    const extension = path.extname(key);
    const resourceType = /\.(mp4|mp3|wav)$/.test(extension) ? 'video' as const : 'image' as const;
    return {
      publicId: `${prefix}/${key.replace('.', '-')}`,
      format: extension.slice(1),
      resourceType,
      maxBytes: resourceType === 'video' ? cloudinaryVideoBytes : cloudinaryImageBytes,
    };
  }

  function signedUrl({ publicId, format, resourceType }: ReturnType<typeof asset>) {
    return cloudinary.utils.private_download_url(publicId, format, {
      ...credentials, type: deliveryType, resource_type: resourceType,
      expires_at: Math.floor(Date.now() / 1000) + linkLifetime,
    });
  }

  async function download(entry: ReturnType<typeof asset>, range?: string) {
    const response = await fetch(signedUrl(entry), { headers: range ? { Range: range } : undefined,
      redirect: 'error', signal: AbortSignal.timeout(60_000) }).catch(() => {
      throw new Error('Cloudinary private media download failed.');
    });
    if (!response.ok || !response.body || (!range && response.status !== 200)) {
      await response.body?.cancel();
      throw new Error('Cloudinary private media download failed.');
    }
    return response;
  }

  return {
    async verify(key) {
      const entry = asset(key);
      const response = await download(entry, 'bytes=0-0');
      const total = response.status === 206
        ? /^bytes 0-0\/(\d+)$/.exec(response.headers.get('content-range') ?? '')?.[1]
        : response.headers.get('content-length');
      await response.body!.cancel();
      const size = Number(total);
      if (!Number.isSafeInteger(size) || size < 1 || size > entry.maxBytes) throw new Error('Invalid stored media size.');
    },
    async get(key, target) {
      const entry = asset(key);
      const response = await download(entry);
      const file = await open(target, 'wx', 0o600).catch(async error => {
        await response.body!.cancel();
        throw error;
      });
      let bytes = 0;
      const bound = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          bytes += chunk.length;
          if (bytes > entry.maxBytes) return callback(new Error('Invalid stored media size.'));
          callback(null, chunk);
        },
        flush(callback) { callback(bytes ? undefined : new Error('Invalid stored media size.')); },
      });
      try {
        await pipeline(Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>), bound, file.createWriteStream());
      } catch (error) {
        await rm(target, { force: true });
        throw error;
      }
    },
    async put(key, source, _contentType) {
      const entry = asset(key);
      await checkSource(source, entry.resourceType === 'video' ? videoUploadLimit : imageUploadLimit);
      const result = await cloudinary.uploader.upload(path.resolve(source), {
        ...credentials, type: deliveryType, resource_type: entry.resourceType,
        public_id: entry.publicId, asset_folder: prefix, overwrite: false,
      }).catch(() => { throw new Error('Cloudinary private media upload failed.'); });
      if (result.public_id !== entry.publicId || result.type !== deliveryType || result.format !== entry.format ||
          result.resource_type !== entry.resourceType || !result.bytes || result.bytes > entry.maxBytes) {
        throw new Error('Cloudinary returned an unexpected private media asset.');
      }
    },
    async url(key) {
      return signedUrl(asset(key));
    },
  };
}

/* Previous R2 driver, disabled while hosted media uses Cloudinary.
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function r2PrivateMedia(env: NodeJS.ProcessEnv): PrivateMedia {
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
    async verify(key) {
      assertKey(key);
      const metadata = await client.send(new HeadObjectCommand({ Bucket: R2_PRIVATE_BUCKET, Key: key }));
      if (!metadata.ContentLength || metadata.ContentLength > maxAssetBytes) throw new Error('Invalid stored media size.');
    },
    async get(key, target) {
      assertKey(key);
      const media = await client.send(new GetObjectCommand({ Bucket: R2_PRIVATE_BUCKET, Key: key }));
      if (!media.ContentLength || media.ContentLength > maxAssetBytes || !media.Body) {
        (media.Body as Readable | undefined)?.destroy();
        throw new Error('Invalid stored media size.');
      }
      await pipeline(media.Body as Readable, createWriteStream(target, { flags: 'wx', mode: 0o600 }));
    },
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
*/

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
