<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/ui/QuantityStepper.vue
// Touch-first 44px+ quantity stepper replacing native dropdown selects.
// =============================================================================

import { Minus, Plus } from 'lucide-vue-next';

interface Props {
  modelValue: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  min: 1,
  max: 99,
  disabled: false,
  size: 'md',
});

const emit = defineEmits<{
  'update:modelValue': [value: number];
  change: [value: number];
}>();

function handleDecrement(): void {
  if (props.disabled || props.modelValue <= props.min) return;
  const next = props.modelValue - 1;
  emit('update:modelValue', next);
  emit('change', next);
}

function handleIncrement(): void {
  if (props.disabled || props.modelValue >= props.max) return;
  const next = props.modelValue + 1;
  emit('update:modelValue', next);
  emit('change', next);
}

function handleDirectInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  const val = parseInt(target.value, 10);
  if (isNaN(val)) return;
  const clamped = Math.max(props.min, Math.min(props.max, val));
  emit('update:modelValue', clamped);
  emit('change', clamped);
}
</script>

<template>
  <div
    class="quantity-stepper"
    :class="[`quantity-stepper--${size}`, { 'quantity-stepper--disabled': disabled }]"
  >
    <button
      type="button"
      class="stepper-btn stepper-btn--minus"
      :disabled="disabled || modelValue <= min"
      aria-label="Decrease quantity"
      @click="handleDecrement"
    >
      <Minus :size="size === 'sm' ? 12 : 14" />
    </button>

    <input
      type="text"
      inputmode="numeric"
      :value="modelValue"
      :disabled="disabled"
      class="stepper-value tabular-figure"
      @change="handleDirectInput"
    />

    <button
      type="button"
      class="stepper-btn stepper-btn--plus"
      :disabled="disabled || modelValue >= max"
      aria-label="Increase quantity"
      @click="handleIncrement"
    >
      <Plus :size="size === 'sm' ? 12 : 14" />
    </button>
  </div>
</template>

<style scoped>
.quantity-stepper {
  display: inline-flex;
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  user-select: none;
}

.quantity-stepper--sm {
  height: 32px;
}

.quantity-stepper--md {
  height: 40px;
}

.quantity-stepper--lg {
  height: 48px;
}

.quantity-stepper--disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.stepper-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-text);
  cursor: pointer;
  height: 100%;
  aspect-ratio: 1;
  transition: all var(--duration-fast) var(--ease-standard);
  flex-shrink: 0;
}

.stepper-btn:hover:not(:disabled) {
  background: var(--color-bg);
}

.stepper-btn:active:not(:disabled) {
  background: color-mix(in srgb, var(--color-ink) 10%, transparent);
}

.stepper-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.stepper-value {
  width: 36px;
  border: none;
  background: transparent;
  text-align: center;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-text);
  outline: none;
  padding: 0;
}

.quantity-stepper--lg .stepper-value {
  width: 44px;
  font-size: var(--text-base);
}
</style>