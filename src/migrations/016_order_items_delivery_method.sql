-- =============================================================================
-- Migration: 016_order_items_delivery_method.sql
-- Soko Platform — Link Order Line Items to Specific Formats & Delivery Channels
-- =============================================================================

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS format_id UUID REFERENCES product_formats(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'digital'
    CHECK (delivery_method IN ('digital', 'pickup', 'delivery'));

-- Index to accelerate order line item format lookups during digital fulfillment
CREATE INDEX IF NOT EXISTS idx_order_items_format_id ON order_items(format_id);