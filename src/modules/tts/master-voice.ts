import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { findFfmpeg, durationSeconds } from './sarvam-provider.js';
import type { SynthesizedAudioClip } from './tts-provider.js';

// Apply the same bounded rate to each scene, then measure levels and pauses at delivery speed.
export function masterVoice(clip: SynthesizedAudioClip, tempo = 1): void {
  const dir = fs.mkdtempSync(path.join(path.dirname(clip.filePath), 'voice-'));
  try {
    const output = path.join(dir, 'master.mp3');
    const process = spawnSync(findFfmpeg(), ['-hide_banner', '-nostats', '-i', clip.filePath,
      '-af', `atempo=${tempo},silencedetect=n=-42dB:d=0.14,loudnorm=I=-16:TP=-2:LRA=7`,
      '-ar', '48000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '160k', output,
    ], { encoding: 'utf8', windowsHide: true });
    if (process.error) throw process.error;
    if (process.status !== 0) throw new Error('Voice mastering failed: ' + process.stderr.slice(-500));
    let start = 0;
    clip.quietIntervals = [];
    for (const match of process.stderr.matchAll(/silence_(start|end): ([\d.]+)/g)) {
      if (match[1] === 'start') start = Number(match[2]);
      else clip.quietIntervals.push({ start, end: Number(match[2]) });
    }
    const durationMs = Math.round(durationSeconds(output) * 1000);
    fs.renameSync(output, clip.filePath);
    if (tempo !== 1) {
      if (clip.alignment) clip.alignment.starts = clip.alignment.starts.map(t => t / tempo);
      clip.wordTimestamps = clip.wordTimestamps?.map(w => ({ ...w, start: w.start / tempo, end: w.end / tempo }));
    }
    clip.durationMs = durationMs;
    clip.fileSizeBytes = fs.statSync(clip.filePath).size;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
