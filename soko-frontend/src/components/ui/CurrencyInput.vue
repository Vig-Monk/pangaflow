<script setup lang="ts">
// =============================================================================
// src/components/ui/CurrencyInput.vue
// =============================================================================

import { computed, ref, watch } from 'vue';

interface Props {
  modelValue: number;
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '0',
});

const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

const rawInput = ref<string>(props.modelValue > 0 ? String(props.modelValue) : '');
const isFocused = ref<boolean>(false);
const touched = ref<boolean>(false);

const error = computed<string | null>(() => {
  if (!touched.value) return null;
  const numeric = parseFloat(rawInput.value.replace(/,/g, ''));
  if (rawInput.value.trim().length === 0) return 'Amount is required';
  if (isNaN(numeric) || numeric <= 0) return 'Enter an amount greater than zero';
  return null;
});

const displayValue = computed<string>(() => {
  if (isFocused.value) {
    return rawInput.value;
  }
  const numeric = parseFloat(rawInput.value.replace(/,/g, ''));
  if (isNaN(numeric)) return rawInput.value;
  return numeric.toLocaleString('en-KE', { maximumFractionDigits: 2 });
});

function handleInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  // Strip anything that isn't a digit or a single decimal point — this
  // is a numeric-only field per design.md's spec, not a general text input.
  const cleaned = target.value.replace(/[^\d.]/g, '');
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

watch(
  () => props.modelValue,
  (newValue) => {
    // Keep internal state in sync if the parent resets modelValue
    // externally (e.g. clearing a form after successful submit).
    if (newValue === 0 && rawInput.value !== '') {
      rawInput.value = '';
    }
  }
);
</script>

<template>
  <div class="currency-input">
    <div class="currency-input__field" :class="{ 'currency-input__field--error': error }">
      <span class="currency-input__prefix">KES</span>
      <input
        type="text"
        inputmode="decimal"
        :value="displayValue"
        :placeholder="placeholder"
        class="currency-input__input"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
      />
    </div>
    <p v-if="error" class="currency-input__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.currency-input__field {
  display: flex;
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  min-height: 44px;
  padding: 0 var(--space-4);
  transition: border-color var(--duration-fast) var(--ease-standard);
}

.currency-input__field:focus-within {
  border-color: var(--color-ink);
}

.currency-input__field--error {
  border-color: var(--color-market-clay);
}

.currency-input__prefix {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-muted);
  margin-right: var(--space-2);
  flex-shrink: 0;
}

.currency-input__input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: var(--text-base);
  color: var(--color-text);
  min-width: 0;
}

.currency-input__error {
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-market-clay);
}
</style>