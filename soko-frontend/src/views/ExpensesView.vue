<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/ExpensesView.vue
// =============================================================================

import { onMounted, ref } from 'vue';
import { useExpensesStore, type Expense } from '@/stores/expenses';
import { useToast } from '@/composables/useToast';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable.vue';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import CurrencyInput from '@/components/ui/CurrencyInput.vue';
import Pagination from '@/components/ui/Pagination.vue';
import { Plus, Filter } from 'lucide-vue-next';

const expensesStore = useExpensesStore();
const { push: pushToast } = useToast();

onMounted(() => {
  expensesStore.fetchList({ page: 1 });
  expensesStore.fetchCategories();
});

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  return `KES ${num.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function categoryName(categoryId: string): string {
  return expensesStore.categories.find((c) => c.id === categoryId)?.name ?? 'Uncategorized';
}

const columns: DataTableColumn<Expense>[] = [
  { key: 'category_id', label: 'Category', render: (row) => categoryName(row.category_id) },
  { key: 'vendor', label: 'Vendor', render: (row) => row.vendor ?? '—' },
  {
    key: 'amount',
    label: 'Amount',
    align: 'right',
    render: (row) => formatCurrency(row.amount),
    cellClass: () => 'tabular-figure expense-amount',
  },
  {
    key: 'expense_date',
    label: 'Date',
    render: (row) => new Date(row.expense_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }),
  },
];

const filterCategoryId = ref('');
const filterStartDate = ref('');
const filterEndDate = ref('');

function applyFilters(): void {
  expensesStore.fetchList({
    page: 1,
    categoryId: filterCategoryId.value || undefined,
    startDate: filterStartDate.value || undefined,
    endDate: filterEndDate.value || undefined,
  });
}

const showAddModal = ref(false);
const newCategoryId = ref('');
const newAmount = ref(0);
const newVendor = ref('');
const newDescription = ref('');
const newExpenseDate = ref('');
const newIsRecurring = ref(false);
const newRecurrenceDay = ref<number | null>(null);
const isSaving = ref(false);

function openAddModal(): void {
  newCategoryId.value = '';
  newAmount.value = 0;
  newVendor.value = '';
  newDescription.value = '';
  newExpenseDate.value = '';
  newIsRecurring.value = false;
  newRecurrenceDay.value = null;
  showAddModal.value = true;
}

async function submitAdd(): Promise<void> {
  if (!newCategoryId.value || newAmount.value <= 0) return;

  isSaving.value = true;
  try {
    await expensesStore.create({
      categoryId: newCategoryId.value,
      amount: newAmount.value,
      vendor: newVendor.value.trim() || undefined,
      description: newDescription.value.trim() || undefined,
      expenseDate: newExpenseDate.value || undefined,
      isRecurring: newIsRecurring.value,
      recurrenceDay: newIsRecurring.value && newRecurrenceDay.value ? newRecurrenceDay.value : undefined,
    });
    pushToast({ message: 'Expense recorded successfully', variant: 'success' });
    showAddModal.value = false;
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to add expense', variant: 'error' });
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">Expenses</h1>
        <p class="page-subtitle">Track operational spending and business overhead.</p>
      </div>
      <Button variant="primary" @click="openAddModal"><Plus :size="18" /> Add Expense</Button>
    </div>

    <!-- Filter toolbar -->
    <div class="filter-bar">
      <div class="filter-field-group">
        <Filter :size="16" class="text-muted" />
        <select v-model="filterCategoryId" class="filter-bar__select" @change="applyFilters">
          <option value="">All categories</option>
          <option v-for="c in expensesStore.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <input v-model="filterStartDate" type="date" class="filter-bar__input" @change="applyFilters" />
      <input v-model="filterEndDate" type="date" class="filter-bar__input" @change="applyFilters" />
    </div>

    <DataTable
      :columns="columns"
      :rows="expensesStore.list"
      :loading="expensesStore.isLoading"
      :row-key="(row) => row.id"
      empty-title="No expenses recorded"
      empty-description="Add your first expense to start tracking spend."
    />

    <div class="pagination-wrap" v-if="expensesStore.list.length > 0">
      <Pagination
        :page="expensesStore.page"
        :total-pages="Math.max(1, Math.ceil(expensesStore.total / 20))"
        :on-change="(p) => expensesStore.fetchList({ page: p })"
      />
    </div>

    <!-- Add Expense modal -->
    <Modal :open="showAddModal" title="Add Expense" @close="showAddModal = false">
      <div class="modal-form">
        <select v-model="newCategoryId" class="modal-form__select">
          <option value="" disabled>
            {{ expensesStore.categories.length === 0 ? 'No categories yet' : 'Select category' }}
          </option>
          <option v-for="c in expensesStore.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>

        <CurrencyInput v-model="newAmount" />
        <input v-model="newVendor" type="text" placeholder="Vendor (optional)" class="modal-form__input" />
        <textarea v-model="newDescription" placeholder="Description (optional)" class="modal-form__textarea" rows="2" />
        <input v-model="newExpenseDate" type="date" class="modal-form__input" />

        <label class="modal-form__checkbox">
          <input v-model="newIsRecurring" type="checkbox" />
          Recurring expense
        </label>

        <input
          v-if="newIsRecurring"
          v-model.number="newRecurrenceDay"
          type="number"
          min="1"
          max="31"
          placeholder="Day of month (1-31)"
          class="modal-form__input"
        />
      </div>
      <template #footer>
        <Button variant="ghost" @click="showAddModal = false">Cancel</Button>
        <Button variant="primary" :loading="isSaving" @click="submitAdd">Save</Button>
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
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
  gap: var(--space-4);
}

.page-title { font-size: var(--text-2xl); }
.page-subtitle { font-size: var(--text-sm); color: var(--color-text-muted); margin-top: 2px; }

.filter-bar {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
  align-items: center;
}

.filter-field-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0 var(--space-3);
  min-height: 40px;
}

.filter-bar__select {
  background: transparent;
  border: none;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--color-text);
  outline: none;
}

.filter-bar__input {
  min-height: 40px;
  padding: 0 var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--color-text);
  outline: none;
}

.modal-form { display: flex; flex-direction: column; gap: var(--space-4); }
.modal-form__select, .modal-form__input {
  min-height: 44px; padding: 0 var(--space-4);
  background: var(--color-bg); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); font-size: var(--text-base); color: var(--color-text);
}
.modal-form__textarea {
  padding: var(--space-3) var(--space-4); background: var(--color-bg);
  border: 1px solid var(--color-border); border-radius: var(--radius-md); font-size: var(--text-base); color: var(--color-text); resize: vertical;
}
.modal-form__checkbox { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); color: var(--color-text); }

:deep(.expense-amount) { color: var(--color-market-clay); font-weight: 600; }

.pagination-wrap {
  margin-top: var(--space-6);
}
</style>