<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/storefront/OrdersView.vue
// =============================================================================

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { apiGetPaginated } from '@/services/apiClient';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable.vue';
import Pagination from '@/components/ui/Pagination.vue';

interface OrderRow {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_location: string;
  status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'failed';
  total: string;
  created_at: string;
}

const router = useRouter();

const orders = ref<OrderRow[]>([]);
const totalItems = ref(0);
const pageNum = ref(1);
const loading = ref(true);

onMounted(() => {
  fetchOrders(1);
});

async function fetchOrders(page: number): Promise<void> {
  loading.value = true;
  try {
    const { data, meta } = await apiGetPaginated<OrderRow[]>('/orders', { page, limit: 20 });
    orders.value = data;
    pageNum.value = meta.page;
    totalItems.value = meta.totalItems;
  } catch {
    orders.value = [];
  } finally {
    loading.value = false;
  }
}

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  return `KES ${num.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

const columns: DataTableColumn<OrderRow>[] = [
  { key: 'customer_name', label: 'Customer' },
  { key: 'customer_phone', label: 'Phone' },
  { key: 'delivery_location', label: 'Delivery Address' },
  {
    key: 'total',
    label: 'Total amount',
    align: 'right',
    render: (row) => formatCurrency(row.total),
    cellClass: () => 'tabular-figure'
  },
  { key: 'status', label: 'Status', render: (row) => row.status.toUpperCase() },
  { key: 'created_at', label: 'Date', render: (row) => formatDate(row.created_at) }
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
        <p class="page-subtitle">Monitor incoming customer orders and payment statuses.</p>
      </div>
    </header>

    <DataTable
      :columns="columns"
      :rows="orders"
      :loading="loading"
      :row-key="(row) => row.id"
      :on-row-click="handleRowClick"
      empty-title="No orders yet"
      empty-description="When customers checkout on your storefront, orders will appear here."
    />

    <div class="pagination-wrap" v-if="orders.length > 0">
      <Pagination
        :page="pageNum"
        :total-pages="Math.max(1, Math.ceil(totalItems / 20))"
        :on-change="(p) => fetchOrders(p)"
      />
    </div>
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

.pagination-wrap {
  margin-top: var(--space-6);
}
</style>