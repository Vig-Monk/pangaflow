<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/ui/CurrencyInput.vue
// Live currency input with comma grouping and optional quick-denomination chips.
// =============================================================================

import { computed, ref, watch } from 'vue';

interface Props {
  modelValue: number;
  placeholder?: string;
  disabled?: boolean;
  showQuickChips?: boolean;
  quickChips?: number[];
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '0',
  disabled: false,
  showQuickChips: false,
  quickChips: () => [100, 500, 1000, 2000, 5000],
});

const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

const isFocused = ref<boolean>(false);
const touched = ref<boolean>(false);

function formatNumberWithCommas(val: number | string): string {
  if (val === '' || val === 0 || isNaN(Number(val))) return '';
  const num = Number(val);
  return num.toLocaleString('en-KE', { maximumFractionDigits: 2 });
}

const rawInput = ref<string>(props.modelValue > 0 ? String(props.modelValue) : '');

const displayValue = computed<string>(() => {
  if (isFocused.value) {
    return rawInput.value;
  }
  const clean = rawInput.value.replace(/,/g, '');
  if (!clean || isNaN(Number(clean))) return '';
  return formatNumberWithCommas(clean);
});

const error = computed<string | null>(() => {
  if (!touched.value) return null;
  const numeric = parseFloat(rawInput.value.replace(/,/g, ''));
  if (rawInput.value.trim().length === 0) return 'Amount is required';
  if (isNaN(numeric) || numeric <= 0) return 'Enter an amount greater than zero';
  return null;
});

function handleInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  // Allow digits and a single decimal point
  let cleaned = target.value.replace(/[^\d.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = `${parts[0]}.${parts.slice(1).join('')}`;
  }

  rawInput.value = cleaned;
  const numeric = parseFloat(cleaned);
  emit('update:modelValue', isNaN(numeric) ? 0 : numeric);
}

function handleFocus(): void {
  isFocused.value = true;
}

function handleBlur(): void {
  isFocused.value = false;
  touched.value = true;
}

function applyQuickChip(amount: number): void {
  const current = parseFloat(rawInput.value.replace(/,/g, '')) || 0;
  const nextVal = current === 0 ? amount : current + amount;
  rawInput.value = String(nextVal);
  emit('update:modelValue', nextVal);
}

function handleClear(): void {
  rawInput.value = '';
  emit('update:modelValue', 0);
}

watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue === 0 && rawInput.value !== '') {
      rawInput.value = '';
    } else if (newValue > 0 && parseFloat(rawInput.value) !== newValue) {
      rawInput.value = String(newValue);
    }
  }
);
</script>

<template>
  <div class="currency-input-wrapper">
    <div
      class="currency-input-field"
      :class="{
        'currency-input-field--focused': isFocused,
        'currency-input-field--error': error,
        'currency-input-field--disabled': disabled,
      }"
    >
      <span class="currency-prefix">KES</span>
      <input
        type="text"
        inputmode="decimal"
        :value="displayValue"
        :placeholder="placeholder"
        :disabled="disabled"
        class="currency-native-input tabular-figure"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
      />
    </div>

    <!-- Quick Denomination Increment Chips -->
    <div v-if="showQuickChips && !disabled" class="quick-chips-row">
      <button
        v-for="chip in quickChips"
        :key="chip"
        type="button"
        class="chip-btn"
        @click="applyQuickChip(chip)"
      >
        +{{ chip.toLocaleString('en-KE') }}
      </button>
      <button
        v-if="rawInput"
        type="button"
        class="chip-btn chip-btn--clear"
        @click="handleClear"
      >
        Clear
      </button>
    </div>

    <p v-if="error" class="currency-error-message">{{ error }}</p>
  </div>
</template>

<style scoped>
.currency-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  width: 100%;
}

.currency-input-field {
  display: flex;
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  min-height: 44px;
  padding: 0 var(--space-3);
  transition: all var(--duration-fast) var(--ease-standard);
}

.currency-input-field--focused {
  border-color: var(--color-ink);
  box-shadow: 0 0 0 1px var(--color-ink);
}

.currency-input-field--error {
  border-color: var(--color-market-clay) !important;
}

.currency-input-field--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.currency-prefix {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-text-muted);
  margin-right: var(--space-2);
  flex-shrink: 0;
  user-select: none;
}

.currency-native-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-family: var(--font-mono);
  font-size: var(--text-base);
  color: var(--color-text);
  min-width: 0;
}

.currency-native-input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.6;
}

.quick-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: 2px;
}

.chip-btn {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  font-size: 11px;
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
}

.chip-btn:hover {
  border-color: var(--color-ink);
  background: color-mix(in srgb, var(--color-ink) 5%, transparent);
}

.chip-btn--clear {
  color: var(--color-market-clay);
}

.chip-btn--clear:hover {
  border-color: var(--color-market-clay);
  background: color-mix(in srgb, var(--color-market-clay) 8%, transparent);
}

.currency-error-message {
  font-size: var(--text-xs);
  color: var(--color-market-clay);
  margin-top: 2px;
}
</style>