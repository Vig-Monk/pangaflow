-- =============================================================================
-- Migration: 013_product_variants.sql
-- Soko Platform — Product Variants (Size, Color, Flavor, Material) & Inventory
-- =============================================================================
-- 1. Creates `product_variants` table linked to parent products with dedicated pricing,
--    COGS, inventory stock levels, SKUs, and attribute option pairs (JSONB).
-- 2. Links variant snapshot references onto historical `order_items`.
-- 3. Adds high-speed indexes for variant resolution and stock decrements.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Create Product Variants Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS product_variants (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID           NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id   UUID           NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title        TEXT           NOT NULL,                             -- e.g. "Size 42 / Black" or "1kg Pack"
  sku          TEXT,                                                -- Optional variant-level barcode/SKU
  options      JSONB          NOT NULL DEFAULT '{}',                -- e.g. {"Size": "42", "Color": "Black"}
  price        NUMERIC(12,2)  NOT NULL,                             -- Specific variant selling price
  cost_price   NUMERIC(12,2)  NOT NULL DEFAULT 0.00,                -- Specific variant stock cost (COGS)
  stock        INTEGER        NOT NULL DEFAULT 0 CHECK (stock >= 0),
  low_stock_at INTEGER        NOT NULL DEFAULT 5,
  image_url    TEXT,                                                -- Optional variant-specific photo
  is_active    BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Trigger for auto-updating `updated_at`
DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON product_variants;
CREATE TRIGGER trg_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Link Variant Metadata on Historical Order Items
-- ---------------------------------------------------------------------------

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_title TEXT;

-- ---------------------------------------------------------------------------
-- 3. High-Performance Indexes
-- ---------------------------------------------------------------------------

-- Fast variant lookups by parent product (catalog queries & storefront display)
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);

-- Organization-scoped variant management
CREATE INDEX IF NOT EXISTS idx_product_variants_org_id ON product_variants(org_id);

-- SKU and active status lookups
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(org_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_variants_active ON product_variants(product_id, is_active);

-- Historical order items link index
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON order_items(variant_id) WHERE variant_id IS NOT NULL;