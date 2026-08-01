// =============================================================================
// src/modules/customers/customers.queries.ts
// Database access layer — customers module. Raw pg only. No business logic.
//
// Tenancy rule: orgId is the FIRST required typed parameter on every function
// that touches tenant-scoped data. Omitting it is a compile error.
// =============================================================================

import { query } from '../../config/db';
import { Customer } from '../../types/models';

// ---------------------------------------------------------------------------
// Extended types
// ---------------------------------------------------------------------------

/**
 * Customer row augmented with their running credit balance.
 * current_balance is computed from the transactions table via a subquery —
 * never stored on the customers row itself, so it is always current.
 * pg returns NUMERIC as string; callers use parseFloat() where arithmetic
 * is needed. See README Section 22 TypeScript ↔ Database Type Mapping.
 */
export interface CustomerWithBalance extends Customer {
  current_balance: string;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateCustomerInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateCustomerInput {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ListCustomersOptions {
  search?: string;
  page: number;
  limit: number;
  includeArchived?: boolean;
}

export interface PaginatedCustomers {
  customers: CustomerWithBalance[];
  total: number;
}

// ---------------------------------------------------------------------------
// Balance subquery
// Reused across listCustomers, getCustomerById, searchCustomers.
// Returns 0.00 for customers with no transactions (LEFT JOIN + COALESCE).
// The ORDER BY + LIMIT 1 on created_at DESC gets the most recent
// balance_after, which is the current running balance by ledger design.
// ---------------------------------------------------------------------------

const BALANCE_SUBQUERY = `
  COALESCE(
    (
      SELECT t.balance_after::text
      FROM   transactions t
      WHERE  t.customer_id = c.id
        AND  t.org_id      = c.org_id
      ORDER  BY t.created_at DESC
      LIMIT  1
    ),
    '0.00'
  ) AS current_balance
`;

// ---------------------------------------------------------------------------
// listCustomers
// ---------------------------------------------------------------------------

/**
 * Returns a paginated list of customers for an org, each with their current
 * credit balance. Supports optional full-text search across name, phone, and
 * email. Excludes soft-deleted customers in all cases.
 */
export async function listCustomers(
  orgId: string,
  options: ListCustomersOptions
): Promise<PaginatedCustomers> {
  const { search, page, limit, includeArchived = false } = options;
  const offset = (page - 1) * limit;

  // Build the WHERE clauses incrementally so the parameterised query stays
  // legible without string concatenation near the actual values.
  const conditions: string[] = [
    'c.org_id     = $1',
    'c.deleted_at IS NULL',
  ];
  const params: unknown[] = [orgId];
  let paramIndex = 2;

  if (!includeArchived) {
    conditions.push('c.is_archived = FALSE');
  }

  if (search && search.trim().length > 0) {
    // Case-insensitive substring match across the three most-searched fields.
    conditions.push(
      `(c.name ILIKE $${paramIndex} OR c.phone ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex})`
    );
    params.push(`%${search.trim()}%`);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  // COUNT query — same filters, no pagination
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM customers c WHERE ${whereClause}`,
    params
  );

  const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

  if (total === 0) {
    return { customers: [], total: 0 };
  }

  // Data query — add pagination params after the shared WHERE params
  const dataParams = [...params, limit, offset];

  const dataResult = await query<CustomerWithBalance>(
    `SELECT
       c.id, c.org_id, c.name, c.phone, c.email, c.address,
       c.notes, c.metadata, c.is_archived,
       c.created_at, c.updated_at, c.deleted_at,
       ${BALANCE_SUBQUERY}
     FROM   customers c
     WHERE  ${whereClause}
     ORDER  BY c.name ASC
     LIMIT  $${paramIndex} OFFSET $${paramIndex + 1}`,
    dataParams
  );

  return { customers: dataResult.rows, total };
}

// ---------------------------------------------------------------------------
// getCustomerById
// ---------------------------------------------------------------------------

/**
 * Fetches a single customer by id, scoped to the org. Returns null if the
 * customer does not exist, belongs to a different org, or has been soft-deleted.
 * Always includes current_balance.
 */
export async function getCustomerById(
  orgId: string,
  customerId: string
): Promise<CustomerWithBalance | null> {
  const result = await query<CustomerWithBalance>(
    `SELECT
       c.id, c.org_id, c.name, c.phone, c.email, c.address,
       c.notes, c.metadata, c.is_archived,
       c.created_at, c.updated_at, c.deleted_at,
       ${BALANCE_SUBQUERY}
     FROM   customers c
     WHERE  c.org_id     = $1
       AND  c.id         = $2
       AND  c.deleted_at IS NULL`,
    [orgId, customerId]
  );

  return result.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// createCustomer
// ---------------------------------------------------------------------------

/**
 * Creates a new customer for an org. Returns the created row without
 * current_balance — the caller should use getCustomerById if it needs the
 * full CustomerWithBalance shape immediately after creation (balance is 0
 * at creation time, so the controller simply returns 0.00 directly).
 */
export async function createCustomer(
  orgId: string,
  data: CreateCustomerInput
): Promise<Customer> {
  const result = await query<Customer>(
    `INSERT INTO customers
       (org_id, name, phone, email, address, notes, metadata)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7)
     RETURNING
       id, org_id, name, phone, email, address,
       notes, metadata, is_archived,
       created_at, updated_at, deleted_at`,
    [
      orgId,
      data.name,
      data.phone   ?? null,
      data.email   ?? null,
      data.address ?? null,
      data.notes   ?? null,
      JSON.stringify(data.metadata ?? {}),
    ]
  );

  return result.rows[0];
}

// ---------------------------------------------------------------------------
// updateCustomer
// ---------------------------------------------------------------------------

/**
 * Applies a partial update to a customer. Only the fields present in
 * `fields` are updated — undefined fields leave the existing DB value
 * unchanged. Returns the updated CustomerWithBalance, or null if the
 * customer does not exist in this org.
 *
 * Dynamic SET clause: built from the keys present in `fields` using
 * parameterised placeholders — never string interpolation of user values.
 */
export async function updateCustomer(
  orgId: string,
  customerId: string,
  fields: Partial<UpdateCustomerInput>
): Promise<CustomerWithBalance | null> {
  // Map the typed input keys to their snake_case column names
  const columnMap: Record<keyof UpdateCustomerInput, string> = {
    name:     'name',
    phone:    'phone',
    email:    'email',
    address:  'address',
    notes:    'notes',
    metadata: 'metadata',
  };

  const setClauses: string[] = [];
  const params: unknown[]    = [orgId, customerId];
  let paramIndex             = 3;

  for (const [key, column] of Object.entries(columnMap) as [keyof UpdateCustomerInput, string][]) {
    if (key in fields) {
      const value = fields[key];
      setClauses.push(`${column} = $${paramIndex}`);
      // JSONB column needs explicit serialisation
      params.push(key === 'metadata' && value !== null && value !== undefined
        ? JSON.stringify(value)
        : (value ?? null)
      );
      paramIndex++;
    }
  }

  if (setClauses.length === 0) {
    // No updatable fields — return the current row unchanged
    return getCustomerById(orgId, customerId);
  }

  const result = await query<CustomerWithBalance>(
    `UPDATE customers c
     SET    ${setClauses.join(', ')}
     WHERE  c.org_id     = $1
       AND  c.id         = $2
       AND  c.deleted_at IS NULL
     RETURNING
       c.id, c.org_id, c.name, c.phone, c.email, c.address,
       c.notes, c.metadata, c.is_archived,
       c.created_at, c.updated_at, c.deleted_at,
       ${BALANCE_SUBQUERY}`,
    params
  );

  return result.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// archiveCustomer
// ---------------------------------------------------------------------------

/**
 * Toggles is_archived = TRUE on a customer (soft-hide, not soft-delete).
 * Returns void — the controller re-fetches or simply 204s.
 * No-ops silently if the customer does not exist in this org.
 */
export async function archiveCustomer(
  orgId: string,
  customerId: string
): Promise<void> {
  await query(
    `UPDATE customers
     SET    is_archived = TRUE
     WHERE  org_id      = $1
       AND  id          = $2
       AND  deleted_at  IS NULL`,
    [orgId, customerId]
  );
}

// ---------------------------------------------------------------------------
// deleteCustomer (soft)
// ---------------------------------------------------------------------------

/**
 * Soft-deletes a customer by setting deleted_at. The customer disappears
 * from all queries that filter deleted_at IS NULL. This is permanent from
 * the UI's perspective — there is no undelete in the lite version.
 * Returns void. No-ops if customer not found in org.
 */
export async function deleteCustomer(
  orgId: string,
  customerId: string
): Promise<void> {
  await query(
    `UPDATE customers
     SET    deleted_at = NOW()
     WHERE  org_id     = $1
       AND  id         = $2
       AND  deleted_at IS NULL`,
    [orgId, customerId]
  );
}

// ---------------------------------------------------------------------------
// searchCustomers
// ---------------------------------------------------------------------------

/**
 * Fast, unbounded ILIKE search across name, phone, and email — intended for
 * the typeahead/search-as-you-type endpoint. Not paginated; capped at 20
 * results. Excludes archived and soft-deleted customers.
 *
 * For large orgs in Stage 2 this can be promoted to a
 * full-text tsvector index — the query interface stays identical.
 */
export async function searchCustomers(
  orgId: string,
  searchQuery: string
): Promise<CustomerWithBalance[]> {
  const result = await query<CustomerWithBalance>(
    `SELECT
       c.id, c.org_id, c.name, c.phone, c.email, c.address,
       c.notes, c.metadata, c.is_archived,
       c.created_at, c.updated_at, c.deleted_at,
       ${BALANCE_SUBQUERY}
     FROM   customers c
     WHERE  c.org_id      = $1
       AND  c.deleted_at  IS NULL
       AND  c.is_archived  = FALSE
       AND  (
              c.name  ILIKE $2 OR
              c.phone ILIKE $2 OR
              c.email ILIKE $2
            )
     ORDER  BY c.name ASC
     LIMIT  20`,
    [orgId, `%${searchQuery.trim()}%`]
  );

  return result.rows;
}