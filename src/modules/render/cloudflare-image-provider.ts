import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { findFfmpeg } from '../tts/sarvam-provider.js';

const exec = promisify(execFile);
export const cloudflareImageModel = '@cf/black-forest-labs/flux-2-klein-4b';
export const cloudflareImageSize = { width: 720, height: 1280 };

async function resizeReference(filePath: string): Promise<Blob> {
  try {
    const { stdout } = await exec(findFfmpeg(), [
      '-v', 'error', '-i', filePath, '-vf', 'scale=510:510:force_original_aspect_ratio=decrease:force_divisible_by=2',
      '-frames:v', '1', '-c:v', 'png', '-f', 'image2pipe', 'pipe:1',
    ], { encoding: 'buffer', timeout: 30_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
    return new Blob([new Uint8Array(stdout)], { type: 'image/png' });
  } catch {
    throw new Error('Could not resize the Cloudflare reference image. Check the local FFmpeg installation.');
  }
}

export async function generateCloudflareImage(prompt: string, referencePath?: string): Promise<Buffer> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId) || !token) {
    throw new Error('Cloudflare artwork requires CLOUDFLARE_ACCOUNT_ID and a Workers AI CLOUDFLARE_API_TOKEN.');
  }

  const form = new FormData();
  form.set('prompt', referencePath ? `${prompt}\nUse image 0 as a reference for the same people and setting while changing the composition.` : prompt);
  form.set('width', String(cloudflareImageSize.width));
  form.set('height', String(cloudflareImageSize.height));
  if (referencePath) form.set('input_image_0', await resizeReference(referencePath), 'reference.png');

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${cloudflareImageModel}`;
  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form, signal: AbortSignal.timeout(90_000) });
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError' ? 'timed out' : 'could not be reached';
    throw new Error(`Cloudflare Workers AI ${reason}.`);
  }
  if (!response.ok) {
    const status = response.status;
    const payload = await response.json().catch(() => undefined) as { errors?: Array<{ code?: number }> } | undefined;
    const code = payload?.errors?.[0]?.code;
    const detail = status === 401 || status === 403 ? ' Check the token’s Workers AI permission and account.'
      : status === 429 ? ' Check the Workers AI quota and rate limits.' : '';
    throw new Error(`Cloudflare Workers AI returned HTTP ${status}${Number.isInteger(code) ? ` (code ${code})` : ''}.${detail}`);
  }
  if (response.headers.get('content-type')?.startsWith('image/')) return Buffer.from(await response.arrayBuffer());
  const payload = await response.json().catch(() => undefined) as { success?: boolean; result?: { image?: string } } | undefined;
  if (!payload?.success || typeof payload.result?.image !== 'string') throw new Error('Cloudflare Workers AI did not return a usable image.');
  return Buffer.from(payload.result.image, 'base64');
}
