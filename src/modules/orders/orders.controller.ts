// =============================================================================
// src/modules/orders/orders.controller.ts
// Controller — Merchant Orders.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import { AppError } from '../../utils/error';
import * as ordersQueries from './orders.queries';

function requireOrgId(req: Request): string {
  if (!req.orgId) {
    throw new AppError('Unauthorized', 401);
  }
  return req.orgId;
}
// ===================================================
export async function getOrdersSummaryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const summary = await ordersQueries.getOrdersSummary(orgId);
    success(res, summary);
  } catch (err) {
    next(err);
  }
}
export async function listOrdersHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    const result = await ordersQueries.listOrders(orgId, { page, limit });

    success(res, result.orders, {
      page,
      limit,
      totalItems: result.total,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (err) {
    next(err);
  }
}

export async function getOrderHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const order = await ordersQueries.getOrderById(orgId, req.params.id);
    if (!order) {
      throw new AppError('Order not found', 404);
    }
    success(res, order);
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const order = await ordersQueries.updateOrderStatus(orgId, req.params.id, req.body.status);
    if (!order) {
      throw new AppError('Order not found', 404);
    }
    success(res, order);
  } catch (err) {
    next(err);
  }
}