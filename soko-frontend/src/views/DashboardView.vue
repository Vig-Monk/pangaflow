<script setup lang="ts">
// =============================================================================
// src/views/DashboardView.vue
// Financial summary — outstanding balance, today's collections/sales,
// top debtors. Uses useApi to load getDashboardSummary on mount.
// =============================================================================

import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '@/composables/useApi';
import * as transactionsApi from '@/api/transactions.api';
import { useAuthStore } from '@/stores/auth.store';

const router = useRouter();
const authStore = useAuthStore();

const {
  data: summary,
  isLoading,
  error,
  execute: loadSummary,
} = useApi(transactionsApi.getDashboardSummary);

onMounted(() => {
  loadSummary();
});

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function goToCustomer(id: string): void {
  router.push(`/customers/${id}`);
}
</script>

<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <div>
        <p class="org-name text-muted">{{ authStore.orgName }}</p>
        <h1 class="page-title">Dashboard</h1>
      </div>
    </header>

    <div v-if="isLoading && !summary" class="state-message text-muted">
      Loading dashboard…
    </div>

    <div v-else-if="error" class="state-message text-danger">
      {{ error }}
      <button class="btn-secondary retry-btn" @click="loadSummary()">Retry</button>
    </div>

    <template v-else-if="summary">
      <div class="summary-grid">
        <div class="card summary-card outstanding">
          <p class="summary-label text-muted">Total Outstanding</p>
          <p class="summary-value text-amber">
            {{ formatCurrency(summary.total_outstanding) }}
          </p>
        </div>

        <div class="card summary-card">
          <p class="summary-label text-muted">Collected Today</p>
          <p class="summary-value text-teal">
            {{ formatCurrency(summary.total_collected_today) }}
          </p>
        </div>

        <div class="card summary-card">
          <p class="summary-label text-muted">Sales Today</p>
          <p class="summary-value">
            {{ formatCurrency(summary.total_sales_today) }}
          </p>
        </div>

        <div class="card summary-card">
          <p class="summary-label text-muted">Customers With Debt</p>
          <p class="summary-value">{{ summary.customers_with_debt }}</p>
        </div>
      </div>

      <section class="top-debtors-section">
        <h2 class="section-title">Top Debtors</h2>

        <div v-if="summary.top_debtors.length === 0" class="empty-state text-muted">
          No outstanding balances. 🎉
        </div>

        <ul v-else class="debtor-list">
          <li
            v-for="debtor in summary.top_debtors"
            :key="debtor.id"
            class="debtor-item card touchable"
            @click="goToCustomer(debtor.id)"
          >
            <span class="debtor-name">{{ debtor.name }}</span>
            <span class="debtor-balance text-amber">{{ formatCurrency(debtor.balance) }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 16px;
  padding-top: 24px;
}

.dashboard-header {
  margin-bottom: 20px;
}

.org-name {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-top: 2px;
}

.state-message {
  text-align: center;
  padding: 40px 16px;
}

.retry-btn {
  display: block;
  margin: 12px auto 0;
}

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 24px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-card.outstanding {
  grid-column: span 2;
}

.summary-label {
  font-size: 13px;
}

.summary-value {
  font-size: 22px;
  font-weight: 700;
}

.summary-card.outstanding .summary-value {
  font-size: 32px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 10px;
}

.empty-state {
  text-align: center;
  padding: 24px;
}

.debtor-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.debtor-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: var(--touch-min);
}

.debtor-name {
  font-weight: 500;
}

.debtor-balance {
  font-weight: 600;
}
</style>