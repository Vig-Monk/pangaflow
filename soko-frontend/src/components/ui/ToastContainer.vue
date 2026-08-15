<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/ui/ToastContainer.vue
// =============================================================================

import { useToast } from '@/composables/useToast';
import Toast from './Toast.vue';

const { toasts, dismiss } = useToast();
</script>

<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite">
      <TransitionGroup name="toast-list">
        <Toast
          v-for="toast in toasts"
          :key="toast.id"
          :toast="toast"
          @dismiss="dismiss"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  z-index: 200;
  pointer-events: none;
}

.toast-container :deep(.toast) {
  pointer-events: auto;
}

.toast-list-enter-active,
.toast-list-leave-active {
  transition: opacity var(--duration-base) var(--ease-standard),
              transform var(--duration-base) var(--ease-standard);
}
.toast-list-enter-from,
.toast-list-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
.toast-list-leave-active {
  position: absolute;
}

@media (prefers-reduced-motion: reduce) {
  .toast-list-enter-active,
  .toast-list-leave-active {
    transition: none;
  }
}

@media (max-width: 640px) {
  .toast-container {
    left: var(--space-4);
    right: var(--space-4);
    bottom: var(--space-4);
  }

  .toast-container :deep(.toast) {
    max-width: none;
    min-width: 0;
  }
}
</style>