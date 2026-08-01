// =============================================================================
// src/modules/expenses/expenses.controller.ts
// HTTP layer for expenses. Thin — no business logic, no direct query calls.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import { AppError } from '../../utils/error';
import * as expensesService from './expenses.service';

// ---------------------------------------------------------------------------
// Helper — extracts verified orgId + userId from the request.
// Matches the identical pattern used in customers.controller.ts and
// transactions.controller.ts.
// ---------------------------------------------------------------------------

function requireAuth(req: Request): { orgId: string; userId: string } {
  if (!req.orgId || !req.user) {
    throw new AppError('Unauthorized', 401);
  }
  return { orgId: req.orgId, userId: req.user.id };
}

// ---------------------------------------------------------------------------
// POST /expenses
// ---------------------------------------------------------------------------

export async function createHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { orgId, userId } = requireAuth(req);
    const expense = await expensesService.create(orgId, userId, req.body);
    success(res, expense, undefined, 201);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /expenses
// ---------------------------------------------------------------------------

export async function listHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { orgId } = requireAuth(req);
    const result = await expensesService.list(orgId, req.query);
    success(res, result.expenses, {
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 20),
      totalItems: result.total,
      totalPages: Math.ceil(result.total / Number(req.query.limit ?? 20)),
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /expenses/summary
// ---------------------------------------------------------------------------

export async function summaryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { orgId } = requireAuth(req);
    const result = await expensesService.summary(orgId, req.query);
    success(res, result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /expenses/profit-loss
// ---------------------------------------------------------------------------

export async function profitLossHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { orgId } = requireAuth(req);
    const result = await expensesService.profitLoss(orgId, req.query);
    success(res, result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /dashboard/full
// ---------------------------------------------------------------------------

export async function fullDashboardHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { orgId } = requireAuth(req);
    const result = await expensesService.fullDashboard(orgId);
    success(res, result);
  } catch (err) {
    next(err);
  }
}