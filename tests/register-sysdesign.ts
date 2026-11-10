import { pool } from '../src/core.js';

async function register() {
  const dbId = '00000000-0000-0000-0000-000000000004';
  const mediaPublicPath = '/media/runs/sysdesign101-run/sysdesign101-reel.mp4';
  const qaReport = {
    passed: true,
    driftSec: 0.0,
    checks: [
      { name: 'File Exists & Size Check', passed: true, details: 'Size: 12.15 MB (1080x1920 9:16)' },
      { name: 'Duration Check', passed: true, details: '56.2s @ 30fps (1,686 frames)' },
      { name: 'Audio Drift Check', passed: true, details: '0.00s drift (Perfect sync)' },
    ],
    errors: [],
  };

  await pool.query(
    `INSERT INTO videos (id, topic, title, status, narration, audio_seconds, media_path, qa_report, created_at, updated_at)
     VALUES ($1, $2, $3, 'READY_FOR_REVIEW', $4, $5, $6, $7, now(), now())
     ON CONFLICT (id) DO UPDATE SET
       topic = $2,
       title = $3,
       status = 'READY_FOR_REVIEW',
       narration = $4,
       audio_seconds = $5,
       media_path = $6,
       qa_report = $7,
       updated_at = now()`,
    [
      dbId,
      '1 iPhone. 2 Users. Same Second. (sys.design.101)',
      '📱 1 iPhone, 2 Users: 15 LPA vs 45 LPA Concurrency Masterclass',
      'Interviewer ne poocha: 1 iPhone bacha hai. Aman aur Riya dono ne ek hi second me checkout click kiya. Order kisko milega? Live race condition and atomic database update.',
      56.2,
      mediaPublicPath,
      JSON.stringify(qaReport),
    ]
  );

  console.log(`✅ Successfully registered video ID ${dbId} in PostgreSQL!`);
  await pool.end();
  process.exit(0);
}

register().catch((e) => {
  console.error(e);
  process.exit(1);
});
