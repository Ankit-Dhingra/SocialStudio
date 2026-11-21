import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
dotenv.config();

import { parseCustomScriptToStoryboard } from '../src/modules/ai-script/custom-script-parser.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';
import { renderStudioShort } from '../src/modules/render/video-renderer.js';
import { synthesizeStoryboardNarration } from '../src/modules/tts/tts-service.js';
import { SarvamTTSProvider } from '../src/modules/tts/sarvam-provider.js';
import { performMediaQA } from '../src/modules/qa/media-qa.js';

// The exact script provided by the creator
const creatorScript = {
  title: "How Zomato Surge Pricing Works During Rain",
  hook: "रात के 12 बजे, तेज़ बारिश हो रही है। Zomato पर delivery charge ₹30 से अचानक ₹90 हो गया। Restaurant वही, घर वही, distance भी वही। फिर ये extra ₹60 कहाँ से आ गए?",
  problem: "मान लो उस area में 100 orders आ गए, लेकिन बारिश की वजह से सिर्फ 20 riders available हैं। अब हर order पर पूरी city के riders को search करना expensive होगा। और सिर्फ distance देखकर charge तय करेंगे, तो असली demand और rider shortage का पता ही नहीं चलेगा।",
  solution: "इस problem को solve करने के लिए एक possible design है Location-Based Dynamic Pricing। इसमें पूरे शहर की जगह छोटे geographical areas की demand और available riders को track करते हैं। फिर एक Pricing Engine इन्हीं local conditions के हिसाब से delivery charge calculate करता है।",
  tech_explained: "अब समझो backend में ये कैसे काम कर सकता है। हर rider की app GPS location और availability status भेजती है। System इन locations को छोटे geographical cells में map करता है। इसके लिए H3 Spatial Indexing जैसी technique इस्तेमाल हो सकती है। अब हर cell में कितने orders pending हैं और कितने riders actually available हैं, उसका count maintain किया जाता है। ये counts Redis जैसे fast cache में रख सकते हैं। मान लो तुम्हारे area में 100 orders और सिर्फ 20 available riders हैं। यानी हर rider पर average 5 orders की demand है। Pricing Engine इस imbalance के साथ बारिश, estimated delivery time और configured pricing rules को evaluate करता है। Example के लिए base delivery fee ₹30 है, और इन conditions में ₹60 additional charge calculate हुआ। तो app तुम्हें ₹90 दिखाएगी। लेकिन एक catch है। अगर rider offline हो गया और उसकी पुरानी GPS location cache में बची है, तो system उसे available समझ सकता है। इसलिए recent heartbeat, timestamp और active delivery status verify करना ज़रूरी है।",
  conclusion: "तो ₹30 से ₹90 होने की वजह distance बढ़ना ज़रूरी नहीं है। असली factor हो सकता है local demand, rider availability और delivery conditions का बदलना। यही Dynamic Pricing का core idea है। Price सिर्फ distance से नहीं, current supply-demand conditions से भी प्रभावित हो सकता है।",
  cta: "ऐसी ही interesting tech stories के पीछे की engineering समझने के लिए Behind The Tech को अभी follow करो।"
};

async function main() {
  console.log('================================================================');
  console.log('🚀 SOCIALSTUDIO: RENDERING REEL FROM CREATOR SCRIPT');
  console.log('================================================================\n');

  console.log(`[Step 1] Parsing creator script into 5-Scene Dynamic Storyboard...`);
  const storyboard = await parseCustomScriptToStoryboard(creatorScript);
  console.log(`✅ [Step 1 Completed] Storyboard created with ${storyboard.scenes.length} scenes:`);
  storyboard.scenes.forEach((sc, i) => {
    console.log(`  Scene ${i + 1} (${sc.type}): "${sc.onScreenText}"`);
  });

  const runId = `creator_reel_v3_fastpaced`;
  const outDir = path.resolve('output/creator_reels', runId);
  const audioDir = path.resolve(outDir, 'audio');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(audioDir, { recursive: true });

  console.log(`\n[Step 2] Audio System is LOCKED: Reusing validated creator audio clips...`);
  const lockedAudioDir = path.resolve('output/creator_reels/creator_reel_1795204512674/audio');
  
  // Copy locked audio clips into current run
  const lockedClips = [
    { filePath: path.join(audioDir, 'scene-0.mp3'), durationMs: 13320 },
    { filePath: path.join(audioDir, 'scene-1.mp3'), durationMs: 14592 },
    { filePath: path.join(audioDir, 'scene-2.mp3'), durationMs: 16584 },
    { filePath: path.join(audioDir, 'scene-3.mp3'), durationMs: 63864 },
    { filePath: path.join(audioDir, 'scene-4.mp3'), durationMs: 23976 },
  ];

  for (let i = 0; i < 5; i++) {
    const srcFile = path.join(lockedAudioDir, `scene-${i}.mp3`);
    fs.copyFileSync(srcFile, lockedClips[i].filePath);
  }
  console.log(`✅ [Step 2 Completed] Audio system locked! Reused 5 audio clips (Total Duration: 132.33s). Zero TTS calls made.`);

  console.log(`\n[Step 3] Building dynamic video timeline with SFX cues & locked word alignment...`);
  const timeline = buildVideoTimeline(storyboard, lockedClips, {
    fps: 30,
    audioSrcPrefix: `audio/runs/${runId}`,
  });
  console.log(`✅ [Step 3 Completed] Timeline built: ${timeline.totalDurationInFrames} frames (${timeline.totalDurationSec.toFixed(2)}s)`);

  // Stage audio clips for Remotion public bundle
  const remotionAudioDir = path.resolve('remotion/public/audio/runs', runId);
  fs.mkdirSync(remotionAudioDir, { recursive: true });
  for (const clip of lockedClips) {
    fs.copyFileSync(clip.filePath, path.join(remotionAudioDir, path.basename(clip.filePath)));
  }

  // Also stage in dist-remotion if it exists
  const distAudioDir = path.resolve('dist-remotion/public/audio/runs', runId);
  if (fs.existsSync('dist-remotion')) {
    fs.mkdirSync(distAudioDir, { recursive: true });
    for (const clip of lockedClips) {
      fs.copyFileSync(clip.filePath, path.join(distAudioDir, path.basename(clip.filePath)));
    }
  }

  console.log(`\n[Step 4] Rendering full 1080x1920 MP4 Video Reel...`);
  const finalMp4Path = path.resolve(outDir, 'zomato_surge_creator_reel.mp4');
  const renderStartTime = Date.now();

  const renderResult = await renderStudioShort({
    storyboard,
    timeline,
    outputFilePath: finalMp4Path,
    onProgress: (p) => {
      const pct = Math.round(p * 100);
      if (pct % 15 === 0) {
        console.log(`  [Rendering] ${pct}% completed...`);
      }
    },
  });

  const renderDurationSec = ((Date.now() - renderStartTime) / 1000).toFixed(1);
  console.log(`\n✅ [Step 4 Completed] Reel rendered in ${renderDurationSec}s!`);
  console.log(`📁 Video Path: ${finalMp4Path}`);
  console.log(`📊 File Size: ${(renderResult.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`);

  console.log(`\n[Step 5] Quality Assurance (QA) verification...`);
  const qaResult = await performMediaQA(renderResult, timeline);
  console.log(`✅ [Step 5 Completed] Media QA Result:`, qaResult);

  console.log('\n================================================================');
  console.log('🎉 CREATOR REEL SUCCESSFULLY GENERATED AND READY FOR REVIEW!');
  console.log(`Output: ${finalMp4Path}`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('❌ Fatal error generating creator reel:', err);
  process.exit(1);
});
