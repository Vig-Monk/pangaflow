// =============================================================================
// src/stores/ledger.ts
// THE single write path for money movement. Every feature that creates
// a transaction — manual entry today, anything else later — calls
// record() here. No component POSTs /transactions directly.
// =============================================================================

import { defineStore } from "pinia";
import { apiGet, apiGetPaginated, apiPost } from "@/services/apiClient";
import { useDashboardStore } from "./dashboard";
import type { Transaction } from "./dashboard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useLedgerStore = defineStore("ledger", {
    state: () => ({
        entries: [] as Transaction[],
        total: 0,
        page: 1,
        loadingLedger: false,
        error: null as string | null,
        // Tracks which customer's ledger is currently loaded, so record()
        // knows whether to refetch page 1 (see the note on the "prepend vs
        // refetch" decision below).
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
        const { data, meta } = await apiGetPaginated<CustomerLedgerResult>(
            `/transactions/${customerId}`,
            params
        );
        this.entries = data.transactions; // Extract nested array
        this.page = meta.page;
        this.total = meta.totalItems;
    } catch (err) {
        this.error = err instanceof Error ? err.message : "Failed to load ledger";
    } finally {
        this.loadingLedger = false;
    }
},

        /**
         * The one function that actually writes a transaction. Every
         * type-specific helper below (recordSale, recordPayment,
         * recordAdjustment) is a thin wrapper around this.
         */
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

            // "Prepend optimistically-safe" per design.md's spec: rather than
            // literally unshift the new entry into `entries` client-side,
            // if the customer detail view for THIS customer is currently open
            // (tracked via currentCustomerId), refetch page 1 from the server —
            // the source of truth — rather than trust a client-side splice.
            if (this.currentCustomerId === customerId) {
                await this.fetchLedger(customerId, { page: 1 });
            }

            // Trigger a dashboard refresh so stat cards update without a full
            // page reload — exactly what design.md's spec asks for. Pinia
            // stores can freely call other stores' actions; useDashboardStore()
            // here returns the SAME singleton instance every other part of the
            // app already has, not a new one.
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
