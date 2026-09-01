// =============================================================================
// soko-api/src/verticals/books/import/import.service.ts
// Service layer handling BullMQ queue dispatch with cloud TLS Redis support.
// =============================================================================

import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { z } from 'zod';
import { env } from '../../../config/env';
import { AppError } from '../../../utils/error';
import * as importQueries from './import.queries';
import type { ImportJobRow } from './import.queries';

const redisUrl = env.REDIS_URL || process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  enableReadyCheck: false,
  retryStrategy(times) {
    return Math.min(times * 200, 2000);
  },
});

redisConnection.on('error', (err) => {
  console.warn('Redis connection event (BullMQ):', err.message);
});

export const bookImportQueue = new Queue('book-import-queue', {
  connection: redisConnection,
});

export const GoogleSheetImportSchema = z.object({
  sheetUrl: z.string().url('Must be a valid Google Sheet URL'),
});

export async function enqueueExcelImport(
  orgId: string,
  filePath: string
): Promise<{ jobId: string; status: string }> {
  const jobRecord = await importQueries.createImportJob(orgId, 'excel');

  await bookImportQueue.add(
    'process-excel-import',
    {
      jobId: jobRecord.id,
      orgId,
      source: 'excel',
      filePath,
    },
    {
      removeOnComplete: 100,
      removeOnFail: 100,
    }
  );

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

  const jobRecord = await importQueries.createImportJob(orgId, 'google_sheet');

  await bookImportQueue.add(
    'process-google-sheet-import',
    {
      jobId: jobRecord.id,
      orgId,
      source: 'google_sheet',
      sheetUrl: parsed.data.sheetUrl,
    },
    {
      removeOnComplete: 100,
      removeOnFail: 100,
    }
  );

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