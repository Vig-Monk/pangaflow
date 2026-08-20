// =============================================================================
// src/modules/transactions/transactions.controller.ts
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import { AppError } from '../../utils/error';
import * as transactionsService from './transactions.service';

function requireAuth(req: Request): { orgId: string; userId: string } {
  if (!req.orgId || !req.user) {
    throw new AppError('Unauthorized', 401);
  }
  return { orgId: req.orgId, userId: req.user.id };
}

export async function recordHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { orgId, userId } = requireAuth(req);
    const transaction = await transactionsService.record(orgId, userId, req.body);
    success(res, transaction, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function smartSaleHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { orgId, userId } = requireAuth(req);
    const result = await transactionsService.smartSale(orgId, userId, req.body);
    success(res, result, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function ledgerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { orgId } = requireAuth(req);
    const result = await transactionsService.ledger(
      orgId,
      req.params.customerId,
      req.query
    );
    success(res, result, {
      page:       Number(req.query.page  ?? 1),
      limit:      Number(req.query.limit ?? 20),
      totalItems: result.total,
      totalPages: Math.ceil(result.total / Number(req.query.limit ?? 20)),
    });
  } catch (err) {
    next(err);
  }
}

export async function dashboardSummaryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { orgId } = requireAuth(req);
    const summary = await transactionsService.dashboardSummary(orgId);
    success(res, summary);
  } catch (err) {
    next(err);
  }
}