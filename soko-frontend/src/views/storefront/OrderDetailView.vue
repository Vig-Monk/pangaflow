<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/storefront/OrderDetailView.vue
// =============================================================================

import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { apiGet, apiPatch } from '@/services/apiClient';
import { useToast } from '@/composables/useToast';
import Button from '@/components/ui/Button.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  FileText,
  CreditCard,
  PackageCheck,
  Ban,
} from 'lucide-vue-next';

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const whatsappUrl = computed(() => {
  if (!order.value?.customer_phone) return '#';
  const cleanDigits = order.value.customer_phone.replace(/\D/g, '');
  const phone = cleanDigits.startsWith('0') ? `254${cleanDigits.slice(1)}` : cleanDigits;
  const message = encodeURIComponent(
    `Hello ${order.value.customer_name}, this is regarding your order #${order.value.id.slice(0, 8).toUpperCase()} on Soko.`
  );
  return `https://wa.me/${phone}?text=${message}`;
});

async function updateFulfillmentStatus(newStatus: OrderDetails['status']): Promise<void> {
  isUpdating.value = true;
  try {
    order.value = await apiPatch<OrderDetails>(`/orders/${props.id}/status`, { status: newStatus });
    pushToast({ message: `Order status set to ${newStatus.toUpperCase()}`, variant: 'success' });
  } catch {
    pushToast({ message: 'Failed to update order status', variant: 'error' });
  } finally {
    isUpdating.value = false;
  }
}

async function markPaymentReceived(): Promise<void> {
  isUpdating.value = true;
  try {
    order.value = await apiPatch<OrderDetails>(`/orders/${props.id}/payment-status`, {
      payment_status: 'paid',
    });
    pushToast({ message: 'Payment marked as received and recorded in ledger', variant: 'success' });
  } catch {
    pushToast({ message: 'Failed to update payment status', variant: 'error' });
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
      <Button variant="ghost" @click="goBack"><ArrowLeft :size="16" /> Back to Orders</Button>
    </header>

    <div v-if="loading" class="skeleton-wrap card">
      <Skeleton height="36px" width="40%" />
      <Skeleton height="160px" />
    </div>

    <div v-else-if="!order" class="error-wrap card">
      <p>Order details could not be loaded or the order does not exist.</p>
      <Button variant="secondary" @click="goBack" style="margin-top: var(--space-3);">Back to Orders</Button>
    </div>

    <div v-else class="detail-layout">
      <!-- Left Column: Customer & Action Controls -->
      <div class="customer-info-card card">
        <div class="card-header-row">
          <div>
            <span class="order-ref-title font-mono">Order #{{ order.id.slice(0, 8).toUpperCase() }}</span>
            <p class="order-date-text">{{ formatDate(order.created_at) }}</p>
          </div>

          <div class="badges-row">
            <!-- Payment Badge -->
            <span v-if="order.payment_status === 'paid'" class="status-pill status-pill--paid">
              <CheckCircle2 :size="12" /> PAID
            </span>
            <span v-else-if="order.payment_status === 'failed'" class="status-pill status-pill--failed">
              <AlertTriangle :size="12" /> PAYMENT FAILED
            </span>
            <span v-else class="status-pill status-pill--pending">
              <Clock :size="12" /> PENDING PAYMENT
            </span>

            <!-- Fulfillment Badge -->
            <span class="status-pill status-pill--fulfillment" :class="`status-pill--${order.status}`">
              {{ order.status.toUpperCase() }}
            </span>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Customer</span>
            <span class="info-val font-semibold">{{ order.customer_name }}</span>
          </div>

          <div class="info-row">
            <span class="info-label">Phone &amp; WhatsApp Contact</span>
            <div class="contact-actions-row">
              <a :href="`tel:${order.customer_phone}`" class="contact-action-btn">
                <Phone :size="14" /> {{ order.customer_phone }}
              </a>
              <a :href="whatsappUrl" target="_blank" rel="noopener" class="contact-action-btn contact-action-btn--wa">
                <MessageSquare :size="14" /> WhatsApp
              </a>
            </div>
          </div>

          <div class="info-row" v-if="order.customer_email">
            <span class="info-label">Email</span>
            <span class="info-val">{{ order.customer_email }}</span>
          </div>

          <div class="info-row">
            <span class="info-label">Delivery Address</span>
            <div class="address-val">
              <MapPin :size="15" class="text-muted" />
              <span>{{ order.delivery_location }}</span>
            </div>
          </div>

          <div class="info-row" v-if="order.notes">
            <span class="info-label">Customer Delivery Notes</span>
            <div class="notes-val">
              <FileText :size="15" class="text-muted" />
              <p>{{ order.notes }}</p>
            </div>
          </div>

          <div class="info-row">
            <span class="info-label">Payment Channel</span>
            <span class="info-val font-mono">
              {{ order.payment_method === 'mpesa_direct' || order.payment_method === 'mpesa' ? 'Online M-Pesa (STK Push)' : 'Cash on Delivery / Manual Coordination' }}
            </span>
          </div>
        </div>

        <!-- Management Actions -->
        <div class="status-actions-area">
          <h3 class="actions-title">Manage Order &amp; Payment</h3>
          <div class="actions-grid">
            <!-- Confirm Order Button -->
            <Button
              v-if="order.status === 'pending'"
              variant="primary"
              :loading="isUpdating"
              @click="updateFulfillmentStatus('confirmed')"
            >
              <PackageCheck :size="16" /> Confirm Order
            </Button>

            <!-- Mark Fulfilled Button -->
            <Button
              v-if="order.status === 'confirmed'"
              variant="primary"
              :loading="isUpdating"
              @click="updateFulfillmentStatus('fulfilled')"
            >
              <CheckCircle2 :size="16" /> Mark Fulfilled
            </Button>

            <!-- Manual Payment Override -->
            <Button
              v-if="order.payment_status !== 'paid'"
              variant="secondary"
              :loading="isUpdating"
              @click="markPaymentReceived"
            >
              <CreditCard :size="16" /> Mark Payment Received
            </Button>

            <!-- Cancel Order Button -->
            <Button
              v-if="order.status !== 'fulfilled' && order.status !== 'cancelled'"
              variant="danger"
              :loading="isUpdating"
              @click="updateFulfillmentStatus('cancelled')"
            >
              <Ban :size="16" /> Cancel Order
            </Button>
          </div>
        </div>
      </div>

      <!-- Right Column: Purchased Items Summary -->
      <div class="order-summary-card card">
        <h2 class="section-title">Purchased Items</h2>

        <div class="items-list">
          <div v-for="(item, idx) in order.items" :key="idx" class="item-row">
            <div class="item-details">
              <p class="item-name">{{ item.product_name }}</p>
              <p class="item-qty text-muted">Quantity: {{ item.quantity }} × {{ formatCurrency(item.unit_price) }}</p>
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
  max-width: 1050px;
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

@media (min-width: 840px) {
  .detail-layout {
    flex-direction: row;
    align-items: flex-start;
  }
}

.customer-info-card {
  flex: 1.4;
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
  gap: var(--space-4);
}

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-4);
  flex-wrap: wrap;
  gap: var(--space-3);
}

.order-ref-title {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-text);
}

.order-date-text {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-top: 2px;
}

.badges-row {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 700;
}
.status-pill--paid { background: color-mix(in srgb, var(--color-ledger-green) 15%, transparent); color: var(--color-ledger-green); }
.status-pill--failed { background: color-mix(in srgb, var(--color-market-clay) 15%, transparent); color: var(--color-market-clay); }
.status-pill--pending { background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text-muted); }

.status-pill--fulfillment {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}
.status-pill--confirmed { background: color-mix(in srgb, var(--color-ink) 12%, transparent); color: var(--color-ink); }
.status-pill--fulfilled { background: color-mix(in srgb, var(--color-ledger-green) 15%, transparent); color: var(--color-ledger-green); }
.status-pill--cancelled { background: color-mix(in srgb, var(--color-market-clay) 15%, transparent); color: var(--color-market-clay); }

.info-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.info-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.info-val {
  font-size: var(--text-sm);
  color: var(--color-text);
}

.font-semibold { font-weight: 600; }
.font-mono { font-family: var(--font-mono); }

.contact-actions-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-top: 2px;
}

.contact-action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: 4px var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text);
  text-decoration: none;
  transition: border-color var(--duration-fast) var(--ease-standard);
}
.contact-action-btn:hover { border-color: var(--color-ink); }
.contact-action-btn--wa { color: var(--color-ledger-green); }
.contact-action-btn--wa:hover { border-color: var(--color-ledger-green); }

.address-val,
.notes-val {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text);
  background: var(--color-bg);
  padding: var(--space-3);
  border-radius: var(--radius-md);
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
  font-weight: 700;
}

.actions-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.section-title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-2);
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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