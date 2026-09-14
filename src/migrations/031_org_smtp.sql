-- =============================================================================
-- Migration: 031_org_smtp.sql
-- Soko Platform — Per-Organization Encrypted SMTP Credentials & Custom Sender Identity
-- =============================================================================
-- Allows each tenant to configure their own SMTP mail server (Google Workspace,
-- Amazon SES, Brevo, Sendgrid, or private mail server) so customer purchase receipts
-- and digital downloads come from their sovereign brand address.
-- =============================================================================

CREATE TABLE IF NOT EXISTS org_smtp_credentials (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  smtp_host        TEXT NOT NULL,
  smtp_port        INTEGER NOT NULL DEFAULT 465,
  smtp_secure      BOOLEAN NOT NULL DEFAULT TRUE,
  smtp_user        TEXT NOT NULL,
  smtp_pass_enc    TEXT NOT NULL,         -- AES-256-GCM encrypted string (iv:authTag:ciphertext)
  from_name        TEXT NOT NULL,         -- e.g. "EbookReads Bookstore"
  from_email       TEXT NOT NULL,         -- e.g. "orders@ebookreads.co.ke"
  reply_to         TEXT,                  -- Optional reply-to address
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  last_verified_at TIMESTAMPTZ,
  last_error       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_org_smtp_credentials_updated_at ON org_smtp_credentials;
CREATE TRIGGER trg_org_smtp_credentials_updated_at
  BEFORE UPDATE ON org_smtp_credentials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- High-speed lookup index scoped by organization
CREATE INDEX IF NOT EXISTS idx_org_smtp_credentials_org_id 
  ON org_smtp_credentials(org_id);