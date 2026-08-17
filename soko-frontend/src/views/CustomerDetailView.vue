<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/CustomerDetailView.vue
// Customer credit ledger, 60s M-Pesa collection countdown, and WhatsApp statement relay.
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
import {
  AlertCircle,
  CheckCircle2,
  Share2,
  RotateCcw,
  Plus,
  CreditCard,
  Clock,
} from 'lucide-vue-next';

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
  stopCountdownTimer();
});

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `KES ${num.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const customer = computed(() => customersStore.current);
const balanceNumber = computed(() => parseFloat(customer.value?.current_balance ?? '0'));
const hasDebt = computed(() => balanceNumber.value > 0);

// WhatsApp Statement Generator
const whatsappStatementUrl = computed(() => {
  if (!customer.value) return '#';
  const cleanDigits = (customer.value.phone || '').replace(/\D/g, '');
  const phone = cleanDigits.startsWith('0') ? `254${cleanDigits.slice(1)}` : cleanDigits;

  const lines = [
    `*📋 SOKO CUSTOMER STATEMENT — ${customer.value.name.toUpperCase()}*`,
    `--------------------------------`,
    `*Current Balance:* KES ${Math.abs(balanceNumber.value).toLocaleString('en-KE')} (${hasDebt.value ? 'OUTSTANDING DEBT' : 'CLEARED / IN CREDIT'})`,
    `*Total Transactions:* ${ledgerStore.total}`,
    `--------------------------------`,
    `_Thank you for your business! Please reach out if you have any questions._`,
  ].join('\n');

  return `https://wa.me/${phone}?text=${encodeURIComponent(lines)}`;
});

// ---------------------------------------------------------------------------
// Record Sale modal
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
    pushToast({ message: 'Sale recorded in credit ledger', variant: 'success' });
    showSaleModal.value = false;
    customersStore.fetchOne(props.id);
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to record sale', variant: 'error' });
  } finally {
    isSavingSale.value = false;
  }
}

// ---------------------------------------------------------------------------
// Collect Payment modal + 60s Countdown Timer
// ---------------------------------------------------------------------------
type PaymentFlowState = 'idle' | 'waiting' | 'failed';

const showPaymentModal = ref(false);
const paymentAmount = ref(0);
const paymentPhone = ref('');
const isSubmittingPayment = ref(false);
const paymentFlowState = ref<PaymentFlowState>('idle');
const activeCheckoutRequestId = ref<string | null>(null);

const countdownSeconds = ref(60);
let timerInterval: ReturnType<typeof setInterval> | undefined;
let pollHandle: ReturnType<typeof setInterval> | undefined;

const POLL_INTERVAL_MS = 3000;

function startCountdownTimer(): void {
  stopCountdownTimer();
  countdownSeconds.value = 60;

  timerInterval = setInterval(() => {
    if (countdownSeconds.value > 0) {
      countdownSeconds.value--;
    } else {
      stopCountdownTimer();
    }
  }, 1000);
}

function stopCountdownTimer(): void {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = undefined;
  }
}

function openPaymentModal(): void {
  paymentAmount.value = Math.max(0, balanceNumber.value);
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
    startCountdownTimer();
    startPolling(result.checkoutRequestId);
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to initiate M-Pesa push', variant: 'error' });
  } finally {
    isSubmittingPayment.value = false;
  }
}

function startPolling(checkoutRequestId: string): void {
  stopPolling();
  pollHandle = setInterval(async () => {
    const status = await paymentsStore.pollStatus(checkoutRequestId);

    if (status === null || status === 'pending') {
      return;
    }

    if (status === 'completed') {
      stopPolling();
      stopCountdownTimer();
      paymentFlowState.value = 'idle';
      showPaymentModal.value = false;
      pushToast({ message: 'Payment confirmed & ledger credited', variant: 'success' });
      ledgerStore.fetchLedger(props.id, { page: 1 });
      customersStore.fetchOne(props.id);
      return;
    }

    if (status === 'failed') {
      stopPolling();
      stopCountdownTimer();
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
      <header class="detail-header card">
        <div class="header-top-row">
          <div>
            <div class="name-status-row">
              <h1 class="customer-name">{{ customer.name }}</h1>
              <span
                class="debt-status-pill"
                :class="hasDebt ? 'debt-status-pill--owed' : 'debt-status-pill--cleared'"
              >
                <component :is="hasDebt ? AlertCircle : CheckCircle2" :size="12" />
                {{ hasDebt ? 'OUTSTANDING DEBT' : 'CLEARED' }}
              </span>
            </div>
            <p v-if="customer.phone" class="customer-phone font-mono">{{ customer.phone }}</p>
          </div>

          <a
            v-if="customer.phone"
            :href="whatsappStatementUrl"
            target="_blank"
            rel="noopener"
            class="whatsapp-statement-btn"
          >
            <Share2 :size="14" /> Send Statement via WhatsApp
          </a>
        </div>

        <div class="balance-block">
          <p class="balance-label">Current Balance</p>
          <p
            class="balance-value tabular-figure"
            :class="hasDebt ? 'balance-value--owed' : 'balance-value--credit'"
          >
            {{ formatCurrency(customer.current_balance) }}
          </p>
        </div>

        <div class="header-actions">
          <Button variant="secondary" size="lg" @click="openSaleModal">
            <Plus :size="16" /> Record Sale
          </Button>
          <Button variant="primary" size="lg" @click="openPaymentModal">
            <CreditCard :size="16" /> Collect Payment
          </Button>
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

    <!-- Record Sale modal with quick chips -->
    <Modal :open="showSaleModal" title="Record Sale" @close="showSaleModal = false">
      <div class="modal-form">
        <label class="form-label">Sale Amount (KES) *</label>
        <CurrencyInput v-model="saleAmount" :show-quick-chips="true" />
        <textarea
          v-model="saleDescription"
          placeholder="Description or line items (optional)"
          class="modal-form__textarea"
          rows="3"
        />
      </div>
      <template #footer>
        <Button variant="ghost" @click="showSaleModal = false">Cancel</Button>
        <Button variant="primary" :loading="isSavingSale" @click="submitSale">Save Sale</Button>
      </template>
    </Modal>

    <!-- Collect Payment modal with 60s countdown -->
    <Modal
      :open="showPaymentModal"
      title="Collect Payment via M-Pesa"
      :persistent="paymentFlowState === 'waiting'"
      @close="showPaymentModal = false"
    >
      <div v-if="paymentFlowState === 'idle'" class="modal-form">
        <div class="form-group">
          <label class="form-label">Amount to Collect (KES) *</label>
          <CurrencyInput v-model="paymentAmount" :show-quick-chips="true" />
        </div>
        <div class="form-group">
          <label class="form-label">Customer M-Pesa Phone *</label>
          <PhoneInput v-model="paymentPhone" />
        </div>
      </div>

      <!-- 60s Waiting State -->
      <div v-else-if="paymentFlowState === 'waiting'" class="payment-waiting">
        <div class="timer-bubble">
          <Clock :size="24" class="text-gold spin-slow" />
          <span class="timer-text font-mono">{{ countdownSeconds }}s</span>
        </div>
        <p class="payment-waiting__text">
          Waiting for confirmation — ask customer to enter their M-Pesa PIN on their phone.
        </p>
      </div>

      <!-- Payment Failed State -->
      <div v-else-if="paymentFlowState === 'failed'" class="payment-failed">
        <AlertCircle :size="24" class="text-clay" />
        <p class="payment-failed__text">M-Pesa payment failed or timed out.</p>
      </div>

      <template #footer>
        <template v-if="paymentFlowState === 'idle'">
          <Button variant="ghost" @click="showPaymentModal = false">Cancel</Button>
          <Button variant="primary" :loading="isSubmittingPayment" @click="submitPayment">
            Send STK Push
          </Button>
        </template>
        <template v-else-if="paymentFlowState === 'failed'">
          <Button variant="ghost" @click="showPaymentModal = false">Close</Button>
          <Button variant="primary" @click="retryPayment">
            <RotateCcw :size="14" /> Try Again
          </Button>
        </template>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.detail-page {
  padding: var(--space-6);
  max-width: 760px;
  margin: 0 auto;
}

.detail-header {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  margin-bottom: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.header-top-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.name-status-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.customer-name {
  font-size: var(--text-2xl);
  font-weight: 700;
}

.customer-phone {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  margin-top: 2px;
}

.debt-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: var(--radius-full);
}

.debt-status-pill--owed {
  background: color-mix(in srgb, var(--color-market-clay) 12%, transparent);
  color: var(--color-market-clay);
}

.debt-status-pill--cleared {
  background: color-mix(in srgb, var(--color-ledger-green) 12%, transparent);
  color: var(--color-ledger-green);
}

.whatsapp-statement-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: color-mix(in srgb, var(--color-ledger-green) 10%, transparent);
  border: 1px solid var(--color-ledger-green);
  color: var(--color-ledger-green);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: 700;
  text-decoration: none;
  transition: all var(--duration-fast) var(--ease-standard);
}
.whatsapp-statement-btn:hover {
  background: var(--color-ledger-green);
  color: #FFFFFF;
}

.balance-block {
  margin: var(--space-2) 0;
}

.balance-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.balance-value {
  font-size: var(--text-4xl);
  font-weight: 800;
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
  gap: var(--space-3);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
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
  gap: var(--space-3);
  padding: var(--space-6) var(--space-4);
  text-align: center;
}

.timer-bubble {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
}

.timer-text {
  font-size: var(--text-lg);
  font-weight: 800;
  color: var(--color-text);
}

.payment-waiting__text {
  font-size: var(--text-xs);
  color: var(--color-text);
  line-height: var(--leading-relaxed);
  max-width: 320px;
}

.payment-failed {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4) 0;
  text-align: center;
}

.payment-failed__text {
  color: var(--color-market-clay);
  font-size: var(--text-sm);
  font-weight: 700;
}

.spin-slow {
  animation: spin 3s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.text-gold { color: var(--color-gold); }
.text-clay { color: var(--color-market-clay); }
</style>