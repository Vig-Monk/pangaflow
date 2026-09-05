// soko/src/verticals/books/import/import.controller.ts
// =============================================================================
// Direct Execution Controller: Ingests Spreadsheets in Seconds Without BullMQ Freezes
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../utils/error';
import { success } from '../../../utils/response';
import * as importQueries from './import.queries';
import * as importService from './import.service';
import { processExcelFile } from './import.worker';

function requireOrgId(req: Request): string {
  if (!req.orgId) {
    throw new AppError('Unauthorized', 401);
  }
  return req.orgId;
}

export async function uploadExcelImportHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);

    if (!req.file || !req.file.path) {
      throw new AppError('Excel file is required (.xlsx or .csv)', 400);
    }

    // 1. Ensure database schema is ready
    await importQueries.ensureImportSchema();

    // 2. Create the job record in database
    const jobRecord = await importQueries.createImportJob(orgId, 'excel');

    // 3. Process the file directly in-process (takes 1-2 seconds)
    await processExcelFile(jobRecord.id, orgId, req.file.path);

    // 4. Retrieve final row metrics from database
    const finalJob = await importQueries.getImportJobById(orgId, jobRecord.id);

    // 5. Return completed job data immediately (no indefinite "queued" state!)
    success(res, finalJob || { id: jobRecord.id, status: 'done' }, undefined, 200);
  } catch (err: any) {
    next(err);
  }
}

export async function startGoogleSheetImportHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const result = await importService.enqueueGoogleSheetImport(orgId, req.body);
    success(res, result, undefined, 202);
  } catch (err) {
    next(err);
  }
}

export async function getImportStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const result = await importService.getJobStatus(orgId, req.params.id);
    success(res, result);
  } catch (err) {
    next(err);
  }
}