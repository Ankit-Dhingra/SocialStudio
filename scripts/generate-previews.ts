import path from 'node:path';
import fs from 'node:fs';
import { bundle } from '@remotion/bundler';
import { renderStill, renderMedia, selectComposition } from '@remotion/renderer';

async function main() {
  const sessionPath = path.resolve('media/sessions/session_1794686310227_ao6wl.json');
  if (!fs.existsSync(sessionPath)) {
    throw new Error('Session file not found: ' + sessionPath);
  }

  const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  const { storyboard, timeline } = session;

  const artifactDir = 'C:/Users/ankit/.gemini/antigravity/brain/df73ecc3-3d8d-41bc-ad30-f2dfba53b9bf';
  const publicDir = path.resolve('remotion/public/previews');
  const mediaDir = path.resolve('media/previews');

  for (const d of [artifactDir, publicDir, mediaDir]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }

  console.log('[Preview] Bundling Remotion StudioShort composition...');
  const entryPoint = path.resolve('remotion/index.ts');
  const bundleLocation = await bundle({
    entryPoint,
    publicDir: path.resolve('remotion/public'),
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        extensionAlias: {
          '.js': ['.ts', '.tsx', '.js'],
        },
      },
    }),
  });

  console.log('[Preview] Selecting composition...');
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'StudioShort',
    inputProps: { storyboard, timeline },
    chromiumOptions: {
      gl: 'swangle',
      disableWebSecurity: true,
    },
  });

  const framesToCapture = [
    { name: 'pilot_step1_ticket_ui', frame: 35, label: 'Step 1: Realistic Ticket Booking Card (1 Seat Left)' },
    { name: 'pilot_step3_simultaneous_click', frame: 135, label: 'Steps 2 & 3: Two Users Viewing & Clicking (.120 vs .124)' },
    { name: 'pilot_step4_network_packets', frame: 185, label: 'Step 4: Packets Traveling Over SVG Bezier Network Lanes' },
    { name: 'pilot_step5_read_stock_overlap', frame: 235, label: 'Step 5: Race Hazard - Both Threads Concurrently Read Stock = 1' },
    { name: 'pilot_step6_atomic_resolution', frame: 295, label: 'Step 6: Atomic Update Resolution (Aman Confirmed, Riya Rejected)' },
    { name: 'act_2_parallel_execution_trap', frame: (timeline.segments[1]?.startFrame || 324) + 60, label: 'Act 2: Naive Query vs Distributed Lock' },
    { name: 'act_3_redis_lock_engine', frame: (timeline.segments[2]?.startFrame || 770) + 80, label: 'Act 3: In-Memory Redis Lock Pipeline' },
    { name: 'act_4_server_crash_ttl_expiry', frame: (timeline.segments[3]?.startFrame || 2258) + 80, label: 'Act 4: Server Crash & TTL Deadlock Safety' },
    { name: 'act_5_senior_sde_tradeoff_matrix', frame: (timeline.segments[4]?.startFrame || 3592) + 80, label: 'Act 5: Senior SDE-3 Tradeoff Decision Matrix' },
  ];

  console.log('[Preview] Rendering representative high-res 1080x1920 stills...');

  for (const item of framesToCapture) {
    const filename = `${item.name}.jpg`;
    const targetPath = path.join(publicDir, filename);

    console.log(`[Preview] Capturing ${item.label} at frame ${item.frame}...`);
    await renderStill({
      composition,
      serveUrl: bundleLocation,
      frame: item.frame,
      output: targetPath,
      imageFormat: 'jpeg',
      jpegQuality: 92,
      inputProps: { storyboard, timeline },
      chromiumOptions: {
        gl: 'swangle',
        disableWebSecurity: true,
      },
    });

    // Copy to artifact dir and media dir
    fs.copyFileSync(targetPath, path.join(artifactDir, filename));
    fs.copyFileSync(targetPath, path.join(mediaDir, filename));
    console.log(`✅ Saved screenshot: ${filename}`);
  }

  // Also render short pilot MP4 of Scene 1 (0 to 324 frames, ~10.8s)
  const pilotVideoOutput = path.join(mediaDir, 'pilot_race_condition.mp4');
  console.log('[Preview] Rendering pilot MP4 preview (frames 0 to 324)...');
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: pilotVideoOutput,
    inputProps: { storyboard, timeline },
    frameRange: [0, 324],
    chromiumOptions: {
      gl: 'swangle',
      disableWebSecurity: true,
    },
    onProgress: ({ progress }) => {
      process.stdout.write(`\r[Preview] MP4 Progress: ${Math.round(progress * 100)}%`);
    },
  });

  // Copy MP4 to artifact dir as well
  fs.copyFileSync(pilotVideoOutput, path.join(artifactDir, 'pilot_race_condition.mp4'));
  console.log('\n🎉 Rendered pilot MP4 video: ' + pilotVideoOutput);
}

main().catch((err) => {
  console.error('❌ Error generating previews:', err);
  process.exit(1);
});
