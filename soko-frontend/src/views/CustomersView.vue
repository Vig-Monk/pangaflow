<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/CustomersView.vue
// =============================================================================

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useCustomersStore, type Customer } from '@/stores/customers';
import { useOrgStore } from '@/stores/org';
import { useToast } from '@/composables/useToast';
import SearchBar from '@/components/ui/SearchBar.vue';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable.vue';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import Pagination from '@/components/ui/Pagination.vue';
import UpgradeModal from '@/components/ledger/UpgradeModal.vue';
import { UserPlus } from 'lucide-vue-next';

const router = useRouter();
const customersStore = useCustomersStore();
const orgStore = useOrgStore();
const { push: pushToast } = useToast();

onMounted(() => {
  customersStore.fetchList({ page: 1 });
});

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  return `KES ${num.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

const columns: DataTableColumn<Customer>[] = [
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone', render: (row) => row.phone ?? '—' },
  {
    key: 'current_balance',
    label: 'Balance',
    align: 'right',
    render: (row) => formatCurrency(row.current_balance),
    cellClass: (row) =>
      parseFloat(row.current_balance) > 0 ? 'balance-owed tabular-figure' : 'balance-credit tabular-figure',
  },
  {
    key: 'created_at',
    label: 'Last Activity',
    render: (row) => new Date(row.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }),
  },
];

function handleRowClick(row: Customer): void {
  router.push({ name: 'customer-detail', params: { id: row.id } });
}

const isSearchMode = ref(false);

function handleSearch(query: string): void {
  if (query.length === 0) {
    isSearchMode.value = false;
    customersStore.fetchList({ page: 1 });
    return;
  }
  isSearchMode.value = true;
  customersStore.search(query);
}

const displayedRows = computed<Customer[]>(() =>
  isSearchMode.value ? customersStore.searchResults : customersStore.list
);

const showAddModal = ref(false);
const newName = ref('');
const newPhone = ref('');
const newEmail = ref('');
const isSaving = ref(false);

function openAddModal(): void {
  newName.value = '';
  newPhone.value = '';
  newEmail.value = '';
  showAddModal.value = true;
}

async function submitAdd(): Promise<void> {
  if (newName.value.trim().length === 0) return;

  isSaving.value = true;
  try {
    const result = await customersStore.create({
      name: newName.value.trim(),
      phone: newPhone.value.trim() || undefined,
      email: newEmail.value.trim() || undefined,
    });

    if (result === null) {
      showAddModal.value = false;
      if (customersStore.limitReached) {
        orgStore.requestUpgrade(customersStore.limitReached);
      }
      return;
    }

    pushToast({ message: 'Customer added successfully', variant: 'success' });
    showAddModal.value = false;
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to add customer', variant: 'error' });
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">Customers</h1>
        <p class="page-subtitle">Manage customer directory and credit balances.</p>
      </div>
      <div class="page-header__actions">
        <SearchBar placeholder="Search customers…" @search="handleSearch" />
        <Button variant="primary" @click="openAddModal"><UserPlus :size="18" /> Add Customer</Button>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="displayedRows"
      :loading="customersStore.isLoading"
      :row-key="(row) => row.id"
      :on-row-click="handleRowClick"
      empty-title="No customers yet"
      empty-description="Add your first customer to start tracking credit."
    />

    <div class="pagination-wrap" v-if="!isSearchMode && customersStore.list.length > 0">
      <Pagination
        :page="customersStore.page"
        :total-pages="Math.max(1, Math.ceil(customersStore.total / 20))"
        :on-change="(p) => customersStore.fetchList({ page: p })"
      />
    </div>

    <!-- Add Customer modal -->
    <Modal :open="showAddModal" title="Add Customer" @close="showAddModal = false">
      <div class="modal-form">
        <input v-model="newName" type="text" placeholder="Name" class="modal-form__input" />
        <input v-model="newPhone" type="tel" placeholder="Phone (optional)" class="modal-form__input" />
        <input v-model="newEmail" type="email" placeholder="Email (optional)" class="modal-form__input" />
      </div>
      <template #footer>
        <Button variant="ghost" @click="showAddModal = false">Cancel</Button>
        <Button variant="primary" :loading="isSaving" @click="submitAdd">Save</Button>
      </template>
    </Modal>

    <UpgradeModal
      :open="orgStore.upgradeModalOpen"
      :details="orgStore.upgradeContext"
      @close="orgStore.closeUpgradeModal"
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

.modal-form { display: flex; flex-direction: column; gap: var(--space-4); }
.modal-form__input {
  min-height: 44px; padding: 0 var(--space-4); background: var(--color-bg);
  border: 1px solid var(--color-border); border-radius: var(--radius-md); font-size: var(--text-base); color: var(--color-text);
}

:deep(.balance-owed) { color: var(--color-market-clay); font-weight: 600; }
:deep(.balance-credit) { color: var(--color-ledger-green); font-weight: 600; }

.pagination-wrap {
  margin-top: var(--space-6);
}
</style>