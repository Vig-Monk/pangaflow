-- =============================================================================
-- Migration: 022_snapshot_digital_downloads.sql
-- Soko Platform — Resilient Digital Downloads Snapshots & Extended Quotas
-- =============================================================================

-- 1. Add Asset Snapshot Columns to digital_downloads
ALTER TABLE digital_downloads
  ADD COLUMN IF NOT EXISTS book_title       TEXT,
  ADD COLUMN IF NOT EXISTS format           TEXT CHECK (format IN ('pdf', 'epub')),
  ADD COLUMN IF NOT EXISTS file_url         TEXT,
  ADD COLUMN IF NOT EXISTS file_public_id   TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes  BIGINT,
  ADD COLUMN IF NOT EXISTS last_download_at TIMESTAMPTZ;

-- 2. Backfill Existing Download Records from Products & Formats
UPDATE digital_downloads dd
SET book_title      = p.name,
    format          = pf.format,
    file_url        = pf.file_url,
    file_public_id  = pf.file_public_id,
    file_size_bytes = pf.file_size_bytes
FROM product_formats pf
JOIN products p ON p.id = pf.product_id
WHERE dd.format_id = pf.id
  AND dd.book_title IS NULL;

-- 3. Decouple format_id from Deletion Destruction (SET NULL)
ALTER TABLE digital_downloads ALTER COLUMN format_id DROP NOT NULL;

ALTER TABLE digital_downloads DROP CONSTRAINT IF EXISTS digital_downloads_format_id_fkey;
ALTER TABLE digital_downloads ADD CONSTRAINT digital_downloads_format_id_fkey
  FOREIGN KEY (format_id) REFERENCES product_formats(id) ON DELETE SET NULL;

-- 4. Increase Default Download Limit to 15 Attempts
ALTER TABLE digital_downloads ALTER COLUMN max_downloads SET DEFAULT 15;

-- 5. Indexing for Fast Token Resolution
CREATE INDEX IF NOT EXISTS idx_digital_downloads_token_res
  ON digital_downloads(download_token, expires_at);