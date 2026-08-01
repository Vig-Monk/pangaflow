-- =============================================================================
-- Migration: 005_expenses.sql
-- Soko Platform — Expense tracking + categories
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Expense categories
-- Per-org, not global — see design note above. Each org builds its own
-- category list (Rent, Utilities, Stock/Supplies, Transport, etc.).
-- ---------------------------------------------------------------------------

CREATE TABLE expense_categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID        NOT NULL REFERENCES organizations(id),
  name       TEXT        NOT NULL,
  color      TEXT        NOT NULL DEFAULT '#64748B',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, name)
);

-- ---------------------------------------------------------------------------
-- 2. Expenses
-- ---------------------------------------------------------------------------

CREATE TABLE expenses (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID           NOT NULL REFERENCES organizations(id),
  category_id     UUID           NOT NULL REFERENCES expense_categories(id),
  amount          NUMERIC(12,2)  NOT NULL,
  vendor          TEXT,
  description     TEXT,
  receipt_url     TEXT,
  expense_date    DATE           NOT NULL DEFAULT CURRENT_DATE,
  is_recurring    BOOLEAN        NOT NULL DEFAULT FALSE,
  recurrence_day  INTEGER        CHECK (recurrence_day BETWEEN 1 AND 31),
  created_by      UUID           REFERENCES users(id),
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

-- Tenant-scoped category list (populating a dropdown, category management UI)
CREATE INDEX idx_expense_categories_org_id ON expense_categories(org_id);

-- Tenant-scoped expense queries — dashboard, listExpenses, expense summary
CREATE INDEX idx_expenses_org_id ON expenses(org_id);
-- getExpenseSummary's by_category grouping and the FK join both hit this
CREATE INDEX idx_expenses_category_id ON expenses(category_id);
-- listExpenses filters and getExpenseSummary's date-range filtering both
-- need org_id + expense_date together — combined index, not two separate ones
CREATE INDEX idx_expenses_org_date ON expenses(org_id, expense_date);
-- getFullDashboard's today/this_month expense sums filter on this combination
CREATE INDEX idx_expenses_org_date_amount ON expenses(org_id, expense_date) INCLUDE (amount);