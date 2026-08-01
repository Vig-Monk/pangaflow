-- =============================================================================
-- Migration: 003_mpesa.sql
-- Soko Platform — M-Pesa STK Push transaction tracking
-- =============================================================================
-- Tracks the full lifecycle of an STK Push request: initiated (pending),
-- then updated by the Daraja callback to either completed or failed.
-- checkout_request_id is the join key between the STK Push response and
-- the later callback — Safaricom's callback body carries this same ID.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. M-Pesa transactions
-- ---------------------------------------------------------------------------

CREATE TABLE mpesa_transactions (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID           NOT NULL REFERENCES organizations(id),
  customer_id           UUID           REFERENCES customers(id),
  checkout_request_id   TEXT           UNIQUE NOT NULL,
  merchant_request_id   TEXT           NOT NULL,
  phone                 TEXT           NOT NULL,
  amount                NUMERIC(12,2)  NOT NULL,
  account_reference     TEXT           NOT NULL,
  transaction_desc      TEXT           NOT NULL,
  status                TEXT           NOT NULL DEFAULT 'pending'
                                       CHECK (status IN ('pending', 'completed', 'failed')),
  result_code           INTEGER,
  result_desc           TEXT,
  mpesa_receipt_number  TEXT,
  transaction_date      TIMESTAMPTZ,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_mpesa_transactions_updated_at
  BEFORE UPDATE ON mpesa_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------

-- The callback's only handle on which row to update — every callback
-- does exactly one lookup by this column, so it must be indexed (the
-- UNIQUE constraint above already creates one, this is explicit for clarity)
CREATE UNIQUE INDEX idx_mpesa_tx_checkout_id ON mpesa_transactions(checkout_request_id);

-- Tenant-scoped queries (payment history, reconciliation dashboards)
CREATE INDEX idx_mpesa_tx_org_id ON mpesa_transactions(org_id);

-- Per-customer payment history lookup
CREATE INDEX idx_mpesa_tx_customer_id ON mpesa_transactions(customer_id) WHERE customer_id IS NOT NULL;

-- Status filtering — e.g. a cron sweeping stuck 'pending' rows older than
-- N minutes (STK Push requests that never got a callback)
CREATE INDEX idx_mpesa_tx_status ON mpesa_transactions(status);