<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/ui/PhoneInput.vue
// Live masked Kenyan phone input (07XX XXX XXX) with real-time carrier feedback.
// Always emits raw normalized 10-digit number (07XXXXXXXX) to parent v-model.
// =============================================================================

import { computed, ref, watch } from 'vue';

interface Props {
  modelValue: string;
  placeholder?: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '07XX XXX XXX',
  disabled: false,
});

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

type Carrier = 'safaricom' | 'airtel' | 'telkom' | null;

const touched = ref<boolean>(false);
const isFocused = ref<boolean>(false);

function extractDigits(input: string): string {
  let digits = (input || '').replace(/\D/g, '');

  if (digits.startsWith('254') && digits.length >= 12) {
    digits = `0${digits.slice(3)}`;
  } else if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
    digits = `0${digits}`;
  }

  return digits.slice(0, 10);
}

function formatMask(digits: string): string {
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
}

const rawDigits = ref<string>(extractDigits(props.modelValue));

const displayValue = computed(() => {
  return formatMask(rawDigits.value);
});

const detectedCarrier = computed<Carrier>(() => {
  const d = rawDigits.value;
  if (d.length < 4) return null;

  const prefix3 = d.slice(0, 3);
  const prefix4 = d.slice(0, 4);

  // Safaricom
  if (
    ['070', '071', '072', '079'].includes(prefix3) ||
    ['0740', '0741', '0742', '0743', '0745', '0746', '0748', '0757', '0758', '0759', '0768', '0769'].includes(prefix4) ||
    ['0110', '0111', '0112', '0113', '0114', '0115'].includes(prefix4)
  ) {
    return 'safaricom';
  }

  // Airtel
  if (
    ['073', '078'].includes(prefix3) ||
    ['0750', '0751', '0752', '0753', '0754', '0755', '0756'].includes(prefix4) ||
    ['0100', '0101', '0102', '0103', '0104', '0105', '0106'].includes(prefix4)
  ) {
    return 'airtel';
  }

  // Telkom
  if (prefix3 === '077') {
    return 'telkom';
  }

  return null;
});

const error = computed<string | null>(() => {
  if (!touched.value) return null;
  if (rawDigits.value.length === 0) return 'Phone number is required';
  if (!/^(07|01)\d{8}$/.test(rawDigits.value)) {
    return 'Enter a valid 10-digit number (e.g. 0712 345 678)';
  }
  return null;
});

function handleInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  const digits = extractDigits(target.value);
  rawDigits.value = digits;
  emit('update:modelValue', digits);
}

function handleFocus(): void {
  isFocused.value = true;
}

function handleBlur(): void {
  isFocused.value = false;
  touched.value = true;
  emit('update:modelValue', rawDigits.value);
}

watch(
  () => props.modelValue,
  (newVal) => {
    const digits = extractDigits(newVal);
    if (digits !== rawDigits.value) {
      rawDigits.value = digits;
    }
  }
);
</script>

<template>
  <div class="phone-input-wrapper">
    <div
      class="phone-input-field"
      :class="{
        'phone-input-field--focused': isFocused,
        'phone-input-field--error': error,
        'phone-input-field--disabled': disabled,
      }"
    >
      <span class="country-prefix">+254</span>

      <input
        type="tel"
        inputmode="numeric"
        :value="displayValue"
        :placeholder="placeholder"
        :disabled="disabled"
        class="phone-native-input"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
      />

      <!-- Carrier Network Detection Badge -->
      <div v-if="detectedCarrier" class="carrier-badge" :class="`carrier-badge--${detectedCarrier}`">
        <span class="carrier-dot"></span>
        <span class="carrier-name">{{ detectedCarrier.toUpperCase() }}</span>
      </div>
    </div>

    <p v-if="error" class="phone-error-message">{{ error }}</p>
  </div>
</template>

<style scoped>
.phone-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  width: 100%;
}

.phone-input-field {
  display: flex;
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  min-height: 44px;
  padding: 0 var(--space-3);
  transition: all var(--duration-fast) var(--ease-standard);
  position: relative;
}

.phone-input-field--focused {
  border-color: var(--color-ink);
  box-shadow: 0 0 0 1px var(--color-ink);
}

.phone-input-field--error {
  border-color: var(--color-market-clay) !important;
}

.phone-input-field--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.country-prefix {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-text-muted);
  padding-right: var(--space-2);
  border-right: 1px solid var(--color-border);
  margin-right: var(--space-2);
  flex-shrink: 0;
  user-select: none;
}

.phone-native-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-family: var(--font-mono);
  font-size: var(--text-base);
  color: var(--color-text);
  min-width: 0;
  letter-spacing: 0.04em;
}

.phone-native-input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.6;
  letter-spacing: normal;
}

.carrier-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.05em;
  flex-shrink: 0;
  user-select: none;
  animation: fadeIn var(--duration-fast) var(--ease-standard);
}

.carrier-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.carrier-badge--safaricom {
  background: color-mix(in srgb, #16A34A 12%, transparent);
  color: #16A34A;
}
.carrier-badge--safaricom .carrier-dot {
  background: #16A34A;
}

.carrier-badge--airtel {
  background: color-mix(in srgb, #DC2626 12%, transparent);
  color: #DC2626;
}
.carrier-badge--airtel .carrier-dot {
  background: #DC2626;
}

.carrier-badge--telkom {
  background: color-mix(in srgb, #D97706 12%, transparent);
  color: #D97706;
}
.carrier-badge--telkom .carrier-dot {
  background: #D97706;
}

.phone-error-message {
  font-size: var(--text-xs);
  color: var(--color-market-clay);
  margin-top: 2px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
}
</style>