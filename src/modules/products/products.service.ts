// =============================================================================
// soko-api/src/modules/products/products.service.ts
// Bulletproof Deletion with Explicit Child Cleanup & Category/Product Management
// =============================================================================

import { z } from "zod";
import { PoolClient } from "pg";
import { v2 as cloudinary } from "cloudinary";
import { pool } from "../../config/db";
import { env } from "../../config/env";
import { AppError } from "../../utils/error";
import * as productsQueries from "./products.queries";

cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET
});

const ALLOWED_BADGES = ['BESTSELLER', 'FLASH_SALE', 'NO1_PICK', 'DEAL_OF_WEEK', 'LIMITED_TIME'] as const;

export const CreateCategorySchema = z.object({
    name: z.string().min(1, "Category name is required").max(100).trim(),
    description: z.string().max(1000).nullable().optional(),
    is_featured: z.boolean().optional(),
    sort_order: z.number().int().optional(),
});

export const VariantInputSchema = z.object({
    id: z.string().uuid().optional(),
    title: z.string().min(1, "Variant title is required").max(200),
    sku: z.string().max(100).nullable().optional(),
    options: z.record(z.string()).default({}),
    price: z.number().nonnegative(),
    cost_price: z.number().nonnegative().default(0),
    stock: z.number().int().nonnegative().default(0),
    low_stock_at: z.number().int().default(5),
    image_url: z.string().url().nullable().optional().or(z.literal("")).transform(v => (v === "" ? null : v)),
    is_active: z.boolean().default(true)
});

export const ProductValidationSchema = z.object({
    name: z.string().min(1, "Name is required").max(200),
    category_id: z.string().uuid().nullable().optional().or(z.literal('')).transform(v => (v === '' ? null : v)),
    price: z.number().positive("Price must be greater than zero"),
    compare_at_price: z.number().positive().nullable().optional(),
    cost_price: z.number().nonnegative().nullable().optional(),
    sku: z.string().max(100).nullable().optional(),
    badge: z.enum(ALLOWED_BADGES).nullable().optional(),
    sale_ends_at: z.string().datetime().nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    stock: z.number().int().nonnegative().default(0),
    images: z.array(z.object({
        image_url: z.string().url(),
        image_public_id: z.string().min(1)
    })).optional(),
    variants: z.array(VariantInputSchema).optional(),
    publish: z.boolean().optional()
});

export const BulkCreateSchema = z.object({
    products: z.array(ProductValidationSchema).min(1).max(10)
});

export const BulkDeleteProductsSchema = z.object({
    productIds: z.array(z.string().uuid()).min(1, "At least one product must be selected"),
});

export const ListProductsQuerySchema = z.object({
    category_id: z.string().uuid().optional(),
    badge: z.enum(ALLOWED_BADGES).optional(),
    q: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50)
});

export const UpdateProductSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    category_id: z
        .string()
        .uuid()
        .nullable()
        .optional()
        .or(z.literal(''))
        .transform((v): string | undefined => (v ? v : undefined)),
    price: z.number().positive().optional(),
    compare_at_price: z.number().positive().nullable().optional(),
    cost_price: z.number().nonnegative().nullable().optional(),
    sku: z.string().max(100).nullable().optional(),
    badge: z.enum(ALLOWED_BADGES).nullable().optional(),
    sale_ends_at: z.string().datetime().nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    variants: z.array(VariantInputSchema).optional(),
    images: z.array(z.object({ image_url: z.string(), image_public_id: z.string().optional() })).optional()
});

export const ListInventoryQuerySchema = z.object({
    low_stock: z.enum(["true", "false"]).transform(v => v === "true").optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
});

export interface SignatureResult {
    signature: string;
    timestamp: number;
    folder: string;
    apiKey: string;
    cloudName: string;
}

async function generateUniqueSlug(client: PoolClient, orgId: string, name: string): Promise<string> {
    const base = name.toLowerCase().trim().replace(/[^a-z0-9-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const candidate = base.length > 0 ? base : "product";
    let slug = candidate;
    let suffix = 1;

    while (suffix < 1000) {
        const exists = await productsQueries.checkSlugExists(client, orgId, slug);
        if (!exists) return slug;
        suffix++;
        slug = `${candidate}-${suffix}`;
    }
    throw new AppError("Could not generate unique product slug", 500, false);
}

export async function generateUploadSignature(orgId: string, folderType: "products" | "store" = "products"): Promise<SignatureResult> {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = `soko/${orgId}/${folderType}`;
    const paramsToSign = { timestamp, folder };
    const signature = cloudinary.utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET);
    return { signature, timestamp, folder, apiKey: env.CLOUDINARY_API_KEY, cloudName: env.CLOUDINARY_CLOUD_NAME };
}

export async function createCategory(orgId: string, rawBody: unknown) {
    const body = typeof rawBody === "string" ? { name: rawBody } : rawBody;
    const parsed = CreateCategorySchema.safeParse(body);
    if (!parsed.success) {
        throw new AppError(parsed.error.issues[0]?.message ?? "Invalid category payload", 400);
    }
    return productsQueries.createCategory(orgId, {
        name: parsed.data.name,
        description: parsed.data.description,
        isFeatured: parsed.data.is_featured,
        sortOrder: parsed.data.sort_order,
    });
}

export async function listMerchantProducts(orgId: string, rawQuery: unknown) {
    const parsed = ListProductsQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
        throw new AppError(parsed.error.issues[0]?.message ?? "Invalid query parameters", 400);
    }
    return productsQueries.listProducts(orgId, {
        categoryId: parsed.data.category_id,
        searchQuery: parsed.data.q,
        badge: parsed.data.badge,
        page: parsed.data.page,
        limit: parsed.data.limit
    });
}

export async function getMerchantProduct(orgId: string, productId: string) {
    const product = await productsQueries.getProductById(orgId, productId);
    if (!product) throw new AppError("Product not found", 404);
    return product;
}

export async function modifyMerchantProduct(orgId: string, productId: string, rawBody: unknown) {
    const parsed = UpdateProductSchema.safeParse(rawBody);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
    const existing = await productsQueries.getProductById(orgId, productId);
    if (!existing) throw new AppError("Product not found", 404);
    const updated = await productsQueries.updateProduct(orgId, productId, parsed.data);
    if (!updated) throw new AppError("Product not found", 404);
    return updated;
}

export async function updateMerchantProductStatus(orgId: string, productId: string, status: "draft" | "published" | "archived") {
    const existing = await productsQueries.getProductById(orgId, productId);
    if (!existing) throw new AppError("Product not found", 404);
    return productsQueries.setProductStatus(orgId, productId, status);
}

export async function archiveMerchantProduct(orgId: string, productId: string) {
    const existing = await productsQueries.getProductById(orgId, productId);
    if (!existing) throw new AppError("Product not found", 404);
    return productsQueries.archiveProduct(orgId, productId);
}

export async function unarchiveMerchantProduct(orgId: string, productId: string) {
    const existing = await productsQueries.getProductById(orgId, productId);
    if (!existing) throw new AppError("Product not found", 404);
    return productsQueries.unarchiveProduct(orgId, productId);
}

// =============================================================================
// BULLETPROOF SMART DELETION (Handles foreign keys safely with zero crashes)
// =============================================================================
export async function deleteMerchantProduct(
    orgId: string,
    productId: string
): Promise<{ deleted: boolean; action: 'hard_deleted' | 'soft_deleted' }> {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. Verify existence
        const productRes = await client.query<{ id: string; name: string }>(
            `SELECT id, name FROM products WHERE org_id = $1 AND id = $2 AND deleted_at IS NULL`,
            [orgId, productId]
        );

        if (productRes.rows.length === 0) {
            throw new AppError("Product not found or already deleted", 404);
        }

        // 2. Check if product has historical orders
        const orderCheck = await client.query<{ count: string }>(
            `SELECT COUNT(oi.id)::text AS count
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE o.org_id = $1 AND (
               oi.product_id = $2 OR 
               oi.format_id IN (SELECT id FROM product_formats WHERE product_id = $2)
             )`,
            [orgId, productId]
        );
        const orderCount = parseInt(orderCheck.rows[0]?.count || '0', 10);

        let action: 'hard_deleted' | 'soft_deleted' = 'hard_deleted';

        if (orderCount > 0) {
            // Has orders: Soft-delete and free the slug
            const timestamp = Math.floor(Date.now() / 1000);
            await client.query(
                `UPDATE products
                 SET deleted_at = NOW(),
                     status = 'archived',
                     slug = slug || '-deleted-' || $3,
                     updated_at = NOW()
                 WHERE org_id = $1 AND id = $2`,
                [orgId, productId, timestamp]
            );
            action = 'soft_deleted';
        } else {
            // Zero orders: Manually clean children first to avoid any FK deadlock
            await client.query(`DELETE FROM product_images WHERE product_id = $1`, [productId]);
            await client.query(`DELETE FROM inventory WHERE product_id = $1`, [productId]);
            await client.query(`DELETE FROM product_formats WHERE product_id = $1`, [productId]);
            await client.query(`DELETE FROM product_variants WHERE product_id = $1`, [productId]);
            await client.query(`DELETE FROM products WHERE org_id = $1 AND id = $2`, [orgId, productId]);
            action = 'hard_deleted';
        }

        await client.query("COMMIT");
        return { deleted: true, action };
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

export async function deleteProductsBulk(orgId: string, rawBody: unknown) {
    const parsed = BulkDeleteProductsSchema.safeParse(rawBody);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Invalid payload", 400);

    let count = 0;
    for (const id of parsed.data.productIds) {
        try {
            await deleteMerchantProduct(orgId, id);
            count++;
        } catch {
            // Ignore already deleted
        }
    }
    return { deleted: true, count };
}

export async function listMerchantInventory(orgId: string, rawQuery: unknown) {
    const parsed = ListInventoryQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Invalid query parameters", 400);
    return productsQueries.listInventory(orgId, {
        lowStockOnly: parsed.data.low_stock,
        page: parsed.data.page,
        limit: parsed.data.limit
    });
}

export async function updateMerchantStock(orgId: string, productId: string, rawBody: unknown) {
    const schema = z.object({ stock: z.number().int().nonnegative() });
    const parsed = schema.safeParse(rawBody);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
    const updated = await productsQueries.updateInventoryStock(orgId, productId, parsed.data.stock);
    if (!updated) throw new AppError("Product inventory not found", 404);
    return updated;
}

export async function createProductsBulk(orgId: string, rawBody: unknown) {
    const parsed = BulkCreateSchema.safeParse(rawBody);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Invalid request body", 400);

    const { products } = parsed.data;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const createdIds: string[] = [];
        for (let i = 0; i < products.length; i++) {
            const prod = products[i];
            let finalCategoryId = prod.category_id;
            if (!finalCategoryId) {
                finalCategoryId = await productsQueries.findOrCreateCategoryByName(client, orgId, "General");
            }

            const slug = await generateUniqueSlug(client, orgId, prod.name);
            const parentPrice = prod.variants && prod.variants.length > 0 ? prod.variants[0].price : prod.price;

            const insertedId = await productsQueries.insertProductTransactional(client, orgId, {
                category_id: finalCategoryId,
                name: prod.name,
                slug,
                sku: prod.sku || null,
                description: prod.description || null,
                cost_price: null,
                price: parentPrice,
                compare_at_price: prod.compare_at_price || null,
                badge: prod.badge || null,
                sale_ends_at: prod.sale_ends_at || null,
                status: prod.publish ? "published" : "draft"
            });

            await productsQueries.insertInventoryTransactional(client, insertedId, prod.stock || 10);

            if (prod.images && prod.images.length > 0) {
                for (let s = 0; s < prod.images.length; s++) {
                    await productsQueries.insertProductImageTransactional(
                        client,
                        insertedId,
                        prod.images[s].image_url,
                        prod.images[s].image_public_id,
                        s
                    );
                }
            }

            createdIds.push(insertedId);
        }

        await client.query("COMMIT");

        const resultProducts = [];
        for (const id of createdIds) {
            const p = await productsQueries.getProductById(orgId, id);
            if (p) resultProducts.push(p);
        }
        return resultProducts;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}