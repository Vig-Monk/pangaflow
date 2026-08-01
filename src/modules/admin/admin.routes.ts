// =============================================================================
// src/modules/admin/admin.routes.ts
// Internal admin operations — gated by a shared secret header, not JWT.
// This is deliberately NOT the same auth path as customer-facing routes:
// there is no "admin user" concept yet (that's RBAC, Stage 4 per the
// roadmap) — this is a single shared secret for manual, low-frequency
// operator actions (upgrading a trader's plan after a manual M-Pesa
// payment confirmation, listing orgs for support).
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../utils/error';
import { success } from '../../utils/response';
import { PLANS } from '../../config/constants';
import { PlanName } from '../../types/models';
import { z } from 'zod';

const router = Router();

// ---------------------------------------------------------------------------
// requireAdminSecret — checked on every route in this router
// ---------------------------------------------------------------------------

function requireAdminSecret(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const provided = req.headers['x-admin-secret'];

  if (typeof provided !== 'string' || provided.length === 0) {
    next(new AppError('Missing X-Admin-Secret header', 401));
    return;
  }

  // Constant-time comparison would be the hardened version of this
  // check (timing-attack resistance) — noted as a Prompt-3.3-adjacent
  // hardening item rather than solved here, since this endpoint is a
  // low-frequency manual tool, not a customer-facing auth boundary,
  // and introducing a crypto.timingSafeEqual call for a single string
  // comparison at this stage is exactly the kind of unrequested
  // complexity Section 21 flags ("generic abstractions without
  // repeated operational need").
  if (provided !== env.ADMIN_SECRET) {
    next(new AppError('Invalid admin secret', 403));
    return;
  }

  next();
}

router.use(requireAdminSecret);

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Zod schema — upgrade body
// ---------------------------------------------------------------------------

const UpgradeOrgSchema = z.object({
  plan: z.enum(['free', 'pro', 'business']),
  expiresAt: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/v1/admin/orgs
// ---------------------------------------------------------------------------

router.get('/orgs', async (_req: Request, res: Response, next: NextFunction) => {
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
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/admin/orgs/:id/upgrade
// ---------------------------------------------------------------------------

router.patch(
  '/orgs/:id/upgrade',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = UpgradeOrgSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
      }

      const { plan, expiresAt } = parsed.data;

      // Confirm the org exists before attempting the update — gives a
      // clean 404 rather than a silent no-op UPDATE affecting zero rows.
      const existing = await query<OrgRow>(
        `SELECT id, plan FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
        [req.params.id]
      );

      if (existing.rows.length === 0) {
        throw new AppError('Organization not found', 404);
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
        planDetails: PLANS[plan],
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;