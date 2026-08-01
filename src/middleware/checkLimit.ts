// =============================================================================
// src/middleware/checkLimit.ts
// Plan-gate middleware. Queries the org's current plan + customer count,
// blocks with a typed 403 + upgrade info if the plan's customerLimit is
// reached. A null customerLimit (pro/business) means unlimited — never
// blocks those plans.
// =============================================================================

import { RequestHandler } from 'express';
import { query } from '../config/db';
import { AppError } from '../utils/error';
import { PLANS } from '../config/constants';
import { PlanName } from '../types/models';

// ---------------------------------------------------------------------------
// Internal row shapes
// ---------------------------------------------------------------------------

interface OrgPlanRow {
plan: PlanName;
}

interface CustomerCountRow {
count: string;
}

// ---------------------------------------------------------------------------
// Typed 403 payload shape — attached to the AppError's details so the
// frontend can render an upgrade prompt without re-deriving plan info.
// ---------------------------------------------------------------------------

export interface LimitReachedDetails {
currentPlan: PlanName;
currentCount: number;
limit: number;
upgradeOptions: Array < { plan: PlanName; label: string; price_kes: number } >;
}

// ---------------------------------------------------------------------------
// checkCustomerLimit
// ---------------------------------------------------------------------------

/**
* Blocks POST /customers when the org's plan customerLimit is reached.
* Reads req.orgId (set by verifyToken, which must run before this
* middleware in the route chain). Free plan only — pro/business have
* customerLimit: null and are never blocked here.
*/
export const checkCustomerLimit: RequestHandler = async (req, _res, next) => {
try {
if (!req.orgId) {
throw new AppError('Unauthorized', 401);
}

const orgResult = await query < OrgPlanRow > (
`SELECT plan FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
[req.orgId]
);

const org = orgResult.rows[0];

if (!org) {
throw new AppError('Organization not found', 404);
}

const planConfig = PLANS[org.plan];
const limit = planConfig.customerLimit;

// null limit = unlimited. Only 'free' has a numeric limit today,
// but this check is written against the value, not the plan name,
// so a future plan with a numeric limit is gated automatically
// without touching this file.
if (limit === null) {
next();
return;
}

const countResult = await query < CustomerCountRow > (
`SELECT COUNT(*) AS count
FROM   customers
WHERE  org_id     = $1
AND  deleted_at IS NULL`,
[req.orgId]
);

const currentCount = parseInt(countResult.rows[0]?.count ?? '0', 10);

if (currentCount >= limit) {
const upgradeOptions = (Object.keys(PLANS) as PlanName[])
.filter((planName) => planName !== org.plan && PLANS[planName].customerLimit === null)
.map((planName) => ({
plan: planName,
label: PLANS[planName].label,
price_kes: PLANS[planName].price_kes,
}));

const details: LimitReachedDetails = {
currentPlan: org.plan,
currentCount,
limit,
upgradeOptions,
};

throw new AppError(
`Customer limit reached for the ${planConfig.label} plan (${limit} customers). Upgrade to add more.`,
403,
true,
details
);
}

next();
} catch (err) {
next(err);
}
};