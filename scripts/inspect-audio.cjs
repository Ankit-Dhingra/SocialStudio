const fs = require('fs');
const { execSync } = require('child_process');

const dir = 'remotion/public/audio/runs/session_1795068716175_n2nmx';
const sub = fs.readdirSync(dir).find(d => fs.statSync(dir + '/' + d).isDirectory());
const fullDir = dir + '/' + sub;
const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.mp3') && f.startsWith('scene-'));
let total = 0;
files.forEach(f => {
  const out = parseFloat(execSync(`".\\node_modules\\@remotion\\compositor-win32-x64-msvc\\ffprobe.exe" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${fullDir}/${f}"`).toString().trim());
  total += out;
  console.log(f, out.toFixed(2) + 's');
});
console.log('Total duration:', total.toFixed(2) + 's');
