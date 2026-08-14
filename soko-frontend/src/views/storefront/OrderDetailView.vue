<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/OrderDetailView.vue
// Merchant view to review and manage a customer's incoming order.
// =============================================================================

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { apiGet, apiPatch } from '@/services/apiClient';
import { useToast } from '@/composables/useToast';
import Button from '@/components/ui/Button.vue';
import Skeleton from '@/components/ui/Skeleton.vue';

interface OrderItem {
  product_name: string;
  unit_price: string;
  quantity: number;
  subtotal: string;
}

interface OrderDetails {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_location: string;
  notes: string | null;
  status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled';
  payment_method: string;
  payment_status: 'pending' | 'paid' | 'failed';
  total: string;
  created_at: string;
  items: OrderItem[];
}

const props = defineProps<{ id: string }>();

const router = useRouter();
const { push: pushToast } = useToast();

const order = ref<OrderDetails | null>(null);
const loading = ref(true);
const isUpdating = ref(false);

onMounted(() => {
  fetchOrderDetails();
});

async function fetchOrderDetails(): Promise<void> {
  loading.value = true;
  try {
    order.value = await apiGet<OrderDetails>(`/orders/${props.id}`);
  } catch {
    order.value = null;
  } finally {
    loading.value = false;
  }
}

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  return `KES ${num.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

async function updateStatus(newStatus: OrderDetails['status']): Promise<void> {
  isUpdating.value = true;
  try {
    order.value = await apiPatch<OrderDetails>(`/orders/${props.id}/status`, { status: newStatus });
    pushToast({ message: `Order status set to ${newStatus}`, variant: 'success' });
  } catch (err) {
    pushToast({ message: 'Failed to update order status', variant: 'error' });
  } finally {
    isUpdating.value = false;
  }
}

function goBack(): void {
  router.push({ name: 'merchant-orders' });
}
</script>

<template>
  <div class="order-detail-page">
    <header class="page-header">
      <Button variant="ghost" @click="goBack">← Back to Orders</Button>
    </header>

    <div v-if="loading" class="skeleton-wrap card">
      <Skeleton height="32px" width="30%" />
      <Skeleton height="120px" />
    </div>

    <div v-else-if="!order" class="error-wrap card">
      <p>Order details could not be loaded.</p>
    </div>

    <div v-else class="detail-layout">
      <!-- Left side customer info -->
      <div class="customer-info-card card">
        <h2 class="section-title">Order Info</h2>
        
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Customer Name</span>
            <span class="info-val">{{ order.customer_name }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Contact Phone</span>
            <span class="info-val">{{ order.customer_phone }}</span>
          </div>
          <div class="info-row" v-if="order.customer_email">
            <span class="info-label">Email Address</span>
            <span class="info-val">{{ order.customer_email }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Delivery Location</span>
            <span class="info-val">{{ order.delivery_location }}</span>
          </div>
          <div class="info-row" v-if="order.notes">
            <span class="info-label">Special Notes</span>
            <span class="info-val info-val--pre">{{ order.notes }}</span>
          </div>
        </div>

        <!-- Administrative Order Status mutations -->
        <div class="status-actions-area">
          <h3 class="actions-title">Update Status</h3>
          <div class="actions-row">
            <Button
              v-if="order.status === 'pending'"
              variant="primary"
              :loading="isUpdating"
              @click="updateStatus('confirmed')"
            >
              Confirm Order
            </Button>
            <Button
              v-if="order.status === 'confirmed'"
              variant="primary"
              :loading="isUpdating"
              @click="updateStatus('fulfilled')"
            >
              Mark Fulfilled
            </Button>
            <Button
              v-if="order.status !== 'fulfilled' && order.status !== 'cancelled'"
              variant="secondary"
              :loading="isUpdating"
              @click="updateStatus('cancelled')"
            >
              Cancel Order
            </Button>
          </div>
        </div>
      </div>

      <!-- Right side receipt listing -->
      <div class="order-summary-card card">
        <h2 class="section-title">Purchased Items</h2>
        
        <div class="items-list">
          <div v-for="(item, idx) in order.items" :key="idx" class="item-row">
            <div class="item-details">
              <p class="item-name">{{ item.product_name }}</p>
              <p class="item-qty text-muted">Quantity: {{ item.quantity }}</p>
            </div>
            <span class="item-total tabular-figure">{{ formatCurrency(item.subtotal) }}</span>
          </div>

          <div class="total-row">
            <span>Order Total</span>
            <span class="total-amount tabular-figure">{{ formatCurrency(order.total) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.order-detail-page {
  padding: var(--space-6);
  max-width: 960px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--space-6);
}

.skeleton-wrap,
.error-wrap {
  padding: var(--space-6);
  background: var(--color-surface);
}

.detail-layout {
  display: flex;
  gap: var(--space-6);
  flex-direction: column;
}

@media (min-width: 768px) {
  .detail-layout {
    flex-direction: row;
    align-items: flex-start;
  }
}

.customer-info-card {
  flex: 1.5;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.order-summary-card {
  flex: 1;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.section-title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-2);
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.info-val {
  font-size: var(--text-sm);
  color: var(--color-text);
}

.info-val--pre {
  white-space: pre-wrap;
}

.status-actions-area {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.actions-title {
  font-size: var(--text-sm);
  font-weight: 600;
}

.actions-row {
  display: flex;
  gap: var(--space-2);
}

/* Receipt listing */
.items-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-sm);
}

.item-name {
  font-weight: 600;
}

.item-qty {
  font-size: var(--text-xs);
  margin-top: 2px;
}

.total-row {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-4);
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  font-size: var(--text-base);
}

.total-amount {
  color: var(--color-ink);
}
</style>