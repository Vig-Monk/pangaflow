<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/layout/NavItem.vue
// =============================================================================

import { RouterLink, useRoute } from 'vue-router';
import type { Component } from 'vue';

interface Props {
  to: { name: string };
  label: string;
  icon: Component;
}

const props = defineProps<Props>();
const route = useRoute();

function isActive(): boolean {
  if (route.name === props.to.name) return true;
  if (props.to.name === 'customers' && route.name === 'customer-detail') return true;
  if (props.to.name === 'products' && (route.name === 'products-add' || route.name === 'product-edit')) return true;
  if (props.to.name === 'merchant-orders' && route.name === 'merchant-order-detail') return true;
  if (props.to.name === 'expenses' && route.name === 'expenses-summary') return true;
  return false;
}
</script>

<template>
  <RouterLink :to="to" class="nav-item" :class="{ 'nav-item--active': isActive() }">
    <component :is="icon" :size="18" class="nav-item__icon" aria-hidden="true" />
    <span class="nav-item__label">{{ label }}</span>
  </RouterLink>
</template>

<style scoped>
.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: var(--text-sm);
  font-weight: 500;
  border-left: 3px solid transparent;
  transition: background var(--duration-fast) var(--ease-standard),
              color var(--duration-fast) var(--ease-standard);
  min-height: 40px;
}

.nav-item:hover:not(.nav-item--active) {
  background: var(--color-bg);
  color: var(--color-text);
}

.nav-item--active {
  background: color-mix(in srgb, var(--color-ink) 8%, transparent);
  color: var(--color-ink);
  border-left-color: var(--color-gold);
  font-weight: 600;
}

.nav-item__icon {
  flex-shrink: 0;
  color: currentColor;
}
</style>