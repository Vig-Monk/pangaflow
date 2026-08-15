-- =============================================================================
-- Migration: 009_mpesa_credentials.sql
-- Soko Platform — Per-Organization Merchant M-Pesa Credentials
-- =============================================================================

CREATE TABLE org_mpesa_credentials (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL UNIQUE REFERENCES organizations(id),
  till_type           TEXT NOT NULL CHECK (till_type IN ('till', 'paybill')),
  shortcode           TEXT NOT NULL,
  store_number        TEXT, -- Optional: Store Number / Head Office for Buy Goods Tills
  consumer_key_enc    TEXT NOT NULL,
  consumer_secret_enc TEXT NOT NULL,
  passkey_enc         TEXT NOT NULL,
  environment         TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  last_verified_at    TIMESTAMPTZ,
  last_error          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_org_mpesa_credentials_updated_at
  BEFORE UPDATE ON org_mpesa_credentials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_org_mpesa_credentials_org_id ON org_mpesa_credentials(org_id);