<script setup lang="ts">
// =============================================================================
// src/components/ledger/StatCard.vue
// Dashboard/Expenses KPI card. default / loading (skeleton) / with delta.
// =============================================================================

import Skeleton from '@/components/ui/Skeleton.vue';

interface Props {
  label: string;
  value: string; // pre-formatted currency string — this component does no formatting itself
  loading?: boolean;
  delta?: number; // percentage change; omit entirely when the API has no comparison period
  variant?: 'default' | 'positive' | 'negative';
}

withDefaults(defineProps<Props>(), {
  loading: false,
  delta: undefined,
  variant: 'default',
});
</script>

<template>
  <div class="stat-card">
    <p class="stat-card__label">{{ label }}</p>

    <template v-if="loading">
      <Skeleton width="120px" height="32px" />
    </template>
    <template v-else>
      <p class="stat-card__value tabular-figure" :class="`stat-card__value--${variant}`">
        {{ value }}
      </p>
      <p v-if="delta !== undefined" class="stat-card__delta" :class="delta >= 0 ? 'stat-card__delta--up' : 'stat-card__delta--down'">
        {{ delta >= 0 ? '▲' : '▼' }} {{ Math.abs(delta) }}%
      </p>
    </template>
  </div>
</template>

<style scoped>
.stat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.stat-card__label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.stat-card__value {
  font-size: var(--text-3xl);
  color: var(--color-text);
}

.stat-card__value--positive { color: var(--color-ledger-green); }
.stat-card__value--negative { color: var(--color-market-clay); }

.stat-card__delta {
  font-size: var(--text-xs);
  font-weight: 600;
  margin-top: var(--space-1);
}

.stat-card__delta--up { color: var(--color-ledger-green); }
.stat-card__delta--down { color: var(--color-market-clay); }
</style>