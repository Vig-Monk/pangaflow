// =============================================================================
// src/verticals/books/delivery.service.ts
// Digital fulfillment engine for books. Generates high-entropy download tokens
// for all digital line items upon verified order payment.
// =============================================================================

import crypto from 'crypto';
import { PoolClient } from 'pg';
import { pool } from '../../config/db';

export interface DigitalFulfillmentItem {
  order_item_id: string;
  format_id: string;
  file_url: string;
  file_public_id: string | null;
  format: 'pdf' | 'epub';
  book_title: string;
}

/**
 * Generates an opaque, high-entropy 64-character random token for download authorization.
 */
export function generateDownloadToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Fulfills all digital order items for a paid order:
 * 1. Finds items where delivery_method is 'digital' or format is 'pdf'/'epub'.
 * 2. Generates an expiring token (7-day validity, 5 max downloads).
 * 3. Idempotently creates digital_downloads records without exposing raw file URLs.
 */
export async function fulfillDigitalItems(
  orderId: string,
  existingClient?: PoolClient
): Promise<void> {
  const runner = existingClient || (await pool.connect());
  const shouldManageTxn = !existingClient;

  try {
    if (shouldManageTxn) {
      await runner.query('BEGIN');
    }

    // Find all digital order items linked to valid formats with files
    const itemsRes = await runner.query<DigitalFulfillmentItem>(
      `SELECT oi.id AS order_item_id,
              oi.format_id,
              pf.file_url,
              pf.file_public_id,
              pf.format,
              p.name AS book_title
       FROM order_items oi
       INNER JOIN product_formats pf ON pf.id = oi.format_id
       INNER JOIN products p ON p.id = pf.product_id
       WHERE oi.order_id = $1
         AND (oi.delivery_method = 'digital' OR pf.format IN ('pdf', 'epub'))
         AND pf.file_url IS NOT NULL`,
      [orderId]
    );

    if (itemsRes.rows.length === 0) {
      if (shouldManageTxn) await runner.query('COMMIT');
      return;
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 Days TTL

    for (const item of itemsRes.rows) {
      // Check for existing download token (idempotency guard against duplicate webhooks)
      const existing = await runner.query<{ id: string }>(
        `SELECT id FROM digital_downloads WHERE order_item_id = $1 AND format_id = $2`,
        [item.order_item_id, item.format_id]
      );

      if (existing.rows.length === 0) {
        const token = generateDownloadToken();

        await runner.query(
          `INSERT INTO digital_downloads (
             order_item_id, format_id, download_token, max_downloads, download_count, expires_at
           )
           VALUES ($1, $2, $3, 5, 0, $4)`,
          [item.order_item_id, item.format_id, token, expiresAt]
        );
      }
    }

    if (shouldManageTxn) {
      await runner.query('COMMIT');
    }
  } catch (err) {
    if (shouldManageTxn) {
      await runner.query('ROLLBACK');
    }
    throw err;
  } finally {
    if (shouldManageTxn) {
      runner.release();
    }
  }
}