import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { saveAppScreen, saveVectorAsset } from './reel-visual-assets.js';
import { sanitizeVectorAsset } from './sanitize-vector-asset.js';

const catalog = z.array(z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  description: z.string().min(3).max(160),
  role: z.enum(['background', 'subject']),
  file: z.string().regex(/^[a-zA-Z0-9_-]+\.(png|jpg|svg)$/),
  source: z.string().min(3).max(240),
  license: z.string().min(3).max(160),
  credit: z.string().max(140).optional(),
  motionLaneY: z.number().min(0.14).max(0.70).optional(),
})).max(200);

function imageDimensions(bytes: Buffer) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    && bytes.toString('ascii', 12, 16) === 'IHDR') {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), format: 'png' };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let index = 2;
    while (index + 8 < bytes.length && bytes[index] === 0xff) {
      const marker = bytes[++index];
      if (marker === 0xff) continue;
      if (marker === 0xd9 || marker === 0xda) break;
      const length = bytes.readUInt16BE(index + 1);
      if (length < 2 || index + 1 + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 8) {
        return { width: bytes.readUInt16BE(index + 6), height: bytes.readUInt16BE(index + 4), format: 'jpg' };
      }
      index += 1 + length;
    }
  }
  throw new Error('Expected a valid PNG or JPEG image header.');
}

export async function loadApprovedVisualAssets() {
  const directory = path.resolve(process.env.REEL_APPROVED_ASSET_DIR?.trim() || 'media/approved-reel-assets');
  const manifest = path.join(directory, 'catalog.json');
  const data = await fs.readFile(manifest, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    return '[]';
  });
  const entries = catalog.parse(JSON.parse(data));
  if (new Set(entries.map(entry => entry.id)).size !== entries.length) {
    throw new Error('Approved visual asset IDs must be unique.');
  }
  const filesById = new Map(entries.map(entry => [entry.id, { entry, directory }]));
  for (const base of ['remotion/public/visuals/brands', 'remotion/public/visuals']) {
    const root = path.resolve(base);
    const bundled = await fs.readdir(root, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
      return [];
    });
    for (const file of bundled) {
      const match = /^([a-z0-9-]+)\.(svg|png|jpg)$/i.exec(file.name);
      if (!file.isFile() || !match || match[1].toLowerCase() === 'demo-qr') continue;
      const slug = match[1].toLowerCase();
      const id = `brand-${slug}`;
      if (id.length > 32 || filesById.has(id)) continue;
      filesById.set(id, { directory: root, entry: { id, role: 'subject', file: file.name,
        description: `Bundled ${slug} brand mark`, source: base, license: 'Bundled project brand asset' } });
    }
  }
  const files = new Map<string, Promise<{ asset: string; width: number; height: number }>>();
  return {
    capabilities: [...filesById.values()].map(({ entry: { id, role, description, motionLaneY } }) =>
      ({ id, role, description, motionLaneY })),
    resolve(id: string, role?: 'background' | 'subject') {
      const resolution = filesById.get(id);
      if (!resolution || (role && resolution.entry.role !== role)) throw new Error(`No approved asset for ${id}.`);
      const { entry, directory } = resolution;
      const staged = files.get(id) ?? (async () => {
        const root = await fs.realpath(directory);
        const file = await fs.realpath(path.join(root, entry.file));
        const stats = await fs.stat(file);
        if (path.dirname(file) !== root || !stats.isFile() || stats.size > 20 * 1024 * 1024) {
          throw new Error(`Invalid approved visual asset ${id}.`);
        }
        const bytes = await fs.readFile(file);
        if (entry.file.endsWith('.svg')) {
          const safe = sanitizeVectorAsset(bytes);
          return { asset: await saveVectorAsset(safe.bytes), width: safe.width, height: safe.height };
        }
        const { width, height, format } = imageDimensions(bytes);
        if (!entry.file.endsWith(`.${format}`) || width < 1 || height < 1 || width * height > 25_000_000) {
          throw new Error(`Approved visual asset ${id} has invalid dimensions or format.`);
        }
        return { asset: await saveAppScreen(bytes), width, height };
      })();
      files.set(id, staged);
      return staged.then(asset => ({ ...asset, credit: entry.credit, motionLaneY: entry.motionLaneY }));
    },
  };
}
