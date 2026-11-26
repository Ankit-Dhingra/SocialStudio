import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { reelBrand } from '../video/brand.js';

export const visualDirectorFiles = [
  'MASTER_VISUAL_PROMPT.md', 'VISUAL_DESIGN_SYSTEM.md', 'MOTION_AND_TEACHING.md',
  'GOLDEN_REFERENCE.svg', 'GOLDEN_REFERENCE.png', 'GOLDEN_REFERENCE_SOURCE.md', 'PROJECT_SETUP.md',
] as const;
export const visualBenchmark = 'Golden benchmark: readable focal hierarchy, distinct filled objects with meaningful internals, restrained strokes, connected dashed routes, purple processing, and a readable output. Adapt its proportions and density to portrait and the narrated mechanism. Keep the reference topic, shapes, values and coordinates out of unrelated scenes.';
const brandInstruction = `Use ${reelBrand.name} for visual branding. Include a logo or handle only when verified for this brand in the job. Keep all saved narration verbatim.`;

function paragraphStartingWith(document: string, prefix: string) {
  for (const paragraph of document.split(/\r?\n\s*\r?\n/)) {
    const lines = paragraph.split(/\r?\n/);
    const start = lines.findIndex(line => line.startsWith(prefix));
    if (start >= 0) return lines.slice(start).join('\n').trim();
  }
  return '';
}

async function readVisualDirectorReference() {
  const directory = new URL('../../../visual-director/', import.meta.url);
  const files = new Map(await Promise.all(visualDirectorFiles.map(async name => [name, await readFile(new URL(name, directory))] as const)));
  const revision = createHash('sha256').update(JSON.stringify([...files].map(([name, bytes]) =>
    [name, createHash('sha256').update(bytes).digest('hex')]))).digest('hex');
  const master = files.get('MASTER_VISUAL_PROMPT.md')!.toString('utf8').trim();
  const design = files.get('VISUAL_DESIGN_SYSTEM.md')!.toString('utf8').trim();
  const motion = files.get('MOTION_AND_TEACHING.md')!.toString('utf8').trim();
  const compact = [
    paragraphStartingWith(master, 'Priority:'),
    paragraphStartingWith(design, 'Technical scenes:'),
    paragraphStartingWith(motion, 'Progressive reveals'),
    visualBenchmark, brandInstruction,
  ].filter(Boolean).join('\n');
  return { files, revision, master, design, motion, compact, brandInstruction };
}

export function loadVisualDirectorReference() {
  return readVisualDirectorReference();
}
