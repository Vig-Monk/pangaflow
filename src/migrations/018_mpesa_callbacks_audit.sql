-- =============================================================================
-- Migration: 018_mpesa_callbacks_audit.sql
-- Soko Platform — Raw M-Pesa Callback Forensics & Idempotency Audit Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS mpesa_callbacks (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_id TEXT        NOT NULL,
  merchant_request_id TEXT,
  result_code         INTEGER,
  raw_payload         JSONB       NOT NULL,
  processed           BOOLEAN     NOT NULL DEFAULT FALSE,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for correlation lookups and forensics
CREATE INDEX IF NOT EXISTS idx_mpesa_callbacks_checkout_id ON mpesa_callbacks(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_callbacks_created_at ON mpesa_callbacks(created_at DESC);