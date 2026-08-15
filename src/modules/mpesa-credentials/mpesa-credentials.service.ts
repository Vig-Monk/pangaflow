// =============================================================================
// src/modules/mpesa-credentials/mpesa-credentials.service.ts
// =============================================================================

import { z } from 'zod';
import { AppError } from '../../utils/error';
import { env } from '../../config/env';
import { pool } from '../../config/db';
import * as darajaService from '../../services/daraja.service';
import * as credsQueries from './mpesa-credentials.queries';
import { createPendingMpesaTransaction } from '../payments/payments.queries';

export const SaveCredentialsSchema = z.object({
  tillType: z.enum(['till', 'paybill']),
  shortcode: z
    .string()
    .min(3, 'Shortcode must be at least 3 digits')
    .max(15, 'Shortcode cannot exceed 15 digits')
    .regex(/^\d+$/, 'Shortcode must contain digits only'),
  storeNumber: z
    .string()
    .max(15)
    .regex(/^\d+$/, 'Store number must contain digits only')
    .nullable()
    .optional(),
  consumerKey: z.string().min(8, 'Consumer Key is required').max(200),
  consumerSecret: z.string().min(8, 'Consumer Secret is required').max(200),
  passkey: z.string().min(10, 'Passkey is required').max(500),
  environment: z.enum(['sandbox', 'production']).default('sandbox'),
});

export const VerifyCredentialsSchema = z.object({
  phone: z
    .string()
    .min(9, 'Phone number is required')
    .max(20)
    .regex(/^(07|01|254|\+254)\d{8}$/, 'Enter a valid Kenyan phone number (e.g. 07XXXXXXXX)'),
});

export interface PublicMpesaCredentialsDto {
  id: string;
  org_id: string;
  till_type: 'till' | 'paybill';
  shortcode: string;
  store_number: string | null;
  environment: 'sandbox' | 'production';
  status: 'pending' | 'verified' | 'failed';
  last_verified_at: Date | null;
  last_error: string | null;
}

export function toPublicCredentialsDto(
  row: credsQueries.OrgMpesaCredentialsRow | null
): PublicMpesaCredentialsDto | null {
  if (!row) return null;
  return {
    id: row.id,
    org_id: row.org_id,
    till_type: row.till_type,
    shortcode: row.shortcode,
    store_number: row.store_number,
    environment: row.environment,
    status: row.status,
    last_verified_at: row.last_verified_at,
    last_error: row.last_error,
  };
}

export async function getCredentials(orgId: string): Promise<PublicMpesaCredentialsDto | null> {
  const row = await credsQueries.getCredentialsRowByOrgId(orgId);
  return toPublicCredentialsDto(row);
}

export async function saveCredentials(
  orgId: string,
  rawBody: unknown
): Promise<PublicMpesaCredentialsDto> {
  const parsed = SaveCredentialsSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid credentials input', 400);
  }

  const row = await credsQueries.upsertCredentials(orgId, parsed.data);
  const dto = toPublicCredentialsDto(row);

  if (!dto) {
    throw new AppError('Failed to save M-Pesa credentials', 500, false);
  }

  return dto;
}

export async function removeCredentials(orgId: string): Promise<void> {
  const deleted = await credsQueries.deleteCredentials(orgId);
  if (!deleted) {
    throw new AppError('Credentials not found', 404);
  }
}

export async function verifyCredentials(
  orgId: string,
  rawBody: unknown
): Promise<{ checkoutRequestId: string; customerMessage: string }> {
  const parsed = VerifyCredentialsSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid phone number for verification', 400);
  }

  const creds = await credsQueries.getDecryptedCredentials(orgId);
  if (!creds) {
    throw new AppError('M-Pesa credentials not configured for this organization. Save your credentials first.', 404);
  }

  // Stage 1: Verify Consumer Key & Secret via OAuth token exchange
  try {
    await darajaService.getAccessToken(creds);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Daraja OAuth token generation failed';
    await credsQueries.updateVerificationStatus(orgId, 'failed', errorMsg);
    throw new AppError(`Safaricom authentication failed: ${errorMsg}`, 400);
  }

  // Stage 2: Fire test KES 1 STK Push
  const callbackUrl = `${env.API_PUBLIC_URL.replace(/\/$/, '')}/api/v1/payments/mpesa/callback`;
  const client = await pool.connect();

  try {
    const stkResult = await darajaService.stkPush({
      credentials: {
        tillType: creds.tillType,
        shortcode: creds.shortcode,
        storeNumber: creds.storeNumber,
        consumerKey: creds.consumerKey,
        consumerSecret: creds.consumerSecret,
        passkey: creds.passkey,
        environment: creds.environment,
      },
      phone: parsed.data.phone,
      amount: 1,
      accountReference: 'SOKO-VERIFY',
      transactionDesc: 'Verify Till',
      callbackUrl,
    });

    await client.query('BEGIN');

    await createPendingMpesaTransaction(client, {
      orgId,
      checkoutRequestId: stkResult.checkoutRequestId,
      merchantRequestId: stkResult.merchantRequestId,
      phone: parsed.data.phone,
      amount: 1,
      accountReference: 'SOKO-VERIFY',
      transactionDesc: 'Verify Till',
    });

    await client.query('COMMIT');

    return {
      checkoutRequestId: stkResult.checkoutRequestId,
      customerMessage: stkResult.customerMessage,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    const errorMsg = err instanceof Error ? err.message : 'Verification STK Push failed';
    await credsQueries.updateVerificationStatus(orgId, 'failed', errorMsg);
    throw new AppError(`Verification push failed: ${errorMsg}`, 400);
  } finally {
    client.release();
  }
}