// =============================================================================
// soko-api/src/modules/product-formats/product-formats.service.ts
// Business logic & validation for product formats.
// Digital formats (PDF, EPUB) require file_public_id (R2 key) or file_url and forbid stock.
// Physical formats (Hardcopy) require stock and forbid file attachments.
// =============================================================================

import { z } from 'zod';
import { AppError } from '../../utils/error';
import * as formatQueries from './product-formats.queries';
import type { FormatType, ProductFormatRow } from './product-formats.queries';

const UUID_SCHEMA = z.string().uuid('Must be a valid UUID');

export const CreateProductFormatSchema = z
  .object({
    format: z.enum(['pdf', 'epub', 'hardcopy']),
    price: z.number().nonnegative('Price must be greater than or equal to zero'),
    file_url: z
      .string()
      .max(1000)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v)),
    file_public_id: z
      .string()
      .max(500)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v)),
    file_size_bytes: z.number().int().nonnegative().nullable().optional(),
    stock: z.number().int().nonnegative().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.format === 'pdf' || data.format === 'epub') {
      // Must have either an R2 key (file_public_id) or a file reference (file_url)
      if (!data.file_public_id && !data.file_url) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['file_public_id'],
          message: 'A Cloudflare R2 file key or file_url is required for digital formats (pdf, epub)',
        });
      }
      if (data.stock !== undefined && data.stock !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['stock'],
          message: 'stock count is not allowed for digital formats',
        });
      }
    }

    if (data.format === 'hardcopy') {
      if (data.file_url) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['file_url'],
          message: 'file_url is not allowed for hardcopy format',
        });
      }
      if (data.file_public_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['file_public_id'],
          message: 'file_public_id is not allowed for hardcopy format',
        });
      }
    }
  });

export const UpdateProductFormatSchema = z
  .object({
    price: z.number().nonnegative('Price must be greater than or equal to zero').optional(),
    file_url: z
      .string()
      .max(1000)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v)),
    file_public_id: z
      .string()
      .max(500)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v)),
    file_size_bytes: z.number().int().nonnegative().nullable().optional(),
    stock: z.number().int().nonnegative().nullable().optional(),
  });

export interface ProductFormatDto {
  id: string;
  product_id: string;
  format: FormatType;
  price: number;
  file_url: string | null;
  file_public_id: string | null;
  file_size_bytes: number | null;
  stock: number | null;
  created_at: string;
  updated_at: string;
}

export function toFormatDto(row: ProductFormatRow): ProductFormatDto {
  return {
    id: row.id,
    product_id: row.product_id,
    format: row.format,
    price: parseFloat(row.price),
    file_url: row.file_url,
    file_public_id: row.file_public_id,
    file_size_bytes: row.file_size_bytes ? parseInt(row.file_size_bytes, 10) : null,
    stock: row.stock !== null ? row.stock : null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function validateUuid(id: string, name = 'ID'): string {
  const parsed = UUID_SCHEMA.safeParse(id);
  if (!parsed.success) {
    throw new AppError(`Invalid ${name} format`, 400);
  }
  return parsed.data;
}

export async function listFormats(
  orgId: string,
  rawProductId: string
): Promise<ProductFormatDto[]> {
  const productId = validateUuid(rawProductId, 'productId');

  const productExists = await formatQueries.checkProductBelongsToOrg(orgId, productId);
  if (!productExists) {
    throw new AppError('Product not found', 404);
  }

  const rows = await formatQueries.getFormatsByProductId(orgId, productId);
  return rows.map(toFormatDto);
}

export async function getFormat(
  orgId: string,
  rawProductId: string,
  rawFormatId: string
): Promise<ProductFormatDto> {
  const productId = validateUuid(rawProductId, 'productId');
  const formatId = validateUuid(rawFormatId, 'formatId');

  const row = await formatQueries.getFormatById(orgId, productId, formatId);
  if (!row) {
    throw new AppError('Product format not found', 404);
  }

  return toFormatDto(row);
}

export async function createFormat(
  orgId: string,
  rawProductId: string,
  rawBody: unknown
): Promise<ProductFormatDto> {
  const productId = validateUuid(rawProductId, 'productId');

  const productExists = await formatQueries.checkProductBelongsToOrg(orgId, productId);
  if (!productExists) {
    throw new AppError('Product not found', 404);
  }

  const parsed = CreateProductFormatSchema.safeParse(rawBody);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid format payload';
    throw new AppError(message, 400);
  }

  const row = await formatQueries.createProductFormat(orgId, productId, {
    format: parsed.data.format,
    price: parsed.data.price,
    fileUrl: parsed.data.file_url ?? parsed.data.file_public_id,
    filePublicId: parsed.data.file_public_id,
    fileSizeBytes: parsed.data.file_size_bytes,
    stock: parsed.data.stock,
  });

  if (!row) {
    throw new AppError('Failed to create format', 500, false);
  }

  return toFormatDto(row);
}

export async function updateFormat(
  orgId: string,
  rawProductId: string,
  rawFormatId: string,
  rawBody: unknown
): Promise<ProductFormatDto> {
  const productId = validateUuid(rawProductId, 'productId');
  const formatId = validateUuid(rawFormatId, 'formatId');

  const existing = await formatQueries.getFormatById(orgId, productId, formatId);
  if (!existing) {
    throw new AppError('Product format not found', 404);
  }

  const parsed = UpdateProductFormatSchema.safeParse(rawBody);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid format update payload';
    throw new AppError(message, 400);
  }

  const isDigital = existing.format === 'pdf' || existing.format === 'epub';
  const isHardcopy = existing.format === 'hardcopy';

  if (isDigital && parsed.data.stock !== undefined && parsed.data.stock !== null) {
    throw new AppError('Stock count is not allowed for digital formats', 400);
  }

  if (isHardcopy && (parsed.data.file_url || parsed.data.file_public_id)) {
    throw new AppError('File attachments are not allowed for hardcopy format', 400);
  }

  const row = await formatQueries.updateProductFormat(orgId, productId, formatId, {
    price: parsed.data.price,
    fileUrl: parsed.data.file_url ?? parsed.data.file_public_id,
    filePublicId: parsed.data.file_public_id,
    fileSizeBytes: parsed.data.file_size_bytes,
    stock: parsed.data.stock,
  });

  if (!row) {
    throw new AppError('Product format not found', 404);
  }

  return toFormatDto(row);
}

export async function deleteFormat(
  orgId: string,
  rawProductId: string,
  rawFormatId: string
): Promise<void> {
  const productId = validateUuid(rawProductId, 'productId');
  const formatId = validateUuid(rawFormatId, 'formatId');

  const deleted = await formatQueries.deleteProductFormat(orgId, productId, formatId);
  if (!deleted) {
    throw new AppError('Product format not found', 404);
  }
}