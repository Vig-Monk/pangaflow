<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/storefront/OrdersView.vue
// Merchant order queue with fulfillment status segment tabs & COD reconciliation.
// =============================================================================

import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { apiGet, apiGetPaginated } from '@/services/apiClient';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable.vue';
import Pagination from '@/components/ui/Pagination.vue';
import {
  Bike,
  Store,
  DollarSign,
  AlertCircle,
  Clock,
  CheckCircle2,
  Send,
  Ban,
  Package,
} from 'lucide-vue-next';

type OrderStatus = 'all' | 'pending' | 'confirmed' | 'assigned' | 'out_for_delivery' | 'delivered' | 'cancelled';

interface OrderRow {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_location: string;
  delivery_type: 'delivery' | 'pickup';
  status: 'pending' | 'confirmed' | 'assigned' | 'out_for_delivery' | 'delivered' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'failed';
  payment_method: string;
  total: string;
  amount_collected: string | null;
  created_at: string;
}

interface ReconciliationSummary {
  total_cod_orders: number;
  delivered_cod_orders: number;
  expected_total: string;
  collected_total: string;
  variance: string;
  unreconciled_count: number;
}

const router = useRouter();

const orders = ref<OrderRow[]>([]);
const totalItems = ref(0);
const pageNum = ref(1);
const loading = ref(true);
const selectedStatusTab = ref<OrderStatus>('all');

const reconciliation = ref<ReconciliationSummary | null>(null);

onMounted(() => {
  fetchOrders(1);
  fetchReconciliation();
});

async function fetchOrders(page: number): Promise<void> {
  loading.value = true;
  try {
    const { data, meta } = await apiGetPaginated<OrderRow[]>('/orders', { page, limit: 30 });
    orders.value = data;
    pageNum.value = meta.page;
    totalItems.value = meta.totalItems;
  } catch {
    orders.value = [];
  } finally {
    loading.value = false;
  }
}

async function fetchReconciliation(): Promise<void> {
  try {
    reconciliation.value = await apiGet<ReconciliationSummary>('/orders/reconciliation/cod');
  } catch {
    reconciliation.value = null;
  }
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `KES ${num.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

// Real-time status counts across the loaded orders batch
const statusCounts = computed(() => {
  const counts: Record<OrderStatus, number> = {
    all: orders.value.length,
    pending: 0,
    confirmed: 0,
    assigned: 0,
    out_for_delivery: 0,
    delivered: 0,
    cancelled: 0,
  };

  for (const o of orders.value) {
    if (counts[o.status] !== undefined) {
      counts[o.status]++;
    }
  }

  return counts;
});

const filteredOrders = computed(() => {
  if (selectedStatusTab.value === 'all') {
    return orders.value;
  }
  return orders.value.filter((o) => o.status === selectedStatusTab.value);
});

const columns: DataTableColumn<OrderRow>[] = [
  { key: 'customer_name', label: 'Customer' },
  { key: 'customer_phone', label: 'Phone' },
  {
    key: 'delivery_type',
    label: 'Fulfillment',
    render: (row) => (row.delivery_type === 'delivery' ? 'Delivery' : 'Pickup'),
  },
  { key: 'delivery_location', label: 'Destination' },
  {
    key: 'total',
    label: 'Total Amount',
    align: 'right',
    render: (row) => formatCurrency(row.total),
    cellClass: () => 'tabular-figure font-semibold',
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => row.status.toUpperCase(),
  },
  {
    key: 'payment_status',
    label: 'Payment',
    render: (row) => row.payment_status.toUpperCase(),
  },
  { key: 'created_at', label: 'Date', render: (row) => formatDate(row.created_at) },
];

function handleRowClick(row: OrderRow): void {
  router.push({ name: 'merchant-order-detail', params: { id: row.id } });
}
</script>

<template>
  <div class="page-container">
    <header class="page-header">
      <div>
        <h1 class="page-title">Storefront Orders</h1>
        <p class="page-subtitle">Monitor incoming customer orders, rider dispatches, and cash handovers.</p>
      </div>
    </header>

    <!-- Cash on Delivery (COD) End-of-Day Reconciliation Summary -->
    <div v-if="reconciliation && reconciliation.total_cod_orders > 0" class="reconciliation-card card">
      <div class="reconcile-header">
        <div class="title-wrap">
          <DollarSign :size="18" class="text-teal" />
          <span class="reconcile-title">Cash on Delivery (COD) Reconciliation</span>
        </div>
        <span class="reconcile-badge">
          {{ reconciliation.delivered_cod_orders }} / {{ reconciliation.total_cod_orders }} Delivered
        </span>
      </div>

      <div class="reconcile-grid">
        <div class="reconcile-stat">
          <span class="stat-label">Expected COD Total</span>
          <span class="stat-value tabular-figure">{{ formatCurrency(reconciliation.expected_total) }}</span>
        </div>

        <div class="reconcile-stat">
          <span class="stat-label">Collected from Riders</span>
          <span class="stat-value tabular-figure text-teal">{{ formatCurrency(reconciliation.collected_total) }}</span>
        </div>

        <div class="reconcile-stat">
          <span class="stat-label">Pending / Variance</span>
          <span
            class="stat-value tabular-figure"
            :class="parseFloat(reconciliation.variance) > 0 ? 'text-clay' : 'text-teal'"
          >
            {{ formatCurrency(reconciliation.variance) }}
          </span>
        </div>
      </div>

      <div v-if="reconciliation.unreconciled_count > 0" class="reconcile-alert">
        <AlertCircle :size="14" />
        <span>{{ reconciliation.unreconciled_count }} delivered order(s) have unrecorded cash collections.</span>
      </div>
    </div>

    <!-- Fulfillment Status Segment Filter Tabs -->
    <div class="status-tabs-bar">
      <button
        type="button"
        class="status-tab"
        :class="{ 'status-tab--active': selectedStatusTab === 'all' }"
        @click="selectedStatusTab = 'all'"
      >
        <span>All</span>
        <span class="tab-pill">{{ statusCounts.all }}</span>
      </button>

      <button
        type="button"
        class="status-tab"
        :class="{ 'status-tab--active': selectedStatusTab === 'pending' }"
        @click="selectedStatusTab = 'pending'"
      >
        <Clock :size="13" />
        <span>Pending</span>
        <span class="tab-pill">{{ statusCounts.pending }}</span>
      </button>

      <button
        type="button"
        class="status-tab"
        :class="{ 'status-tab--active': selectedStatusTab === 'confirmed' }"
        @click="selectedStatusTab = 'confirmed'"
      >
        <Package :size="13" />
        <span>Confirmed</span>
        <span class="tab-pill">{{ statusCounts.confirmed }}</span>
      </button>

      <button
        type="button"
        class="status-tab"
        :class="{ 'status-tab--active': selectedStatusTab === 'assigned' }"
        @click="selectedStatusTab = 'assigned'"
      >
        <Bike :size="13" />
        <span>Assigned</span>
        <span class="tab-pill">{{ statusCounts.assigned }}</span>
      </button>

      <button
        type="button"
        class="status-tab"
        :class="{ 'status-tab--active': selectedStatusTab === 'out_for_delivery' }"
        @click="selectedStatusTab = 'out_for_delivery'"
      >
        <Send :size="13" />
        <span>Out for Delivery</span>
        <span class="tab-pill">{{ statusCounts.out_for_delivery }}</span>
      </button>

      <button
        type="button"
        class="status-tab"
        :class="{ 'status-tab--active': selectedStatusTab === 'delivered' }"
        @click="selectedStatusTab = 'delivered'"
      >
        <CheckCircle2 :size="13" />
        <span>Delivered</span>
        <span class="tab-pill">{{ statusCounts.delivered }}</span>
      </button>

      <button
        type="button"
        class="status-tab"
        :class="{ 'status-tab--active': selectedStatusTab === 'cancelled' }"
        @click="selectedStatusTab = 'cancelled'"
      >
        <Ban :size="13" />
        <span>Cancelled</span>
        <span class="tab-pill">{{ statusCounts.cancelled }}</span>
      </button>
    </div>

    <!-- Orders Data Table with Status Badges -->
    <DataTable
      :columns="columns"
      :rows="filteredOrders"
      :loading="loading"
      :row-key="(row) => row.id"
      :on-row-click="handleRowClick"
      empty-title="No orders found"
      empty-description="Orders placed on your storefront matching the selected filter will appear here."
    >
      <template #cell-delivery_type="{ row }">
        <span class="type-indicator-badge" :class="`type-indicator-badge--${(row as OrderRow).delivery_type}`">
          <component :is="(row as OrderRow).delivery_type === 'delivery' ? Bike : Store" :size="12" />
          {{ (row as OrderRow).delivery_type === 'delivery' ? 'Delivery' : 'Pickup' }}
        </span>
      </template>

      <template #cell-status="{ row }">
        <span class="order-status-badge" :class="`order-status-badge--${(row as OrderRow).status}`">
          {{ (row as OrderRow).status.toUpperCase() }}
        </span>
      </template>

      <template #cell-payment_status="{ row }">
        <span class="payment-badge" :class="`payment-badge--${(row as OrderRow).payment_status}`">
          {{ (row as OrderRow).payment_status.toUpperCase() }}
        </span>
      </template>
    </DataTable>

    <div class="pagination-wrap" v-if="orders.length > 0">
      <Pagination
        :page="pageNum"
        :total-pages="Math.max(1, Math.ceil(totalItems / 30))"
        :on-change="(p) => fetchOrders(p)"
      />
    </div>
  </div>
</template>

<style scoped>
.page-container {
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
  padding: var(--space-6);
}

.page-header {
  margin-bottom: var(--space-6);
}

.page-title {
  font-size: var(--text-2xl);
}

.page-subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-top: 2px;
}

/* Status Tabs Bar */
.status-tabs-bar {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  padding-bottom: var(--space-3);
  margin-bottom: var(--space-4);
}

.status-tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: 6px var(--space-3);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--duration-fast) var(--ease-standard);
}

.status-tab:hover {
  border-color: var(--color-ink);
  color: var(--color-text);
}

.status-tab--active {
  background: var(--color-ink);
  color: var(--color-text-inverse);
  border-color: var(--color-ink);
}

.tab-pill {
  font-size: 10px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: var(--color-bg);
  color: var(--color-text);
}

.status-tab--active .tab-pill {
  background: rgba(255, 255, 255, 0.2);
  color: #FFFFFF;
}

/* Badges */
.type-indicator-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
}

.type-indicator-badge--pickup {
  color: var(--color-ledger-green);
}

.order-status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 800;
}

.order-status-badge--pending {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}
.order-status-badge--confirmed {
  background: color-mix(in srgb, var(--color-ink) 12%, transparent);
  color: var(--color-ink);
}
.order-status-badge--assigned {
  background: color-mix(in srgb, var(--color-info) 15%, transparent);
  color: var(--color-info);
}
.order-status-badge--out_for_delivery {
  background: color-mix(in srgb, var(--color-gold) 15%, transparent);
  color: var(--color-gold-hover);
}
.order-status-badge--delivered {
  background: color-mix(in srgb, var(--color-ledger-green) 15%, transparent);
  color: var(--color-ledger-green);
}
.order-status-badge--cancelled {
  background: color-mix(in srgb, var(--color-market-clay) 15%, transparent);
  color: var(--color-market-clay);
}

.payment-badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}

.payment-badge--paid {
  color: var(--color-ledger-green);
  background: color-mix(in srgb, var(--color-ledger-green) 12%, transparent);
}
.payment-badge--failed {
  color: var(--color-market-clay);
  background: color-mix(in srgb, var(--color-market-clay) 12%, transparent);
}
.payment-badge--pending {
  color: var(--color-text-muted);
  background: var(--color-bg);
}

/* Reconciliation Card */
.reconciliation-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5);
  margin-bottom: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.reconcile-header {
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

.reconcile-title {
  font-size: var(--text-sm);
  font-weight: 700;
}

.reconcile-badge {
  font-size: 11px;
  font-weight: 700;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
}

.reconcile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-4);
}

.reconcile-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.stat-value {
  font-size: var(--text-lg);
  font-weight: 800;
}

.reconcile-alert {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-market-clay);
  background: color-mix(in srgb, var(--color-market-clay) 8%, transparent);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
}

.pagination-wrap {
  margin-top: var(--space-6);
}

.text-teal { color: var(--color-ledger-green); }
.text-clay { color: var(--color-market-clay); }
.font-semibold { font-weight: 600; }
</style>