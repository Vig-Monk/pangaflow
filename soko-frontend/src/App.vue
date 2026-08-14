<script setup lang="ts">
// =============================================================================
// soko-frontend/src/App.vue (UPDATED)
// =============================================================================

import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '@/components/layout/AppShell.vue';
import StorefrontShell from '@/components/storefront/StorefrontShell.vue';
import ToastContainer from '@/components/ui/ToastContainer.vue';

const route = useRoute();

const layout = computed(() => route.meta.layout);
</script>

<template>
  <div id="app-root">
    <!-- Merchant Portal administrative shell -->
    <AppShell v-if="layout === 'merchant'">
      <RouterView />
    </AppShell>
    
    <!-- Customer Public Storefront shell -->
    <StorefrontShell v-else-if="layout === 'storefront'">
      <RouterView />
    </StorefrontShell>
    
    <!-- Auth screens, login and registration flows -->
    <RouterView v-else />

    <ToastContainer />
  </div>
</template>