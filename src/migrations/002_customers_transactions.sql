-- =============================================================================
-- Migration: 002_customers_transactions.sql
-- Soko Platform — Customer registry and credit ledger
-- =============================================================================
-- CRITICAL: recordTransaction() in application code must always compute
-- balance_after in a single atomic pg transaction — never in application logic.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Customers
-- Universal across all verticals. Every business has customers.
-- ---------------------------------------------------------------------------

CREATE TABLE customers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES organizations(id),
  name        TEXT        NOT NULL,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  notes       TEXT,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  is_archived BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Transactions (credit ledger)
-- Core product for lite version. Records every sale, payment, adjustment.
-- balance_after is computed at write time and stored — never recomputed.
-- ---------------------------------------------------------------------------

CREATE TABLE transactions (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID           NOT NULL REFERENCES organizations(id),
  customer_id   UUID           NOT NULL REFERENCES customers(id),
  type          TEXT           NOT NULL
                               CHECK (type IN ('sale', 'payment', 'adjustment')),
  amount        NUMERIC(12,2)  NOT NULL,
  description   TEXT,
  balance_after NUMERIC(12,2)  NOT NULL,
  created_by    UUID           REFERENCES users(id),
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Note: transactions has no updated_at — ledger entries are immutable.
-- Corrections are recorded as new 'adjustment' rows, never edits.

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

-- Tenant-scoped customer queries (list, search) — partial index excludes
-- soft-deleted rows from every scan, keeping the index small and fast.
CREATE INDEX idx_customers_org_id     ON customers(org_id) WHERE deleted_at IS NULL;
-- Customer lookup by org + archived state (list active customers)
CREATE INDEX idx_customers_org_archived ON customers(org_id, is_archived) WHERE deleted_at IS NULL;

-- Tenant-scoped transaction queries (dashboard, ledger)
CREATE INDEX idx_transactions_org_id  ON transactions(org_id);
-- Per-customer ledger lookup (most recent balance, full history)
CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);
-- Combined index: most common query pattern — org + customer + ordered by time
CREATE INDEX idx_transactions_org_customer ON transactions(org_id, customer_id, created_at DESC);
