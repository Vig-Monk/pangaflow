-- =============================================================================
-- Migration: 027_relax_banner_not_null.sql
-- Soko Platform — Relax NOT NULL Constraints on Optional Hero Banner Fields
-- =============================================================================

ALTER TABLE store_banners ALTER COLUMN title DROP NOT NULL;
ALTER TABLE store_banners ALTER COLUMN cta_label DROP NOT NULL;
ALTER TABLE store_banners ALTER COLUMN cta_link DROP NOT NULL;