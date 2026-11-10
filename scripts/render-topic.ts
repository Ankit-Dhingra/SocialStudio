import { StoryboardSchema } from '../src/modules/contracts/storyboard.js';
import fs from 'node:fs';
import path from 'node:path';
import { generateHinglishScript } from '../src/modules/ai-script/script-generator.js';
import { synthesizeStoryboardNarration } from '../src/modules/tts/tts-service.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';
import { renderStudioShort } from '../src/modules/render/video-renderer.js';
import { performMediaQA } from '../src/modules/qa/media-qa.js';

const topic = process.argv[2];
if (!topic) throw new Error('Pass the topic of the reel as an argument.');
const id = 'pilot-' + Date.now();
const dir = path.resolve('media/runs', id);
fs.mkdirSync(dir, {recursive: true});
const storyboard = topic.endsWith('.json')
  ? StoryboardSchema.parse(JSON.parse(fs.readFileSync(topic, 'utf8')))
  : await generateHinglishScript({topic, targetDurationSec: 55});
fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(storyboard, null, 2));
const audio = await synthesizeStoryboardNarration(storyboard, dir);
const publicDir = path.resolve('remotion/public/audio/runs', id);
fs.mkdirSync(publicDir, {recursive: true});
for (const clip of audio.clips) fs.copyFileSync(clip.filePath, path.join(publicDir, path.basename(clip.filePath)));
const timeline = buildVideoTimeline(storyboard, audio.clips, {audioSrcPrefix: 'audio/runs/' + id});
const result = await renderStudioShort({storyboard, timeline, outputFilePath: path.join(dir, 'final-short.mp4')});
const qa = performMediaQA(result, timeline);
fs.writeFileSync(path.join(dir, 'qa.json'), JSON.stringify(qa, null, 2));
if (!qa.passed) throw new Error(qa.errors.join(', '));
console.log(result.outputFilePath);
