const fs = require('fs');
const { execSync } = require('child_process');

const s = JSON.parse(fs.readFileSync('media/sessions/session_1795068716175_n2nmx.json', 'utf8'));
const dir = 'remotion/public/audio/runs/session_1795068716175_n2nmx';
const sub = fs.readdirSync(dir).find(d => fs.statSync(dir + '/' + d).isDirectory());
const fullDir = dir + '/' + sub;

let totalWords = 0;
let totalDur = 0;

s.storyboard.scenes.forEach((sc, i) => {
  const f = `scene-${i}.mp3`;
  const dur = parseFloat(execSync(`".\\node_modules\\@remotion\\compositor-win32-x64-msvc\\ffprobe.exe" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${fullDir}/${f}"`).toString().trim());
  const words = (sc.narration || '').trim().split(/\s+/).filter(Boolean);
  totalWords += words.length;
  totalDur += dur;
  console.log(`Scene ${i+1}: ${dur.toFixed(2)}s | ${words.length} words | ${(dur/words.length).toFixed(2)}s/w | ${(words.length/dur).toFixed(2)} w/s`);
  console.log(`   "${sc.narration}"`);
});

console.log(`\nTOTAL: ${totalDur.toFixed(2)}s for ${totalWords} words.`);
console.log(`Average speed: ${(totalWords / totalDur).toFixed(2)} words/sec (${(totalDur / totalWords).toFixed(2)} sec/word).`);
const target105Words = Math.round(105 * (totalWords / totalDur));
console.log(`For 105 seconds: need exactly ${target105Words} words!`);
console.log(`For 95 seconds (min 90): need ${Math.round(95 * (totalWords / totalDur))} words.`);
console.log(`For 115 seconds (max 120): need ${Math.round(115 * (totalWords / totalDur))} words.`);
