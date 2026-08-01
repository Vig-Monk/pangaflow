-- =============================================================================
-- Migration: 001_foundation.sql
-- Soko Platform — Core tenant and auth schema
-- =============================================================================
-- Run via: tsx src/migrations/run.ts
-- Every structural change must be a versioned .sql file — never manual edits.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 2. Timestamp trigger function
-- Runs once. Applies to all tables that need auto-updated_at.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 3. Organizations (tenants)
-- Every row of business data belongs to an org via org_id.
-- ---------------------------------------------------------------------------

CREATE TABLE organizations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  slug            TEXT        UNIQUE NOT NULL,
  business_type   TEXT        NOT NULL DEFAULT 'core'
                              CHECK (business_type IN ('core', 'shop', 'salon', 'stays', 'market')),
  plan            TEXT        NOT NULL DEFAULT 'free'
                              CHECK (plan IN ('free', 'pro', 'business')),
  plan_expires_at TIMESTAMPTZ,
  settings        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Users
-- A user is a person with credentials. Org membership is in org_members.
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Org membership + roles
-- One user may belong to multiple orgs (future multi-org support).
-- UNIQUE(org_id, user_id) prevents duplicate membership rows.
-- ---------------------------------------------------------------------------

CREATE TABLE org_members (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id    UUID        NOT NULL REFERENCES organizations(id),
  user_id   UUID        NOT NULL REFERENCES users(id),
  role      TEXT        NOT NULL DEFAULT 'staff'
                        CHECK (role IN ('owner', 'admin', 'staff')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 6. Refresh tokens
-- Tokens are stored as hashes — never the raw value.
-- Rotation: on every /refresh call, old token is revoked and a new one issued.
-- ---------------------------------------------------------------------------

CREATE TABLE refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id),
  token_hash TEXT        UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 7. Indexes
-- ---------------------------------------------------------------------------

-- High-frequency lookup: find org membership by user (login, token verify)
CREATE INDEX idx_org_members_user_id   ON org_members(user_id);
-- High-frequency lookup: list members of an org (admin panel, role check)
CREATE INDEX idx_org_members_org_id    ON org_members(org_id);
-- Auth lookup: find user by email on login / registration check
CREATE UNIQUE INDEX idx_users_email    ON users(email);
-- Org resolution: slug is the human-readable tenant identifier
CREATE UNIQUE INDEX idx_organizations_slug ON organizations(slug);
-- Token validation: hash lookup on every refresh call
CREATE UNIQUE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
-- Expire and revoke queries: filter by user + active tokens
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
