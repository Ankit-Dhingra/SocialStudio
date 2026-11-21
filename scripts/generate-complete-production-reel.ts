import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
dotenv.config();

import { masterScriptService } from '../src/modules/ai-script/master-script-service.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';
import { renderStudioShort, renderStillPreviews } from '../src/modules/render/video-renderer.js';
import { synthesizeStoryboardNarration } from '../src/modules/tts/tts-service.js';
import { SarvamTTSProvider } from '../src/modules/tts/sarvam-provider.js';
import { performMediaQA } from '../src/modules/qa/media-qa.js';

async function main() {
  console.log('================================================================');
  console.log('🚀 SOCIALSTUDIO: AUTHENTIC MASTER PROMPT + SUNNY REELS PRODUCTION');
  console.log('================================================================\n');

  const topic = 'How Zomato & Uber Calculate Surge Pricing Under 50ms';
  const angle = 'H3 geospatial hexagonal indexing, Redis in-memory cache, and distributed mutex lock';

  console.log(`[Step 1] Generating authentic master script from MASTER_SCRIPT_PROMPT.md...`);
  console.log(`Topic: "${topic}"`);
  console.log(`Angle: "${angle}"`);

  const session = await masterScriptService.startScriptSession(topic, angle);
  console.log(`[Step 1 Completed] Master script generated with ${session.storyboard.scenes.length} scenes.`);

  // Finalize script to lock typed structure
  const finalizedSession = masterScriptService.finalizeScript(session.id);
  const storyboard = finalizedSession.storyboard;

  console.log('\n--- Script Preview (All Scenes) ---');
  for (let i = 0; i < storyboard.scenes.length; i++) {
    console.log(`Scene ${i + 1} (${storyboard.scenes[i].type}): ${storyboard.scenes[i].narration}`);
  }

  const runId = `master_reel_${Date.now()}`;
  const outDir = path.resolve('media/runs', runId);
  const audioDir = path.resolve(outDir, 'audio');
  const previewDir = path.resolve(outDir, 'previews');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(audioDir, { recursive: true });
  fs.mkdirSync(previewDir, { recursive: true });

  console.log(`\n[Step 2] Synthesizing voiceover with Sarvam AI (${process.env.SARVAM_SPEAKER || 'sunny_hi_reels'})...`);
  const sarvamKey = process.env.SARVAM_API_KEY;
  if (!sarvamKey) {
    throw new Error('SARVAM_API_KEY is missing in .env');
  }

  const speaker = process.env.SARVAM_SPEAKER || 'sunny_hi_reels';
  const ttsProvider = new SarvamTTSProvider(sarvamKey, speaker, 'bulbul:v4-flash', 1.0);
  console.log(`Using SarvamTTSProvider: speaker=${speaker}, model=bulbul:v4-flash`);

  const audioResult = await synthesizeStoryboardNarration(storyboard, audioDir, ttsProvider, {
    align: true,
    minDurationSec: 60,
    maxDurationSec: 120,
    targetDurationSec: 85,
  });
  console.log(`[Step 2 Completed] Voiceover synthesized! Duration: ${audioResult.totalDurationSec.toFixed(2)}s across ${audioResult.clips.length} clips.`);

  console.log(`\n[Step 3] Building timeline with frame-accurate Groq Whisper captions & SFX cues...`);
  const timeline = buildVideoTimeline(storyboard, audioResult.clips, {
    fps: 30,
    audioSrcPrefix: `audio/runs/${runId}`,
  });
  console.log(`[Step 3 Completed] Timeline built: ${timeline.totalDurationInFrames} frames (${timeline.totalDurationSec.toFixed(2)}s).`);

  // Stage audio clips for Remotion bundle
  const remotionAudioDir = path.resolve('remotion/public/audio/runs', runId);
  fs.mkdirSync(remotionAudioDir, { recursive: true });
  for (const clip of audioResult.clips) {
    fs.copyFileSync(clip.filePath, path.join(remotionAudioDir, path.basename(clip.filePath)));
  }

  console.log(`\n[Step 4] Rendering still previews for all ${storyboard.scenes.length} scenes...`);
  const previewPaths = await renderStillPreviews(storyboard, timeline, previewDir);
  console.log(`[Step 4 Completed] Rendered ${previewPaths.length} preview stills to ${previewDir}`);

  console.log(`\n[Step 5] Rendering full 1080x1920 MP4 video reel...`);
  const finalMp4Path = path.resolve(outDir, 'final_sunny_reel.mp4');
  const renderStartTime = Date.now();

  const renderResult = await renderStudioShort({
    storyboard,
    timeline,
    outputFilePath: finalMp4Path,
    onProgress: (p) => {
      const pct = Math.round(p * 100);
      if (pct % 10 === 0) {
        console.log(`[Render Progress] ${pct}% rendered...`);
      }
    },
  });

  const renderDurationSec = ((Date.now() - renderStartTime) / 1000).toFixed(1);
  console.log(`[Step 5 Completed] Video successfully rendered in ${renderDurationSec}s!`);
  console.log(`Output Video: ${finalMp4Path} (${(renderResult.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB)`);

  console.log(`\n[Step 6] Performing Media QA verification...`);
  const qaResult = await performMediaQA(renderResult, timeline);
  console.log(`[Step 6 Completed] Media QA result:`, qaResult);

  console.log('\n================================================================');
  console.log('🎉 COMPLETE MASTER PRODUCTION REEL FINISHED!');
  console.log(`Video File: ${finalMp4Path}`);
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Fatal error during production reel generation:', err);
  process.exit(1);
});
