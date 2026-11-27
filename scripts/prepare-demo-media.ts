import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, rename, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { demoReels, type DemoReelId } from '../src/modules/demo/catalog.js';
import { findFfmpeg } from '../src/modules/tts/sarvam-provider.js';

const sources: Record<DemoReelId, { file: string; sha256: string }> = {
  'whatsapp-v2': { file: 'output/final-director-v2/whatsapp-v2.mp4', sha256: '5f647ba3a16cae24e86ed194d2e257bb93778eaf1314340eaffda2d47713e5f7' },
  'load-balancing': { file: 'output/golden-load-balancing/load-balancing.mp4', sha256: '4686984d8e7c063fce1769cbde8e376dcfd439e6047125fa69187a40cb604262' },
  'bloom-filter': { file: 'output/semantic-quality-audit/bloom-filter/final-export/bloom-filter.mp4', sha256: '9e0e6f3c0644eaad4f26fb53ec15da222f879f3912f59e6fe18c509614e28ca0' },
  'merkle-tree': { file: 'output/semantic-quality-audit/merkle-repair/final-export/merkle-repair.mp4', sha256: 'cb61e5264aa91cbf4e53c0708bdfcc1f8dbe8f3216400a03b6abe217fa8c4257' },
  rag: { file: 'output/golden-rag-release/rag.mp4', sha256: '88b405090a5f4dcc249c8e37a8848cb8555ffe6a7d950059c6e61c530baa8bef' },
};

async function digest(file: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

const root = path.resolve(process.env.DEMO_MEDIA_DIR || 'media/demo');
await mkdir(root, { recursive: true });
for (const { id } of demoReels) {
  const { file, sha256 } = sources[id];
  const temporary = path.join(root, randomUUID());
  try {
    await copyFile(file, `${temporary}.mp4`);
    if (await digest(`${temporary}.mp4`) !== sha256) throw new Error(`Unapproved video fingerprint for ${id}.`);
    execFileSync(process.env.DEMO_FFMPEG || findFfmpeg(), [
      '-v', 'error', '-ss', '5', '-i', `${temporary}.mp4`, '-frames:v', '1', '-vf', 'scale=360:-2', '-q:v', '3', `${temporary}.jpg`,
    ], { stdio: 'inherit', windowsHide: true });
    await rename(`${temporary}.mp4`, path.join(root, `${id}.mp4`));
    await rename(`${temporary}.jpg`, path.join(root, `${id}.jpg`));
    console.log(`Prepared ${id} from the verified original.`);
  } finally {
    await Promise.all(['mp4', 'jpg'].map(extension => rm(`${temporary}.${extension}`, { force: true })));
  }
}
