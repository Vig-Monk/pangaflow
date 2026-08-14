// =============================================================================
// src/modules/expenses/expenses.service.ts
// Business logic for expense tracking + full dashboard.
// Validates inputs, delegates to expenses.queries.ts.
// =============================================================================

import { z } from "zod";
import { AppError } from "../../utils/error";
import {
    Expense,
    ExpenseFilters,
    ExpenseSummary,
    FullDashboard,
    ProfitLoss,
    createExpense,
    getExpenseSummary,
    getFullDashboard,
    getProfitLoss,
    listExpenses
} from "./expenses.queries";
// ADD to the existing imports from './expenses.queries':
import {
    ExpenseCategory,
    listCategories
} from "./expenses.queries";

export async function categories(orgId: string): Promise<ExpenseCategory[]> {
    return listCategories(orgId);
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const CreateExpenseSchema = z.object({
    categoryId: z.string().uuid("categoryId must be a valid UUID"),
    amount: z.number().positive("Amount must be greater than zero"),
    vendor: z.string().max(200).optional(),
    description: z.string().max(2000).optional(),
    receiptUrl: z.string().url().optional(),
    expenseDate: z.string().optional(),
    isRecurring: z.boolean().optional(),
    recurrenceDay: z.number().int().min(1).max(31).optional()
});

export const ListExpensesQuerySchema = z.object({
    categoryId: z.string().uuid().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const ExpenseSummaryQuerySchema = z.object({
    startDate: z.string().min(1, "startDate is required"),
    endDate: z.string().min(1, "endDate is required")
});

export const ProfitLossQuerySchema = z.object({
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2000).max(2100)
});

export type CreateExpenseBody = z.infer<typeof CreateExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof ListExpensesQuerySchema>;

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function create(
    orgId: string,
    userId: string,
    rawBody: unknown
): Promise<Expense> {
    const parsed = CreateExpenseSchema.safeParse(rawBody);
    if (!parsed.success) {
        throw new AppError(
            parsed.error.issues[0]?.message ?? "Invalid request body",
            400
        );
    }

    return createExpense(orgId, parsed.data, userId);
}

export async function list(
    orgId: string,
    rawQuery: unknown
): Promise<{ expenses: Expense[]; total: number }> {
    const parsed = ListExpensesQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
        throw new AppError(
            parsed.error.issues[0]?.message ?? "Invalid query parameters",
            400
        );
    }

    const filters: ExpenseFilters = {
        categoryId: parsed.data.categoryId,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        page: parsed.data.page,
        limit: parsed.data.limit
    };

    return listExpenses(orgId, filters);
}

export async function summary(
    orgId: string,
    rawQuery: unknown
): Promise<ExpenseSummary> {
    const parsed = ExpenseSummaryQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
        throw new AppError(
            parsed.error.issues[0]?.message ?? "Invalid query parameters",
            400
        );
    }

    return getExpenseSummary(orgId, {
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate
    });
}

export async function profitLoss(
    orgId: string,
    rawQuery: unknown
): Promise<ProfitLoss> {
    const parsed = ProfitLossQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
        throw new AppError(
            parsed.error.issues[0]?.message ?? "Invalid query parameters",
            400
        );
    }

    return getProfitLoss(orgId, parsed.data.month, parsed.data.year);
}

export async function fullDashboard(orgId: string): Promise<FullDashboard> {
    return getFullDashboard(orgId);
}
