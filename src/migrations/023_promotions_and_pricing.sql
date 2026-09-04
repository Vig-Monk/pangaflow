-- =============================================================================
-- Migration: 023_promotions_and_pricing.sql
-- Soko Platform — Compare-At Strike-Through Pricing & Promotional Badges
-- =============================================================================

-- 1. Canonical Products Table Enhancements
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS badge            TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sale_ends_at     TIMESTAMPTZ DEFAULT NULL;

-- Guard against inverted markup prices directly at DB constraint level
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_compare_at_price;
ALTER TABLE products ADD CONSTRAINT chk_products_compare_at_price
  CHECK (compare_at_price IS NULL OR compare_at_price > price);

-- 2. Format-Specific Compare-At Prices (Isolates Hardcopy vs. eBook discounts)
ALTER TABLE product_formats
  ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC(12,2) DEFAULT NULL;

ALTER TABLE product_formats DROP CONSTRAINT IF EXISTS chk_product_formats_compare_at_price;
ALTER TABLE product_formats ADD CONSTRAINT chk_product_formats_compare_at_price
  CHECK (compare_at_price IS NULL OR compare_at_price > price);

-- 3. High-Speed Indexing for Section Merchandising
CREATE INDEX IF NOT EXISTS idx_products_badge
  ON products(org_id, badge)
  WHERE deleted_at IS NULL AND badge IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_discounted
  ON products(org_id)
  WHERE deleted_at IS NULL AND compare_at_price IS NOT NULL;