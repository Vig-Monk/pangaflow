// =============================================================================
// src/modules/admin/admin.routes.ts
// =============================================================================

import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { query } from "../../config/db";
import { env } from "../../config/env";
import { AppError } from "../../utils/error";
import { success } from "../../utils/response";
import { PLANS } from "../../config/constants";
import { PlanName } from "../../types/models";
import { z } from "zod";

const router = Router();

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

interface OrgListRow {
    id: string;
    name: string;
    slug: string;
    business_type: string;
    plan: PlanName;
    plan_expires_at: Date | null;
    created_at: Date;
}

interface OrgRow {
    id: string;
    plan: PlanName;
}

const UpgradeOrgSchema = z.object({
    plan: z.enum(["free", "pro", "business"]),
    expiresAt: z.string().optional()
});

router.get(
    "/orgs",
    async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await query<OrgListRow>(
                `SELECT id, name, slug, business_type, plan, plan_expires_at, created_at
       FROM   organizations
       WHERE  deleted_at IS NULL
       ORDER  BY created_at DESC`
            );

            success(res, result.rows);
        } catch (err) {
            next(err);
        }
    }
);

router.patch(
    "/orgs/:id/upgrade",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsed = UpgradeOrgSchema.safeParse(req.body);

            if (!parsed.success) {
                throw new AppError(
                    parsed.error.issues[0]?.message ?? "Invalid request body",
                    400
                );
            }

            const { plan, expiresAt } = parsed.data;

            const existing = await query<OrgRow>(
                `SELECT id, plan FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
                [req.params.id]
            );

            if (existing.rows.length === 0) {
                throw new AppError("Organization not found", 404);
            }

            const result = await query<OrgListRow>(
                `UPDATE organizations
         SET    plan            = $2,
                plan_expires_at = $3
         WHERE  id = $1
         RETURNING id, name, slug, business_type, plan, plan_expires_at, created_at`,
                [req.params.id, plan, expiresAt ?? null]
            );

            success(res, {
                organization: result.rows[0],
                planDetails: PLANS[plan]
            });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
