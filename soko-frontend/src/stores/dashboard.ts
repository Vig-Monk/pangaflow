// =============================================================================
// soko-frontend/src/stores/dashboard.ts
// =============================================================================

import { defineStore } from 'pinia';
import { apiGet } from '@/services/apiClient';

export interface Transaction {
  id: string;
  org_id: string;
  customer_id: string;
  customer_name?: string;
  type: 'sale' | 'payment' | 'adjustment';
  amount: string;
  description: string | null;
  balance_after: string;
  created_by: string | null;
  created_at: string;
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
    top_5_debtors: DebtorItem[];
  };
  orders_queue?: OrdersQueueSummary;
  critical_stock?: CriticalStockItem[];
  recent_transactions: Transaction[];
}

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
        this.error = err instanceof Error ? err.message : 'Failed to load dashboard summary';
      } finally {
        this.loading = false;
      }
    },
  },
});