<script setup lang="ts">
// =============================================================================
// src/components/ui/Badge.vue
// Pill shape, tinted background (12% opacity of the variant color) +
// full-opacity dot + text — never a solid color block, per design.md §1.3.
// =============================================================================

interface Props {
  variant?: 'success' | 'danger' | 'warning' | 'neutral' | 'gold';
  label: string;
}

withDefaults(defineProps<Props>(), {
  variant: 'neutral',
});
</script>

<template>
  <span class="badge" :class="`badge--${variant}`">
    <span class="badge__dot" aria-hidden="true" />
    {{ label }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ---------- Variants — 12% tint background, full-opacity dot/text ---------- */
.badge--success {
  background: color-mix(in srgb, var(--color-ledger-green) 12%, transparent);
  color: var(--color-ledger-green);
}
.badge--success .badge__dot { background: var(--color-ledger-green); }

.badge--danger {
  background: color-mix(in srgb, var(--color-market-clay) 12%, transparent);
  color: var(--color-market-clay);
}
.badge--danger .badge__dot { background: var(--color-market-clay); }

.badge--warning {
  background: color-mix(in srgb, var(--color-info) 12%, transparent);
  color: var(--color-info);
}
.badge--warning .badge__dot { background: var(--color-info); }

.badge--gold {
  background: color-mix(in srgb, var(--color-gold) 12%, transparent);
  color: var(--color-gold-hover);
}
.badge--gold .badge__dot { background: var(--color-gold); }

.badge--neutral {
  background: var(--color-bg);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}
.badge--neutral .badge__dot { background: var(--color-text-muted); }
</style>