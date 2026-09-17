-- =============================================================================
-- Migration: 032_fuzzy_search_trgm.sql
-- Soko Platform — PostgreSQL Native Trigram Fuzzy Matching Engine
-- =============================================================================
-- Enables pg_trgm and attaches Generalized Inverted (GIN) trigram indexes to
-- catalog titles, barcodes/SKUs, and descriptions for typo-tolerant fuzzy search.
-- =============================================================================

-- 1. Enable pg_trgm Extension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. GIN Trigram Index on Product Name (Primary match target)
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING gin (LOWER(TRIM(name)) gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- 3. GIN Trigram Index on Product SKU / ISBN
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm
  ON products USING gin (LOWER(TRIM(sku)) gin_trgm_ops)
  WHERE deleted_at IS NULL AND sku IS NOT NULL;

-- 4. GIN Trigram Index on Product Description / Author Text
CREATE INDEX IF NOT EXISTS idx_products_description_trgm
  ON products USING gin (LOWER(TRIM(description)) gin_trgm_ops)
  WHERE deleted_at IS NULL AND description IS NOT NULL;