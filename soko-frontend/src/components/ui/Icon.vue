<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/ui/Icon.vue
// Thin wrapper for Lucide icons to maintain design token consistency.
// =============================================================================

import type { Component } from 'vue';

interface Props {
  is: Component;
  size?: number | string;
  className?: string;
}

withDefaults(defineProps<Props>(), {
  size: 18,
  className: '',
});
</script>

<template>
  <component :is="is" :size="size" :class="['soko-icon', className]" />
</template>

<style scoped>
.soko-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: currentColor;
}
</style>