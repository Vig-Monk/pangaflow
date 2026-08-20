<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/ProductsView.vue
// Products list with Select All, multi-select checkboxes, and bulk deletion.
// =================================================================================

import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useProductsStore, type Product } from '@/stores/products';
import { useToast } from '@/composables/useToast';
import SearchBar from '@/components/ui/SearchBar.vue';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable.vue';
import Button from '@/components/ui/Button.vue';
import Pagination from '@/components/ui/Pagination.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import {
  Plus,
  Edit2,
  Archive,
  ArchiveRestore,
  Trash2,
  CheckSquare,
  Square,
  CheckCircle2,
  FileText,
} from 'lucide-vue-next';

const router = useRouter();
const productsStore = useProductsStore();
const { push: pushToast } = useToast();

const searchQuery = ref('');

// Single Delete State
const showConfirmDelete = ref(false);
const productToDelete = ref<Product | null>(null);
const isDeleting = ref(false);

// Multi-Select Bulk Delete State
const selectedProductIds = ref<string[]>([]);
const showBulkConfirmDelete = ref(false);
const isBulkDeleting = ref(false);

onMounted(() => {
  productsStore.fetchList({ page: 1 });
});

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  return `KES ${num.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

const columns: DataTableColumn<Product>[] = [
  { key: 'select', label: '' },
  { key: 'name', label: 'Product Name' },
  { key: 'category_name', label: 'Category', render: (row) => row.category_name || 'General' },
  { key: 'sku', label: 'SKU', render: (row) => row.sku ?? '—' },
  {
    key: 'price',
    label: 'Selling Price',
    align: 'right',
    render: (row) => formatCurrency(row.price),
    cellClass: () => 'tabular-figure font-semibold'
  },
  {
    key: 'status',
    label: 'Visibility',
  },
  {
    key: 'actions',
    label: 'Actions',
    align: 'right'
  }
];

const isAllSelected = computed(() => {
  return (
    productsStore.list.length > 0 &&
    selectedProductIds.value.length === productsStore.list.length
  );
});

function toggleSelectAll(): void {
  if (isAllSelected.value) {
    selectedProductIds.value = [];
  } else {
    selectedProductIds.value = productsStore.list.map((p) => p.id);
  }
}

function toggleSelectRow(productId: string): void {
  const idx = selectedProductIds.value.indexOf(productId);
  if (idx >= 0) {
    selectedProductIds.value.splice(idx, 1);
  } else {
    selectedProductIds.value.push(productId);
  }
}

function handleSearch(query: string): void {
  searchQuery.value = query;
  selectedProductIds.value = [];
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

async function executeBulkDelete(): Promise<void> {
  if (selectedProductIds.value.length === 0) return;
  isBulkDeleting.value = true;
  try {
    await productsStore.deleteBulk(selectedProductIds.value);
    pushToast({ message: `Deleted ${selectedProductIds.value.length} selected products`, variant: 'success' });
    selectedProductIds.value = [];
    showBulkConfirmDelete.value = false;
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to delete selected products', variant: 'error' });
  } finally {
    isBulkDeleting.value = false;
  }
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">Products Catalog</h1>
        <p class="page-subtitle">Manage store products, visibility on storefront, and batch deletions.</p>
      </div>

      <div class="page-header__actions">
        <SearchBar placeholder="Search products..." @search="handleSearch" />
        <Button variant="primary" @click="handleAddProductsClick">
          <Plus :size="16" /> Add Products
        </Button>
      </div>
    </div>

    <!-- Floating Bulk Selection Bar -->
    <div v-if="selectedProductIds.length > 0" class="bulk-selected-bar card">
      <div class="bulk-left">
        <CheckSquare :size="16" class="text-teal" />
        <span><strong>{{ selectedProductIds.length }}</strong> products selected</span>
      </div>

      <div class="bulk-actions">
        <Button variant="danger" size="sm" @click="showBulkConfirmDelete = true">
          <Trash2 :size="14" /> Delete Selected ({{ selectedProductIds.length }})
        </Button>
        <button type="button" class="deselect-btn" @click="selectedProductIds = []">
          Deselect All
        </button>
      </div>
    </div>

    <!-- Products Table -->
    <DataTable
      :columns="columns"
      :rows="productsStore.list"
      :loading="productsStore.isLoading"
      :row-key="(row) => row.id"
      empty-title="No products yet"
      empty-description="Create products to publish on your online storefront catalog."
    >
      <!-- Select Checkbox Header -->
      <template #header-select>
        <button type="button" class="checkbox-btn" @click="toggleSelectAll">
          <component :is="isAllSelected ? CheckSquare : Square" :size="16" />
        </button>
      </template>

      <!-- Select Checkbox Cell -->
      <template #cell-select="{ row }">
        <button
          type="button"
          class="checkbox-btn"
          @click.stop="toggleSelectRow((row as Product).id)"
        >
          <component
            :is="selectedProductIds.includes((row as Product).id) ? CheckSquare : Square"
            :size="16"
            :class="{ 'text-teal': selectedProductIds.includes((row as Product).id) }"
          />
        </button>
      </template>

      <!-- Visibility Badge Cell -->
      <template #cell-status="{ row }">
        <span
          class="status-badge"
          :class="`status-badge--${(row as Product).status}`"
        >
          <component
            :is="(row as Product).status === 'published' ? CheckCircle2 : (row as Product).status === 'draft' ? FileText : Archive"
            :size="11"
          />
          {{ (row as Product).status.toUpperCase() }}
        </span>
      </template>

      <!-- Action Buttons Cell -->
      <template #cell-actions="{ row }">
        <div class="table-actions">
          <button
            class="action-icon-btn"
            title="Edit product"
            type="button"
            @click.stop="handleEdit(row as Product)"
          >
            <Edit2 :size="14" />
          </button>

          <button
            v-if="(row as Product).status !== 'archived'"
            class="action-icon-btn"
            title="Archive product"
            type="button"
            @click.stop="handleArchive(row as Product)"
          >
            <Archive :size="14" />
          </button>
          <button
            v-else
            class="action-icon-btn action-icon-btn--restore"
            title="Unarchive product"
            type="button"
            @click.stop="handleUnarchive(row as Product)"
          >
            <ArchiveRestore :size="14" />
          </button>

          <button
            class="action-icon-btn action-icon-btn--danger"
            title="Delete product permanently"
            type="button"
            @click.stop="confirmDelete(row as Product)"
          >
            <Trash2 :size="14" />
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

    <!-- Single Delete Confirmation Dialog -->
    <ConfirmDialog
      :open="showConfirmDelete"
      title="Delete Product"
      :message="`Are you sure you want to permanently delete '${productToDelete?.name}'? This action cannot be undone.`"
      confirm-label="Delete Product"
      danger
      @confirm="executePermanentDelete"
      @cancel="showConfirmDelete = false"
    />

    <!-- Bulk Delete Confirmation Dialog -->
    <ConfirmDialog
      :open="showBulkConfirmDelete"
      title="Delete Selected Products"
      :message="`Are you sure you want to permanently delete all ${selectedProductIds.length} selected products? This will remove them from your catalog and inventory.`"
      confirm-label="Delete Selected"
      danger
      @confirm="executeBulkDelete"
      @cancel="showBulkConfirmDelete = false"
    />
  </div>
</template>

<style scoped>
.page-container {
  max-width: 1080px;
  width: 100%;
  margin: 0 auto;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
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

.page-header__actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  flex-wrap: wrap;
}

/* Bulk Selection Bar */
.bulk-selected-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: color-mix(in srgb, var(--color-ink) 6%, var(--color-surface));
  border: 1px solid var(--color-ink);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  animation: slideDown var(--duration-fast) var(--ease-standard);
}

.bulk-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
}

.bulk-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.deselect-btn {
  background: transparent;
  border: none;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  cursor: pointer;
  text-decoration: underline;
}

.checkbox-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--color-text-muted);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 800;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}

.status-badge--published {
  background: color-mix(in srgb, var(--color-ledger-green) 12%, transparent);
  color: var(--color-ledger-green);
}

.status-badge--draft {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

.status-badge--archived {
  background: color-mix(in srgb, var(--color-market-clay) 12%, transparent);
  color: var(--color-market-clay);
}

.table-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-1);
}

.action-icon-btn {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
}
.action-icon-btn:hover {
  background: var(--color-surface);
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
  background: color-mix(in srgb, var(--color-market-clay) 10%, transparent);
}

.pagination-wrap {
  margin-top: var(--space-4);
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

.text-teal { color: var(--color-ledger-green); }
</style>