-- =============================================================================
-- Migration: 006_products.sql
-- Soko Platform — Products, Categories, Inventory, Images, and Stores
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Categories
-- Org-scoped product categorization.
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID        NOT NULL REFERENCES organizations(id),
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, name)
);

-- ---------------------------------------------------------------------------
-- 2. Products
-- Canonical commerce product catalog table.
-- ---------------------------------------------------------------------------
CREATE TABLE products (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID           NOT NULL REFERENCES organizations(id),
  category_id   UUID           NOT NULL REFERENCES categories(id),
  name          TEXT           NOT NULL,
  slug          TEXT           NOT NULL,
  sku           TEXT,
  description   TEXT,
  cost_price    NUMERIC(12,2),
  price         NUMERIC(12,2)  NOT NULL,
  status        TEXT           NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft', 'published', 'archived')),
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE (org_id, slug)
);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Product Images
-- Image links with Cloudinary metadata and display ordering.
-- ---------------------------------------------------------------------------
CREATE TABLE product_images (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID        NOT NULL REFERENCES products(id),
  image_url       TEXT        NOT NULL,       -- Cloudinary secure_url
  image_public_id TEXT        NOT NULL,       -- Cloudinary public_id
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4. Inventory
-- Server-authoritative inventory tracking table.
-- ---------------------------------------------------------------------------
CREATE TABLE inventory (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID        NOT NULL UNIQUE REFERENCES products(id),
  stock        INTEGER     NOT NULL DEFAULT 0 CHECK (stock >= 0),
  low_stock_at INTEGER     NOT NULL DEFAULT 5,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Stores
-- Public-facing store configuration mapped 1:1 with organizations.
-- ---------------------------------------------------------------------------
CREATE TABLE stores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL UNIQUE REFERENCES organizations(id),
  slug              TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  logo_url          TEXT,
  cover_image_url   TEXT,
  contact_phone     TEXT,
  contact_email     TEXT,
  location          TEXT,
  delivery_info     TEXT,
  status            TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'published', 'suspended')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_categories_org_id      ON categories(org_id);
CREATE INDEX idx_products_org_id        ON products(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_org_status    ON products(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_category_id   ON products(category_id);
CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE INDEX idx_inventory_product_id   ON inventory(product_id);