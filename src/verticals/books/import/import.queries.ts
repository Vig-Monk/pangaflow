// =============================================================================
// src/verticals/books/import/import.queries.ts
// Database queries for the import_jobs table. Raw pg only.
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
  error_rows: RowErrorDetail[];
  created_at: Date;
}

export async function createImportJob(
  orgId: string,
  source: ImportJobSource
): Promise<ImportJobRow> {
  const result = await query<ImportJobRow>(
    `INSERT INTO import_jobs (org_id, source, status, total_rows, processed_rows, error_rows)
     VALUES ($1, $2, 'queued', NULL, 0, '[]'::jsonb)
     RETURNING id, org_id, source, status, total_rows, processed_rows, error_rows, created_at`,
    [orgId, source]
  );
  return result.rows[0];
}

export async function getImportJobById(
  orgId: string,
  jobId: string
): Promise<ImportJobRow | null> {
  const result = await query<ImportJobRow>(
    `SELECT id, org_id, source, status, total_rows, processed_rows, error_rows, created_at
     FROM   import_jobs
     WHERE  org_id = $1 AND id = $2`,
    [orgId, jobId]
  );
  return result.rows[0] ?? null;
}

export async function updateJobProgress(
  jobId: string,
  processedRows: number,
  totalRows?: number,
  status: ImportJobStatus = 'processing'
): Promise<void> {
  if (totalRows !== undefined) {
    await query(
      `UPDATE import_jobs
       SET processed_rows = $2, total_rows = $3, status = $4
       WHERE id = $1`,
      [jobId, processedRows, totalRows, status]
    );
  } else {
    await query(
      `UPDATE import_jobs
       SET processed_rows = $2, status = $3
       WHERE id = $1`,
      [jobId, processedRows, status]
    );
  }
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
  finalProcessedCount?: number
): Promise<void> {
  if (finalProcessedCount !== undefined) {
    await query(
      `UPDATE import_jobs
       SET status = $2, processed_rows = $3
       WHERE id = $1`,
      [jobId, status, finalProcessedCount]
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