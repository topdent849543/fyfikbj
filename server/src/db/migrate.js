import crypto from 'crypto';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import pg from 'pg';
import '../config/env.js';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationPath = path.join(__dirname, 'migrations.sql');
const migrationName = path.basename(migrationPath);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required to run migrations (use the Supabase PostgreSQL connection string)');
}

const sql = await fs.readFile(migrationPath, 'utf8');
const checksum = crypto.createHash('sha256').update(sql).digest('hex');
const ssl = process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false };
const client = new Client({ connectionString, ssl });

try {
  await client.connect();
  await client.query('SELECT pg_advisory_lock($1)', [847391025]);
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const { rows } = await client.query('SELECT checksum FROM schema_migrations WHERE name = $1', [migrationName]);
  if (rows[0]) {
    if (rows[0].checksum !== checksum) {
      throw new Error(`Migration ${migrationName} changed after it was applied`);
    }
    console.log(`Migration already applied: ${migrationName}`);
  } else {
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
        [migrationName, checksum]
      );
      await client.query('COMMIT');
      console.log(`Applied migration: ${migrationName}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  try {
    await client.query('SELECT pg_advisory_unlock($1)', [847391025]);
  } catch {
    // Connection/setup failures may occur before the advisory lock is acquired.
  }
  await client.end();
}
