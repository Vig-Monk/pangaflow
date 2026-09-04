-- =============================================================================
-- Migration: 024_categories_enhancement.sql
-- Soko Platform — Dynamic Categories with Slugification & Case-Insensitive Uniqueness
-- =============================================================================

-- 1. Add Descriptive & Navigation Fields
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS slug        TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sort_order  INTEGER NOT NULL DEFAULT 0;

-- 2. Backfill URL Slugs for Existing Categories
UPDATE categories
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL;

-- Make slug non-null after backfill
ALTER TABLE categories ALTER COLUMN slug SET NOT NULL;

-- 3. Case-Insensitive Name Index (Prevents "Fiction" vs "fiction" vs " Fiction " duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_org_name_ci
  ON categories(org_id, LOWER(TRIM(name)));

-- 4. Unique Slug Index per Tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_org_slug_ci
  ON categories(org_id, LOWER(slug));

-- 5. Performance Index for Navigation Sorting & Featured Dropdowns
CREATE INDEX IF NOT EXISTS idx_categories_org_sort
  ON categories(org_id, is_featured DESC, sort_order ASC, name ASC);