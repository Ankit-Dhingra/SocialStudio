import path from 'node:path';
import fs from 'node:fs';
import { generateHinglishScript } from '../src/modules/ai-script/script-generator.js';
import { synthesizeStoryboardNarration } from '../src/modules/tts/tts-service.js';

async function runBrick2Verification() {
  console.log('=====================================================');
  console.log('🚀 BRICK 2 VERIFICATION: Free Neural Voice Synthesis');
  console.log('=====================================================\n');

  const topic = 'How Node.js Event Loop handles Microtasks vs Macrotasks';
  console.log(`Step 1: Generating Hinglish Storyboard for "${topic}"...`);
  const storyboard = await generateHinglishScript({ topic });
  console.log(`✅ Storyboard ready with ${storyboard.scenes.length} scenes.\n`);

  const runDir = path.resolve('media/runs/test-run-1');
  if (fs.existsSync(runDir)) {
    fs.rmSync(runDir, { recursive: true, force: true });
  }
  fs.mkdirSync(runDir, { recursive: true });

  console.log(`Step 2: Synthesizing per-scene narration clips in: ${runDir}...`);
  const audioResult = await synthesizeStoryboardNarration(storyboard, runDir);

  console.log('\n=====================================================');
  console.log('📊 AUDIO SYNTHESIS REPORT');
  console.log('=====================================================');
  console.log(`Total Narration Duration: ${audioResult.totalDurationSec} seconds (${audioResult.totalDurationMs} ms)`);
  console.log(`Clips generated: ${audioResult.clips.length}\n`);

  for (const clip of audioResult.clips) {
    const scene = storyboard.scenes[clip.sceneIndex];
    console.log(`- Scene ${clip.sceneIndex + 1} [${scene.type}]:`);
    console.log(`  File: ${path.basename(clip.filePath)}`);
    console.log(`  Duration: ${(clip.durationMs / 1000).toFixed(2)}s (${clip.durationMs}ms)`);
    console.log(`  Size: ${(clip.fileSizeBytes / 1024).toFixed(1)} KB`);
    console.log(`  Narration: "${scene.narration}"`);
    console.log('');
  }

  console.log('🔍 RUNNING PRD RELEASE GATE ASSERTIONS:');
  if (audioResult.clips.length !== storyboard.scenes.length) {
    throw new Error('FAIL: Not all scenes have synthesized audio clips!');
  }
  console.log('  ✔ Scene audio clip count matching storyboard: PASSED');

  for (const clip of audioResult.clips) {
    if (!fs.existsSync(clip.filePath)) {
      throw new Error(`FAIL: File does not exist at ${clip.filePath}`);
    }
    if (clip.fileSizeBytes < 2000) {
      throw new Error(`FAIL: Audio clip too small (${clip.fileSizeBytes} bytes)`);
    }
    if (clip.durationMs < 1000) {
      throw new Error(`FAIL: Audio duration abnormally short (${clip.durationMs}ms)`);
    }
  }
  console.log('  ✔ File integrity & non-zero audio: PASSED');

  if (audioResult.totalDurationSec < 15 || audioResult.totalDurationSec > 95) {
    throw new Error(`FAIL: Total duration outside realistic Short range (${audioResult.totalDurationSec}s)`);
  }
  console.log('  ✔ Realistic Short duration range: PASSED');

  console.log('\n🎉 ALL BRICK 2 ASSERTIONS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runBrick2Verification().catch((err) => {
  console.error('\n❌ BRICK 2 VERIFICATION FAILED:', err);
  process.exit(1);
});
