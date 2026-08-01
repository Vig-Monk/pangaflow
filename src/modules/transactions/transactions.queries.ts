// =============================================================================
// src/modules/transactions/transactions.queries.ts
// Database access layer — transactions (credit ledger) module.
// Raw pg only. No business logic.
//
// CRITICAL: recordTransaction() MUST be called with a PoolClient inside
// a BEGIN/COMMIT block. Balance computation happens inside the database
// in a single atomic operation — never in application code.
// =============================================================================

import { PoolClient } from 'pg';
import { query } from '../../config/db';
import { Transaction, TransactionType } from '../../types/models';

// ---------------------------------------------------------------------------
// Input / result types (per Prompt 1.2 spec)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Internal row shapes — pg result types not exposed beyond this file
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// recordTransaction
// ---------------------------------------------------------------------------

/**
 * Inserts a transaction row with a pre-computed balance_after.
 *
 * ATOMIC PATTERN — must always be called inside an explicit pg transaction
 * opened by the service layer:
 *
 *   const client = await pool.connect();
 *   await client.query('BEGIN');
 *   try {
 *     const tx = await recordTransaction(client, input);
 *     await client.query('COMMIT');
 *   } catch (err) {
 *     await client.query('ROLLBACK');
 *     throw err;
 *   } finally {
 *     client.release();
 *   }
 *
 * Steps inside this function (all within the caller's transaction):
 *   1. Read the most recent balance_after for this customer (or 0 if none).
 *   2. Compute the new balance_after:
 *        - sale:       balance + amount  (adds debt)
 *        - payment:    balance - amount  (reduces debt)
 *        - adjustment: balance + amount  (signed — pass negative to reduce)
 *   3. Insert the transaction row with the computed balance_after.
 *
 * The balance is computed by the database using NUMERIC arithmetic —
 * never by JavaScript floating-point math.
 */
export async function recordTransaction(
  client: PoolClient,
  input: RecordTransactionInput
): Promise<Transaction> {
  // Step 1 — get the latest balance for this customer within this org.
  // Scoping by org_id is defensive: the FK on customer_id already constrains
  // this, but the explicit org_id guard makes the tenancy boundary visible
  // in the query itself rather than relying on the FK silently.
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

  // Step 2 — compute new balance using PostgreSQL NUMERIC arithmetic.
  // sale      → increases what the customer owes  (balance + amount)
  // payment   → decreases what the customer owes  (balance - amount)
  // adjustment → signed delta; positive adds debt, negative reduces it
  //              (balance + amount, where caller passes negative for credits)
  const balanceExpression =
    input.type === 'payment'
      ? `$1::NUMERIC - $2::NUMERIC`
      : `$1::NUMERIC + $2::NUMERIC`;

  const newBalanceResult = await client.query<{ new_balance: string }>(
    `SELECT ${balanceExpression} AS new_balance`,
    [currentBalance, input.amount]
  );

  const newBalance = newBalanceResult.rows[0]?.new_balance ?? '0';

  // Step 3 — insert the transaction with the computed balance_after.
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

// ---------------------------------------------------------------------------
// getCustomerLedger
// ---------------------------------------------------------------------------

/**
 * Returns a customer's full transaction history, paginated, with their
 * current balance (most recent balance_after) and basic customer info.
 *
 * Returns null for the customer field if the customer does not exist in
 * this org — the service layer converts this to a 404.
 */
export async function getCustomerLedger(
  orgId: string,
  customerId: string,
  options: { page: number; limit: number }
): Promise<CustomerLedgerResult | null> {
  const { page, limit } = options;
  const offset = (page - 1) * limit;

  // Fetch customer row — confirms existence and org scope in one query
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

  // Total transaction count for pagination
  const countResult = await query<LedgerCountRow>(
    `SELECT COUNT(*) AS count
     FROM   transactions
     WHERE  customer_id = $1
       AND  org_id      = $2`,
    [customerId, orgId]
  );

  const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

  // Current balance — most recent balance_after, or 0 for no transactions
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

  // Paginated transaction rows — newest first (ledger convention)
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

// ---------------------------------------------------------------------------
// getDashboardSummary
// ---------------------------------------------------------------------------

/**
 * Returns key financial metrics for the org's dashboard.
 * Runs four parallel queries — no serial dependency between them.
 *
 * Definitions:
 *   total_outstanding    — sum of current balances across all customers
 *                          where balance > 0 (positive balance = owes money)
 *   total_collected_today — sum of all 'payment' transactions today
 *   total_sales_today    — sum of all 'sale' transactions today
 *   customers_with_debt  — count of customers whose latest balance_after > 0
 *   top_debtors          — top 5 customers by current balance, descending
 */
export async function getDashboardSummary(
  orgId: string
): Promise<DashboardSummary> {
  // Each sub-query is independent — run in parallel with Promise.all
  const [outstandingResult, collectedResult, salesResult, topDebtorsResult] =
    await Promise.all([
      // 1. Total outstanding + customers_with_debt
      // Uses a CTE to get each customer's latest balance_after, then sums
      // the positive ones. This is correct for the ledger model: a customer's
      // "balance" is always the most recent balance_after on their ledger.
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

      // 2. Total collected today (payments only)
      query<CollectedTodayRow>(
        `SELECT COALESCE(SUM(amount), 0)::text AS total_collected_today
         FROM   transactions
         WHERE  org_id    = $1
           AND  type      = 'payment'
           AND  created_at >= CURRENT_DATE`,
        [orgId]
      ),

      // 3. Total sales today
      query<SalesTodayRow>(
        `SELECT COALESCE(SUM(amount), 0)::text AS total_sales_today
         FROM   transactions
         WHERE  org_id    = $1
           AND  type      = 'sale'
           AND  created_at >= CURRENT_DATE`,
        [orgId]
      ),

      // 4. Top 5 debtors by current balance
      // Same DISTINCT ON pattern as above — one row per customer,
      // the most recent balance_after, filtered to positive balances only.
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