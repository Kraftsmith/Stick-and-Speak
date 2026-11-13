// Applies the schema to the database in DATABASE_URL: the sign-in tables (auth.sql, once) and the app's tables
// (schema.sql, safe to repeat).
//   node --env-file=.env.local server/apply.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from '@neondatabase/serverless';

const here = dirname(fileURLToPath(import.meta.url));
// the unpooled address: several statements in one call need a plain connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
const has = async table => (await pool.query('select to_regclass($1) as t', [`public."${table}"`])).rows[0].t !== null;

if (await has('user')) console.log('auth.sql: the sign-in tables are already there, skipped');
else { await pool.query(readFileSync(join(here, 'auth.sql'), 'utf8')); console.log('auth.sql: applied'); }
await pool.query(readFileSync(join(here, 'schema.sql'), 'utf8'));
console.log('schema.sql: applied');
const tables = await pool.query(`select table_name from information_schema.tables where table_schema = 'public' order by 1`);
console.log('tables:', tables.rows.map(r => r.table_name).join(', '));
await pool.end();
