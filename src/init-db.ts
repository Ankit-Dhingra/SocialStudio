import 'dotenv/config';
import {readFile} from 'node:fs/promises';
import {pool} from './core.js';
await pool.query(await readFile('db/schema.sql','utf8'));
console.log('Database initialized');await pool.end();process.exit(0);
