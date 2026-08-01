/**
 * src/migrations/run.ts
 * Soko Platform — typed migration runner
 *
 * Usage:  tsx src/migrations/run.ts
 *
 * Behaviour:
 *  - Reads all *.sql files in this directory, sorted lexicographically (001_ before 002_)
 *  - Creates a `schema_migrations` table on first run to track completed migrations
 *  - Skips any migration whose filename is already recorded in schema_migrations
 *  - Wraps each migration's SQL in a pg transaction — the migration either fully
 *    succeeds and is recorded, or fully rolls back and the process exits non-zero
 *  - Never re-runs a completed migration; safe to call on every deploy
 */

import path from 'path';
import fs from 'fs';
import { PoolClient } from 'pg';
import { pool } from '../config/db';
import { env } from '../config/env';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MigrationRecord {
  filename: string;
  applied_at: Date;
}

// ---------------------------------------------------------------------------
// Ensure the tracking table exists
// ---------------------------------------------------------------------------

async function ensureSchemaTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// ---------------------------------------------------------------------------
// Load the set of already-applied migrations
// ---------------------------------------------------------------------------

async function getAppliedMigrations(client: PoolClient): Promise<Set<string>> {
  const result = await client.query<MigrationRecord>(
    'SELECT filename FROM schema_migrations ORDER BY filename'
  );
  return new Set(result.rows.map((row) => row.filename));
}

// ---------------------------------------------------------------------------
// Discover .sql files in this directory, sorted
// ---------------------------------------------------------------------------

function getSqlFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

// ---------------------------------------------------------------------------
// Run a single migration file inside an explicit pg transaction
// ---------------------------------------------------------------------------

async function runMigration(client: PoolClient, filename: string, sql: string): Promise<void> {
  console.log(`  → Running: ${filename}`);

  await client.query('BEGIN');

  try {
    await client.query(sql);

    await client.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1)',
      [filename]
    );

    await client.query('COMMIT');

    console.log(`  ✓ Applied: ${filename}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\nSoko migration runner — ${env.NODE_ENV}\n`);

  const migrationsDir = __dirname;
  const sqlFiles = getSqlFiles(migrationsDir);

  if (sqlFiles.length === 0) {
    console.log('No .sql migration files found. Nothing to do.');
    return;
  }

  const client: PoolClient = await pool.connect();

  try {
    // Ensure tracking table exists (idempotent, outside any migration txn)
    await ensureSchemaTable(client);

    const applied = await getAppliedMigrations(client);

    const pending = sqlFiles.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('All migrations already applied. Database is up to date.\n');
      return;
    }

    console.log(`Pending migrations (${pending.length}):\n`);

    for (const filename of pending) {
      const filePath = path.join(migrationsDir, filename);
      const sql = fs.readFileSync(filePath, 'utf8');
      await runMigration(client, filename, sql);
    }

    console.log(`\n✓ ${pending.length} migration(s) applied successfully.\n`);
  } catch (err) {
    // Log the raw error with context so the failure is diagnosable
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n✗ Migration failed: ${message}\n`);
    process.exit(1);
  } finally {
    client.release();
    // Close the pool so the process exits cleanly (not kept alive by idle connections)
    await pool.end();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n✗ Unhandled error in migration runner: ${message}\n`);
  process.exit(1);
});
