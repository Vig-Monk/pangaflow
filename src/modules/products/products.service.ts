// =============================================================================
// src/modules/products/products.service.ts
// =============================================================================

import { z } from "zod";
import { PoolClient } from "pg";
import { v2 as cloudinary } from "cloudinary";
import { pool } from "../../config/db";
import { env } from "../../config/env";
import { AppError } from "../../utils/error";
import { PLANS } from "../../config/constants";
import * as productsQueries from "./products.queries";

cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET
});

export const ProductValidationSchema = z.object({
    name: z.string().min(1, "Name is required").max(200),
    category_id: z.string().uuid("category_id must be a valid UUID").nullable().optional(),
    price: z
        .number()
        .nonnegative("Price must be greater than or equal to zero"),
    cost_price: z
        .number()
        .nonnegative("Cost price must be greater than or equal to zero")
        .nullable()
        .optional(),
    sku: z.string().max(100).nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    stock: z
        .number()
        .int()
        .nonnegative("Stock must be an integer greater than or equal to zero"),
    images: z
        .array(
            z.object({
                image_url: z.string().url("image_url must be a valid URL"),
                image_public_id: z
                    .string()
                    .min(1, "image_public_id is required")
            })
        )
        .optional(),
    publish: z.boolean().optional()
});

export const BulkCreateSchema = z.object({
    products: z
        .array(ProductValidationSchema)
        .min(1, "At least one product is required")
        .max(10, "Cannot exceed 10 products per batch")
});

export const BulkDeleteProductsSchema = z.object({
    productIds: z.array(z.string().uuid()).min(1, "At least one product must be selected for deletion"),
});

export const ListProductsQuerySchema = z.object({
    category_id: z.string().uuid().optional(),
    q: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const UpdateProductSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    category_id: z.string().uuid().optional(),
    price: z.number().nonnegative().optional(),
    cost_price: z.number().nonnegative().nullable().optional(),
    sku: z.string().max(100).nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    status: z.enum(["draft", "published", "archived"]).optional()
});

export const ListInventoryQuerySchema = z.object({
    low_stock: z
        .enum(["true", "false"])
        .transform(v => v === "true")
        .optional(),
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

async function generateUniqueSlug(
    client: PoolClient,
    orgId: string,
    name: string
): Promise<string> {
    const base = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

    const candidate = base.length > 0 ? base : "product";
    let slug = candidate;
    let suffix = 1;

    while (suffix < 1000) {
        const exists = await productsQueries.checkSlugExists(
            client,
            orgId,
            slug
        );
        if (!exists) {
            return slug;
        }
        suffix++;
        slug = `${candidate}-${suffix}`;
    }

    throw new AppError("Could not generate unique product slug", 500, false);
}

export async function generateUploadSignature(
    orgId: string,
    folderType: "products" | "store" = "products"
): Promise<SignatureResult> {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = `kauntaos/${orgId}/${folderType}`;

    const paramsToSign = { timestamp, folder };
    const signature = cloudinary.utils.api_sign_request(
        paramsToSign,
        env.CLOUDINARY_API_SECRET
    );

    return {
        signature,
        timestamp,
        folder,
        apiKey: env.CLOUDINARY_API_KEY,
        cloudName: env.CLOUDINARY_CLOUD_NAME
    };
}

export async function createCategory(orgId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
        throw new AppError("Category name cannot be empty", 400);
    }
    return productsQueries.createCategory(orgId, trimmed);
}

export async function listMerchantProducts(orgId: string, rawQuery: unknown) {
    const parsed = ListProductsQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
        throw new AppError(
            parsed.error.issues[0]?.message ?? "Invalid query parameters",
            400
        );
    }

    return productsQueries.listProducts(orgId, {
        categoryId: parsed.data.category_id,
        searchQuery: parsed.data.q,
        page: parsed.data.page,
        limit: parsed.data.limit
    });
}

export async function getMerchantProduct(orgId: string, productId: string) {
    const product = await productsQueries.getProductById(orgId, productId);
    if (!product) {
        throw new AppError("Product not found", 404);
    }
    return product;
}

export async function modifyMerchantProduct(
    orgId: string,
    productId: string,
    rawBody: unknown
) {
    const parsed = UpdateProductSchema.safeParse(rawBody);
    if (!parsed.success) {
        throw new AppError(
            parsed.error.issues[0]?.message ?? "Invalid request body",
            400
        );
    }

    const existing = await productsQueries.getProductById(orgId, productId);
    if (!existing) {
        throw new AppError("Product not found", 404);
    }

    const updated = await productsQueries.updateProduct(
        orgId,
        productId,
        parsed.data
    );
    if (!updated) {
        throw new AppError("Product not found", 404);
    }
    return updated;
}

export async function updateMerchantProductStatus(
    orgId: string,
    productId: string,
    status: "draft" | "published" | "archived"
) {
    const existing = await productsQueries.getProductById(orgId, productId);
    if (!existing) {
        throw new AppError("Product not found", 404);
    }

    const updated = await productsQueries.setProductStatus(
        orgId,
        productId,
        status
    );
    if (!updated) {
        throw new AppError("Product not found", 404);
    }
    return updated;
}

export async function archiveMerchantProduct(orgId: string, productId: string) {
    const existing = await productsQueries.getProductById(orgId, productId);
    if (!existing) {
        throw new AppError("Product not found", 404);
    }
    return productsQueries.archiveProduct(orgId, productId);
}

export async function unarchiveMerchantProduct(orgId: string, productId: string) {
    const existing = await productsQueries.getProductById(orgId, productId);
    if (!existing) {
        throw new AppError("Product not found", 404);
    }
    return productsQueries.unarchiveProduct(orgId, productId);
}

export async function deleteMerchantProduct(orgId: string, productId: string) {
    const existing = await productsQueries.getProductById(orgId, productId);
    if (!existing) {
        throw new AppError("Product not found", 404);
    }
    return productsQueries.deleteProductPermanently(orgId, productId);
}

export async function deleteProductsBulk(orgId: string, rawBody: unknown) {
    const parsed = BulkDeleteProductsSchema.safeParse(rawBody);
    if (!parsed.success) {
        throw new AppError(
            parsed.error.issues[0]?.message ?? "Invalid bulk deletion payload",
            400
        );
    }
    return productsQueries.bulkDeleteProducts(orgId, parsed.data.productIds);
}

export async function listMerchantInventory(orgId: string, rawQuery: unknown) {
    const parsed = ListInventoryQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
        throw new AppError(
            parsed.error.issues[0]?.message ?? "Invalid query parameters",
            400
        );
    }

    return productsQueries.listInventory(orgId, {
        lowStockOnly: parsed.data.low_stock,
        page: parsed.data.page,
        limit: parsed.data.limit
    });
}

export async function updateMerchantStock(
    orgId: string,
    productId: string,
    rawBody: unknown
) {
    const schema = z.object({
        stock: z
            .number()
            .int()
            .nonnegative(
                "Stock must be an integer greater than or equal to zero"
            )
    });
    const parsed = schema.safeParse(rawBody);
    if (!parsed.success) {
        throw new AppError(
            parsed.error.issues[0]?.message ?? "Invalid request body",
            400
        );
    }

    const updated = await productsQueries.updateInventoryStock(
        orgId,
        productId,
        parsed.data.stock
    );
    if (!updated) {
        throw new AppError("Product inventory not found", 404);
    }
    return updated;
}

export async function createProductsBulk(orgId: string, rawBody: unknown) {
    const parsed = BulkCreateSchema.safeParse(rawBody);
    if (!parsed.success) {
        throw new AppError(
            parsed.error.issues[0]?.message ?? "Invalid request body",
            400
        );
    }

    const { products } = parsed.data;
    const batchSize = products.length;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const orgResult = await client.query<{ plan: string }>(
            "SELECT plan FROM organizations WHERE id = $1 AND deleted_at IS NULL",
            [orgId]
        );
        const org = orgResult.rows[0];
        if (!org) {
            throw new AppError("Organization not found", 404);
        }

        const planConfig = PLANS[org.plan as keyof typeof PLANS];
        const limit = planConfig.productLimit;

        if (limit !== null) {
            const countResult = await client.query<{ count: string }>(
                "SELECT COUNT(*) AS count FROM products WHERE org_id = $1 AND deleted_at IS NULL",
                [orgId]
            );
            const currentCount = parseInt(
                countResult.rows[0]?.count ?? "0",
                10
            );

            if (currentCount + batchSize > limit) {
                throw new AppError(
                    `Product limit reached. This batch would exceed the ${planConfig.label} plan limit of ${limit} products.`,
                    403
                );
            }
        }

        const createdIds: string[] = [];

        for (let i = 0; i < batchSize; i++) {
            const prod = products[i];

            let finalCategoryId = prod.category_id;
            if (!finalCategoryId) {
                finalCategoryId = await productsQueries.findOrCreateCategoryByName(client, orgId, "Other");
            } else {
                const catExists = await productsQueries.checkCategoryExists(
                    client,
                    orgId,
                    finalCategoryId
                );
                if (!catExists) {
                    throw new AppError(
                        `Category not found or access denied for product at index ${i}`,
                        400
                    );
                }
            }

            const slug = await generateUniqueSlug(client, orgId, prod.name);

            const insertedId = await productsQueries.insertProductTransactional(
                client,
                orgId,
                {
                    category_id: finalCategoryId,
                    name: prod.name,
                    slug,
                    sku: prod.sku || null,
                    description: prod.description || null,
                    cost_price: prod.cost_price ?? null,
                    price: prod.price,
                    status: prod.publish ? "published" : "draft"
                }
            );

            await productsQueries.insertInventoryTransactional(
                client,
                insertedId,
                prod.stock
            );

            if (prod.images) {
                for (let s = 0; s < prod.images.length; s++) {
                    const img = prod.images[s];
                    await productsQueries.insertProductImageTransactional(
                        client,
                        insertedId,
                        img.image_url,
                        img.image_public_id,
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