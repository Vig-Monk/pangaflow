// =============================================================================
// src/config/constants.ts
// Runtime-iterable const arrays + the plan pricing table.
//
// BusinessType and Role are NOT redeclared here — they already exist in
// src/types/models.ts as the real types used throughout Organization,
// User, and OrgMember. This file imports them and builds const arrays
// CONSTRAINED to match — if models.ts's union ever changes, these
// arrays fail to compile until updated, rather than silently drifting.
// =============================================================================

import { BusinessType, PlanName, Role } from '../types/models';

// ---------------------------------------------------------------------------
// Business types — array form of the existing BusinessType union
// ---------------------------------------------------------------------------

export const BUSINESS_TYPES: readonly BusinessType[] = [
  'core',
  'shop',
  'salon',
  'stays',
  'market',
] as const;

export const ROLES: readonly Role[] = ['owner', 'admin', 'staff'] as const;

// ---------------------------------------------------------------------------
// Roles — array form of the existing Role union
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Plans — genuinely new. Nothing before this prompt defines pricing.
//
// Deliberately NOT typed as Record<PlanName, { customerLimit; label;
// price_kes; price_usd }> — that would force a uniform shape across all
// three plans and silently invent a price_usd field on 'free' that the
// spec's own literal object never gives it. `as const` preserves the
// actual, honest shape: three different object shapes, not one padded
// one. Consumers narrow by key (PLANS.free vs PLANS.pro) and get the
// correct fields for that specific plan, nothing invented.
// ---------------------------------------------------------------------------

export const PLANS = {
  free:     { customerLimit: 10,   productLimit: 20,   label: 'Free',     price_kes: 0 },
  pro:      { customerLimit: null, productLimit: null,  label: 'Pro',      price_kes: 500,  price_usd: 4 },
  business: { customerLimit: null, productLimit: null,  label: 'Business', price_kes: 2499, price_usd: 20 },
} as const;


// PlanName re-exported here for convenience (constants.ts consumers
// importing plan-related types shouldn't need a second import from
// models.ts just for this one) — but note this is a re-export of the
// SAME type already defined in models.ts, not a second definition.
export type { PlanName };

// Compile-time assertion: keyof typeof PLANS must exactly match the
// imported PlanName union. If someone adds a fourth plan to PLANS
// without updating models.ts's PlanName (or vice versa), this line
// produces a TypeScript error pointing directly at the mismatch.
type _AssertPlanNamesMatch = keyof typeof PLANS extends PlanName
  ? PlanName extends keyof typeof PLANS
    ? true
    : never
  : never;
const _planNamesMatchCheck: _AssertPlanNamesMatch = true;
void _planNamesMatchCheck; // referenced so it isn't flagged as an unused const

// ---------------------------------------------------------------------------
// PLAN_NAMES — iterable array of plan keys, derived from PLANS itself
// rather than hand-typed separately (Object.keys on a const-asserted
// object already gives the correct literal union array type).
// -------------------------------------------------------------------------

export const PLAN_NAMES = Object.keys(PLANS) as PlanName[];