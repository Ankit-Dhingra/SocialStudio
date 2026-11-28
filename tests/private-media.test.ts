import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile, stat, truncate } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { cleanLocalTemporaryMedia, localPrivateMedia, privateMediaFromEnv } from '../src/modules/storage/private-media.js';

test('private local media only serves signed, unexpired links and preserves durable artifacts', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'studio-private-'));
  try {
    let now = Date.now();
    const storage = localPrivateMedia(root, 'test-key-with-at-least-32-characters', () => now);
    const key = `${'a'.repeat(64)}.mp4`;
    const temporary = `tmp-${key}`;
    const source = path.join(root, 'fixture');
    await writeFile(source, 'fixture media');
    await storage.put(key, source, 'video/mp4');
    await storage.put(temporary, source, 'video/mp4');
    assert.equal(await cleanLocalTemporaryMedia(root, now + 10000), 1);
    assert.equal((await stat(path.join(root, key))).size, 13);
    await assert.rejects(storage.url('../outside.mp4'), /media key/);

    const app = express();
    app.use('/api/private-media', storage.router!);
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    try {
      const signed = await storage.url(key);
      assert.equal((await fetch(base + signed.split('?')[0])).status, 404);
      const video = await fetch(base + signed, { headers: { Range: 'bytes=0-6' } });
      assert.equal(video.status, 206);
      assert.equal(await video.text(), 'fixture');
      now += 16 * 60000;
      assert.equal((await fetch(base + signed)).status, 404);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  } finally { await rm(root, { force: true, recursive: true }); }
});

const cloudinaryEnv = { NODE_ENV: 'production', PRIVATE_MEDIA_DRIVER: 'cloudinary',
  CLOUDINARY_CLOUD_NAME: 'studio-fixture', CLOUDINARY_API_KEY: '123456789012345', CLOUDINARY_API_SECRET: 'fixture-secret' };

test('production requires configured Cloudinary credentials when private media is enabled', () => {
  assert.throws(() => privateMediaFromEnv({ NODE_ENV: 'production', PRIVATE_MEDIA_DRIVER: 'local' }), /Cloudinary/);
  assert.throws(() => privateMediaFromEnv({ PRIVATE_MEDIA_DRIVER: 'r2' }), /Cloudinary/);
  assert.throws(() => privateMediaFromEnv({ ...cloudinaryEnv, CLOUDINARY_API_SECRET: '' }), /invalid or missing/);
  assert.throws(() => privateMediaFromEnv({ ...cloudinaryEnv, CLOUDINARY_MAX_VIDEO_UPLOAD_BYTES: '100000001' }),
    /CLOUDINARY_MAX_VIDEO_UPLOAD_BYTES/);
});

test('Cloudinary uploads authenticated media and signs bounded reads', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'studio-cloudinary-'));
  try {
    const source = path.join(root, 'fixture.mp4');
    await writeFile(source, 'media');
    const storage = privateMediaFromEnv(cloudinaryEnv)!;
    const key = `${'a'.repeat(64)}.mp4`;
    const publicId = `socialstudio-private/${'a'.repeat(64)}-mp4`;
    const upload = t.mock.method(cloudinary.uploader, 'upload', async (file, options) => {
      assert.equal(file, source);
      assert.equal(options?.public_id, publicId);
      assert.equal(options?.asset_folder, 'socialstudio-private');
      assert.equal(options?.type, 'authenticated');
      assert.equal(options?.overwrite, false);
      return { public_id: publicId, type: 'authenticated', format: 'mp4', resource_type: 'video', bytes: 5 };
    });
    await storage.put(key, source, 'video/mp4');
    const signed = new URL(await storage.url(key));
    assert.equal(signed.origin, 'https://api.cloudinary.com');
    assert.equal(signed.pathname, '/v1_1/studio-fixture/video/download');
    assert.equal(signed.searchParams.get('type'), 'authenticated');
    assert.equal(signed.searchParams.get('public_id'), publicId);
    assert.equal(signed.searchParams.get('format'), 'mp4');
    assert.equal(Number(signed.searchParams.get('expires_at')) - Number(signed.searchParams.get('timestamp')), 900);
    assert.ok(signed.searchParams.get('signature'));
    assert.doesNotMatch(signed.href, /fixture-secret/);
    assert.equal(new URL(await storage.url(key.replace('.mp4', '.jpg'))).pathname, '/v1_1/studio-fixture/image/download');
    await assert.rejects(storage.url('../outside.mp4'), /media key/);

    t.mock.method(globalThis, 'fetch', async (_url, options) =>
      options?.headers?.Range === 'bytes=0-0'
        ? new Response('m', { status: 206, headers: { 'content-range': 'bytes 0-0/5' } })
        : new Response('media'));
    await storage.verify!(key);
    const capped = privateMediaFromEnv({ ...cloudinaryEnv, CLOUDINARY_MAX_VIDEO_UPLOAD_BYTES: '4' })!;
    await assert.rejects(capped.put(key, source, 'video/mp4'), /source size/);
    await capped.verify!(key);
    const destination = path.join(root, 'download.mp4');
    await storage.get!(key, destination);
    assert.equal(await readFile(destination, 'utf8'), 'media');
    await assert.rejects(storage.get!(key, destination), { code: 'EEXIST' });
    assert.equal(await readFile(destination, 'utf8'), 'media');

    await truncate(source, 10_000_001);
    await assert.rejects(storage.put(key.replace('.mp4', '.jpg'), source, 'image/jpeg'), /source size/);
    assert.equal(upload.mock.callCount(), 1);
  } finally { await rm(root, { force: true, recursive: true }); }
});
