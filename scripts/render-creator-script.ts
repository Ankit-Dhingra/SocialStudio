import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseCustomScriptToStoryboard } from '../src/modules/ai-script/custom-script-parser.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';
import { renderStudioShort } from '../src/modules/render/video-renderer.js';
import { prepareReelVisuals } from '../src/modules/render/reel-visual-assets.js';
import { synthesizeStoryboardNarration } from '../src/modules/tts/tts-service.js';
import { performMediaQA } from '../src/modules/qa/media-qa.js';

const scriptPath = process.argv[2];
if (!scriptPath) throw new Error('Pass the path to the finalized creator script.');

const storyboard = await parseCustomScriptToStoryboard(fs.readFileSync(scriptPath, 'utf8'));
const runId = randomUUID();
const outputDir = path.resolve('output/creator_reels', runId);
const audioDir = path.resolve('remotion/public/audio/runs', runId);
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });

const audio = await synthesizeStoryboardNarration(storyboard, audioDir);
const timeline = buildVideoTimeline(storyboard, audio.clips, { audioSrcPrefix: `audio/runs/${runId}` });
const visuals = await prepareReelVisuals(storyboard, timeline);
const result = await renderStudioShort({
  storyboard,
  timeline,
  visualPlan: visuals.shots,
  outputFilePath: path.join(outputDir, 'final-short.mp4'),
});
const qa = performMediaQA(result, timeline);
if (!qa.passed) throw new Error(qa.errors.join(', '));
console.log(result.outputFilePath);
