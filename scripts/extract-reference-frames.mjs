import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('reference_reels/frames');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(path.resolve('reference_reels')).filter(f => f.endsWith('.mp4'));
console.log('Found reference reels:', files);

for (const f of files) {
  const fullPath = path.resolve('reference_reels', f);
  const base = path.basename(f, '.mp4').replace(/[^a-zA-Z0-9]/g, '_');
  
  // Extract 3 frames: 3s, 12s, 25s
  for (const s of [3, 12, 25]) {
    const outImg = path.join(outDir, `${base}_${s}s.jpg`);
    execSync(`ffmpeg -ss 00:00:${s < 10 ? '0' + s : s} -i "${fullPath}" -vframes 1 -q:v 2 "${outImg}" -y`, { stdio: 'ignore' });
    console.log('Saved frame:', outImg);
  }
}
console.log('Frame extraction complete!');
