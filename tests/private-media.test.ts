import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
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

test('production rejects a local media driver and an R2 bucket shared with public demo files', () => {
  assert.throws(() => privateMediaFromEnv({ NODE_ENV: 'production', PRIVATE_MEDIA_DRIVER: 'local' }), /R2/);
  assert.throws(() => privateMediaFromEnv({ PRIVATE_MEDIA_DRIVER: 'r2', R2_ACCOUNT_ID: 'a'.repeat(32),
    R2_ACCESS_KEY_ID: 'fixture', R2_SECRET_ACCESS_KEY: 'fixture', R2_DEMO_BUCKET: 'both', R2_PRIVATE_BUCKET: 'both' }), /invalid/);
});
