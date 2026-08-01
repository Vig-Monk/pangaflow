// =============================================================================
// src/types/index.ts
// Shared frontend types. Mirrors the backend's JSON response shapes exactly
// (dates and NUMERIC values arrive as strings over HTTP — see backend
// models.ts for why: pg returns NUMERIC as string to preserve precision).
// =============================================================================

// ---------------------------------------------------------------------------
// Core domain types — per Prompt 1.3 spec, verbatim
// ---------------------------------------------------------------------------

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  current_balance: string;
}

export interface Transaction {
  id: string;
  type: 'sale' | 'payment' | 'adjustment';
  amount: string;
  description: string | null;
  balance_after: string;
  created_at: string;
}

export interface DashboardSummary {
  total_outstanding: string;
  total_collected_today: string;
  total_sales_today: string;
  customers_with_debt: number;
  top_debtors: Array<{ id: string; name: string; balance: string }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Supporting types — needed by the API layer and stores, not in the spec's
// four core interfaces but required to type the auth flow and paginated
// endpoints end-to-end. Kept in this same file since it's the one
// "shared frontend types" file the spec designates.
// ---------------------------------------------------------------------------

/**
 * Full customer detail as returned by GET /customers/:id — a superset of
 * the list-view Customer (spec's Customer type omits fields like email/
 * address/notes that only the detail view needs).
 */
export interface CustomerDetail extends Customer {
  email: string | null;
  address: string | null;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
}

export interface AuthOrg {
  id: string;
  name: string;
  slug: string;
  business_type: string;
  plan: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: AuthUser;
  org: AuthOrg;
  tokens: TokenPair;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  orgName: string;
  businessType: 'core' | 'shop' | 'salon' | 'stays' | 'market';
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

/**
 * The backend's actual envelope (src/types/api.ts on the backend) includes
 * an optional `meta` field for paginated responses. The spec's ApiResponse<T>
 * doesn't include it, so this extended variant is used only where the
 * backend endpoint is genuinely paginated (customer list, ledger). Using
 * ApiResponse<T> directly would silently drop pagination data.
 */
export interface PaginatedApiResponse<T> extends ApiResponse<T> {
  meta?: PaginationMeta;
}

export interface CustomerLedgerResult {
  customer: { id: string; name: string; phone: string | null };
  current_balance: string;
  transactions: Transaction[];
  total: number;
}

export interface RecordTransactionPayload {
  customerId: string;
  type: 'sale' | 'payment' | 'adjustment';
  amount: number;
  description?: string;
}

export interface CreateCustomerPayload {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}