// =============================================================================
// soko-frontend/src/stores/customers.ts
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

export type PlanName = "free" | "pro" | "business" | "lifetime";

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
                this.total = meta.totalItems;
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
            if (!query || query.trim().length === 0) {
                this.searchResults = [];
                return;
            }
            try {
                this.searchResults = await apiGet<Customer[]>(
                    "/customers/search",
                    { q: query.trim() }
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
                this.list = [customer, ...this.list];
                this.total += 1;
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
            this.total = Math.max(0, this.total - 1);
        },

        async remove(id: string): Promise<void> {
            await apiDelete(`/customers/${id}`);
            this.list = this.list.filter(c => c.id !== id);
            this.total = Math.max(0, this.total - 1);
        }
    }
});