import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { SaxesParser } from 'saxes';
import type { ReferenceNode } from '../remotion/golden-reference.js';

const sourceFile = path.resolve('references/golden-visual-reference.svg.svg');
const svg = await fs.readFile(sourceFile, 'utf8');
const nodes: ReferenceNode[] = [];
let root: ReferenceNode | undefined;
const parser = new SaxesParser();
const tags = new Set(['svg', 'defs', 'pattern', 'path', 'rect', 'g', 'circle', 'ellipse', 'text']);
const props = new Set(['font-family', 'font-weight', 'fill', 'viewBox', 'xmlns', 'id', 'width', 'height', 'patternUnits',
  'd', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'x', 'y', 'rx', 'ry', 'cx', 'cy',
  'r', 'text-anchor', 'font-size', 'transform']);
parser.on('doctype', () => { throw new Error('Unexpected reference document type.'); });
parser.on('opentag', tag => {
  if (!tags.has(tag.name)) throw new Error(`Unexpected reference node ${tag.name}.`);
  const attributes = Object.fromEntries(Object.entries(tag.attributes).filter(([name]) => props.has(name))
    .map(([name, value]) => [name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()), value]));
  const node: ReferenceNode = { tag: tag.name, props: attributes, children: [] };
  if (nodes.length) nodes.at(-1)!.children.push(node); else root = node;
  nodes.push(node);
});
parser.on('closetag', () => { nodes.pop(); });
parser.on('text', text => { if (text.trim()) nodes.at(-1)?.children.push(text); });
parser.write(svg).close();
if (!root || root.children.length !== 31) throw new Error('The golden reference structure changed. Review its animation stages.');

const output = path.resolve('output/golden-reference');
await fs.mkdir(output, { recursive: true });
const serveUrl = await bundle({
  entryPoint: path.resolve('remotion/golden-reference.tsx'),
  webpackOverride: config => ({
    ...config, resolve: { ...config.resolve, extensionAlias: { '.js': ['.ts', '.tsx', '.js'] } },
  }),
});
const browser = await openBrowser('chrome');
const licenseKey = process.env.REMOTION_PRIVATE_LICENSE_KEY?.trim() || undefined;
const shared = { serveUrl, puppeteerInstance: browser, licenseKey, isProduction: false };
const base = { tree: root, source: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` };
try {
  const modes = process.argv.includes('--animated-only') ? ['animated'] as const : ['original', 'static', 'animated'] as const;
  for (const mode of modes) {
    const inputProps = { ...base, mode };
    const composition = await selectComposition({ ...shared, id: 'GoldenVisualReference', inputProps });
    const frames = mode === 'animated' ? { before: 24, split: 67, processing: 129, vectors: 172, transfer: 208, after: 271 } : { [mode]: 0 };
    for (const [name, frame] of Object.entries(frames)) await renderStill({
      ...shared, composition, inputProps, frame, output: path.join(output, `${name}.png`), imageFormat: 'png',
    });
    if (mode === 'animated') await renderMedia({ ...shared, composition, inputProps, codec: 'h264',
      outputLocation: path.join(output, 'golden-animation.mp4'), concurrency: 3 });
  }
} finally {
  await browser.close({ silent: true });
}
