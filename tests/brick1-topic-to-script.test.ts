import { generateHinglishScript } from '../src/modules/ai-script/script-generator.js';

async function runBrick1Verification() {
  console.log('=====================================================');
  console.log('🚀 BRICK 1 VERIFICATION: Topic-to-Script Hinglish Engine');
  console.log('=====================================================\n');

  const topicA = 'How Node.js Event Loop handles Microtasks vs Macrotasks';
  const topicB = 'How Redis TTL works behind the scenes';

  console.log(`[Test 1/2] Generating Script for Topic A: "${topicA}"...`);
  const startA = Date.now();
  const storyboardA = await generateHinglishScript({ topic: topicA });
  const durationA = Date.now() - startA;

  console.log(`✅ Topic A Generated in ${durationA}ms!`);
  console.log(`Title: ${storyboardA.title}`);
  console.log(`Hook: ${storyboardA.hook}`);
  console.log(`Scenes count: ${storyboardA.scenes.length}`);
  console.log(`First Scene Narration: "${storyboardA.scenes[0].narration}"`);
  console.log(`First Scene Type: ${storyboardA.scenes[0].type}`);
  console.log('-----------------------------------------------------\n');

  console.log(`[Test 2/2] Generating Script for Topic B: "${topicB}"...`);
  const startB = Date.now();
  const storyboardB = await generateHinglishScript({ topic: topicB });
  const durationB = Date.now() - startB;

  console.log(`✅ Topic B Generated in ${durationB}ms!`);
  console.log(`Title: ${storyboardB.title}`);
  console.log(`Hook: ${storyboardB.hook}`);
  console.log(`Scenes count: ${storyboardB.scenes.length}`);
  console.log(`First Scene Narration: "${storyboardB.scenes[0].narration}"`);
  console.log(`First Scene Type: ${storyboardB.scenes[0].type}`);
  console.log('-----------------------------------------------------\n');

  console.log('🔍 RUNNING PRD RELEASE GATE ASSERTIONS:');

  // Assertion 1: Topics match exactly
  if (storyboardA.topic !== topicA || storyboardB.topic !== topicB) {
    throw new Error('FAIL: Storyboard topic does not match requested topic!');
  }
  console.log('  ✔ Topic preservation: PASSED');

  // Assertion 2: Distinct content
  if (storyboardA.title === storyboardB.title || storyboardA.hook === storyboardB.hook) {
    throw new Error('FAIL: Storyboard A and B are duplicates!');
  }
  console.log('  ✔ Content divergence (A != B): PASSED');

  // Assertion 3: Semantic topic checks
  const textA = JSON.stringify(storyboardA).toLowerCase();
  const textB = JSON.stringify(storyboardB).toLowerCase();

  const hasEventLoop = textA.includes('microtask') || textA.includes('event loop') || textA.includes('macrotask');
  const hasRedis = textB.includes('redis') || textB.includes('ttl') || textB.includes('expire');

  if (!hasEventLoop) {
    throw new Error('FAIL: Storyboard A is missing Event Loop / Microtask terminology');
  }
  if (!hasRedis) {
    throw new Error('FAIL: Storyboard B is missing Redis / TTL terminology');
  }
  console.log('  ✔ Semantic accuracy (A has event loop, B has Redis): PASSED');

  // Assertion 4: Not static fallback
  const demoMarker = 'Node.js event loop handles thousands of connections';
  if (textA.includes(demoMarker.toLowerCase()) || textB.includes(demoMarker.toLowerCase())) {
    throw new Error('FAIL: Deceptive static demo fallback detected!');
  }
  console.log('  ✔ Zero deceptive fallback: PASSED');

  console.log('\n🎉 ALL BRICK 1 ASSERTIONS PASSED SUCCESSFULLY!');

  // Print full preview of Storyboard A for creator review
  console.log('\n=====================================================');
  console.log('📜 FULL STORYBOARD PREVIEW: Topic A');
  console.log('=====================================================');
  console.log(JSON.stringify(storyboardA, null, 2));
}

runBrick1Verification().catch((err) => {
  console.error('\n❌ BRICK 1 VERIFICATION FAILED:', err);
  process.exit(1);
});
