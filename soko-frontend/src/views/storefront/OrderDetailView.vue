<script setup lang="ts">
// =============================================================================
// KauntaOS-frontend/src/views/storefront/OrderDetailView.vue
// Complete merchant dispatch & handover: Rider Assignment, WhatsApp Relay, and Proof-of-Delivery Verification.
// =============================================================================

import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { apiGet, apiPatch, apiPost } from '@/services/apiClient';
import { useToast } from '@/composables/useToast';
import Button from '@/components/ui/Button.vue';
import Modal from '@/components/ui/Modal.vue';
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
  PackageCheck,
  Ban,
  Bike,
  Send,
  Copy,
  ExternalLink,
  Users,
  KeyRound,
  DollarSign,
  User,
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
  status: 'pending' | 'confirmed' | 'assigned' | 'out_for_delivery' | 'delivered' | 'cancelled';
  payment_method: string;
  payment_status: 'pending' | 'paid' | 'failed';
  total: string;
  delivery_type: 'delivery' | 'pickup';
  customer_lat: string | null;
  customer_lng: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  delivery_fee: string;
  delivery_fee_status: 'known' | 'needs_merchant_confirmation';
  delivery_confirmation_code: string | null;
  amount_collected: string | null;
  collected_by: string | null;
  created_at: string;
  items: OrderItem[];
}

interface NearbyOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_location: string;
  total: string;
  distance_km: number;
}

const props = defineProps<{ id: string }>();

const router = useRouter();
const { push: pushToast } = useToast();

const order = ref<OrderDetails | null>(null);
const loading = ref(true);
const isUpdating = ref(false);

// Rider Assignment Modal
const showAssignModal = ref(false);
const riderNameInput = ref('');
const riderPhoneInput = ref('');
const isAssigning = ref(false);
const nearbyOrders = ref<NearbyOrder[]>([]);
const selectedNearbyIds = ref<string[]>([]);
const isLoadingNearby = ref(false);

// Delivery Completion & Verification Modal
const showCompleteModal = ref(false);
const confirmationCodeInput = ref('');
const amountCollectedInput = ref(0);
const collectedByInput = ref('');
const isCompletingDelivery = ref(false);
const completionError = ref<string | null>(null);

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

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
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

function buildRiderWhatsAppPayload(): string {
  if (!order.value) return '';

  const mapLink =
    order.value.customer_lat && order.value.customer_lng
      ? `https://www.google.com/maps/search/?api=1&query=${order.value.customer_lat},${order.value.customer_lng}`
      : `Address: ${order.value.delivery_location}`;

  const isPaid = order.value.payment_status === 'paid';
  const collectAmount = isPaid ? '0 (PAID ONLINE)' : `KES ${Number(order.value.total).toLocaleString('en-KE')}`;

  const lines = [
    `*📦 KauntaOS DELIVERY DISPATCH — #${order.value.id.slice(0, 8).toUpperCase()}*`,
    `--------------------------------`,
    `*Customer:* ${order.value.customer_name}`,
    `*Phone:* ${order.value.customer_phone}`,
    `*Destination:* ${mapLink}`,
    order.value.notes ? `*Delivery Notes:* ${order.value.notes}` : null,
    `*Collect from Customer:* ${collectAmount}`,
    `--------------------------------`,
    `_Please request the 4-digit confirmation code from the customer upon handover._`,
  ].filter(Boolean).join('\n');

  return lines;
}

const riderWhatsAppUrl = computed(() => {
  const message = buildRiderWhatsAppPayload();
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
});

function copyDispatchToClipboard(): void {
  const message = buildRiderWhatsAppPayload();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(message);
    pushToast({ message: 'Dispatch note copied to clipboard', variant: 'success' });
  }
}

async function openAssignRiderModal(): Promise<void> {
  riderNameInput.value = order.value?.rider_name || '';
  riderPhoneInput.value = order.value?.rider_phone || '';
  selectedNearbyIds.value = [];
  showAssignModal.value = true;
  isLoadingNearby.value = true;

  try {
    nearbyOrders.value = await apiGet<NearbyOrder[]>(`/orders/${props.id}/nearby-batch`);
  } catch {
    nearbyOrders.value = [];
  } finally {
    isLoadingNearby.value = false;
  }
}

async function handleAssignRiderSubmit(): Promise<void> {
  if (!riderNameInput.value.trim() || !riderPhoneInput.value.trim()) {
    pushToast({ message: 'Rider Name and Phone number are required', variant: 'error' });
    return;
  }

  isAssigning.value = true;
  try {
    const allOrderIds = [props.id, ...selectedNearbyIds.value];
    await apiPost('/orders/assign-rider', {
      orderIds: allOrderIds,
      riderName: riderNameInput.value.trim(),
      riderPhone: riderPhoneInput.value.trim(),
    });

    pushToast({
      message: `Rider assigned to ${allOrderIds.length} order(s) successfully`,
      variant: 'success',
    });

    showAssignModal.value = false;
    await fetchOrderDetails();
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to assign rider', variant: 'error' });
  } finally {
    isAssigning.value = false;
  }
}

function openCompleteDeliveryModal(): void {
  confirmationCodeInput.value = '';
  amountCollectedInput.value = order.value ? parseFloat(order.value.total) : 0;
  collectedByInput.value = order.value?.rider_name || 'merchant';
  completionError.value = null;
  showCompleteModal.value = true;
}

async function handleCompleteDeliverySubmit(): Promise<void> {
  completionError.value = null;
  isCompletingDelivery.value = true;

  try {
    const payload = {
      confirmationCode: confirmationCodeInput.value.trim().toUpperCase() || undefined,
      amountCollected: Number(amountCollectedInput.value),
      collectedBy: collectedByInput.value.trim() || undefined,
    };

    const updated = await apiPost<OrderDetails>(`/orders/${props.id}/complete-delivery`, payload);
    order.value = updated;
    pushToast({ message: 'Order marked as successfully delivered & verified!', variant: 'success' });
    showCompleteModal.value = false;
  } catch (err) {
    completionError.value = err instanceof Error ? err.message : 'Delivery verification failed';
  } finally {
    isCompletingDelivery.value = false;
  }
}

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
      <!-- Left Column: Customer Details & Fulfillment Actions -->
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
            <span class="info-label">Phone Contact</span>
            <div class="contact-actions-row">
              <a :href="`tel:${order.customer_phone}`" class="contact-action-btn">
                <Phone :size="14" /> {{ order.customer_phone }}
              </a>
            </div>
          </div>

          <div class="info-row">
            <span class="info-label">Fulfillment Method</span>
            <span class="info-val">
              {{ order.delivery_type === 'delivery' ? 'Doorstep Delivery (Boda / Courier)' : 'In-Person Store Pickup' }}
            </span>
          </div>

          <div class="info-row" v-if="order.delivery_type === 'delivery'">
            <span class="info-label">Delivery Destination &amp; Coordinates</span>
            <div class="address-val">
              <MapPin :size="15" class="text-muted" />
              <div>
                <p>{{ order.delivery_location }}</p>
                <a
                  v-if="order.customer_lat && order.customer_lng"
                  :href="`https://www.google.com/maps/search/?api=1&query=${order.customer_lat},${order.customer_lng}`"
                  target="_blank"
                  rel="noopener"
                  class="map-pin-link"
                >
                  Open in Google Maps <ExternalLink :size="12" />
                </a>
              </div>
            </div>
          </div>

          <div class="info-row" v-if="order.notes">
            <span class="info-label">Customer Delivery Notes</span>
            <div class="notes-val">
              <FileText :size="15" class="text-muted" />
              <p>{{ order.notes }}</p>
            </div>
          </div>

          <!-- Assigned Rider Card -->
          <div class="rider-assigned-box" v-if="order.rider_name">
            <div class="rider-header">
              <Bike :size="16" class="text-teal" />
              <span>Assigned Boda Rider: <strong>{{ order.rider_name }}</strong> ({{ order.rider_phone }})</span>
            </div>
          </div>
        </div>

        <!-- DISPATCH & FULFILLMENT CONTROLS -->
        <div class="status-actions-area">
          <h3 class="actions-title">Fulfillment &amp; Dispatch Actions</h3>

          <div class="actions-grid">
            <!-- 1. Confirm Order -->
            <Button
              v-if="order.status === 'pending'"
              variant="primary"
              :loading="isUpdating"
              @click="updateFulfillmentStatus('confirmed')"
            >
              <PackageCheck :size="16" /> Confirm Order
            </Button>

            <!-- 2. Assign Rider Button (For Delivery Orders) -->
            <Button
              v-if="order.status === 'confirmed' && order.delivery_type === 'delivery'"
              variant="primary"
              @click="openAssignRiderModal"
            >
              <Bike :size="16" /> Assign Rider &amp; Check Batches
            </Button>

            <!-- 3. WhatsApp Dispatch Relay Button (Once Assigned or Out) -->
            <div v-if="order.status === 'assigned' || order.status === 'out_for_delivery'" class="dispatch-relay-group">
              <a :href="riderWhatsAppUrl" target="_blank" rel="noopener" class="whatsapp-relay-btn">
                <MessageSquare :size="16" /> Send Pin to Rider (WhatsApp)
              </a>
              <Button variant="secondary" size="sm" @click="copyDispatchToClipboard">
                <Copy :size="14" /> Copy Dispatch Note
              </Button>
            </div>

            <!-- 4. Mark Out for Delivery -->
            <Button
              v-if="order.status === 'assigned'"
              variant="primary"
              :loading="isUpdating"
              @click="updateFulfillmentStatus('out_for_delivery')"
            >
              <Send :size="16" /> Mark Out for Delivery
            </Button>

            <!-- 5. Verify & Mark Delivered Modal Trigger -->
            <Button
              v-if="order.status === 'out_for_delivery' || (order.status === 'confirmed' && order.delivery_type === 'pickup')"
              variant="primary"
              @click="openCompleteDeliveryModal"
            >
              <CheckCircle2 :size="16" />
              {{ order.delivery_type === 'pickup' ? 'Mark Package Collected' : 'Verify Code & Mark Delivered' }}
            </Button>

            <!-- 6. Cancel Order -->
            <Button
              v-if="order.status !== 'delivered' && order.status !== 'cancelled'"
              variant="danger"
              :loading="isUpdating"
              @click="updateFulfillmentStatus('cancelled')"
            >
              <Ban :size="16" /> Cancel Order
            </Button>
          </div>
        </div>
      </div>

      <!-- Right Column: Line Items & Totals -->
      <div class="order-summary-card card">
        <h2 class="section-title">Purchased Items</h2>

        <div class="items-list">
          <div v-for="(item, idx) in order.items" :key="idx" class="item-row">
            <div class="item-details">
              <p class="item-name">{{ item.product_name }}</p>
              <p class="item-qty text-muted">Qty: {{ item.quantity }} × {{ formatCurrency(item.unit_price) }}</p>
            </div>
            <span class="item-total tabular-figure">{{ formatCurrency(item.subtotal) }}</span>
          </div>

          <div v-if="order.delivery_type === 'delivery'" class="item-row">
            <div class="item-details">
              <p class="item-name">Delivery Fee</p>
              <p class="item-qty text-muted">{{ order.delivery_fee_status === 'known' ? 'Standard fee' : 'To be confirmed with merchant' }}</p>
            </div>
            <span class="item-total tabular-figure">{{ formatCurrency(order.delivery_fee) }}</span>
          </div>

          <div class="total-row">
            <span>Order Total</span>
            <span class="total-amount tabular-figure">{{ formatCurrency(order.total) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ASSIGN RIDER & NEARBY BATCHING MODAL -->
    <Modal :open="showAssignModal" title="Assign Rider & Proximity Batching" @close="showAssignModal = false">
      <div class="modal-form">
        <div class="form-group">
          <label class="form-label">Rider Full Name *</label>
          <input v-model="riderNameInput" type="text" placeholder="e.g. Dennis Mwangi" class="form-input" />
        </div>

        <div class="form-group">
          <label class="form-label">Rider Phone Number *</label>
          <input v-model="riderPhoneInput" type="tel" placeholder="07XXXXXXXX" class="form-input" />
        </div>

        <!-- 2km Proximity Clustering Suggestions -->
        <div class="nearby-batch-section">
          <div class="nearby-header">
            <Users :size="16" class="text-teal" />
            <span class="nearby-title">Nearby Confirmed Deliveries (Within 2km)</span>
          </div>

          <div v-if="isLoadingNearby" class="nearby-loading">
            <span>Checking nearby orders...</span>
          </div>

          <div v-else-if="nearbyOrders.length === 0" class="nearby-empty">
            <span>No other confirmed orders currently nearby for batching.</span>
          </div>

          <div v-else class="nearby-list">
            <p class="batch-hint">Batch these adjacent orders to the same rider in a single trip:</p>
            <label v-for="nb in nearbyOrders" :key="nb.id" class="batch-order-item">
              <input type="checkbox" :value="nb.id" v-model="selectedNearbyIds" />
              <div class="batch-order-info">
                <span class="batch-name">#{{ nb.id.slice(0, 6).toUpperCase() }} • {{ nb.customer_name }} ({{ nb.distance_km.toFixed(1) }} km away)</span>
                <span class="batch-loc">{{ nb.delivery_location }}</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      <template #footer>
        <Button variant="ghost" @click="showAssignModal = false">Cancel</Button>
        <Button variant="primary" :loading="isAssigning" @click="handleAssignRiderSubmit">
          Assign &amp; Dispatch ({{ 1 + selectedNearbyIds.length }} orders)
        </Button>
      </template>
    </Modal>

    <!--  PROOF-OF-DELIVERY & CASH RECONCILIATION MODAL -->
    <Modal :open="showCompleteModal" title="Verify Delivery Handover" @close="showCompleteModal = false">
      <div v-if="order" class="modal-form">
        <!-- 4-digit code verification for doorstep delivery -->
        <div v-if="order.delivery_type === 'delivery'" class="form-group">
          <label class="form-label">
            <KeyRound :size="14" class="text-gold" />
            Customer 4-Digit Confirmation Code *
          </label>
          <input
            v-model="confirmationCodeInput"
            type="text"
            maxlength="6"
            placeholder="e.g. 7K9M"
            class="form-input code-input font-mono"
          />
          <span class="field-hint">Ask the rider for the 4-digit code provided by the customer upon handover.</span>
        </div>

        <!-- Cash collection input if Cash on Delivery -->
        <div v-if="order.payment_method === 'mpesa_cash'" class="form-group">
          <label class="form-label">
            <DollarSign :size="14" class="text-teal" />
            Amount Collected from Customer (KES) *
          </label>
          <input
            v-model.number="amountCollectedInput"
            type="number"
            min="0"
            class="form-input font-mono"
          />
          <span class="field-hint">Expected order total: {{ formatCurrency(order.total) }}</span>
        </div>

        <div class="form-group">
          <label class="form-label">
            <User :size="14" class="text-muted" />
            Collected / Verified By
          </label>
          <input
            v-model="collectedByInput"
            type="text"
            placeholder="Rider name or merchant"
            class="form-input"
          />
        </div>

        <div v-if="completionError" class="completion-error-alert">
          <AlertTriangle :size="16" />
          <span>{{ completionError }}</span>
        </div>
      </div>

      <template #footer>
        <Button variant="ghost" @click="showCompleteModal = false">Cancel</Button>
        <Button
          variant="primary"
          :loading="isCompletingDelivery"
          @click="handleCompleteDeliverySubmit"
        >
          Confirm &amp; Complete Delivery
        </Button>
      </template>
    </Modal>
  </div>
</template>
<style scoped>
.order-detail-page {
  padding: var(--space-6);
  max-width: 1100px;
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

@media (min-width: 860px) {
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
  min-width: 0;
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
  min-width: 0;
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
.status-pill--assigned { background: color-mix(in srgb, var(--color-info) 15%, transparent); color: var(--color-info); }
.status-pill--out_for_delivery { background: color-mix(in srgb, var(--color-gold) 15%, transparent); color: var(--color-gold-hover); }
.status-pill--delivered { background: color-mix(in srgb, var(--color-ledger-green) 15%, transparent); color: var(--color-ledger-green); }
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
contact-action-btn {
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

.map-pin-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--color-info);
  text-decoration: none;
  font-weight: 600;
  margin-top: 4px;
}

.rider-assigned-box {
  background: color-mix(in srgb, var(--color-info) 10%, transparent);
  border: 1px solid var(--color-info);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.rider-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text);
}

/* Dispatch Actions */
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
  flex-direction: column;
  gap: var(--space-2);
}

.dispatch-relay-group {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.whatsapp-relay-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background: var(--color-ledger-green);
  color: #FFFFFF;
  border-radius: var(--radius-md);
  padding: 0 var(--space-4);
  min-height: 42px;
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: none;
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

.item-name { font-weight: 600; }
.item-qty { font-size: var(--text-xs); margin-top: 2px; }

.total-row {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-4);
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  font-size: var(--text-base);
}

.total-amount { color: var(--color-ink); }

/* Modal Form Styles */
.modal-form { display: flex; flex-direction: column; gap: var(--space-4); }
.form-group { display: flex; flex-direction: column; gap: var(--space-1); }
.form-label { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-muted); display: flex; align-items: center; gap: var(--space-1); }
.form-input {
  min-height: 42px; padding: 0 var(--space-3);
  background: var(--color-bg); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); font-size: var(--text-sm); color: var(--color-text); outline: none;
}
.code-input {
  font-size: 1.25rem;
  letter-spacing: 0.25rem;
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
}

.field-hint {
  font-size: 11px;
  color: var(--color-text-muted);
}

.completion-error-alert {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: color-mix(in srgb, var(--color-market-clay) 12%, transparent);
  color: var(--color-market-clay);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: 600;
}

.nearby-batch-section {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.nearby-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 700;
}

.nearby-empty, .nearby-loading { font-size: var(--text-xs); color: var(--color-text-muted); }
.batch-hint { font-size: 11px; color: var(--color-text-muted); margin-bottom: var(--space-1); }
.nearby-list { display: flex; flex-direction: column; gap: var(--space-2); }

.batch-order-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.batch-order-info { display: flex; flex-direction: column; }
.batch-name { font-size: var(--text-xs); font-weight: 600; color: var(--color-text); }
.batch-loc { font-size: 11px; color: var(--color-text-muted); }

.text-teal { color: var(--color-ledger-green); }
.text-gold { color: var(--color-gold); }
</style>