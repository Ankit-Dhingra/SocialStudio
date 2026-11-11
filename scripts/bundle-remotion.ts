import path from 'node:path';
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

  console.log(`[Build] Remotion composition pre-bundled successfully to: ${bundleLocation}`);
}

main().catch((err) => {
  console.error('[Build Error] Remotion pre-bundling failed:', err);
  process.exit(1);
});
