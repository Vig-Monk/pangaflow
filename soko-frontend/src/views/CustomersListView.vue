<script setup lang="ts">
// =============================================================================
// src/views/CustomersListView.vue
// Searchable, paginated customer list. Includes an inline "add customer"
// form (no separate route/modal library needed for the lite version).
// =============================================================================

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useCustomersStore } from '@/stores/customers.store';
import { CreateCustomerPayload } from '@/types';

const router = useRouter();
const customersStore = useCustomersStore();

const searchInput = ref<string>('');
const showAddForm = ref<boolean>(false);

const newCustomerName = ref<string>('');
const newCustomerPhone = ref<string>('');
const isSubmittingNew = ref<boolean>(false);
const addFormError = ref<string | null>(null);

let searchDebounceHandle: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
  customersStore.fetchCustomers(1);
});

function onSearchInput(): void {
  // Debounce: avoid firing a request on every keystroke while typing.
  // 300ms is short enough to feel instant, long enough to skip
  // intermediate keystrokes during normal typing speed.
  if (searchDebounceHandle) {
    clearTimeout(searchDebounceHandle);
  }
  searchDebounceHandle = setTimeout(() => {
    customersStore.search(searchInput.value);
  }, 300);
}

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function goToCustomer(id: string): void {
  router.push(`/customers/${id}`);
}

function openAddForm(): void {
  showAddForm.value = true;
  addFormError.value = null;
}

function closeAddForm(): void {
  showAddForm.value = false;
  newCustomerName.value = '';
  newCustomerPhone.value = '';
  addFormError.value = null;
}

async function handleAddCustomer(): Promise<void> {
  if (newCustomerName.value.trim().length === 0) {
    addFormError.value = 'Name is required';
    return;
  }

  isSubmittingNew.value = true;
  addFormError.value = null;

  const payload: CreateCustomerPayload = {
    name: newCustomerName.value.trim(),
    phone: newCustomerPhone.value.trim() || undefined,
  };

  try {
    await customersStore.createCustomer(payload);
    closeAddForm();
  } catch (err) {
    addFormError.value = err instanceof Error ? err.message : 'Failed to add customer';
  } finally {
    isSubmittingNew.value = false;
  }
}

function loadMore(): void {
  if (customersStore.meta.page < customersStore.meta.totalPages) {
    customersStore.fetchCustomers(customersStore.meta.page + 1);
  }
}
</script>

<template>
  <div class="customers-view">
    <header class="view-header">
      <h1 class="page-title">Customers</h1>
      <button class="btn-primary add-btn" @click="openAddForm">+ Add</button>
    </header>

    <input
      v-model="searchInput"
      type="search"
      placeholder="Search by name or phone…"
      class="input-field search-input"
      @input="onSearchInput"
    />

    <!-- Add customer inline form -->
    <div v-if="showAddForm" class="card add-form">
      <input
        v-model="newCustomerName"
        type="text"
        placeholder="Customer name"
        class="input-field"
        :disabled="isSubmittingNew"
      />
      <input
        v-model="newCustomerPhone"
        type="tel"
        inputmode="tel"
        placeholder="Phone (optional)"
        class="input-field"
        :disabled="isSubmittingNew"
      />
      <p v-if="addFormError" class="form-error text-danger">{{ addFormError }}</p>
      <div class="add-form-actions">
        <button class="btn-secondary" :disabled="isSubmittingNew" @click="closeAddForm">
          Cancel
        </button>
        <button class="btn-primary" :disabled="isSubmittingNew" @click="handleAddCustomer">
          {{ isSubmittingNew ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>

    <div v-if="customersStore.isLoading && !customersStore.hasCustomers" class="state-message text-muted">
      Loading customers…
    </div>

    <div v-else-if="customersStore.error" class="state-message text-danger">
      {{ customersStore.error }}
    </div>

    <div v-else-if="!customersStore.hasCustomers" class="state-message text-muted">
      No customers yet. Tap "+ Add" to create your first one.
    </div>

    <ul v-else class="customer-list">
      <li
        v-for="customer in customersStore.customers"
        :key="customer.id"
        class="customer-item card touchable"
        @click="goToCustomer(customer.id)"
      >
        <div class="customer-info">
          <span class="customer-name">{{ customer.name }}</span>
          <span v-if="customer.phone" class="customer-phone text-muted">{{ customer.phone }}</span>
        </div>
        <span
          class="customer-balance"
          :class="parseFloat(customer.current_balance) > 0 ? 'text-amber' : 'text-teal'"
        >
          {{ formatCurrency(customer.current_balance) }}
        </span>
      </li>
    </ul>

    <button
      v-if="customersStore.meta.page < customersStore.meta.totalPages"
      class="btn-secondary load-more-btn"
      :disabled="customersStore.isLoading"
      @click="loadMore"
    >
      {{ customersStore.isLoading ? 'Loading…' : 'Load More' }}
    </button>
  </div>
</template>

<style scoped>
.customers-view {
  padding: 16px;
  padding-top: 24px;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
}

.add-btn {
  padding: 0 16px;
}

.search-input {
  margin-bottom: 16px;
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.add-form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.form-error {
  font-size: 14px;
}

.state-message {
  text-align: center;
  padding: 40px 16px;
}

.customer-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.customer-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: var(--touch-min);
}

.customer-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.customer-name {
  font-weight: 600;
}

.customer-phone {
  font-size: 13px;
}

.customer-balance {
  font-weight: 700;
  font-size: 15px;
  white-space: nowrap;
}

.load-more-btn {
  width: 100%;
  margin-top: 16px;
}
</style>