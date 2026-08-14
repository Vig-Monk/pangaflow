// =============================================================================
// src/modules/stores/stores.controller.ts
// Controller — Store Settings.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import { AppError } from '../../utils/error';
import * as storesService from './stores.service';

function requireOrgId(req: Request): string {
  if (!req.orgId) {
    throw new AppError('Unauthorized', 401);
  }
  return req.orgId;
}

export async function getStoreSettingsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const store = await storesService.fetchStoreSettings(orgId);
    success(res, store);
  } catch (err) {
    next(err);
  }
}

export async function saveStoreSettingsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const store = await storesService.saveStoreSettings(orgId, req.body);
    success(res, store);
  } catch (err) {
    next(err);
  }
}