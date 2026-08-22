<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/DashboardView.vue
// 7:30 AM Morning Operational Cockpit: Cash pulse, Pack queue, Madeni chaser & Stock radar.
// =============================================================================

import { computed, onMounted, ref } from 'vue';
import { useDashboardStore } from '@/stores/dashboard';
import { useCustomersStore } from '@/stores/customers';
import { useStoreSettingsStore } from '@/stores/store';
import LedgerRow from '@/components/ledger/LedgerRow.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import Button from '@/components/ui/Button.vue';
import SmartSaleModal from '@/components/ledger/SmartSaleModal.vue';
import {
  Store,
  Inbox,
  AlertTriangle,
  Plus,
  ArrowRight,
  TrendingUp,
  Package,
  MessageSquare,
  DollarSign,
  Clock,
  ExternalLink,
} from 'lucide-vue-next';

const dashboardStore = useDashboardStore();
const customersStore = useCustomersStore();
const storeSettingsStore = useStoreSettingsStore();

const showSmartSaleModal = ref(false);

onMounted(() => {
  dashboardStore.fetchFull();
  customersStore.fetchList({ limit: 100 });
  storeSettingsStore.fetchSettings();
});

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `KES ${num.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildDebtorReminderUrl(debtor: { name: string; phone: string | null; balance: string }): string {
  if (!debtor.phone) return '#';
  const cleanDigits = debtor.phone.replace(/\D/g, '');
  const phone = cleanDigits.startsWith('0') ? `254${cleanDigits.slice(1)}` : cleanDigits;
  const storeName = storeSettingsStore.settings?.name || 'our store';
  const amount = Number(debtor.balance).toLocaleString('en-KE');

  const text = `Hello ${debtor.name}, gentle reminder regarding your outstanding balance of KES ${amount} with ${storeName}. Kindly make arrangements to settle. Thank you!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

function handleSaleSuccess(): void {
  dashboardStore.fetchFull();
  customersStore.fetchList({ limit: 100 });
}

const summary = computed(() => dashboardStore.summary);
const storeStatus = computed(() => storeSettingsStore.settings?.status ?? 'draft');
</script>

<template>
  <div class="page-container">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Morning Standup</h1>
        <p class="page-subtitle">Today's cash pulse, order packing queue, and active debt chasers.</p>
      </div>

      <div class="header-action-group">
        <router-link :to="{ name: 'analytics' }">
          <Button variant="secondary" size="md">
            <TrendingUp :size="16" /> Financial Analytics
          </Button>
        </router-link>
        <Button variant="primary" size="md" @click="showSmartSaleModal = true">
          <Plus :size="16" /> Record Sale &amp; POS
        </Button>
      </div>
    </div>

    <!-- 1. Operational Status Pill Bar -->
    <div class="operational-badges-row">
      <router-link :to="{ name: 'store-settings' }" class="op-badge op-badge--store" :class="storeStatus">
        <Store :size="14" />
        <span>Store: <strong>{{ storeStatus.toUpperCase() }}</strong></span>
      </router-link>

      <router-link :to="{ name: 'merchant-orders' }" class="op-badge">
        <Inbox :size="14" />
        <span>Orders Today: <strong>{{ summary?.orders_queue?.today_completed ?? 0 }}</strong></span>
      </router-link>

      <router-link :to="{ name: 'inventory' }" class="op-badge" :class="{ 'op-badge--warning': (summary?.critical_stock?.length ?? 0) > 0 }">
        <AlertTriangle :size="14" />
        <span>Critical Stock: <strong>{{ summary?.critical_stock?.length ?? 0 }}</strong></span>
      </router-link>
    </div>

    <!-- 2. The 7:30 AM Morning Standup Cockpit (4 Core Action Cards) -->
    <section class="morning-cockpit-grid">
      <!-- Card A: Liquid Inflow Today -->
      <div class="cockpit-card card">
        <div class="card-header-micro">
          <DollarSign :size="16" class="text-teal" />
          <span class="micro-label">Cash Collected Today</span>
        </div>
        <p class="cockpit-main-val tabular-figure text-teal">
          {{ summary ? formatCurrency(summary.today.payments_received) : '—' }}
        </p>
        <div class="cockpit-meta-row">
          <span>Sales: {{ summary ? formatCurrency(summary.today.sales) : '—' }}</span>
          <span>Expenses: {{ summary ? formatCurrency(summary.today.expenses) : '—' }}</span>
        </div>
      </div>

      <!-- Card B: Order Fulfillment Queue -->
      <div class="cockpit-card card">
        <div class="card-header-micro">
          <Package :size="16" class="text-ink" />
          <span class="micro-label">Today's Order Queue</span>
        </div>
        <div class="queue-split-row">
          <div class="queue-item">
            <span class="queue-num tabular-figure">{{ summary?.orders_queue?.pending_pack ?? 0 }}</span>
            <span class="queue-desc">To Pack</span>
          </div>
          <div class="queue-item">
            <span class="queue-num tabular-figure text-info">{{ summary?.orders_queue?.out_for_delivery ?? 0 }}</span>
            <span class="queue-desc">With Bodas</span>
          </div>
        </div>
        <router-link :to="{ name: 'merchant-orders' }" class="cockpit-link">
          Open Orders Queue <ArrowRight :size="12" />
        </router-link>
      </div>

      <!-- Card C: Overdue Credit Debt -->
      <div class="cockpit-card card">
        <div class="card-header-micro">
          <Clock :size="16" class="text-clay" />
          <span class="micro-label">Customer Debt Receivable</span>
        </div>
        <p class="cockpit-main-val tabular-figure text-clay">
          {{ summary ? formatCurrency(summary.this_month.outstanding_balance) : '—' }}
        </p>
        <div class="cockpit-meta-row">
          <span>{{ summary?.customers?.with_debt ?? 0 }} customers owing balance</span>
        </div>
        <router-link :to="{ name: 'customers' }" class="cockpit-link">
          Manage Customer Credit <ArrowRight :size="12" />
        </router-link>
      </div>

      <!-- Card D: Month Net Run-Rate -->
      <div class="cockpit-card card">
        <div class="card-header-micro">
          <TrendingUp :size="16" class="text-gold" />
          <span class="micro-label">Month Net Operating Income</span>
        </div>
        <p class="cockpit-main-val tabular-figure">
          {{ summary ? formatCurrency(summary.this_month.profit) : '—' }}
        </p>
        <div class="cockpit-meta-row">
          <span>Rev: {{ summary ? formatCurrency(summary.this_month.revenue) : '—' }}</span>
          <span>Exp: {{ summary ? formatCurrency(summary.this_month.expenses) : '—' }}</span>
        </div>
      </div>
    </section>

    <!-- 3. Dual Tactical Action Tables: Debt Chasers & Stockout Radar -->
    <div class="tactical-split-row">
      <!-- Left: Madeni Chaser Widget -->
      <div class="tactical-card card">
        <div class="tactical-header">
          <div class="title-wrap">
            <Clock :size="16" class="text-clay" />
            <h3>Madeni Chaser — Immediate Follow-ups</h3>
          </div>
          <span class="count-tag">{{ summary?.customers?.top_5_debtors?.length ?? 0 }} Debtors</span>
        </div>

        <div v-if="!summary?.customers?.top_5_debtors?.length" class="empty-mini">
          <span>🎉 All customer balances are currently settled!</span>
        </div>

        <div v-else class="debtor-chaser-list">
          <div
            v-for="debtor in summary.customers.top_5_debtors"
            :key="debtor.id"
            class="debtor-row"
          >
            <div class="debtor-info">
              <span class="debtor-name">{{ debtor.name }}</span>
              <span class="debtor-sub text-muted">
                {{ debtor.days_overdue > 0 ? `${debtor.days_overdue} days overdue` : 'Recent balance' }}
              </span>
            </div>

            <div class="debtor-actions">
              <span class="debtor-amt tabular-figure text-clay">{{ formatCurrency(debtor.balance) }}</span>
              <a
                v-if="debtor.phone"
                :href="buildDebtorReminderUrl(debtor)"
                target="_blank"
                rel="noopener"
                class="whatsapp-reminder-btn"
                title="Send WhatsApp Balance Reminder"
              >
                <MessageSquare :size="13" /> Remind
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Stockout Radar Widget -->
      <div class="tactical-card card">
        <div class="tactical-header">
          <div class="title-wrap">
            <AlertTriangle :size="16" class="text-clay" />
            <h3>Stockout Radar — Restock Needed</h3>
          </div>
          <router-link :to="{ name: 'inventory' }" class="text-link text-xs">
            View All <ExternalLink :size="11" />
          </router-link>
        </div>

        <div v-if="!summary?.critical_stock?.length" class="empty-mini">
          <span>✓ All catalog inventory is above alert thresholds.</span>
        </div>

        <div v-else class="critical-stock-list">
          <div
            v-for="item in summary.critical_stock"
            :key="item.id"
            class="stock-item-row"
          >
            <div class="stock-info">
              <span class="stock-name">{{ item.name }}</span>
              <span class="stock-threshold text-muted">Alert threshold: {{ item.low_stock_at }} units</span>
            </div>
            <span
              class="stock-badge tabular-figure"
              :class="item.stock === 0 ? 'stock-badge--zero' : 'stock-badge--low'"
            >
              {{ item.stock === 0 ? 'Out of Stock' : `${item.stock} left` }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. Recent Transaction Log -->
    <section class="activity-section">
      <div class="section-title-row">
        <h2 class="section-title">Recent Operational Log</h2>
        <router-link :to="{ name: 'customers' }" class="text-link text-xs">
          View Complete Ledger <ArrowRight :size="12" />
        </router-link>
      </div>

      <div v-if="dashboardStore.loading" class="activity-skeleton-list">
        <div v-for="n in 4" :key="n" class="skeleton-row card">
          <div class="skeleton-col">
            <Skeleton height="15px" width="130px" />
            <Skeleton height="11px" width="80px" />
          </div>
          <div class="skeleton-col skeleton-col--right">
            <Skeleton height="15px" width="80px" />
            <Skeleton height="11px" width="50px" />
          </div>
        </div>
      </div>

      <EmptyState
        v-else-if="summary && summary.recent_transactions.length === 0"
        title="No activity yet"
        description="Record your first POS sale or receive a storefront order to see it here."
      />

      <div v-else class="activity-list">
        <LedgerRow
          v-for="tx in summary?.recent_transactions ?? []"
          :key="tx.id"
          :customer-name="tx.customer_name ?? tx.customer_id"
          :amount="formatCurrency(tx.amount)"
          :type="tx.type"
          :timestamp="formatTimestamp(tx.created_at)"
        />
      </div>
    </section>

    <!-- Smart Sale POS Modal -->
    <SmartSaleModal
      :open="showSmartSaleModal"
      @close="showSmartSaleModal = false"
      @success="handleSaleSuccess"
    />
  </div>
</template>

<style scoped>
.page-container {
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.page-title { font-size: var(--text-2xl); }
.page-subtitle { font-size: var(--text-sm); color: var(--color-text-muted); margin-top: 2px; }

.header-action-group {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.operational-badges-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.op-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-decoration: none;
  transition: border-color var(--duration-fast) var(--ease-standard);
}
.op-badge:hover { border-color: var(--color-ink); }
.op-badge strong { color: var(--color-text); }
.op-badge--store.published { border-color: var(--color-ledger-green); color: var(--color-ledger-green); }
.op-badge--store.published strong { color: var(--color-ledger-green); }
.op-badge--warning { border-color: var(--color-market-clay); color: var(--color-market-clay); }
.op-badge--warning strong { color: var(--color-market-clay); }

/* Cockpit 4-Grid */
.morning-cockpit-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
}

@media (max-width: 960px) {
  .morning-cockpit-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 560px) {
  .morning-cockpit-grid { grid-template-columns: 1fr; }
}

.cockpit-card {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.card-header-micro {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.micro-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.cockpit-main-val {
  font-size: var(--text-2xl);
  font-weight: 800;
  line-height: 1.1;
}

.cockpit-meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: auto;
}

.queue-split-row {
  display: flex;
  gap: var(--space-4);
  align-items: center;
}

.queue-item {
  display: flex;
  flex-direction: column;
}

.queue-num {
  font-size: var(--text-2xl);
  font-weight: 800;
}

.queue-desc {
  font-size: 11px;
  color: var(--color-text-muted);
}

.cockpit-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 700;
  color: var(--brand-primary);
  text-decoration: none;
  margin-top: var(--space-1);
}

/* Tactical Split Row */
.tactical-split-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

@media (max-width: 768px) {
  .tactical-split-row { grid-template-columns: 1fr; }
}

.tactical-card {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.tactical-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-2);
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.title-wrap h3 {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.count-tag {
  font-size: 11px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: 1px 6px;
  border-radius: var(--radius-full);
  color: var(--color-text-muted);
  font-weight: 700;
}

.empty-mini {
  padding: var(--space-4) 0;
  text-align: center;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.debtor-chaser-list,
.critical-stock-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.debtor-row,
.stock-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg);
  border-radius: var(--radius-sm);
}

.debtor-info, .stock-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.debtor-name, .stock-name {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-text);
}

.debtor-sub, .stock-threshold {
  font-size: 10px;
}

.debtor-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.debtor-amt {
  font-size: var(--text-xs);
  font-weight: 800;
}

.whatsapp-reminder-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: color-mix(in srgb, var(--color-ledger-green) 12%, transparent);
  border: 1px solid var(--color-ledger-green);
  color: var(--color-ledger-green);
  padding: 2px 7px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 800;
  text-decoration: none;
}
.whatsapp-reminder-btn:hover {
  background: var(--color-ledger-green);
  color: #FFFFFF;
}

.stock-badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

.stock-badge--low {
  background: color-mix(in srgb, var(--color-gold) 15%, transparent);
  color: var(--color-gold-hover);
}

.stock-badge--zero {
  background: color-mix(in srgb, var(--color-market-clay) 15%, transparent);
  color: var(--color-market-clay);
}

.text-link {
  color: var(--brand-primary);
  text-decoration: none;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

/* Activity Section */
.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.section-title { font-size: var(--text-base); font-weight: 700; }

.activity-list,
.activity-skeleton-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.skeleton-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
}

.skeleton-col { display: flex; flex-direction: column; gap: 4px; }
.skeleton-col--right { align-items: flex-end; }

.text-teal { color: var(--color-ledger-green); }
.text-clay { color: var(--color-market-clay); }
.text-gold { color: var(--color-gold-hover); }
.text-info { color: var(--color-info); }
</style>