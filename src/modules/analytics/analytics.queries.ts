// =============================================================================
// src/modules/analytics/analytics.queries.ts
// Parallel PostgreSQL queries for Real P&L, COGS, Working Capital & Debt Aging.
// =============================================================================

import { query } from '../../config/db';

export interface DateRangeFilter {
  startDate: string;
  endDate: string;
}

export interface OverdueDebtorRow {
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  balance: string;
  days_overdue: number;
  last_activity_at: Date;
}

export interface CategoryProfitRow {
  category_name: string;
  revenue: string;
  cogs: string;
  gross_profit: string;
  units_sold: number;
}

export interface AnalyticsRawSummary {
  order_revenue: string;
  order_cogs: string;
  pos_revenue: string;
  total_expenses: string;
  total_cash_collected: string;
  inventory_value: string;
  total_units_in_stock: number;
  total_debt: string;
  debtors_count: number;
  debt_0_7d: string;
  debt_8_30d: string;
  debt_over_30d: string;
  overdue_debtors: OverdueDebtorRow[];
  category_profits: CategoryProfitRow[];
}

/**
 * Executes high-speed, parallel PostgreSQL CTE aggregations across orders,
 * cost prices, operating expenses, credit ledgers, and stock valuation.
 */
export async function getFinancialAnalyticsData(
  orgId: string,
  filter: DateRangeFilter
): Promise<AnalyticsRawSummary> {
  const [financialSummaryRes, debtorsRes, categoryProfitsRes] = await Promise.all([
    // 1. Unified Parallel Financial & Working Capital Aggregation
    query<{
      order_revenue: string;
      order_cogs: string;
      pos_revenue: string;
      total_expenses: string;
      total_cash_collected: string;
      inventory_value: string;
      total_units_in_stock: string;
      total_debt: string;
      debtors_count: string;
      debt_0_7d: string;
      debt_8_30d: string;
      debt_over_30d: string;
    }>(
      `WITH date_bounds AS (
        SELECT $2::timestamptz AS start_date, $3::timestamptz AS end_date
      ),
      order_sales AS (
        SELECT
          COALESCE(SUM(oi.subtotal), 0)::text AS order_revenue,
          COALESCE(SUM(oi.quantity * COALESCE(oi.cost_price, 0)), 0)::text AS order_cogs
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.org_id = $1
          AND o.status != 'cancelled'
          AND o.created_at >= (SELECT start_date FROM date_bounds)
          AND o.created_at <= (SELECT end_date FROM date_bounds)
      ),
      pos_sales AS (
        SELECT
          COALESCE(SUM(t.amount), 0)::text AS pos_revenue
        FROM transactions t
        WHERE t.org_id = $1
          AND t.type = 'sale'
          AND (t.description IS NULL OR t.description NOT LIKE 'Storefront Order #%')
          AND t.created_at >= (SELECT start_date FROM date_bounds)
          AND t.created_at <= (SELECT end_date FROM date_bounds)
      ),
      opex AS (
        SELECT
          COALESCE(SUM(e.amount), 0)::text AS total_expenses
        FROM expenses e
        WHERE e.org_id = $1
          AND e.expense_date >= (SELECT start_date::date FROM date_bounds)
          AND e.expense_date <= (SELECT end_date::date FROM date_bounds)
      ),
      cash_inflow AS (
        SELECT
          COALESCE(SUM(t.amount), 0)::text AS total_cash_collected
        FROM transactions t
        WHERE t.org_id = $1
          AND t.type = 'payment'
          AND t.created_at >= (SELECT start_date FROM date_bounds)
          AND t.created_at <= (SELECT end_date FROM date_bounds)
      ),
      inventory_val AS (
        SELECT
          COALESCE(SUM(i.stock * COALESCE(p.cost_price, p.price * 0.6, 0)), 0)::text AS inventory_value,
          COALESCE(SUM(i.stock), 0)::text AS total_units_in_stock
        FROM inventory i
        JOIN products p ON p.id = i.product_id
        WHERE p.org_id = $1 AND p.deleted_at IS NULL
      ),
      latest_balances AS (
        SELECT DISTINCT ON (t.customer_id)
          t.customer_id,
          t.balance_after,
          t.created_at AS last_activity_at
        FROM transactions t
        WHERE t.org_id = $1
        ORDER BY t.customer_id, t.created_at DESC
      ),
      debt_analysis AS (
        SELECT
          COALESCE(SUM(CASE WHEN balance_after > 0 THEN balance_after ELSE 0 END), 0)::text AS total_debt,
          COUNT(CASE WHEN balance_after > 0 THEN 1 END)::text AS debtors_count,
          COALESCE(SUM(CASE WHEN balance_after > 0 AND last_activity_at >= NOW() - INTERVAL '7 days' THEN balance_after ELSE 0 END), 0)::text AS debt_0_7d,
          COALESCE(SUM(CASE WHEN balance_after > 0 AND last_activity_at >= NOW() - INTERVAL '30 days' AND last_activity_at < NOW() - INTERVAL '7 days' THEN balance_after ELSE 0 END), 0)::text AS debt_8_30d,
          COALESCE(SUM(CASE WHEN balance_after > 0 AND last_activity_at < NOW() - INTERVAL '30 days' THEN balance_after ELSE 0 END), 0)::text AS debt_over_30d
        FROM latest_balances
      )
      SELECT
        os.order_revenue,
        os.order_cogs,
        ps.pos_revenue,
        op.total_expenses,
        ci.total_cash_collected,
        iv.inventory_value,
        iv.total_units_in_stock,
        da.total_debt,
        da.debtors_count,
        da.debt_0_7d,
        da.debt_8_30d,
        da.debt_over_30d
      FROM order_sales os, pos_sales ps, opex op, cash_inflow ci, inventory_val iv, debt_analysis da`,
      [orgId, filter.startDate, filter.endDate]
    ),

    // 2. Overdue Debtors (Top 10 Chronic Debtors with Aging Days)
    query<OverdueDebtorRow>(
      `WITH latest_balances AS (
        SELECT DISTINCT ON (t.customer_id)
          t.customer_id,
          t.balance_after,
          t.created_at AS last_activity_at
        FROM transactions t
        WHERE t.org_id = $1
        ORDER BY t.customer_id, t.created_at DESC
      )
      SELECT
        c.id AS customer_id,
        c.name AS customer_name,
        c.phone AS customer_phone,
        lb.balance_after::text AS balance,
        GREATEST(0, EXTRACT(DAY FROM (NOW() - lb.last_activity_at))::int) AS days_overdue,
        lb.last_activity_at
      FROM latest_balances lb
      JOIN customers c ON c.id = lb.customer_id AND c.deleted_at IS NULL
      WHERE lb.balance_after > 0
      ORDER BY lb.balance_after DESC
      LIMIT 10`,
      [orgId]
    ),

    // 3. Category Profitability Breakdown (Real COGS & Margins per category)
    query<CategoryProfitRow>(
      `WITH date_bounds AS (
        SELECT $2::timestamptz AS start_date, $3::timestamptz AS end_date
      )
      SELECT
        COALESCE(c.name, 'General') AS category_name,
        COALESCE(SUM(oi.subtotal), 0)::text AS revenue,
        COALESCE(SUM(oi.quantity * COALESCE(oi.cost_price, 0)), 0)::text AS cogs,
        COALESCE(SUM(oi.subtotal - (oi.quantity * COALESCE(oi.cost_price, 0))), 0)::text AS gross_profit,
        COALESCE(SUM(oi.quantity), 0)::int AS units_sold
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE o.org_id = $1
        AND o.status != 'cancelled'
        AND o.created_at >= (SELECT start_date FROM date_bounds)
        AND o.created_at <= (SELECT end_date FROM date_bounds)
      GROUP BY c.name
      ORDER BY SUM(oi.subtotal) DESC
      LIMIT 8`,
      [orgId, filter.startDate, filter.endDate]
    ),
  ]);

  const row = financialSummaryRes.rows[0];

  return {
    order_revenue: row?.order_revenue || '0',
    order_cogs: row?.order_cogs || '0',
    pos_revenue: row?.pos_revenue || '0',
    total_expenses: row?.total_expenses || '0',
    total_cash_collected: row?.total_cash_collected || '0',
    inventory_value: row?.inventory_value || '0',
    total_units_in_stock: parseInt(row?.total_units_in_stock || '0', 10),
    total_debt: row?.total_debt || '0',
    debtors_count: parseInt(row?.debtors_count || '0', 10),
    debt_0_7d: row?.debt_0_7d || '0',
    debt_8_30d: row?.debt_8_30d || '0',
    debt_over_30d: row?.debt_over_30d || '0',
    overdue_debtors: debtorsRes.rows,
    category_profits: categoryProfitsRes.rows,
  };
}