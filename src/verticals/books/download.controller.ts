// =============================================================================
// soko-api/src/verticals/books/download.controller.ts
// Public token-based download controller for digital book files.
// Issues signed delivery URLs using Cloudflare R2 with fallback to Cloudinary.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { query } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../utils/error';
import { success } from '../../utils/response';
import { generatePresignedDownloadUrl } from '../../services/r2.service';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

interface DownloadLookupRow {
  id: string;
  order_item_id: string;
  format_id: string;
  download_token: string;
  max_downloads: number;
  download_count: number;
  expires_at: Date;
  file_url: string | null;
  file_public_id: string | null;
  file_size_bytes: string | null;
  format: 'pdf' | 'epub';
  book_title: string;
}

async function generateSignedDeliveryUrl(row: DownloadLookupRow): Promise<string> {
  const safeTitle = row.book_title.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeTitle}.${row.format}`;

  // 1. Cloudflare R2 Private Bucket (Key stored in file_public_id or file_url)
  const r2Key = row.file_public_id || (row.file_url?.startsWith('ebooks/') ? row.file_url : null);
  if (r2Key && r2Key.startsWith('ebooks/')) {
    try {
      return await generatePresignedDownloadUrl(r2Key, fileName, 3600);
    } catch (err) {
      console.error('Failed to sign R2 download URL:', err);
    }
  }

  // 2. Cloudinary Media fallback
  if (row.file_public_id && !row.file_public_id.startsWith('ebooks/')) {
    const expiresAtEpoch = Math.floor(Date.now() / 1000) + 3600;
    try {
      return cloudinary.utils.private_download_url(
        row.file_public_id,
        row.format,
        {
          resource_type: 'raw',
          type: 'authenticated',
          expires_at: expiresAtEpoch,
          attachment: true,
        }
      );
    } catch {
      return cloudinary.url(row.file_public_id, {
        resource_type: 'raw',
        sign_url: true,
        type: 'upload',
        expires_at: expiresAtEpoch,
      });
    }
  }

  return row.file_url || '#';
}

export async function downloadBookHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token } = req.params;

    if (!token || token.trim().length < 16) {
      throw new AppError('Invalid download token', 400);
    }

    const result = await query<DownloadLookupRow>(
      `SELECT dd.id,
              dd.order_item_id,
              dd.format_id,
              dd.download_token,
              dd.max_downloads,
              dd.download_count,
              dd.expires_at,
              pf.file_url,
              pf.file_public_id,
              pf.file_size_bytes::text AS file_size_bytes,
              pf.format,
              p.name AS book_title
       FROM digital_downloads dd
       INNER JOIN product_formats pf ON pf.id = dd.format_id
       INNER JOIN products p ON p.id = pf.product_id
       WHERE dd.download_token = $1`,
      [token.trim()]
    );

    const record = result.rows[0];

    if (!record) {
      throw new AppError('Download link is invalid or does not exist', 404);
    }

    // 1. Expiration Verification (7 Days TTL)
    if (new Date(record.expires_at).getTime() < Date.now()) {
      throw new AppError(
        'This download link has expired. Digital access is valid for 7 days from purchase.',
        410
      );
    }

    // 2. Download Limit Verification (5 Max)
    if (record.download_count >= record.max_downloads) {
      throw new AppError(
        `Download limit reached. You have already downloaded this book ${record.max_downloads} times.`,
        410
      );
    }

    // 3. Atomically increment download counter
    await query(
      `UPDATE digital_downloads
       SET download_count = download_count + 1
       WHERE id = $1 AND download_count < max_downloads`,
      [record.id]
    );

    const signedUrl = await generateSignedDeliveryUrl(record);
    const remainingDownloads = Math.max(0, record.max_downloads - (record.download_count + 1));
    const safeTitle = record.book_title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${safeTitle}.${record.format}`;

    // Direct 302 redirect to Cloudflare R2 presigned download stream
    if (req.query.redirect === 'true') {
      res.redirect(signedUrl);
      return;
    }

    success(res, {
      bookTitle: record.book_title,
      format: record.format,
      fileName,
      downloadUrl: signedUrl,
      downloadCount: record.download_count + 1,
      maxDownloads: record.max_downloads,
      remainingDownloads,
      expiresAt: record.expires_at.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}