-- =============================================================================
-- Migration: 025_hero_banners.sql
-- Soko Platform — Dynamic Hero Banners with Infinite Carousel & Scheduling
-- =============================================================================

-- 1. Create Dedicated Banners Table
CREATE TABLE IF NOT EXISTS store_banners (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  subtitle         TEXT,
  badge            TEXT,                               -- e.g., "FLASH SALE", "LIMITED TIME", "STAFF PICK"
  image_url        TEXT NOT NULL,                      -- Desktop banner (Cloudinary secure URL)
  mobile_image_url TEXT,                               -- Optional portrait-optimized banner for mobile
  cta_label        TEXT NOT NULL DEFAULT 'Explore',    -- Button text
  cta_link         TEXT NOT NULL DEFAULT '/#catalog-results', -- Target route or anchor
  bg_color         TEXT NOT NULL DEFAULT '#052219',    -- Brand dark-pine fallback preventing CLS layout shifts
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at        TIMESTAMPTZ,                        -- Scheduled campaign start
  ends_at          TIMESTAMPTZ,                        -- Auto-expiration timestamp
  click_count      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Timestamp Trigger
DROP TRIGGER IF EXISTS trg_store_banners_updated_at ON store_banners;
CREATE TRIGGER trg_store_banners_updated_at
  BEFORE UPDATE ON store_banners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Composite Indexes for Instant Storefront Delivery
CREATE INDEX IF NOT EXISTS idx_store_banners_active_sort
  ON store_banners(org_id, sort_order ASC, created_at DESC)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_store_banners_scheduling
  ON store_banners(org_id, starts_at, ends_at)
  WHERE is_active = TRUE;