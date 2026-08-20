// =============================================================================
// src/modules/transactions/transactions.service.ts
// =============================================================================

import { z } from 'zod';
import { pool } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../utils/error';
import { Transaction, TransactionType } from '../../types/models';
import * as darajaService from '../../services/daraja.service';
import { getCredentialsRowByOrgId, getDecryptedCredentials } from '../mpesa-credentials/mpesa-credentials.queries';
import { createPendingMpesaTransaction } from '../payments/payments.queries';
import {
  CustomerLedgerResult,
  DashboardSummary,
  RecordTransactionInput,
  getDashboardSummary,
  getCustomerLedger,
  recordTransaction,
  findOrCreateCustomerTransactional,
} from './transactions.queries';

export const RecordTransactionSchema = z.object({
  customerId:  z.string().uuid('customerId must be a valid UUID'),
  type:        z.enum(['sale', 'payment', 'adjustment']),
  amount:      z.number().positive('Amount must be greater than zero'),
  description: z.string().max(500).optional(),
});

export const SmartSaleSchema = z.object({
  customerId: z.string().uuid().optional(),
  newCustomer: z.object({
    name: z.string().min(1, 'Customer name is required').max(200),
    phone: z.string().max(20).optional(),
    address: z.string().max(500).optional(),
  }).optional(),
  amount: z.number().positive('Sale amount must be greater than zero'),
  description: z.string().max(500).optional(),
  paymentMode: z.enum(['credit', 'cash', 'mpesa_manual', 'mpesa_stk']).default('credit'),
  mpesaRef: z.string().max(50).optional(),
  phone: z.string().max(20).optional(),
}).refine((data) => data.customerId || (data.newCustomer && data.newCustomer.name), {
  message: 'Select an existing customer or provide new customer details',
});

export const SettleDebtSchema = z.object({
  customerId: z.string().uuid('Customer ID must be a valid UUID'),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.enum(['cash', 'mpesa_manual', 'mpesa_stk']).default('cash'),
  mpesaRef: z.string().max(50).optional(),
  phone: z.string().max(20).optional(),
  description: z.string().max(500).optional(),
});

export const LedgerQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type RecordTransactionBody = z.infer<typeof RecordTransactionSchema>;
export type SmartSaleBody          = z.infer<typeof SmartSaleSchema>;
export type SettleDebtBody         = z.infer<typeof SettleDebtSchema>;
export type LedgerQuery           = z.infer<typeof LedgerQuerySchema>;

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

export async function smartSale(
  orgId: string,
  userId: string,
  rawBody: unknown
): Promise<{
  saleTransaction: Transaction;
  paymentTransaction: Transaction | null;
  customerId: string;
  customerName: string;
  paymentMode: string;
  checkoutRequestId?: string;
  customerMessage?: string;
}> {
  const parsed = SmartSaleSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid smart sale payload', 400);
  }

  const data = parsed.data;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let customerId: string;
    let customerName: string;
    let customerPhone: string | null = null;

    if (data.newCustomer) {
      const cust = await findOrCreateCustomerTransactional(client, orgId, data.newCustomer);
      customerId = cust.id;
      customerName = cust.name;
      customerPhone = cust.phone;
    } else {
      const custRes = await client.query<{ id: string; name: string; phone: string | null }>(
        `SELECT id, name, phone FROM customers WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
        [data.customerId, orgId]
      );
      if (custRes.rows.length === 0) {
        throw new AppError('Customer not found', 404);
      }
      customerId = custRes.rows[0].id;
      customerName = custRes.rows[0].name;
      customerPhone = custRes.rows[0].phone;
    }

    const saleDescription = data.description?.trim() || (data.paymentMode === 'credit' ? 'Sale on credit (Deni)' : 'Sale recorded');
    const saleTransaction = await recordTransaction(client, {
      orgId,
      customerId,
      type: 'sale',
      amount: data.amount,
      description: saleDescription,
      createdBy: userId,
    });

    let paymentTransaction: Transaction | null = null;
    let checkoutRequestId: string | undefined;
    let customerMessage: string | undefined;

    if (data.paymentMode === 'cash') {
      paymentTransaction = await recordTransaction(client, {
        orgId,
        customerId,
        type: 'payment',
        amount: data.amount,
        description: 'Cash payment received (Cleared)',
        createdBy: userId,
      });
    } else if (data.paymentMode === 'mpesa_manual') {
      const desc = data.mpesaRef?.trim()
        ? `M-Pesa payment (Ref: ${data.mpesaRef.trim().toUpperCase()})`
        : 'M-Pesa payment received (Cleared)';

      paymentTransaction = await recordTransaction(client, {
        orgId,
        customerId,
        type: 'payment',
        amount: data.amount,
        description: desc,
        createdBy: userId,
      });
    } else if (data.paymentMode === 'mpesa_stk') {
      const targetPhone = data.phone?.trim() || customerPhone;
      if (!targetPhone) {
        throw new AppError('Customer phone number is required for M-Pesa STK Push', 400);
      }

      const credsRow = await getCredentialsRowByOrgId(orgId);
      if (!credsRow || credsRow.status !== 'verified') {
        throw new AppError('M-Pesa credentials not configured or verified for this store', 400);
      }

      const creds = await getDecryptedCredentials(orgId);
      if (!creds) {
        throw new AppError('Failed to decrypt M-Pesa credentials', 500, false);
      }

      const callbackUrl = `${env.API_PUBLIC_URL.replace(/\/$/, '')}/api/v1/payments/mpesa/callback`;
      const stkResult = await darajaService.stkPush({
        credentials: creds,
        phone: targetPhone,
        amount: data.amount,
        accountReference: customerId,
        transactionDesc: 'Store POS Sale',
        callbackUrl,
      });

      checkoutRequestId = stkResult.checkoutRequestId;
      customerMessage = stkResult.customerMessage;

      await createPendingMpesaTransaction(client, {
        orgId,
        customerId,
        checkoutRequestId: stkResult.checkoutRequestId,
        merchantRequestId: stkResult.merchantRequestId,
        phone: targetPhone,
        amount: data.amount,
        accountReference: customerId,
        transactionDesc: 'Store POS Sale',
      });
    }

    await client.query('COMMIT');

    return {
      saleTransaction,
      paymentTransaction,
      customerId,
      customerName,
      paymentMode: data.paymentMode,
      checkoutRequestId,
      customerMessage,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function settleDebt(
  orgId: string,
  userId: string,
  rawBody: unknown
): Promise<{
  paymentTransaction: Transaction;
  customerId: string;
  customerName: string;
  amountSettled: number;
  newBalance: string;
  paymentMethod: string;
  checkoutRequestId?: string;
  customerMessage?: string;
}> {
  const parsed = SettleDebtSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid debt settlement payload', 400);
  }

  const data = parsed.data;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const custRes = await client.query<{ id: string; name: string; phone: string | null }>(
      `SELECT id, name, phone FROM customers WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
      [data.customerId, orgId]
    );

    if (custRes.rows.length === 0) {
      throw new AppError('Customer not found', 404);
    }

    const customer = custRes.rows[0];

    let desc = data.description?.trim();
    if (!desc) {
      if (data.paymentMethod === 'cash') {
        desc = 'Debt settled (Cash in hand)';
      } else if (data.paymentMethod === 'mpesa_manual') {
        desc = data.mpesaRef?.trim()
          ? `Debt settled via M-Pesa (Ref: ${data.mpesaRef.trim().toUpperCase()})`
          : 'Debt settled via M-Pesa';
      } else if (data.paymentMethod === 'mpesa_stk') {
        desc = 'Debt payment via M-Pesa STK Push';
      }
    }

    const paymentTransaction = await recordTransaction(client, {
      orgId,
      customerId: customer.id,
      type: 'payment',
      amount: data.amount,
      description: desc,
      createdBy: userId,
    });

    let checkoutRequestId: string | undefined;
    let customerMessage: string | undefined;

    if (data.paymentMethod === 'mpesa_stk') {
      const targetPhone = data.phone?.trim() || customer.phone;
      if (!targetPhone) {
        throw new AppError('Customer phone number is required for M-Pesa STK Push', 400);
      }

      const credsRow = await getCredentialsRowByOrgId(orgId);
      if (!credsRow || credsRow.status !== 'verified') {
        throw new AppError('M-Pesa credentials not configured or verified for this store', 400);
      }

      const creds = await getDecryptedCredentials(orgId);
      if (!creds) {
        throw new AppError('Failed to decrypt M-Pesa credentials', 500, false);
      }

      const callbackUrl = `${env.API_PUBLIC_URL.replace(/\/$/, '')}/api/v1/payments/mpesa/callback`;
      const stkResult = await darajaService.stkPush({
        credentials: creds,
        phone: targetPhone,
        amount: data.amount,
        accountReference: customer.id,
        transactionDesc: 'Settle Debt',
        callbackUrl,
      });

      checkoutRequestId = stkResult.checkoutRequestId;
      customerMessage = stkResult.customerMessage;

      await createPendingMpesaTransaction(client, {
        orgId,
        customerId: customer.id,
        checkoutRequestId: stkResult.checkoutRequestId,
        merchantRequestId: stkResult.merchantRequestId,
        phone: targetPhone,
        amount: data.amount,
        accountReference: customer.id,
        transactionDesc: 'Settle Debt',
      });
    }

    await client.query('COMMIT');

    return {
      paymentTransaction,
      customerId: customer.id,
      customerName: customer.name,
      amountSettled: data.amount,
      newBalance: paymentTransaction.balance_after,
      paymentMethod: data.paymentMethod,
      checkoutRequestId,
      customerMessage,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

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

export async function dashboardSummary(orgId: string): Promise<DashboardSummary> {
  return getDashboardSummary(orgId);
}