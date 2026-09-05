// src/verticals/books/import/import.service.ts
// =============================================================================
// Service layer handling BullMQ queue dispatch with Render Redis isolation.
// =============================================================================

import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { z } from 'zod';
import { env } from '../../../config/env';
import { AppError } from '../../../utils/error';
import * as importQueries from './import.queries';
import type { ImportJobRow } from './import.queries';

const redisUrl = env.REDIS_URL || process.env.REDIS_URL || 'redis://127.0.0.1:6379';

/**
 * Creates isolated Redis connection instances with TLS support for Render cloud instances.
 */
export function createRedisConnection(): Redis {
  const isTls = redisUrl.startsWith('rediss://');

  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: false,
    enableReadyCheck: false,
    tls: isTls ? { rejectUnauthorized: false } : undefined,
    retryStrategy(times) {
      return Math.min(times * 200, 2000);
    },
  });
}

// Dedicated connection for the Queue producer
export const redisConnection = createRedisConnection();

redisConnection.on('error', (err) => {
  console.warn('Redis queue connection event:', err.message);
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
      removeOnComplete: true, // Prevents exceeding Render's 25 MB Redis RAM cap
      removeOnFail: 10,
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
      removeOnComplete: true,
      removeOnFail: 10,
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