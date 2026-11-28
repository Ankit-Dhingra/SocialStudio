import { v2 as cloudinary } from 'cloudinary';

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_USAGE_API_KEY, CLOUDINARY_USAGE_API_SECRET, CLOUDINARY_USAGE_OAUTH_TOKEN } = process.env;
const warningPercent = Number(process.env.CLOUDINARY_USAGE_WARN_PERCENT ?? '80');

try {
  if (!CLOUDINARY_CLOUD_NAME || (!CLOUDINARY_USAGE_OAUTH_TOKEN && !(CLOUDINARY_USAGE_API_KEY && CLOUDINARY_USAGE_API_SECRET)) ||
    !Number.isFinite(warningPercent) || warningPercent <= 0 || warningPercent > 100) {
    throw new Error('Usage monitoring configuration is invalid or incomplete.');
  }
  const usage = await cloudinary.api.usage({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    ...(CLOUDINARY_USAGE_OAUTH_TOKEN ? { oauth_token: CLOUDINARY_USAGE_OAUTH_TOKEN } :
      { api_key: CLOUDINARY_USAGE_API_KEY, api_secret: CLOUDINARY_USAGE_API_SECRET }),
    timeout: 10_000,
  });
  const used = usage.credits?.usage;
  const limit = usage.credits?.limit;
  if (!Number.isFinite(used) || !Number.isFinite(limit) || used < 0 || limit <= 0) {
    throw new Error('Cloudinary usage did not include a valid credit allowance.');
  }
  const percentUsed = used / limit * 100;
  console.log(JSON.stringify({
    plan: usage.plan,
    credits: { used, limit, remaining: Math.max(0, limit - used), percentUsed },
    storageBytes: usage.storage?.usage,
    bandwidthBytes: usage.bandwidth?.usage,
    transformations: usage.transformations?.usage,
  }, null, 2));
  if (percentUsed >= warningPercent) {
    console.error(`Cloudinary usage reached the configured ${warningPercent}% threshold.`);
    process.exitCode = 2;
  }
} catch {
  console.error('Cloudinary usage is unavailable. Check the monitoring credential, cloud name and warning threshold.');
  process.exitCode = 1;
}
