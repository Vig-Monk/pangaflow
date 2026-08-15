// =============================================================================
// soko-frontend/src/stores/ledger.ts
// =============================================================================

import { defineStore } from "pinia";
import { apiGetPaginated, apiPost } from "@/services/apiClient";
import { useDashboardStore } from "./dashboard";
import type { Transaction } from "./dashboard";

export type TransactionType = "sale" | "payment" | "adjustment";

export interface RecordTransactionBody {
    customerId: string;
    type: TransactionType;
    amount: number;
    description?: string;
}

export interface LedgerFetchParams {
    page?: number;
    limit?: number;
}

export interface CustomerLedgerResult {
    customer: { id: string; name: string; phone: string | null };
    current_balance: string;
    transactions: Transaction[];
    total: number;
}

export const useLedgerStore = defineStore("ledger", {
    state: () => ({
        entries: [] as Transaction[],
        total: 0,
        page: 1,
        loadingLedger: false,
        error: null as string | null,
        currentCustomerId: null as string | null
    }),

    actions: {
        async fetchLedger(
            customerId: string,
            params: LedgerFetchParams = {}
        ): Promise<void> {
            this.loadingLedger = true;
            this.error = null;
            this.currentCustomerId = customerId;
            try {
                const { data, meta } =
                    await apiGetPaginated<CustomerLedgerResult>(
                        `/transactions/${customerId}`,
                        params
                    );
                this.entries = data.transactions;
                this.page = meta.page;
                this.total = meta.totalItems;
            } catch (err) {
                this.error =
                    err instanceof Error
                        ? err.message
                        : "Failed to load ledger";
            } finally {
                this.loadingLedger = false;
            }
        },

        async record(
            customerId: string,
            type: TransactionType,
            amount: number,
            description?: string
        ): Promise<Transaction> {
            const body: RecordTransactionBody = {
                customerId,
                type,
                amount,
                description
            };
            const newEntry = await apiPost<Transaction>("/transactions", body);

            if (this.currentCustomerId === customerId) {
                await this.fetchLedger(customerId, { page: 1 });
            }

            const dashboardStore = useDashboardStore();
            await dashboardStore.fetchFull();

            return newEntry;
        },

        async recordSale(
            customerId: string,
            amount: number,
            description?: string
        ): Promise<Transaction> {
            return this.record(customerId, "sale", amount, description);
        },

        async recordPayment(
            customerId: string,
            amount: number,
            description?: string
        ): Promise<Transaction> {
            return this.record(customerId, "payment", amount, description);
        },

        async recordAdjustment(
            customerId: string,
            amount: number,
            description?: string
        ): Promise<Transaction> {
            return this.record(customerId, "adjustment", amount, description);
        }
    }
});
