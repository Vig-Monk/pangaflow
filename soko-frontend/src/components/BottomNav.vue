<script setup lang="ts">
// =============================================================================
// src/components/BottomNav.vue
// Fixed bottom navigation — two destinations for the lite version.
// Each tap target meets --touch-min (48px) per the design system.
// =============================================================================

import { RouterLink, useRoute } from 'vue-router';
import { computed } from 'vue';

const route = useRoute();

const isDashboard = computed<boolean>(() => route.name === 'dashboard');
const isCustomers = computed<boolean>(
  () => route.name === 'customers' || route.name === 'customer-detail'
);
</script>

<template>
  <nav class="bottom-nav">
    <RouterLink to="/" class="nav-item" :class="{ active: isDashboard }">
      <span class="nav-icon">📊</span>
      <span class="nav-label">Dashboard</span>
    </RouterLink>
    <RouterLink to="/customers" class="nav-item" :class="{ active: isCustomers }">
      <span class="nav-icon">👥</span>
      <span class="nav-label">Customers</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: var(--bg-surface);
  border-top: 1px solid var(--bg-elevated);
  /* Safe-area padding for devices with a gesture bar */
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: var(--touch-min);
  padding: 8px 0;
  color: var(--color-muted);
  text-decoration: none;
}

.nav-item.active {
  color: var(--color-teal);
}

.nav-icon {
  font-size: 20px;
  line-height: 1;
}

.nav-label {
  font-size: 12px;
  font-weight: 500;
}
</style>