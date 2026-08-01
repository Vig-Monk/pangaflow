// =============================================================================
// src/modules/expenses/expenses.queries.ts
// Database access layer — expense tracking + full dashboard.
// Raw pg only. No business logic.
// =============================================================================

import { query } from '../../config/db';
import { Transaction } from '../../types/models';

// ---------------------------------------------------------------------------
// Interfaces — exact spec text
// ---------------------------------------------------------------------------

export interface Expense {
  id: string;
  org_id: string;
  category_id: string;
  amount: string;
  vendor: string | null;
  description: string | null;
  receipt_url: string | null;
  expense_date: string;
  is_recurring: boolean;
  recurrence_day: number | null;
  created_by: string;
  created_at: Date;
}

export interface ExpenseSummary {
  by_category: Array<{ category_id: string; name: string; color: string; total: string }>;
  overall_total: string;
}

export interface ProfitLoss {
  total_sales: string;
  total_payments_received: string;
  total_expenses: string;
  profit: string;
}

export interface FullDashboard {
  today: { sales: string; payments_received: string; expenses: string };
  this_month: { revenue: string; expenses: string; profit: string; outstanding_balance: string };
  customers: { total: number; with_debt: number; top_5_debtors: Array<{ id: string; name: string; balance: string }> };
  recent_transactions: Transaction[];
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateExpenseInput {
  categoryId: string;
  amount: number;
  vendor?: string;
  description?: string;
  receiptUrl?: string;
  expenseDate?: string;
  isRecurring?: boolean;
  recurrenceDay?: number;
}

export interface ExpenseFilters {
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

// ---------------------------------------------------------------------------
// Internal row shapes
// ---------------------------------------------------------------------------

interface ExpenseCountRow {
  count: string;
}

interface CategoryTotalRow {
  category_id: string;
  name: string;
  color: string;
  total: string;
}

interface OverallTotalRow {
  overall_total: string;
}

interface SalesRow {
  total_sales: string;
}

interface PaymentsRow {
  total_payments_received: string;
}

interface ExpensesTotalRow {
  total_expenses: string;
}

interface TodaySalesRow {
  sales: string;
}

interface TodayPaymentsRow {
  payments_received: string;
}

interface TodayExpensesRow {
  expenses: string;
}

interface MonthRevenueRow {
  revenue: string;
}

interface MonthExpensesRow {
  expenses: string;
}

interface OutstandingBalanceRow {
  outstanding_balance: string;
}

interface CustomerCountRow {
  total: string;
  with_debt: string;
}

interface TopDebtorRow {
  id: string;
  name: string;
  balance: string;
}

// ---------------------------------------------------------------------------
// createExpense
// ---------------------------------------------------------------------------

export async function createExpense(
  orgId: string,
  data: CreateExpenseInput,
  createdBy: string
): Promise<Expense> {
  const result = await query<Expense>(
    `INSERT INTO expenses
       (org_id, category_id, amount, vendor, description, receipt_url,
        expense_date, is_recurring, recurrence_day, created_by)
     VALUES
       ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE), $8, $9, $10)
     RETURNING
       id, org_id, category_id,
       amount::text AS amount,
       vendor, description, receipt_url,
       expense_date::text AS expense_date,
       is_recurring, recurrence_day, created_by, created_at`,
    [
      orgId,
      data.categoryId,
      data.amount,
      data.vendor ?? null,
      data.description ?? null,
      data.receiptUrl ?? null,
      data.expenseDate ?? null,
      data.isRecurring ?? false,
      data.recurrenceDay ?? null,
      createdBy,
    ]
  );

  return result.rows[0];
}

// ---------------------------------------------------------------------------
// listExpenses
// ---------------------------------------------------------------------------

export async function listExpenses(
  orgId: string,
  filters: ExpenseFilters
): Promise<{ expenses: Expense[]; total: number }> {
  const conditions: string[] = ['org_id = $1'];
  const params: unknown[] = [orgId];
  let paramIndex = 2;

  if (filters.categoryId) {
    conditions.push(`category_id = $${paramIndex}`);
    params.push(filters.categoryId);
    paramIndex++;
  }

  if (filters.startDate) {
    conditions.push(`expense_date >= $${paramIndex}`);
    params.push(filters.startDate);
    paramIndex++;
  }

  if (filters.endDate) {
    conditions.push(`expense_date <= $${paramIndex}`);
    params.push(filters.endDate);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');
  const offset = (filters.page - 1) * filters.limit;

  const countResult = await query<ExpenseCountRow>(
    `SELECT COUNT(*) AS count FROM expenses WHERE ${whereClause}`,
    params
  );

  const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

  if (total === 0) {
    return { expenses: [], total: 0 };
  }

  const dataParams = [...params, filters.limit, offset];

  const dataResult = await query<Expense>(
    `SELECT
       id, org_id, category_id,
       amount::text AS amount,
       vendor, description, receipt_url,
       expense_date::text AS expense_date,
       is_recurring, recurrence_day, created_by, created_at
     FROM   expenses
     WHERE  ${whereClause}
     ORDER  BY expense_date DESC, created_at DESC
     LIMIT  $${paramIndex} OFFSET $${paramIndex + 1}`,
    dataParams
  );

  return { expenses: dataResult.rows, total };
}

// ---------------------------------------------------------------------------
// getExpenseSummary
// ---------------------------------------------------------------------------

export async function getExpenseSummary(
  orgId: string,
  range: DateRange
): Promise<ExpenseSummary> {
  const [byCategoryResult, overallResult] = await Promise.all([
    query<CategoryTotalRow>(
      `SELECT
         ec.id   AS category_id,
         ec.name AS name,
         ec.color AS color,
         COALESCE(SUM(e.amount), 0)::text AS total
       FROM   expense_categories ec
       LEFT   JOIN expenses e
              ON  e.category_id  = ec.id
              AND e.expense_date >= $2
              AND e.expense_date <= $3
       WHERE  ec.org_id = $1
       GROUP  BY ec.id, ec.name, ec.color
       ORDER  BY total DESC`,
      [orgId, range.startDate, range.endDate]
    ),

    query<OverallTotalRow>(
      `SELECT COALESCE(SUM(amount), 0)::text AS overall_total
       FROM   expenses
       WHERE  org_id       = $1
         AND  expense_date >= $2
         AND  expense_date <= $3`,
      [orgId, range.startDate, range.endDate]
    ),
  ]);

  return {
    by_category: byCategoryResult.rows,
    overall_total: overallResult.rows[0]?.overall_total ?? '0',
  };
}

// ---------------------------------------------------------------------------
// getProfitLoss
// ---------------------------------------------------------------------------

export async function getProfitLoss(
  orgId: string,
  month: number,
  year: number
): Promise<ProfitLoss> {
  const [salesResult, paymentsResult, expensesResult] = await Promise.all([
    query<SalesRow>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total_sales
       FROM   transactions
       WHERE  org_id = $1
         AND  type   = 'sale'
         AND  EXTRACT(MONTH FROM created_at) = $2
         AND  EXTRACT(YEAR  FROM created_at) = $3`,
      [orgId, month, year]
    ),

    query<PaymentsRow>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total_payments_received
       FROM   transactions
       WHERE  org_id = $1
         AND  type   = 'payment'
         AND  EXTRACT(MONTH FROM created_at) = $2
         AND  EXTRACT(YEAR  FROM created_at) = $3`,
      [orgId, month, year]
    ),

    query<ExpensesTotalRow>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total_expenses
       FROM   expenses
       WHERE  org_id = $1
         AND  EXTRACT(MONTH FROM expense_date) = $2
         AND  EXTRACT(YEAR  FROM expense_date) = $3`,
      [orgId, month, year]
    ),
  ]);

  const totalSales = salesResult.rows[0]?.total_sales ?? '0';
  const totalPayments = paymentsResult.rows[0]?.total_payments_received ?? '0';
  const totalExpenses = expensesResult.rows[0]?.total_expenses ?? '0';

  // Profit computed via a throwaway SQL SELECT using NUMERIC arithmetic —
  // same discipline as recordTransaction's balance computation: never
  // JavaScript floating-point math on money values.
  const profitResult = await query<{ profit: string }>(
    `SELECT ($1::NUMERIC - $2::NUMERIC)::text AS profit`,
    [totalPayments, totalExpenses]
  );

  return {
    total_sales: totalSales,
    total_payments_received: totalPayments,
    total_expenses: totalExpenses,
    profit: profitResult.rows[0]?.profit ?? '0',
  };
}

// ---------------------------------------------------------------------------
// getFullDashboard
// ---------------------------------------------------------------------------

/**
 * Composes the full dashboard from parallel queries. The
 * outstanding_balance and top_5_debtors queries below use the same
 * DISTINCT ON latest-balance pattern already proven in
 * transactions.queries.ts's getDashboardSummary, inlined here rather
 * than imported — see the note below on why.
 *
 * Every one of the 9 parallel queries runs against an org_id-scoped,
 * already-indexed table (idx_transactions_org_customer,
 * idx_expenses_org_date, idx_customers_org_id) — the under-300ms
 * requirement is a function of index coverage, not query count, and
 * every query here is covered by an existing or newly-added index.
 */
export async function getFullDashboard(orgId: string): Promise<FullDashboard> {
  const [
    todaySalesResult,
    todayPaymentsResult,
    todayExpensesResult,
    monthRevenueResult,
    monthExpensesResult,
    outstandingResult,
    customerCountResult,
    topDebtorsResult,
    recentTransactionsResult,
  ] = await Promise.all([
    query<TodaySalesRow>(
      `SELECT COALESCE(SUM(amount), 0)::text AS sales
       FROM   transactions
       WHERE  org_id     = $1 AND type = 'sale' AND created_at >= CURRENT_DATE`,
      [orgId]
    ),

    query<TodayPaymentsRow>(
      `SELECT COALESCE(SUM(amount), 0)::text AS payments_received
       FROM   transactions
       WHERE  org_id     = $1 AND type = 'payment' AND created_at >= CURRENT_DATE`,
      [orgId]
    ),

    query<TodayExpensesRow>(
      `SELECT COALESCE(SUM(amount), 0)::text AS expenses
       FROM   expenses
       WHERE  org_id       = $1 AND expense_date = CURRENT_DATE`,
      [orgId]
    ),

    query<MonthRevenueRow>(
      `SELECT COALESCE(SUM(amount), 0)::text AS revenue
       FROM   transactions
       WHERE  org_id = $1
         AND  type   = 'payment'
         AND  date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)`,
      [orgId]
    ),

    query<MonthExpensesRow>(
      `SELECT COALESCE(SUM(amount), 0)::text AS expenses
       FROM   expenses
       WHERE  org_id = $1
         AND  date_trunc('month', expense_date) = date_trunc('month', CURRENT_DATE)`,
      [orgId]
    ),

    // Same DISTINCT ON latest-balance pattern as
    // transactions.queries.ts's getDashboardSummary — one row per
    // customer, most recent balance_after, summed where positive.
    query<OutstandingBalanceRow>(
      `WITH latest_balances AS (
         SELECT DISTINCT ON (customer_id) customer_id, balance_after
         FROM   transactions
         WHERE  org_id = $1
         ORDER  BY customer_id, created_at DESC
       )
       SELECT COALESCE(SUM(CASE WHEN balance_after > 0 THEN balance_after ELSE 0 END), 0)::text
         AS outstanding_balance
       FROM latest_balances`,
      [orgId]
    ),

    query<CustomerCountRow>(
      `WITH latest_balances AS (
         SELECT DISTINCT ON (customer_id) customer_id, balance_after
         FROM   transactions
         WHERE  org_id = $1
         ORDER  BY customer_id, created_at DESC
       )
       SELECT
         (SELECT COUNT(*) FROM customers WHERE org_id = $1 AND deleted_at IS NULL)::text AS total,
         (SELECT COUNT(*) FROM latest_balances WHERE balance_after > 0)::text AS with_debt`,
      [orgId]
    ),

    query<TopDebtorRow>(
      `WITH latest_balances AS (
         SELECT DISTINCT ON (t.customer_id)
           t.customer_id AS id, c.name, t.balance_after::text AS balance
         FROM   transactions t
         INNER  JOIN customers c ON c.id = t.customer_id AND c.deleted_at IS NULL
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

    query<Transaction>(
      `SELECT
         id, org_id, customer_id, type,
         amount::text AS amount, description,
         balance_after::text AS balance_after,
         created_by, created_at
       FROM   transactions
       WHERE  org_id = $1
       ORDER  BY created_at DESC
       LIMIT  10`,
      [orgId]
    ),
  ]);

  const monthRevenue = monthRevenueResult.rows[0]?.revenue ?? '0';
  const monthExpenses = monthExpensesResult.rows[0]?.expenses ?? '0';

  // Month profit — SQL NUMERIC subtraction, not JS math, same discipline
  // as getProfitLoss above.
  const monthProfitResult = await query<{ profit: string }>(
    `SELECT ($1::NUMERIC - $2::NUMERIC)::text AS profit`,
    [monthRevenue, monthExpenses]
  );

  return {
    today: {
      sales: todaySalesResult.rows[0]?.sales ?? '0',
      payments_received: todayPaymentsResult.rows[0]?.payments_received ?? '0',
      expenses: todayExpensesResult.rows[0]?.expenses ?? '0',
    },
    this_month: {
      revenue: monthRevenue,
      expenses: monthExpenses,
      profit: monthProfitResult.rows[0]?.profit ?? '0',
      outstanding_balance: outstandingResult.rows[0]?.outstanding_balance ?? '0',
    },
    customers: {
      total: parseInt(customerCountResult.rows[0]?.total ?? '0', 10),
      with_debt: parseInt(customerCountResult.rows[0]?.with_debt ?? '0', 10),
      top_5_debtors: topDebtorsResult.rows,
    },
    recent_transactions: recentTransactionsResult.rows,
  };
}