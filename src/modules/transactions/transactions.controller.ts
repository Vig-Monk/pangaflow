// =============================================================================
// src/modules/transactions/transactions.controller.ts
// HTTP layer for the transactions module. Thin — no business logic.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import { AppError } from '../../utils/error';
import * as transactionsService from './transactions.service';

// ---------------------------------------------------------------------------
// Helper — extracts verified orgId and userId from the request.
// Both are guaranteed present after verifyToken, but typed as optional
// on the base Request interface — this guard satisfies strict null checks
// without scattering non-null assertions across handlers.
// ---------------------------------------------------------------------------

function requireAuth(req: Request): { orgId: string; userId: string } {
  if (!req.orgId || !req.user) {
    throw new AppError('Unauthorized', 401);
  }
  return { orgId: req.orgId, userId: req.user.id };
}

// ---------------------------------------------------------------------------
// POST /transactions
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// GET /transactions/:customerId
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// GET /dashboard/summary
// ---------------------------------------------------------------------------

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