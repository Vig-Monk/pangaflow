<script setup lang="ts">
// =============================================================================
// src/views/CustomerDetailView.vue
// Highest-trust screen in the app — every currency figure and status
// state here is deliberate, nothing decorative.
// =============================================================================

import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useCustomersStore } from '@/stores/customers';
import { useLedgerStore } from '@/stores/ledger';
import { usePaymentsStore } from '@/stores/payments';
import { useToast } from '@/composables/useToast';
import Button from '@/components/ui/Button.vue';
import Modal from '@/components/ui/Modal.vue';
import CurrencyInput from '@/components/ui/CurrencyInput.vue';
import PhoneInput from '@/components/ui/PhoneInput.vue';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import LedgerRow from '@/components/ledger/LedgerRow.vue';

interface Props {
  id: string;
}

const props = defineProps<Props>();

const customersStore = useCustomersStore();
const ledgerStore = useLedgerStore();
const paymentsStore = usePaymentsStore();
const { push: pushToast } = useToast();

onMounted(() => {
  customersStore.fetchOne(props.id);
  ledgerStore.fetchLedger(props.id, { page: 1 });
});

onUnmounted(() => {
  stopPolling();
});

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  return `KES ${num.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const customer = computed(() => customersStore.current);
const balanceSign = computed(() => {
  const bal = parseFloat(customer.value?.current_balance ?? '0');
  return bal > 0 ? 'owed' : 'credit';
});

// ---------------------------------------------------------------------------
// Record Sale modal — "secondary, not danger" per design.md's explicit
// instruction, even though a sale increases what's owed.
// ---------------------------------------------------------------------------

const showSaleModal = ref(false);
const saleAmount = ref(0);
const saleDescription = ref('');
const isSavingSale = ref(false);

function openSaleModal(): void {
  saleAmount.value = 0;
  saleDescription.value = '';
  showSaleModal.value = true;
}

async function submitSale(): Promise<void> {
  if (saleAmount.value <= 0) return;
  isSavingSale.value = true;
  try {
    await ledgerStore.recordSale(props.id, saleAmount.value, saleDescription.value || undefined);
    pushToast({ message: 'Sale recorded', variant: 'success' });
    showSaleModal.value = false;
    customersStore.fetchOne(props.id); // refresh header balance
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to record sale', variant: 'error' });
  } finally {
    isSavingSale.value = false;
  }
}

// ---------------------------------------------------------------------------
// Collect Payment modal + M-Pesa polling
// ---------------------------------------------------------------------------

type PaymentFlowState = 'idle' | 'waiting' | 'failed';

const showPaymentModal = ref(false);
const paymentAmount = ref(0);
const paymentPhone = ref('');
const isSubmittingPayment = ref(false);
const paymentFlowState = ref<PaymentFlowState>('idle');
const activeCheckoutRequestId = ref<string | null>(null);

let pollHandle: ReturnType<typeof setInterval> | undefined;

const POLL_INTERVAL_MS = 3000;

function openPaymentModal(): void {
  paymentAmount.value = 0;
  // Pre-filled from the customer's phone — Customer.phone is
  // `string | null`; PhoneInput's modelValue is plain `string`, so a
  // null phone defaults to an empty field rather than breaking the
  // component's type contract.
  paymentPhone.value = customer.value?.phone ?? '';
  paymentFlowState.value = 'idle';
  showPaymentModal.value = true;
}

async function submitPayment(): Promise<void> {
  if (paymentAmount.value <= 0 || paymentPhone.value.length === 0) return;
  isSubmittingPayment.value = true;
  try {
    const result = await paymentsStore.collectViaMpesa({
      customerId: props.id,
      amount: paymentAmount.value,
      phone: paymentPhone.value,
    });
    activeCheckoutRequestId.value = result.checkoutRequestId;
    paymentFlowState.value = 'waiting';
    startPolling(result.checkoutRequestId);
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to initiate payment', variant: 'error' });
  } finally {
    isSubmittingPayment.value = false;
  }
}

function startPolling(checkoutRequestId: string): void {
  stopPolling();
  pollHandle = setInterval(async () => {
    const status = await paymentsStore.pollStatus(checkoutRequestId);

    // null means "endpoint not implemented yet / status unknown" — per
    // Phase 2's explicit contract. Keep waiting, do NOT treat as failure.
    if (status === null || status === 'pending') {
      return;
    }

    if (status === 'completed') {
      stopPolling();
      paymentFlowState.value = 'idle';
      showPaymentModal.value = false;
      pushToast({ message: 'Payment received', variant: 'success' });
      ledgerStore.fetchLedger(props.id, { page: 1 });
      customersStore.fetchOne(props.id);
      return;
    }

    if (status === 'failed') {
      stopPolling();
      paymentFlowState.value = 'failed';
    }
  }, POLL_INTERVAL_MS);
}

function stopPolling(): void {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = undefined;
  }
}

function retryPayment(): void {
  paymentFlowState.value = 'idle';
  activeCheckoutRequestId.value = null;
}
</script>

<template>
  <div class="detail-page">
    <template v-if="customer">
      <header class="detail-header">
        <div>
          <h1 class="customer-name">{{ customer.name }}</h1>
          <p v-if="customer.phone" class="customer-phone">{{ customer.phone }}</p>
        </div>

        <div class="balance-block">
          <p class="balance-label">Current Balance</p>
          <p class="balance-value tabular-figure" :class="balanceSign === 'owed' ? 'balance-value--owed' : 'balance-value--credit'">
            {{ formatCurrency(customer.current_balance) }}
          </p>
        </div>

        <div class="header-actions">
          <!-- secondary, NOT danger, per design.md's explicit instruction -->
          <Button variant="secondary" size="lg" @click="openSaleModal">Record Sale</Button>
          <Button variant="primary" size="lg" @click="openPaymentModal">Collect Payment</Button>
        </div>
      </header>

      <section class="ledger-section">
        <h2 class="section-title">Transaction History</h2>

        <EmptyState
          v-if="!ledgerStore.loadingLedger && ledgerStore.entries.length === 0"
          title="No transactions yet"
        />

        <div v-else class="ledger-list">
          <LedgerRow
            v-for="tx in ledgerStore.entries"
            :key="tx.id"
            :customer-name="customer.name"
            :amount="formatCurrency(tx.amount)"
            :type="tx.type"
            :timestamp="formatTimestamp(tx.created_at)"
            :balance-after="formatCurrency(tx.balance_after)"
          />
        </div>

        <Pagination
          v-if="ledgerStore.entries.length > 0"
          :page="ledgerStore.page"
          :total-pages="Math.max(1, Math.ceil(ledgerStore.total / 20))"
          :on-change="(p) => ledgerStore.fetchLedger(id, { page: p })"
        />
      </section>
    </template>

    <!-- Record Sale modal -->
    <Modal :open="showSaleModal" title="Record Sale" @close="showSaleModal = false">
      <div class="modal-form">
        <CurrencyInput v-model="saleAmount" />
        <textarea v-model="saleDescription" placeholder="Description (optional)" class="modal-form__textarea" rows="3" />
      </div>
      <template #footer>
        <Button variant="ghost" @click="showSaleModal = false">Cancel</Button>
        <Button variant="primary" :loading="isSavingSale" @click="submitSale">Save</Button>
      </template>
    </Modal>

    <!-- Collect Payment modal -->
    <Modal
      :open="showPaymentModal"
      title="Collect Payment via M-Pesa"
      :persistent="paymentFlowState === 'waiting'"
      @close="showPaymentModal = false"
    >
      <div v-if="paymentFlowState === 'idle'" class="modal-form">
        <CurrencyInput v-model="paymentAmount" />
        <PhoneInput v-model="paymentPhone" />
      </div>

      <div v-else-if="paymentFlowState === 'waiting'" class="payment-waiting">
        <span class="payment-waiting__spinner" aria-hidden="true" />
        <p class="payment-waiting__text">
          Waiting for confirmation — ask the customer to enter their M-Pesa PIN.
        </p>
      </div>

      <div v-else-if="paymentFlowState === 'failed'" class="payment-failed">
        <p class="payment-failed__text">Payment failed or was cancelled.</p>
      </div>

      <template #footer>
        <template v-if="paymentFlowState === 'idle'">
          <Button variant="ghost" @click="showPaymentModal = false">Cancel</Button>
          <Button variant="primary" :loading="isSubmittingPayment" @click="submitPayment">Send STK Push</Button>
        </template>
        <template v-else-if="paymentFlowState === 'failed'">
          <Button variant="ghost" @click="showPaymentModal = false">Close</Button>
          <Button variant="primary" @click="retryPayment">Try Again</Button>
        </template>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.detail-page {
  padding: var(--space-6);
  max-width: 720px;
  margin: 0 auto;
}

.detail-header {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  margin-bottom: var(--space-6);
}

.customer-name {
  font-size: var(--text-2xl);
}

.customer-phone {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  margin-top: var(--space-1);
}

.balance-block {
  margin: var(--space-5) 0;
}

.balance-label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.balance-value {
  font-size: var(--text-4xl);
}

.balance-value--owed { color: var(--color-market-clay); }
.balance-value--credit { color: var(--color-ledger-green); }

.header-actions {
  display: flex;
  gap: var(--space-3);
}

.section-title {
  font-size: var(--text-lg);
  margin-bottom: var(--space-3);
}

.ledger-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.modal-form__textarea {
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: var(--text-base);
  color: var(--color-text);
  resize: vertical;
}

.payment-waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

.payment-waiting__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-ink);
  border-radius: 50%;
  animation: payment-spin 1s linear infinite;
}

@keyframes payment-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .payment-waiting__spinner { animation: none; }
}

.payment-waiting__text {
  color: var(--color-text);
  line-height: var(--leading-relaxed);
}

.payment-failed__text {
  color: var(--color-market-clay);
  text-align: center;
  padding: var(--space-4) 0;
}
</style>