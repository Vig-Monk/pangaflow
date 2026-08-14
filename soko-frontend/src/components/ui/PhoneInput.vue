<script setup lang="ts">
// =============================================================================
// src/components/ui/PhoneInput.vue
//
// NORMALIZATION DIRECTION: 07XXXXXXXX — NOT 2547XXXXXXXX.
// This intentionally differs from design.md's literal text. The only
// backend endpoint that consumes a phone number today (POST
// /payments/mpesa/stk) validates with /^(07|01)\d{8}$/, which rejects
// the 2547... format entirely. Emitting 2547... here would make every
// real submission fail.
// =============================================================================

import { computed, ref, watch } from 'vue';

interface Props {
  modelValue: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const rawInput = ref<string>(props.modelValue);
const touched = ref<boolean>(false);

/**
 * Normalizes accepted input variants down to 07XXXXXXXX / 01XXXXXXXX —
 * the exact format StkPushBodySchema's regex requires. Mirrors
 * daraja.service.ts's normalizePhone() on the backend, but in the
 * OPPOSITE direction (that function converts TO 254..., because that's
 * what Safaricom's own API requires once the request reaches Daraja;
 * this component normalizes to 07... because that's what our own
 * backend's request-body VALIDATOR requires before it gets that far).
 */
function normalize(input: string): string {
  const digitsOnly = input.replace(/\D/g, '');

  if (digitsOnly.startsWith('254') && digitsOnly.length === 12) {
    return `0${digitsOnly.slice(3)}`;
  }

  if ((digitsOnly.startsWith('07') || digitsOnly.startsWith('01')) && digitsOnly.length === 10) {
    return digitsOnly;
  }

  // Doesn't cleanly match a known pattern — return the digits as typed
  // so far, un-normalized; the error computed property below will
  // report it as invalid rather than silently mangling it further.
  return digitsOnly;
}

const error = computed<string | null>(() => {
  if (!touched.value) return null;
  if (rawInput.value.trim().length === 0) return 'Phone number is required';
  if (!/^(07|01)\d{8}$/.test(rawInput.value)) {
    return 'Enter a valid Kenyan phone number (07XXXXXXXX)';
  }
  return null;
});

function handleInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  rawInput.value = target.value.replace(/[^\d]/g, '');
  emit('update:modelValue', rawInput.value);
}

function handleBlur(): void {
  touched.value = true;
  const normalized = normalize(rawInput.value);
  rawInput.value = normalized;
  emit('update:modelValue', normalized);
}

watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue !== rawInput.value) {
      rawInput.value = newValue;
    }
  }
);
</script>

<template>
  <div class="phone-input">
    <input
      type="tel"
      inputmode="tel"
      :value="rawInput"
      placeholder="07XXXXXXXX"
      class="phone-input__input"
      :class="{ 'phone-input__input--error': error }"
      @input="handleInput"
      @blur="handleBlur"
    />
    <p v-if="error" class="phone-input__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.phone-input__input {
  width: 100%;
  min-height: 44px;
  padding: 0 var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--text-base);
  color: var(--color-text);
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-standard);
}

.phone-input__input:focus {
  border-color: var(--color-ink);
}

.phone-input__input--error {
  border-color: var(--color-market-clay);
}

.phone-input__error {
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-market-clay);
}
</style>