// =============================================================================
// soko-api/src/verticals/books/download.controller.ts
// Public token-based download controller reading from resilient snapshots.
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

interface DownloadSnapshotRow {
  id: string;
  order_item_id: string;
  format_id: string | null;
  download_token: string;
  max_downloads: number;
  download_count: number;
  expires_at: Date;
  last_download_at: Date | null;
  file_url: string | null;
  file_public_id: string | null;
  file_size_bytes: string | null;
  format: 'pdf' | 'epub';
  book_title: string;
}

/**
 * Normalizes Google Drive sharing links to direct download streams:
 * e.g., https://drive.google.com/file/d/FILE_ID/view?usp=sharing -> https://drive.google.com/uc?export=download&id=FILE_ID
 */
function normalizeGoogleDriveUrl(url: string): string {
  const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fileIdMatch && fileIdMatch[1]) {
    return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
  }
  return url;
}

async function generateSignedDeliveryUrl(row: DownloadSnapshotRow): Promise<string> {
  const safeTitle = (row.book_title || 'book').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeTitle}.${row.format}`;

  // 1. Resolve Cloudflare R2 Key
  // An R2 key is either row.file_public_id or row.file_url starting with "ebooks/"
  const rawKey = row.file_public_id || row.file_url;
  const isR2Key = rawKey && (rawKey.startsWith('ebooks/') || (!rawKey.startsWith('http://') && !rawKey.startsWith('https://') && rawKey.includes('/')));

  if (isR2Key && rawKey.startsWith('ebooks/')) {
    try {
      return await generatePresignedDownloadUrl(rawKey, fileName, 3600);
    } catch (err) {
      console.error('Failed to sign R2 download URL:', err);
    }
  }

  // 2. Direct External Storage / Google Drive Link
  const targetUrl = row.file_url || row.file_public_id;
  if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
    // If it's a Google Drive link, convert to direct download stream
    if (targetUrl.includes('drive.google.com')) {
      return normalizeGoogleDriveUrl(targetUrl);
    }
    // Any other direct HTTP/HTTPS file host
    return targetUrl;
  }

  // 3. Genuine Cloudinary Media Fallback (ONLY if it's not a URL and not an R2 key)
  if (row.file_public_id && !row.file_public_id.startsWith('http') && !row.file_public_id.startsWith('ebooks/')) {
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

  return targetUrl || '#';
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

    // Direct snapshot resolution
    const result = await query<DownloadSnapshotRow>(
      `SELECT dd.id,
              dd.order_item_id,
              dd.format_id,
              dd.download_token,
              dd.max_downloads,
              dd.download_count,
              dd.expires_at,
              dd.last_download_at,
              COALESCE(dd.file_url, pf.file_url) AS file_url,
              COALESCE(dd.file_public_id, pf.file_public_id) AS file_public_id,
              COALESCE(dd.file_size_bytes::text, pf.file_size_bytes::text) AS file_size_bytes,
              COALESCE(dd.format, pf.format, 'pdf') AS format,
              COALESCE(dd.book_title, p.name, 'Book') AS book_title
       FROM digital_downloads dd
       LEFT JOIN product_formats pf ON pf.id = dd.format_id
       LEFT JOIN products p ON p.id = pf.product_id
       WHERE dd.download_token = $1`,
      [token.trim()]
    );

    const record = result.rows[0];

    if (!record) {
      throw new AppError('Download link is invalid or does not exist', 404);
    }

    // 1. Expiration Verification (90 Days)
    if (new Date(record.expires_at).getTime() < Date.now()) {
      throw new AppError(
        'This download link has expired. Please verify your phone number on your order page to refresh access.',
        410
      );
    }

    // 2. Download Limit Verification (15 Max)
    if (record.download_count >= record.max_downloads) {
      throw new AppError(
        `Download limit reached (${record.max_downloads} downloads used). Contact concierge if you need a reset.`,
        410
      );
    }

    // 3. Prevent Premature Quota Burn on HEAD or Mobile Range Probes
    const isHeadRequest = req.method === 'HEAD';
    const now = Date.now();
    const lastDownloadedEpoch = record.last_download_at ? new Date(record.last_download_at).getTime() : 0;
    const isDuplicateRetry = (now - lastDownloadedEpoch) < 60_000;

    if (!isHeadRequest && !isDuplicateRetry) {
      await query(
        `UPDATE digital_downloads
         SET download_count = download_count + 1,
             last_download_at = NOW()
         WHERE id = $1 AND download_count < max_downloads`,
        [record.id]
      );
    }

    const signedUrl = await generateSignedDeliveryUrl(record);
    const remainingDownloads = Math.max(0, record.max_downloads - record.download_count);
    const safeTitle = (record.book_title || 'book').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${safeTitle}.${record.format}`;

    if (req.query.redirect === 'true') {
      res.redirect(signedUrl);
      return;
    }

    success(res, {
      bookTitle: record.book_title,
      format: record.format,
      fileName,
      downloadUrl: signedUrl,
      downloadCount: record.download_count,
      maxDownloads: record.max_downloads,
      remainingDownloads,
      expiresAt: record.expires_at.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}