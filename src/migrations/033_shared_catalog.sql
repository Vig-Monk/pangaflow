-- =============================================================================
-- Migration: 033_shared_catalog.sql
-- Soko Platform — Master Catalog Distribution & Channel Tenancy Decoupling
-- =============================================================================
-- Enables multiple storefront channels (e.g., Sunrise Bookstore and EbookReads)
-- to share a single master catalog (titles, descriptions, R2 keys, covers)
-- while maintaining 100% sovereign multi-tenant isolation for:
--  - Orders & Order Items
--  - Customers & Debt Ledgers
--  - M-Pesa Credentials & Callbacks
--  - SMTP Mailers & Sender Identities
--  - Promotional Banners & Tickers
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add Catalog Source Pointer to Organizations
-- ---------------------------------------------------------------------------

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS catalog_source_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_catalog_source
  ON organizations(catalog_source_org_id)
  WHERE catalog_source_org_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Link EbookReads to Master Catalog (Flemela / Sunrise Flagship)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  master_catalog_id UUID := 'a0000000-0000-0000-0000-000000000001';
  ebookreads_id     UUID := 'a0000000-0000-0000-0000-000000000002';
BEGIN
  -- Verify master catalog organization exists before binding
  IF EXISTS (SELECT 1 FROM organizations WHERE id = master_catalog_id) THEN
    UPDATE organizations
    SET catalog_source_org_id = master_catalog_id,
        settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{digital_only}', 'true'::jsonb, true),
        updated_at = NOW()
    WHERE id = ebookreads_id;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Composite Indexing for Accelerated Shared Catalog Queries
-- ---------------------------------------------------------------------------

-- Fast shared catalog lookups across published products
CREATE INDEX IF NOT EXISTS idx_products_shared_catalog
  ON products(org_id, status)
  WHERE deleted_at IS NULL AND status = 'published';

-- Composite index for category lookups across catalog bounds
CREATE INDEX IF NOT EXISTS idx_categories_shared_lookup
  ON categories(org_id, LOWER(TRIM(name)));