import 'dotenv/config';
import { cleanLocalTemporaryMedia } from '../src/modules/storage/private-media.js';

if (process.env.PRIVATE_MEDIA_DRIVER !== 'local' || process.env.NODE_ENV === 'production') {
  throw new Error('The temporary-media cleanup command requires the development local media driver.');
}
const hours = Number(process.env.PRIVATE_MEDIA_TEMP_HOURS || 24);
if (!Number.isFinite(hours) || hours < 1) throw new Error('PRIVATE_MEDIA_TEMP_HOURS must be at least 1.');
const removed = await cleanLocalTemporaryMedia(process.env.PRIVATE_MEDIA_DIR || 'media/private', Date.now() - hours * 3_600_000);
console.log(`Removed ${removed} expired temporary media files.`);
