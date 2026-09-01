<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/ledger/SmartSaleModal.vue
// POS Modal with Catalog item selection, Variant resolution, and automatic stock deduction.
// =============================================================================

import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useCustomersStore } from '@/stores/customers';
import { useProductsStore, type Product } from '@/stores/products';
import { usePaymentsStore } from '@/stores/payments';
import { useToast } from '@/composables/useToast';
import { apiPost } from '@/services/apiClient';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import CurrencyInput from '@/components/ui/CurrencyInput.vue';
import PhoneInput from '@/components/ui/PhoneInput.vue';
import {
  Banknote,
  Zap,
  User,
  UserPlus,
  Clock,
  AlertCircle,
  RotateCcw,
  CreditCard,
  Tag,
  Layers,
} from 'lucide-vue-next';

interface Props {
  open: boolean;
  preselectedCustomerId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  preselectedCustomerId: undefined,
});

const emit = defineEmits<{
  close: [];
  success: [result: any];
}>();

const customersStore = useCustomersStore();
const productsStore = useProductsStore();
const paymentsStore = usePaymentsStore();
const { push: pushToast } = useToast();

type PaymentMode = 'credit' | 'cash' | 'mpesa_manual' | 'mpesa_stk';

// Customer selection state
const isNewCustomer = ref(false);
const customerId = ref(props.preselectedCustomerId || '');
const newCustomerName = ref('');
const newCustomerPhone = ref('');

// Product / Variant catalog selection state
const selectedProductId = ref('');
const selectedVariantId = ref('');
const amount = ref(0);
const description = ref('');
const paymentMode = ref<PaymentMode>('credit');
const mpesaRef = ref('');
const stkPhone = ref('');

// UI & Async states
const isSubmitting = ref(false);
const isAwaitingStk = ref(false);
const stkCountdown = ref(60);
const stkFailed = ref(false);
let countdownInterval: ReturnType<typeof setInterval> | undefined;
let pollInterval: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  if (customersStore.list.length === 0) {
    customersStore.fetchList({ limit: 100 });
  }
  if (productsStore.list.length === 0) {
    productsStore.fetchList({ limit: 100 });
  }
});

onUnmounted(() => {
  stopStkTimers();
});

watch(
  () => props.preselectedCustomerId,
  (newId) => {
    if (newId) {
      customerId.value = newId;
      isNewCustomer.value = false;
    }
  },
  { immediate: true }
);

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      resetForm();
    } else {
      stopStkTimers();
    }
  }
);

const selectedCustomerObject = computed(() => {
  return customersStore.list.find((c) => c.id === customerId.value);
});

const selectedProductObject = computed<Product | undefined>(() => {
  return productsStore.list.find((p) => p.id === selectedProductId.value);
});

const productVariantsList = computed(() => {
  return selectedProductObject.value?.variants || [];
});

// Auto-fill price and description when a product is picked
watch(selectedProductObject, (prod) => {
  if (prod) {
    selectedVariantId.value = '';
    if (prod.variants && prod.variants.length > 0) {
      const firstVariant = prod.variants[0];
      selectedVariantId.value = firstVariant.id || '';
      amount.value = typeof firstVariant.price === 'string' ? parseFloat(firstVariant.price) : firstVariant.price;
      description.value = `${prod.name} (${firstVariant.title})`;
    } else {
      amount.value = typeof prod.price === 'string' ? parseFloat(prod.price) : prod.price;
      description.value = prod.name;
    }
  }
});

// Update price and title when a specific variant is chosen
function handleVariantSelect(variantId: string): void {
  selectedVariantId.value = variantId;
  const v = productVariantsList.value.find((item) => item.id === variantId);
  if (v && selectedProductObject.value) {
    amount.value = typeof v.price === 'string' ? parseFloat(v.price) : v.price;
    description.value = `${selectedProductObject.value.name} (${v.title})`;
  }
}

// Auto-fill STK phone from customer record if available
watch(selectedCustomerObject, (cust) => {
  if (cust?.phone && !stkPhone.value) {
    stkPhone.value = cust.phone;
  }
});

function resetForm(): void {
  if (!props.preselectedCustomerId) {
    customerId.value = '';
    isNewCustomer.value = false;
  }
  newCustomerName.value = '';
  newCustomerPhone.value = '';
  selectedProductId.value = '';
  selectedVariantId.value = '';
  amount.value = 0;
  description.value = '';
  paymentMode.value = 'credit';
  mpesaRef.value = '';
  stkPhone.value = selectedCustomerObject.value?.phone || '';
  isSubmitting.value = false;
  isAwaitingStk.value = false;
  stkFailed.value = false;
  stopStkTimers();
}

function stopStkTimers(): void {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = undefined;
  }
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = undefined;
  }
}

function startStkPolling(checkoutRequestId: string): void {
  stopStkTimers();
  isAwaitingStk.value = true;
  stkFailed.value = false;
  stkCountdown.value = 60;

  countdownInterval = setInterval(() => {
    if (stkCountdown.value > 0) {
      stkCountdown.value--;
    } else {
      stkFailed.value = true;
      stopStkTimers();
    }
  }, 1000);

  pollInterval = setInterval(async () => {
    try {
      const status = await paymentsStore.pollStatus(checkoutRequestId);
      if (status === 'completed') {
        stopStkTimers();
        isAwaitingStk.value = false;
        pushToast({ message: 'M-Pesa payment received & sale completed!', variant: 'success' });
        emit('success', { customerId: customerId.value, amount: amount.value });
        emit('close');
      } else if (status === 'failed') {
        stopStkTimers();
        stkFailed.value = true;
      }
    } catch {
      // Continue polling until timeout
    }
  }, 3000);
}

const canSubmit = computed(() => {
  if (amount.value <= 0) return false;
  if (isNewCustomer.value) {
    return newCustomerName.value.trim().length > 0;
  }
  return customerId.value.length > 0;
});

async function handleSubmit(): Promise<void> {
  if (!canSubmit.value || isSubmitting.value) return;

  isSubmitting.value = true;
  try {
    const payload = {
      customerId: !isNewCustomer.value && customerId.value ? customerId.value : undefined,
      newCustomer: isNewCustomer.value
        ? {
            name: newCustomerName.value.trim(),
            phone: newCustomerPhone.value.trim() || undefined,
          }
        : undefined,
      productId: selectedProductId.value || undefined,
      variantId: selectedVariantId.value || undefined,
      amount: Number(amount.value),
      description: description.value.trim() || undefined,
      paymentMode: paymentMode.value,
      mpesaRef: paymentMode.value === 'mpesa_manual' ? mpesaRef.value.trim() || undefined : undefined,
      phone: paymentMode.value === 'mpesa_stk'
        ? (stkPhone.value.trim() || (isNewCustomer.value ? newCustomerPhone.value.trim() : undefined))
        : undefined,
    };

    const result = await apiPost<any>('/transactions/smart-sale', payload);

    if (paymentMode.value === 'mpesa_stk' && result.checkoutRequestId) {
      isSubmitting.value = false;
      startStkPolling(result.checkoutRequestId);
      pushToast({ message: result.customerMessage || 'M-Pesa prompt sent to customer phone', variant: 'info' });
      return;
    }

    const successMsg =
      paymentMode.value === 'credit'
        ? 'Sale recorded on credit (debt balance updated)'
        : paymentMode.value === 'cash'
          ? 'Cash sale recorded & settled'
          : 'M-Pesa sale recorded & settled';

    pushToast({ message: successMsg, variant: 'success' });
    emit('success', result);
    emit('close');
  } catch (err: any) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to record sale', variant: 'error' });
  } finally {
    if (paymentMode.value !== 'mpesa_stk') {
      isSubmitting.value = false;
    }
  }
}
</script>

<template>
  <Modal :open="open" title="Point of Sale — Record Sale" :persistent="isAwaitingStk" @close="emit('close')">
    <!-- View 1: Active POS Entry Form -->
    <div v-if="!isAwaitingStk" class="smart-pos-form">
      <!-- 1. CUSTOMER SELECTION OR INLINE QUICK-ADD -->
      <div class="pos-section card">
        <div class="section-top-row">
          <label class="section-label">
            <User :size="15" class="text-ink" />
            <span>Customer *</span>
          </label>

          <button
            v-if="!props.preselectedCustomerId"
            type="button"
            class="toggle-new-cust-btn"
            @click="isNewCustomer = !isNewCustomer"
          >
            <component :is="isNewCustomer ? User : UserPlus" :size="13" />
            <span>{{ isNewCustomer ? 'Select Existing' : '+ New Customer' }}</span>
          </button>
        </div>

        <!-- Mode A: Select Existing Customer -->
        <div v-if="!isNewCustomer" class="customer-picker-wrap">
          <select v-model="customerId" class="form-select" :disabled="!!props.preselectedCustomerId">
            <option value="" disabled>Search or select customer...</option>
            <option v-for="c in customersStore.list" :key="c.id" :value="c.id">
              {{ c.name }} {{ c.phone ? `(${c.phone})` : '' }}
            </option>
          </select>
        </div>

        <!-- Mode B: Quick Create Customer Inline -->
        <div v-else class="new-customer-inline-fields">
          <div class="form-group">
            <input
              v-model="newCustomerName"
              type="text"
              placeholder="Customer Full Name *"
              class="form-input"
              autofocus
            />
          </div>
          <div class="form-group">
            <PhoneInput v-model="newCustomerPhone" placeholder="07XXXXXXXX (Optional)" />
          </div>
        </div>
      </div>

      <!-- 2. CATALOG PRODUCT & VARIANT PICKER (Optional) -->
      <div class="pos-section card">
        <div class="section-top-row">
          <label class="section-label">
            <Tag :size="15" class="text-ink" />
            <span>Catalog Product (Optional)</span>
          </label>
        </div>

        <select v-model="selectedProductId" class="form-select">
          <option value="">Custom / Non-Catalog Item</option>
          <option v-for="p in productsStore.list" :key="p.id" :value="p.id">
            {{ p.name }} (KES {{ parseFloat(p.price).toLocaleString('en-KE') }})
          </option>
        </select>

        <!-- Variant Selector if Product has Variants -->
        <div v-if="productVariantsList.length > 0" class="variants-picker-box">
          <label class="field-micro-label">
            <Layers :size="12" /> Select Option / Variant:
          </label>
          <div class="variant-chips-row">
            <button
              v-for="v in productVariantsList"
              :key="v.id"
              type="button"
              class="variant-chip-btn"
              :class="{ 'variant-chip-btn--active': selectedVariantId === v.id }"
              @click="handleVariantSelect(v.id || '')"
            >
              <span>{{ v.title }}</span>
              <span class="chip-price tabular-figure">KES {{ parseFloat(String(v.price)).toLocaleString('en-KE') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 3. SALE AMOUNT WITH QUICK-CHIPS -->
      <div class="pos-section card">
        <label class="section-label">
          <span>Sale Amount (KES) *</span>
        </label>
        <CurrencyInput v-model="amount" :show-quick-chips="true" />
      </div>

      <!-- 4. MULTI-CHANNEL SETTLEMENT CHOICES -->
      <div class="pos-section card">
        <label class="section-label">
          <span>Payment &amp; Settlement *</span>
        </label>

        <div class="settlement-pills-grid">
          <button
            type="button"
            class="settlement-pill"
            :class="{ 'settlement-pill--active settlement-pill--credit': paymentMode === 'credit' }"
            @click="paymentMode = 'credit'"
          >
            <div class="pill-dot"></div>
            <div class="pill-text">
              <span class="pill-title">Sell on Credit</span>
              <span class="pill-desc">Customer owes balance</span>
            </div>
          </button>

          <button
            type="button"
            class="settlement-pill"
            :class="{ 'settlement-pill--active settlement-pill--cash': paymentMode === 'cash' }"
            @click="paymentMode = 'cash'"
          >
            <Banknote :size="16" />
            <div class="pill-text">
              <span class="pill-title">Cash in Hand</span>
              <span class="pill-desc">Settled immediately</span>
            </div>
          </button>

          <button
            type="button"
            class="settlement-pill"
            :class="{ 'settlement-pill--active settlement-pill--mpesa': paymentMode === 'mpesa_manual' }"
            @click="paymentMode = 'mpesa_manual'"
          >
            <CreditCard :size="16" />
            <div class="pill-text">
              <span class="pill-title">M-Pesa (Manual)</span>
              <span class="pill-desc">Sent to Till / Phone</span>
            </div>
          </button>

          <button
            type="button"
            class="settlement-pill"
            :class="{ 'settlement-pill--active settlement-pill--stk': paymentMode === 'mpesa_stk' }"
            @click="paymentMode = 'mpesa_stk'"
          >
            <Zap :size="16" />
            <div class="pill-text">
              <span class="pill-title">M-Pesa STK Push</span>
              <span class="pill-desc">Instant PIN prompt</span>
            </div>
          </button>
        </div>

        <div v-if="paymentMode === 'mpesa_manual'" class="conditional-field-wrap">
          <input
            v-model="mpesaRef"
            type="text"
            placeholder="M-Pesa Confirmation Code (e.g. SH12AB34CD)"
            class="form-input font-mono uppercase"
          />
        </div>

        <div v-if="paymentMode === 'mpesa_stk'" class="conditional-field-wrap">
          <label class="field-micro-label">Customer M-Pesa Phone Number:</label>
          <PhoneInput v-model="stkPhone" placeholder="07XXXXXXXX" />
        </div>
      </div>

      <!-- 5. OPTIONAL DESCRIPTION / LINE ITEMS -->
      <div class="form-group">
        <label class="field-micro-label">Items / Description (Optional)</label>
        <input
          v-model="description"
          type="text"
          placeholder="e.g. 2 pair running shoes, 1 handbag"
          class="form-input"
        />
      </div>
    </div>

    <!-- View 2: STK Push 60-Second Real-Time Countdown Modal -->
    <div v-else class="stk-waiting-view">
      <div class="timer-display-box">
        <Clock :size="32" class="text-gold spin-slow" />
        <span class="timer-digits font-mono">{{ stkCountdown }}s</span>
      </div>

      <div class="waiting-copy">
        <h3 class="waiting-title">STK Push Sent to Customer</h3>
        <p class="waiting-desc">
          Ask the customer to check their phone and enter their <strong>M-Pesa PIN</strong> to complete KES {{ amount.toLocaleString('en-KE') }}.
        </p>
      </div>

      <div v-if="!stkFailed" class="pulse-status-bar">
        <span class="pulse-dot"></span> Awaiting Safaricom confirmation...
      </div>

      <div v-else class="stk-failed-alert">
        <AlertCircle :size="16" class="text-clay" />
        <div>
          <span class="failed-bold">Prompt timed out or was cancelled.</span>
          <p class="failed-hint">You can retry the STK push or record the transaction as Cash or Credit.</p>
        </div>
      </div>
    </div>

    <template #footer>
      <template v-if="!isAwaitingStk">
        <Button variant="ghost" @click="emit('close')">Cancel</Button>
        <Button
          variant="primary"
          :disabled="!canSubmit || isSubmitting"
          :loading="isSubmitting"
          @click="handleSubmit"
        >
          {{ paymentMode === 'mpesa_stk' ? 'Send STK Prompt' : 'Record & Complete Sale' }}
        </Button>
      </template>

      <template v-else-if="stkFailed">
        <Button variant="ghost" @click="isAwaitingStk = false">Back to Edit</Button>
        <Button variant="primary" @click="handleSubmit">
          <RotateCcw :size="14" /> Retry STK Push
        </Button>
      </template>
    </template>
  </Modal>
</template>

<style scoped>
.smart-pos-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.pos-section {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.section-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.toggle-new-cust-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 700;
  color: var(--brand-primary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
}
.toggle-new-cust-btn:hover {
  border-color: var(--brand-primary);
}

.new-customer-inline-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: 2px;
}

.variants-picker-box {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: 2px;
}

.variant-chips-row {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.variant-chip-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 3px var(--space-3);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
}
.variant-chip-btn:hover {
  border-color: var(--color-ink);
}

.variant-chip-btn--active {
  border-color: var(--brand-primary);
  background: color-mix(in srgb, var(--brand-primary) 8%, var(--color-surface));
  color: var(--brand-primary);
}

.chip-price {
  font-weight: 800;
}

.settlement-pills-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
  margin-top: 2px;
}

@media (max-width: 480px) {
  .settlement-pills-grid {
    grid-template-columns: 1fr;
  }
}

.settlement-pill {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  cursor: pointer;
  text-align: left;
  transition: all var(--duration-fast) var(--ease-standard);
}

.settlement-pill:hover {
  border-color: var(--color-ink);
}

.settlement-pill--active {
  background: color-mix(in srgb, var(--brand-primary) 8%, var(--color-surface));
  border-color: var(--brand-primary);
}

.settlement-pill--credit.settlement-pill--active {
  border-color: var(--color-market-clay);
  background: color-mix(in srgb, var(--color-market-clay) 8%, var(--color-surface));
}

.settlement-pill--cash.settlement-pill--active {
  border-color: var(--color-ledger-green);
  background: color-mix(in srgb, var(--color-ledger-green) 8%, var(--color-surface));
}

.pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-market-clay);
  flex-shrink: 0;
}

.pill-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.pill-title {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-text);
}

.pill-desc {
  font-size: 10px;
  color: var(--color-text-muted);
}

.conditional-field-wrap {
  margin-top: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-micro-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.form-input, .form-select {
  width: 100%;
  min-height: 42px;
  padding: 0 var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-text);
  outline: none;
}
.form-input:focus, .form-select:focus {
  border-color: var(--color-ink);
}

.uppercase { text-transform: uppercase; }

/* STK Waiting State View */
.stk-waiting-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-6) var(--space-4);
  gap: var(--space-4);
}

.timer-display-box {
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
  color: var(--color-text);
}

.waiting-title {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-text);
}

.waiting-desc {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  max-width: 340px;
  line-height: var(--leading-relaxed);
  margin-top: 4px;
}

.pulse-status-bar {
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

.stk-failed-alert {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  background: color-mix(in srgb, var(--color-market-clay) 12%, transparent);
  border: 1px solid var(--color-market-clay);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  text-align: left;
}

.failed-bold {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-market-clay);
  display: block;
}

.failed-hint {
  font-size: 11px;
  color: var(--color-text);
  margin-top: 2px;
}

.spin-slow {
  animation: spin 3s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.text-gold { color: var(--color-gold); }
.text-clay { color: var(--color-market-clay);}
</style>