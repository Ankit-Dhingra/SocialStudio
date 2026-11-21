import { getOrCreateBundle } from '../src/modules/render/video-renderer.js';
import fs from 'node:fs';
import path from 'node:path';
import { renderStill, selectComposition } from '@remotion/renderer';
import { StoryboardSchema } from '../src/modules/contracts/storyboard.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';

const [source, output = 'output/motion-review', ...positions] = process.argv.slice(2);
if (!source || !positions.length) throw new Error('Supply a storyboard or session JSON, output directory, and sceneIndex:fraction positions.');
const input = JSON.parse(fs.readFileSync(source, 'utf8'));
const storyboard = StoryboardSchema.parse(input.storyboard ?? input);
const timeline = input.timeline ?? buildVideoTimeline(storyboard, []);
const inputProps = { storyboard, timeline };
const serveUrl = await getOrCreateBundle(timeline);
const composition = await selectComposition({ serveUrl, id: 'StudioShort', inputProps });
fs.mkdirSync(output, { recursive: true });
for (const position of positions) {
  const [index, fraction] = position.split(':').map(Number);
  const seg = timeline.segments[index];
  if (!seg || !(fraction >= 0 && fraction < 1)) throw new Error('Invalid scene position ' + position);
  const frame = seg.startFrame + Math.floor(seg.durationInFrames * fraction);
  const filename = path.join(output, `${index}-${seg.type}-f${frame}.jpg`);
  await renderStill({ composition, serveUrl, inputProps, frame, output: filename, imageFormat: 'jpeg', jpegQuality: 92 });
  console.log(filename);
}
