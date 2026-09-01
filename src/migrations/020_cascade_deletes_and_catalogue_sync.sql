-- =============================================================================
-- Migration: 020_cascade_deletes_and_catalog_sync.sql
-- Soko Platform — Total Cascading Deletes & Flagship Catalog Unification
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Ensure Flagship Organization & Storefront
-- ---------------------------------------------------------------------------

INSERT INTO organizations (name, slug, business_type, plan, plan_expires_at)
VALUES ('Flemela Bookstore', 'flemela', 'books', 'lifetime', NULL)
ON CONFLICT (slug) DO UPDATE SET
  business_type = 'books',
  plan = 'lifetime',
  deleted_at = NULL,
  updated_at = NOW();

-- Ensure Admin User
INSERT INTO users (email, password_hash, name)
VALUES (
  'admin@flemela.co.ke',
  crypt('AdminPassword123!', gen_salt('bf', 12)),
  'Flemela Store Administrator'
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = crypt('AdminPassword123!', gen_salt('bf', 12)),
  deleted_at = NULL,
  updated_at = NOW();

-- Ensure Owner Membership Link
INSERT INTO org_members (org_id, user_id, role)
SELECT o.id, u.id, 'owner'
FROM organizations o
CROSS JOIN users u
WHERE o.slug = 'flemela' AND LOWER(u.email) = 'admin@flemela.co.ke'
ON CONFLICT (org_id, user_id) DO UPDATE SET
  role = 'owner';

-- Ensure Storefront is Bound and Published
INSERT INTO stores (
  org_id, slug, name, description, location, delivery_info,
  status, hero_layout, hero_headline, hero_subheadline, hero_cta_label
)
SELECT 
  o.id, 'flemela', 'Flemela Bookstore',
  'Books that inspire. Knowledge that transforms.',
  'Sarit Centre, Westlands, Nairobi',
  'Free delivery across Nairobi on orders above KSh 2,500',
  'published', 'editorial',
  'Books that change the way you think.',
  'Discover handpicked literature, timeless philosophy, and rigorous business knowledge.',
  'Explore Catalog'
FROM organizations o
WHERE o.slug = 'flemela'
ON CONFLICT (org_id) DO UPDATE SET
  slug = 'flemela',
  status = 'published',
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2. Unify All Products, Categories & Inventory Under Flemela Organization
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  flagship_org_id UUID;
BEGIN
  SELECT id INTO flagship_org_id FROM organizations WHERE slug = 'flemela' LIMIT 1;

  IF flagship_org_id IS NOT NULL THEN
    -- Reassign all categories and products to the flagship organization
    UPDATE categories SET org_id = flagship_org_id WHERE org_id != flagship_org_id;
    UPDATE products SET org_id = flagship_org_id WHERE org_id != flagship_org_id;
    UPDATE product_variants SET org_id = flagship_org_id WHERE org_id != flagship_org_id;
    UPDATE merchant_locations SET org_id = flagship_org_id WHERE org_id != flagship_org_id;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Fortify Foreign Key Constraints for Total Safe Cascading Deletion
-- ---------------------------------------------------------------------------

-- A. Product Images -> Cascade on product delete
ALTER TABLE product_images DROP CONSTRAINT IF EXISTS product_images_product_id_fkey;
ALTER TABLE product_images
  ADD CONSTRAINT product_images_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- B. Inventory -> Cascade on product delete
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_product_id_fkey;
ALTER TABLE inventory
  ADD CONSTRAINT inventory_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- C. Product Formats -> Cascade on product delete
ALTER TABLE product_formats DROP CONSTRAINT IF EXISTS product_formats_product_id_fkey;
ALTER TABLE product_formats
  ADD CONSTRAINT product_formats_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- D. Product Variants -> Cascade on product delete
ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS product_variants_product_id_fkey;
ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- E. Historical Order Items -> Allow NULL product_id and set NULL on delete
-- (Preserves sales, accounting, COGS, and customer invoices without breaking deletion)
ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items
  ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_format_id_fkey;
ALTER TABLE order_items
  ADD CONSTRAINT order_items_format_id_fkey
  FOREIGN KEY (format_id) REFERENCES product_formats(id) ON DELETE SET NULL;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_variant_id_fkey;
ALTER TABLE order_items
  ADD CONSTRAINT order_items_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;