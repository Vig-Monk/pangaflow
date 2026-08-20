<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/ledger/SettleDebtModal.vue
// Dedicated "Settle Debt" (Lipa Deni) Modal with quick full/partial pay chips & STK support.
// =============================================================================

import { ref, computed, watch, onUnmounted } from 'vue';
import { usePaymentsStore } from '@/stores/payments';
import { useToast } from '@/composables/useToast';
import { apiPost } from '@/services/apiClient';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import CurrencyInput from '@/components/ui/CurrencyInput.vue';
import PhoneInput from '@/components/ui/PhoneInput.vue';
import {
  Banknote,
  CreditCard,
  Zap,
  Clock,
  AlertCircle,
  RotateCcw,
} from 'lucide-vue-next';

interface CustomerSummary {
  id: string;
  name: string;
  phone: string | null;
  current_balance: string;
}

interface Props {
  open: boolean;
  customer: CustomerSummary | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  success: [result: any];
}>();

const paymentsStore = usePaymentsStore();
const { push: pushToast } = useToast();

type SettleMethod = 'cash' | 'mpesa_manual' | 'mpesa_stk';

const amount = ref<number>(0);
const paymentMethod = ref<SettleMethod>('cash');
const mpesaRef = ref('');
const stkPhone = ref('');
const description = ref('');

const isSubmitting = ref(false);
const isAwaitingStk = ref(false);
const stkCountdown = ref(60);
const stkFailed = ref(false);
let countdownInterval: ReturnType<typeof setInterval> | undefined;
let pollInterval: ReturnType<typeof setInterval> | undefined;

const currentDebt = computed(() => {
  if (!props.customer) return 0;
  return Math.max(0, parseFloat(props.customer.current_balance || '0'));
});

watch(
  () => [props.open, props.customer],
  ([isOpen]) => {
    if (isOpen && props.customer) {
      amount.value = currentDebt.value;
      paymentMethod.value = 'cash';
      mpesaRef.value = '';
      stkPhone.value = props.customer.phone || '';
      description.value = '';
      isSubmitting.value = false;
      isAwaitingStk.value = false;
      stkFailed.value = false;
      stopTimers();
    } else {
      stopTimers();
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  stopTimers();
});

function stopTimers(): void {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = undefined;
  }
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = undefined;
  }
}

function formatCurrency(val: number): string {
  return `KES ${val.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function setFullDebt(): void {
  amount.value = currentDebt.value;
}

function setPartialAmount(val: number): void {
  amount.value = Math.min(currentDebt.value, val);
}

function startStkPolling(checkoutRequestId: string): void {
  stopTimers();
  isAwaitingStk.value = true;
  stkFailed.value = false;
  stkCountdown.value = 60;

  countdownInterval = setInterval(() => {
    if (stkCountdown.value > 0) {
      stkCountdown.value--;
    } else {
      stkFailed.value = true;
      stopTimers();
    }
  }, 1000);

  pollInterval = setInterval(async () => {
    try {
      const status = await paymentsStore.pollStatus(checkoutRequestId);
      if (status === 'completed') {
        stopTimers();
        isAwaitingStk.value = false;
        pushToast({ message: 'M-Pesa payment received & debt settled!', variant: 'success' });
        emit('success', { customerId: props.customer?.id, amount: amount.value });
        emit('close');
      } else if (status === 'failed') {
        stopTimers();
        stkFailed.value = true;
      }
    } catch {
      // Continue polling
    }
  }, 3000);
}

async function handleSettleSubmit(): Promise<void> {
  if (!props.customer || amount.value <= 0 || isSubmitting.value) return;

  isSubmitting.value = true;
  try {
    const payload = {
      customerId: props.customer.id,
      amount: Number(amount.value),
      paymentMethod: paymentMethod.value,
      mpesaRef: paymentMethod.value === 'mpesa_manual' ? mpesaRef.value.trim() || undefined : undefined,
      phone: paymentMethod.value === 'mpesa_stk' ? (stkPhone.value.trim() || props.customer.phone || undefined) : undefined,
      description: description.value.trim() || undefined,
    };

    const result = await apiPost<any>('/transactions/settle-debt', payload);

    if (paymentMethod.value === 'mpesa_stk' && result.checkoutRequestId) {
      isSubmitting.value = false;
      startStkPolling(result.checkoutRequestId);
      pushToast({ message: result.customerMessage || 'STK prompt sent to customer phone', variant: 'info' });
      return;
    }

    pushToast({
      message: `Settled KES ${amount.value.toLocaleString('en-KE')} for ${props.customer.name}`,
      variant: 'success',
    });

    emit('success', result);
    emit('close');
  } catch (err: any) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to settle debt', variant: 'error' });
  } finally {
    if (paymentMethod.value !== 'mpesa_stk') {
      isSubmitting.value = false;
    }
  }
}
</script>

<template>
  <Modal :open="open" title="Settle Customer Debt (Lipa Deni)" :persistent="isAwaitingStk" @close="emit('close')">
    <div v-if="customer && !isAwaitingStk" class="settle-debt-content">
      <!-- Customer Debt Summary Header -->
      <div class="debt-target-card card">
        <div class="target-info">
          <span class="customer-name-heading">{{ customer.name }}</span>
          <span v-if="customer.phone" class="customer-phone font-mono text-muted">{{ customer.phone }}</span>
        </div>
        <div class="balance-badge-block">
          <span class="badge-label">Outstanding Debt:</span>
          <span class="debt-amount tabular-figure text-clay">{{ formatCurrency(currentDebt) }}</span>
        </div>
      </div>

      <!-- Settlement Amount -->
      <div class="form-group">
        <div class="amount-label-row">
          <label class="form-label">Payment Amount to Settle (KES) *</label>
          <button type="button" class="pay-full-link" @click="setFullDebt">
            Pay Full Balance
          </button>
        </div>

        <CurrencyInput v-model="amount" />

        <!-- Quick Partial Settlement Chips -->
        <div class="quick-settle-chips">
          <button
            v-for="chip in [500, 1000, 2000, 5000].filter((v) => v < currentDebt)"
            :key="chip"
            type="button"
            class="chip-btn"
            @click="setPartialAmount(chip)"
          >
            Pay KES {{ chip.toLocaleString('en-KE') }}
          </button>
        </div>
      </div>

      <!-- Settlement Payment Method Selection -->
      <div class="form-group">
        <label class="form-label">Payment Method *</label>
        <div class="settle-methods-grid">
          <button
            type="button"
            class="method-btn"
            :class="{ 'method-btn--active method-btn--cash': paymentMethod === 'cash' }"
            @click="paymentMethod = 'cash'"
          >
            <Banknote :size="16" />
            <div class="method-text">
              <strong>Cash in Hand</strong>
              <span>Received physically</span>
            </div>
          </button>

          <button
            type="button"
            class="method-btn"
            :class="{ 'method-btn--active method-btn--mpesa': paymentMethod === 'mpesa_manual' }"
            @click="paymentMethod = 'mpesa_manual'"
          >
            <CreditCard :size="16" />
            <div class="method-text">
              <strong>M-Pesa (Manual)</strong>
              <span>Sent to Till / Phone</span>
            </div>
          </button>

          <button
            type="button"
            class="method-btn"
            :class="{ 'method-btn--active method-btn--stk': paymentMethod === 'mpesa_stk' }"
            @click="paymentMethod = 'mpesa_stk'"
          >
            <Zap :size="16" />
            <div class="method-text">
              <strong>M-Pesa STK Push</strong>
              <span>Send PIN prompt</span>
            </div>
          </button>
        </div>

        <!-- M-Pesa Ref Input for Manual M-Pesa -->
        <div v-if="paymentMethod === 'mpesa_manual'" class="conditional-wrap">
          <input
            v-model="mpesaRef"
            type="text"
            placeholder="M-Pesa Ref Code (e.g. SH12AB34CD)"
            class="form-input font-mono uppercase"
          />
        </div>

        <!-- Phone Input for STK Push -->
        <div v-if="paymentMethod === 'mpesa_stk'" class="conditional-wrap">
          <label class="micro-label">Customer M-Pesa Phone Number:</label>
          <PhoneInput v-model="stkPhone" placeholder="07XXXXXXXX" />
        </div>
      </div>

      <!-- Optional Notes -->
      <div class="form-group">
        <label class="micro-label">Notes (Optional)</label>
        <input
          v-model="description"
          type="text"
          placeholder="e.g. Partial payment for maize delivery"
          class="form-input"
        />
      </div>
    </div>

    <!-- STK Countdown State -->
    <div v-else-if="isAwaitingStk" class="stk-waiting-view">
      <div class="timer-bubble">
        <Clock :size="28" class="text-gold spin-slow" />
        <span class="timer-digits font-mono">{{ stkCountdown }}s</span>
      </div>

      <div class="waiting-copy">
        <h3>M-Pesa Prompt Sent</h3>
        <p>Ask <strong>{{ customer?.name }}</strong> to enter their M-Pesa PIN on their phone to settle KES {{ amount.toLocaleString('en-KE') }}.</p>
      </div>

      <div v-if="!stkFailed" class="pulse-indicator">
        <span class="pulse-dot"></span> Waiting for confirmation...
      </div>

      <div v-else class="stk-failed-box">
        <AlertCircle :size="16" class="text-clay" />
        <span>Prompt timed out. You can retry or record as Cash.</span>
      </div>
    </div>

    <template #footer>
      <template v-if="!isAwaitingStk">
        <Button variant="ghost" @click="emit('close')">Cancel</Button>
        <Button
          variant="primary"
          :disabled="amount <= 0 || isSubmitting"
          :loading="isSubmitting"
          @click="handleSettleSubmit"
        >
          {{ paymentMethod === 'mpesa_stk' ? 'Send STK Prompt' : 'Confirm Debt Settlement' }}
        </Button>
      </template>

      <template v-else-if="stkFailed">
        <Button variant="ghost" @click="isAwaitingStk = false">Back to Edit</Button>
        <Button variant="primary" @click="handleSettleSubmit">
          <RotateCcw :size="14" /> Retry STK
        </Button>
      </template>
    </template>
  </Modal>
</template>

<style scoped>
.settle-debt-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.debt-target-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  background: color-mix(in srgb, var(--color-market-clay) 6%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-market-clay) 30%, transparent);
  border-radius: var(--radius-md);
  flex-wrap: wrap;
  gap: var(--space-2);
}

.target-info {
  display: flex;
  flex-direction: column;
}

.customer-name-heading {
  font-size: var(--text-base);
  font-weight: 800;
  color: var(--color-text);
}

.customer-phone {
  font-size: var(--text-xs);
}

.balance-badge-block {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.badge-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.debt-amount {
  font-size: var(--text-xl);
  font-weight: 800;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.amount-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-label {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-text);
}

.pay-full-link {
  background: transparent;
  border: none;
  font-size: 11px;
  font-weight: 700;
  color: var(--brand-primary);
  cursor: pointer;
  padding: 0;
}

.quick-settle-chips {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
  margin-top: 4px;
}

.chip-btn {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
}
.chip-btn:hover {
  border-color: var(--color-ink);
}

.settle-methods-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin-top: 2px;
}

@media (max-width: 580px) {
  .settle-methods-grid {
    grid-template-columns: 1fr;
  }
}

.method-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
}

.method-btn:hover {
  border-color: var(--color-ink);
}

.method-btn--active {
  border-color: var(--brand-primary);
  background: color-mix(in srgb, var(--brand-primary) 8%, var(--color-surface));
}

.method-btn--cash.method-btn--active {
  border-color: var(--color-ledger-green);
  background: color-mix(in srgb, var(--color-ledger-green) 8%, var(--color-surface));
}

.method-text {
  display: flex;
  flex-direction: column;
}

.method-text strong {
  font-size: 11px;
  color: var(--color-text);
}

.method-text span {
  font-size: 10px;
  color: var(--color-text-muted);
}

.conditional-wrap {
  margin-top: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.micro-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.form-input {
  min-height: 40px;
  padding: 0 var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-text);
  outline: none;
}
.form-input:focus {
  border-color: var(--color-ink);
}

.uppercase { text-transform: uppercase; }

/* STK Waiting View */
.stk-waiting-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-6) var(--space-4);
  gap: var(--space-3);
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

.timer-digits {
  font-size: var(--text-xl);
  font-weight: 800;
}

.waiting-copy h3 {
  font-size: var(--text-base);
  font-weight: 700;
}

.waiting-copy p {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  max-width: 320px;
  margin-top: 4px;
}

.pulse-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-gold-hover);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: var(--color-gold);
  border-radius: 50%;
  animation: pulse-ring 1.4s infinite;
}

@keyframes pulse-ring {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.5; }
}

.stk-failed-box {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: color-mix(in srgb, var(--color-market-clay) 12%, transparent);
  border: 1px solid var(--color-market-clay);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--color-market-clay);
  font-weight: 600;
}

.spin-slow {
  animation: spin 3s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.text-clay { color: var(--color-market-clay); }
.text-gold { color: var(--color-gold-hover); }
</style>