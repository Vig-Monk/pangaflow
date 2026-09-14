// =============================================================================
// soko-api/src/modules/smtp/smtp.queries.ts
// Database queries for org_smtp_credentials with AES-256-GCM encryption boundaries.
// =============================================================================

import { query } from '../../config/db';
import { encrypt, decrypt } from '../../utils/crypto';

export interface OrgSmtpCredentialsRow {
  id: string;
  org_id: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass_enc: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  status: 'pending' | 'verified' | 'failed';
  last_verified_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DecryptedSmtpCredentials {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  status: 'pending' | 'verified' | 'failed';
}

export interface UpsertSmtpCredentialsInput {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string | null;
}

/**
 * Retrieves the raw database row containing encrypted secret strings.
 * Internal to backend queries only.
 */
export async function getSmtpCredentialsRowByOrgId(
  orgId: string
): Promise<OrgSmtpCredentialsRow | null> {
  const result = await query<OrgSmtpCredentialsRow>(
    `SELECT id, org_id, smtp_host, smtp_port, smtp_secure,
            smtp_user, smtp_pass_enc, from_name, from_email,
            reply_to, status, last_verified_at, last_error,
            created_at, updated_at
     FROM   org_smtp_credentials
     WHERE  org_id = $1`,
    [orgId]
  );
  return result.rows[0] ?? null;
}

/**
 * Decrypts stored credentials for backend consumption (Nodemailer connection).
 * Never exposed directly in API responses.
 */
export async function getDecryptedSmtpCredentials(
  orgId: string
): Promise<DecryptedSmtpCredentials | null> {
  const row = await getSmtpCredentialsRowByOrgId(orgId);
  if (!row) return null;

  return {
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    smtpSecure: row.smtp_secure,
    smtpUser: row.smtp_user,
    smtpPass: decrypt(row.smtp_pass_enc),
    fromName: row.from_name,
    fromEmail: row.from_email,
    replyTo: row.reply_to,
    status: row.status,
  };
}

/**
 * Encrypts password with AES-256-GCM and upserts into org_smtp_credentials.
 * Resets status to 'pending' on any credential update.
 */
export async function upsertSmtpCredentials(
  orgId: string,
  input: UpsertSmtpCredentialsInput
): Promise<OrgSmtpCredentialsRow> {
  const smtpPassEnc = encrypt(input.smtpPass);

  const result = await query<OrgSmtpCredentialsRow>(
    `INSERT INTO org_smtp_credentials (
       org_id, smtp_host, smtp_port, smtp_secure,
       smtp_user, smtp_pass_enc, from_name, from_email,
       reply_to, status, last_error
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NULL)
     ON CONFLICT (org_id) DO UPDATE SET
       smtp_host        = EXCLUDED.smtp_host,
       smtp_port        = EXCLUDED.smtp_port,
       smtp_secure      = EXCLUDED.smtp_secure,
       smtp_user        = EXCLUDED.smtp_user,
       smtp_pass_enc    = EXCLUDED.smtp_pass_enc,
       from_name        = EXCLUDED.from_name,
       from_email       = EXCLUDED.from_email,
       reply_to         = EXCLUDED.reply_to,
       status           = 'pending',
       last_error       = NULL,
       updated_at       = NOW()
     RETURNING id, org_id, smtp_host, smtp_port, smtp_secure,
               smtp_user, smtp_pass_enc, from_name, from_email,
               reply_to, status, last_verified_at, last_error,
               created_at, updated_at`,
    [
      orgId,
      input.smtpHost.trim(),
      input.smtpPort,
      input.smtpSecure,
      input.smtpUser.trim(),
      smtpPassEnc,
      input.fromName.trim(),
      input.fromEmail.trim().toLowerCase(),
      input.replyTo?.trim().toLowerCase() || null,
    ]
  );

  return result.rows[0];
}

/**
 * Removes the organization's SMTP credentials.
 */
export async function deleteSmtpCredentials(orgId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM org_smtp_credentials WHERE org_id = $1`,
    [orgId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Updates verification status and records timestamp or errors.
 */
export async function updateSmtpVerificationStatus(
  orgId: string,
  status: 'verified' | 'failed',
  lastError: string | null = null
): Promise<void> {
  await query(
    `UPDATE org_smtp_credentials
     SET    status           = $2,
            last_error       = $3,
            last_verified_at = (CASE WHEN $2 = 'verified' THEN NOW() ELSE last_verified_at END),
            updated_at       = NOW()
     WHERE  org_id = $1`,
    [orgId, status, lastError]
  );
}