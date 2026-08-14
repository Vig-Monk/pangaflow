<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/storefront/StorefrontShell.vue
// =============================================================================

import { computed, watchEffect } from 'vue';
import { useRoute } from 'vue-router';
import { useStoreSettingsStore } from '@/stores/store';
import { useCartStore } from '@/stores/cart';
import { ShoppingBag } from 'lucide-vue-next';

const route = useRoute();
const storeSettingsStore = useStoreSettingsStore();
const cartStore = useCartStore();

const storeName = computed(() => storeSettingsStore.settings?.name ?? 'Soko Shop');
const storeLogo = computed(() => storeSettingsStore.settings?.logo_url);
const storeSlug = computed(() => (route.params.storeSlug as string) ?? '');

watchEffect(() => {
  if (storeSlug.value) {
    cartStore.initForStore(storeSlug.value);
  }
});

const storeHomeRoute = computed(() => ({
  name: 'storefront-home',
  params: { storeSlug: storeSlug.value }
}));

const cartRoute = computed(() => ({
  name: 'storefront-cart',
  params: { storeSlug: storeSlug.value }
}));
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
          <router-link :to="cartRoute" class="cart-btn">
            <ShoppingBag :size="18" />
            <span class="cart-text">Cart</span>
            <span v-if="cartStore.totalItems > 0" class="cart-badge tabular-figure">
              {{ cartStore.totalItems }}
            </span>
          </router-link>
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
  padding: var(--space-4);
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
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  object-fit: cover;
  border: 1px solid var(--color-border);
}

.store-name {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
}

.cart-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  background: var(--color-ink);
  color: var(--color-text-inverse);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  transition: opacity var(--duration-fast) var(--ease-standard);
}

.cart-btn:hover {
  opacity: 0.9;
}

.cart-badge {
  background: var(--color-gold);
  color: var(--color-text);
  font-size: var(--text-xs);
  padding: 0 6px;
  height: 18px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
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