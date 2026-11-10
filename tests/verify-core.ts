import { pool, connection, queue } from '../src/core.js';

async function main() {
  console.log('Testing pool query...');
  const res = await pool.query('SELECT 1 as num, current_user, current_database()');
  console.log('✅ Postgres OK:', res.rows[0]);

  console.log('Testing Redis connection...');
  const pong = await connection.ping();
  console.log('✅ Redis OK:', pong);

  console.log('Testing BullMQ Queue...');
  const count = await queue.count();
  console.log('✅ BullMQ Queue OK, pending job count:', count);

  await queue.close();
  await connection.quit();
  await pool.end();
  console.log('🎉 Core verification complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
