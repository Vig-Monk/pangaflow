<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/storefront/StorefrontShell.vue
// Storefront shell with slide-over cart drawer overlay.
// =============================================================================

import { computed, watchEffect, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useStoreSettingsStore } from '@/stores/store';
import { useCartStore } from '@/stores/cart';
import CartDrawer from './CartDrawer.vue';
import { ShoppingBag } from 'lucide-vue-next';

const route = useRoute();
const storeSettingsStore = useStoreSettingsStore();
const cartStore = useCartStore();

const isCartDrawerOpen = ref(false);

const storeName = computed(() => storeSettingsStore.settings?.name ?? 'Soko Shop');
const storeLogo = computed(() => storeSettingsStore.settings?.logo_url);
const storeSlug = computed(() => (route.params.storeSlug as string || '').toLowerCase().trim());

watchEffect(() => {
  if (storeSlug.value) {
    cartStore.initForStore(storeSlug.value);
  }
});

const storeHomeRoute = computed(() => ({
  name: 'storefront-home',
  params: { storeSlug: storeSlug.value },
}));

function openCartDrawer(): void {
  isCartDrawerOpen.value = true;
}
</script>

<template>
  <div class="storefront-shell">
    <header class="storefront-header">
      <div class="header-content">
        <router-link :to="storeHomeRoute" class="store-branding">
          <img v-if="storeLogo" :src="storeLogo" alt="Store logo" class="store-logo" />
          <span class="store-name">{{ storeName }}</span>
        </router-link>

        <div class="header-actions">
          <button type="button" class="cart-btn" @click="openCartDrawer">
            <ShoppingBag :size="18" />
            <span class="cart-text">Cart</span>
            <span v-if="cartStore.totalItems > 0" class="cart-badge tabular-figure">
              {{ cartStore.totalItems }}
            </span>
          </button>
        </div>
      </div>
    </header>

    <main class="storefront-main">
      <slot />
    </main>

    <footer class="storefront-footer">
      <div class="footer-content">
        <p class="powered-by">Powered by <strong>Soko</strong></p>
      </div>
    </footer>

    <!-- Slide-Over Cart Drawer -->
    <CartDrawer
      :open="isCartDrawerOpen"
      @close="isCartDrawerOpen = false"
    />
  </div>
</template>

<style scoped>
.storefront-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.storefront-header {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-3) var(--space-4);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.store-branding {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  text-decoration: none;
  color: var(--color-text);
}

.store-logo {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  object-fit: cover;
  border: 1px solid var(--color-border);
}

.store-name {
  font-family: var(--font-display);
  font-size: var(--text-base);
  font-weight: 700;
}

.cart-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-ink);
  color: var(--color-text-inverse);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-standard);
}

.cart-btn:hover {
  opacity: 0.9;
}

.cart-badge {
  background: var(--brand-primary);
  color: #FFFFFF;
  font-size: 10px;
  padding: 0 6px;
  height: 18px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  margin-left: 2px;
}

.storefront-main {
  flex: 1;
}

.storefront-footer {
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  padding: var(--space-6) var(--space-4);
  text-align: center;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
}

.powered-by {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
</style>