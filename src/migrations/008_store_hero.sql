-- =============================================================================
-- Migration: 008_store_hero.sql
-- Soko Platform — Additive Store Hero Configuration Fields
-- =============================================================================

ALTER TABLE stores ADD COLUMN IF NOT EXISTS hero_layout       TEXT    DEFAULT 'editorial';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS hero_headline     TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS hero_subheadline  TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS hero_cta_label    TEXT;