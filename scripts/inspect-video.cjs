const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ffprobe = '.\\node_modules\\@remotion\\compositor-win32-x64-msvc\\ffprobe.exe';
const file = 'media/runs/session_1795069714467_33cjt/final-7388282c-d9bb-4620-b372-cdab58321de1.mp4';

console.log('Probing:', file);
const vOut = execSync(`"${ffprobe}" -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration,codec_name -of json "${file}"`).toString();
const aOut = execSync(`"${ffprobe}" -v error -select_streams a:0 -show_entries stream=codec_name,channels,sample_rate,duration,bit_rate -of json "${file}"`).toString();
const fOut = execSync(`"${ffprobe}" -v error -show_entries format=duration,size,bit_rate -of json "${file}"`).toString();

console.log('Video:', JSON.parse(vOut).streams[0]);
console.log('Audio:', JSON.parse(aOut).streams[0]);
console.log('Format:', JSON.parse(fOut).format);
