<script setup lang="ts">
// =============================================================================
// src/components/ledger/LedgerRow.vue
// Compact transaction row. Stitch accent color by type: green = payment,
// clay = sale, gold = adjustment (matching theme.css's .stitch--* classes
// from Phase 0, defined for exactly this purpose).
// =============================================================================

interface Props {
  customerName: string;
  amount: string; // pre-formatted currency string
  type: 'sale' | 'payment' | 'adjustment';
  timestamp?: string;
  balanceAfter?: string;
}

defineProps<Props>();

const stitchClass: Record<Props['type'], string> = {
  sale: 'stitch--out',
  payment: 'stitch--in',
  adjustment: 'stitch--adjust',
};

const typeLabel: Record<Props['type'], string> = {
  sale: 'Sale',
  payment: 'Payment',
  adjustment: 'Adjustment',
};
</script>

<template>
  <div class="ledger-row stitch" :class="stitchClass[type]">
    <div class="ledger-row__info">
      <span class="ledger-row__customer">{{ customerName }}</span>
      <span class="ledger-row__type">{{ typeLabel[type] }}</span>
    </div>
    <div class="ledger-row__right">
  <span class="ledger-row__amount tabular-figure">{{ amount }}</span>
  <span v-if="timestamp || balanceAfter" class="ledger-row__timestamp">
    <template v-if="timestamp">{{ timestamp }}</template>
    <template v-if="timestamp && balanceAfter"> • </template>
    <template v-if="balanceAfter">Bal: {{ balanceAfter }}</template>
  </span>
</div>
  </div>
</template>

<style scoped>
.ledger-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}

.ledger-row__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ledger-row__customer {
  font-weight: 600;
  color: var(--color-text);
  font-size: var(--text-sm);
}

.ledger-row__type {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.ledger-row__right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.ledger-row__amount {
  font-size: var(--text-sm);
  color: var(--color-text);
}

.ledger-row__timestamp {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
</style>