// =============================================================================
// src/modules/payments/payments.service.ts
// Business logic for payments. Owns the payment-method branch point and
// the atomic transaction wrapping required around every ledger write.
// =============================================================================

import { pool } from '../../config/db';
import { AppError } from '../../utils/error';
import * as darajaService from '../../services/daraja.service';
import { MpesaCallbackResult } from '../../services/daraja.service';
import {
  createPendingMpesaTransaction,
  getMpesaTransactionByCheckoutId,
  updateMpesaTransactionByCheckoutId,
} from './payments.queries';
import { recordTransaction } from '../transactions/transactions.queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Discriminator for which payment provider handles a request. Only
 * 'mpesa' does anything today — 'stripe' exists as a typed placeholder so
 * a future Stripe integration is a new case in the switch below, not a
 * rewrite of this function's signature or the controller/route layer
 * that calls it.
 */
export type PaymentMethod = 'mpesa' | 'stripe';

export interface InitiatePaymentInput {
  orgId: string;
  customerId: string;
  amount: number;
  phone: string;
  paymentMethod: PaymentMethod;
}

export interface InitiatePaymentResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  customerMessage: string;
}

// ---------------------------------------------------------------------------
// initiatePayment
// ---------------------------------------------------------------------------

/**
 * Initiates a payment via the specified provider. This is the single
 * entry point payments.controller.ts calls — it never talks to
 * daraja.service.ts or a future stripe.service.ts directly.
 *
 * Adding Stripe later means adding a 'stripe' case to this switch and
 * writing stripe.service.ts + a stripe_transactions table + a
 * payments-stripe.queries.ts — it does NOT mean changing this function's
 * signature, the controller, the routes, or anything upstream of here.
 */
export async function initiatePayment(
  input: InitiatePaymentInput
): Promise<InitiatePaymentResult> {
  switch (input.paymentMethod) {
    case 'mpesa':
      return initiateMpesaPayment(input);

    case 'stripe':
      // Not implemented yet. An explicit, typed failure rather than a
      // silent fallthrough — a request for a genuinely unwired payment
      // method should fail loudly with a clear message.
      throw new AppError(
        'Stripe payments are not yet available. Please use M-Pesa.',
        501
      );

    default: {
      // Exhaustiveness check: if PaymentMethod ever gains a third value
      // without a case here, this line fails to compile, catching the
      // gap at build time instead of runtime.
      const _exhaustive: never = input.paymentMethod;
      throw new AppError(`Unsupported payment method: ${String(_exhaustive)}`, 400);
    }
  }
}

// ---------------------------------------------------------------------------
// initiateMpesaPayment — the only implemented branch today
// ---------------------------------------------------------------------------

async function initiateMpesaPayment(
  input: InitiatePaymentInput
): Promise<InitiatePaymentResult> {
  const publicUrl = process.env.API_PUBLIC_URL;

  if (!publicUrl) {
    // A callback URL that isn't a real public HTTPS endpoint means
    // Safaricom can never deliver the result — fail loudly at initiation
    // time rather than silently creating a transaction that can never
    // be completed.
    throw new AppError(
      'API_PUBLIC_URL is not configured — cannot register an M-Pesa callback URL',
      500,
      false
    );
  }

  const callbackUrl = `${publicUrl}/api/v1/payments/mpesa/callback`;

  const stkResult = await darajaService.stkPush({
    phone: input.phone,
    amount: input.amount,
    accountReference: input.customerId,
    transactionDesc: 'Soko payment',
    callbackUrl,
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await createPendingMpesaTransaction(client, {
      orgId: input.orgId,
      customerId: input.customerId,
      checkoutRequestId: stkResult.checkoutRequestId,
      merchantRequestId: stkResult.merchantRequestId,
      phone: input.phone,
      amount: input.amount,
      accountReference: input.customerId,
      transactionDesc: 'Soko payment',
    });

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return {
    checkoutRequestId: stkResult.checkoutRequestId,
    merchantRequestId: stkResult.merchantRequestId,
    customerMessage: stkResult.customerMessage,
  };
}

// ---------------------------------------------------------------------------
// handleMpesaCallback
// ---------------------------------------------------------------------------

/**
 * Processes a parsed Daraja callback result. Called by the public
 * callback route after parseCallback() has already validated the
 * request body shape.
 *
 * IDEMPOTENCY: Safaricom retries callbacks aggressively if it doesn't
 * receive a 200 response quickly enough — the same callback body can
 * arrive more than once. Before applying any update, this checks whether
 * the transaction has already reached 'completed' status. If so, this is
 * a duplicate delivery already processed — return immediately without
 * re-applying the ledger write, which would otherwise double-credit the
 * customer's balance.
 *
 * Note on status vocabulary: the spec's text says "check if
 * checkoutRequestId already status='success'" — this schema (from the
 * Prompt 2.1 migration already on disk) defines the completed state as
 * 'completed', not 'success'. Same state, different literal string; the
 * check below uses the value the schema actually defines.
 *
 * ATOMICITY: on a genuinely new successful payment, both the
 * mpesa_transactions status update AND the credit-ledger 'payment' entry
 * are written inside one pg transaction. A partial write here — the
 * M-Pesa row marked completed but no ledger entry, or vice versa — is
 * exactly the balance corruption this prompt's spec calls out by name.
 *
 * This function only throws for genuine internal failures (DB errors, an
 * unknown checkoutRequestId) — a failed/cancelled STK Push is a normal,
 * expected outcome, not an application error, and returns normally. The
 * route handler catches whatever this throws and STILL returns 200 to
 * Safaricom regardless (see the route file).
 */
export async function handleMpesaCallback(
  callback: MpesaCallbackResult
): Promise<void> {
  const existing = await getMpesaTransactionByCheckoutId(callback.checkoutRequestId);

  if (!existing) {
    // A callback for a checkoutRequestId this server never created a
    // pending row for. The route handler logs this; there's nothing to
    // update and no ledger write to protect.
    throw new AppError(
      `No M-Pesa transaction found for checkoutRequestId: ${callback.checkoutRequestId}`,
      404
    );
  }

  // Idempotency guard.
  if (existing.status === 'completed') {
    return;
  }

  if (!callback.isSuccess) {
    // Failed or cancelled push — update status to 'failed', no ledger
    // write. Only one write happens here, so it still gets its own
    // transaction for consistency with the success path, but there's no
    // second write it needs to stay atomic WITH.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await updateMpesaTransactionByCheckoutId(client, callback.checkoutRequestId, {
        status: 'failed',
        resultCode: callback.resultCode,
        resultDesc: callback.resultDesc,
      });
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return;
  }

  // Success path — the mandatory atomic transaction the spec calls out.
  // Both writes commit together or neither does.
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await updateMpesaTransactionByCheckoutId(client, callback.checkoutRequestId, {
      status: 'completed',
      resultCode: callback.resultCode,
      resultDesc: callback.resultDesc,
      mpesaReceiptNumber: callback.mpesaReceiptNumber ?? undefined,
      transactionDate: callback.transactionDate
        ? new Date(callback.transactionDate)
        : undefined,
    });

    if (existing.customer_id) {
      await recordTransaction(client, {
        orgId: existing.org_id,
        customerId: existing.customer_id,
        type: 'payment',
        amount: callback.amount ?? parseFloat(existing.amount),
        description: `M-Pesa payment — receipt ${callback.mpesaReceiptNumber ?? 'N/A'}`,
        // No authenticated user exists in a public webhook's request
        // context — this is a system-initiated ledger entry, not one
        // attributed to a staff member. null is valid here: the column
        // has no NOT NULL constraint, and RecordTransactionInput.createdBy
        // is now typed string | null (see the patch note above this file).
        createdBy: null,
      });
    }
    // A payment not tied to a customer record has nothing to credit
    // against — the M-Pesa transaction itself is still marked completed
    // above; there's simply no ledger entry to write. Valid, if unusual.

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}