// =============================================================================
// src/verticals/books/import/import.controller.ts
// Express controller layer for asynchronous book import operations.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../utils/error';
import { success } from '../../../utils/response';
import * as importService from './import.service';

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
      throw new AppError('Excel file is required (.xlsx or .xls)', 400);
    }

    const result = await importService.enqueueExcelImport(orgId, req.file.path);
    success(res, result, undefined, 202);
  } catch (err) {
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