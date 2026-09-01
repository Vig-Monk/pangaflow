-- =============================================================================
-- Migration: 014_business_type_books.sql
-- Soko Platform — Add 'books' vertical to organizations business_type constraint
-- =============================================================================

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_business_type_check;

ALTER TABLE organizations ADD CONSTRAINT organizations_business_type_check
  CHECK (business_type IN ('core', 'shop', 'salon', 'stays', 'market', 'books'));