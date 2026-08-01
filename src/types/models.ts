// =============================================================================
// src/types/models.ts
// Canonical domain types — mirror the database schema field-for-field.
// snake_case throughout: this is what the raw `pg` driver returns.
// See README Section 22, "TypeScript ↔ Database Type Mapping".
// =============================================================================

// ---------------------------------------------------------------------------
// Organizations (tenants)
// ---------------------------------------------------------------------------

export type BusinessType = 'core' | 'shop' | 'salon' | 'stays' | 'market';
export type PlanName = 'free' | 'pro' | 'business';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  business_type: BusinessType;
  plan: PlanName;
  plan_expires_at: Date | null;
  settings: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

// ---------------------------------------------------------------------------
// Org membership + roles
// ---------------------------------------------------------------------------

export type Role = 'owner' | 'admin' | 'staff';

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: Role;
  joined_at: Date;
}

// ---------------------------------------------------------------------------
// Refresh tokens
// ---------------------------------------------------------------------------

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export interface Customer {
  id: string;
  org_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

// ---------------------------------------------------------------------------
// Transactions (credit ledger)
// ---------------------------------------------------------------------------

export type TransactionType = 'sale' | 'payment' | 'adjustment';

export interface Transaction {
  id: string;
  org_id: string;
  customer_id: string;
  type: TransactionType;
  amount: string; // pg returns NUMERIC as string — parseFloat() where arithmetic is needed
  description: string | null;
  balance_after: string;
  created_by: string | null;
  created_at: Date;
}