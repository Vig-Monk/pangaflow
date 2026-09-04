-- =============================================================================
-- Migration: 026_import_deduplication.sql
-- Soko Platform — Granular Ingestion Telemetry & Duplicate Prevention Tracking
-- =============================================================================

ALTER TABLE import_jobs
  ADD COLUMN IF NOT EXISTS inserted_rows INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_rows  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_rows  INTEGER NOT NULL DEFAULT 0;

-- Index SKU and Title for fast duplicate matching during bulk uploads
CREATE INDEX IF NOT EXISTS idx_products_org_sku_ci
  ON products(org_id, LOWER(TRIM(sku)))
  WHERE deleted_at IS NULL AND sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_org_name_ci
  ON products(org_id, LOWER(TRIM(name)))
  WHERE deleted_at IS NULL;