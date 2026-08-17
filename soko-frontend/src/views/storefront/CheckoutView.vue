<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/storefront/CheckoutView.vue
// Complete checkout: Delivery/Pickup toggle, interactive pin capture, order review.
// =============================================================================

import { computed, ref, onMounted, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCartStore } from '@/stores/cart';
import { useStoreSettingsStore } from '@/stores/store';
import { apiGet, apiPost } from '@/services/apiClient';
import { useToast } from '@/composables/useToast';
import DeliveryTypeStep, { type DeliveryType } from '@/components/storefront/DeliveryTypeStep.vue';
import DeliveryLocationStep, { type LocationPayload } from '@/components/storefront/DeliveryLocationStep.vue';
import Button from '@/components/ui/Button.vue';
import {
  User,
  Phone,
  Mail,
  FileText,
  CreditCard,
  ShieldCheck,
  Zap,
  ChevronDown,
  ChevronUp,
  Store,
  AlertCircle,
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const cartStore = useCartStore();
const storeSettingsStore = useStoreSettingsStore();
const { push: pushToast } = useToast();

const storeSlug = computed(() => (route.params.storeSlug as string || '').toLowerCase().trim());
const isMpesaVerified = computed(() => (storeSettingsStore.settings as any)?.mpesa_verified ?? false);

// Form state initialized from persistent Pinia checkout draft
const deliveryType = ref<DeliveryType>(cartStore.checkoutDraft.deliveryType || 'delivery');
const customerName = ref(cartStore.checkoutDraft.customerName || '');
const customerPhone = ref(cartStore.checkoutDraft.customerPhone || '');
const customerEmail = ref(cartStore.checkoutDraft.customerEmail || '');
const notes = ref(cartStore.checkoutDraft.notes || '');
const paymentMethod = ref(cartStore.checkoutDraft.paymentMethod || 'mpesa_cash');

// Location State
const locationData = reactive<LocationPayload>({
  customerLat: cartStore.checkoutDraft.customerLat,
  customerLng: cartStore.checkoutDraft.customerLng,
  locationSource: cartStore.checkoutDraft.locationSource || 'manual_text',
  locationAccuracyM: cartStore.checkoutDraft.locationAccuracyM,
  fullAddress: cartStore.checkoutDraft.deliveryLocation || '',
  estate: cartStore.checkoutDraft.estate || '',
  landmark: cartStore.checkoutDraft.landmark || '',
  houseNumber: cartStore.checkoutDraft.houseNumber || '',
});

// UI Controls
const showItemsSummary = ref(false);
const isSubmitting = ref(false);
const phoneError = ref<string | null>(null);

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) {
    return '0' + digits.slice(3);
  }
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
    return '0' + digits;
  }
  return digits;
}

function validatePhone(input: string): boolean {
  const normalized = normalizePhone(input);
  return /^(07|01)\d{8}$/.test(normalized);
}

onMounted(async () => {
  cartStore.initForStore(storeSlug.value);

  if (cartStore.isEmpty) {
    pushToast({ message: 'Your shopping cart is empty.', variant: 'error' });
    router.push({ name: 'storefront-home', params: { storeSlug: storeSlug.value } });
    return;
  }

  try {
    const storeData = await apiGet<any>(`/public/stores/${storeSlug.value}`);
    storeSettingsStore.settings = storeData;
    if (storeData.mpesa_verified && !paymentMethod.value) {
      paymentMethod.value = 'mpesa_direct';
    }
  } catch {
    // Non-blocking fallback
  }
});

function formatCurrency(value: number): string {
  return `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function handleLocationConfirmed(payload: LocationPayload): void {
  Object.assign(locationData, payload);
  cartStore.setCheckoutDraft({
    customerLat: payload.customerLat,
    customerLng: payload.customerLng,
    locationSource: payload.locationSource,
    locationAccuracyM: payload.locationAccuracyM,
    deliveryLocation: payload.fullAddress,
    estate: payload.estate,
    landmark: payload.landmark,
    houseNumber: payload.houseNumber,
  });
  pushToast({ message: 'Delivery location confirmed', variant: 'success' });
}

function saveContactProgress(): void {
  const cleanPhone = normalizePhone(customerPhone.value);
  if (customerPhone.value && !validatePhone(cleanPhone)) {
    phoneError.value = 'Enter a valid Kenyan number (e.g. 07XXXXXXXX or 01XXXXXXXX)';
  } else {
    phoneError.value = null;
  }

  cartStore.setCheckoutDraft({
    deliveryType: deliveryType.value,
    customerName: customerName.value.trim(),
    customerPhone: cleanPhone,
    customerEmail: customerEmail.value.trim(),
    notes: notes.value.trim(),
    paymentMethod: paymentMethod.value,
  });
}

const isReadyToPlaceOrder = computed(() => {
  const hasName = customerName.value.trim().length > 0;
  const hasPhone = validatePhone(customerPhone.value);
  if (!hasName || !hasPhone) return false;

  if (deliveryType.value === 'delivery') {
    return locationData.fullAddress.trim().length > 0 || (locationData.customerLat !== null && locationData.customerLng !== null);
  }

  return true;
});

async function handlePlaceOrder(): Promise<void> {
  saveContactProgress();

  if (!customerName.value.trim()) {
    pushToast({ message: 'Please enter your full name', variant: 'error' });
    return;
  }

  const cleanPhone = normalizePhone(customerPhone.value);
  if (!validatePhone(cleanPhone)) {
    phoneError.value = 'Enter a valid Kenyan number (e.g. 07XXXXXXXX or 01XXXXXXXX)';
    pushToast({ message: 'Please provide a valid contact phone number', variant: 'error' });
    return;
  }

  if (deliveryType.value === 'delivery' && !locationData.fullAddress.trim()) {
    pushToast({ message: 'Please provide or confirm your delivery location', variant: 'error' });
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = {
      customerName: customerName.value.trim(),
      customerPhone: cleanPhone,
      customerEmail: customerEmail.value.trim() || null,
      deliveryLocation: deliveryType.value === 'delivery' ? locationData.fullAddress : 'Store Pickup',
      notes: notes.value.trim() || null,
      paymentMethod: paymentMethod.value,
      deliveryType: deliveryType.value,
      customerLat: locationData.customerLat,
      customerLng: locationData.customerLng,
      locationSource: locationData.locationSource,
      locationAccuracyM: locationData.locationAccuracyM,
      items: cartStore.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
    };

    const result = await apiPost<{ orderId: string; checkoutRequestId?: string }>(
      `/public/stores/${storeSlug.value}/orders`,
      payload
    );

    cartStore.clearCart();
    pushToast({ message: 'Order placed successfully!', variant: 'success' });

    router.push({
      name: 'storefront-order-confirmation',
      params: { storeSlug: storeSlug.value, orderId: result.orderId },
    });
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Checkout failed', variant: 'error' });
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="store-checkout-page">
    <div class="checkout-container">
      <header class="checkout-header">
        <h1 class="page-title">Checkout</h1>
        <p class="page-subtitle">Complete your fulfillment preference and details to place your order.</p>
      </header>

      <div class="checkout-layout">
        <!-- LEFT COLUMN: Progressive Checkout Steps -->
        <div class="checkout-steps-column">
          <!-- STEP 1: DELIVERY VS PICKUP -->
          <div class="step-card card">
            <div class="step-header">
              <span class="step-badge">1</span>
              <h2>Fulfillment Method</h2>
            </div>
            <DeliveryTypeStep v-model="deliveryType" @select="saveContactProgress" />
          </div>

          <!-- STEP 2: LOCATION PIN & ADDRESS (DELIVERY ONLY) -->
          <div v-if="deliveryType === 'delivery'" class="step-card card">
            <div class="step-header">
              <span class="step-badge">2</span>
              <h2>Delivery Location</h2>
            </div>
            <DeliveryLocationStep
              :initial-data="locationData"
              @confirm="handleLocationConfirmed"
            />
          </div>

          <!-- STEP 2 (ALTERNATIVE): STORE PICKUP NOTICE -->
          <div v-else class="step-card card pickup-notice-card">
            <div class="step-header">
              <span class="step-badge">2</span>
              <h2>Pickup Instructions</h2>
            </div>
            <div class="pickup-info-body">
              <Store :size="24" class="text-teal" />
              <div>
                <p class="pickup-title">Collect in-person at our physical store</p>
                <p class="pickup-address">{{ storeSettingsStore.settings?.location || 'Store location confirmed after checkout.' }}</p>
                <p class="pickup-timing">{{ storeSettingsStore.settings?.delivery_info || 'Ready for collection during normal business hours.' }}</p>
              </div>
            </div>
          </div>

          <!-- STEP 3: CONTACT & RECEIPT DETAILS -->
          <div class="step-card card">
            <div class="step-header">
              <span class="step-badge">3</span>
              <h2>Contact Information</h2>
            </div>

            <div class="form-fields">
              <div class="form-group">
                <label class="form-label">Full Name *</label>
                <div class="input-with-icon">
                  <User :size="18" class="field-icon" />
                  <input
                    v-model="customerName"
                    type="text"
                    placeholder="e.g. Kiprono Koech"
                    class="form-input"
                    @blur="saveContactProgress"
                  />
                </div>
              </div>

              <div class="form-group-row">
                <div class="form-group flex-1">
                  <label class="form-label">Phone Number * (For Delivery &amp; M-Pesa)</label>
                  <div class="input-with-icon">
                    <Phone :size="18" class="field-icon" />
                    <input
                      v-model="customerPhone"
                      type="tel"
                      placeholder="07XXXXXXXX or 01XXXXXXXX"
                      class="form-input"
                      :class="{ 'form-input--error': phoneError }"
                      @blur="saveContactProgress"
                    />
                  </div>
                  <p v-if="phoneError" class="field-error-text">
                    <AlertCircle :size="12" /> {{ phoneError }}
                  </p>
                </div>

                <div class="form-group flex-1">
                  <label class="form-label">Email (Optional)</label>
                  <div class="input-with-icon">
                    <Mail :size="18" class="field-icon" />
                    <input
                      v-model="customerEmail"
                      type="email"
                      placeholder="name@email.com"
                      class="form-input"
                      @blur="saveContactProgress"
                    />
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label LLP Special Delivery / Order Instructions (Optional)</label>
                <div class="input-with-icon input-with-icon--textarea">
                  <FileText :size="18" class="field-icon field-icon--top" />
                  <textarea
                    v-model="notes"
                    placeholder="e.g. Gate code, call when at junction, landmark details"
                    class="form-textarea"
                    rows="2"
                    @blur="saveContactProgress"
                  />
                </div>
              </div>
           
          </div>

          <!-- STEP 4: PAYMENT METHOD -->
          <div class="step-card card">
            <div class="step-header">
              <span class="step-badge">4</span>
              <h2>Payment Preference</h2>
            </div>

            <div class="payment-selection-column">
              <!-- Online STK Push (When Merchant Till is Verified) -->
              <label v-if="isMpesaVerified" class="payment-choice">
                <input type="radio" value="mpesa_direct" v-model="paymentMethod" @change="saveContactProgress" />
                <span class="payment-choice-box" :class="{ active: paymentMethod === 'mpesa_direct' }">
                  <Zap :size="20" class="text-teal" />
                  <div>
                    <span class="choice-title">Direct M-Pesa (Online STK Prompt)</span>
                    <span class="choice-desc">You will receive an instant M-Pesa PIN prompt on your phone.</span>
                  </div>
                </span>
              </label>

              <!-- Cash / Manual Coordination -->
              <label class="payment-choice">
                <input type="radio" value="mpesa_cash" v-model="paymentMethod" @change="saveContactProgress" />
                <span class="payment-choice-box" :class="{ active: paymentMethod === 'mpesa_cash' }">
                  <CreditCard :size="20" class="text-ink" />
                  <div>
                    <span class="choice-title">
                      {{ deliveryType === 'delivery' ? 'Cash on Delivery / Manual M-Pesa' : 'Pay at Store Pickup' }}
                    </span>
                    <span class="choice-desc">Pay upon handover or coordinate directly with the merchant.</span>
                  </div>
                </span>
              </label>
            </div>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN: Order Summary & Place Order -->
        <div class="checkout-summary-column">
          <div class="summary-card card">
            <div class="summary-card-header">
              <h2 class="summary-title">Order Summary</h2>
              <button
                type="button"
                class="items-toggle-btn"
                @click="showItemsSummary = !showItemsSummary"
              >
                <span>{{ cartStore.totalItems }} items</span>
                <component :is="showItemsSummary ? ChevronUp : ChevronDown" :size="16" />
              </button>
            </div>

            <!-- Collapsible Items List -->
            <div v-if="showItemsSummary" class="review-items">
              <div v-for="item in cartStore.items" :key="item.product_id" class="review-item">
                <span class="review-item-name">
                  {{ item.name }} <span class="text-muted">× {{ item.quantity }}</span>
                </span>
                <span class="tabular-figure">{{ formatCurrency(item.price * item.quantity) }}</span>
              </div>
            </div>

            <div class="summary-cost-rows">
              <div class="cost-row">
                <span>Subtotal</span>
                <span class="tabular-figure">{{ formatCurrency(cartStore.subtotal) }}</span>
              </div>

              <div class="cost-row">
                <span>Fulfillment ({{ deliveryType === 'delivery' ? 'Delivery' : 'Pickup' }})</span>
                <span v-if="deliveryType === 'pickup'" class="cost-badge cost-badge--free">FREE</span>
                <span v-else class="cost-badge cost-badge--notice">Confirmed by Merchant</span>
              </div>

              <div class="cost-row cost-row--total">
                <span class="total-label">Estimated Total</span>
                <span class="total-amount tabular-figure text-ink">{{ formatCurrency(cartStore.subtotal) }}</span>
              </div>
            </div>

            <div class="secure-trust-badge">
              <ShieldCheck :size="16" class="text-teal" />
              <span>Direct merchant fulfillment with verified handover</span>
            </div>

            <Button
              variant="primary"
              size="lg"
              class="place-order-btn"
              :disabled="!isReadyToPlaceOrder || isSubmitting"
              :loading="isSubmitting"
              @click="handlePlaceOrder"
            >
              Place Order • {{ formatCurrency(cartStore.subtotal) }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.store-checkout-page {
  padding: var(--space-8) var(--space-4);
  min-height: 80vh;
}

.checkout-container {
  max-width: 1050px;
  margin: 0 auto;
}

.checkout-header {
  margin-bottom: var(--space-6);
}

.page-title {
  font-family: var(--font-display);
  font-size: var(--text-3xl);
  color: var(--color-text);
}

.page-subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-top: var(--space-1);
}

.checkout-layout {
  display: flex;
  gap: var(--space-6);
  flex-direction: column;
}

@media (min-width: 860px) {
  .checkout-layout {
    flex-direction: row;
    align-items: flex-start;
  }
}

.checkout-steps-column {
  flex: 1.5;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  min-width: 0;
}

.checkout-summary-column {
  flex: 1;
  min-width: 0;
  position: sticky;
  top: 90px;
}

.step-card,
.summary-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.step-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-3);
}

.step-badge {
  width: 26px;
  height: 26px;
  background: var(--color-ink);
  color: var(--color-text-inverse);
  font-size: var(--text-xs);
  font-weight: 700;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-header h2 {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  color: var(--color-text);
}

.pickup-info-body {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.pickup-title {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-text);
}

.pickup-address {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-top: 2px;
}

.pickup-timing {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-top: 2px;
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-group-row {
  display: flex;
  gap: var(--space-4);
  flex-direction: column;
}

@media (min-width: 640px) {
  .form-group-row {
    flex-direction: row;
  }
}

.flex-1 {
  flex: 1;
}

.form-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.input-with-icon {
  position: relative;
  display: flex;
  align-items: center;
}

.field-icon {
  position: absolute;
  left: var(--space-3);
  color: var(--color-text-muted);
  pointer-events: none;
}

.field-icon--top {
  top: var(--space-3);
}

.form-input,
.form-textarea {
  width: 100%;
  min-height: 44px;
  padding: 0 var(--space-4) 0 calc(var(--space-8) + var(--space-2));
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--color-text);
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-standard);
}

.form-textarea {
  padding: var(--space-3) var(--space-4) var(--space-3) calc(var(--space-8) + var(--space-2));
  resize: vertical;
}

.form-input:focus,
.form-textarea:focus {
  border-color: var(--color-ink);
}

.form-input--error {
  border-color: var(--color-market-clay);
}

.field-error-text {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-xs);
  color: var(--color-market-clay);
  margin-top: 2px;
}

.payment-selection-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.payment-choice {
  width: 100%;
  cursor: pointer;
}

.payment-choice input {
  display: none;
}

.payment-choice-box {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: border-color var(--duration-fast) var(--ease-standard);
}

.payment-choice-box.active {
  border-color: var(--brand-primary);
  background: color-mix(in srgb, var(--brand-primary) 8%, transparent);
}

.choice-title {
  display: block;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text);
}

.choice-desc {
  display: block;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-top: 2px;
}

/* Summary Card */
.summary-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-3);
}

.summary-title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  color: var(--color-text);
}

.items-toggle-btn {
  background: transparent;
  border: none;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.review-items {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-height: 200px;
  overflow-y: auto;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}

.review-item {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.review-item-name {
  color: var(--color-text);
}

.summary-cost-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.cost-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.cost-row--total {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-3);
  margin-top: var(--space-1);
  font-weight: 700;
  font-size: var(--text-base);
}

.cost-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

.cost-badge--free {
  background: color-mix(in srgb, var(--color-ledger-green) 15%, transparent);
  color: var(--color-ledger-green);
}

.cost-badge--notice {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

.secure-trust-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  background: var(--color-bg);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
}

.place-order-btn {
  width: 100%;
}

.text-teal {
  color: var(--color-ledger-green);
}
.text-ink {
  color: var(--color-ink);}
  </style>