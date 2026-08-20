// =============================================================================
// src/modules/expenses/expenses.queries.ts
// Database access layer — expense tracking + operational morning dashboard.
// =============================================================================

import { query } from "../../config/db";
import { Transaction } from "../../types/models";

export interface DashboardTransaction extends Transaction {
    customer_name: string | null;
}

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
    by_category: Array<{
        category_id: string;
        name: string;
        color: string;
        total: string;
    }>;
    overall_total: string;
}

export interface ProfitLoss {
    total_sales: string;
    total_payments_received: string;
    total_expenses: string;
    profit: string;
}

export interface DebtorItem {
    id: string;
    name: string;
    phone: string | null;
    balance: string;
    days_overdue: number;
}

export interface CriticalStockItem {
    id: string;
    name: string;
    stock: number;
    low_stock_at: number;
}

export interface OrdersQueueSummary {
    pending_pack: number;
    out_for_delivery: number;
    today_completed: number;
}

export interface FullDashboard {
    today: { sales: string; payments_received: string; expenses: string };
    this_month: {
        revenue: string;
        expenses: string;
        profit: string;
        outstanding_balance: string;
    };
    customers: {
        total: number;
        with_debt: number;
        top_5_debtors: DebtorItem[];
    };
    orders_queue: OrdersQueueSummary;
    critical_stock: CriticalStockItem[];
    recent_transactions: DashboardTransaction[];
}

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

export interface ExpenseCategory {
    id: string;
    org_id: string;
    name: string;
    color: string;
    created_at: Date;
}

export async function listCategories(
    orgId: string
): Promise<ExpenseCategory[]> {
    const result = await query<ExpenseCategory>(
        `SELECT id, org_id, name, color, created_at
         FROM   expense_categories
         WHERE  org_id = $1
         ORDER  BY name ASC`,
        [orgId]
    );

    return result.rows;
}

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
            createdBy
        ]
    );

    return result.rows[0];
}

export async function listExpenses(
    orgId: string,
    filters: ExpenseFilters
): Promise<{ expenses: Expense[]; total: number }> {
    const conditions: string[] = ["org_id = $1"];
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

    const whereClause = conditions.join(" AND ");
    const offset = (filters.page - 1) * filters.limit;

    const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM expenses WHERE ${whereClause}`,
        params
    );

    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

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

export async function getExpenseSummary(
    orgId: string,
    range: DateRange
): Promise<ExpenseSummary> {
    const [byCategoryResult, overallResult] = await Promise.all([
        query<{ category_id: string; name: string; color: string; total: string }>(
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

        query<{ overall_total: string }>(
            `SELECT COALESCE(SUM(amount), 0)::text AS overall_total
           FROM   expenses
           WHERE  org_id       = $1
             AND  expense_date >= $2
             AND  expense_date <= $3`,
            [orgId, range.startDate, range.endDate]
        )
    ]);

    return {
        by_category: byCategoryResult.rows,
        overall_total: overallResult.rows[0]?.overall_total ?? "0"
    };
}

export async function getProfitLoss(
    orgId: string,
    month: number,
    year: number
): Promise<ProfitLoss> {
    const [salesResult, paymentsResult, expensesResult] = await Promise.all([
        query<{ total_sales: string }>(
            `SELECT COALESCE(SUM(amount), 0)::text AS total_sales
       FROM   transactions
       WHERE  org_id = $1
         AND  type   = 'sale'
         AND  EXTRACT(MONTH FROM created_at) = $2
         AND  EXTRACT(YEAR  FROM created_at) = $3`,
            [orgId, month, year]
        ),

        query<{ total_payments_received: string }>(
            `SELECT COALESCE(SUM(amount), 0)::text AS total_payments_received
       FROM   transactions
       WHERE  org_id = $1
         AND  type   = 'payment'
         AND  EXTRACT(MONTH FROM created_at) = $2
         AND  EXTRACT(YEAR  FROM created_at) = $3`,
            [orgId, month, year]
        ),

        query<{ total_expenses: string }>(
            `SELECT COALESCE(SUM(amount), 0)::text AS total_expenses
       FROM   expenses
       WHERE  org_id = $1
         AND  EXTRACT(MONTH FROM expense_date) = $2
         AND  EXTRACT(YEAR  FROM expense_date) = $3`,
            [orgId, month, year]
        )
    ]);

    const totalSales = salesResult.rows[0]?.total_sales ?? "0";
    const totalPayments = paymentsResult.rows[0]?.total_payments_received ?? "0";
    const totalExpenses = expensesResult.rows[0]?.total_expenses ?? "0";

    const profitResult = await query<{ profit: string }>(
        `SELECT ($1::NUMERIC - $2::NUMERIC)::text AS profit`,
        [totalPayments, totalExpenses]
    );

    return {
        total_sales: totalSales,
        total_payments_received: totalPayments,
        total_expenses: totalExpenses,
        profit: profitResult.rows[0]?.profit ?? "0"
    };
}

/**
 * 7:30 AM Morning Standup Engine: Composes parallel operational queues,
 * debt chaser targets, stockout radars, and daily cash pulses in < 30ms.
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
        ordersQueueResult,
        criticalStockResult,
        recentTransactionsResult
    ] = await Promise.all([
        query<{ sales: string }>(
            `SELECT COALESCE(SUM(amount), 0)::text AS sales
       FROM   transactions
       WHERE  org_id = $1 AND type = 'sale' AND created_at >= CURRENT_DATE`,
            [orgId]
        ),

        query<{ payments_received: string }>(
            `SELECT COALESCE(SUM(amount), 0)::text AS payments_received
       FROM   transactions
       WHERE  org_id = $1 AND type = 'payment' AND created_at >= CURRENT_DATE`,
            [orgId]
        ),

        query<{ expenses: string }>(
            `SELECT COALESCE(SUM(amount), 0)::text AS expenses
       FROM   expenses
       WHERE  org_id = $1 AND expense_date = CURRENT_DATE`,
            [orgId]
        ),

        query<{ revenue: string }>(
            `SELECT COALESCE(SUM(amount), 0)::text AS revenue
       FROM   transactions
       WHERE  org_id = $1
         AND  type   = 'payment'
         AND  date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)`,
            [orgId]
        ),

        query<{ expenses: string }>(
            `SELECT COALESCE(SUM(amount), 0)::text AS expenses
       FROM   expenses
       WHERE  org_id = $1
         AND  date_trunc('month', expense_date) = date_trunc('month', CURRENT_DATE)`,
            [orgId]
        ),

        query<{ outstanding_balance: string }>(
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

        query<{ total: string; with_debt: string }>(
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

        // Overdue Debtors with Phone & Days Overdue for 1-Tap Reminders
        query<{ id: string; name: string; phone: string | null; balance: string; days_overdue: number }>(
            `WITH latest_balances AS (
         SELECT DISTINCT ON (t.customer_id)
           t.customer_id AS id,
           c.name,
           c.phone,
           t.balance_after::text AS balance,
           GREATEST(0, EXTRACT(DAY FROM (NOW() - t.created_at))::int) AS days_overdue
         FROM   transactions t
         INNER  JOIN customers c ON c.id = t.customer_id AND c.deleted_at IS NULL
         WHERE  t.org_id = $1
         ORDER  BY t.customer_id, t.created_at DESC
       )
       SELECT id, name, phone, balance, days_overdue
       FROM   latest_balances
       WHERE  balance::NUMERIC > 0
       ORDER  BY balance::NUMERIC DESC
       LIMIT  5`,
            [orgId]
        ),

        // Order Action Queue (Pending Pack, Out for Delivery, Completed Today)
        query<{ pending_pack: string; out_for_delivery: string; today_completed: string }>(
            `SELECT
               COUNT(*) FILTER (WHERE status IN ('pending', 'confirmed'))::text AS pending_pack,
               COUNT(*) FILTER (WHERE status IN ('assigned', 'out_for_delivery'))::text AS out_for_delivery,
               COUNT(*) FILTER (WHERE status = 'delivered' AND created_at >= CURRENT_DATE)::text AS today_completed
             FROM orders
             WHERE org_id = $1`,
            [orgId]
        ),

        // Stockout Risk Radar (Critical Low-Stock Items)
        query<{ id: string; name: string; stock: number; low_stock_at: number }>(
            `SELECT p.id, p.name, i.stock, i.low_stock_at
             FROM inventory i
             JOIN products p ON p.id = i.product_id
             WHERE p.org_id = $1 AND p.deleted_at IS NULL AND i.stock <= i.low_stock_at
             ORDER BY i.stock ASC
             LIMIT 4`,
            [orgId]
        ),

        query<DashboardTransaction>(
            `SELECT
         t.id, t.org_id, t.customer_id, t.type,
         t.amount::text AS amount, t.description,
         t.balance_after::text AS balance_after,
         t.created_by, t.created_at,
         c.name AS customer_name
       FROM   transactions t
       LEFT JOIN customers c ON c.id = t.customer_id AND c.deleted_at IS NULL
       WHERE  t.org_id = $1
       ORDER  BY t.created_at DESC
       LIMIT  8`,
            [orgId]
        )
    ]);

    const monthRevenue = monthRevenueResult.rows[0]?.revenue ?? "0";
    const monthExpenses = monthExpensesResult.rows[0]?.expenses ?? "0";

    const monthProfitResult = await query<{ profit: string }>(
        `SELECT ($1::NUMERIC - $2::NUMERIC)::text AS profit`,
        [monthRevenue, monthExpenses]
    );

    const qRow = ordersQueueResult.rows[0];

    return {
        today: {
            sales: todaySalesResult.rows[0]?.sales ?? "0",
            payments_received: todayPaymentsResult.rows[0]?.payments_received ?? "0",
            expenses: todayExpensesResult.rows[0]?.expenses ?? "0"
        },
        this_month: {
            revenue: monthRevenue,
            expenses: monthExpenses,
            profit: monthProfitResult.rows[0]?.profit ?? "0",
            outstanding_balance: outstandingResult.rows[0]?.outstanding_balance ?? "0"
        },
        customers: {
            total: parseInt(customerCountResult.rows[0]?.total ?? "0", 10),
            with_debt: parseInt(customerCountResult.rows[0]?.with_debt ?? "0", 10),
            top_5_debtors: topDebtorsResult.rows
        },
        orders_queue: {
            pending_pack: parseInt(qRow?.pending_pack || "0", 10),
            out_for_delivery: parseInt(qRow?.out_for_delivery || "0", 10),
            today_completed: parseInt(qRow?.today_completed || "0", 10),
        },
        critical_stock: criticalStockResult.rows,
        recent_transactions: recentTransactionsResult.rows
    };
}