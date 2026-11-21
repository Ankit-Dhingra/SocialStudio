const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ffmpeg = '.\\node_modules\\@remotion\\compositor-win32-x64-msvc\\ffmpeg.exe';
const sessionId = process.argv[2] || 'session_1795070617373_xe6pj';
const runDir = path.resolve('media/runs', sessionId);
const mp4Files = fs.readdirSync(runDir).filter(f => f.endsWith('.mp4'));
if (mp4Files.length === 0) {
  console.error(`No MP4 found in ${runDir}`);
  process.exit(1);
}
const videoFile = path.join(runDir, mp4Files[0]);
const outDir = path.join(runDir, 'paired_frames');
fs.mkdirSync(outDir, { recursive: true });

console.log(`Extracting paired frames from ${videoFile}...`);

const targets = [
  { name: 'phone_price_before_reveal.jpg', time: '00:00:01.33', desc: 'Phone Price BEFORE Reveal (₹30 Standard Delivery, ₹330 Total)' },
  { name: 'phone_price_after_reveal.jpg', time: '00:00:04.00', desc: 'Phone Price AFTER Reveal (₹80 Surge Delivery, 2.7X Surge, ₹380 Total)' },
  { name: 'distributed_lock_before.jpg', time: '00:01:05.50', desc: 'Distributed Mutex Step 1 (Lock Held by Worker A)' },
  { name: 'distributed_lock_after.jpg', time: '00:01:12.00', desc: 'Distributed Mutex Step 4 (Worker B Acquires Lock after Redis TTL Expiry)' },
];

targets.forEach(t => {
  const outPath = path.join(outDir, t.name);
  execSync(`"${ffmpeg}" -y -ss ${t.time} -i "${videoFile}" -vframes 1 -q:v 2 "${outPath}"`);
  const size = fs.statSync(outPath).size;
  console.log(`✅ Extracted: ${t.name} (${size} bytes) at ${t.time}`);
  console.log(`   Description: ${t.desc}`);
  console.log(`   Path: ${path.resolve(outPath)}\n`);
});
