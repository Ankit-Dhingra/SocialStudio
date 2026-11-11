import path from 'node:path';
import fs from 'node:fs';
import { bundle } from '@remotion/bundler';

async function main() {
  console.log('[Build] Pre-bundling Remotion composition...');
  const entryPoint = path.resolve('remotion/index.ts');
  const outDir = path.resolve('dist-remotion');
  const publicDir = path.resolve('remotion/public');

  const bundleLocation = await bundle({
    entryPoint,
    outDir,
    publicDir,
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

  // Ensure all static assets from remotion/public are copied to both root of outDir and outDir/public
  if (fs.existsSync(publicDir)) {
    console.log('[Build] Copying public directory assets into bundle output...');
    fs.cpSync(publicDir, outDir, { recursive: true, force: true });
    const distPublic = path.join(outDir, 'public');
    if (!fs.existsSync(distPublic)) {
      fs.mkdirSync(distPublic, { recursive: true });
    }
    fs.cpSync(publicDir, distPublic, { recursive: true, force: true });
  }

  console.log(`[Build] Remotion composition pre-bundled successfully to: ${bundleLocation}`);
}

main().catch((err) => {
  console.error('[Build Error] Remotion pre-bundling failed:', err);
  process.exit(1);
});
