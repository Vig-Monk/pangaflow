<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/AnalyticsView.vue
// Deep Financial & Commercial Analytics Suite:
// - Real P&L Waterfall with True COGS (cost_price)
// - Capital Allocation Anatomy (% Cash vs % Stock vs % Customer Debt)
// - Debt Aging & Credit Risk Waterfall (0–7d, 8–30d, 30d+) with 1-tap WhatsApp Chasers
// - Category Unit Economics & Profitability Ranking Matrix
// =============================================================================

import { onMounted, ref, computed } from 'vue';
import { apiGet } from '@/services/apiClient';
import { useStoreSettingsStore } from '@/stores/store';
import StatCard from '@/components/ledger/StatCard.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
//import Button from '@/components/ui/Button.vue';
import {
  TrendingUp,
  Clock,
  PieChart,
  MessageSquare,
  Layers,
} from 'lucide-vue-next';

interface CategoryProfitItem {
  name: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPercent: number;
  unitsSold: number;
}

interface OverdueDebtor {
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  balance: number;
  daysOverdue: number;
  lastActivityAt: string;
}

interface FinancialAnalyticsPayload {
  period: {
    startDate: string;
    endDate: string;
  };
  pnl: {
    grossRevenue: number;
    cogs: number;
    grossProfit: number;
    grossMarginPercent: number;
    operatingExpenses: number;
    netProfit: number;
    netMarginPercent: number;
  };
  workingCapital: {
    liquidCash: number;
    inventoryValue: number;
    customerDebt: number;
    totalUnitsInStock: number;
    totalWorkingCapital: number;
    allocation: {
      cashPercent: number;
      stockPercent: number;
      debtPercent: number;
    };
  };
  debtAging: {
    totalDebt: number;
    debtorsCount: number;
    buckets: {
      fresh0To7Days: number;
      aging8To30Days: number;
      staleOver30Days: number;
    };
    overdueList: OverdueDebtor[];
  };
  categories: CategoryProfitItem[];
}

type PeriodPreset = '7d' | '30d' | 'this_month' | '90d';

const storeSettingsStore = useStoreSettingsStore();

const data = ref<FinancialAnalyticsPayload | null>(null);
const loading = ref(true);
const selectedPeriod = ref<PeriodPreset>('30d');

function getDateBounds(preset: PeriodPreset): { startDate: string; endDate: string } {
  const end = new Date();
  let start = new Date();

  if (preset === '7d') {
    start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  } else if (preset === '30d') {
    start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  } else if (preset === 'this_month') {
    start = new Date(end.getFullYear(), end.getMonth(), 1);
  } else if (preset === '90d') {
    start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  }

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

async function loadAnalyticsData(): Promise<void> {
  loading.value = true;
  try {
    const bounds = getDateBounds(selectedPeriod.value);
    data.value = await apiGet<FinancialAnalyticsPayload>('/analytics/overview', {
      startDate: bounds.startDate,
      endDate: bounds.endDate,
    });
  } catch {
    data.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  storeSettingsStore.fetchSettings();
  loadAnalyticsData();
});

function handlePeriodChange(preset: PeriodPreset): void {
  selectedPeriod.value = preset;
  loadAnalyticsData();
}

function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `KES ${num.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function buildDebtorReminderUrl(debtor: OverdueDebtor): string {
  if (!debtor.customerPhone) return '#';
  const cleanDigits = debtor.customerPhone.replace(/\D/g, '');
  const phone = cleanDigits.startsWith('0') ? `254${cleanDigits.slice(1)}` : cleanDigits;
  const storeName = storeSettingsStore.settings?.name || 'our store';
  const amount = debtor.balance.toLocaleString('en-KE');

  const text = `Hello ${debtor.customerName}, gentle balance reminder regarding your outstanding credit of KES ${amount} with ${storeName}. Kindly arrange payment. Thank you!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

// Visual proportions for P&L waterfall bar
const cogsPercentOfRev = computed(() => {
  if (!data.value || data.value.pnl.grossRevenue === 0) return 0;
  return Math.min(100, Math.round((data.value.pnl.cogs / data.value.pnl.grossRevenue) * 100));
});

const opexPercentOfRev = computed(() => {
  if (!data.value || data.value.pnl.grossRevenue === 0) return 0;
  return Math.min(100, Math.round((data.value.pnl.operatingExpenses / data.value.pnl.grossRevenue) * 100));
});
</script>

<template>
  <div class="analytics-suite-page">
    <!-- Header & Preset Range Selector -->
    <header class="page-header">
      <div>
        <h1 class="page-title">Commercial &amp; Financial Health</h1>
        <p class="page-subtitle">True gross margins with real stock cost (COGS), capital allocation, and debt aging analysis.</p>
      </div>

      <div class="period-tabs-bar">
        <button
          v-for="tab in [
            { key: '7d', label: 'Last 7 Days' },
            { key: '30d', label: 'Last 30 Days' },
            { key: 'this_month', label: 'This Month' },
            { key: '90d', label: 'Last 90 Days' },
          ]"
          :key="tab.key"
          type="button"
          class="period-tab-btn"
          :class="{ 'period-tab-btn--active': selectedPeriod === tab.key }"
          @click="handlePeriodChange(tab.key as PeriodPreset)"
        >
          {{ tab.label }}
        </button>
      </div>
    </header>

    <!-- Skeletons during loading -->
    <div v-if="loading && !data" class="loading-skeletons-stack">
      <div class="skeleton-grid-row">
        <Skeleton v-for="n in 4" :key="n" height="110px" radius="var(--radius-lg)" />
      </div>
      <Skeleton height="240px" radius="var(--radius-lg)" />
      <Skeleton height="200px" radius="var(--radius-lg)" />
    </div>

    <template v-else-if="data">
      <!-- 1. Executive Health Scorecard -->
      <section class="scorecard-grid">
        <StatCard
          label="Total Working Capital Value"
          :value="formatCurrency(data.workingCapital.totalWorkingCapital)"
          :loading="loading"
        />
        <StatCard
          label="True Net Operating Profit"
          :value="formatCurrency(data.pnl.netProfit)"
          :variant="data.pnl.netProfit >= 0 ? 'positive' : 'negative'"
          :loading="loading"
        />
        <StatCard
          label="Capital in Customer Debt (Madeni)"
          :value="formatCurrency(data.workingCapital.customerDebt)"
          variant="negative"
          :loading="loading"
        />
        <StatCard
          label="Capital in Warehouse / Shelves"
          :value="formatCurrency(data.workingCapital.inventoryValue)"
          :loading="loading"
        />
      </section>

      <!-- 2. Dual Analytics Row: Real P&L Waterfall + Capital Allocation Anatomy -->
      <div class="analytics-dual-row">
        <!-- Card A: Real Profit & Loss Waterfall -->
        <div class="analytics-card card">
          <div class="card-header-clean">
            <div class="title-wrap">
              <TrendingUp :size="18" class="text-teal" />
              <h2>Real Profit &amp; Loss Waterfall</h2>
            </div>
            <span class="margin-pill font-mono" :class="data.pnl.netMarginPercent >= 0 ? 'margin-pill--pos' : 'margin-pill--neg'">
              {{ data.pnl.netMarginPercent }}% Net Margin
            </span>
          </div>

          <div class="pnl-waterfall-stack">
            <!-- Level 1: Gross Revenue -->
            <div class="waterfall-row">
              <div class="row-label-wrap">
                <span class="row-title">Gross Billed Sales</span>
                <span class="row-desc text-muted">Storefront orders + direct sales</span>
              </div>
              <span class="row-value tabular-figure text-ink">{{ formatCurrency(data.pnl.grossRevenue) }}</span>
            </div>

            <!-- Level 2: Real COGS -->
            <div class="waterfall-row waterfall-row--deduct">
              <div class="row-label-wrap">
                <span class="row-title">− Cost of Goods Sold (COGS)</span>
                <span class="row-desc text-muted">Stock purchase cost ({{ cogsPercentOfRev }}% of revenue)</span>
              </div>
              <span class="row-value tabular-figure text-clay">−{{ formatCurrency(data.pnl.cogs) }}</span>
            </div>

            <!-- Level 3: Gross Profit Break -->
            <div class="waterfall-divider"></div>
            <div class="waterfall-row waterfall-row--subtotal">
              <div class="row-label-wrap">
                <span class="row-title font-semibold">= Real Gross Margin</span>
                <span class="row-desc text-muted">{{ data.pnl.grossMarginPercent }}% Gross Margin</span>
              </div>
              <span class="row-value tabular-figure font-bold text-teal">{{ formatCurrency(data.pnl.grossProfit) }}</span>
            </div>

            <!-- Level 4: Operating Expenses -->
            <div class="waterfall-row waterfall-row--deduct">
              <div class="row-label-wrap">
                <span class="row-title">− Operating Overhead (Opex)</span>
                <span class="row-desc text-muted">Rent, salaries, power, boda delivery fees ({{ opexPercentOfRev }}%)</span>
              </div>
              <span class="row-value tabular-figure text-clay">−{{ formatCurrency(data.pnl.operatingExpenses) }}</span>
            </div>

            <!-- Level 5: Net Profit -->
            <div class="waterfall-divider waterfall-divider--double"></div>
            <div class="waterfall-row waterfall-row--net">
              <div class="row-label-wrap">
                <span class="row-title font-bold">= True Net Operating Income</span>
                <span class="row-desc text-muted">What the business actually keeps</span>
              </div>
              <span
                class="row-value tabular-figure font-extrabold"
                :class="data.pnl.netProfit >= 0 ? 'text-teal' : 'text-clay'"
              >
                {{ formatCurrency(data.pnl.netProfit) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Card B: Capital Allocation Anatomy (Where is your money right now?) -->
        <div class="analytics-card card">
          <div class="card-header-clean">
            <div class="title-wrap">
              <PieChart :size="18" class="text-ink" />
              <h2>Working Capital Allocation</h2>
            </div>
            <span class="total-capital-tag tabular-figure font-mono">
              Total: {{ formatCurrency(data.workingCapital.totalWorkingCapital) }}
            </span>
          </div>

          <p class="section-explanation">
            Where is your working capital currently trapped across liquid cash, warehouse stock, and unpaid customer debt?
          </p>

          <!-- Multi-Segment Allocation Visual Bar -->
          <div class="allocation-bar-track">
            <div
              class="bar-segment bar-segment--cash"
              :style="{ width: `${data.workingCapital.allocation.cashPercent}%` }"
              :title="`Liquid Cash: ${data.workingCapital.allocation.cashPercent}%`"
            ></div>
            <div
              class="bar-segment bar-segment--stock"
              :style="{ width: `${data.workingCapital.allocation.stockPercent}%` }"
              :title="`Stock Assets: ${data.workingCapital.allocation.stockPercent}%`"
            ></div>
            <div
              class="bar-segment bar-segment--debt"
              :style="{ width: `${data.workingCapital.allocation.debtPercent}%` }"
              :title="`Customer Debt: ${data.workingCapital.allocation.debtPercent}%`"
            ></div>
          </div>

          <!-- Allocation Legend Cards -->
          <div class="allocation-legend-grid">
            <div class="legend-box legend-box--cash">
              <span class="legend-dot dot-cash"></span>
              <div class="legend-info">
                <span class="legend-label">Liquid Cash Inflow ({{ data.workingCapital.allocation.cashPercent }}%)</span>
                <span class="legend-val tabular-figure">{{ formatCurrency(data.workingCapital.liquidCash) }}</span>
              </div>
            </div>

            <div class="legend-box legend-box--stock">
              <span class="legend-dot dot-stock"></span>
              <div class="legend-info">
                <span class="legend-label">Stock on Shelves ({{ data.workingCapital.allocation.stockPercent }}%)</span>
                <span class="legend-val tabular-figure">{{ formatCurrency(data.workingCapital.inventoryValue) }}</span>
              </div>
            </div>

            <div class="legend-box legend-box--debt">
              <span class="legend-dot dot-debt"></span>
              <div class="legend-info">
                <span class="legend-label">Locked in Debt ({{ data.workingCapital.allocation.debtPercent }}%)</span>
                <span class="legend-val tabular-figure text-clay">{{ formatCurrency(data.workingCapital.customerDebt) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Debt Aging & Risk Waterfall (Madeni Analysis) -->
      <section class="analytics-card card">
        <div class="card-header-clean">
          <div class="title-wrap">
            <Clock :size="18" class="text-clay" />
            <h2>Debt Aging &amp; Recovery Waterfall (Madeni Velocity)</h2>
          </div>
          <span class="debt-total-badge tabular-figure font-mono">
            {{ data.debtAging.debtorsCount }} Debtors • {{ formatCurrency(data.debtAging.totalDebt) }} Total
          </span>
        </div>

        <!-- 3-Tier Aging Buckets -->
        <div class="aging-buckets-grid">
          <!-- Bucket 1: Fresh (0-7 Days) -->
          <div class="bucket-card bucket-card--fresh">
            <div class="bucket-header">
              <span class="bucket-tag">0–7 Days (Fresh)</span>
              <span class="risk-indicator text-teal">Low Risk</span>
            </div>
            <span class="bucket-amount tabular-figure">{{ formatCurrency(data.debtAging.buckets.fresh0To7Days) }}</span>
            <p class="bucket-desc">Recent credit sales with high probability of immediate collection.</p>
          </div>

          <!-- Bucket 2: Aging (8-30 Days) -->
          <div class="bucket-card bucket-card--aging">
            <div class="bucket-header">
              <span class="bucket-tag">8–30 Days (Aging)</span>
              <span class="risk-indicator text-gold">Follow-up Needed</span>
            </div>
            <span class="bucket-amount tabular-figure">{{ formatCurrency(data.debtAging.buckets.aging8To30Days) }}</span>
            <p class="bucket-desc">Active credit requiring routine follow-up before default risk increases.</p>
          </div>

          <!-- Bucket 3: Stale / Risk (>30 Days) -->
          <div class="bucket-card bucket-card--stale">
            <div class="bucket-header">
              <span class="bucket-tag">30+ Days (Stale)</span>
              <span class="risk-indicator text-clay">High Default Risk</span>
            </div>
            <span class="bucket-amount tabular-figure text-clay">{{ formatCurrency(data.debtAging.buckets.staleOver30Days) }}</span>
            <p class="bucket-desc">Overdue debt at risk of becoming bad debt. Urgent collection required.</p>
          </div>
        </div>

        <!-- Chronic Debtors Table with 1-Tap Reminders -->
        <div class="overdue-debtors-section" v-if="data.debtAging.overdueList.length > 0">
          <h3 class="subsection-title">Top Overdue Debtors Requiring Collection</h3>

          <div class="debtors-table-wrap">
            <table class="debtors-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Contact</th>
                  <th>Overdue Duration</th>
                  <th class="text-right">Balance Owed</th>
                  <th class="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="debtor in data.debtAging.overdueList" :key="debtor.customerId">
                  <td class="font-semibold">{{ debtor.customerName }}</td>
                  <td class="font-mono text-muted">{{ debtor.customerPhone || 'No Phone' }}</td>
                  <td>
                    <span
                      class="days-badge"
                      :class="{
                        'days-badge--fresh': debtor.daysOverdue <= 7,
                        'days-badge--aging': debtor.daysOverdue > 7 && debtor.daysOverdue <= 30,
                        'days-badge--stale': debtor.daysOverdue > 30,
                      }"
                    >
                      {{ debtor.daysOverdue }} days
                    </span>
                  </td>
                  <td class="text-right tabular-figure font-bold text-clay">{{ formatCurrency(debtor.balance) }}</td>
                  <td class="text-right">
                    <a
                      v-if="debtor.customerPhone"
                      :href="buildDebtorReminderUrl(debtor)"
                      target="_blank"
                      rel="noopener"
                      class="whatsapp-action-btn"
                    >
                      <MessageSquare :size="13" /> Remind via WhatsApp
                    </a>
                    <span v-else class="text-muted text-xs">No Phone</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- 4. Category Unit Economics & Profit Margins Matrix -->
      <section class="analytics-card card">
        <div class="card-header-clean">
          <div class="title-wrap">
            <Layers :size="18" class="text-ink" />
            <h2>Category Unit Economics &amp; Gross Margins</h2>
          </div>
          <span class="count-badge font-mono">{{ data.categories.length }} Categories</span>
        </div>

        <div v-if="data.categories.length === 0" class="empty-category-notice">
          <p>No product orders recorded for this time period to calculate category margins.</p>
        </div>

        <div v-else class="category-table-wrap">
          <table class="category-matrix-table">
            <thead>
              <tr>
                <th>Category</th>
                <th class="text-right">Units Sold</th>
                <th class="text-right">Revenue</th>
                <th class="text-right">Real Stock COGS</th>
                <th class="text-right">Gross Profit</th>
                <th class="text-right">Margin %</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="cat in data.categories" :key="cat.name">
                <td class="font-bold">{{ cat.name }}</td>
                <td class="text-right tabular-figure">{{ cat.unitsSold }}</td>
                <td class="text-right tabular-figure font-semibold">{{ formatCurrency(cat.revenue) }}</td>
                <td class="text-right tabular-figure text-muted">−{{ formatCurrency(cat.cogs) }}</td>
                <td class="text-right tabular-figure font-bold text-teal">{{ formatCurrency(cat.grossProfit) }}</td>
                <td class="text-right">
                  <span
                    class="margin-badge font-mono"
                    :class="{
                      'margin-badge--high': cat.marginPercent >= 40,
                      'margin-badge--mid': cat.marginPercent >= 20 && cat.marginPercent < 40,
                      'margin-badge--low': cat.marginPercent < 20,
                    }"
                  >
                    {{ cat.marginPercent }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.analytics-suite-page {
  max-width: 1140px;
  width: 100%;
  margin: 0 auto;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.page-title { font-size: var(--text-2xl); }
.page-subtitle { font-size: var(--text-sm); color: var(--color-text-muted); margin-top: 2px; max-width: 650px; }

/* Period Preset Tabs */
.period-tabs-bar {
  display: flex;
  gap: var(--space-1);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 3px;
  border-radius: var(--radius-md);
}

.period-tab-btn {
  background: transparent;
  border: none;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
  white-space: nowrap;
}

.period-tab-btn:hover {
  color: var(--color-text);
}

.period-tab-btn--active {
  background: var(--color-ink);
  color: var(--color-text-inverse) !important;
}

/* Skeletons */
.loading-skeletons-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.skeleton-grid-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
}

/* Scorecard Grid */
.scorecard-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
}

@media (max-width: 960px) {
  .scorecard-grid { grid-template-columns: repeat(2, 1fr); }
  .skeleton-grid-row { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 540px) {
  .scorecard-grid { grid-template-columns: 1fr; }
  .skeleton-grid-row { grid-template-columns: 1fr; }
}
/* Dual Analytics Row */
.analytics-dual-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-5);
}

@media (max-width: 860px) {
  .analytics-dual-row { grid-template-columns: 1fr; }
}

.analytics-card {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.card-header-clean {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-3);
  flex-wrap: wrap;
  gap: var(--space-2);
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.title-wrap h2 {
  font-family: var(--font-display);
  font-size: var(--text-base);
  font-weight: 700;
}

.margin-pill {
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}
.margin-pill--pos { background: color-mix(in srgb, var(--color-ledger-green) 15%, transparent); color: var(--color-ledger-green); }
.margin-pill--neg { background: color-mix(in srgb, var(--color-market-clay) 15%, transparent); color: var(--color-market-clay); }

/* P&L Waterfall Stack */
.pnl-waterfall-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.waterfall-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-xs);
}

.row-label-wrap {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.row-title { font-weight: 700; color: var(--color-text); }
.row-desc { font-size: 10px; }

.row-value {
  font-size: var(--text-sm);
  font-weight: 800;
}

.waterfall-divider {
  height: 1px;
  background: var(--color-border);
  margin: var(--space-1) 0;
}

.waterfall-divider--double {
  height: 2px;
  background: var(--color-ink);
  margin: var(--space-2) 0;
}

.waterfall-row--subtotal {
  background: var(--color-bg);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
}

.waterfall-row--net {
  background: color-mix(in srgb, var(--color-ink) 5%, transparent);
  padding: var(--space-3);
  border-radius: var(--radius-md);
}

.section-explanation {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: var(--leading-relaxed);
}

/* Allocation Bar Track */
.allocation-bar-track {
  height: 16px;
  background: var(--color-bg);
  border-radius: var(--radius-full);
  display: flex;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.bar-segment {
  height: 100%;
  transition: width var(--duration-base) var(--ease-standard);
}
.bar-segment--cash { background: var(--color-ledger-green); }
.bar-segment--stock { background: var(--color-info); }
.bar-segment--debt { background: var(--color-market-clay); }

.allocation-legend-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.legend-box {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-cash { background: var(--color-ledger-green); }
.dot-stock { background: var(--color-info); }
.dot-debt { background: var(--color-market-clay); }

.legend-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.legend-label { font-size: var(--text-xs); font-weight: 600; }
.legend-val { font-size: var(--text-xs); font-weight: 800; }

.total-capital-tag {
  font-size: 11px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-weight: 700;
}

/* Debt Aging Waterfall */
.debt-total-badge {
  font-size: 11px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: 2px var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--color-market-clay);
  font-weight: 700;
}

.aging-buckets-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}
@media (max-width: 768px) {
  .aging-buckets-grid { grid-template-columns: 1fr; }
}

.bucket-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.bucket-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bucket-tag {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.risk-indicator {
  font-size: 10px;
  font-weight: 700;
}

.bucket-amount {
  font-size: var(--text-xl);
  font-weight: 800;
}

.bucket-desc {
  font-size: 10px;
  color: var(--color-text-muted);
  line-height: var(--leading-normal);
}

.overdue-debtors-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.subsection-title {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.debtors-table-wrap, .category-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.debtors-table, .category-matrix-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: var(--text-xs);
}

.debtors-table th, .category-matrix-table th {
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  font-size: 10px;
  white-space: nowrap;
}

.debtors-table td, .category-matrix-table td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.days-badge {
  display: inline-flex;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
}
.days-badge--fresh { background: color-mix(in srgb, var(--color-ledger-green) 15%, transparent); color: var(--color-ledger-green); }
.days-badge--aging { background: color-mix(in srgb, var(--color-gold) 15%, transparent); color: var(--color-gold-hover); }
.days-badge--stale { background: color-mix(in srgb, var(--color-market-clay) 15%, transparent); color: var(--color-market-clay); }

.whatsapp-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: color-mix(in srgb, var(--color-ledger-green) 12%, transparent);
  border: 1px solid var(--color-ledger-green);
  color: var(--color-ledger-green);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
}
.whatsapp-action-btn:hover {
  background: var(--color-ledger-green);
  color: #FFFFFF;
}

.margin-badge {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 800;
}
.margin-badge--high { background: color-mix(in srgb, var(--color-ledger-green) 15%, transparent); color: var(--color-ledger-green); }
.margin-badge--mid { background: color-mix(in srgb, var(--color-gold) 15%, transparent); color: var(--color-gold-hover); }
.margin-badge--low { background: color-mix(in srgb, var(--color-market-clay) 15%, transparent); color: var(--color-market-clay); }

.count-badge {
  font-size: 11px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
}

.empty-category-notice {
  text-align: center;
  padding: var(--space-8);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.text-right { text-align: right; }
.text-teal { color: var(--color-ledger-green); }
.text-clay { color: var(--color-market-clay); }
.text-gold { color: var(--color-gold-hover); }
.text-info { color: var(--color-info); }
.text-ink { color: var(--color-ink); }
</style>