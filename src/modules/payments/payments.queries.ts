// =============================================================================
// src/modules/payments/payments.queries.ts
// Database access layer — M-Pesa payment tracking. Raw pg only.
// No business logic, no Daraja API calls — those live in daraja.service.ts.
// =============================================================================

import { PoolClient } from 'pg';
import { query } from '../../config/db';

// ---------------------------------------------------------------------------
// MpesaTransaction — mirrors mpesa_transactions table field-for-field
// ---------------------------------------------------------------------------

export type MpesaTransactionStatus = 'pending' | 'completed' | 'failed';

export interface MpesaTransaction {
  id: string;
  org_id: string;
  customer_id: string | null;
  checkout_request_id: string;
  merchant_request_id: string;
  phone: string;
  amount: string; // NUMERIC — pg returns as string, parseFloat() where arithmetic is needed
  account_reference: string;
  transaction_desc: string;
  status: MpesaTransactionStatus;
  result_code: number | null;
  result_desc: string | null;
  mpesa_receipt_number: string | null;
  transaction_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateMpesaTxInput {
  orgId: string;
  customerId?: string;
  checkoutRequestId: string;
  merchantRequestId: string;
  phone: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
}

export interface UpdateMpesaTxInput {
  status: MpesaTransactionStatus;
  resultCode: number;
  resultDesc: string;
  mpesaReceiptNumber?: string;
  transactionDate?: Date;
}

// ---------------------------------------------------------------------------
// createPendingMpesaTransaction
// ---------------------------------------------------------------------------

/**
 * Creates a 'pending' M-Pesa transaction row immediately after a
 * successful stkPush() call, before the callback has arrived. Called
 * inside a pg transaction alongside whatever else the payment flow does
 * atomically (e.g. Prompt 2.2's payment initiation route).
 */
export async function createPendingMpesaTransaction(
  client: PoolClient,
  data: CreateMpesaTxInput
): Promise<MpesaTransaction> {
  const result = await client.query<MpesaTransaction>(
    `INSERT INTO mpesa_transactions
       (org_id, customer_id, checkout_request_id, merchant_request_id,
        phone, amount, account_reference, transaction_desc, status)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
     RETURNING
       id, org_id, customer_id, checkout_request_id, merchant_request_id,
       phone, amount::text AS amount, account_reference, transaction_desc,
       status, result_code, result_desc, mpesa_receipt_number,
       transaction_date, created_at, updated_at`,
    [
      data.orgId,
      data.customerId ?? null,
      data.checkoutRequestId,
      data.merchantRequestId,
      data.phone,
      data.amount,
      data.accountReference,
      data.transactionDesc,
    ]
  );

  return result.rows[0];
}

// ---------------------------------------------------------------------------
// updateMpesaTransactionByCheckoutId
// ---------------------------------------------------------------------------

/**
 * Updates a transaction's status and result fields once the Daraja
 * callback arrives. checkout_request_id is the only correlation key
 * available at callback time — Safaricom's callback body carries the
 * same CheckoutRequestID the original stkPush() response returned.
 *
 * No-ops (affects zero rows) if the checkout_request_id doesn't match
 * any row — the caller (the callback route handler) is responsible for
 * deciding how to log/handle that case, since it likely indicates a
 * callback for a transaction this server didn't initiate, or one that
 * predates a database reset.
 */
export async function updateMpesaTransactionByCheckoutId(
  client: PoolClient,
  checkoutRequestId: string,
  data: UpdateMpesaTxInput
): Promise<void> {
  await client.query(
    `UPDATE mpesa_transactions
     SET    status               = $2,
            result_code          = $3,
            result_desc          = $4,
            mpesa_receipt_number = $5,
            transaction_date     = $6
     WHERE  checkout_request_id  = $1`,
    [
      checkoutRequestId,
      data.status,
      data.resultCode,
      data.resultDesc,
      data.mpesaReceiptNumber ?? null,
      data.transactionDate ?? null,
    ]
  );
}

// ---------------------------------------------------------------------------
// getMpesaTransactionByCheckoutId
// ---------------------------------------------------------------------------

/**
 * Looks up a transaction by its checkout_request_id. Used by the callback
 * handler to confirm a transaction exists (and check its current status
 * for idempotency) before applying an update, and by payment-status
 * polling endpoints if the frontend needs to check "has this payment
 * completed yet."
 */
export async function getMpesaTransactionByCheckoutId(
  checkoutRequestId: string
): Promise<MpesaTransaction | null> {
  const result = await query<MpesaTransaction>(
    `SELECT
       id, org_id, customer_id, checkout_request_id, merchant_request_id,
       phone, amount::text AS amount, account_reference, transaction_desc,
       status, result_code, result_desc, mpesa_receipt_number,
       transaction_date, created_at, updated_at
     FROM   mpesa_transactions
     WHERE  checkout_request_id = $1`,
    [checkoutRequestId]
  );

  return result.rows[0] ?? null;
}