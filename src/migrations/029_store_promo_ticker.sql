-- =============================================================================
-- Migration: 029_store_promo_ticker.sql
-- Soko Platform — Storefront Rotating Promotional Ribbon Settings
-- =============================================================================

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS promo_ticker JSONB NOT NULL DEFAULT '[
    {"id": "ticker-1", "text": "⚡ FREE DELIVERY across Nairobi on orders above KSh 2,500", "link": "#catalog-results", "is_active": true, "sort_order": 0},
    {"id": "ticker-2", "text": "📖 Instant Digital Downloads", "link": "#flash-sale", "is_active": true, "sort_order": 1},
    {"id": "ticker-3", "text": "🇰🇪 Sourcing Any Book in Kenya Upon Request via WhatsApp", "link": "https://wa.me/254143304460", "is_active": true, "sort_order": 2}
  ]'::jsonb;