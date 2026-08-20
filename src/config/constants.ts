// =============================================================================
// src/config/constants.ts
// Runtime-iterable const arrays + the plan pricing table.
// =============================================================================

import { BusinessType, PlanName, Role } from "../types/models";

// ---------------------------------------------------------------------------
// Business types
// ---------------------------------------------------------------------------

export const BUSINESS_TYPES: readonly BusinessType[] = [
    "core",
    "shop",
    "salon",
    "stays",
    "market"
] as const;

export const ROLES: readonly Role[] = ["owner", "admin", "staff"] as const;

// ---------------------------------------------------------------------------
// Plans — Pricing & Limit Configs
// ---------------------------------------------------------------------------

export const PLANS = {
    free: { customerLimit: 10, productLimit: 20, label: "Free", price_kes: 0 },
    pro: {
        customerLimit: null,
        productLimit: null,
        label: "Pro",
        price_kes: 500,
        price_usd: 4
    },
    business: {
        customerLimit: null,
        productLimit: null,
        label: "Business",
        price_kes: 2499,
        price_usd: 20
    },
    lifetime: {
        customerLimit: null,
        productLimit: null,
        label: "Lifetime",
        price_kes: 14999,
        price_usd: 120
    }
} as const;

export type { PlanName };

// Compile-time assertion guaranteeing PLANS keys match PlanName
type _AssertPlanNamesMatch = keyof typeof PLANS extends PlanName
    ? PlanName extends keyof typeof PLANS
        ? true
        : never
    : never;
const _planNamesMatchCheck: _AssertPlanNamesMatch = true;
void _planNamesMatchCheck;

export const PLAN_NAMES = Object.keys(PLANS) as PlanName[];
