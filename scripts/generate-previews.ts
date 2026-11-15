import path from 'node:path';
import fs from 'node:fs';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';

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
    { scene: 1, name: 'act_1_race_condition_hook', frame: 50, label: 'Act 1: Two Users Booking Collision' },
    { scene: 2, name: 'act_2_parallel_execution_trap', frame: (timeline.segments[1]?.startFrame || 210) + 40, label: 'Act 2: Naive Query vs Distributed Lock' },
    { scene: 3, name: 'act_3_redis_lock_engine', frame: (timeline.segments[2]?.startFrame || 500) + 60, label: 'Act 3: In-Memory Redis Lock Pipeline' },
    { scene: 4, name: 'act_4_server_crash_ttl_expiry', frame: (timeline.segments[3]?.startFrame || 1700) + 60, label: 'Act 4: Edge Case - Server Crash & TTL Deadlock Safety' },
    { scene: 5, name: 'act_5_senior_sde_tradeoff_matrix', frame: (timeline.segments[4]?.startFrame || 2900) + 60, label: 'Act 5: Senior SDE-3 Tradeoff Decision Matrix' },
  ];

  console.log('[Preview] Rendering 5 high-res 1080x1920 still screenshots...');

  for (const item of framesToCapture) {
    const filename = `${item.name}.jpg`;
    const targetPath = path.join(publicDir, filename);

    console.log(`[Preview] Capturing Scene ${item.scene} (${item.label}) at frame ${item.frame}...`);
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

  console.log('🎉 All 5 scene preview screenshots rendered successfully!');
}

main().catch((err) => {
  console.error('❌ Error generating previews:', err);
  process.exit(1);
});
