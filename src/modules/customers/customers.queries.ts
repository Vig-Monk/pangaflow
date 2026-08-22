// =============================================================================
// src/modules/customers/customers.queries.ts
// =============================================================================

import { query } from '../../config/db';
import { Customer } from '../../types/models';

export interface CustomerWithBalance extends Customer {
  current_balance: string;
}

export interface CreateCustomerInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
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

const BALANCE_EXPRESSION = `
  COALESCE(
    (
      SELECT t.balance_after::NUMERIC
      FROM   transactions t
      WHERE  t.customer_id = c.id
        AND  t.org_id      = c.org_id
      ORDER  BY t.created_at DESC
      LIMIT  1
    ),
    0.00
  )
`;

const BALANCE_SUBQUERY = `(${BALANCE_EXPRESSION})::text AS current_balance`;

export async function listCustomers(
  orgId: string,
  options: ListCustomersOptions
): Promise<PaginatedCustomers> {
  const { search, page, limit, includeArchived = false } = options;
  const offset = (page - 1) * limit;

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
    conditions.push(
      `(c.name ILIKE $${paramIndex} OR c.phone ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex})`
    );
    params.push(`%${search.trim()}%`);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM customers c WHERE ${whereClause}`,
    params
  );

  const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

  if (total === 0) {
    return { customers: [], total: 0 };
  }

  const dataParams = [...params, limit, offset];

  const dataResult = await query<CustomerWithBalance>(
    `SELECT
       c.id, c.org_id, c.name, c.phone, c.email, c.address,
       c.notes, c.metadata, c.is_archived,
       c.created_at, c.updated_at, c.deleted_at,
       ${BALANCE_SUBQUERY}
     FROM   customers c
     WHERE  ${whereClause}
     ORDER  BY (CASE WHEN (${BALANCE_EXPRESSION}) > 0 THEN 0 ELSE 1 END), c.created_at DESC, c.name ASC
     LIMIT  $${paramIndex} OFFSET $${paramIndex + 1}`,
    dataParams
  );

  return { customers: dataResult.rows, total };
}

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
      data.name.trim(),
      data.phone?.trim() || null,
      data.email?.trim() || null,
      data.address?.trim() || null,
      data.notes?.trim() || null,
      JSON.stringify(data.metadata ?? {}),
    ]
  );

  return result.rows[0];
}

export async function updateCustomer(
  orgId: string,
  customerId: string,
  fields: Partial<UpdateCustomerInput>
): Promise<CustomerWithBalance | null> {
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
      params.push(key === 'metadata' && value !== null && value !== undefined
        ? JSON.stringify(value)
        : (value ?? null)
      );
      paramIndex++;
    }
  }

  if (setClauses.length === 0) {
    return getCustomerById(orgId, customerId);
  }

  const result = await query<CustomerWithBalance>(
    `UPDATE customers c
     SET    ${setClauses.join(', ')}, updated_at = NOW()
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

export async function archiveCustomer(
  orgId: string,
  customerId: string
): Promise<void> {
  await query(
    `UPDATE customers
     SET    is_archived = TRUE, updated_at = NOW()
     WHERE  org_id      = $1
       AND  id          = $2
       AND  deleted_at  IS NULL`,
    [orgId, customerId]
  );
}

export async function deleteCustomer(
  orgId: string,
  customerId: string
): Promise<{ deleted: boolean; permanent: boolean }> {
  const txCheck = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM transactions WHERE org_id = $1 AND customer_id = $2`,
    [orgId, customerId]
  );
  const txCount = parseInt(txCheck.rows[0]?.count || '0', 10);

  const mpesaCheck = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM mpesa_transactions WHERE org_id = $1 AND customer_id = $2`,
    [orgId, customerId]
  );
  const mpesaCount = parseInt(mpesaCheck.rows[0]?.count || '0', 10);

  if (txCount === 0 && mpesaCount === 0) {
    await query(
      `DELETE FROM customers WHERE org_id = $1 AND id = $2`,
      [orgId, customerId]
    );
    return { deleted: true, permanent: true };
  } else {
    await query(
      `UPDATE customers
       SET    deleted_at = NOW(), updated_at = NOW()
       WHERE  org_id     = $1
         AND  id         = $2
         AND  deleted_at IS NULL`,
      [orgId, customerId]
    );
    return { deleted: true, permanent: false };
  }
}

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
     ORDER  BY (CASE WHEN (${BALANCE_EXPRESSION}) > 0 THEN 0 ELSE 1 END), c.created_at DESC, c.name ASC
     LIMIT  20`,
    [orgId, `%${searchQuery.trim()}%`]
  );

  return result.rows;
}