<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/ui/Button.vue (PROMPT 19 - MOTION ALIGNED)
// =============================================================================

interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  type: 'button',
});
</script>

<template>
  <button
    :type="type"
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, { 'btn--loading': loading }]"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="btn__spinner" aria-hidden="true" />
    <span class="btn__label" :class="{ 'btn__label--hidden': loading }">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: var(--font-body);
  font-weight: 600;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-standard),
              border-color var(--duration-fast) var(--ease-standard),
              opacity var(--duration-fast) var(--ease-standard),
              transform var(--duration-fast) var(--ease-standard);
  white-space: nowrap;
}

.btn:active:not(:disabled) {
  transform: scale(0.98);
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.btn--sm   { min-height: 36px; padding: 0 var(--space-3); font-size: var(--text-sm); }
.btn--md   { min-height: 44px; padding: 0 var(--space-5); font-size: var(--text-base); }
.btn--lg   { min-height: 52px; padding: 0 var(--space-6); font-size: var(--text-lg); }

.btn--primary {
  background: var(--color-ink);
  color: var(--color-text-inverse);
}
.btn--primary:hover:not(:disabled) { background: var(--color-ink-hover); }

.btn--secondary {
  background: var(--color-surface);
  color: var(--color-ink);
  border-color: var(--color-border);
}
.btn--secondary:hover:not(:disabled) { background: var(--color-bg); }

.btn--ghost {
  background: transparent;
  color: var(--color-text);
}
.btn--ghost:hover:not(:disabled) { background: var(--color-bg); }

.btn--danger {
  background: var(--color-market-clay);
  color: var(--color-text-inverse);
}
.btn--danger:hover:not(:disabled) { filter: brightness(0.92); }

.btn__label--hidden {
  visibility: hidden;
}

.btn__spinner {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: btn-spin var(--duration-slow) linear infinite;
}

@keyframes btn-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .btn {
    transition: none;
  }
  .btn:active:not(:disabled) {
    transform: none;
  }
  .btn__spinner {
    animation: none;
    border-right-color: currentColor;
    opacity: 0.6;
  }
}
</style>