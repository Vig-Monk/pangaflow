<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/storefront/StorefrontShell.vue
// Premium customer-facing shell with scoped Light & Dark semantic design tokens,
// customer theme toggle, and slide-over cart drawer.
// =============================================================================

import { computed, watchEffect, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useStoreSettingsStore } from '@/stores/store';
import { useCartStore } from '@/stores/cart';
import { useStorefrontTheme } from '@/composables/useStorefrontTheme';
import CartDrawer from './CartDrawer.vue';
import { ShoppingBag, Sun, Moon } from 'lucide-vue-next';

const route = useRoute();
const storeSettingsStore = useStoreSettingsStore();
const cartStore = useCartStore();
const { theme, toggleTheme } = useStorefrontTheme();

const isCartDrawerOpen = ref(false);

const storeName = computed(() => storeSettingsStore.settings?.name ?? 'Store');
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

const currentYear = new Date().getFullYear();
</script>

<template>
  <div class="storefront-shell" :class="{ dark: theme === 'dark' }">
    <!-- Main Customer Header -->
    <header class="storefront-header">
      <div class="header-inner">
        <!-- Store Identity -->
        <RouterLink :to="storeHomeRoute" class="store-brand">
          <img v-if="storeLogo" :src="storeLogo" :alt="storeName" class="brand-logo-img" />
          <span class="brand-name-text">{{ storeName }}</span>
        </RouterLink>

        <!-- Header Actions: Theme Toggle & Cart -->
        <div class="header-actions">
          <!-- Customer Light / Dark Toggle -->
          <button
            type="button"
            class="theme-toggle-btn"
            :aria-label="theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"
            @click="toggleTheme"
          >
            <Sun v-if="theme === 'dark'" :size="18" />
            <Moon v-else :size="18" />
          </button>

          <!-- Cart Drawer Trigger -->
          <button
            type="button"
            class="cart-trigger-btn"
            aria-label="Shopping Cart"
            @click="isCartDrawerOpen = true"
          >
            <ShoppingBag :size="18" />
            <span class="cart-label">Cart</span>
            <span v-if="cartStore.totalItems > 0" class="cart-count-pill font-mono">
              {{ cartStore.totalItems }}
            </span>
          </button>
        </div>
      </div>
    </header>

    <!-- Page Content Slot -->
    <main class="storefront-main-body">
      <slot />
    </main>

    <!-- Minimal Customer Footer -->
    <footer class="storefront-footer">
      <div class="footer-inner">
        <p class="store-copy">&copy; {{ currentYear }} {{ storeName }}. All rights reserved.</p>
        <p class="powered-line">Powered by <strong>Soko</strong></p>
      </div>
    </footer>

    <!-- Slide-over Cart Drawer -->
    <CartDrawer
      :open="isCartDrawerOpen"
      @close="isCartDrawerOpen = false"
    />
  </div>
</template>

<style scoped>
/* =============================================================================
   SCOPED STOREFRONT SEMANTIC THEME TOKENS (LIGHT & DARK)
   ============================================================================= */
.storefront-shell {
  --store-bg: #FAFAF8;
  --store-surface: #FFFFFF;
  --store-text: #171514;
  --store-text-secondary: #6F6A67;
  --store-text-muted: #8B8581;
  --store-border: #E8E4E0;
  --store-soft: #F4F1EE;
  --store-accent: #D91E4E;
  --store-success: #168A52;
  --store-skeleton: #EDE9E5;

  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--store-bg);
  color: var(--store-text);
  font-family: var(--font-body, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  transition: background-color 200ms ease, color 200ms ease;
}

.storefront-shell.dark {
  --store-bg: #11100F;
  --store-surface: #191817;
  --store-text: #F7F4F1;
  --store-text-secondary: #C2BCB7;
  --store-text-muted: #918B86;
  --store-border: #302D2A;
  --store-soft: #211F1D;
  --store-accent: #E53B66;
  --store-success: #36B875;
  --store-skeleton: #292624;
}

/* Header */
.storefront-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background-color: var(--store-surface);
  border-bottom: 1px solid var(--store-border);
  transition: background-color 200ms ease, border-color 200ms ease;
}

.header-inner {
  max-width: 1240px;
  margin: 0 auto;
  padding: 14px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.store-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: var(--store-text);
}

.brand-logo-img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--store-border);
}

.brand-name-text {
  font-family: var(--font-display, 'Fraunces', Georgia, serif);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.theme-toggle-btn {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid var(--store-border);
  color: var(--store-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 150ms ease, border-color 150ms ease, background 150ms ease;
}

.theme-toggle-btn:hover {
  color: var(--store-text);
  background: var(--store-soft);
  border-color: var(--store-text-secondary);
}

.cart-trigger-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 1px solid var(--store-border);
  border-radius: 8px;
  padding: 8px 14px;
  color: var(--store-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}

.cart-trigger-btn:hover {
  background: var(--store-soft);
  border-color: var(--store-text-secondary);
}

.cart-label {
  display: inline;
}

@media (max-width: 480px) {
  .cart-label { display: none; }
}

.cart-count-pill {
  background: var(--store-accent);
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 99px;
  line-height: 1.3;
}

.storefront-main-body {
  flex: 1;
}

/* Footer */
.storefront-footer {
  border-top: 1px solid var(--store-border);
  background-color: var(--store-surface);
  padding: 40px 24px;
  margin-top: 60px;
  transition: background-color 200ms ease, border-color 200ms ease;
}

.footer-inner {
  max-width: 1240px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 13px;
  color: var(--store-text-muted);
}

.powered-line strong {
  color: var(--store-text);
}
</style>