-- =============================================================================
-- Migration: 021_harden_delete_integrity.sql
-- Soko Platform — Deterministic Cascade & Preservation Constraints
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Dependent Catalog Entities: Safe Hard Cascade
-- ---------------------------------------------------------------------------

-- Product Variants
ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS product_variants_product_id_fkey;
ALTER TABLE product_variants ADD CONSTRAINT product_variants_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Product Images
ALTER TABLE product_images DROP CONSTRAINT IF EXISTS product_images_product_id_fkey;
ALTER TABLE product_images ADD CONSTRAINT product_images_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Inventory Stock
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_product_id_fkey;
ALTER TABLE inventory ADD CONSTRAINT inventory_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Product Formats
ALTER TABLE product_formats DROP CONSTRAINT IF EXISTS product_formats_product_id_fkey;
ALTER TABLE product_formats ADD CONSTRAINT product_formats_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Historical Orders: Preserve Financial Ledger with SET NULL
-- ---------------------------------------------------------------------------

ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_format_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_format_id_fkey
  FOREIGN KEY (format_id) REFERENCES product_formats(id) ON DELETE SET NULL;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_variant_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3. Digital Downloads: Block Deletions When Active Paid Tokens Exist
-- ---------------------------------------------------------------------------

ALTER TABLE digital_downloads DROP CONSTRAINT IF EXISTS digital_downloads_format_id_fkey;
ALTER TABLE digital_downloads ADD CONSTRAINT digital_downloads_format_id_fkey
  FOREIGN KEY (format_id) REFERENCES product_formats(id) ON DELETE RESTRICT;

ALTER TABLE digital_downloads DROP CONSTRAINT IF EXISTS digital_downloads_order_item_id_fkey;
ALTER TABLE digital_downloads ADD CONSTRAINT digital_downloads_order_item_id_fkey
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE;