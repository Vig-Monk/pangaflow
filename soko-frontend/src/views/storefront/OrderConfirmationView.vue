<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/storefront/OrderConfirmationView.vue
// Live customer tracking: 60s M-Pesa countdown, NATO phonetic code & WhatsApp relay.
// =============================================================================

import { onMounted, onUnmounted, ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { apiGet } from '@/services/apiClient';
import { useToast } from '@/composables/useToast';
import Skeleton from '@/components/ui/Skeleton.vue';
import Button from '@/components/ui/Button.vue';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Bike,
  Store,
  MapPin,
  KeyRound,
  Share2,
  Check,
  Copy,
  Volume2,
} from 'lucide-vue-next';

interface PublicOrderDetails {
  orderId: string;
  customerName: string;
  total: number;
  status: 'pending' | 'confirmed' | 'assigned' | 'out_for_delivery' | 'delivered' | 'cancelled';
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed';
  mpesaReceiptNumber: string | null;
  checkoutRequestId?: string | null;
  deliveryType: 'delivery' | 'pickup';
  deliveryFee: number;
  deliveryFeeStatus: 'known' | 'needs_merchant_confirmation';
  deliveryConfirmationCode: string | null;
  deliveryLocation: string;
  items: Array<{
    productName: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
  }>;
}

const route = useRoute();
const router = useRouter();
const { push: pushToast } = useToast();

const orderDetails = ref<PublicOrderDetails | null>(null);
const loading = ref(true);
const loadError = ref(false);

const isPolling = ref(false);
let pollInterval: ReturnType<typeof setInterval> | undefined;

// 60-second M-Pesa countdown timer state
const countdownSeconds = ref(60);
const timerExpired = ref(false);
let timerInterval: ReturnType<typeof setInterval> | undefined;

// Clipboard feedback
const isCodeCopied = ref(false);

const storeSlug = computed(() => (route.params.storeSlug as string || '').toLowerCase().trim());
const orderId = computed(() => (route.params.orderId as string || '').trim());

const isDirectMpesa = computed(() => {
  const method = orderDetails.value?.paymentMethod;
  return method === 'mpesa_direct' || method === 'mpesa';
});

const isAwaitingPin = computed(() => {
  return isDirectMpesa.value && orderDetails.value?.paymentStatus === 'pending';
});

const isPaymentSuccessful = computed(() => {
  return orderDetails.value?.paymentStatus === 'paid';
});

const isPaymentFailed = computed(() => {
  return isDirectMpesa.value && orderDetails.value?.paymentStatus === 'failed';
});

const isOutForDelivery = computed(() => {
  return orderDetails.value?.status === 'out_for_delivery';
});

// Stepper Progress Index (0 to 3)
const currentStepIndex = computed(() => {
  if (!orderDetails.value) return 0;
  switch (orderDetails.value.status) {
    case 'pending':
      return 0;
    case 'confirmed':
    case 'assigned':
      return 1;
    case 'out_for_delivery':
      return 2;
    case 'delivered':
      return 3;
    default:
      return 0;
  }
});

// NATO Phonetic Alphabet & Digit mapping
const NATO_PHONETIC_MAP: Record<string, string> = {
  '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine',
  'A': 'Alpha', 'B': 'Bravo', 'C': 'Charlie', 'D': 'Delta', 'E': 'Echo', 'F': 'Foxtrot',
  'G': 'Golf', 'H': 'Hotel', 'J': 'Juliet', 'K': 'Kilo', 'L': 'Lima', 'M': 'Mike',
  'N': 'November', 'P': 'Papa', 'Q': 'Quebec', 'R': 'Romeo', 'S': 'Sierra', 'T': 'Tango',
  'U': 'Uniform', 'V': 'Victor', 'W': 'Whiskey', 'X': 'X-ray', 'Y': 'Yankee', 'Z': 'Zulu',
};

const phoneticSpelling = computed(() => {
  const code = orderDetails.value?.deliveryConfirmationCode;
  if (!code) return '';
  return code
    .toUpperCase()
    .split('')
    .map((c) => NATO_PHONETIC_MAP[c] || c)
    .join('  —  ');
});

const formattedCode = computed(() => {
  const code = orderDetails.value?.deliveryConfirmationCode;
  if (!code) return '';
  return code.split('').join('  •  ');
});

// SVG Circular timer offset calculation (r=20, circumference ≈ 125.66)
const circleDashOffset = computed(() => {
  const circumference = 2 * Math.PI * 20;
  const progress = countdownSeconds.value / 60;
  return circumference * (1 - progress);
});

// WhatsApp Share Deep Link for Customer
const whatsappShareUrl = computed(() => {
  if (!orderDetails.value) return '#';
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const message = [
    `*📦 Soko Order #${orderDetails.value.orderId.slice(0, 8).toUpperCase()}*`,
    `Customer: ${orderDetails.value.customerName}`,
    `Total: KES ${Number(orderDetails.value.total).toLocaleString('en-KE')}`,
    `Status: ${orderDetails.value.status.toUpperCase()}`,
    `Track your order live here: ${url}`,
  ].join('\n');

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
});

function copyConfirmationCode(): void {
  const code = orderDetails.value?.deliveryConfirmationCode;
  if (!code) return;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(code);
    isCodeCopied.value = true;
    pushToast({ message: 'Confirmation code copied', variant: 'success' });
    setTimeout(() => {
      isCodeCopied.value = false;
    }, 2000);
  }
}

function startCountdownTimer(): void {
  stopCountdownTimer();
  countdownSeconds.value = 60;
  timerExpired.value = false;

  timerInterval = setInterval(() => {
    if (countdownSeconds.value > 0) {
      countdownSeconds.value--;
    } else {
      timerExpired.value = true;
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

async function fetchOrderDetails(): Promise<void> {
  try {
    const data = await apiGet<PublicOrderDetails>(
      `/public/stores/${storeSlug.value}/orders/${orderId.value}`
    );
    orderDetails.value = data;
    loading.value = false;

    if (data.paymentStatus === 'pending' && (data.paymentMethod === 'mpesa_direct' || data.paymentMethod === 'mpesa')) {
      startCountdownTimer();
    }

    if (data.status !== 'delivered' && data.status !== 'cancelled') {
      startPolling();
    }
  } catch {
    loadError.value = true;
    loading.value = false;
  }
}

function startPolling(): void {
  stopPolling();
  isPolling.value = true;

  pollInterval = setInterval(async () => {
    try {
      const updated = await apiGet<PublicOrderDetails>(
        `/public/stores/${storeSlug.value}/orders/${orderId.value}`
      );
      orderDetails.value = updated;

      if (updated.paymentStatus === 'paid') {
        stopCountdownTimer();
      }

      if (updated.status === 'delivered' || updated.status === 'cancelled') {
        stopPolling();
        stopCountdownTimer();
      }
    } catch {
      stopPolling();
    }
  }, 3500);
}

function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = undefined;
  }
  isPolling.value = false;
}

watch(
  () => orderDetails.value?.paymentStatus,
  (status) => {
    if (status === 'paid' || status === 'failed') {
      stopCountdownTimer();
    }
  }
);

onMounted(() => {
  fetchOrderDetails();
});

onUnmounted(() => {
  stopPolling();
  stopCountdownTimer();
});

function formatCurrency(value: number): string {
  return `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function handleContinueShopping(): void {
  router.push({ name: 'storefront-home', params: { storeSlug: storeSlug.value } });
}
</script>

<template>
  <div class="confirmation-page">
    <div class="confirm-container card">
      <!-- 1. SKELETON LOADING STATE -->
      <div v-if="loading" class="skeleton-wrap">
        <Skeleton height="40px" width="50%" />
        <Skeleton height="20px" width="80%" />
        <Skeleton height="140px" />
      </div>

      <!-- 2. LOAD ERROR STATE -->
      <div v-else-if="loadError" class="error-box">
        <AlertTriangle :size="36" class="text-clay" />
        <h2 class="error-title">Order Unavailable</h2>
        <p class="error-desc">We could not load your order confirmation. Please contact the merchant directly with your order reference number.</p>
        <Button variant="secondary" @click="handleContinueShopping" style="margin-top: var(--space-4);">
          Back to Store
        </Button>
      </div>

      <!-- 3. LIVE ORDER CONFIRMATION VIEW -->
      <template v-else-if="orderDetails">
        <!-- A. 60-Second Dynamic M-Pesa PIN Countdown Banner -->
        <div v-if="isAwaitingPin" class="pin-waiting-banner">
          <div class="timer-gauge-wrap">
            <svg class="countdown-svg" width="48" height="48" viewBox="0 0 48 48">
              <circle class="timer-bg-circle" cx="24" cy="24" r="20" />
              <circle
                class="timer-progress-circle"
                cx="24"
                cy="24"
                r="20"
                :style="{ strokeDashoffset: circleDashOffset }"
              />
            </svg>
            <span class="countdown-num tabular-figure">{{ countdownSeconds }}</span>
          </div>

          <div class="pin-waiting-text">
            <h2>M-Pesa PIN Prompt Sent</h2>
            <p>
              Please enter your <strong>M-Pesa PIN</strong> on your phone ({{ countdownSeconds }}s remaining) to pay
              <strong>{{ formatCurrency(orderDetails.total) }}</strong>.
            </p>

            <div v-if="!timerExpired" class="pulse-indicator">
              <span class="pulse-dot"></span> Awaiting Safaricom confirmation...
            </div>

            <div v-else class="timer-expired-actions">
              <span class="expired-label">Prompt expired or didn't arrive?</span>
              <p class="fallback-note">Your order has been recorded. You can pay the merchant or rider directly upon delivery.</p>
            </div>
          </div>
        </div>

        <!-- B. Payment Failed Banner -->
        <div v-else-if="isPaymentFailed" class="payment-failed-banner">
          <AlertTriangle :size="24" class="text-clay" />
          <div class="failed-text">
            <h2>Payment Incomplete</h2>
            <p>The M-Pesa prompt was cancelled or timed out. Your order has been placed as <em>Pending Payment</em>.</p>
            <p class="sub-hint">The merchant will coordinate payment upon handover.</p>
          </div>
        </div>

        <!-- C. Success Header -->
        <div v-else class="success-banner">
          <CheckCircle2 :size="44" class="text-teal" />
          <h1 class="success-title">Thank You, {{ orderDetails.customerName }}!</h1>
          <p class="success-subtitle">
            <template v-if="isPaymentSuccessful">
              Your payment is verified. Your order is confirmed and being prepared.
            </template>
            <template v-else>
              Your order has been received. The merchant has been notified.
            </template>
          </p>
        </div>

        <!-- D. LIVE FULFILLMENT STEPPER -->
        <div class="fulfillment-stepper-card">
          <div class="stepper-track">
            <div
              v-for="(stepName, idx) in [
                'Order Placed',
                orderDetails.deliveryType === 'delivery' ? 'Confirmed' : 'Preparing',
                orderDetails.deliveryType === 'delivery' ? 'On the Way' : 'Ready',
                orderDetails.deliveryType === 'delivery' ? 'Delivered' : 'Collected',
              ]"
              :key="idx"
              class="stepper-node"
              :class="{
                'node-completed': idx < currentStepIndex,
                'node-active': idx === currentStepIndex,
              }"
            >
              <div class="node-circle">
                <Check v-if="idx < currentStepIndex" :size="12" />
                <span v-else>{{ idx + 1 }}</span>
              </div>
              <span class="node-label">{{ stepName }}</span>
            </div>
          </div>
        </div>

        <!-- E. DELIVERY CONFIRMATION CODE CARD (High-Contrast & NATO Phonetic Guide) -->
        <div v-if="orderDetails.deliveryConfirmationCode && isOutForDelivery" class="delivery-code-banner">
          <div class="code-banner-header">
            <KeyRound :size="18" class="text-gold" />
            <span class="code-banner-title">Delivery Confirmation Code</span>
          </div>

          <div class="code-interactive-row">
            <div class="code-display-box">
              <span class="code-number">{{ formattedCode }}</span>
            </div>

            <button
              type="button"
              class="copy-code-btn"
              :class="{ 'copy-code-btn--copied': isCodeCopied }"
              @click="copyConfirmationCode"
            >
              <component :is="isCodeCopied ? Check : Copy" :size="14" />
              <span>{{ isCodeCopied ? 'Copied' : 'Copy' }}</span>
            </button>
          </div>

          <div v-if="phoneticSpelling" class="phonetic-helper-row">
            <Volume2 :size="13" class="text-muted" />
            <span class="phonetic-text">Pronounced: <strong>{{ phoneticSpelling }}</strong></span>
          </div>

          <p class="code-instruction">
            Give this 4-digit code to the rider when your package arrives to verify handover.
          </p>
        </div>

        <!-- F. RECEIPT & METADATA -->
        <div class="receipt-section">
          <div class="receipt-header">
            <div class="receipt-meta-item">
              <span class="meta-label">Order Reference</span>
              <span class="meta-value mono-text">#{{ orderDetails.orderId.slice(0, 8).toUpperCase() }}</span>
            </div>

            <div class="receipt-meta-item">
              <span class="meta-label">Fulfillment</span>
              <span class="fulfillment-badge" :class="`fulfillment-badge--${orderDetails.deliveryType}`">
                <component :is="orderDetails.deliveryType === 'delivery' ? Bike : Store" :size="12" />
                {{ orderDetails.deliveryType === 'delivery' ? 'Doorstep Delivery' : 'Store Pickup' }}
              </span>
            </div>

            <div class="receipt-meta-item">
              <span class="meta-label">Payment Status</span>
              <span v-if="isPaymentSuccessful" class="status-pill status-pill--paid">
                <CheckCircle2 :size="12" /> PAID
              </span>
              <span v-else-if="isPaymentFailed" class="status-pill status-pill--failed">
                <AlertTriangle :size="12" /> FAILED
              </span>
              <span v-else class="status-pill status-pill--pending">
                <Clock :size="12" /> PENDING
              </span>
            </div>
          </div>

          <!-- M-Pesa Receipt Number (If available) -->
          <div v-if="orderDetails.mpesaReceiptNumber" class="mpesa-receipt-badge">
            <ShieldCheck :size="15" class="text-teal" />
            <span>M-Pesa Receipt: <strong>{{ orderDetails.mpesaReceiptNumber }}</strong></span>
          </div>

          <!-- Destination Address / Pickup Hub Info -->
          <div class="destination-card">
            <MapPin :size="16" class="text-muted" />
            <div class="dest-text">
              <span class="dest-label">{{ orderDetails.deliveryType === 'delivery' ? 'Delivery Destination' : 'Pickup Store Hub' }}</span>
              <p class="dest-val">{{ orderDetails.deliveryLocation }}</p>
            </div>
          </div>

          <!-- Line Items List -->
          <div class="receipt-items-list">
            <div v-for="(item, idx) in orderDetails.items" :key="idx" class="receipt-row">
              <span class="item-desc">{{ item.productName }} <span class="text-muted">× {{ item.quantity }}</span></span>
              <span class="tabular-figure">{{ formatCurrency(item.subtotal) }}</span>
            </div>

            <div v-if="orderDetails.deliveryType === 'delivery'" class="receipt-row">
              <span class="item-desc">Delivery Fee</span>
              <span v-if="orderDetails.deliveryFeeStatus === 'known'" class="tabular-figure">
                {{ formatCurrency(orderDetails.deliveryFee) }}
              </span>
              <span v-else class="text-muted text-xs">Confirmed with Merchant</span>
            </div>

            <div class="receipt-row receipt-row--total">
              <span class="total-label">Total Amount</span>
              <span class="total-amount tabular-figure text-ink">{{ formatCurrency(orderDetails.total) }}</span>
            </div>
          </div>
        </div>

        <!-- G. WHATSAPP TRACKING SHARE & ACTIONS -->
        <div class="actions-footer">
          <a :href="whatsappShareUrl" target="_blank" rel="noopener" class="whatsapp-share-btn">
            <Share2 :size="16" /> Save Order Link to WhatsApp
          </a>

          <Button variant="primary" size="lg" class="continue-btn" @click="handleContinueShopping">
            <ShoppingBag :size="18" /> Continue Shopping <ArrowRight :size="16" />
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.confirmation-page {
  padding: var(--space-8) var(--space-4);
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.confirm-container {
  max-width: 620px;
  width: 100%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-8) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.skeleton-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.error-box {
  text-align: center;
  padding: var(--space-8) 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.error-title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
}

.error-desc {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  max-width: 440px;
  line-height: var(--leading-relaxed);
}

/* Success Banner */
.success-banner {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-4);
}

.success-title {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  color: var(--color-text);
}

.success-subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  max-width: 480px;
  line-height: var(--leading-normal);
}

/* 60s Animated Circular Timer */
.pin-waiting-banner {
  background: color-mix(in srgb, var(--color-gold) 10%, var(--color-surface));
  border: 1px solid var(--color-gold);
  border-radius: var(--radius-md);
  padding: var(--space-4) var(--space-5);
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
}

.timer-gauge-wrap {
  position: relative;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.countdown-svg {
  transform: rotate(-90deg);
}

.timer-bg-circle {
  fill: none;
  stroke: color-mix(in srgb, var(--color-gold) 20%, transparent);
  stroke-width: 3.5;
}

.timer-progress-circle {
  fill: none;
  stroke: var(--color-gold-hover);
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-dasharray: 125.66;
  transition: stroke-dashoffset 1s linear;
}

.countdown-num {
  position: absolute;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 800;
  color: var(--color-text);
}

.pin-waiting-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pin-waiting-text h2 {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-text);
}

.pin-waiting-text p {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: var(--leading-normal);
}

.pulse-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 11px;
  font-weight: 700;
  color: var(--color-gold-hover);
  margin-top: var(--space-2);
}

.pulse-dot {
  width: 7px;
  height: 7px;
  background: var(--color-gold);
  border-radius: 50%;
  animation: pulse-ring 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse-ring {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.3); }
}

.timer-expired-actions {
  margin-top: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.expired-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-market-clay);
}

.fallback-note {
  font-size: 11px !important;
  color: var(--color-text-muted) !important;
}

/* Payment Failed Banner */
.payment-failed-banner {
  background: color-mix(in srgb, var(--color-market-clay) 12%, transparent);
  border: 1px solid var(--color-market-clay);
  border-radius: var(--radius-md);
  padding: var(--space-4) var(--space-5);
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.failed-text h2 {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-market-clay);
}

.failed-text p {
  font-size: var(--text-xs);
  color: var(--color-text);
  margin-top: 2px;
}

.sub-hint {
  color: var(--color-text-muted) !important;
}

/* Live Stepper */
.fulfillment-stepper-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4) var(--space-3);
}

.stepper-track {
  display: flex;
  justify-content: space-between;
  position: relative;
}

.stepper-node {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  text-align: center;
  position: relative;
}

.stepper-node:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 11px;
  left: 50%;
  width: 100%;
  height: 2px;
  background: var(--color-border);
  z-index: 1;
}

.node-completed:not(:last-child)::after {
  background: var(--color-ledger-green);
}

.node-circle {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  z-index: 2;
  color: var(--color-text-muted);
}

.node-completed .node-circle {
  background: var(--color-ledger-green);
  border-color: var(--color-ledger-green);
  color: #FFFFFF;
}
.node-active .node-circle {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  color: #FFFFFF;
}

.node-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.node-active .node-label {
  color: var(--color-text);
  font-weight: 700;
}

/* Confirmation Code Banner */
.delivery-code-banner {
  background: color-mix(in srgb, var(--brand-primary) 8%, var(--color-surface));
  border: 2px dashed var(--brand-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-2);
}

.code-banner-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text);
}

.code-interactive-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.code-display-box {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-md);
}

.code-number {
  font-family: var(--font-mono);
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: 0.2rem;
  color: var(--brand-primary);
}

.copy-code-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
}
.copy-code-btn:hover {
  border-color: var(--color-ink);
}
.copy-code-btn--copied {
  background: var(--color-ledger-green);
  color: #FFFFFF;
  border-color: var(--color-ledger-green);
}

.phonetic-helper-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 11px;
  color: var(--color-text-muted);
  background: var(--color-surface);
  padding: 2px var(--space-3);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
}

.code-instruction {
  font-size: var(--text-xs);
  color: var(--color-text);
  max-width: 420px;
  line-height: var(--leading-normal);
  margin-top: var(--space-1);
}

/* Receipt Details */
.receipt-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.receipt-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-3);
  flex-wrap: wrap;
  gap: var(--space-2);
}

.receipt-meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 10px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
}

.meta-value {
  font-size: var(--text-xs);
  font-weight: 700;
}

.mono-text {
  font-family: var(--font-mono);
}

.fulfillment-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
}

.fulfillment-badge--pickup {
  color: var(--color-ledger-green);
  border-color: color-mix(in srgb, var(--color-ledger-green) 30%, transparent);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 700;
}
.status-pill--paid { background: color-mix(in srgb, var(--color-ledger-green) 15%, transparent); color: var(--color-ledger-green); }
.status-pill--failed { background: color-mix(in srgb, var(--color-market-clay) 15%, transparent); color: var(--color-market-clay); }
.status-pill--pending { background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text-muted); }
.destination-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
}

.dest-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-text-muted);
  display: block;
}

.dest-val {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text);
  margin-top: 1px;
}

.mpesa-receipt-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: color-mix(in srgb, var(--color-ledger-green) 10%, transparent);
  border: 1px solid var(--color-ledger-green);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  color: var(--color-text);
}

.receipt-items-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.receipt-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.receipt-row--total {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-text);
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-3);
  margin-top: var(--space-1);
}

.total-amount {
  color: var(--color-ink);
}

/* Actions Footer */
.actions-footer {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.whatsapp-share-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background: color-mix(in srgb, var(--color-ledger-green) 12%, transparent);
  color: var(--color-ledger-green);
  border: 1px solid var(--color-ledger-green);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  font-size: var(--text-sm);
  font-weight: 700;
  text-decoration: none;
  transition: all var(--duration-fast) var(--ease-standard);
}

.whatsapp-share-btn:hover {
  background: var(--color-ledger-green);
  color: #FFFFFF;
}

.continue-btn {
  width: 100%;
}

.text-teal { color: var(--color-ledger-green); }
.text-gold { color: var(--color-gold); }
.text-clay { color: var(--color-market-clay); }
.text-ink { color: var(--color-ink); }
</style>
