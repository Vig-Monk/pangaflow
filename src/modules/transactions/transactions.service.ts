// =============================================================================
// src/modules/transactions/transactions.service.ts
// Business logic for the transactions (credit ledger) module.
// The only file that opens pg transactions for this module.
// =============================================================================

import { z } from 'zod';
import { pool } from '../../config/db';
import { AppError } from '../../utils/error';
import { Transaction, TransactionType } from '../../types/models';
import {
  CustomerLedgerResult,
  DashboardSummary,
  RecordTransactionInput,
  getDashboardSummary,
  getCustomerLedger,
  recordTransaction,
} from './transactions.queries';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const RecordTransactionSchema = z.object({
  customerId:  z.string().uuid('customerId must be a valid UUID'),
  type:        z.enum(['sale', 'payment', 'adjustment']),
  amount:      z.number().positive('Amount must be greater than zero'),
  description: z.string().max(500).optional(),
});

export const LedgerQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type RecordTransactionBody = z.infer<typeof RecordTransactionSchema>;
export type LedgerQuery           = z.infer<typeof LedgerQuerySchema>;

// ---------------------------------------------------------------------------
// record
// ---------------------------------------------------------------------------

/**
 * Validates input, opens a pg transaction, calls recordTransaction(), commits.
 * The pg transaction is non-negotiable: balance computation happens inside
 * an atomic lock on this customer's ledger rows.
 *
 * Throws AppError(400) on validation failure.
 * Re-throws any pg error after ROLLBACK (caught by the controller's next(err)).
 */
export async function record(
  orgId: string,
  userId: string,
  rawBody: unknown
): Promise<Transaction> {
  const parsed = RecordTransactionSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
  }

  const input: RecordTransactionInput = {
    orgId,
    customerId:  parsed.data.customerId,
    type:        parsed.data.type as TransactionType,
    amount:      parsed.data.amount,
    description: parsed.data.description,
    createdBy:   userId,
  };

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const transaction = await recordTransaction(client, input);
    await client.query('COMMIT');
    return transaction;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// ledger
// ---------------------------------------------------------------------------

/**
 * Returns the full paginated ledger for a customer, validating
 * query parameters and converting the null-on-not-found to AppError(404).
 */
export async function ledger(
  orgId: string,
  customerId: string,
  rawQuery: unknown
): Promise<CustomerLedgerResult> {
  const parsed = LedgerQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid query parameters', 400);
  }

  const result = await getCustomerLedger(orgId, customerId, {
    page:  parsed.data.page,
    limit: parsed.data.limit,
  });

  if (!result) {
    throw new AppError('Customer not found', 404);
  }

  return result;
}

// ---------------------------------------------------------------------------
// dashboardSummary
// ---------------------------------------------------------------------------

export async function dashboardSummary(orgId: string): Promise<DashboardSummary> {
  return getDashboardSummary(orgId);
}