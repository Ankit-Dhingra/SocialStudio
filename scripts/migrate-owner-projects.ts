import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectAccounts, hasActiveOwner } from '../src/modules/accounts/users.js';
import { sessionIdPattern } from '../src/modules/pipeline/session-owner.js';
import { getProject, importProject, initProjects, registerProjectMedia, validateImportedProject } from '../src/modules/projects/repository.js';
import { copyLegacyMedia } from '../src/modules/storage/legacy-media.js';
import { privateMediaFromEnv } from '../src/modules/storage/private-media.js';

async function migrate() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const copyMedia = args.includes('--copy-media');
  const ids = [...new Set(args.filter(arg => arg !== '--apply' && arg !== '--copy-media'))];
  if (!ids.length || !ids.every(id => sessionIdPattern.test(id))) throw new Error('Provide one or more explicit legacy session IDs.');

  const root = path.resolve('media/sessions');
  const records = [];
  for (const id of ids) {
    const file = path.join(root, `${id}.json`);
    const info = await lstat(file);
    if (!info.isFile() || info.size > 12 * 1024 * 1024) throw new Error(`Invalid legacy session file: ${id}.`);
    const record = validateImportedProject(JSON.parse(await readFile(file, 'utf-8')));
    if (id !== record.id) throw new Error(`Legacy session ID does not match its file: ${id}.`);
    records.push(record);
  }
  if (!apply) { console.log(`Dry run verified ${records.length} selected project records.`); return; }

  const { MONGODB_URI, OWNER_CLERK_USER_ID } = process.env;
  if (!MONGODB_URI || !OWNER_CLERK_USER_ID) throw new Error('Configure MONGODB_URI and OWNER_CLERK_USER_ID before applying.');
  await connectAccounts(MONGODB_URI);
  await initProjects();
  if (!await hasActiveOwner(OWNER_CLERK_USER_ID)) throw new Error('The pinned Clerk ID is not an active, verified Studio owner.');
  const storage = copyMedia ? privateMediaFromEnv() : undefined;
  if (copyMedia && !storage) throw new Error('Configure private media storage before copying media.');
  let imported = 0;
  let copied = 0;
  for (const record of records) {
    imported += Number(await importProject(OWNER_CLERK_USER_ID, record));
    if (storage) {
      const project = await getProject(OWNER_CLERK_USER_ID, record.id);
      if (!project) throw new Error('Imported project could not be loaded.');
      const media = await copyLegacyMedia(OWNER_CLERK_USER_ID, project.session, storage);
      if (!await registerProjectMedia(OWNER_CLERK_USER_ID, record.id, project.revision, media)) throw new Error('The project changed during media migration.');
      copied += media.length;
    }
  }
  console.log(`Imported ${imported} project records, skipped ${records.length - imported} existing records, registered ${copied} media links.`);
}

try { await migrate(); }
catch { console.error('Owner project migration stopped. Verify the selected records, database configuration, and owner binding.'); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
