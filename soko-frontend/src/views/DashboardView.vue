<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/DashboardView.vue
// =============================================================================

import { computed, onMounted, ref } from 'vue';
import { useDashboardStore } from '@/stores/dashboard';
import { useLedgerStore } from '@/stores/ledger';
import { usePaymentsStore } from '@/stores/payments';
import { useCustomersStore } from '@/stores/customers';
import { useStoreSettingsStore } from '@/stores/store';
import { useProductsStore } from '@/stores/products';
import { useToast } from '@/composables/useToast';
import { apiGet } from '@/services/apiClient';
import StatCard from '@/components/ledger/StatCard.vue';
import LedgerRow from '@/components/ledger/LedgerRow.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import CurrencyInput from '@/components/ui/CurrencyInput.vue';
import PhoneInput from '@/components/ui/PhoneInput.vue';
import { Store, Inbox, AlertTriangle, Plus, CreditCard } from 'lucide-vue-next';

const dashboardStore = useDashboardStore();
const ledgerStore = useLedgerStore();
const paymentsStore = usePaymentsStore();
const customersStore = useCustomersStore();
const storeSettingsStore = useStoreSettingsStore();
const productsStore = useProductsStore();
const { push: pushToast } = useToast();

const ordersSummary = ref({ today_count: 0, today_revenue: '0', pending_count: 0 });
const lowStockCount = ref(0);

onMounted(async () => {
  dashboardStore.fetchFull();
  customersStore.fetchList({ limit: 100 });
  storeSettingsStore.fetchSettings();

  try {
    const [ordersRes] = await Promise.all([
      apiGet<any>('/orders/summary'),
      productsStore.fetchInventory({ low_stock: true, limit: 1 })
    ]);
    ordersSummary.value = ordersRes;
    lowStockCount.value = productsStore.inventoryTotal;
  } catch {
    // Non-blocking fallback
  }
});

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  return `KES ${num.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const showSaleModal = ref(false);
const saleCustomerId = ref('');
const saleAmount = ref(0);
const saleDescription = ref('');
const isSavingSale = ref(false);

function openSaleModal(): void {
  saleCustomerId.value = '';
  saleAmount.value = 0;
  saleDescription.value = '';
  showSaleModal.value = true;
}

async function submitSale(): Promise<void> {
  if (!saleCustomerId.value || saleAmount.value <= 0) return;
  isSavingSale.value = true;
  try {
    await ledgerStore.recordSale(saleCustomerId.value, saleAmount.value, saleDescription.value || undefined);
    pushToast({ message: 'Sale recorded', variant: 'success' });
    showSaleModal.value = false;
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to record sale', variant: 'error' });
  } finally {
    isSavingSale.value = false;
  }
}

const showPaymentModal = ref(false);
const paymentCustomerId = ref('');
const paymentAmount = ref(0);
const paymentPhone = ref('');
const isSubmittingPayment = ref(false);

function openPaymentModal(): void {
  paymentCustomerId.value = '';
  paymentAmount.value = 0;
  paymentPhone.value = '';
  showPaymentModal.value = true;
}

async function submitPayment(): Promise<void> {
  if (!paymentCustomerId.value || paymentAmount.value <= 0 || !paymentPhone.value) return;
  isSubmittingPayment.value = true;
  try {
    const result = await paymentsStore.collectViaMpesa({
      customerId: paymentCustomerId.value,
      amount: paymentAmount.value,
      phone: paymentPhone.value,
    });
    pushToast({ message: result.customerMessage, variant: 'info' });
    showPaymentModal.value = false;
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to initiate payment', variant: 'error' });
  } finally {
    isSubmittingPayment.value = false;
  }
}

const summary = computed(() => dashboardStore.summary);
const storeStatus = computed(() => storeSettingsStore.settings?.status ?? 'draft');
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Overview of sales, inventory, and storefront performance.</p>
      </div>
      
      <!-- Operational Status Badges -->
      <div class="operational-badges-row">
        <router-link :to="{ name: 'store-settings' }" class="op-badge op-badge--store" :class="storeStatus">
          <Store :size="14" />
          <span>Store: <strong>{{ storeStatus.toUpperCase() }}</strong></span>
        </router-link>

        <router-link :to="{ name: 'merchant-orders' }" class="op-badge">
          <Inbox :size="14" />
          <span>Orders Today: <strong>{{ ordersSummary.today_count }}</strong></span>
        </router-link>

        <router-link :to="{ name: 'inventory' }" class="op-badge" :class="{ 'op-badge--warning': lowStockCount > 0 }">
          <AlertTriangle :size="14" />
          <span>Low Stock: <strong>{{ lowStockCount }}</strong></span>
        </router-link>
      </div>
    </div>

    <!-- Financial KPI Cards -->
    <div class="stat-row">
      <StatCard
        label="Revenue (this month)"
        :value="summary ? formatCurrency(summary.this_month.revenue) : ''"
        :loading="dashboardStore.loading"
      />
      <StatCard
        label="Expenses (this month)"
        :value="summary ? formatCurrency(summary.this_month.expenses) : ''"
        :loading="dashboardStore.loading"
        variant="negative"
      />
      <StatCard
        label="Outstanding Credit"
        :value="summary ? formatCurrency(summary.this_month.outstanding_balance) : ''"
        :loading="dashboardStore.loading"
      />
    </div>

    <!-- Recent Activity -->
    <section class="activity-section">
      <h2 class="section-title">Recent Activity</h2>

      <EmptyState
        v-if="!dashboardStore.loading && summary && summary.recent_transactions.length === 0"
        title="No activity yet"
        description="Record your first sale to see it here."
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

    <!-- Floating Action Buttons: positioned safely above mobile nav -->
    <div class="fab-stack">
      <Button variant="primary" size="md" @click="openSaleModal"><Plus :size="16" /> Record Sale</Button>
      <Button variant="secondary" size="md" @click="openPaymentModal"><CreditCard :size="16" /> Collect Payment</Button>
    </div>

    <!-- Modals -->
    <Modal :open="showSaleModal" title="Record Sale" @close="showSaleModal = false">
      <div class="modal-form">
        <select v-model="saleCustomerId" class="modal-form__select">
          <option value="" disabled>Select customer</option>
          <option v-for="c in customersStore.list" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <CurrencyInput v-model="saleAmount" />
        <input v-model="saleDescription" type="text" placeholder="Description (optional)" class="modal-form__input" />
      </div>
      <template #footer>
        <Button variant="ghost" @click="showSaleModal = false">Cancel</Button>
        <Button variant="primary" :loading="isSavingSale" @click="submitSale">Save</Button>
      </template>
    </Modal>

    <Modal :open="showPaymentModal" title="Collect Payment via M-Pesa" @close="showPaymentModal = false">
      <div class="modal-form">
        <select v-model="paymentCustomerId" class="modal-form__select">
          <option value="" disabled>Select customer</option>
          <option v-for="c in customersStore.list" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <CurrencyInput v-model="paymentAmount" />
        <PhoneInput v-model="paymentPhone" />
      </div>
      <template #footer>
        <Button variant="ghost" @click="showPaymentModal = false">Cancel</Button>
        <Button variant="primary" :loading="isSubmittingPayment" @click="submitPayment">Send STK Push</Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.page-container {
  max-width: 1040px;
  width: 100%;
  margin: 0 auto;
  padding: var(--space-6);
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.page-title { font-size: var(--text-2xl); }
.page-subtitle { font-size: var(--text-sm); color: var(--color-text-muted); margin-top: 2px; }

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

.stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

@media (max-width: 768px) {
  .stat-row { grid-template-columns: 1fr; }
}

.section-title {
  font-size: var(--text-lg);
  margin-bottom: var(--space-3);
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Responsive FAB placement: safely positioned above mobile bar */
.fab-stack {
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  z-index: 70;
}

@media (max-width: 768px) {
  .fab-stack {
    bottom: calc(64px + var(--space-4) + env(safe-area-inset-bottom, 0px));
    right: var(--space-4);
  }
}

.modal-form { display: flex; flex-direction: column; gap: var(--space-4); }
.modal-form__select,
.modal-form__input {
  min-height: 44px;
  padding: 0 var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: var(--text-base);
  color: var(--color-text);
}
</style>