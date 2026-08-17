<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/ui/Skeleton.vue
// Accessible shimmer skeleton with dark/light mode elevation matching.
// =============================================================================

interface Props {
  width?: string;
  height?: string;
  radius?: string;
  variant?: 'text' | 'rect' | 'circle';
}

withDefaults(defineProps<Props>(), {
  width: '100%',
  height: '16px',
  radius: 'var(--radius-sm)',
  variant: 'text',
});
</script>

<template>
  <div
    class="skeleton"
    :class="`skeleton--${variant}`"
    :style="{
      width: variant === 'circle' ? height : width,
      height,
      borderRadius: variant === 'circle' ? '50%' : radius,
    }"
    aria-hidden="true"
  />
</template>

<style scoped>
.skeleton {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--color-border) 65%, transparent) 25%,
    color-mix(in srgb, var(--color-surface-hover) 85%, transparent) 50%,
    color-mix(in srgb, var(--color-border) 65%, transparent) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer var(--duration-slow) ease-in-out infinite;
  display: block;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
    background: var(--color-border);
  }
}
</style>