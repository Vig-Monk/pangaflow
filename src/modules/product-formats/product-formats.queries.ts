// =============================================================================
// soko-api/src/modules/product-formats/product-formats.queries.ts
// Database access layer for product formats with compare_at_price support.
// =============================================================================

import { query } from '../../config/db';

export type FormatType = 'pdf' | 'epub' | 'hardcopy';

export interface ProductFormatRow {
  id: string;
  product_id: string;
  format: FormatType;
  price: string;
  compare_at_price: string | null;
  file_url: string | null;
  file_public_id: string | null;
  file_size_bytes: string | null;
  stock: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateFormatInput {
  format: FormatType;
  price: number;
  compareAtPrice?: number | null;
  fileUrl?: string | null;
  filePublicId?: string | null;
  fileSizeBytes?: number | null;
  stock?: number | null;
}

export interface UpdateFormatInput {
  price?: number;
  compareAtPrice?: number | null;
  fileUrl?: string | null;
  filePublicId?: string | null;
  fileSizeBytes?: number | null;
  stock?: number | null;
}

// Fields for SELECT queries joining product_formats as pf
const FORMAT_SELECT_FIELDS = `
  pf.id,
  pf.product_id,
  pf.format,
  pf.price::text AS price,
  pf.compare_at_price::text AS compare_at_price,
  pf.file_url,
  pf.file_public_id,
  pf.file_size_bytes::text AS file_size_bytes,
  pf.stock,
  pf.created_at,
  pf.updated_at
`;

// Fields for INSERT / UPDATE RETURNING clauses
const FORMAT_RETURNING_FIELDS = `
  id,
  product_id,
  format,
  price::text AS price,
  compare_at_price::text AS compare_at_price,
  file_url,
  file_public_id,
  file_size_bytes::text AS file_size_bytes,
  stock,
  created_at,
  updated_at
`;

export async function checkProductBelongsToOrg(
  orgId: string,
  productId: string
): Promise<boolean> {
  const result = await query<{ id: string }>(
    `SELECT id FROM products WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [productId, orgId]
  );
  return result.rows.length > 0;
}

export async function getFormatsByProductId(
  orgId: string,
  productId: string
): Promise<ProductFormatRow[]> {
  const result = await query<ProductFormatRow>(
    `SELECT ${FORMAT_SELECT_FIELDS}
     FROM product_formats pf
     INNER JOIN products p ON p.id = pf.product_id
     WHERE p.org_id = $1 AND p.id = $2 AND p.deleted_at IS NULL
     ORDER BY (
       CASE pf.format
         WHEN 'hardcopy' THEN 1
         WHEN 'pdf' THEN 2
         WHEN 'epub' THEN 3
         ELSE 4
       END
     ) ASC, pf.created_at ASC`,
    [orgId, productId]
  );
  return result.rows;
}

export async function getFormatById(
  orgId: string,
  productId: string,
  formatId: string
): Promise<ProductFormatRow | null> {
  const result = await query<ProductFormatRow>(
    `SELECT ${FORMAT_SELECT_FIELDS}
     FROM product_formats pf
     INNER JOIN products p ON p.id = pf.product_id
     WHERE p.org_id = $1 AND p.id = $2 AND pf.id = $3 AND p.deleted_at IS NULL`,
    [orgId, productId, formatId]
  );
  return result.rows[0] ?? null;
}

export async function createProductFormat(
  orgId: string,
  productId: string,
  data: CreateFormatInput
): Promise<ProductFormatRow | null> {
  const result = await query<ProductFormatRow>(
    `INSERT INTO product_formats (
       product_id, format, price, compare_at_price, file_url, file_public_id, file_size_bytes, stock
     )
     SELECT p.id, $3, $4, $5, $6, $7, $8, $9
     FROM products p
     WHERE p.id = $2 AND p.org_id = $1 AND p.deleted_at IS NULL
     ON CONFLICT (product_id, format) DO UPDATE SET
       price            = EXCLUDED.price,
       compare_at_price = EXCLUDED.compare_at_price,
       file_url         = EXCLUDED.file_url,
       file_public_id   = EXCLUDED.file_public_id,
       file_size_bytes  = EXCLUDED.file_size_bytes,
       stock            = EXCLUDED.stock,
       updated_at       = NOW()
     RETURNING ${FORMAT_RETURNING_FIELDS}`,
    [
      orgId,
      productId,
      data.format,
      data.price,
      data.compareAtPrice ?? null,
      data.fileUrl ?? null,
      data.filePublicId ?? null,
      data.fileSizeBytes ?? null,
      data.stock ?? null,
    ]
  );
  return result.rows[0] ?? null;
}

export async function updateProductFormat(
  orgId: string,
  productId: string,
  formatId: string,
  data: UpdateFormatInput
): Promise<ProductFormatRow | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [orgId, productId, formatId];
  let paramIdx = 4;

  if (data.price !== undefined) {
    setClauses.push(`price = $${paramIdx}`);
    params.push(data.price);
    paramIdx++;
  }

  if (data.compareAtPrice !== undefined) {
    setClauses.push(`compare_at_price = $${paramIdx}`);
    params.push(data.compareAtPrice);
    paramIdx++;
  }

  if (data.fileUrl !== undefined) {
    setClauses.push(`file_url = $${paramIdx}`);
    params.push(data.fileUrl);
    paramIdx++;
  }

  if (data.filePublicId !== undefined) {
    setClauses.push(`file_public_id = $${paramIdx}`);
    params.push(data.filePublicId);
    paramIdx++;
  }

  if (data.fileSizeBytes !== undefined) {
    setClauses.push(`file_size_bytes = $${paramIdx}`);
    params.push(data.fileSizeBytes);
    paramIdx++;
  }

  if (data.stock !== undefined) {
    setClauses.push(`stock = $${paramIdx}`);
    params.push(data.stock);
    paramIdx++;
  }

  if (setClauses.length === 0) {
    return getFormatById(orgId, productId, formatId);
  }

  setClauses.push('updated_at = NOW()');

  const result = await query<ProductFormatRow>(
    `UPDATE product_formats
     SET ${setClauses.join(', ')}
     FROM products p
     WHERE product_formats.product_id = p.id
       AND p.org_id = $1
       AND p.id = $2
       AND product_formats.id = $3
       AND p.deleted_at IS NULL
     RETURNING ${FORMAT_RETURNING_FIELDS}`,
    params
  );

  return result.rows[0] ?? null;
}

export async function deleteProductFormat(
  orgId: string,
  productId: string,
  formatId: string
): Promise<boolean> {
  const result = await query(
    `DELETE FROM product_formats pf
     USING products p
     WHERE pf.product_id = p.id
       AND p.org_id = $1
       AND p.id = $2
       AND pf.id = $3
       AND p.deleted_at IS NULL`,
    [orgId, productId, formatId]
  );
  return (result.rowCount ?? 0) > 0;
}