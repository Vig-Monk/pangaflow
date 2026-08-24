<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/storefront/CartView.vue
// Full cart page with clean item dividers, clear subtotal, and primary checkout action.
// =============================================================================

import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCartStore } from '@/stores/cart';
import QuantityStepper from '@/components/ui/QuantityStepper.vue';
import Button from '@/components/ui/Button.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import { Trash2, ArrowRight } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const cartStore = useCartStore();

const storeSlug = computed(() => (route.params.storeSlug as string || '').toLowerCase().trim());

function formatCurrency(value: number): string {
  return `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function handleQuantityChange(productId: string, quantity: number): void {
  cartStore.updateQuantity(productId, quantity);
}

function handleRemoveItem(productId: string): void {
  cartStore.removeItem(productId);
}

function handleContinueShopping(): void {
  router.push({ name: 'storefront-home', params: { storeSlug: storeSlug.value } });
}

function handleProceedToCheckout(): void {
  router.push({ name: 'storefront-checkout', params: { storeSlug: storeSlug.value } });
}
</script>

<template>
  <div class="store-cart-view">
    <div class="cart-page-container">
      <header class="cart-page-header">
        <h1 class="cart-title">Your Cart</h1>
      </header>

      <!-- Empty State -->
      <div v-if="cartStore.isEmpty" class="empty-container">
        <EmptyState
          title="Your cart is empty"
          description="Explore our catalog and add items you want to purchase."
          action-label="Continue shopping"
          :on-action="handleContinueShopping"
        />
      </div>

      <!-- Active Cart -->
      <div v-else class="cart-layout-grid">
        <!-- Items Column -->
        <div class="items-column">
          <div
            v-for="item in cartStore.items"
            :key="item.product_id"
            class="cart-row"
          >
            <div class="thumb-frame">
              <img v-if="item.image_url" :src="item.image_url" :alt="item.name" class="thumb-img" />
            </div>

            <div class="item-main">
              <div class="item-title-row">
                <span class="item-name">{{ item.name }}</span>
                <button
                  type="button"
                  class="remove-action-btn"
                  title="Remove item"
                  @click="handleRemoveItem(item.product_id)"
                >
                  <Trash2 :size="15" />
                </button>
              </div>

              <span class="unit-price font-mono">{{ formatCurrency(item.price) }}</span>

              <div class="item-stepper-row">
                <QuantityStepper
                  :model-value="item.quantity"
                  size="sm"
                  :max="10"
                  @update:model-value="(qty) => handleQuantityChange(item.product_id, qty)"
                />
                <span class="line-total font-mono">
                  {{ formatCurrency(item.price * item.quantity) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Summary Column -->
        <div class="summary-column">
          <div class="summary-box">
            <h2 class="summary-heading">Order summary</h2>

            <div class="summary-details">
              <div class="detail-line">
                <span>Items ({{ cartStore.totalItems }})</span>
                <span class="font-mono">{{ formatCurrency(cartStore.subtotal) }}</span>
              </div>
              <div class="detail-line">
                <span>Delivery</span>
                <span class="detail-sub">Calculated at checkout</span>
              </div>
              <div class="detail-line detail-line--total">
                <span>Subtotal</span>
                <span class="font-mono total-amount">{{ formatCurrency(cartStore.subtotal) }}</span>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              class="full-width"
              @click="handleProceedToCheckout"
            >
              Proceed to checkout <ArrowRight :size="16" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.store-cart-view {
  min-height: 80vh;
  padding: 48px 24px 80px;
}

@media (max-width: 640px) {
  .store-cart-view { padding: 24px 16px 60px; }
}

.cart-page-container {
  max-width: 1040px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.cart-title {
  font-family: var(--font-display, 'Fraunces', Georgia, serif);
  font-size: clamp(28px, 3.5vw, 36px);
  font-weight: 600;
  letter-spacing: -0.02em;
}

.empty-container {
  padding: 40px 0;
}

.cart-layout-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 48px;
  align-items: start;
}

@media (max-width: 860px) {
  .cart-layout-grid {
    grid-template-columns: 1fr;
    gap: 36px;
  }
}

/* Items */
.items-column {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--store-border, #E8E4E0);
}

.cart-row {
  display: flex;
  gap: 20px;
  padding: 20px 0;
  border-bottom: 1px solid var(--store-border, #E8E4E0);
}

.thumb-frame {
  width: 72px;
  height: 72px;
  background-color: var(--store-soft, #F4F1EE);
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.item-name {
  font-size: 14px;
  font-weight: 500;
}

.remove-action-btn {
  background: transparent;
  border: none;
  color: var(--store-text-muted, #8B8581);
  cursor: pointer;
  padding: 0;
}

.remove-action-btn:hover {
  color: var(--store-accent, #D91E4E);
}

.unit-price {
  font-size: 13px;
  color: var(--store-text-secondary, #6F6A67);
}

.item-stepper-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.line-total {
  font-size: 14px;
  font-weight: 600;
}

/* Summary */
.summary-column {
  position: sticky;
  top: 90px;
}

.summary-box {
  background-color: var(--store-surface, #FFFFFF);
  border: 1px solid var(--store-border, #E8E4E0);
  border-radius: 16px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.summary-heading {
  font-family: var(--font-display, 'Fraunces', Georgia, serif);
  font-size: 18px;
  font-weight: 600;
}

.summary-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-line {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: var(--store-text-secondary, #6F6A67);
}

.detail-sub {
  font-size: 12px;
  color: var(--store-text-muted, #8B8581);
}

.detail-line--total {
  border-top: 1px solid var(--store-border, #E8E4E0);
  padding-top: 16px;
  margin-top: 4px;
  color: var(--store-text, #171514);
  font-weight: 600;
}

.total-amount {
  font-size: 18px;
}

.full-width {
  width: 100%;
}
</style>