// =============================================================================
// src/modules/orders/orders.service.ts
// =============================================================================

import { z } from 'zod';
import { AppError } from '../../utils/error';
import * as ordersQueries from './orders.queries';

export const AssignRiderSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1, 'At least one order must be selected'),
  riderName: z.string().min(1, 'Rider name is required').max(100),
  riderPhone: z.string().min(1, 'Rider phone is required').max(20),
});

export const CompleteDeliverySchema = z.object({
  confirmationCode: z.string().max(10).optional(),
  amountCollected: z.number().nonnegative().optional(),
  collectedBy: z.string().max(100).optional(),
});

export async function getNearbyOrders(orgId: string, orderId: string) {
  return ordersQueries.findNearbyConfirmedOrders(orgId, orderId, 2.0);
}

export async function assignRider(orgId: string, rawBody: unknown) {
  const parsed = AssignRiderSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid rider assignment data', 400);
  }
  return ordersQueries.assignRiderToOrders(
    orgId,
    parsed.data.orderIds,
    parsed.data.riderName,
    parsed.data.riderPhone
  );
}

export async function completeDelivery(orgId: string, orderId: string, rawBody: unknown) {
  const parsed = CompleteDeliverySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid delivery completion data', 400);
  }
  return ordersQueries.completeOrderDeliveryTransactional(orgId, orderId, parsed.data);
}

export async function getCashReconciliation(orgId: string, rawQuery: { startDate?: string; endDate?: string }) {
  return ordersQueries.getCashReconciliationSummary(orgId, rawQuery.startDate, rawQuery.endDate);
}