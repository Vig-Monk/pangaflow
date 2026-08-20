// =============================================================================
// src/modules/transactions/transactions.queries.ts
// =============================================================================

import { PoolClient } from 'pg';
import { query } from '../../config/db';
import { Transaction, TransactionType } from '../../types/models';

export interface RecordTransactionInput {
  orgId: string;
  customerId: string;
  type: TransactionType;
  amount: number;
  description?: string;
  createdBy: string | null;
}

export interface CustomerLedgerResult {
  customer: {
    id: string;
    name: string;
    phone: string | null;
  };
  current_balance: string;
  transactions: Transaction[];
  total: number;
}

export interface DashboardSummary {
  total_outstanding: string;
  total_collected_today: string;
  total_sales_today: string;
  customers_with_debt: number;
  top_debtors: Array<{ id: string; name: string; balance: string }>;
}

interface LatestBalanceRow {
  balance_after: string | null;
}

interface TransactionRow extends Transaction {}

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
}

interface LedgerCountRow {
  count: string;
}

interface OutstandingRow {
  total_outstanding: string;
  customers_with_debt: string;
}

interface CollectedTodayRow {
  total_collected_today: string;
}

interface SalesTodayRow {
  total_sales_today: string;
}

interface TopDebtorRow {
  id: string;
  name: string;
  balance: string;
}

export async function findOrCreateCustomerTransactional(
  client: PoolClient,
  orgId: string,
  data: { name: string; phone?: string | null; address?: string | null }
): Promise<{ id: string; name: string; phone: string | null }> {
  if (data.phone && data.phone.trim()) {
    const existing = await client.query<{ id: string; name: string; phone: string | null }>(
      `SELECT id, name, phone FROM customers WHERE org_id = $1 AND phone = $2 AND deleted_at IS NULL LIMIT 1`,
      [orgId, data.phone.trim()]
    );
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }
  }

  const newCust = await client.query<{ id: string; name: string; phone: string | null }>(
    `INSERT INTO customers (org_id, name, phone, address)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, phone`,
    [orgId, data.name.trim(), data.phone?.trim() || null, data.address?.trim() || null]
  );
  return newCust.rows[0];
}

export async function recordTransaction(
  client: PoolClient,
  input: RecordTransactionInput
): Promise<Transaction> {
  const balanceResult = await client.query<LatestBalanceRow>(
    `SELECT balance_after
     FROM   transactions
     WHERE  customer_id = $1
       AND  org_id      = $2
     ORDER  BY created_at DESC
     LIMIT  1`,
    [input.customerId, input.orgId]
  );

  const currentBalance: string = balanceResult.rows[0]?.balance_after ?? '0';

  const balanceExpression =
    input.type === 'payment'
      ? `$1::NUMERIC - $2::NUMERIC`
      : `$1::NUMERIC + $2::NUMERIC`;

  const newBalanceResult = await client.query<{ new_balance: string }>(
    `SELECT ${balanceExpression} AS new_balance`,
    [currentBalance, input.amount]
  );

  const newBalance = newBalanceResult.rows[0]?.new_balance ?? '0';

  const insertResult = await client.query<TransactionRow>(
    `INSERT INTO transactions
       (org_id, customer_id, type, amount, description, balance_after, created_by)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7)
     RETURNING
       id, org_id, customer_id, type,
       amount::text AS amount,
       description,
       balance_after::text AS balance_after,
       created_by,
       created_at`,
    [
      input.orgId,
      input.customerId,
      input.type,
      input.amount,
      input.description ?? null,
      newBalance,
      input.createdBy,
    ]
  );

  return insertResult.rows[0];
}

export async function getCustomerLedger(
  orgId: string,
  customerId: string,
  options: { page: number; limit: number }
): Promise<CustomerLedgerResult | null> {
  const { page, limit } = options;
  const offset = (page - 1) * limit;

  const customerResult = await query<CustomerRow>(
    `SELECT id, name, phone
     FROM   customers
     WHERE  id          = $1
       AND  org_id      = $2
       AND  deleted_at  IS NULL`,
    [customerId, orgId]
  );

  if (customerResult.rows.length === 0) {
    return null;
  }

  const customer = customerResult.rows[0];

  const countResult = await query<LedgerCountRow>(
    `SELECT COUNT(*) AS count
     FROM   transactions
     WHERE  customer_id = $1
       AND  org_id      = $2`,
    [customerId, orgId]
  );

  const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

  const balanceResult = await query<LatestBalanceRow>(
    `SELECT balance_after
     FROM   transactions
     WHERE  customer_id = $1
       AND  org_id      = $2
     ORDER  BY created_at DESC
     LIMIT  1`,
    [customerId, orgId]
  );

  const current_balance = balanceResult.rows[0]?.balance_after ?? '0.00';

  const txResult = await query<Transaction>(
    `SELECT
       id, org_id, customer_id, type,
       amount::text        AS amount,
       description,
       balance_after::text AS balance_after,
       created_by,
       created_at
     FROM   transactions
     WHERE  customer_id = $1
       AND  org_id      = $2
     ORDER  BY created_at DESC
     LIMIT  $3 OFFSET $4`,
    [customerId, orgId, limit, offset]
  );

  return {
    customer,
    current_balance,
    transactions: txResult.rows,
    total,
  };
}

export async function getDashboardSummary(
  orgId: string
): Promise<DashboardSummary> {
  const [outstandingResult, collectedResult, salesResult, topDebtorsResult] =
    await Promise.all([
      query<OutstandingRow>(
        `WITH latest_balances AS (
           SELECT DISTINCT ON (customer_id)
             customer_id,
             balance_after
           FROM   transactions
           WHERE  org_id = $1
           ORDER  BY customer_id, created_at DESC
         )
         SELECT
           COALESCE(SUM(CASE WHEN balance_after > 0 THEN balance_after ELSE 0 END), 0)::text
             AS total_outstanding,
           COUNT(CASE WHEN balance_after > 0 THEN 1 END)::text
             AS customers_with_debt
         FROM latest_balances`,
        [orgId]
      ),

      query<CollectedTodayRow>(
        `SELECT COALESCE(SUM(amount), 0)::text AS total_collected_today
         FROM   transactions
         WHERE  org_id    = $1
           AND  type      = 'payment'
           AND  created_at >= CURRENT_DATE`,
        [orgId]
      ),

      query<SalesTodayRow>(
        `SELECT COALESCE(SUM(amount), 0)::text AS total_sales_today
         FROM   transactions
         WHERE  org_id    = $1
           AND  type      = 'sale'
           AND  created_at >= CURRENT_DATE`,
        [orgId]
      ),

      query<TopDebtorRow>(
        `WITH latest_balances AS (
           SELECT DISTINCT ON (t.customer_id)
             t.customer_id AS id,
             c.name,
             t.balance_after::text AS balance
           FROM   transactions t
           INNER  JOIN customers c
                  ON  c.id         = t.customer_id
                  AND c.deleted_at IS NULL
           WHERE  t.org_id = $1
           ORDER  BY t.customer_id, t.created_at DESC
         )
         SELECT id, name, balance
         FROM   latest_balances
         WHERE  balance::NUMERIC > 0
         ORDER  BY balance::NUMERIC DESC
         LIMIT  5`,
        [orgId]
      ),
    ]);

  const outstanding = outstandingResult.rows[0];
  const collected   = collectedResult.rows[0];
  const sales       = salesResult.rows[0];

  return {
    total_outstanding:     outstanding?.total_outstanding     ?? '0',
    total_collected_today: collected?.total_collected_today   ?? '0',
    total_sales_today:     sales?.total_sales_today           ?? '0',
    customers_with_debt:   parseInt(outstanding?.customers_with_debt ?? '0', 10),
    top_debtors:           topDebtorsResult.rows,
  };
}