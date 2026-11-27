import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { demoRouter } from '../src/modules/demo/routes.js';

test('the guest demo only serves cataloged files and supports video seeking', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'socialstudio-demo-'));
  try {
    await Promise.all([
      writeFile(path.join(folder, 'whatsapp-v2.mp4'), '0123456789'),
      writeFile(path.join(folder, 'whatsapp-v2.jpg'), 'image'),
      writeFile(path.join(folder, 'private-owner.mp4'), 'private'),
    ]);
    let studioRequests = 0;
    const app = express();
    app.use('/api/demo', demoRouter({ directory: folder }));
    app.use('/api', (_req, res) => { studioRequests++; res.sendStatus(401); });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    try {
      const { reels } = await (await fetch(`${base}/api/demo/reels`)).json();
      assert.equal(reels.length, 1);
      assert.equal(reels[0].id, 'whatsapp-v2');
      assert.equal(reels[0].featured, true);
      assert.equal(reels[0].videoUrl, '/api/demo/media/whatsapp-v2.mp4');
      assert.doesNotMatch(JSON.stringify(reels), /private-owner|output\//);
      const range = await fetch(base + reels[0].videoUrl, { headers: { Range: 'bytes=3-5' } });
      assert.equal(range.status, 206);
      assert.equal(range.headers.get('content-type'), 'video/mp4');
      assert.equal(await range.text(), '345');
      assert.equal((await fetch(`${base}/api/demo/media/private-owner.mp4`)).status, 404);
      assert.equal((await fetch(`${base}/api/demo/media/bloom-filter.mp4`)).status, 404);
      assert.equal((await fetch(`${base}/api/demo/reels`, { method: 'POST' })).status, 404);
      assert.equal(studioRequests, 0);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  } finally { await rm(folder, { force: true, recursive: true }); }
});

test('an external demo media prefix cannot embed credentials or use insecure HTTP', () => {
  assert.throws(() => demoRouter({ publicBaseUrl: 'http://media.example.test/demo' }), /HTTPS/);
  assert.throws(() => demoRouter({ publicBaseUrl: 'https://user:secret@media.example.test/demo' }), /HTTPS/);
});
