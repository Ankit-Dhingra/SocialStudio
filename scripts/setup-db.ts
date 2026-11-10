import pg from 'pg';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function setup() {
  const admin = new pg.Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    database: 'postgres'
  });

  await admin.connect();
  console.log('✅ Connected to postgres as postgres');

  const roleCheck = await admin.query("SELECT 1 FROM pg_roles WHERE rolname='studio'");
  if (roleCheck.rows.length === 0) {
    await admin.query("CREATE ROLE studio WITH LOGIN PASSWORD 'studio_dev' SUPERUSER CREATEDB");
    console.log('✅ Created role studio with password studio_dev');
  } else {
    await admin.query("ALTER ROLE studio WITH PASSWORD 'studio_dev' SUPERUSER");
    console.log('✅ Updated role studio with password studio_dev');
  }

  const dbCheck = await admin.query("SELECT 1 FROM pg_database WHERE datname='techcontent'");
  if (dbCheck.rows.length === 0) {
    await admin.query("CREATE DATABASE techcontent OWNER studio");
    console.log('✅ Created database techcontent');
  } else {
    console.log('ℹ Database techcontent already exists');
  }

  await admin.end();

  // Connect to techcontent as studio and apply schema
  console.log('Connecting to techcontent as studio...');
  const appClient = new pg.Client({
    connectionString: 'postgres://studio:studio_dev@127.0.0.1:5432/techcontent'
  });
  await appClient.connect();
  console.log('✅ Connected to techcontent as studio!');

  const schemaSql = await readFile(path.resolve('db/schema.sql'), 'utf8');
  await appClient.query(schemaSql);
  console.log('✅ Applied db/schema.sql successfully!');

  const tables = await appClient.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  console.log('Public tables:', tables.rows.map(r => r.tablename));

  await appClient.end();
  console.log('🎉 Database initialization complete!');
  process.exit(0);
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
