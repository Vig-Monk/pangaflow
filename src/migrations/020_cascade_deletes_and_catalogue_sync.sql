-- =============================================================================
-- Migration: 020_cascade_deletes_and_catalogue_sync.sql
-- Soko Platform — Total Cascading Deletes & Safe Flagship Unification
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Ensure Flagship Organization & Admin User
-- ---------------------------------------------------------------------------

INSERT INTO organizations (name, slug, business_type, plan, plan_expires_at)
VALUES ('Flemela Bookstore', 'flemela', 'books', 'lifetime', NULL)
ON CONFLICT (slug) DO UPDATE SET
  business_type = 'books',
  plan = 'lifetime',
  deleted_at = NULL,
  updated_at = NOW();

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

INSERT INTO org_members (org_id, user_id, role)
SELECT o.id, u.id, 'owner'
FROM organizations o
CROSS JOIN users u
WHERE o.slug = 'flemela' AND LOWER(u.email) = 'admin@flemela.co.ke'
ON CONFLICT (org_id, user_id) DO UPDATE SET
  role = 'owner';

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
-- 2. Safe Deduplicated Catalog & Category Re-mapping
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  flagship_org_id UUID;
  old_cat RECORD;
  canonical_cat_id UUID;
BEGIN
  SELECT id INTO flagship_org_id FROM organizations WHERE slug = 'flemela' LIMIT 1;

  IF flagship_org_id IS NOT NULL THEN
    -- A. Ensure canonical categories exist for the flagship organization
    INSERT INTO categories (org_id, name)
    SELECT flagship_org_id, c_name
    FROM (VALUES 
      ('Business & Finance'),
      ('Psychology & Self-Help'),
      ('Self-Help'),
      ('Fiction & Literature'),
      ('Christian Books'),
      ('Education & Textbooks'),
      ('Biographies & Memoir'),
      ('General')
    ) AS v(c_name)
    ON CONFLICT (org_id, name) DO NOTHING;

    -- B. Re-map products pointing to other org categories without violating UNIQUE(org_id, name)
    FOR old_cat IN SELECT id, name FROM categories WHERE org_id != flagship_org_id LOOP
      SELECT id INTO canonical_cat_id 
      FROM categories 
      WHERE org_id = flagship_org_id AND LOWER(name) = LOWER(old_cat.name) 
      LIMIT 1;

      IF canonical_cat_id IS NULL THEN
        SELECT id INTO canonical_cat_id 
        FROM categories 
        WHERE org_id = flagship_org_id AND name = 'General' 
        LIMIT 1;
      END IF;

      UPDATE products SET category_id = canonical_cat_id WHERE category_id = old_cat.id;
    END LOOP;

    -- C. Delete orphaned non-flagship categories
    DELETE FROM categories WHERE org_id != flagship_org_id;

    -- D. Prevent product slug collisions before moving org_id
    UPDATE products p
    SET slug = p.slug || '-' || SUBSTRING(p.id::text FROM 1 FOR 6)
    WHERE p.org_id != flagship_org_id
      AND EXISTS (
        SELECT 1 FROM products p2 
        WHERE p2.org_id = flagship_org_id AND LOWER(p2.slug) = LOWER(p.slug)
      );

    -- E. Reassign products & variants
    UPDATE products SET org_id = flagship_org_id WHERE org_id != flagship_org_id;
    UPDATE product_variants SET org_id = flagship_org_id WHERE org_id != flagship_org_id;

    -- F. Remove duplicate locations to prevent UNIQUE(org_id) collision
    DELETE FROM merchant_locations WHERE org_id != flagship_org_id;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Isolated Foreign Key Cascades & Historical Order Protection
-- ---------------------------------------------------------------------------

-- Product Images
ALTER TABLE product_images DROP CONSTRAINT IF EXISTS product_images_product_id_fkey;
ALTER TABLE product_images ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Inventory
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_product_id_fkey;
ALTER TABLE inventory ADD CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Product Formats
ALTER TABLE product_formats DROP CONSTRAINT IF EXISTS product_formats_product_id_fkey;
ALTER TABLE product_formats ADD CONSTRAINT product_formats_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Product Variants
ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS product_variants_product_id_fkey;
ALTER TABLE product_variants ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Order Items (Drop NOT NULL on product_id so historical records are preserved upon book deletion)
ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_format_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_format_id_fkey FOREIGN KEY (format_id) REFERENCES product_formats(id) ON DELETE SET NULL;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_variant_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;