// =============================================================================
// soko-api/src/modules/products/products.queries.ts
// Product and Category catalog queries with slugification, badges, and smart deletes.
// =============================================================================

import { PoolClient } from "pg";
import { query, pool } from "../../config/db";

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

export interface ProductVariant {
    id: string;
    product_id: string;
    title: string;
    sku: string | null;
    options: Record<string, string>;
    price: string;
    cost_price: string;
    stock: number;
    low_stock_at: number;
    image_url: string | null;
    is_active: boolean;
}

export interface ProductWithImages {
    id: string;
    org_id: string;
    category_id: string;
    category_name: string | null;
    name: string;
    slug: string;
    sku: string | null;
    description: string | null;
    cost_price: string | null;
    price: string;
    compare_at_price: string | null;
    badge: string | null;
    sale_ends_at: Date | null;
    status: "draft" | "published" | "archived";
    created_at: Date;
    updated_at: Date;
    images: Array<{
        image_url: string;
        image_public_id: string;
        sort_order: number;
    }>;
    variants: ProductVariant[];
    formats: ProductFormatRow[];
}

export interface InventoryWithProduct {
    id: string;
    product_id: string;
    product_name: string;
    product_sku: string | null;
    stock: number;
    low_stock_at: number;
    updated_at: Date;
    variants_count: number;
}

export interface ListProductsOptions {
    categoryId?: string;
    searchQuery?: string;
    badge?: string;
    page: number;
    limit: number;
}

export interface ListInventoryOptions {
    lowStockOnly?: boolean;
    page: number;
    limit: number;
}

export interface CategoryRow {
    id: string;
    org_id: string;
    name: string;
    slug: string;
    description: string | null;
    is_featured: boolean;
    sort_order: number;
    created_at: Date;
    product_count?: number;
}

export interface VariantInputData {
    id?: string;
    title: string;
    sku?: string | null;
    options?: Record<string, string>;
    price: number;
    cost_price?: number;
    stock: number;
    low_stock_at?: number;
    image_url?: string | null;
    is_active?: boolean;
}

function slugifyCategory(input: string): string {
    const base = input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return base.length > 0 ? base : 'category';
}

export async function listCategories(orgId: string): Promise<CategoryRow[]> {
    const result = await query<CategoryRow>(
        `SELECT c.id, c.org_id, c.name, c.slug, c.description, c.is_featured, c.sort_order, c.created_at,
                COALESCE((
                    SELECT COUNT(*) 
                    FROM products p 
                    WHERE p.category_id = c.id AND p.deleted_at IS NULL
                ), 0)::int AS product_count
         FROM   categories c
         WHERE  c.org_id = $1 
         ORDER  BY c.is_featured DESC, c.sort_order ASC, c.name ASC`,
        [orgId]
    );
    return result.rows;
}

// In soko/src/modules/products/products.queries.ts
// Replace findOrCreateCategoryByName (lines 144-173):

export async function findOrCreateCategoryByName(
    client: PoolClient,
    orgId: string,
    name: string
): Promise<string> {
    const trimmedName = (name || 'General').trim();
    const slug = slugifyCategory(trimmedName);

    // 1. Check existing category (case-insensitive)
    const checkResult = await client.query<{ id: string }>(
        `SELECT id FROM categories 
         WHERE org_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) 
         LIMIT 1`,
        [orgId, trimmedName]
    );

    if (checkResult.rows.length > 0) {
        return checkResult.rows[0].id;
    }

    // 2. Safe insert with fallback if concurrent insert occurred
    try {
        const insertResult = await client.query<{ id: string }>(
            `INSERT INTO categories (org_id, name, slug) 
             VALUES ($1, $2, $3) 
             RETURNING id`,
            [orgId, trimmedName, slug]
        );
        return insertResult.rows[0].id;
    } catch {
        const fallback = await client.query<{ id: string }>(
            `SELECT id FROM categories 
             WHERE org_id = $1 AND (LOWER(TRIM(name)) = LOWER(TRIM($2)) OR slug = $3) 
             LIMIT 1`,
            [orgId, trimmedName, slug]
        );
        return fallback.rows[0]?.id || checkResult.rows[0]?.id;
    }
}
export async function createCategory(
    orgId: string,
    data: {
        name: string;
        description?: string | null;
        isFeatured?: boolean;
        sortOrder?: number;
    }
): Promise<CategoryRow> {
    const trimmedName = data.name.trim();
    const slug = slugifyCategory(trimmedName);

    const result = await query<CategoryRow>(
        `INSERT INTO categories (org_id, name, slug, description, is_featured, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (org_id, LOWER(TRIM(name))) DO UPDATE SET
             slug = EXCLUDED.slug,
             description = COALESCE(EXCLUDED.description, categories.description),
             is_featured = COALESCE(EXCLUDED.is_featured, categories.is_featured),
             sort_order = COALESCE(EXCLUDED.sort_order, categories.sort_order)
         RETURNING id, org_id, name, slug, description, is_featured, sort_order, created_at`,
        [
            orgId,
            trimmedName,
            slug,
            data.description?.trim() || null,
            data.isFeatured ?? false,
            data.sortOrder ?? 0,
        ]
    );
    return result.rows[0];
}

const PRODUCT_SELECT_FIELDS = `
  p.id, p.org_id, p.category_id, p.name, p.slug, p.sku, p.description,
  p.cost_price::text AS cost_price, p.price::text AS price,
  p.compare_at_price::text AS compare_at_price, p.badge, p.sale_ends_at,
  p.status, p.created_at, p.updated_at,
  c.name AS category_name,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'image_url', pi.image_url,
          'image_public_id', pi.image_public_id,
          'sort_order', pi.sort_order
        ) ORDER BY pi.sort_order ASC
      )
      FROM product_images pi
      WHERE pi.product_id = p.id
    ),
    '[]'::json
  ) AS images,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', pv.id,
          'product_id', pv.product_id,
          'title', pv.title,
          'sku', pv.sku,
          'options', pv.options,
          'price', pv.price::text,
          'cost_price', pv.cost_price::text,
          'stock', pv.stock,
          'low_stock_at', pv.low_stock_at,
          'image_url', pv.image_url,
          'is_active', pv.is_active
        ) ORDER BY pv.created_at ASC
      )
      FROM product_variants pv
      WHERE pv.product_id = p.id AND pv.is_active = TRUE
    ),
    '[]'::json
  ) AS variants,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', pf.id,
          'product_id', pf.product_id,
          'format', pf.format,
          'price', pf.price::text,
          'compare_at_price', pf.compare_at_price::text,
          'file_url', pf.file_url,
          'file_public_id', pf.file_public_id,
          'file_size_bytes', pf.file_size_bytes::text,
          'stock', pf.stock,
          'created_at', pf.created_at,
          'updated_at', pf.updated_at
        ) ORDER BY (
          CASE pf.format
            WHEN 'hardcopy' THEN 1
            WHEN 'pdf' THEN 2
            WHEN 'epub' THEN 3
            ELSE 4
          END
        ) ASC
      )
      FROM product_formats pf
      WHERE pf.product_id = p.id
    ),
    '[]'::json
  ) AS formats
`;

export async function listProducts(
    orgId: string,
    options: ListProductsOptions
): Promise<{ products: ProductWithImages[]; total: number }> {
    const { categoryId, searchQuery, badge, page, limit } = options;
    const offset = (page - 1) * limit;

    const conditions: string[] = ["p.org_id = $1", "p.deleted_at IS NULL"];
    const params: unknown[] = [orgId];
    let paramIndex = 2;

    if (categoryId) {
        conditions.push(`p.category_id = $${paramIndex}`);
        params.push(categoryId);
        paramIndex++;
    }

    if (badge) {
        conditions.push(`p.badge = $${paramIndex}`);
        params.push(badge);
        paramIndex++;
    }

    if (searchQuery && searchQuery.trim().length > 0) {
        conditions.push(
            `(p.name ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`
        );
        params.push(`%${searchQuery.trim()}%`);
        paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) AS count 
         FROM products p 
         WHERE ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    if (total === 0) {
        return { products: [], total: 0 };
    }

    const dataParams = [...params, limit, offset];
    const dataResult = await query<ProductWithImages>(
        `SELECT ${PRODUCT_SELECT_FIELDS}
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE ${whereClause}
         ORDER BY (CASE WHEN p.status = 'archived' THEN 1 ELSE 0 END) ASC, p.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        dataParams
    );

    return { products: dataResult.rows, total };
}

export async function getProductById(
    orgId: string,
    productId: string
): Promise<ProductWithImages | null> {
    const result = await query<ProductWithImages>(
        `SELECT ${PRODUCT_SELECT_FIELDS}
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.org_id = $1 AND p.id = $2 AND p.deleted_at IS NULL`,
        [orgId, productId]
    );
    return result.rows[0] ?? null;
}

export async function updateProduct(
    orgId: string,
    productId: string,
    fields: {
        name?: string;
        category_id?: string;
        price?: number;
        compare_at_price?: number | null;
        cost_price?: number | null;
        sku?: string | null;
        badge?: string | null;
        sale_ends_at?: string | null;
        description?: string | null;
        status?: "draft" | "published" | "archived";
        variants?: VariantInputData[];
        images?: Array<{ image_url: string; image_public_id?: string }>;
    }
): Promise<ProductWithImages | null> {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const setClauses: string[] = [];
        const params: unknown[] = [orgId, productId];
        let paramIndex = 3;

        const { variants, images, sale_ends_at, ...directFields } = fields;

        for (const [key, value] of Object.entries(directFields)) {
            if (value !== undefined) {
                setClauses.push(`${key} = $${paramIndex}`);
                params.push(value);
                paramIndex++;
            }
        }

        if (sale_ends_at !== undefined) {
            setClauses.push(`sale_ends_at = $${paramIndex}`);
            params.push(sale_ends_at ? new Date(sale_ends_at) : null);
            paramIndex++;
        }

        if (setClauses.length > 0) {
            const updateQuery = `
              UPDATE products
              SET ${setClauses.join(", ")}, updated_at = NOW()
              WHERE org_id = $1 AND id = $2 AND deleted_at IS NULL
            `;
            await client.query(updateQuery, params);
        }

        if (images !== undefined) {
            await client.query("DELETE FROM product_images WHERE product_id = $1", [productId]);
            for (let s = 0; s < images.length; s++) {
                if (images[s].image_url) {
                    await insertProductImageTransactional(
                        client,
                        productId,
                        images[s].image_url,
                        images[s].image_public_id || 'cover_img',
                        s
                    );
                }
            }
        }

        if (variants !== undefined) {
            await syncProductVariantsTransactional(client, orgId, productId, variants);
        }

        await client.query("COMMIT");
        return getProductById(orgId, productId);
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

export async function syncProductVariantsTransactional(
    client: PoolClient,
    orgId: string,
    productId: string,
    variants: VariantInputData[]
): Promise<void> {
    if (variants.length === 0) {
        await client.query(
            `UPDATE product_variants SET is_active = FALSE, updated_at = NOW() WHERE org_id = $1 AND product_id = $2`,
            [orgId, productId]
        );
        return;
    }

    const keepVariantIds: string[] = [];

    for (const v of variants) {
        if (v.id) {
            await client.query(
                `UPDATE product_variants
                 SET title        = $4,
                     sku          = $5,
                     options      = $6,
                     price        = $7,
                     cost_price   = $8,
                     stock        = $9,
                     low_stock_at = $10,
                     image_url    = $11,
                     is_active    = $12,
                     updated_at   = NOW()
                 WHERE id = $1 AND org_id = $2 AND product_id = $3`,
                [
                    v.id,
                    orgId,
                    productId,
                    v.title.trim(),
                    v.sku?.trim() || null,
                    JSON.stringify(v.options || {}),
                    v.price,
                    v.cost_price ?? 0,
                    v.stock,
                    v.low_stock_at ?? 5,
                    v.image_url || null,
                    v.is_active ?? true
                ]
            );
            keepVariantIds.push(v.id);
        } else {
            const inserted = await client.query<{ id: string }>(
                `INSERT INTO product_variants (
                   org_id, product_id, title, sku, options, price,
                   cost_price, stock, low_stock_at, image_url, is_active
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 RETURNING id`,
                [
                    orgId,
                    productId,
                    v.title.trim(),
                    v.sku?.trim() || null,
                    JSON.stringify(v.options || {}),
                    v.price,
                    v.cost_price ?? 0,
                    v.stock,
                    v.low_stock_at ?? 5,
                    v.image_url || null,
                    v.is_active ?? true
                ]
            );
            keepVariantIds.push(inserted.rows[0].id);
        }
    }

    if (keepVariantIds.length > 0) {
        await client.query(
            `UPDATE product_variants
             SET is_active = FALSE, updated_at = NOW()
             WHERE org_id = $1 AND product_id = $2 AND NOT (id = ANY($3::uuid[]))`,
            [orgId, productId, keepVariantIds]
        );
    }
}

export async function archiveProduct(
    orgId: string,
    productId: string
): Promise<boolean> {
    const result = await query(
        `UPDATE products 
         SET status = 'archived', updated_at = NOW() 
         WHERE org_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [orgId, productId]
    );
    return result.rowCount !== null && result.rowCount > 0;
}

export async function unarchiveProduct(
    orgId: string,
    productId: string
): Promise<boolean> {
    const result = await query(
        `UPDATE products 
         SET status = 'draft', updated_at = NOW() 
         WHERE org_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [orgId, productId]
    );
    return result.rowCount !== null && result.rowCount > 0;
}

export async function getProductOrderCount(
    client: PoolClient,
    orgId: string,
    productId: string
): Promise<number> {
    const result = await client.query<{ count: string }>(
        `SELECT COUNT(oi.id)::text AS count
         FROM order_items oi
         INNER JOIN orders o ON o.id = oi.order_id
         WHERE o.org_id = $1 AND (
           oi.product_id = $2 OR 
           oi.format_id IN (SELECT id FROM product_formats WHERE product_id = $2)
         )`,
        [orgId, productId]
    );
    return parseInt(result.rows[0]?.count || '0', 10);
}

export async function softDeleteProductTransactional(
    client: PoolClient,
    orgId: string,
    productId: string
): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    await client.query(
        `UPDATE products
         SET deleted_at = NOW(),
             status     = 'archived',
             slug       = slug || '-deleted-' || $3,
             updated_at = NOW()
         WHERE org_id = $1 AND id = $2`,
        [orgId, productId, timestamp]
    );
}

export async function hardDeleteProductTransactional(
    client: PoolClient,
    orgId: string,
    productId: string
): Promise<boolean> {
    const result = await client.query(
        `DELETE FROM products 
         WHERE org_id = $1 AND id = $2`,
        [orgId, productId]
    );
    return result.rowCount !== null && result.rowCount > 0;
}

export async function deleteProductPermanently(
    orgId: string,
    productId: string
): Promise<boolean> {
    const result = await query(
        `DELETE FROM products 
         WHERE org_id = $1 AND id = $2`,
        [orgId, productId]
    );
    return result.rowCount !== null && result.rowCount > 0;
}

export async function setProductStatus(
    orgId: string,
    productId: string,
    status: "draft" | "published" | "archived"
): Promise<ProductWithImages | null> {
    await query(
        `UPDATE products 
         SET status = $3, updated_at = NOW() 
         WHERE org_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [orgId, productId, status]
    );
    return getProductById(orgId, productId);
}

export async function listInventory(
    orgId: string,
    options: ListInventoryOptions
): Promise<{ inventory: InventoryWithProduct[]; total: number }> {
    const { lowStockOnly, page, limit } = options;
    const offset = (page - 1) * limit;

    const conditions: string[] = ["p.org_id = $1", "p.deleted_at IS NULL"];
    const params: unknown[] = [orgId];
    let paramIndex = 2;

    if (lowStockOnly) {
        conditions.push("i.stock <= i.low_stock_at");
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) AS count 
         FROM inventory i
         INNER JOIN products p ON p.id = i.product_id
         WHERE ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    if (total === 0) {
        return { inventory: [], total: 0 };
    }

    const dataParams = [...params, limit, offset];
    const dataResult = await query<InventoryWithProduct>(
        `SELECT i.id, i.product_id, i.stock, i.low_stock_at, i.updated_at,
                p.name AS product_name, p.sku AS product_sku,
                COALESCE((SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = TRUE), 0)::int AS variants_count
         FROM inventory i
         INNER JOIN products p ON p.id = i.product_id
         WHERE ${whereClause}
         ORDER BY i.stock ASC, p.name ASC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        dataParams
    );

    return { inventory: dataResult.rows, total };
}

export async function updateInventoryStock(
    orgId: string,
    productId: string,
    stock: number
): Promise<InventoryWithProduct | null> {
    const result = await query<InventoryWithProduct>(
        `UPDATE inventory i
         SET stock = $3, updated_at = NOW()
         FROM products p
         WHERE p.id = i.product_id AND p.org_id = $1 AND p.id = $2 AND p.deleted_at IS NULL
         RETURNING i.id, i.product_id, i.stock, i.low_stock_at, i.updated_at,
                   p.name AS product_name, p.sku AS product_sku,
                   0::int AS variants_count`,
        [orgId, productId, stock]
    );
    return result.rows[0] ?? null;
}

export async function checkCategoryExists(
    client: PoolClient,
    orgId: string,
    categoryId: string
): Promise<boolean> {
    const result = await client.query(
        "SELECT 1 FROM categories WHERE id = $1 AND org_id = $2",
        [categoryId, orgId]
    );
    return result.rowCount !== null && result.rowCount > 0;
}

export async function checkSlugExists(
    client: PoolClient,
    orgId: string,
    slug: string
): Promise<boolean> {
    const result = await client.query(
        "SELECT 1 FROM products WHERE org_id = $1 AND slug = $2 AND deleted_at IS NULL",
        [orgId, slug]
    );
    return result.rowCount !== null && result.rowCount > 0;
}

export async function insertProductTransactional(
    client: PoolClient,
    orgId: string,
    data: {
        category_id: string;
        name: string;
        slug: string;
        sku: string | null;
        description: string | null;
        cost_price: number | null;
        price: number;
        compare_at_price?: number | null;
        badge?: string | null;
        sale_ends_at?: string | null;
        status: "draft" | "published" | "archived";
    }
): Promise<string> {
    const result = await client.query<{ id: string }>(
        `INSERT INTO products 
           (org_id, category_id, name, slug, sku, description, cost_price, price, compare_at_price, badge, sale_ends_at, status)
         VALUES 
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
            orgId,
            data.category_id,
            data.name,
            data.slug,
            data.sku,
            data.description,
            data.cost_price,
            data.price,
            data.compare_at_price ?? null,
            data.badge ?? null,
            data.sale_ends_at ? new Date(data.sale_ends_at) : null,
            data.status
        ]
    );
    return result.rows[0].id;
}

export async function insertInventoryTransactional(
    client: PoolClient,
    productId: string,
    stock: number
): Promise<void> {
    await client.query(
        `INSERT INTO inventory (product_id, stock, low_stock_at)
         VALUES ($1, $2, 5)`,
        [productId, stock]
    );
}

export async function insertProductImageTransactional(
    client: PoolClient,
    productId: string,
    imageUrl: string,
    imagePublicId: string,
    sortOrder: number
): Promise<void> {
    await client.query(
        `INSERT INTO product_images (product_id, image_url, image_public_id, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [productId, imageUrl, imagePublicId, sortOrder]
    );
}

export async function insertProductVariantTransactional(
    client: PoolClient,
    orgId: string,
    productId: string,
    variant: VariantInputData
): Promise<string> {
    const result = await client.query<{ id: string }>(
        `INSERT INTO product_variants (
           org_id, product_id, title, sku, options, price,
           cost_price, stock, low_stock_at, image_url, is_active
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
            orgId,
            productId,
            variant.title.trim(),
            variant.sku?.trim() || null,
            JSON.stringify(variant.options || {}),
            variant.price,
            variant.cost_price ?? 0,
            variant.stock,
            variant.low_stock_at ?? 5,
            variant.image_url || null,
            variant.is_active ?? true
        ]
    );
    return result.rows[0].id;
}