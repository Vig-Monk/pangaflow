// =============================================================================
// src/stores/customers.ts
// LimitReachedDetails matches the REAL checkLimit.ts payload — see
// delivery note above for the exact field-name conflict this resolves.
// =============================================================================

import { defineStore } from "pinia";
import {
    apiGet,
    apiPatch,
    apiPost,
    apiGetPaginated,
    apiDelete,
    ApiError
} from "@/services/apiClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Customer {
    id: string;
    org_id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    is_archived: boolean;
    current_balance: string;
    created_at: string;
}

export type PlanName = "free" | "pro" | "business";

export interface LimitReachedDetails {
    currentPlan: PlanName;
    currentCount: number;
    limit: number;
    upgradeOptions: Array<{ plan: PlanName; label: string; price_kes: number }>;
}

export interface CreateCustomerBody {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
}

export interface ListCustomersParams {
    page?: number;
    limit?: number;
    search?: string;
    includeArchived?: boolean;
}

// ---------------------------------------------------------------------------
// Type guard — confirms an unknown ApiError.details actually matches
// LimitReachedDetails's shape before the store trusts it as one. A 403
// can come from other causes too — this guard prevents mis-typing an
// unrelated 403's details as a plan-limit payload.
// ---------------------------------------------------------------------------

function isLimitReachedDetails(value: unknown): value is LimitReachedDetails {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.currentPlan === "string" &&
        typeof v.currentCount === "number" &&
        typeof v.limit === "number" &&
        Array.isArray(v.upgradeOptions)
    );
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCustomersStore = defineStore("customers", {
    state: () => ({
        list: [] as Customer[],
        total: 0,
        page: 1,
        current: null as Customer | null,
        searchResults: [] as Customer[],
        limitReached: null as LimitReachedDetails | null,
        isLoading: false,
        error: null as string | null
    }),

    actions: {
        async fetchList(params: ListCustomersParams = {}): Promise<void> {
            this.isLoading = true;
            this.error = null;
            try {
                const { data, meta } = await apiGetPaginated<Customer[]>(
                    "/customers",
                    params
                );
                this.list = data;
                this.page = meta.page;
                this.total = meta.totalItems; // NOW actually set
            } catch (err) {
                this.error =
                    err instanceof Error
                        ? err.message
                        : "Failed to load customers";
            } finally {
                this.isLoading = false;
            }
        },

        async search(query: string): Promise<void> {
            try {
                this.searchResults = await apiGet<Customer[]>(
                    "/customers/search",
                    { q: query }
                );
            } catch (err) {
                this.error =
                    err instanceof Error ? err.message : "Search failed";
            }
        },

        async fetchOne(id: string): Promise<void> {
            this.isLoading = true;
            this.error = null;
            try {
                this.current = await apiGet<Customer>(`/customers/${id}`);
            } catch (err) {
                this.error =
                    err instanceof Error
                        ? err.message
                        : "Failed to load customer";
            } finally {
                this.isLoading = false;
            }
        },

        async create(body: CreateCustomerBody): Promise<Customer | null> {
            this.error = null;
            this.limitReached = null;

            try {
                const customer = await apiPost<Customer>("/customers", body);
                this.list = [...this.list, customer];
                return customer;
            } catch (err) {
                if (
                    err instanceof ApiError &&
                    err.statusCode === 403 &&
                    isLimitReachedDetails(err.details)
                ) {
                    this.limitReached = err.details;
                    return null;
                }
                this.error =
                    err instanceof Error
                        ? err.message
                        : "Failed to create customer";
                throw err;
            }
        },

        async update(
            id: string,
            body: Partial<CreateCustomerBody>
        ): Promise<void> {
            const updated = await apiPatch<Customer>(`/customers/${id}`, body);
            this.list = this.list.map(c => (c.id === id ? updated : c));
            if (this.current?.id === id) {
                this.current = updated;
            }
        },

        async archive(id: string): Promise<void> {
            await apiPatch(`/customers/${id}/archive`);
            this.list = this.list.filter(c => c.id !== id);
        },

        async remove(id: string): Promise<void> {
            await apiDelete(`/customers/${id}`);
            this.list = this.list.filter(c => c.id !== id);
        }
    }
});
