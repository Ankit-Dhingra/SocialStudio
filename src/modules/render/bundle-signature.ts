import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function compositionSignature(): string {
  const hash = createHash('sha256');
  function visit(file: string) {
    if (fs.statSync(file).isDirectory()) {
      for (const name of fs.readdirSync(file).sort()) {
        if (name !== 'public') visit(path.join(file, name));
      }
    } else if (/\.(tsx?|json|png|svg)$/.test(file)) {
      hash.update(file.replace(/\\/g, '/')).update(fs.readFileSync(file));
    }
  }
  for (const input of ['remotion', 'remotion/public/visuals', 'src/modules/video', 'src/modules/contracts', 'package-lock.json']) visit(input);
  return hash.digest('hex');
}
