<script setup lang="ts">
// =============================================================================
// src/views/ExpenseSummaryView.vue
// Calls BOTH fetchProfitLoss AND fetchSummary — two separate real
// endpoints. See delivery note above for why this isn't one call.
// =============================================================================

import { computed, onMounted, ref, watch } from 'vue';
import { useExpensesStore } from '@/stores/expenses';
import StatCard from '@/components/ledger/StatCard.vue';

const expensesStore = useExpensesStore();

const now = new Date();
const selectedMonth = ref(now.getMonth() + 1); // JS months are 0-indexed; backend expects 1-12
const selectedYear = ref(now.getFullYear());

// expenses.fetchSummary(startDate, endDate) needs a date RANGE, not a
// month/year pair — deriving the full-month range from the same
// picker so both calls stay in sync against the same period, even
// though the two backend endpoints take differently-shaped parameters.
function monthDateRange(month: number, year: number): { startDate: string; endDate: string } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // day 0 of next month = last day of this month
  const toISODate = (d: Date): string => d.toISOString().slice(0, 10);
  return { startDate: toISODate(start), endDate: toISODate(end) };
}

async function loadAll(): Promise<void> {
  const { startDate, endDate } = monthDateRange(selectedMonth.value, selectedYear.value);
  await Promise.all([
    expensesStore.fetchProfitLoss(selectedMonth.value, selectedYear.value),
    expensesStore.fetchSummary(startDate, endDate),
  ]);
}

onMounted(loadAll);
watch([selectedMonth, selectedYear], loadAll);

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  return `KES ${num.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

const monthOptions = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const yearOptions = computed<number[]>(() => {
  const current = now.getFullYear();
  return [current - 2, current - 1, current];
});

// Proportional bar width — largest category in the current breakdown
// gets 100% width, everything else scales relative to it.
const maxCategoryTotal = computed<number>(() => {
  const totals = (expensesStore.summary?.by_category ?? []).map((c) => parseFloat(c.total));
  return totals.length > 0 ? Math.max(...totals) : 1;
});

function barWidth(total: string): string {
  const value = parseFloat(total);
  return `${(value / maxCategoryTotal.value) * 100}%`;
}
</script>

<template>
  <div class="summary-page">
    <div class="page-header">
      <h1 class="page-title">Profit &amp; Loss</h1>
      <div class="period-picker">
        <select v-model.number="selectedMonth" class="period-picker__select">
          <option v-for="(name, idx) in monthOptions" :key="idx" :value="idx + 1">{{ name }}</option>
        </select>
        <select v-model.number="selectedYear" class="period-picker__select">
          <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
    </div>

    <div class="stat-row">
      <StatCard
        label="Revenue"
        :value="expensesStore.profitLoss ? formatCurrency(expensesStore.profitLoss.total_payments_received) : ''"
      />
      <StatCard
        label="Expenses"
        :value="expensesStore.profitLoss ? formatCurrency(expensesStore.profitLoss.total_expenses) : ''"
        variant="negative"
      />
      <StatCard
        label="Net"
        :value="expensesStore.profitLoss ? formatCurrency(expensesStore.profitLoss.profit) : ''"
        :variant="expensesStore.profitLoss && parseFloat(expensesStore.profitLoss.profit) >= 0 ? 'positive' : 'negative'"
      />
    </div>

    <section class="breakdown-section">
      <h2 class="section-title">By Category</h2>

      <p v-if="expensesStore.summary && expensesStore.summary.by_category.length === 0" class="no-data-text">
        No expenses recorded for this period.
      </p>

      <div v-else class="breakdown-list">
        <div v-for="cat in expensesStore.summary?.by_category ?? []" :key="cat.category_id" class="breakdown-row">
          <div class="breakdown-row__label">
            <span class="breakdown-row__name">{{ cat.name }}</span>
            <span class="breakdown-row__amount tabular-figure">{{ formatCurrency(cat.total) }}</span>
          </div>
          <div class="breakdown-row__bar-track">
            <div class="breakdown-row__bar-fill" :style="{ width: barWidth(cat.total) }" />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.summary-page {
  padding: var(--space-6);
  max-width: 720px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.page-title {
  font-size: var(--text-2xl);
}

.period-picker {
  display: flex;
  gap: var(--space-2);
}

.period-picker__select {
  min-height: 40px;
  padding: 0 var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--color-text);
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

@media (max-width: 640px) {
  .stat-row { grid-template-columns: 1fr; }
}

.section-title {
  font-size: var(--text-lg);
  margin-bottom: var(--space-4);
}

.no-data-text {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.breakdown-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.breakdown-row__label {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.breakdown-row__name {
  font-weight: 600;
  color: var(--color-text);
  font-size: var(--text-sm);
}

.breakdown-row__amount {
  color: var(--color-text);
  font-size: var(--text-sm);
}

.breakdown-row__bar-track {
  height: 8px;
  background: var(--color-bg);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.breakdown-row__bar-fill {
  height: 100%;
  background: var(--color-ink);
  border-radius: var(--radius-full);
  transition: width var(--duration-base) var(--ease-standard);
}
</style>