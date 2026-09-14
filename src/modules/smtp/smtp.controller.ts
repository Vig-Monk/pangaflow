// =============================================================================
// soko-api/src/modules/smtp/smtp.controller.ts
// HTTP controller layer for tenant SMTP credentials.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import { AppError } from '../../utils/error';
import * as smtpService from './smtp.service';

function requireOrgId(req: Request): string {
  if (!req.orgId) {
    throw new AppError('Unauthorized', 401);
  }
  return req.orgId;
}

export async function getSmtpCredentialsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const result = await smtpService.getCredentials(orgId);
    success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function saveSmtpCredentialsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const result = await smtpService.saveCredentials(orgId, req.body);
    success(res, result, undefined, 200);
  } catch (err) {
    next(err);
  }
}

export async function verifySmtpCredentialsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const result = await smtpService.verifyCredentials(orgId, req.body);
    success(res, result, undefined, 200);
  } catch (err) {
    next(err);
  }
}

export async function deleteSmtpCredentialsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    await smtpService.removeCredentials(orgId);
    success(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}