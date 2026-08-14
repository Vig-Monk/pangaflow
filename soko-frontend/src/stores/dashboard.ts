// =============================================================================
// src/stores/dashboard.ts
// Built against the REAL FullDashboard shape (expenses.queries.ts,
// Prompt 3.1) — see delivery note above for the field-name conflict
// this resolves.
// =============================================================================

import { defineStore } from 'pinia';
import { apiGet } from '@/services/apiClient';

// ---------------------------------------------------------------------------
// Types — exact mirror of the real backend interface. No invented fields.
// ---------------------------------------------------------------------------

export interface Transaction {
  id: string;
  org_id: string;
  customer_id: string;
  customer_name?: string; // Add this line
  type: 'sale' | 'payment' | 'adjustment';
  amount: string;
  description: string | null;
  balance_after: string;
  created_by: string | null;
  created_at: string;
}
export interface FullDashboard {
  today: {
    sales: string;
    payments_received: string;
    expenses: string;
  };
  this_month: {
    revenue: string;
    expenses: string;
    profit: string;
    outstanding_balance: string;
  };
  customers: {
    total: number;
    with_debt: number;
    top_5_debtors: Array<{ id: string; name: string; balance: string }>;
  };
  recent_transactions: Transaction[];
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    summary: null as FullDashboard | null,
    loading: false,
    error: null as string | null,
  }),

  actions: {
    async fetchFull(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        this.summary = await apiGet<FullDashboard>('/dashboard/full');
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to load dashboard';
      } finally {
        this.loading = false;
      }
    },
  },
});