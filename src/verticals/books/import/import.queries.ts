// =============================================================================
// soko-api/src/verticals/books/import/import.queries.ts
// Database queries for import_jobs with auto-migration safety
// =============================================================================

import { query } from '../../../config/db';

export type ImportJobSource = 'excel' | 'google_sheet';
export type ImportJobStatus = 'queued' | 'processing' | 'done' | 'failed';

export interface RowErrorDetail {
  row: number;
  title?: string;
  error: string;
}

export interface ImportJobRow {
  id: string;
  org_id: string;
  source: ImportJobSource;
  status: ImportJobStatus;
  total_rows: number | null;
  processed_rows: number;
  inserted_rows: number;
  updated_rows: number;
  skipped_rows: number;
  error_rows: RowErrorDetail[];
  created_at: Date;
}

const IMPORT_JOB_FIELDS = `
  id, org_id, source, status, total_rows, processed_rows,
  inserted_rows, updated_rows, skipped_rows, error_rows, created_at
`;

export async function ensureImportSchema(): Promise<void> {
  await query(`
    ALTER TABLE import_jobs 
      ADD COLUMN IF NOT EXISTS inserted_rows INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS updated_rows  INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS skipped_rows  INTEGER NOT NULL DEFAULT 0;
  `);
}

export async function createImportJob(
  orgId: string,
  source: ImportJobSource
): Promise<ImportJobRow> {
  const result = await query<ImportJobRow>(
    `INSERT INTO import_jobs (
       org_id, source, status, total_rows, processed_rows,
       inserted_rows, updated_rows, skipped_rows, error_rows
     )
     VALUES ($1, $2, 'queued', NULL, 0, 0, 0, 0, '[]'::jsonb)
     RETURNING ${IMPORT_JOB_FIELDS}`,
    [orgId, source]
  );
  return result.rows[0];
}

export async function getImportJobById(
  orgId: string,
  jobId: string
): Promise<ImportJobRow | null> {
  const result = await query<ImportJobRow>(
    `SELECT ${IMPORT_JOB_FIELDS}
     FROM   import_jobs
     WHERE  org_id = $1 AND id = $2`,
    [orgId, jobId]
  );
  return result.rows[0] ?? null;
}

export async function updateJobProgress(
  jobId: string,
  counts: {
    processedRows: number;
    insertedRows?: number;
    updatedRows?: number;
    skippedRows?: number;
    totalRows?: number;
  },
  status: ImportJobStatus = 'processing'
): Promise<void> {
  await query(
    `UPDATE import_jobs
     SET processed_rows = $2,
         inserted_rows  = COALESCE($3, inserted_rows),
         updated_rows   = COALESCE($4, updated_rows),
         skipped_rows   = COALESCE($5, skipped_rows),
         total_rows     = COALESCE($6, total_rows),
         status         = $7
     WHERE id = $1`,
    [
      jobId,
      counts.processedRows,
      counts.insertedRows ?? null,
      counts.updatedRows ?? null,
      counts.skippedRows ?? null,
      counts.totalRows ?? null,
      status,
    ]
  );
}

export async function appendJobError(
  jobId: string,
  errorDetail: RowErrorDetail
): Promise<void> {
  await query(
    `UPDATE import_jobs
     SET error_rows = error_rows || $2::jsonb
     WHERE id = $1`,
    [jobId, JSON.stringify([errorDetail])]
  );
}

export async function finalizeImportJob(
  jobId: string,
  status: 'done' | 'failed',
  finalCounts?: {
    processedRows: number;
    insertedRows: number;
    updatedRows: number;
    skippedRows: number;
  },
  topLevelError?: string
): Promise<void> {
  if (topLevelError) {
    await appendJobError(jobId, { row: 0, error: topLevelError });
  }

  if (finalCounts) {
    await query(
      `UPDATE import_jobs
       SET status         = $2,
           processed_rows = $3,
           inserted_rows  = $4,
           updated_rows   = $5,
           skipped_rows   = $6
       WHERE id = $1`,
      [
        jobId,
        status,
        finalCounts.processedRows,
        finalCounts.insertedRows,
        finalCounts.updatedRows,
        finalCounts.skippedRows,
      ]
    );
  } else {
    await query(
      `UPDATE import_jobs
       SET status = $2
       WHERE id = $1`,
      [jobId, status]
    );
  }
}