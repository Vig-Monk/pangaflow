-- =============================================================================
-- Migration: 007_orders.sql
-- Soko Platform — Orders and Order Items
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Orders Table
-- Standard transactional order record.
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
  id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID           NOT NULL REFERENCES organizations(id),
  store_id           UUID           NOT NULL REFERENCES stores(id),
  customer_name      TEXT           NOT NULL,
  customer_phone     TEXT           NOT NULL,
  customer_email     TEXT,
  delivery_location  TEXT           NOT NULL,
  notes              TEXT,
  status             TEXT           NOT NULL DEFAULT 'pending'
                                     CHECK (status IN ('pending', 'confirmed', 'fulfilled', 'cancelled')),
  payment_method     TEXT           NOT NULL,
  payment_status     TEXT           NOT NULL DEFAULT 'pending'
                                     CHECK (payment_status IN ('pending', 'paid', 'failed')),
  total              NUMERIC(12,2)  NOT NULL,
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Order Items Table
-- Snapshots product prices and details to preserve historical integrity.
-- ---------------------------------------------------------------------------
CREATE TABLE order_items (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID           NOT NULL REFERENCES orders(id),
  product_id    UUID           NOT NULL REFERENCES products(id),
  product_name  TEXT           NOT NULL,   -- snapshot product name
  unit_price    NUMERIC(12,2)  NOT NULL,   -- snapshot unit price
  quantity      INTEGER        NOT NULL CHECK (quantity > 0),
  subtotal      NUMERIC(12,2)  NOT NULL
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_orders_org_id      ON orders(org_id);
CREATE INDEX idx_orders_store_id    ON orders(store_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);