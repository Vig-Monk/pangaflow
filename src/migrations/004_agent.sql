-- =============================================================================
-- Migration: 004_agent.sql
-- Soko Platform — Wakulima Market agent errand module
-- =============================================================================
-- A market agent runs procurement errands on behalf of clients: the
-- client requests items, the agent buys them at Wakulima market and
-- delivers them, charging a service fee plus a markup over produce cost.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Agent clients
-- The people/businesses who place recurring procurement orders with an agent.
-- ---------------------------------------------------------------------------

CREATE TABLE agent_clients (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL REFERENCES organizations(id),
  name             TEXT        NOT NULL,
  phone            TEXT        NOT NULL,
  delivery_address TEXT        NOT NULL,
  regular_items    JSONB       NOT NULL DEFAULT '[]',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. Agent orders
-- One procurement errand for one client. Financial fields are entered as
-- the order progresses (produce_cost is unknown until the agent actually
-- buys at market), not computed atomically like the credit ledger's
-- balance_after — this is outcome data, not a running balance.
-- ---------------------------------------------------------------------------

CREATE TABLE agent_orders (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID           NOT NULL REFERENCES organizations(id),
  client_id         UUID           NOT NULL REFERENCES agent_clients(id),
  items             JSONB          NOT NULL DEFAULT '[]',
  service_fee       NUMERIC(12,2)  NOT NULL DEFAULT 0,
  produce_cost      NUMERIC(12,2)  NOT NULL DEFAULT 0,
  markup_total      NUMERIC(12,2)  NOT NULL DEFAULT 0,
  total_collected   NUMERIC(12,2)  NOT NULL DEFAULT 0,
  status            TEXT           NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending', 'confirmed', 'buying', 'delivering', 'done', 'cancelled')),
  delivery_address  TEXT           NOT NULL,
  special_notes     TEXT,
  order_date        DATE           NOT NULL DEFAULT CURRENT_DATE,
  delivered_at      TIMESTAMPTZ,
  payment_method    TEXT,
  mpesa_ref         TEXT,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

-- Tenant-scoped client list (the agent's own client roster)
CREATE INDEX idx_agent_clients_org_id ON agent_clients(org_id);

-- Tenant-scoped order queries (dashboard, order history)
CREATE INDEX idx_agent_orders_org_id ON agent_orders(org_id);
-- Per-client order history
CREATE INDEX idx_agent_orders_client_id ON agent_orders(client_id);
-- getTodayOrders() and the dashboard's today_earnings both filter on
-- order_date — this is the single most frequent query pattern in the
-- module, so org_id + order_date is a combined index, not two separate ones.
CREATE INDEX idx_agent_orders_org_date ON agent_orders(org_id, order_date);
-- Status filtering (e.g. "show me everything still 'buying' right now")
CREATE INDEX idx_agent_orders_status ON agent_orders(org_id, status);