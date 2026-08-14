// =============================================================================
// src/modules/products/products.queries.ts
// =============================================================================

import { PoolClient } from "pg";
import { query, pool } from "../../config/db";

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
    status: "draft" | "published" | "archived";
    created_at: Date;
    updated_at: Date;
    images: Array<{
        image_url: string;
        image_public_id: string;
        sort_order: number;
    }>;
}

export interface InventoryWithProduct {
    id: string;
    product_id: string;
    product_name: string;
    product_sku: string | null;
    stock: number;
    low_stock_at: number;
    updated_at: Date;
}

export interface ListProductsOptions {
    categoryId?: string;
    searchQuery?: string;
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
    name: string;
}

export async function listCategories(orgId: string): Promise<CategoryRow[]> {
    const result = await query<CategoryRow>(
        `SELECT id, name 
     FROM   categories 
     WHERE  org_id = $1 
     ORDER  BY name ASC`,
        [orgId]
    );
    return result.rows;
}

export async function findOrCreateCategoryByName(
    client: PoolClient,
    orgId: string,
    name: string
): Promise<string> {
    const trimmedName = name.trim();

    const checkResult = await client.query<{ id: string }>(
        `SELECT id FROM categories WHERE org_id = $1 AND name = $2`,
        [orgId, trimmedName]
    );

    if (checkResult.rows.length > 0) {
        return checkResult.rows[0].id;
    }

    const insertResult = await client.query<{ id: string }>(
        `INSERT INTO categories (org_id, name) 
     VALUES ($1, $2) 
     ON CONFLICT (org_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
        [orgId, trimmedName]
    );

    return insertResult.rows[0].id;
}

export async function createCategory(
    orgId: string,
    name: string
): Promise<CategoryRow> {
    const result = await query<CategoryRow>(
        `INSERT INTO categories (org_id, name)
     VALUES ($1, $2)
     ON CONFLICT (org_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name`,
        [orgId, name.trim()]
    );
    return result.rows[0];
}

const PRODUCT_SELECT_FIELDS = `
  p.id, p.org_id, p.category_id, p.name, p.slug, p.sku, p.description,
  p.cost_price::text AS cost_price, p.price::text AS price, p.status,
  p.created_at, p.updated_at,
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
  ) AS images
`;

export async function listProducts(
    orgId: string,
    options: ListProductsOptions
): Promise<{ products: ProductWithImages[]; total: number }> {
    const { categoryId, searchQuery, page, limit } = options;
    const offset = (page - 1) * limit;

    const conditions: string[] = ["p.org_id = $1", "p.deleted_at IS NULL"];
    const params: unknown[] = [orgId];
    let paramIndex = 2;

    if (categoryId) {
        conditions.push(`p.category_id = $${paramIndex}`);
        params.push(categoryId);
        paramIndex++;
    }

    if (searchQuery && searchQuery.trim().length > 0) {
        conditions.push(
            `(p.name ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex})`
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
    // Archived products are prioritized to the bottom of the list
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
        cost_price?: number | null;
        sku?: string | null;
        description?: string | null;
        status?: "draft" | "published" | "archived";
    }
): Promise<ProductWithImages | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [orgId, productId];
    let paramIndex = 3;

    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) {
            setClauses.push(`${key} = $${paramIndex}`);
            params.push(value);
            paramIndex++;
        }
    }

    if (setClauses.length === 0) {
        return getProductById(orgId, productId);
    }

    const updateQuery = `
    UPDATE products
    SET ${setClauses.join(", ")}, updated_at = NOW()
    WHERE org_id = $1 AND id = $2 AND deleted_at IS NULL
  `;
    await query(updateQuery, params);

    return getProductById(orgId, productId);
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

export async function deleteProductPermanently(
    orgId: string,
    productId: string
): Promise<boolean> {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. Verify existence in org
        const check = await client.query(
            "SELECT id FROM products WHERE id = $1 AND org_id = $2",
            [productId, orgId]
        );
        if (check.rows.length === 0) {
            await client.query("ROLLBACK");
            return false;
        }

        // 2. Clear related images and inventory
        await client.query("DELETE FROM product_images WHERE product_id = $1", [
            productId
        ]);
        await client.query("DELETE FROM inventory WHERE product_id = $1", [
            productId
        ]);

        // 3. Clear or nullify historic order item references (preserving order snapshots)
        await client.query(
            "UPDATE order_items SET product_id = NULL WHERE product_id = $1",
            [productId]
        );

        // 4. Permanently hard delete product
        const deleteRes = await client.query(
            "DELETE FROM products WHERE id = $1 AND org_id = $2",
            [productId, orgId]
        );

        await client.query("COMMIT");
        return deleteRes.rowCount !== null && deleteRes.rowCount > 0;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
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
            p.name AS product_name, p.sku AS product_sku
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
               p.name AS product_name, p.sku AS product_sku`,
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
        status: "draft" | "published" | "archived";
    }
): Promise<string> {
    const result = await client.query<{ id: string }>(
        `INSERT INTO products 
       (org_id, category_id, name, slug, sku, description, cost_price, price, status)
     VALUES 
       ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
