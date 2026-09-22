// =============================================================================
// src/verticals/books/books.controller.ts
// Administrative Controller for Cloudflare R2 Uploads & Storage Telemetry
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { success } from '../../utils/response';
import { AppError } from '../../utils/error';
import { query } from '../../config/db';
import { generatePresignedUploadUrl } from '../../services/r2.service';
import { getEffectiveCatalogOrgId } from '../../modules/products/products.queries';

function requireOrgId(req: Request): string {
  if (!req.orgId) {
    throw new AppError('Unauthorized access', 401, true, { code: 'UNAUTHORIZED' });
  }
  return req.orgId;
}

const PresignedUploadSchema = z.object({
  filename: z
    .string()
    .min(1, 'Filename is required')
    .max(255, 'Filename cannot exceed 255 characters'),
  format: z.enum(['pdf', 'epub']).default('pdf'),
  contentType: z.string().optional(),
});

/**
 * Generates an authorized presigned PUT upload URL to Cloudflare R2.
 * Resolves to the effective catalog organization so both Sunrise and EbookReads
 * store and share master digital eBook files in the unified asset vault.
 */
export async function getPresignedR2UploadUrlHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const effectiveCatalogOrgId = await getEffectiveCatalogOrgId(orgId);

    const parsed = PresignedUploadSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0]?.message ?? 'Invalid upload payload specification',
        400,
        true,
        { code: 'VALIDATION_FAILED', details: parsed.error.format() }
      );
    }

    const mime =
      parsed.data.contentType ||
      (parsed.data.format === 'pdf' ? 'application/pdf' : 'application/epub+zip');

    const result = await generatePresignedUploadUrl(
      effectiveCatalogOrgId,
      parsed.data.filename,
      mime
    );

    success(res, result, undefined, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Returns digital storage telemetry across the shared catalog for the requesting organization.
 */
export async function getBookstoreStorageStatsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const effectiveCatalogOrgId = await getEffectiveCatalogOrgId(orgId);

    const result = await query<{
      total_bytes: string;
      digital_books_count: string;
    }>(
      `SELECT
         COALESCE(SUM(pf.file_size_bytes), 0)::text AS total_bytes,
         COUNT(DISTINCT pf.product_id)::text AS digital_books_count
       FROM product_formats pf
       INNER JOIN products p ON p.id = pf.product_id
       WHERE (p.org_id = $1 OR p.org_id = $2)
         AND p.deleted_at IS NULL 
         AND (pf.file_url IS NOT NULL OR pf.file_public_id IS NOT NULL)`,
      [orgId, effectiveCatalogOrgId]
    );

    const row = result.rows[0];
    const totalBytes = parseInt(row?.total_bytes || '0', 10);
    const totalMb = Math.round((totalBytes / (1024 * 1024)) * 10) / 10;
    const digitalBooksCount = parseInt(row?.digital_books_count || '0', 10);

    success(res, {
      totalBytes,
      totalMb,
      digitalBooksCount,
    });
  } catch (err) {
    next(err);
  }
}