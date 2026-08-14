<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/storefront/OrderConfirmationView.vue
// order confirmation display page.
// =============================================================================

import { onMounted, ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { apiGet } from '@/services/apiClient';
import Skeleton from '@/components/ui/Skeleton.vue';

interface PublicOrderDetails {
  orderId: string;
  customerName: string;
  total: number;
  status: string;
  items: Array<{
    productName: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
  }>;
}

const route = useRoute();
const orderDetails = ref<PublicOrderDetails | null>(null);

const loading = ref(true);
const loadError = ref(false);

const storeSlug = computed(() => route.params.storeSlug as string);
const orderId = computed(() => route.params.orderId as string);

onMounted(async () => {
  try {
    // confirmation fetches details with storeSlug constraint check
    orderDetails.value = await apiGet<PublicOrderDetails>(`/public/stores/${storeSlug.value}/orders/${orderId.value}`);
    loading.value = false;
  } catch {
    loadError.value = true;
    loading.value = false;
  }
});

function formatCurrency(value: number): string {
  return `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}
</script>

<template>
  <div class="confirmation-page">
    <div class="confirm-container card">
      <div v-if="loading" class="skeleton-wrap">
        <Skeleton height="40px" width="30%" />
        <Skeleton height="20px" width="60%" />
        <Skeleton height="150px" />
      </div>

      <div v-else-if="loadError" class="error-box">
        <span class="error-icon">⚠️</span>
        <h2 class="error-title">Order Confirmation Unavailable</h2>
        <p class="error-desc">We could not load your order confirmation. Please contact the merchant directly with your order number.</p>
      </div>

      <template v-else-if="orderDetails">
        <div class="success-banner">
          <span class="success-icon">🎉</span>
          <h1 class="success-title">Thank You, {{ orderDetails.customerName }}!</h1>
          <p class="success-subtitle">Your order has been received. We have sent your order details to the merchant.</p>
        </div>

        <div class="receipt-section">
          <div class="receipt-header">
            <p class="receipt-id">Order ID: <span class="mono-text">{{ orderDetails.orderId }}</span></p>
            <p class="receipt-status">Status: <span class="status-pill">{{ orderDetails.status.toUpperCase() }}</span></p>
          </div>

          <div class="receipt-items-list">
            <div v-for="(item, idx) in orderDetails.items" :key="idx" class="receipt-row">
              <span class="item-desc">{{ item.productName }} x {{ item.quantity }}</span>
              <span class="tabular-figure">{{ formatCurrency(item.subtotal) }}</span>
            </div>
            
            <div class="receipt-row receipt-row--total">
              <span class="total-label">Estimated Total</span>
              <span class="total-amount tabular-figure">{{ formatCurrency(orderDetails.total) }}</span>
            </div>
          </div>
        </div>

        <div class="next-steps-alert">
          <h3 class="next-steps-title">What Happens Next?</h3>
          <p class="next-steps-desc">The merchant will review your order details and contact you directly via phone call or SMS to confirm product availability and schedule your delivery.</p>
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
  max-width: 600px;
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

/* Success Banner */
.success-banner {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-5);
}

.success-icon {
  font-size: var(--text-4xl);
  margin-bottom: var(--space-2);
}

.success-title {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  color: var(--color-ink);
}

.success-subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  line-height: var(--leading-normal);
  max-width: 440px;
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
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  flex-wrap: wrap;
  gap: var(--space-2);
}

.mono-text {
  font-family: var(--font-mono);
  color: var(--color-text);
  font-weight: 600;
}

.status-pill {
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-weight: 600;
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

/* Next Steps */
.next-steps-alert {
  background: color-mix(in srgb, var(--color-ink) 5%, transparent);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4) var(--space-5);
}

.next-steps-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-ink);
  margin-bottom: var(--space-1);
}

.next-steps-desc {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: var(--leading-normal);
}
</style>