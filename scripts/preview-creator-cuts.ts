import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
dotenv.config();

import { renderStill, selectComposition } from '@remotion/renderer';
import { parseCustomScriptToStoryboard } from '../src/modules/ai-script/custom-script-parser.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';

const creatorScript = {
  title: "How Zomato Surge Pricing Works During Rain",
  hook: "रात के 12 बजे, तेज़ बारिश हो रही है। Zomato पर delivery charge ₹30 से अचानक ₹90 हो गया। Restaurant वही, घर वही, distance भी वही। फिर ये extra ₹60 कहाँ से आ गए?",
  problem: "मान लो उस area में 100 orders आ गए, लेकिन बारिश की वजह से सिर्फ 20 riders available हैं। अब हर order पर पूरी city के riders को search करना expensive होगा। और सिर्फ distance देखकर charge तय करेंगे, तो असली demand और rider shortage का पता ही नहीं चलेगा।",
  solution: "इस problem को solve करने के लिए एक possible design है Location-Based Dynamic Pricing। इसमें पूरे शहर की जगह छोटे geographical areas की demand और available riders को track करते हैं। फिर एक Pricing Engine इन्हीं local conditions के हिसाब से delivery charge calculate करता है।",
  tech_explained: "अब समझो backend में ये कैसे काम कर सकता है। हर rider की app GPS location और availability status भेजती है। System इन locations को छोटे geographical cells में map करता है। इसके लिए H3 Spatial Indexing जैसी technique इस्तेमाल हो सकती है। अब हर cell में कितने orders pending हैं और कितने riders actually available हैं, उसका count maintain किया जाता है। ये counts Redis जैसे fast cache में रख सकते हैं। मान लो तुम्हारे area में 100 orders और सिर्फ 20 available riders हैं। यानी हर rider पर average 5 orders की demand है। Pricing Engine इस imbalance के साथ बारिश, estimated delivery time और configured pricing rules को evaluate करता है। Example के लिए base delivery fee ₹30 है, और इन conditions में ₹60 additional charge calculate हुआ। तो app तुम्हें ₹90 दिखाएगी। लेकिन एक catch है। अगर rider offline हो गया और उसकी पुरानी GPS location cache में बची है, तो system उसे available समझ सकता है। इसलिए recent heartbeat, timestamp और active delivery status verify करना ज़रूरी है।",
  conclusion: "तो ₹30 से ₹90 होने की वजह distance बढ़ना ज़रूरी नहीं है। असली factor हो सकता है local demand, rider availability और delivery conditions का बदलना। यही Dynamic Pricing का core idea है। Price सिर्फ distance से नहीं, current supply-demand conditions से भी प्रभावित हो सकता है।",
  cta: "ऐसी ही interesting tech stories के पीछे की engineering समझने के लिए Behind The Stack को अभी follow करो。"
};

async function main() {
  console.log('================================================================');
  console.log('📸 SOCIALSTUDIO: RENDERING FAST-PACED PREVIEW CUTS');
  console.log('================================================================\n');

  const outDir = path.resolve('output/creator_previews');
  fs.mkdirSync(outDir, { recursive: true });

  const storyboard = await parseCustomScriptToStoryboard(creatorScript);

  // Exact locked audio durations from output/creator_reels/creator_reel_1795204512674/audio
  const audioClips = [
    { filePath: 'output/creator_reels/creator_reel_1795204512674/audio/scene-0.mp3', durationMs: 13320 },
    { filePath: 'output/creator_reels/creator_reel_1795204512674/audio/scene-1.mp3', durationMs: 14592 },
    { filePath: 'output/creator_reels/creator_reel_1795204512674/audio/scene-2.mp3', durationMs: 16584 },
    { filePath: 'output/creator_reels/creator_reel_1795204512674/audio/scene-3.mp3', durationMs: 63864 },
    { filePath: 'output/creator_reels/creator_reel_1795204512674/audio/scene-4.mp3', durationMs: 23976 },
  ];

  const timeline = buildVideoTimeline(storyboard, audioClips, {
    fps: 30,
    audioSrcPrefix: 'audio/runs/creator_reel_1795204512674',
  });

  console.log(`Timeline built: ${timeline.totalDurationInFrames} total frames (~${timeline.totalDurationSec.toFixed(1)}s)`);
  timeline.segments.forEach((seg, i) => {
    console.log(`  Scene ${i + 1} (${seg.type}): Start Frame ${seg.startFrame}, Duration ${seg.durationInFrames} frames (${(seg.durationInFrames / 30).toFixed(1)}s)`);
  });

  const bundleLocation = path.resolve('dist-remotion');
  console.log('\n[Preview] Selecting composition StudioShort from dist-remotion...');

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'StudioShort',
    inputProps: {
      storyboard,
      timeline,
    },
  });

  // Calculate cut frames based on segment start frames
  const s0 = timeline.segments[0].startFrame;
  const s1 = timeline.segments[1].startFrame;
  const s2 = timeline.segments[2].startFrame;
  const s3 = timeline.segments[3].startFrame;
  const s4 = timeline.segments[4].startFrame;

  const previewTargets = [
    {
      name: 'cut_01_hook_phone_surge.jpg',
      frame: s0 + 75,
      label: 'Cut 0.1 (Scene 1): Zomato Smartphone Surge ₹30 ➔ ₹90',
    },
    {
      name: 'cut_02_hook_receipt_audit.jpg',
      frame: s0 + 260,
      label: 'Cut 0.2 (Scene 1): Receipt Audit (Same Restaurant, Same Distance, Extra ₹60 Why?)',
    },
    {
      name: 'cut_03_problem_area_shortage_map.jpg',
      frame: s1 + 100,
      label: 'Cut 1.1 (Scene 2): 100 Orders vs 20 Riders + Failed City-Wide Search Stamp',
    },
    {
      name: 'cut_04_problem_comparison_matrix.jpg',
      frame: s1 + 280,
      label: 'Cut 1.2 (Scene 2): Naive Distance vs Real Telemetry Matrix',
    },
    {
      name: 'cut_05_solution_h3_hex_mesh.jpg',
      frame: s2 + 120,
      label: 'Cut 2.1 (Scene 3): H3 Hexagonal Spatial Partitioning (#88619A0A4)',
    },
    {
      name: 'cut_06_solution_pricing_pipeline.jpg',
      frame: s2 + 350,
      label: 'Cut 2.2 (Scene 3): Dynamic Pricing 3-Step Engine Pipeline',
    },
    {
      name: 'cut_07_tech_gps_ingestion.jpg',
      frame: s3 + 180,
      label: 'Cut 3.1 (Scene 4 - Stage 1): Live Rider GPS & Heartbeat Telemetry Ingestion',
    },
    {
      name: 'cut_08_tech_h3_spatial_indexing.jpg',
      frame: s3 + 550,
      label: 'Cut 3.2 (Scene 4 - Stage 2): Uber H3 Spatial Hash (lat/lng ➔ #88619A0A4)',
    },
    {
      name: 'cut_09_tech_redis_telemetry_counter.jpg',
      frame: s3 + 950,
      label: 'Cut 3.3 (Scene 4 - Stage 3): Redis In-Memory State (100 Orders : 20 Riders = 5.0x Deficit)',
    },
    {
      name: 'cut_10_tech_pricing_engine_math.jpg',
      frame: s3 + 1320,
      label: 'Cut 3.4 (Scene 4 - Stage 4): Pricing Engine Formula (Base ₹30 + Surge ₹60 = ₹90)',
    },
    {
      name: 'cut_11_tech_ghost_rider_catch.jpg',
      frame: s3 + 1700,
      label: 'Cut 3.5 (Scene 4 - Stage 5): Edge Case: Ghost Rider Stale Cache Bug & TTL Eviction',
    },
    {
      name: 'cut_12_conclusion_sde_cheat_sheet.jpg',
      frame: s4 + 180,
      label: 'Cut 4.1 (Scene 5 - Part 1): SDE Interview Cheat-Sheet HUD (3 Core Pillars)',
    },
    {
      name: 'cut_13_cta_behind_the_stack.jpg',
      frame: s4 + 500,
      label: 'Cut 4.2 (Scene 5 - Part 2): Viral Screenshot Moment & Behind The Stack Follow CTA',
    },
  ];

  console.log(`\nRendering ${previewTargets.length} high-resolution still frame previews into output/creator_previews/...\n`);

  for (const target of previewTargets) {
    const outPath = path.join(outDir, target.name);
    console.log(`📸 Rendering ${target.label} (Frame ${target.frame})...`);
    await renderStill({
      composition,
      serveUrl: bundleLocation,
      output: outPath,
      frame: target.frame,
      imageFormat: 'jpeg',
      chromiumOptions: {
        enableMultiProcessOnLinux: true,
        gl: 'swangle',
        disableWebSecurity: true,
      },
      inputProps: {
        storyboard,
        timeline,
      },
    });
    console.log(`   ✅ Saved: ${target.name}`);
  }

  console.log('\n================================================================');
  console.log('🎉 ALL 13 PREVIEW CUTS SUCCESSFULLY GENERATED!');
  console.log(`Directory: ${outDir}`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('❌ Error rendering preview cuts:', err);
  process.exit(1);
});
