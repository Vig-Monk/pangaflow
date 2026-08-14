<script setup lang="ts">
// =============================================================================
// src/components/ui/Toast.vue
// Single toast. Rendered by ToastContainer for each item in the queue.
// =============================================================================

import type { Toast } from '@/composables/useToast';

interface Props {
  toast: Toast;
}

defineProps<Props>();

const emit = defineEmits<{ dismiss: [id: string] }>();
</script>

<template>
  <div class="toast" :class="`toast--${toast.variant}`" role="status">
    <span class="toast__dot" aria-hidden="true" />
    <p class="toast__message">{{ toast.message }}</p>
    <button class="toast__close" type="button" aria-label="Dismiss" @click="emit('dismiss', toast.id)">
      ×
    </button>
  </div>
</template>

<style scoped>
.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  min-width: 280px;
  max-width: 400px;
}

.toast__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.toast--success .toast__dot { background: var(--color-ledger-green); }
.toast--error .toast__dot   { background: var(--color-market-clay); }
.toast--info .toast__dot    { background: var(--color-info); }

.toast__message {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--color-text);
  line-height: var(--leading-normal);
}

.toast__close {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-size: 18px;
  cursor: pointer;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
}
.toast__close:hover { background: var(--color-bg); color: var(--color-text); }
</style>