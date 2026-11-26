import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';

const output = path.resolve('output/premium-design/showcase');
await fs.mkdir(output, { recursive: true });

const serveUrl = await bundle({
  entryPoint: path.resolve('remotion/design-showcase.tsx'),
  publicDir: path.resolve('remotion/public'),
  webpackOverride: config => ({
    ...config, resolve: { ...config.resolve, extensionAlias: { '.js': ['.ts', '.tsx', '.js'] } },
  }),
});

const artwork = process.argv[2];
let cinematicAsset = '';
if (artwork) {
  const extension = path.extname(artwork).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) throw new Error('Supply a local PNG, JPEG or WebP image.');
  cinematicAsset = `showcase-plate${extension}`;
  await fs.copyFile(path.resolve(artwork), path.join(serveUrl, 'public', cinematicAsset));
}

const inputProps = { cinematicAsset };
const licenseKey = process.env.REMOTION_PRIVATE_LICENSE_KEY?.trim() || undefined;
const browser = await openBrowser('chrome');
try {
  const composition = await selectComposition({
    serveUrl, id: 'PremiumDesignShowcase', inputProps, puppeteerInstance: browser,
  });
  for (const [name, frame] of Object.entries({
    cinematic: 42, phone: 202, request: 252, processing: 297, success: 334, error: 449, chart: 545,
  })) {
    await renderStill({ composition, serveUrl, inputProps, frame,
      output: path.join(output, `${name}.jpg`), imageFormat: 'jpeg', jpegQuality: 94,
      puppeteerInstance: browser, licenseKey, isProduction: false });
  }
  await renderMedia({
    composition, serveUrl, inputProps, codec: 'h264', audioCodec: 'aac',
    outputLocation: path.join(output, 'premium-design-showcase.mp4'),
    concurrency: 2, puppeteerInstance: browser, licenseKey, isProduction: false,
  });
  console.log(output);
} finally {
  await browser.close({ silent: true });
}
