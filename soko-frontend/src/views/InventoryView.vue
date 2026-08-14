<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/InventoryView.vue (PROMPT 16)
// Clean visual hierarchy for inventory stock audits.
// =============================================================================

import { onMounted, ref } from 'vue';
import { useProductsStore, type InventoryItem } from '@/stores/products';
import { useToast } from '@/composables/useToast';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable.vue';
import Button from '@/components/ui/Button.vue';
import Modal from '@/components/ui/Modal.vue';
import Pagination from '@/components/ui/Pagination.vue';
import { PackageCheck } from 'lucide-vue-next';

const productsStore = useProductsStore();
const { push: pushToast } = useToast();

const lowStockFilter = ref(false);

const showAdjustModal = ref(false);
const activeProduct = ref<InventoryItem | null>(null);
const adjustmentStock = ref(0);
const isSaving = ref(false);

onMounted(() => {
  fetchInventoryData(1);
});

async function fetchInventoryData(page: number): Promise<void> {
  await productsStore.fetchInventory({
    page,
    low_stock: lowStockFilter.value || undefined
  });
}

const columns: DataTableColumn<InventoryItem>[] = [
  { key: 'product_name', label: 'Product Name' },
  { key: 'product_sku', label: 'SKU', render: (row) => row.product_sku ?? '—' },
  {
    key: 'stock',
    label: 'Stock Quantity',
    align: 'right',
    cellClass: (row) => row.stock <= row.low_stock_at ? 'low-stock-cell tabular-figure' : 'tabular-figure'
  },
  {
    key: 'low_stock_at',
    label: 'Alert Threshold',
    align: 'right',
    render: (row) => `${row.low_stock_at} units`,
    cellClass: () => 'tabular-figure'
  }
];

function handleRowClick(row: InventoryItem): void {
  activeProduct.value = row;
  adjustmentStock.value = row.stock;
  showAdjustModal.value = true;
}

async function saveAdjustment(): Promise<void> {
  if (!activeProduct.value) return;
  isSaving.value = true;
  try {
    await productsStore.updateStock(activeProduct.value.product_id, adjustmentStock.value);
    pushToast({ message: 'Stock quantity updated successfully', variant: 'success' });
    showAdjustModal.value = false;
    fetchInventoryData(productsStore.inventoryPage);
  } catch {
    pushToast({ message: 'Failed to adjust stock', variant: 'error' });
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="inventory-page">
    <header class="page-header">
      <div>
        <h1 class="page-title">Inventory</h1>
        <p class="page-subtitle">Monitor stock levels and manage replenishment alerts.</p>
      </div>
      <div class="filter-controls">
        <label class="low-stock-toggle">
          <input type="checkbox" v-model="lowStockFilter" @change="fetchInventoryData(1)" />
          Low stock alert only
        </label>
      </div>
    </header>

    <div class="table-container-clean">
      <DataTable
        :columns="columns"
        :rows="productsStore.inventoryList"
        :loading="productsStore.isLoading"
        :row-key="(row) => row.id"
        :on-row-click="handleRowClick"
        empty-title="No inventory records found"
      />
    </div>

    <Pagination
      v-if="productsStore.inventoryList.length > 0"
      :page="productsStore.inventoryPage"
      :total-pages="Math.max(1, Math.ceil(productsStore.inventoryTotal / 20))"
      :on-change="(p) => fetchInventoryData(p)"
    />

    <Modal :open="showAdjustModal" title="Update Stock Quantity" @close="showAdjustModal = false">
      <div v-if="activeProduct" class="stock-adjust-form">
        <p class="adjust-label">Product: <strong>{{ activeProduct.product_name }}</strong></p>
        <div class="input-group">
          <label class="form-label">Current Stock Count</label>
          <input type="number" min="0" v-model.number="adjustmentStock" class="adjust-input" />
        </div>
      </div>
      <template #footer>
        <Button variant="ghost" @click="showAdjustModal = false">Cancel</Button>
        <Button variant="primary" :loading="isSaving" @click="saveAdjustment">Save</Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.inventory-page {
  padding: var(--space-6);
  max-width: 960px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.page-title { font-size: var(--text-2xl); }
.page-subtitle { font-size: var(--text-sm); color: var(--color-text-muted); margin-top: 2px; }

.filter-controls { display: flex; align-items: center; gap: var(--space-4); }

.low-stock-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.table-container-clean {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: var(--space-6);
}

.stock-adjust-form { display: flex; flex-direction: column; gap: var(--space-4); }
.adjust-label { font-size: var(--text-sm); color: var(--color-text); }
.form-label { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-muted); margin-bottom: var(--space-1); display: block; }
.adjust-input {
  width: 100%; min-height: 44px; padding: 0 var(--space-4);
  background: var(--color-bg); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); font-size: var(--text-base); color: var(--color-text); outline: none;
}

:deep(.low-stock-cell) { color: var(--color-market-clay); font-weight: 600; }
</style>