<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/storefront/CartDrawer.vue
// Slide-over cart drawer (desktop right / mobile bottom sheet) with live steppers.
// =============================================================================

import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCartStore } from '@/stores/cart';
import QuantityStepper from '@/components/ui/QuantityStepper.vue';
import Button from '@/components/ui/Button.vue';
import {
  ShoppingBag,
  X,
  Trash2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-vue-next';

interface Props {
  open: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

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

function handleProceedToCheckout(): void {
  emit('close');
  router.push({
    name: 'storefront-checkout',
    params: { storeSlug: storeSlug.value },
  });
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="open" class="drawer-backdrop" @click.self="emit('close')">
        <div
          class="cart-drawer-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Shopping Cart"
        >
          <!-- Header -->
          <header class="drawer-header">
            <div class="header-title-row">
              <ShoppingBag :size="20" class="text-ink" />
              <h2 class="drawer-title">Your Cart</h2>
              <span v-if="cartStore.totalItems > 0" class="items-count-badge tabular-figure">
                {{ cartStore.totalItems }}
              </span>
            </div>
            <button
              type="button"
              class="close-btn"
              aria-label="Close cart"
              @click="emit('close')"
            >
              <X :size="20" />
            </button>
          </header>

          <!-- Empty State -->
          <div v-if="cartStore.isEmpty" class="drawer-empty-state">
            <div class="empty-icon-wrap">
              <ShoppingBag :size="40" class="text-muted" />
            </div>
            <h3 class="empty-title">Your cart is empty</h3>
            <p class="empty-desc">Explore products in our catalog and add items you want to purchase.</p>
            <Button variant="secondary" size="md" @click="emit('close')">
              Start Shopping
            </Button>
          </div>

          <!-- Cart Items List -->
          <template v-else>
            <div class="drawer-items-list">
              <div
                v-for="item in cartStore.items"
                :key="item.product_id"
                class="drawer-item"
              >
                <div class="item-thumb">
                  <img
                    v-if="item.image_url"
                    :src="item.image_url"
                    :alt="item.name"
                    class="thumb-img"
                  />
                  <ShoppingBag v-else :size="20" class="text-muted" />
                </div>

                <div class="item-info">
                  <div class="item-title-row">
                    <h4 class="item-name">{{ item.name }}</h4>
                    <button
                      type="button"
                      class="item-delete-btn"
                      title="Remove item"
                      @click="handleRemoveItem(item.product_id)"
                    >
                      <Trash2 :size="14" />
                    </button>
                  </div>

                  <p class="item-price tabular-figure">{{ formatCurrency(item.price) }}</p>

                  <div class="item-actions">
                    <QuantityStepper
                      :model-value="item.quantity"
                      size="sm"
                      :max="10"
                      @update:model-value="(qty) => handleQuantityChange(item.product_id, qty)"
                    />
                    <span class="item-line-total tabular-figure font-semibold">
                      {{ formatCurrency(item.price * item.quantity) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer & Checkout CTA -->
            <footer class="drawer-footer">
              <div class="subtotal-row">
                <span class="subtotal-label">Subtotal</span>
                <span class="subtotal-val tabular-figure text-ink">{{ formatCurrency(cartStore.subtotal) }}</span>
              </div>

              <p class="delivery-hint">Delivery options and fees confirmed at checkout.</p>

              <div class="trust-line">
                <ShieldCheck :size="14" class="text-teal" />
                <span>Direct merchant transaction with live tracking</span>
              </div>

              <Button
                variant="primary"
                size="lg"
                class="checkout-action-btn"
                @click="handleProceedToCheckout"
              >
                Proceed to Checkout <ArrowRight :size="16" />
              </Button>
            </footer>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: flex-end;
  z-index: 1000;
}

@media (max-width: 640px) {
  .drawer-backdrop {
    align-items: flex-end;
  }
}

.cart-drawer-panel {
  background: var(--color-surface);
  width: 100%;
  max-width: 420px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

@media (max-width: 640px) {
  .cart-drawer-panel {
    max-width: 100%;
    height: 85vh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.drawer-title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-text);
}

.items-count-badge {
  background: var(--color-ink);
  color: var(--color-text-inverse);
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: var(--radius-full);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: var(--space-1);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
}
.close-btn:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

/* Empty State */
.drawer-empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-8);
  gap: var(--space-3);
}

.empty-icon-wrap {
  width: 72px;
  height: 72px;
  background: var(--color-bg);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-2);
}

.empty-title {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-text);
}

.empty-desc {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: var(--leading-relaxed);
  max-width: 260px;
}

/* Items List */
.drawer-items-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.drawer-item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  align-items: center;
}

.item-thumb {
  width: 60px;
  height: 60px;
  background: var(--color-surface);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.item-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-2);
}

.item-name {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-delete-btn {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0;
}
.item-delete-btn:hover {
  color: var(--color-market-clay);
}

.item-price {
  font-size: 11px;
  color: var(--color-text-muted);
}

.item-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}

.item-line-total {
  font-size: var(--text-xs);
  color: var(--color-text);
}

/* Footer */
.drawer-footer {
  padding: var(--space-4) var(--space-5);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.subtotal-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.subtotal-label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-weight: 600;
}

.subtotal-val {
  font-size: var(--text-lg);
  font-weight: 800;
}

.delivery-hint {
  font-size: 11px;
  color: var(--color-text-muted);
}

.trust-line {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.checkout-action-btn {
  width: 100%;
  margin-top: var(--space-2);
}

/* Animations */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity var(--duration-base) var(--ease-standard);
}

.drawer-fade-enter-active .cart-drawer-panel,
.drawer-fade-leave-active .cart-drawer-panel {
  transition: transform var(--duration-base) var(--ease-standard);
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-fade-enter-from .cart-drawer-panel {
  transform: translateX(100%);
}

@media (max-width: 640px) {
  .drawer-fade-enter-from .cart-drawer-panel {
    transform: translateY(100%);
  }
}

.text-teal { color: var(--color-ledger-green); }
.text-ink { color: var(--color-ink); }
</style>