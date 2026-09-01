// =============================================================================
// soko-api/src/modules/payments/payments.queries.ts
// Database access layer — M-Pesa payment tracking & callback audit logging.
// =============================================================================

import { PoolClient } from 'pg';
import { query } from '../../config/db';

export type MpesaTransactionStatus = 'pending' | 'completed' | 'failed';

export interface MpesaTransaction {
  id: string;
  org_id: string;
  customer_id: string | null;
  checkout_request_id: string;
  merchant_request_id: string;
  phone: string;
  amount: string;
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

/**
 * Creates an immutable audit row recording raw Safaricom callback payloads.
 */
export async function logRawMpesaCallback(
  checkoutRequestId: string,
  merchantRequestId: string | null,
  resultCode: number | null,
  rawPayload: unknown
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO mpesa_callbacks (
       checkout_request_id, merchant_request_id, result_code, raw_payload
     )
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id`,
    [
      checkoutRequestId,
      merchantRequestId ?? null,
      resultCode ?? null,
      JSON.stringify(rawPayload),
    ]
  );
  return result.rows[0].id;
}

export async function markCallbackProcessed(
  callbackId: string,
  processed = true,
  errorMessage: string | null = null
): Promise<void> {
  await query(
    `UPDATE mpesa_callbacks
     SET    processed = $2,
            error_message = $3
     WHERE  id = $1`,
    [callbackId, processed, errorMessage]
  );
}

/**
 * Checks for an active in-flight STK push within the last 60 seconds (Idempotency Window).
 */
export async function findRecentPendingMpesaTransaction(
  accountReference: string,
  windowSeconds = 60
): Promise<MpesaTransaction | null> {
  const result = await query<MpesaTransaction>(
    `SELECT id, org_id, customer_id, checkout_request_id, merchant_request_id,
            phone, amount::text AS amount, account_reference, transaction_desc,
            status, result_code, result_desc, mpesa_receipt_number,
            transaction_date, created_at, updated_at
     FROM   mpesa_transactions
     WHERE  account_reference = $1
       AND  status = 'pending'
       AND  created_at >= NOW() - ($2 || ' seconds')::INTERVAL
     ORDER  BY created_at DESC
     LIMIT  1`,
    [accountReference, windowSeconds]
  );
  return result.rows[0] ?? null;
}

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