-- =============================================================================
-- Migration: 012_cogs_and_customer_sync.sql
-- Soko Platform — Historical COGS Snapshotting & High-Performance Analytics Indexes
-- =============================================================================
-- 1. Adds immutable cost_price snapshot column to order_items to preserve historical
--    product margins when catalog cost prices change.
-- 2. Backfills historical order_items from current products.cost_price.
-- 3. Adds high-speed composite indexes for sub-30ms financial analytics, debt aging,
--    and storefront customer auto-sync.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add cost_price column to order_items
-- ---------------------------------------------------------------------------

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) NOT NULL DEFAULT 0.00;

-- ---------------------------------------------------------------------------
-- 2. Backfill existing order_items from current products table
-- ---------------------------------------------------------------------------

UPDATE order_items oi
SET cost_price = COALESCE(p.cost_price, 0.00)
FROM products p
WHERE oi.product_id = p.id
AND oi.cost_price = 0.00
AND p.cost_price IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Composite Indexes for Analytics & Auto-Sync Acceleration
-- ---------------------------------------------------------------------------

-- Fast COGS & margin calculation across order items
CREATE INDEX IF NOT EXISTS idx_order_items_cogs ON order_items(order_id, product_id);

-- Instantaneous customer directory lookup by phone during storefront checkout
CREATE INDEX IF NOT EXISTS idx_customers_org_phone ON customers(org_id, phone) WHERE deleted_at IS NULL;

-- Ultra-fast debt aging waterfall and latest-balance CTE scans
CREATE INDEX IF NOT EXISTS idx_transactions_org_debt_aging ON transactions(org_id, customer_id, created_at DESC);

-- Fast morning dashboard order queue & revenue range queries
CREATE INDEX IF NOT EXISTS idx_orders_org_status_created ON orders(org_id, status, created_at DESC);