-- =============================================================================
-- Migration: 034_reset_flash_sale_badges.sql
-- Soko Platform — Clear Auto-Populated Flash Sale Badges
-- =============================================================================
-- Resets products where badge was automatically set to 'FLASH_SALE' by past
-- bulk spreadsheet imports. Guarantees that the Flash Sale shelf remains
-- strictly empty until an administrator deliberately assigns the badge.
-- =============================================================================

UPDATE products
SET badge = NULL
WHERE badge = 'FLASH_SALE';