-- =============================================================================
-- Migration: 015_product_formats.sql
-- Soko Platform — Multi-Format Catalog Inventory (PDF, EPUB, Hardcopy)
-- =============================================================================
-- Attaches multiple formats and prices to a single canonical catalog product.
-- Hardcopy formats track physical stock; digital formats store file references.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Product Formats Table
-- ---------------------------------------------------------------------------

CREATE TABLE product_formats (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID           NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  format          TEXT           NOT NULL CHECK (format IN ('pdf', 'epub', 'hardcopy')),
  price           NUMERIC(12,2)  NOT NULL CHECK (price >= 0),
  file_url        TEXT,
  file_public_id  TEXT,
  file_size_bytes BIGINT,
  stock           INTEGER        CHECK (stock IS NULL OR stock >= 0),
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, format)
);

CREATE TRIGGER trg_product_formats_updated_at
  BEFORE UPDATE ON product_formats
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------

-- High-frequency lookup: retrieve all available formats for a product
CREATE INDEX idx_product_formats_product_id ON product_formats(product_id);

-- Lookup by format type for inventory sweeps and catalog filters
CREATE INDEX idx_product_formats_format ON product_formats(format);