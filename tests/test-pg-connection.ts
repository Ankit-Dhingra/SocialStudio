import pg from 'pg';

async function main() {
  console.log('Testing Postgres connection with postgres://studio:studio_dev@127.0.0.1:5432/techcontent ...');
  const client = new pg.Client({
    connectionString: 'postgres://studio:studio_dev@127.0.0.1:5432/techcontent',
    connectionTimeoutMillis: 3000
  });

  try {
    await client.connect();
    console.log('✅ Connected as studio!');
    const res = await client.query('SELECT current_user, current_database()');
    console.log('User and DB:', res.rows[0]);
    await client.end();
    process.exit(0);
  } catch (err: any) {
    console.error('❌ studio connection failed:', err.message);
  }

  console.log('Testing Postgres connection with postgres://postgres:postgres@127.0.0.1:5432/postgres ...');
  const client2 = new pg.Client({
    connectionString: 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
    connectionTimeoutMillis: 3000
  });

  try {
    await client2.connect();
    console.log('✅ Connected as postgres:postgres!');
    const res = await client2.query('SELECT current_user, current_database()');
    console.log('User and DB:', res.rows[0]);
    await client2.end();
    process.exit(0);
  } catch (err: any) {
    console.error('❌ postgres:postgres failed:', err.message);
  }

  process.exit(1);
}

main();
