import crypto from 'crypto';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import pg from 'pg';
import '../config/env.js';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDirectory = path.join(__dirname, 'migrations');
const legacyMigration = path.join(__dirname, 'migrations.sql');
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to run migrations (use the Supabase PostgreSQL connection string)');
}

async function migrationFiles() {
  const versioned = await fs.readdir(migrationsDirectory, { withFileTypes: true })
    .then((entries) => entries.filter((entry) => entry.isFile() && entry.name.endsWith('.sql')).map((entry) => path.join(migrationsDirectory, entry.name)))
    .catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error));
  return [legacyMigration, ...versioned.sort()];
}

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

  for (const filePath of await migrationFiles()) {
    const name = path.basename(filePath);
    const sql = await fs.readFile(filePath, 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    const { rows } = await client.query('SELECT checksum FROM schema_migrations WHERE name = $1', [name]);

    if (rows[0]) {
      if (rows[0].checksum !== checksum) {
        throw new Error(`Migration ${name} changed after it was applied. Add a new migration instead.`);
      }
      console.log(`Migration already applied: ${name}`);
      continue;
    }

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [name, checksum]);
      await client.query('COMMIT');
      console.log(`Applied migration: ${name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  try {
    await client.query('SELECT pg_advisory_unlock($1)', [847391025]);
  } catch {
    // Setup failures may occur before the advisory lock is acquired.
  }
  await client.end();
}
