import { pool } from '../src/core.js';

async function seedDemoVideo() {
  const id = '00000000-0000-0000-0000-000000000002';
  const topic = 'How Node.js Event Loop handles Microtasks vs Macrotasks';
  const title = 'Node.js Event Loop: V8 Internals Demystified!';
  const narration = 'Kyunki JavaScript single threaded hai, sabko lagta hai setTimeout zero turant chalega. Par yahan ek bada twist hai!';
  const mediaPath = '/media/runs/test-run-2/final-upgraded-short.mp4';
  const qaReport = {
    passed: true,
    fileSizeBytes: 7654321,
    durationSec: 42.73,
    sha256: '984eba69f8e0f7123338336101c23d00e2aab8aa8a1a8cad1a181695c0e94529',
    checks: [
      { name: 'File Exists & Size Check', passed: true, details: '7.30 MB' },
      { name: 'Duration Consistency Check', passed: true, details: 'Rendered: 42.73s, Expected: 42.73s (Diff: 0.00s)' },
      { name: 'SHA-256 Hash Integrity', passed: true, details: 'Valid' }
    ]
  };

  await pool.query(
    `INSERT INTO videos (id, topic, title, status, narration, audio_seconds, media_path, qa_report, created_at, updated_at)
     VALUES ($1, $2, $3, 'READY_FOR_REVIEW', $4, 40.78, $5, $6, now(), now())
     ON CONFLICT (id) DO UPDATE SET
       status = 'READY_FOR_REVIEW',
       media_path = $5,
       qa_report = $6,
       updated_at = now()`,
    [id, topic, title, narration, mediaPath, JSON.stringify(qaReport)]
  );

  console.log('✅ Seeded upgraded video into database:', id);
  await pool.end();
  process.exit(0);
}

seedDemoVideo().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
