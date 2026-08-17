<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/storefront/DeliveryTypeStep.vue
// Delivery vs. Store Pickup toggle (touch-friendly 48px+ targets).
// =============================================================================

import { Bike, Store } from 'lucide-vue-next';

export type DeliveryType = 'delivery' | 'pickup';

interface Props {
  modelValue: DeliveryType;
}

defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: DeliveryType];
  select: [value: DeliveryType];
}>();

function selectType(type: DeliveryType): void {
  emit('update:modelValue', type);
  emit('select', type);
}
</script>

<template>
  <div class="delivery-type-selector">
    <div class="options-grid">
      <!-- Option 1: Doorstep Delivery -->
      <button
        type="button"
        class="type-card"
        :class="{ 'type-card--active': modelValue === 'delivery' }"
        @click="selectType('delivery')"
      >
        <div class="icon-wrap">
          <Bike :size="24" />
        </div>
        <div class="type-details">
          <div class="title-row">
            <span class="type-title">Doorstep Delivery</span>
            <span class="type-badge">Boda / Courier</span>
          </div>
          <p class="type-desc">Dispatched directly to your estate, home, or office pin.</p>
        </div>
        <div class="radio-indicator"></div>
      </button>

      <!-- Option 2: Store Pickup -->
      <button
        type="button"
        class="type-card"
        :class="{ 'type-card--active': modelValue === 'pickup' }"
        @click="selectType('pickup')"
      >
        <div class="icon-wrap">
          <Store :size="24" />
        </div>
        <div class="type-details">
          <div class="title-row">
            <span class="type-title">Store Pickup</span>
            <span class="type-badge type-badge--free">Free</span>
          </div>
          <p class="type-desc">Collect your package in person directly from the merchant's store.</p>
        </div>
        <div class="radio-indicator"></div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.delivery-type-selector {
  width: 100%;
}

.options-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

@media (min-width: 640px) {
  .options-grid {
    flex-direction: row;
  }
}

.type-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: var(--color-text);
  min-height: 72px;
  position: relative;
  transition: all var(--duration-fast) var(--ease-standard);
}

.type-card:hover {
  border-color: var(--color-text-muted);
}

.type-card--active {
  border-color: var(--brand-primary);
  background: color-mix(in srgb, var(--brand-primary) 8%, transparent);
}

.icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text);
  flex-shrink: 0;
}

.type-card--active .icon-wrap {
  background: var(--brand-primary);
  color: #FFFFFF;
  border-color: var(--brand-primary);
}

.type-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.type-title {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-text);
}

.type-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

.type-badge--free {
  background: color-mix(in srgb, var(--color-ledger-green) 15%, transparent);
  color: var(--color-ledger-green);
  border-color: transparent;
}

.type-desc {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: var(--leading-normal);
}

.radio-indicator {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  flex-shrink: 0;
  position: relative;
}

.type-card--active .radio-indicator {
  border-color: var(--brand-primary);
}

.type-card--active .radio-indicator::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  background: var(--brand-primary);
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>