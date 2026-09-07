-- =============================================================================
-- Migration: 028_order_payment_reference.sql
-- Soko Platform — First-Class Payment Reference & Fast Admin Order Search
-- =============================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_reference TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_org_payment_ref
  ON orders(org_id, UPPER(TRIM(payment_reference)))
  WHERE payment_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_org_payment_method
  ON orders(org_id, payment_method);