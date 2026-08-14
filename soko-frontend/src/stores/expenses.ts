// =============================================================================
// src/stores/expenses.ts
// Types match expenses.queries.ts's exported interfaces exactly.
// =============================================================================

import { defineStore } from "pinia";
import { apiGet,apiGetPaginated, apiPost } from "@/services/apiClient";

// ---------------------------------------------------------------------------
// Types — exact mirror of the real backend interfaces
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
    created_at: string;
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

export interface CreateExpenseBody {
    categoryId: string;
    amount: number;
    vendor?: string;
    description?: string;
    receiptUrl?: string;
    expenseDate?: string;
    isRecurring?: boolean;
    recurrenceDay?: number;
}

export interface ListExpensesParams {
    categoryId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}
export interface ExpenseCategory {
    id: string;
    org_id: string;
    name: string;
    color: string;
    created_at: string;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useExpensesStore = defineStore("expenses", {
    state: () => ({
        list: [] as Expense[],
        total: 0,
        page: 1,
        summary: null as ExpenseSummary | null,
        profitLoss: null as ProfitLoss | null,
        categories: [] as ExpenseCategory[], // NEW
        isLoading: false,
        error: null as string | null
    }),

    actions: {
        async fetchList(params: ListExpensesParams = {}): Promise<void> {
            this.isLoading = true;
            this.error = null;
            try {
                const { data, meta } = await apiGetPaginated<Expense[]>(
                    "/expenses",
                    params
                );
                this.list = data;
                this.page = meta.page;
                this.total = meta.totalItems; // NOW actually set
            } catch (err) {
                this.error =
                    err instanceof Error
                        ? err.message
                        : "Failed to load expenses";
            } finally {
                this.isLoading = false;
            }
        },
        async create(body: CreateExpenseBody): Promise<Expense> {
            const expense = await apiPost<Expense>("/expenses", body);
            this.list = [expense, ...this.list];
            return expense;
        },

        async fetchSummary(startDate: string, endDate: string): Promise<void> {
            this.error = null;
            try {
                this.summary = await apiGet<ExpenseSummary>(
                    "/expenses/summary",
                    { startDate, endDate }
                );
            } catch (err) {
                this.error =
                    err instanceof Error
                        ? err.message
                        : "Failed to load expense summary";
            }
        },

        async fetchProfitLoss(month: number, year: number): Promise<void> {
            this.error = null;
            try {
                this.profitLoss = await apiGet<ProfitLoss>(
                    "/expenses/profit-loss",
                    { month, year }
                );
            } catch (err) {
                this.error =
                    err instanceof Error
                        ? err.message
                        : "Failed to load profit/loss";
            }
        },
        async fetchCategories(): Promise<void> {
            try {
                this.categories = await apiGet<ExpenseCategory[]>(
                    "/expenses/categories"
                );
            } catch (err) {
                this.error =
                    err instanceof Error
                        ? err.message
                        : "Failed to load categories";
            }
        }
    }
});
