<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/storefront/CartDrawer.vue
// Simplified customer slide-over cart drawer with clean dividers and typography.
// =============================================================================

import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCartStore } from '@/stores/cart';
import QuantityStepper from '@/components/ui/QuantityStepper.vue';
import Button from '@/components/ui/Button.vue';
import { X, Trash2, ArrowRight } from 'lucide-vue-next';

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
        <div class="drawer-panel" role="dialog" aria-modal="true" aria-label="Shopping cart">
          <!-- Header -->
          <header class="drawer-header">
            <h2 class="drawer-title">Your Cart ({{ cartStore.totalItems }})</h2>
            <button type="button" class="close-btn" aria-label="Close cart" @click="emit('close')">
              <X :size="20" />
            </button>
          </header>

          <!-- Empty State -->
          <div v-if="cartStore.isEmpty" class="drawer-empty">
            <p class="empty-title">Your cart is empty</p>
            <p class="empty-sub">Explore our catalog and add items you want to purchase.</p>
            <Button variant="secondary" size="md" @click="emit('close')">
              Start shopping
            </Button>
          </div>

          <!-- Items List -->
          <template v-else>
            <div class="drawer-items-list">
              <div
                v-for="item in cartStore.items"
                :key="item.product_id"
                class="cart-item-row"
              >
                <div class="item-thumb-box">
                  <img v-if="item.image_url" :src="item.image_url" :alt="item.name" class="thumb-img" />
                </div>

                <div class="item-info-col">
                  <div class="item-header-row">
                    <span class="item-name">{{ item.name }}</span>
                    <button
                      type="button"
                      class="remove-btn"
                      title="Remove item"
                      @click="handleRemoveItem(item.product_id)"
                    >
                      <Trash2 :size="14" />
                    </button>
                  </div>

                  <span class="item-unit-price font-mono">{{ formatCurrency(item.price) }}</span>

                  <div class="item-actions-row">
                    <QuantityStepper
                      :model-value="item.quantity"
                      size="sm"
                      :max="10"
                      @update:model-value="(qty) => handleQuantityChange(item.product_id, qty)"
                    />
                    <span class="item-subtotal font-mono">
                      {{ formatCurrency(item.price * item.quantity) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <footer class="drawer-footer">
              <div class="subtotal-row">
                <span class="subtotal-label">Subtotal</span>
                <span class="subtotal-val font-mono">{{ formatCurrency(cartStore.subtotal) }}</span>
              </div>
              <p class="delivery-notice">Delivery options and fees confirmed at checkout.</p>
              <Button
                variant="primary"
                size="lg"
                class="checkout-action-btn"
                @click="handleProceedToCheckout"
              >
                Proceed to checkout <ArrowRight :size="16" />
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
  z-index: 200;
}

.drawer-panel {
  background: var(--store-surface, #FFFFFF);
  color: var(--store-text, #171514);
  width: 100%;
  max-width: 420px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.16);
  transition: background 200ms ease;
}

@media (max-width: 640px) {
  .drawer-panel {
    max-width: 100%;
  }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--store-border, #E8E4E0);
}

.drawer-title {
  font-family: var(--font-display, 'Fraunces', Georgia, serif);
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--store-text-muted, #8B8581);
  cursor: pointer;
  padding: 4px;
}

.close-btn:hover {
  color: var(--store-text, #171514);
}

/* Empty State */
.drawer-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 24px;
  gap: 12px;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
}

.empty-sub {
  font-size: 13px;
  color: var(--store-text-secondary, #6F6A67);
  max-width: 260px;
  line-height: 1.5;
  margin-bottom: 12px;
}

/* Items List */
.drawer-items-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
}

.cart-item-row {
  display: flex;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid var(--store-border, #E8E4E0);
}

.item-thumb-box {
  width: 64px;
  height: 64px;
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

.item-info-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.item-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.item-name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.remove-btn {
  background: transparent;
  border: none;
  color: var(--store-text-muted, #8B8581);
  cursor: pointer;
  padding: 0;
}

.remove-btn:hover {
  color: var(--store-accent, #D91E4E);
}

.item-unit-price {
  font-size: 12px;
  color: var(--store-text-secondary, #6F6A67);
}

.item-actions-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
}

.item-subtotal {
  font-size: 13px;
  font-weight: 600;
}

/* Footer */
.drawer-footer {
  padding: 20px 24px;
  border-top: 1px solid var(--store-border, #E8E4E0);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.subtotal-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.subtotal-label {
  font-size: 14px;
  color: var(--store-text-secondary, #6F6A67);
}

.subtotal-val {
  font-size: 18px;
  font-weight: 600;
}

.delivery-notice {
  font-size: 12px;
  color: var(--store-text-muted, #8B8581);
}

.checkout-action-btn {
  width: 100%;
  background-color: var(--store-accent, #D91E4E);
  color: #FFFFFF;
  border-radius: 10px;
}

/* Animations */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 200ms ease;
}

.drawer-fade-enter-active .drawer-panel,
.drawer-fade-leave-active .drawer-panel {
  transition: transform 250ms cubic-bezier(0.16, 1, 0.3, 1);
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-fade-enter-from .drawer-panel {
  transform: translateX(100%);
}
</style>