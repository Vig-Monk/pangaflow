-- =============================================================================
-- Migration: 035_store_hero_notes.sql
-- Soko Platform — Storefront Hero Right-Side Rich-Text Notes
-- =============================================================================

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS hero_notes JSONB NOT NULL DEFAULT '{
    "is_active": false,
    "title": "Reader Announcements",
    "content_html": "<p>Welcome to <strong>The Sunrise Bookstore</strong>. Instant eBook downloads and physical deliveries across Nairobi.</p>",
    "bg_color": "#FAF7F0",
    "text_color": "#141E1A"
  }'::jsonb;

-- Composite index to accelerate public store metadata resolution with notes
CREATE INDEX IF NOT EXISTS idx_stores_org_hero_notes
  ON stores(org_id)
  INCLUDE (hero_notes);