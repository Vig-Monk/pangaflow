// =============================================================================
// src/modules/mpesa-credentials/mpesa-credentials.queries.ts
// Database queries for org_mpesa_credentials with encryption boundaries.
// =============================================================================

import { query } from "../../config/db";
import { encrypt, decrypt } from "../../utils/crypto";

export interface OrgMpesaCredentialsRow {
    id: string;
    org_id: string;
    till_type: "till" | "paybill";
    shortcode: string;
    store_number: string | null;
    consumer_key_enc: string;
    consumer_secret_enc: string;
    passkey_enc: string;
    environment: "sandbox" | "production";
    status: "pending" | "verified" | "failed";
    last_verified_at: Date | null;
    last_error: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface DecryptedMpesaCredentials {
    tillType: "till" | "paybill";
    shortcode: string;
    storeNumber: string | null;
    consumerKey: string;
    consumerSecret: string;
    passkey: string;
    environment: "sandbox" | "production";
    status: "pending" | "verified" | "failed";
}

export interface UpsertMpesaCredentialsInput {
    tillType: "till" | "paybill";
    shortcode: string;
    storeNumber?: string | null;
    consumerKey: string;
    consumerSecret: string;
    passkey: string;
    environment: "sandbox" | "production";
}

/**
 * Retrieves the raw database row containing encrypted secret strings.
 * Internal to backend queries only.
 */
export async function getCredentialsRowByOrgId(
    orgId: string
): Promise<OrgMpesaCredentialsRow | null> {
    const result = await query<OrgMpesaCredentialsRow>(
        `SELECT id, org_id, till_type, shortcode, store_number,
            consumer_key_enc, consumer_secret_enc, passkey_enc,
            environment, status, last_verified_at, last_error,
            created_at, updated_at
     FROM   org_mpesa_credentials
     WHERE  org_id = $1`,
        [orgId]
    );
    return result.rows[0] ?? null;
}

/**
 * Decrypts stored credentials for backend consumption (used by Daraja service calls).
 * Never exposed directly to HTTP responses.
 */
export async function getDecryptedCredentials(
    orgId: string
): Promise<DecryptedMpesaCredentials | null> {
    const row = await getCredentialsRowByOrgId(orgId);
    if (!row) return null;

    return {
        tillType: row.till_type,
        shortcode: row.shortcode,
        storeNumber: row.store_number,
        consumerKey: decrypt(row.consumer_key_enc),
        consumerSecret: decrypt(row.consumer_secret_enc),
        passkey: decrypt(row.passkey_enc),
        environment: row.environment,
        status: row.status
    };
}

/**
 * Encrypts sensitive keys with AES-256-GCM and upserts into org_mpesa_credentials.
 * Resets status to 'pending' on any credential update.
 */
export async function upsertCredentials(
    orgId: string,
    input: UpsertMpesaCredentialsInput
): Promise<OrgMpesaCredentialsRow> {
    const consumerKeyEnc = encrypt(input.consumerKey);
    const consumerSecretEnc = encrypt(input.consumerSecret);
    const passkeyEnc = encrypt(input.passkey);

    const result = await query<OrgMpesaCredentialsRow>(
        `INSERT INTO org_mpesa_credentials (
       org_id, till_type, shortcode, store_number,
       consumer_key_enc, consumer_secret_enc, passkey_enc,
       environment, status, last_error
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NULL)
     ON CONFLICT (org_id) DO UPDATE SET
       till_type           = EXCLUDED.till_type,
       shortcode           = EXCLUDED.shortcode,
       store_number        = EXCLUDED.store_number,
       consumer_key_enc    = EXCLUDED.consumer_key_enc,
       consumer_secret_enc = EXCLUDED.consumer_secret_enc,
       passkey_enc         = EXCLUDED.passkey_enc,
       environment         = EXCLUDED.environment,
       status              = 'pending',
       last_error          = NULL,
       updated_at          = NOW()
     RETURNING id, org_id, till_type, shortcode, store_number,
               consumer_key_enc, consumer_secret_enc, passkey_enc,
               environment, status, last_verified_at, last_error,
               created_at, updated_at`,
        [
            orgId,
            input.tillType,
            input.shortcode.trim(),
            input.storeNumber?.trim() || null,
            consumerKeyEnc,
            consumerSecretEnc,
            passkeyEnc,
            input.environment
        ]
    );

    return result.rows[0];
}

/**
 * Removes the organization's M-Pesa credentials record.
 */
export async function deleteCredentials(orgId: string): Promise<boolean> {
    const result = await query(
        `DELETE FROM org_mpesa_credentials WHERE org_id = $1`,
        [orgId]
    );
    return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Updates verification status and records errors or verification timestamps.
 */
export async function updateVerificationStatus(
    orgId: string,
    status: "verified" | "failed",
    lastError: string | null = null
): Promise<void> {
    await query(
        `UPDATE org_mpesa_credentials
     SET    status = $2,
            last_error = $3,
            last_verified_at = (CASE WHEN $2 = 'verified' THEN NOW() ELSE last_verified_at END),
            updated_at = NOW()
     WHERE  org_id = $1`,
        [orgId, status, lastError]
    );
}
