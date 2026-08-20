// =============================================================================
// src/modules/admin/admin.routes.ts
// Soko Owner Console Backend API — Oversight, Tier Management & Demo Account Purge
// =============================================================================

import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { query, pool } from "../../config/db";
import { env } from "../../config/env";
import { AppError } from "../../utils/error";
import { success } from "../../utils/response";
import { PLANS } from "../../config/constants";
import { PlanName } from "../../types/models";
import { z } from "zod";

const router = Router();

// ---------------------------------------------------------------------------
// Security: Constant-Time Admin Secret Authorization Guard
// ---------------------------------------------------------------------------
function requireAdminSecret(
    req: Request,
    _res: Response,
    next: NextFunction
): void {
    const provided = req.headers["x-admin-secret"];

    if (typeof provided !== "string" || provided.length === 0) {
        next(new AppError("Missing X-Admin-Secret header", 401));
        return;
    }

    const expected = env.ADMIN_SECRET;
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);

    if (
        providedBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
        next(new AppError("Invalid admin secret", 403));
        return;
    }

    next();
}

router.use(requireAdminSecret);

// ---------------------------------------------------------------------------
// Zod Request Schemas
// ---------------------------------------------------------------------------
const UpdateTierSchema = z.object({
    plan: z.enum(["free", "pro", "business", "lifetime"]),
    durationMonths: z.number().int().min(1).max(36).optional(),
    customExpiry: z.string().datetime().optional().nullable(),
});

// ---------------------------------------------------------------------------
// 1. GET /api/v1/admin/stats — Real-time Platform KPI Aggregates
// ---------------------------------------------------------------------------
router.get(
    "/stats",
    async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await query<{
                total_orgs: string;
                free_count: string;
                pro_count: string;
                business_count: string;
                lifetime_count: string;
                total_products: string;
                total_orders: string;
                total_customers: string;
            }>(
                `SELECT
                    COUNT(*)::text AS total_orgs,
                    COUNT(*) FILTER (WHERE plan = 'free')::text AS free_count,
                    COUNT(*) FILTER (WHERE plan = 'pro')::text AS pro_count,
                    COUNT(*) FILTER (WHERE plan = 'business')::text AS business_count,
                    COUNT(*) FILTER (WHERE plan = 'lifetime')::text AS lifetime_count,
                    (SELECT COUNT(*)::text FROM products WHERE deleted_at IS NULL) AS total_products,
                    (SELECT COUNT(*)::text FROM orders) AS total_orders,
                    (SELECT COUNT(*)::text FROM customers WHERE deleted_at IS NULL) AS total_customers
                 FROM organizations
                 WHERE deleted_at IS NULL`
            );

            const row = result.rows[0];
            success(res, {
                total_orgs: parseInt(row?.total_orgs || "0", 10),
                free_count: parseInt(row?.free_count || "0", 10),
                pro_count: parseInt(row?.pro_count || "0", 10),
                business_count: parseInt(row?.business_count || "0", 10),
                lifetime_count: parseInt(row?.lifetime_count || "0", 10),
                total_products: parseInt(row?.total_products || "0", 10),
                total_orders: parseInt(row?.total_orders || "0", 10),
                total_customers: parseInt(row?.total_customers || "0", 10),
            });
        } catch (err) {
            next(err);
        }
    }
);

// ---------------------------------------------------------------------------
// 2. GET /api/v1/admin/orgs — Searchable & Filterable Merchant Directory
// ---------------------------------------------------------------------------
router.get(
    "/orgs",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { q, plan } = req.query;

            const conditions: string[] = ["o.deleted_at IS NULL"];
            const params: unknown[] = [];
            let paramIdx = 1;

            if (typeof plan === "string" && plan.trim() && plan.trim() !== "all") {
                conditions.push(`o.plan = $${paramIdx}`);
                params.push(plan.trim().toLowerCase());
                paramIdx++;
            }

            if (typeof q === "string" && q.trim()) {
                const term = `%${q.trim()}%`;
                conditions.push(`(
                    o.name ILIKE $${paramIdx} OR
                    o.slug ILIKE $${paramIdx} OR
                    u.name ILIKE $${paramIdx} OR
                    u.email ILIKE $${paramIdx}
                )`);
                params.push(term);
                paramIdx++;
            }

            const whereClause = conditions.join(" AND ");

            const result = await query<{
                id: string;
                name: string;
                slug: string;
                business_type: string;
                plan: PlanName;
                plan_expires_at: Date | null;
                created_at: Date;
                owner_name: string | null;
                owner_email: string | null;
                product_count: string;
                customer_count: string;
                order_count: string;
            }>(
                `SELECT
                    o.id, o.name, o.slug, o.business_type, o.plan, o.plan_expires_at, o.created_at,
                    u.name AS owner_name,
                    u.email AS owner_email,
                    (SELECT COUNT(*)::text FROM products p WHERE p.org_id = o.id AND p.deleted_at IS NULL) AS product_count,
                    (SELECT COUNT(*)::text FROM customers c WHERE c.org_id = o.id AND c.deleted_at IS NULL) AS customer_count,
                    (SELECT COUNT(*)::text FROM orders ord WHERE ord.org_id = o.id) AS order_count
                 FROM organizations o
                 LEFT JOIN org_members om ON om.org_id = o.id AND om.role = 'owner'
                 LEFT JOIN users u ON u.id = om.user_id AND u.deleted_at IS NULL
                 WHERE ${whereClause}
                 ORDER BY o.created_at DESC`,
                params
            );

            const orgs = result.rows.map((row) => ({
                ...row,
                product_count: parseInt(row.product_count || "0", 10),
                customer_count: parseInt(row.customer_count || "0", 10),
                order_count: parseInt(row.order_count || "0", 10),
            }));

            success(res, orgs);
        } catch (err) {
            next(err);
        }
    }
);

// ---------------------------------------------------------------------------
// 3. PATCH /api/v1/admin/orgs/:id/tier — Promote / Demote / Grant Lifetime
// ---------------------------------------------------------------------------
async function handleTierUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const parsed = UpdateTierSchema.safeParse(req.body);

        if (!parsed.success) {
            throw new AppError(
                parsed.error.issues[0]?.message ?? "Invalid tier update request",
                400
            );
        }

        const { plan, durationMonths, customExpiry } = parsed.data;

        // Verify organization exists
        const existing = await query<{ id: string; plan: PlanName }>(
            `SELECT id, plan FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
            [req.params.id]
        );

        if (existing.rows.length === 0) {
            throw new AppError("Organization not found", 404);
        }

        // Calculate expiry based on tier
        let expiresAt: Date | null = null;

        if (plan === "lifetime" || plan === "free") {
            expiresAt = null;
        } else if (customExpiry) {
            expiresAt = new Date(customExpiry);
        } else {
            const months = durationMonths ?? 1;
            expiresAt = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);
        }

        const result = await query<{
            id: string;
            name: string;
            slug: string;
            business_type: string;
            plan: PlanName;
            plan_expires_at: Date | null;
            created_at: Date;
        }>(
            `UPDATE organizations
             SET    plan            = $2,
                    plan_expires_at = $3,
                    updated_at      = NOW()
             WHERE  id = $1
             RETURNING id, name, slug, business_type, plan, plan_expires_at, created_at`,
            [req.params.id, plan, expiresAt]
        );

        success(res, {
            organization: result.rows[0],
            planDetails: PLANS[plan],
        });
    } catch (err) {
        next(err);
    }
}

router.patch("/orgs/:id/tier", handleTierUpdate);
router.patch("/orgs/:id/upgrade", handleTierUpdate); // Backward compatibility

// ---------------------------------------------------------------------------
// 4. DELETE /api/v1/admin/orgs/:id — Deep Purge of Demo Accounts & Test Spam
// ---------------------------------------------------------------------------
router.delete(
    "/orgs/:id",
    async (req: Request, res: Response, next: NextFunction) => {
        const orgId = req.params.id;
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // 1. Verify organization exists
            const orgCheck = await client.query<{ id: string; name: string }>(
                `SELECT id, name FROM organizations WHERE id = $1`,
                [orgId]
            );

            if (orgCheck.rows.length === 0) {
                throw new AppError("Organization not found", 404);
            }

            const orgName = orgCheck.rows[0].name;

            // 2. Collect user IDs linked to this organization
            const memberUsers = await client.query<{ user_id: string }>(
                `SELECT user_id FROM org_members WHERE org_id = $1`,
                [orgId]
            );
            const userIds = memberUsers.rows.map((r) => r.user_id);

            // 3. Delete Storefront, Products, Images, and Inventory
            await client.query(`DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE org_id = $1)`, [orgId]);
            await client.query(`DELETE FROM inventory WHERE product_id IN (SELECT id FROM products WHERE org_id = $1)`, [orgId]);
            await client.query(`DELETE FROM products WHERE org_id = $1`, [orgId]);
            await client.query(`DELETE FROM categories WHERE org_id = $1`, [orgId]);
            await client.query(`DELETE FROM stores WHERE org_id = $1`, [orgId]);

            // 4. Delete Orders, Order Items, and Audit History
            await client.query(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE org_id = $1)`, [orgId]);
            await client.query(`DELETE FROM order_status_history WHERE order_id IN (SELECT id FROM orders WHERE org_id = $1)`, [orgId]);
            await client.query(`DELETE FROM orders WHERE org_id = $1`, [orgId]);

            // 5. Delete Fulfillment & Merchant Hub Locations
            await client.query(`DELETE FROM merchant_locations WHERE org_id = $1`, [orgId]);

            // 6. Delete Ledger, Transactions, and Customers
            await client.query(`DELETE FROM transactions WHERE org_id = $1`, [orgId]);
            await client.query(`DELETE FROM customers WHERE org_id = $1`, [orgId]);

            // 7. Delete Expenses and Expense Categories
            await client.query(`DELETE FROM expenses WHERE org_id = $1`, [orgId]);
            await client.query(`DELETE FROM expense_categories WHERE org_id = $1`, [orgId]);

            // 8. Delete M-Pesa Credentials and Transactions
            await client.query(`DELETE FROM org_mpesa_credentials WHERE org_id = $1`, [orgId]);
            await client.query(`DELETE FROM mpesa_transactions WHERE org_id = $1`, [orgId]);

            // 9. Delete Wakulima Agent Data
            await client.query(`DELETE FROM agent_orders WHERE org_id = $1`, [orgId]);
            await client.query(`DELETE FROM agent_clients WHERE org_id = $1`, [orgId]);

            // 10. Delete Memberships
            await client.query(`DELETE FROM org_members WHERE org_id = $1`, [orgId]);

            // 11. Delete Organization Row
            await client.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);

            // 12. Clean up orphan users (users with no other organization memberships)
            if (userIds.length > 0) {
                for (const uId of userIds) {
                    const otherMemberships = await client.query(
                        `SELECT 1 FROM org_members WHERE user_id = $1`,
                        [uId]
                    );
                    if (otherMemberships.rows.length === 0) {
                        await client.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [uId]);
                        await client.query(`DELETE FROM users WHERE id = $1`, [uId]);
                    }
                }
            }

            await client.query("COMMIT");
            success(res, { deleted: true, orgId, orgName });
        } catch (err) {
            await client.query("ROLLBACK");
            next(err);
        } finally {
            client.release();
        }
    }
);

export default router;