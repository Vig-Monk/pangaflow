<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/storefront/OrderConfirmationView.vue
// =============================================================================

import { onMounted, onUnmounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { apiGet } from '@/services/apiClient';
import Skeleton from '@/components/ui/Skeleton.vue';
import Button from '@/components/ui/Button.vue';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
} from 'lucide-vue-next';

interface PublicOrderDetails {
  orderId: string;
  customerName: string;
  total: number;
  status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled';
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed';
  mpesaReceiptNumber: string | null;
  checkoutRequestId?: string | null;
  items: Array<{
    productName: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
  }>;
}

const route = useRoute();
const router = useRouter();

const orderDetails = ref<PublicOrderDetails | null>(null);
const loading = ref(true);
const loadError = ref(false);

const isPolling = ref(false);
let pollInterval: ReturnType<typeof setInterval> | undefined;
let pollAttempts = 0;

const storeSlug = computed(() => (route.params.storeSlug as string) ?? '');
const orderId = computed(() => (route.params.orderId as string) ?? '');

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

async function fetchOrderDetails(): Promise<void> {
  try {
    const data = await apiGet<PublicOrderDetails>(
      `/public/stores/${storeSlug.value}/orders/${orderId.value}`
    );
    orderDetails.value = data;
    loading.value = false;

    // Start real-time polling if customer is expected to enter their PIN
    if (data.paymentStatus === 'pending' && (data.paymentMethod === 'mpesa_direct' || data.paymentMethod === 'mpesa')) {
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
  pollAttempts = 0;

  pollInterval = setInterval(async () => {
    pollAttempts++;
    try {
      const updated = await apiGet<PublicOrderDetails>(
        `/public/stores/${storeSlug.value}/orders/${orderId.value}`
      );
      orderDetails.value = updated;

      // Stop once finalized or if timed out after 60s
      if (updated.paymentStatus === 'paid' || updated.paymentStatus === 'failed' || pollAttempts >= 20) {
        stopPolling();
      }
    } catch {
      stopPolling();
    }
  }, 3000);
}

function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = undefined;
  }
  isPolling.value = false;
}

onMounted(() => {
  fetchOrderDetails();
});

onUnmounted(() => {
  stopPolling();
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
      <!-- Loading Skeleton -->
      <div v-if="loading" class="skeleton-wrap">
        <Skeleton height="40px" width="40%" />
        <Skeleton height="20px" width="70%" />
        <Skeleton height="150px" />
      </div>

      <!-- Load Error Box -->
      <div v-else-if="loadError" class="error-box">
        <span class="error-icon">⚠️</span>
        <h2 class="error-title">Order Confirmation Unavailable</h2>
        <p class="error-desc">We could not load your order confirmation. Please contact the merchant directly with your order number.</p>
        <Button variant="secondary" @click="handleContinueShopping" style="margin-top: var(--space-4);">
          Back to Store
        </Button>
      </div>

      <template v-else-if="orderDetails">
        <!-- 1. Real-time Awaiting M-Pesa PIN Card -->
        <div v-if="isAwaitingPin" class="pin-waiting-banner">
          <div class="pin-waiting-icon-wrap">
            <RefreshCw :size="28" class="spin-icon text-gold" />
          </div>
          <div class="pin-waiting-text">
            <h2>M-Pesa Prompt Sent</h2>
            <p>Please check your phone and enter your <strong>M-Pesa PIN</strong> to complete payment of <strong>{{ formatCurrency(orderDetails.total) }}</strong>.</p>
            <span class="pulse-indicator">
              <span class="pulse-dot"></span> Waiting for confirmation...
            </span>
          </div>
        </div>

        <!-- 2. Payment Failed / Cancelled State -->
        <div v-else-if="isPaymentFailed" class="payment-failed-banner">
          <div class="failed-icon-wrap">
            <AlertTriangle :size="28" class="text-clay" />
          </div>
          <div class="failed-text">
            <h2>Payment Incomplete</h2>
            <p>The M-Pesa payment prompt was cancelled or timed out. Your order has been placed as <em>Pending Payment</em>.</p>
            <p class="merchant-coord-hint">The merchant will contact you to coordinate completion of your order.</p>
          </div>
        </div>

        <!-- 3. Success Header -->
        <div v-else class="success-banner">
          <CheckCircle2 :size="48" class="text-teal" />
          <h1 class="success-title">Thank You, {{ orderDetails.customerName }}!</h1>
          <p class="success-subtitle">
            <template v-if="isPaymentSuccessful">
              Your payment has been received and verified. Your order is confirmed!
            </template>
            <template v-else>
              Your order has been placed. We have sent your order details to the merchant.
            </template>
          </p>
        </div>

        <!-- Receipt & Summary Section -->
        <div class="receipt-section">
          <div class="receipt-header">
            <div class="receipt-meta-item">
              <span class="meta-label">Order Reference</span>
              <span class="meta-value mono-text">#{{ orderDetails.orderId.slice(0, 8).toUpperCase() }}</span>
            </div>
            <div class="receipt-meta-item">
              <span class="meta-label">Payment Status</span>
              <span v-if="isPaymentSuccessful" class="status-pill status-pill--paid">
                <CheckCircle2 :size="12" /> PAID
              </span>
              <span v-else-if="isPaymentFailed" class="status-pill status-pill--failed">
                <AlertTriangle :size="12" /> PAYMENT FAILED
              </span>
              <span v-else class="status-pill status-pill--pending">
                <Clock :size="12" /> PENDING
              </span>
            </div>
          </div>

          <!-- M-Pesa Receipt Number Badge -->
          <div v-if="orderDetails.mpesaReceiptNumber" class="mpesa-receipt-badge">
            <ShieldCheck :size="16" class="text-teal" />
            <span>M-Pesa Receipt: <strong>{{ orderDetails.mpesaReceiptNumber }}</strong></span>
          </div>

          <!-- Line Items List -->
          <div class="receipt-items-list">
            <div v-for="(item, idx) in orderDetails.items" :key="idx" class="receipt-row">
              <span class="item-desc">{{ item.productName }} <span class="text-muted">× {{ item.quantity }}</span></span>
              <span class="tabular-figure">{{ formatCurrency(item.subtotal) }}</span>
            </div>
            
            <div class="receipt-row receipt-row--total">
              <span class="total-label">Total Amount</span>
              <span class="total-amount tabular-figure">{{ formatCurrency(orderDetails.total) }}</span>
            </div>
          </div>
        </div>

        <!-- What Happens Next Guide -->
        <div class="next-steps-alert">
          <h3 class="next-steps-title">What happens next?</h3>
          <p class="next-steps-desc">
            The merchant has received your order details and delivery location. They will prepare your items and coordinate delivery with you directly via phone or SMS.
          </p>
        </div>

        <!-- Continue Shopping Action -->
        <div class="actions-footer">
          <Button variant="primary" size="lg" style="width: 100%;" @click="handleContinueShopping">
            <ShoppingBag :size="18" /> Continue Shopping <ArrowRight :size="16" />
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.confirmation-page {
  padding: var(--space-12) var(--space-4);
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
  gap: var(--space-6);
}

.skeleton-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.error-box {
  text-align: center;
  padding: var(--space-8) 0;
}

.error-icon {
  font-size: var(--text-4xl);
  margin-bottom: var(--space-4);
  display: block;
}

.error-title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  margin-bottom: var(--space-2);
}

.error-desc {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
}

/* 1. PIN Waiting State */
.pin-waiting-banner {
  background: color-mix(in srgb, var(--color-gold) 12%, transparent);
  border: 1px solid var(--color-gold);
  border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-6);
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
}

.pin-waiting-text h2 {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: var(--space-1);
}

.pin-waiting-text p {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  line-height: var(--leading-normal);
}

.pulse-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-gold-hover);
  margin-top: var(--space-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: var(--color-gold);
  border-radius: 50%;
  animation: pulse-ring 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse-ring {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.3); }
}

.spin-icon {
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 2. Payment Failed Banner */
.payment-failed-banner {
  background: color-mix(in srgb, var(--color-market-clay) 12%, transparent);
  border: 1px solid var(--color-market-clay);
  border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-6);
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
}

.failed-text h2 {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-market-clay);
  margin-bottom: var(--space-1);
}

.failed-text p {
  font-size: var(--text-sm);
  color: var(--color-text);
  line-height: var(--leading-normal);
}

.merchant-coord-hint {
  font-size: var(--text-xs) !important;
  color: var(--color-text-muted) !important;
  margin-top: var(--space-2);
}

/* 3. Success Banner */
.success-banner {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-5);
}

.success-title {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  color: var(--color-text);
}

.success-subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  line-height: var(--leading-normal);
  max-width: 460px;
}

/* Receipt Details */
.receipt-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
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
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
}

.meta-value {
  font-size: var(--text-sm);
  font-weight: 700;
}

.mono-text {
  font-family: var(--font-mono);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 700;
}
.status-pill--paid { background: color-mix(in srgb, var(--color-ledger-green) 15%, transparent); color: var(--color-ledger-green); }
.status-pill--failed { background: color-mix(in srgb, var(--color-market-clay) 15%, transparent); color: var(--color-market-clay); }
.status-pill--pending { background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text-muted); }

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
  gap: var(--space-3);
}

.receipt-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
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

/* Next Steps Box */
.next-steps-alert {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4) var(--space-5);
}

.next-steps-title {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: var(--space-1);
}

.next-steps-desc {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: var(--leading-relaxed);
}

.text-teal { color: var(--color-ledger-green); }
.text-gold { color: var(--color-gold); }
.text-clay { color: var(--color-market-clay); }
</style>