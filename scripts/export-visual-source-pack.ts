import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { visualSourcePack } from '../src/modules/render/visual-source-pack.js';

const destination = path.resolve(process.argv[2] || 'output/visual-director-source-pack');
const files = await visualSourcePack();
await mkdir(destination, { recursive: true });
await Promise.all([...files].map(([name, contents]) => writeFile(path.join(destination, name), contents)));
console.log(destination);
