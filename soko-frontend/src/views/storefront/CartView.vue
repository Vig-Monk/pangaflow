<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/storefront/CartView.vue
// Full-page cart view supporting product variant line items and compound keying.
// =============================================================================

import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCartStore } from '@/stores/cart';
import QuantityStepper from '@/components/ui/QuantityStepper.vue';
import Button from '@/components/ui/Button.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import { ShoppingBag, Trash2, ArrowRight } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const cartStore = useCartStore();

const storeSlug = computed(() => (route.params.storeSlug as string || '').toLowerCase().trim());

function formatCurrency(value: number): string {
  return `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function handleQuantityChange(productId: string, quantity: number, variantId?: string | null): void {
  cartStore.updateQuantity(productId, quantity, undefined, variantId);
}

function handleRemoveItem(productId: string, variantId?: string | null): void {
  cartStore.removeItem(productId, variantId);
}

function handleContinueShopping(): void {
  router.push({ name: 'storefront-home', params: { storeSlug: storeSlug.value } });
}

function handleProceedToCheckout(): void {
  router.push({ name: 'storefront-checkout', params: { storeSlug: storeSlug.value } });
}
</script>

<template>
  <div class="store-cart-page">
    <div class="cart-container">
      <header class="cart-header">
        <h1 class="page-title">Your Cart</h1>
      </header>

      <!-- Cart Empty State -->
      <div v-if="cartStore.isEmpty" class="empty-wrap">
        <EmptyState
          title="Your cart is empty"
          description="Explore our storefront catalog and add items you want to purchase to your shopping cart."
          action-label="Continue Shopping"
          :on-action="handleContinueShopping"
        />
      </div>

      <div v-else class="cart-layout">
        <!-- Interactive Cart List -->
        <div class="cart-items-column">
          <div class="items-list">
            <div
              v-for="item in cartStore.items"
              :key="`${item.product_id}_${item.variant_id || 'base'}`"
              class="item-card card"
            >
              <div class="item-card__media">
                <img v-if="item.image_url" :src="item.image_url" :alt="item.name" class="item-img" />
                <div v-else class="item-placeholder">
                  <ShoppingBag :size="24" class="text-muted" />
                </div>
              </div>

              <div class="item-card__body">
                <div class="item-details">
                  <h3 class="item-name">{{ item.name }}</h3>
                  <span v-if="item.variant_title" class="item-variant-tag">
                    {{ item.variant_title }}
                  </span>
                  <p class="item-unit-price tabular-figure">{{ formatCurrency(item.price) }}</p>
                </div>

                <div class="item-actions-row">
                  <QuantityStepper
                    :model-value="item.quantity"
                    size="sm"
                    :max="item.stock !== undefined ? Math.min(10, Math.max(1, item.stock)) : 10"
                    @update:model-value="(qty) => handleQuantityChange(item.product_id, qty, item.variant_id)"
                  />

                  <button type="button" class="remove-btn" @click="handleRemoveItem(item.product_id, item.variant_id)">
                    <Trash2 :size="14" /> Remove
                  </button>
                </div>
              </div>

              <div class="item-card__total">
                <span class="item-total-price tabular-figure">
                  {{ formatCurrency(item.price * item.quantity) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Order Summary Panel -->
        <div class="cart-summary-column">
          <div class="summary-card card">
            <h2 class="summary-title">Order Summary</h2>

            <div class="summary-rows">
              <div class="summary-row">
                <span>Total Items</span>
                <span class="tabular-figure">{{ cartStore.totalItems }}</span>
              </div>
              <div class="summary-row summary-row--bold">
                <span>Subtotal</span>
                <span class="tabular-figure text-ink">{{ formatCurrency(cartStore.subtotal) }}</span>
              </div>
            </div>

            <div class="trust-delivery-note">
              <p class="trust-text">Delivery options and final calculations confirmed at checkout.</p>
            </div>

            <Button variant="primary" size="lg" style="width: 100%;" @click="handleProceedToCheckout">
              Proceed to Checkout <ArrowRight :size="18" />
            </Button>

            <Button variant="ghost" size="md" style="width: 100%; margin-top: var(--space-2);" @click="handleContinueShopping">
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.store-cart-page {
  padding: var(--space-8) var(--space-4);
  min-height: 80vh;
}

.cart-container {
  max-width: 1000px;
  margin: 0 auto;
}

.cart-header {
  margin-bottom: var(--space-6);
}

.page-title {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  color: var(--color-text);
}

.empty-wrap {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-8) 0;
}

.cart-layout {
  display: flex;
  gap: var(--space-6);
  flex-direction: column;
}

@media (min-width: 768px) {
  .cart-layout {
    flex-direction: row;
    align-items: flex-start;
  }
}

.cart-items-column { flex: 1.5; }

.items-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.item-card {
  display: flex;
  gap: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  align-items: center;
}

.item-card__media {
  width: 68px;
  height: 68px;
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.item-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-name {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-text);
}

.item-variant-tag {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  color: var(--brand-primary);
  background: color-mix(in srgb, var(--brand-primary) 8%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--brand-primary) 20%, transparent);
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  width: fit-content;
}

.item-unit-price {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.item-actions-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.remove-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}
.remove-btn:hover { color: var(--color-market-clay); }

.item-card__total {
  font-size: var(--text-sm);
  font-weight: 800;
  color: var(--color-text);
  white-space: nowrap;
}

.cart-summary-column { flex: 1; }

.summary-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.summary-title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-2);
}

.summary-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.summary-row--bold {
  font-size: var(--text-base);
  font-weight: 800;
  color: var(--color-text);
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-3);
  margin-top: var(--space-1);
}

.text-ink { color: var(--color-ink); }

.trust-delivery-note {
  padding: var(--space-1) 0;
}

.trust-text {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: var(--leading-normal);
}
</style>