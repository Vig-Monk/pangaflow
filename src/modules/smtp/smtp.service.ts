// =============================================================================
// soko-api/src/modules/smtp/smtp.service.ts
// Business logic for tenant SMTP verification, saving, and pool cache invalidation.
// =============================================================================

import nodemailer from 'nodemailer';
import { z } from 'zod';
import { AppError } from '../../utils/error';
import * as smtpQueries from './smtp.queries';
import { invalidateTransporterCache } from '../../services/email.service';

export const SaveSmtpSchema = z.object({
  smtpHost: z.string().min(1, 'SMTP Host is required').max(200),
  smtpPort: z.coerce.number().int().min(1).max(65535).default(465),
  smtpSecure: z.boolean().default(true),
  smtpUser: z.string().min(1, 'SMTP Username/Email is required').max(200),
  smtpPass: z.string().min(1, 'SMTP Password is required').max(500),
  fromName: z.string().min(1, 'Sender Name is required').max(100),
  fromEmail: z.string().email('Valid Sender Email is required').max(200),
  replyTo: z.string().email('Invalid reply-to email').nullable().optional().or(z.literal('')).transform(v => v || null),
});

export const VerifySmtpSchema = z.object({
  testRecipient: z.string().email('Valid test recipient email is required'),
});

export interface PublicSmtpDto {
  id: string;
  org_id: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  status: 'pending' | 'verified' | 'failed';
  last_verified_at: Date | null;
  last_error: string | null;
}

export function toPublicSmtpDto(row: smtpQueries.OrgSmtpCredentialsRow | null): PublicSmtpDto | null {
  if (!row) return null;
  return {
    id: row.id,
    org_id: row.org_id,
    smtp_host: row.smtp_host,
    smtp_port: row.smtp_port,
    smtp_secure: row.smtp_secure,
    smtp_user: row.smtp_user,
    from_name: row.from_name,
    from_email: row.from_email,
    reply_to: row.reply_to,
    status: row.status,
    last_verified_at: row.last_verified_at,
    last_error: row.last_error,
  };
}

export async function getCredentials(orgId: string): Promise<PublicSmtpDto | null> {
  const row = await smtpQueries.getSmtpCredentialsRowByOrgId(orgId);
  return toPublicSmtpDto(row);
}

export async function saveCredentials(orgId: string, rawBody: unknown): Promise<PublicSmtpDto> {
  const parsed = SaveSmtpSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid SMTP configuration', 400);
  }

  const row = await smtpQueries.upsertSmtpCredentials(orgId, parsed.data);
  invalidateTransporterCache(orgId);

  const dto = toPublicSmtpDto(row);
  if (!dto) {
    throw new AppError('Failed to save SMTP credentials', 500, false);
  }
  return dto;
}

export async function removeCredentials(orgId: string): Promise<void> {
  const deleted = await smtpQueries.deleteSmtpCredentials(orgId);
  if (!deleted) {
    throw new AppError('SMTP credentials not found', 404);
  }
  invalidateTransporterCache(orgId);
}

export async function verifyCredentials(
  orgId: string,
  rawBody: unknown
): Promise<{ success: boolean; message: string }> {
  const parsed = VerifySmtpSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Test recipient email is required', 400);
  }

  const creds = await smtpQueries.getDecryptedSmtpCredentials(orgId);
  if (!creds) {
    throw new AppError('SMTP credentials not configured. Save credentials before verifying.', 404);
  }

  // 1. Create a dedicated test transporter
  const testTransporter = nodemailer.createTransport({
    host: creds.smtpHost,
    port: creds.smtpPort,
    secure: creds.smtpSecure,
    auth: {
      user: creds.smtpUser,
      pass: creds.smtpPass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  });

  try {
    // 2. Perform SMTP connection handshake verification
    await testTransporter.verify();

    // 3. Dispatch a real test email
    await testTransporter.sendMail({
      from: `"${creds.fromName}" <${creds.fromEmail}>`,
      to: parsed.data.testRecipient,
      replyTo: creds.replyTo || undefined,
      subject: `[Verified] ${creds.fromName} SMTP Test Delivery`,
      html: `
        <div style="font-family: sans-serif; padding: 24px; color: #111315;">
          <h2 style="color: #E50914; margin: 0 0 12px 0;">SMTP Connection Verified!</h2>
          <p>This test email confirms that your store mail server (<strong>${creds.smtpHost}</strong>) is authenticated and ready to dispatch customer order receipts and eBook download tokens.</p>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 16px 0;" />
          <span style="font-size: 11px; color: #656F7D;">Authenticated via KauntaOS Multi-Tenant Mail Engine</span>
        </div>
      `,
    });

    // 4. Update status in database to verified
    await smtpQueries.updateSmtpVerificationStatus(orgId, 'verified', null);
    invalidateTransporterCache(orgId);

    return {
      success: true,
      message: `Verification email sent successfully to ${parsed.data.testRecipient}!`,
    };
  } catch (err: any) {
    const errorMsg = err.message || 'SMTP handshake failed';
    await smtpQueries.updateSmtpVerificationStatus(orgId, 'failed', errorMsg);
    throw new AppError(`SMTP verification failed: ${errorMsg}`, 400);
  } finally {
    testTransporter.close();
  }
}