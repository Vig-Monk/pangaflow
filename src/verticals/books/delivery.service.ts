// =============================================================================
// soko-api/src/verticals/books/delivery.service.ts
// Digital fulfillment engine for books: snapshots assets and dispatches emails.
// =============================================================================

import crypto from 'crypto';
import { PoolClient } from 'pg';
import { pool } from '../../config/db';
import { sendOrderConfirmationEmail } from '../../services/email.service';
import pino from 'pino';

const logger = pino();

export interface DigitalFulfillmentItem {
  order_item_id: string;
  format_id: string | null;
  file_url: string;
  file_public_id: string | null;
  file_size_bytes: string | null;
  format: 'pdf' | 'epub';
  book_title: string;
}

export function generateDownloadToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Fulfills all digital items for an order:
 * 1. Snapshots book title, format, and R2 key into digital_downloads.
 * 2. Sets 90-day TTL and 15 download attempts.
 * 3. Triggers out-of-band email dispatch via Nodemailer asynchronously.
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

    // 1. Resolve digital line items with format file links
    const itemsRes = await runner.query<DigitalFulfillmentItem>(
      `SELECT oi.id AS order_item_id,
              oi.format_id,
              COALESCE(pf.file_url, pf.file_public_id) AS file_url,
              pf.file_public_id,
              pf.file_size_bytes::text AS file_size_bytes,
              COALESCE(pf.format, 'pdf') AS format,
              p.name AS book_title
       FROM order_items oi
       LEFT JOIN product_formats pf ON pf.id = oi.format_id
       LEFT JOIN products p ON p.id = pf.product_id OR p.id = oi.product_id
       WHERE oi.order_id = $1
         AND (oi.delivery_method = 'digital' OR pf.format IN ('pdf', 'epub'))
         AND (pf.file_url IS NOT NULL OR pf.file_public_id IS NOT NULL)`,
      [orderId]
    );

    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90-Day Access Window
    const generatedTokens: Array<{ bookTitle: string; format: string; token: string }> = [];

    for (const item of itemsRes.rows) {
      const existing = await runner.query<{ id: string; download_token: string }>(
        `SELECT id, download_token FROM digital_downloads WHERE order_item_id = $1`,
        [item.order_item_id]
      );

      if (existing.rows.length === 0) {
        const token = generateDownloadToken();

        await runner.query(
          `INSERT INTO digital_downloads (
             order_item_id, format_id, download_token, max_downloads, download_count,
             expires_at, book_title, format, file_url, file_public_id, file_size_bytes
           )
           VALUES ($1, $2, $3, 15, 0, $4, $5, $6, $7, $8, $9)`,
          [
            item.order_item_id,
            item.format_id,
            token,
            expiresAt,
            item.book_title,
            item.format,
            item.file_url,
            item.file_public_id,
            item.file_size_bytes ? parseInt(item.file_size_bytes, 10) : null,
          ]
        );

        generatedTokens.push({
          bookTitle: item.book_title,
          format: item.format,
          token,
        });
      } else {
        generatedTokens.push({
          bookTitle: item.book_title,
          format: item.format,
          token: existing.rows[0].download_token,
        });
      }
    }

    if (shouldManageTxn) {
      await runner.query('COMMIT');
    }

    // 2. Asynchronously Dispatch Out-of-Band Email (Non-blocking)
    setImmediate(async () => {
      try {
        const orderInfo = await pool.query<{
          id: string;
          customer_name: string;
          customer_email: string | null;
          customer_phone: string;
          total: string;
          delivery_type: 'delivery' | 'pickup';
          delivery_confirmation_code: string | null;
          delivery_location: string;
        }>(
          `SELECT id, customer_name, customer_email, customer_phone,
                  total::text AS total, delivery_type, delivery_confirmation_code, delivery_location
           FROM orders
           WHERE id = $1`,
          [orderId]
        );

        const order = orderInfo.rows[0];
        if (order && order.customer_email && order.customer_email.includes('@')) {
          await sendOrderConfirmationEmail({
            toEmail: order.customer_email,
            customerName: order.customer_name,
            customerPhone: order.customer_phone,
            orderId: order.id,
            total: parseFloat(order.total),
            downloads: generatedTokens,
            deliveryType: order.delivery_type,
            deliveryConfirmationCode: order.delivery_confirmation_code,
            deliveryLocation: order.delivery_location,
          });
        }
      } catch (emailErr: any) {
        logger.error({ err: emailErr.message, orderId }, 'Background email trigger error');
      }
    });
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

/**
 * Sweeps and retroactively fulfills orders when an admin uploads a file to an existing format.
 */
export async function reconcilePendingDownloadsForFormat(formatId: string): Promise<number> {
  const client = await pool.connect();
  try {
    const unfulfilled = await client.query<{ order_id: string }>(
      `SELECT DISTINCT oi.order_id
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN digital_downloads dd ON dd.order_item_id = oi.id
       WHERE oi.format_id = $1
         AND o.payment_status = 'paid'
         AND dd.id IS NULL`,
      [formatId]
    );

    let fulfilledCount = 0;
    for (const row of unfulfilled.rows) {
      await fulfillDigitalItems(row.order_id, client);
      fulfilledCount++;
    }

    return fulfilledCount;
  } finally {
    client.release();
  }
}