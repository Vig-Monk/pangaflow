// src/verticals/books/import/import.service.ts
// =============================================================================
// soko-api/src/verticals/books/import/import.service.ts
// Direct In-Process Ingestion Engine with Graceful Server Shutdown Support
// =============================================================================

import Redis from 'ioredis';
import { z } from 'zod';
import { env } from '../../../config/env';
import { AppError } from '../../../utils/error';
import * as importQueries from './import.queries';
import type { ImportJobRow } from './import.queries';
import { processExcelFile, processGoogleSheet } from './import.worker';

const redisUrl = env.REDIS_URL || process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Exported for src/server.ts graceful shutdown; lazyConnect prevents boot-time hangs
export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  enableReadyCheck: false,
  retryStrategy(times) {
    return Math.min(times * 200, 2000);
  },
});

redisConnection.on('error', () => {
  // Silent fallback so server does not crash if Redis is absent
});

export const GoogleSheetImportSchema = z.object({
  sheetUrl: z.string().url('Must be a valid Google Sheet URL'),
});

export async function enqueueExcelImport(
  orgId: string,
  filePath: string
): Promise<{ jobId: string; status: string }> {
  await importQueries.ensureImportSchema();
  const jobRecord = await importQueries.createImportJob(orgId, 'excel');

  // Process directly in-process asynchronously (responds to HTTP in < 100ms)
  setImmediate(async () => {
    try {
      await processExcelFile(jobRecord.id, orgId, filePath);
    } catch (err: any) {
      console.error('[Import Worker Error]', err);
      await importQueries.finalizeImportJob(jobRecord.id, 'failed', undefined, err.message);
    }
  });

  return {
    jobId: jobRecord.id,
    status: 'queued',
  };
}

export async function enqueueGoogleSheetImport(
  orgId: string,
  rawBody: unknown
): Promise<{ jobId: string; status: string }> {
  const parsed = GoogleSheetImportSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Invalid sheet URL', 400);
  }

  await importQueries.ensureImportSchema();
  const jobRecord = await importQueries.createImportJob(orgId, 'google_sheet');

  setImmediate(async () => {
    try {
      await processGoogleSheet(jobRecord.id, orgId, parsed.data.sheetUrl);
    } catch (err: any) {
      console.error('[Google Sheet Error]', err);
      await importQueries.finalizeImportJob(jobRecord.id, 'failed', undefined, err.message);
    }
  });

  return {
    jobId: jobRecord.id,
    status: 'queued',
  };
}

export async function getJobStatus(
  orgId: string,
  jobId: string
): Promise<ImportJobRow> {
  const record = await importQueries.getImportJobById(orgId, jobId);
  if (!record) {
    throw new AppError('Import job not found', 404);
  }
  return record;
}