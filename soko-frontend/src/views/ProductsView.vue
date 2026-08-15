<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/ProductsView.vue
// =============================================================================

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useProductsStore, type Product } from '@/stores/products';
import { useToast } from '@/composables/useToast';
import SearchBar from '@/components/ui/SearchBar.vue';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable.vue';
import Button from '@/components/ui/Button.vue';
import Pagination from '@/components/ui/Pagination.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import { Plus, Edit2, Archive, ArchiveRestore, Trash2 } from 'lucide-vue-next';

const router = useRouter();
const productsStore = useProductsStore();
const { push: pushToast } = useToast();

const searchQuery = ref('');
const showConfirmDelete = ref(false);
const productToDelete = ref<Product | null>(null);
const isDeleting = ref(false);

onMounted(() => {
  productsStore.fetchList({ page: 1 });
});

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  return `KES ${num.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

const columns: DataTableColumn<Product>[] = [
  { key: 'name', label: 'Product' },
  { key: 'sku', label: 'SKU', render: (row) => row.sku ?? '—' },
  {
    key: 'price',
    label: 'Price',
    align: 'right',
    render: (row) => formatCurrency(row.price),
    cellClass: () => 'tabular-figure'
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => row.status.toUpperCase(),
  },
  {
    key: 'actions',
    label: 'Actions',
    align: 'right'
  }
];

function handleSearch(query: string): void {
  searchQuery.value = query;
  productsStore.fetchList({ page: 1, q: query });
}

function handleAddProductsClick(): void {
  router.push({ name: 'products-add' });
}

function handleEdit(product: Product): void {
  router.push({ name: 'product-edit', params: { id: product.id } });
}

async function handleArchive(product: Product): Promise<void> {
  try {
    await productsStore.archiveProduct(product.id);
    pushToast({ message: `Archived ${product.name}`, variant: 'success' });
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to archive product', variant: 'error' });
  }
}

async function handleUnarchive(product: Product): Promise<void> {
  try {
    await productsStore.unarchiveProduct(product.id);
    pushToast({ message: `Unarchived ${product.name}`, variant: 'success' });
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to unarchive product', variant: 'error' });
  }
}

function confirmDelete(product: Product): void {
  productToDelete.value = product;
  showConfirmDelete.value = true;
}

async function executePermanentDelete(): Promise<void> {
  if (!productToDelete.value) return;
  isDeleting.value = true;
  try {
    await productsStore.deleteProduct(productToDelete.value.id);
    pushToast({ message: `Deleted ${productToDelete.value.name}`, variant: 'success' });
    showConfirmDelete.value = false;
    productToDelete.value = null;
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to delete product', variant: 'error' });
  } finally {
    isDeleting.value = false;
  }
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">Products</h1>
        <p class="page-subtitle">Manage store catalog, pricing, and item publication.</p>
      </div>
      <div class="page-header__actions">
        <SearchBar placeholder="Search products…" @search="handleSearch" />
        <Button variant="primary" @click="handleAddProductsClick"><Plus :size="18" /> Add Products</Button>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="productsStore.list"
      :loading="productsStore.isLoading"
      :row-key="(row) => row.id"
      empty-title="No products yet"
      empty-description="Create some products to publish on your online storefront."
    >
      <template #cell-status="{ row }">
        <span class="status-badge" :class="`status-badge--${(row as Product).status}`">
          {{ (row as Product).status.toUpperCase() }}
        </span>
      </template>

      <template #cell-actions="{ row }">
        <div class="table-actions">
          <button
            class="action-icon-btn"
            title="Edit product"
            type="button"
            @click.stop="handleEdit(row as Product)"
          >
            <Edit2 :size="15" />
          </button>

          <button
            v-if="(row as Product).status !== 'archived'"
            class="action-icon-btn"
            title="Archive product"
            type="button"
            @click.stop="handleArchive(row as Product)"
          >
            <Archive :size="15" />
          </button>
          <button
            v-else
            class="action-icon-btn action-icon-btn--restore"
            title="Unarchive product"
            type="button"
            @click.stop="handleUnarchive(row as Product)"
          >
            <ArchiveRestore :size="15" />
          </button>

          <button
            class="action-icon-btn action-icon-btn--danger"
            title="Delete product permanently"
            type="button"
            @click.stop="confirmDelete(row as Product)"
          >
            <Trash2 :size="15" />
          </button>
        </div>
      </template>
    </DataTable>

    <div class="pagination-wrap" v-if="productsStore.list.length > 0">
      <Pagination
        :page="productsStore.page"
        :total-pages="Math.max(1, Math.ceil(productsStore.total / 20))"
        :on-change="(p) => productsStore.fetchList({ page: p, q: searchQuery })"
      />
    </div>

    <ConfirmDialog
      :open="showConfirmDelete"
      title="Delete Product Permanently"
      :message="`Are you sure you want to permanently delete '${productToDelete?.name}'? This action is irreversible.`"
      confirm-label="Delete Product"
      danger
      @confirm="executePermanentDelete"
      @cancel="showConfirmDelete = false"
    />
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

.page-header__actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  flex-wrap: wrap;
}

.status-badge {
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text-muted);
}
.status-badge--published {
  background: color-mix(in srgb, var(--color-ledger-green) 12%, transparent);
  color: var(--color-ledger-green);
}
.status-badge--archived {
  background: color-mix(in srgb, var(--color-market-clay) 12%, transparent);
  color: var(--color-market-clay);
}

.table-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}

.action-icon-btn {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-standard),
              color var(--duration-fast) var(--ease-standard),
              border-color var(--duration-fast) var(--ease-standard);
}
.action-icon-btn:hover {
  background: var(--color-bg);
  color: var(--color-text);
  border-color: var(--color-ink);
}
.action-icon-btn--restore:hover {
  color: var(--color-ledger-green);
  border-color: var(--color-ledger-green);
}
.action-icon-btn--danger:hover {
  color: var(--color-market-clay);
  border-color: var(--color-market-clay);
}

.pagination-wrap {
  margin-top: var(--space-6);
}
</style>