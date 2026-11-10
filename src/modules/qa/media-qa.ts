import fs from 'node:fs';
import path from 'node:path';
import { RenderResult } from '../render/video-renderer.js';
import { VideoTimeline } from '../video/timeline.js';

export interface QAReport {
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    details: string;
  }[];
  fileSizeBytes: number;
  durationSec: number;
  sha256: string;
  errors: string[];
}

export function performMediaQA(renderResult: RenderResult, timeline: VideoTimeline): QAReport {
  const checks: QAReport['checks'] = [];
  const errors: string[] = [];

  // Check 1: File Exists & Size
  const exists = fs.existsSync(renderResult.outputFilePath);
  const minSize = 1024 * 1024; // 1MB minimum for 40s 1080x1920 video
  const hasMinSize = renderResult.fileSizeBytes >= minSize;

  checks.push({
    name: 'File Exists & Size Check',
    passed: exists && hasMinSize,
    details: `Size: ${(renderResult.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB (Min required: 1 MB)`,
  });
  if (!exists || !hasMinSize) {
    errors.push(`File missing or smaller than 1MB: size=${renderResult.fileSizeBytes}`);
  }

  // Check 2: Duration Consistency
  const durationDiff = Math.abs(renderResult.durationSec - timeline.totalDurationSec);
  const durationMatch = durationDiff <= 0.5; // within 0.5s tolerance

  checks.push({
    name: 'Duration Consistency Check',
    passed: durationMatch,
    details: `Rendered: ${renderResult.durationSec}s, Expected: ${timeline.totalDurationSec}s (Diff: ${durationDiff.toFixed(2)}s)`,
  });
  if (!durationMatch) {
    errors.push(`Duration mismatch: rendered=${renderResult.durationSec}s vs expected=${timeline.totalDurationSec}s`);
  }

  // Check 3: Checksum Integrity
  const hasValidHash = Boolean(renderResult.sha256 && renderResult.sha256.length === 64);
  checks.push({
    name: 'SHA-256 Hash Integrity',
    passed: hasValidHash,
    details: `Hash: ${renderResult.sha256.slice(0, 16)}...`,
  });
  if (!hasValidHash) {
    errors.push('Invalid SHA-256 hash');
  }

  const passed = errors.length === 0;

  return {
    passed,
    checks,
    fileSizeBytes: renderResult.fileSizeBytes,
    durationSec: renderResult.durationSec,
    sha256: renderResult.sha256,
    errors,
  };
}
