<script setup lang="ts">
// =============================================================================
// src/components/ui/Skeleton.vue
// =============================================================================

interface Props {
  width?: string;
  height?: string;
  radius?: string;
}

withDefaults(defineProps<Props>(), {
  width: '100%',
  height: '16px',
  radius: 'var(--radius-md)',
});
</script>

<template>
  <div
    class="skeleton"
    :style="{ width, height, borderRadius: radius }"
    aria-hidden="true"
  />
</template>

<style scoped>
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-border) 25%,
    var(--color-bg) 50%,
    var(--color-border) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer var(--duration-slow) ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Static fallback — a shimmer that never settles is exactly the kind
   of motion prefers-reduced-motion exists to suppress. */
@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
    background: var(--color-border);
  }
}
</style>