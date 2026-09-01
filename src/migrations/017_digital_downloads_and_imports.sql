-- =============================================================================
-- Migration: 017_digital_downloads_and_imports.sql
-- Soko Platform — Tokenized Digital Downloads & Async Spreadsheet Import Jobs
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Digital Downloads (Expiring Tokenized Access)
-- ---------------------------------------------------------------------------

CREATE TABLE digital_downloads (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id   UUID        NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  format_id       UUID        NOT NULL REFERENCES product_formats(id) ON DELETE CASCADE,
  download_token  TEXT        UNIQUE NOT NULL,
  max_downloads   INTEGER     NOT NULL DEFAULT 5 CHECK (max_downloads > 0),
  download_count  INTEGER     NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. Import Jobs (Asynchronous Bulk Catalog Ingestion)
-- ---------------------------------------------------------------------------

CREATE TABLE import_jobs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source          TEXT        NOT NULL CHECK (source IN ('excel', 'google_sheet')),
  status          TEXT        NOT NULL DEFAULT 'queued'
                              CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  total_rows      INTEGER,
  processed_rows  INTEGER     NOT NULL DEFAULT 0,
  error_rows      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

-- Public download route verification lookup
CREATE UNIQUE INDEX idx_digital_downloads_token ON digital_downloads(download_token);

-- Fulfillment lookup by order item
CREATE INDEX idx_digital_downloads_order_item_id ON digital_downloads(order_item_id);

-- Import job queue lookup by organization
CREATE INDEX idx_import_jobs_org_id ON import_jobs(org_id);
CREATE INDEX idx_import_jobs_status ON import_jobs(status);