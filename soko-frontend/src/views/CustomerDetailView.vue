<script setup lang="ts">
// =============================================================================
// src/views/CustomerDetailView.vue
// Customer ledger + record-transaction form. This is the core daily-use
// screen for a trader: check a customer's balance, record a sale or a
// payment against it.
// =============================================================================

import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApi } from '@/composables/useApi';
import * as transactionsApi from '@/api/transactions.api';
import { RecordTransactionPayload } from '@/types';

interface Props {
  id: string;
}

const props = defineProps<Props>();

const route = useRoute();
const router = useRouter();

const {
  data: ledger,
  isLoading: isLoadingLedger,
  error: ledgerError,
  execute: loadLedger,
} = useApi(transactionsApi.getCustomerLedger);

// -----------------------------------------------------------------------
// Record-transaction form state
// -----------------------------------------------------------------------

const showRecordForm = ref<boolean>(false);
const transactionType = ref<RecordTransactionPayload['type']>('sale');
const amountInput = ref<string>('');
const descriptionInput = ref<string>('');
const isSubmittingTx = ref<boolean>(false);
const txFormError = ref<string | null>(null);

const customerId = computed<string>(() => props.id || (route.params.id as string));

onMounted(() => {
  loadLedger(customerId.value);
});

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function transactionLabel(type: string): string {
  if (type === 'sale') return 'Sale';
  if (type === 'payment') return 'Payment';
  return 'Adjustment';
}

function openRecordForm(type: RecordTransactionPayload['type']): void {
  transactionType.value = type;
  showRecordForm.value = true;
  txFormError.value = null;
  amountInput.value = '';
  descriptionInput.value = '';
}

function closeRecordForm(): void {
  showRecordForm.value = false;
  txFormError.value = null;
}

async function handleRecordTransaction(): Promise<void> {
  const amount = parseFloat(amountInput.value);

  if (isNaN(amount) || amount <= 0) {
    txFormError.value = 'Please enter a valid amount greater than zero';
    return;
  }

  isSubmittingTx.value = true;
  txFormError.value = null;

  try {
    await transactionsApi.recordTransaction({
      customerId: customerId.value,
      type: transactionType.value,
      amount,
      description: descriptionInput.value.trim() || undefined,
    });

    closeRecordForm();
    // Reload the ledger so the new transaction and updated balance appear
    await loadLedger(customerId.value);
  } catch (err) {
    txFormError.value =
      err instanceof Error ? err.message : 'Failed to record transaction';
  } finally {
    isSubmittingTx.value = false;
  }
}

function goBack(): void {
  router.push('/customers');
}
</script>

<template>
  <div class="customer-detail">
    <header class="view-header">
      <button class="back-btn" @click="goBack">← Back</button>
    </header>

    <div v-if="isLoadingLedger && !ledger" class="state-message text-muted">
      Loading customer…
    </div>

    <div v-else-if="ledgerError" class="state-message text-danger">
      {{ ledgerError }}
    </div>

    <template v-else-if="ledger">
      <div class="card customer-summary">
        <h1 class="customer-name">{{ ledger.customer.name }}</h1>
        <p v-if="ledger.customer.phone" class="customer-phone text-muted">
          {{ ledger.customer.phone }}
        </p>

        <div class="balance-block">
          <p class="balance-label text-muted">Current Balance</p>
          <p
            class="balance-value"
            :class="parseFloat(ledger.current_balance) > 0 ? 'text-amber' : 'text-teal'"
          >
            {{ formatCurrency(ledger.current_balance) }}
          </p>
        </div>

        <div class="action-buttons">
          <button class="btn-primary" @click="openRecordForm('sale')">Record Sale</button>
          <button class="btn-secondary" @click="openRecordForm('payment')">
            Record Payment
          </button>
        </div>
      </div>

      <!-- Record transaction inline form -->
      <div v-if="showRecordForm" class="card record-form">
        <h2 class="record-form-title">
          {{ transactionType === 'sale' ? 'Record Sale' : 'Record Payment' }}
        </h2>
        <input
          v-model="amountInput"
          type="number"
          inputmode="decimal"
          placeholder="Amount (KES)"
          class="input-field"
          :disabled="isSubmittingTx"
        />
        <input
          v-model="descriptionInput"
          type="text"
          placeholder="Description (optional)"
          class="input-field"
          :disabled="isSubmittingTx"
        />
        <p v-if="txFormError" class="form-error text-danger">{{ txFormError }}</p>
        <div class="record-form-actions">
          <button class="btn-secondary" :disabled="isSubmittingTx" @click="closeRecordForm">
            Cancel
          </button>
          <button
            class="btn-primary"
            :disabled="isSubmittingTx"
            @click="handleRecordTransaction"
          >
            {{ isSubmittingTx ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>

      <section class="ledger-section">
        <h2 class="section-title">Transaction History</h2>

        <div v-if="ledger.transactions.length === 0" class="empty-state text-muted">
          No transactions yet.
        </div>

        <ul v-else class="transaction-list">
          <li
            v-for="transaction in ledger.transactions"
            :key="transaction.id"
            class="transaction-item card"
          >
            <div class="transaction-main">
              <span class="transaction-type" :class="`type-${transaction.type}`">
                {{ transactionLabel(transaction.type) }}
              </span>
              <span
                class="transaction-amount"
                :class="transaction.type === 'payment' ? 'text-teal' : 'text-amber'"
              >
                {{ transaction.type === 'payment' ? '−' : '+' }}{{ formatCurrency(transaction.amount) }}
              </span>
            </div>
            <p v-if="transaction.description" class="transaction-description text-muted">
              {{ transaction.description }}
            </p>
            <div class="transaction-meta text-muted">
              <span>{{ formatDate(transaction.created_at) }}</span>
              <span>Balance: {{ formatCurrency(transaction.balance_after) }}</span>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.customer-detail {
  padding: 16px;
  padding-top: 16px;
}

.view-header {
  margin-bottom: 12px;
}

.back-btn {
  background: transparent;
  color: var(--color-teal-light);
  padding: 0;
  min-height: var(--touch-min);
  font-size: 15px;
}

.state-message {
  text-align: center;
  padding: 40px 16px;
}

.customer-summary {
  margin-bottom: 16px;
}

.customer-name {
  font-size: 22px;
  font-weight: 700;
}

.customer-phone {
  font-size: 14px;
  margin-top: 2px;
}

.balance-block {
  margin: 16px 0;
}

.balance-label {
  font-size: 13px;
}

.balance-value {
  font-size: 32px;
  font-weight: 700;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.action-buttons button {
  flex: 1;
}

.record-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.record-form-title {
  font-size: 16px;
  font-weight: 600;
}

.record-form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.form-error {
  font-size: 14px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 10px;
}

.empty-state {
  text-align: center;
  padding: 24px;
}

.transaction-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.transaction-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.transaction-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.transaction-type {
  font-weight: 600;
  font-size: 14px;
  padding: 2px 8px;
  border-radius: 6px;
}

.transaction-type.type-sale {
  background: rgba(217, 119, 6, 0.15);
  color: var(--color-amber);
}

.transaction-type.type-payment {
  background: rgba(13, 148, 136, 0.15);
  color: var(--color-teal);
}

.transaction-type.type-adjustment {
  background: rgba(148, 163, 184, 0.15);
  color: var(--color-muted);
}

.transaction-amount {
  font-weight: 700;
  font-size: 16px;
}

.transaction-description {
  font-size: 14px;
}

.transaction-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}
</style>