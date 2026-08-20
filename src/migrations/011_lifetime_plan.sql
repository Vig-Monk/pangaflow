-- =============================================================================
-- Migration: 011_lifetime_plan.sql
-- Soko Platform — Add 'lifetime' tier to organizations plan constraint
-- =============================================================================

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_plan_check
  CHECK (plan IN ('free', 'pro', 'business', 'lifetime'));