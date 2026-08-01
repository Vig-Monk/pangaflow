<script setup lang="ts">
// =============================================================================
// src/App.vue
// Root shell. Renders the bottom nav only when authenticated and not on
// the login/register screens, so unauthenticated users get a clean
// full-screen auth flow with no chrome.
// =============================================================================

import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import BottomNav from '@/components/BottomNav.vue';

const route = useRoute();
const authStore = useAuthStore();

const showNav = computed<boolean>(
  () =>
    authStore.isAuthenticated &&
    route.name !== 'login' &&
    route.name !== 'register' &&
    route.name !== 'agent-dashboard'  // ← standalone page, no nav chrome
);
</script>

<template>
  <div class="app-shell">
    <main class="app-content" :class="{ 'with-nav': showNav }">
      <RouterView />
    </main>
    <BottomNav v-if="showNav" />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.app-content.with-nav {
  /* Reserve space for the fixed bottom nav so content isn't hidden behind it */
  padding-bottom: 64px;
}
</style>