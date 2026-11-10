import { pool } from '../src/core.js';

async function migrate() {
  await pool.query('ALTER TABLE videos ADD COLUMN IF NOT EXISTS qa_report JSONB;');
  console.log('✅ Added qa_report JSONB column to videos table');
  await pool.end();
  process.exit(0);
}

migrate().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
