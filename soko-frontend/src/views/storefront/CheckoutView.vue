<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/storefront/CheckoutView.vue (PROMPT 07)
// Simplified 4-step transaction checkout view.
// =============================================================================

import { computed, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCartStore } from '@/stores/cart';
import { apiPost } from '@/services/apiClient';
import { useToast } from '@/composables/useToast';
import Button from '@/components/ui/Button.vue';
import { User, Phone, Mail, MapPin, FileText, CreditCard, ShieldCheck } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const cartStore = useCartStore();
const { push: pushToast } = useToast();

const customerName = ref('');
const customerPhone = ref('');
const customerEmail = ref('');
const deliveryLocation = ref('');
const notes = ref('');
const paymentMethod = ref('mpesa_cash');

const isSubmitting = ref(false);
const storeSlug = computed(() => route.params.storeSlug as string);

onMounted(() => {
  if (cartStore.isEmpty) {
    pushToast({ message: 'Cannot checkout with an empty cart', variant: 'error' });
    router.push({ name: 'storefront-home', params: { storeSlug: storeSlug.value } });
  }
});

function formatCurrency(value: number): string {
  return `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

async function handleCheckout(): Promise<void> {
  if (!customerName.value.trim() || !customerPhone.value.trim() || !deliveryLocation.value.trim()) {
    pushToast({ message: 'Please fill out all required fields.', variant: 'error' });
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = {
      customerName: customerName.value.trim(),
      customerPhone: customerPhone.value.trim(),
      customerEmail: customerEmail.value.trim() || null,
      deliveryLocation: deliveryLocation.value.trim(),
      notes: notes.value.trim() || null,
      paymentMethod: paymentMethod.value,
      items: cartStore.items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
    };

    const result = await apiPost<{ orderId: string }>(`/public/stores/${storeSlug.value}/orders`, payload);
    
    cartStore.clearCart();
    pushToast({ message: 'Order placed successfully!', variant: 'success' });
    router.push({ name: 'storefront-order-confirmation', params: { storeSlug: storeSlug.value, orderId: result.orderId } });
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
        <h1 class="page-title">Secure Checkout</h1>
        <p class="page-subtitle">Complete your contact info and payment preference to finish placing your order.</p>
      </header>

      <div class="checkout-layout">
        
        <!-- STEPPING COLUMNS -->
        <div class="checkout-steps-column">
          
          <!-- STEP 1: YOUR DETAILS -->
          <div class="step-card card">
            <div class="step-header">
              <span class="step-badge">1</span>
              <h2>Your Details</h2>
            </div>
            
            <div class="form-fields">
              <div class="form-group">
                <label class="form-label">Full Name *</label>
                <div class="input-with-icon">
                  <User :size="18" class="field-icon" />
                  <input v-model="customerName" type="text" placeholder="e.g. Kiprono Koech" class="form-input" />
                </div>
              </div>

              <div class="form-group-row">
                <div class="form-group flex-1">
                  <label class="form-label">Phone Number *</label>
                  <div class="input-with-icon">
                    <Phone :size="18" class="field-icon" />
                    <input v-model="customerPhone" type="tel" placeholder="07XXXXXXXX" class="form-input" />
                  </div>
                </div>
                <div class="form-group flex-1">
                  <label class="form-label">Email (Optional)</label>
                  <div class="input-with-icon">
                    <Mail :size="18" class="field-icon" />
                    <input v-model="customerEmail" type="email" placeholder="email@address.com" class="form-input" />
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Delivery Location Address *</label>
                <div class="input-with-icon">
                  <MapPin :size="18" class="field-icon" />
                  <input v-model="deliveryLocation" type="text" placeholder="Apartment / Road / Area Details" class="form-input" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Delivery Instructions (Optional)</label>
                <div class="input-with-icon input-with-icon--textarea">
                  <FileText :size="18" class="field-icon field-icon--top" />
                  <textarea v-model="notes" placeholder="e.g. Leave with gatekeeper or call before delivery" class="form-textarea" rows="2" />
                </div>
              </div>
            </div>
          </div>

          <!-- STEP 2: PAYMENT METHOD -->
          <div class="step-card card">
            <div class="step-header">
              <span class="step-badge">2</span>
              <h2>Payment Method</h2>
            </div>

            <div class="payment-selection-row">
              <label class="payment-choice">
                <input type="radio" value="mpesa_cash" v-model="paymentMethod" />
                <span class="payment-choice-box">
                  <CreditCard :size="20" class="text-ink" />
                  <div>
                    <span class="choice-title">M-Pesa / Cash on Delivery</span>
                    <span class="choice-desc">Pay securely when items arrive or via merchant coordination.</span>
                  </div>
                </span>
              </label>
            </div>
          </div>

        </div>

        <!-- STEP 3 & 4: ORDER SUMMARY & PLACE ORDER -->
        <div class="checkout-summary-column">
          <div class="summary-card card">
            <div class="step-header">
              <span class="step-badge">3</span>
              <h2>Order Summary</h2>
            </div>
            
            <div class="review-items">
              <div v-for="item in cartStore.items" :key="item.product_id" class="review-item">
                <span class="review-item-name">{{ item.name }} <span class="text-muted">× {{ item.quantity }}</span></span>
                <span class="tabular-figure">{{ formatCurrency(item.price * item.quantity) }}</span>
              </div>
            </div>

            <div class="review-totals">
              <div class="review-total-row">
                <span>Subtotal</span>
                <span class="tabular-figure bold text-ink">{{ formatCurrency(cartStore.subtotal) }}</span>
              </div>
              <div class="secure-trust-badge">
                <ShieldCheck :size="16" class="text-teal" />
                <span>Encrypted merchant checkout transaction</span>
              </div>
            </div>

            <Button variant="primary" size="lg" style="width: 100%;" :loading="isSubmitting" @click="handleCheckout">
              Place Order
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
  max-width: 1000px;
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

/* Layout Split */
.checkout-layout {
  display: flex;
  gap: var(--space-6);
  flex-direction: column;
}

@media (min-width: 768px) {
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
}

.checkout-summary-column {
  flex: 1;
}

.step-card,
.summary-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.step-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-3);
}

.step-badge {
  width: 28px;
  height: 28px;
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
  .form-group-row { flex-direction: row; }
}

.flex-1 { flex: 1; }

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
}

.form-textarea {
  padding: var(--space-3) var(--space-4) var(--space-3) calc(var(--space-8) + var(--space-2));
  resize: vertical;
}

.form-input:focus,
.form-textarea:focus {
  border-color: var(--color-ink);
}

/* Payment Choice Box */
.payment-selection-row {
  display: flex;
}

.payment-choice {
  width: 100%;
  cursor: pointer;
}

.payment-choice input { display: none; }

.payment-choice-box {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  border-color: var(--color-ink);
  background: color-mix(in srgb, var(--color-ink) 5%, transparent);
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

/* Review Subtotals Panel */
.review-items {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-height: 240px;
  overflow-y: auto;
}

.review-item {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.review-item-name { color: var(--color-text); }

.review-totals {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.review-total-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-base);
  font-weight: 600;
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

.bold { font-weight: 700; }
.text-ink { color: var(--color-ink); }
.text-teal { color: var(--color-ledger-green); }
</style>