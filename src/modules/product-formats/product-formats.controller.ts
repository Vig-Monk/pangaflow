// =============================================================================
// src/modules/product-formats/product-formats.controller.ts
// HTTP controller layer for product formats.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import { AppError } from '../../utils/error';
import * as formatService from './product-formats.service';

function requireOrgId(req: Request): string {
  if (!req.orgId) {
    throw new AppError('Unauthorized', 401);
  }
  return req.orgId;
}

export async function listFormatsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const formats = await formatService.listFormats(orgId, req.params.productId);
    success(res, formats);
  } catch (err) {
    next(err);
  }
}

export async function getFormatHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const format = await formatService.getFormat(orgId, req.params.productId, req.params.id);
    success(res, format);
  } catch (err) {
    next(err);
  }
}

export async function createFormatHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const format = await formatService.createFormat(orgId, req.params.productId, req.body);
    success(res, format, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateFormatHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const format = await formatService.updateFormat(orgId, req.params.productId, req.params.id, req.body);
    success(res, format);
  } catch (err) {
    next(err);
  }
}

export async function deleteFormatHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    await formatService.deleteFormat(orgId, req.params.productId, req.params.id);
    success(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}