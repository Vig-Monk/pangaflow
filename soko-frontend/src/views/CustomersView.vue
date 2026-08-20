<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/CustomersView.vue
// Customers directory with Settle Debt shortcuts, Customer Deletion & Smart POS.
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
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import SettleDebtModal from '@/components/ledger/SettleDebtModal.vue';
import SmartSaleModal from '@/components/ledger/SmartSaleModal.vue';
import {
  UserPlus,
  Trash2,
  DollarSign,
  Plus,
} from 'lucide-vue-next';

const router = useRouter();
const customersStore = useCustomersStore();
const orgStore = useOrgStore();
const { push: pushToast } = useToast();

const isSearchMode = ref(false);

// Modals
const showAddModal = ref(false);
const newName = ref('');
const newPhone = ref('');
const newEmail = ref('');
const isSaving = ref(false);

// Deletion State
const customerToDelete = ref<Customer | null>(null);
const showConfirmDelete = ref(false);
const isDeleting = ref(false);

// Settle Debt / Smart Sale Modals
const selectedCustomerForDebt = ref<Customer | null>(null);
const showSettleModal = ref(false);
const showSmartSaleModal = ref(false);

onMounted(() => {
  customersStore.fetchList({ page: 1 });
});

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  return `KES ${num.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

const columns: DataTableColumn<Customer>[] = [
  { key: 'name', label: 'Customer Name' },
  { key: 'phone', label: 'Phone Contact', render: (row) => row.phone ?? '—' },
  {
    key: 'current_balance',
    label: 'Credit Debt Status',
    align: 'right',
  },
  {
    key: 'created_at',
    label: 'Last Recorded',
    render: (row) => new Date(row.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }),
  },
  {
    key: 'actions',
    label: 'Actions',
    align: 'right',
  },
];

function handleRowClick(row: Customer): void {
  router.push({ name: 'customer-detail', params: { id: row.id } });
}

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

    pushToast({ message: `Customer "${result.name}" created`, variant: 'success' });
    showAddModal.value = false;
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to add customer', variant: 'error' });
  } finally {
    isSaving.value = false;
  }
}

function openSettleModal(cust: Customer): void {
  selectedCustomerForDebt.value = cust;
  showSettleModal.value = true;
}

function confirmDeleteCustomer(cust: Customer): void {
  customerToDelete.value = cust;
  showConfirmDelete.value = true;
}

async function executeDeleteCustomer(): Promise<void> {
  if (!customerToDelete.value) return;
  isDeleting.value = true;

  try {
    await customersStore.remove(customerToDelete.value.id);
    pushToast({ message: `Deleted customer "${customerToDelete.value.name}"`, variant: 'success' });
    showConfirmDelete.value = false;
    customerToDelete.value = null;
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to delete customer', variant: 'error' });
  } finally {
    isDeleting.value = false;
  }
}

function handleDebtSettled(): void {
  customersStore.fetchList({ page: customersStore.page });
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">Customers Directory</h1>
        <p class="page-subtitle">Manage customer directory, track credit debt, and record fast payments.</p>
      </div>

      <div class="page-header__actions">
        <SearchBar placeholder="Search by name or phone..." @search="handleSearch" />
        <Button variant="secondary" @click="showSmartSaleModal = true">
          <Plus :size="16" /> Record Sale &amp; POS
        </Button>
        <Button variant="primary" @click="openAddModal">
          <UserPlus :size="16" /> Add Customer
        </Button>
      </div>
    </div>

    <!-- Customers Data Table -->
    <DataTable
      :columns="columns"
      :rows="displayedRows"
      :loading="customersStore.isLoading"
      :row-key="(row) => row.id"
      :on-row-click="handleRowClick"
      empty-title="No customers yet"
      empty-description="Add your first customer to start tracking sales and credit balances."
    >
      <!-- Debt Status Badge Cell -->
      <template #cell-current_balance="{ row }">
        <div class="balance-cell-wrapper">
          <span
            v-if="parseFloat((row as Customer).current_balance) > 0"
            class="balance-badge balance-badge--owed tabular-figure"
          >
            Owes {{ formatCurrency((row as Customer).current_balance) }}
          </span>
          <span
            v-else
            class="balance-badge balance-badge--cleared"
          >
            Cleared / Paid
          </span>
        </div>
      </template>

      <!-- Row Actions Cell -->
      <template #cell-actions="{ row }">
        <div class="table-actions-row">
          <!-- 1-Click Settle Debt Shortcut if customer owes balance -->
          <button
            v-if="parseFloat((row as Customer).current_balance) > 0"
            type="button"
            class="settle-btn-shortcut"
            title="Settle Debt (Lipa Deni)"
            @click.stop="openSettleModal(row as Customer)"
          >
            <DollarSign :size="13" /> Settle
          </button>

          <!-- Delete Customer Button -->
          <button
            type="button"
            class="delete-icon-btn"
            title="Delete Customer"
            @click.stop="confirmDeleteCustomer(row as Customer)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </template>
    </DataTable>

    <div class="pagination-wrap" v-if="!isSearchMode && customersStore.list.length > 0">
      <Pagination
        :page="customersStore.page"
        :total-pages="Math.max(1, Math.ceil(customersStore.total / 20))"
        :on-change="(p) => customersStore.fetchList({ page: p })"
      />
    </div>

    <!-- Add Customer Modal -->
    <Modal :open="showAddModal" title="Add New Customer" @close="showAddModal = false">
      <div class="modal-form">
        <div class="form-group">
          <label class="form-label">Full Name *</label>
          <input v-model="newName" type="text" placeholder="e.g. Grace Njeri" class="form-input" autofocus />
        </div>
        <div class="form-group">
          <label class="form-label">Phone Number (Optional)</label>
          <input v-model="newPhone" type="tel" placeholder="07XXXXXXXX" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">Email (Optional)</label>
          <input v-model="newEmail" type="email" placeholder="name@email.com" class="form-input" />
        </div>
      </div>
      <template #footer>
        <Button variant="ghost" @click="showAddModal = false">Cancel</Button>
        <Button variant="primary" :loading="isSaving" @click="submitAdd">Save Customer</Button>
      </template>
    </Modal>

    <!-- Delete Customer Confirmation Dialog -->
    <ConfirmDialog
      :open="showConfirmDelete"
      title="Delete Customer"
      :message="`Are you sure you want to delete customer '${customerToDelete?.name}'? If they have past transaction records, their history will be archived safely.`"
      confirm-label="Delete Customer"
      danger
      @confirm="executeDeleteCustomer"
      @cancel="showConfirmDelete = false"
    />

    <!-- Settle Debt Modal -->
    <SettleDebtModal
      :open="showSettleModal"
      :customer="selectedCustomerForDebt"
      @close="showSettleModal = false"
      @success="handleDebtSettled"
    />

    <!-- Smart POS Modal -->
    <SmartSaleModal
      :open="showSmartSaleModal"
      @close="showSmartSaleModal = false"
      @success="() => customersStore.fetchList({ page: 1 })"
    />

    <UpgradeModal
      :open="orgStore.upgradeModalOpen"
      :details="orgStore.upgradeContext"
      @close="orgStore.closeUpgradeModal"
    />
  </div>
</template>

<style scoped>
.page-container {
  max-width: 1080px;
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
  gap: var(--space-2);
  align-items: center;
  flex-wrap: wrap;
}

.balance-cell-wrapper {
  display: flex;
  justify-content: flex-end;
}

.balance-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px var(--space-3);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 800;
}

.balance-badge--owed {
  background: color-mix(in srgb, var(--color-market-clay) 12%, transparent);
  color: var(--color-market-clay);
  border: 1px solid color-mix(in srgb, var(--color-market-clay) 25%, transparent);
}

.balance-badge--cleared {
  background: color-mix(in srgb, var(--color-ledger-green) 12%, transparent);
  color: var(--color-ledger-green);
}

.table-actions-row {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}

.settle-btn-shortcut {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: color-mix(in srgb, var(--color-ledger-green) 10%, transparent);
  border: 1px solid var(--color-ledger-green);
  color: var(--color-ledger-green);
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
}
.settle-btn-shortcut:hover {
  background: var(--color-ledger-green);
  color: #FFFFFF;
}

.delete-icon-btn {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
}
.delete-icon-btn:hover {
  background: var(--color-market-clay);
  border-color: var(--color-market-clay);
  color: #FFFFFF;
}

.modal-form { display: flex; flex-direction: column; gap: var(--space-3); }
.form-group { display: flex; flex-direction: column; gap: 2px; }
.form-label { font-size: var(--text-xs); font-weight: 700; color: var(--color-text); }
.form-input {
  min-height: 42px; padding: 0 var(--space-3);
  background: var(--color-bg); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); font-size: var(--text-sm); color: var(--color-text); outline: none;
}
.form-input:focus { border-color: var(--color-ink); }

.pagination-wrap {
  margin-top: var(--space-6);
}
</style>