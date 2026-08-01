<script setup lang="ts">
// =============================================================================
// src/views/RegisterView.vue
// =============================================================================

import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { RegisterPayload } from '@/types';

const router = useRouter();
const authStore = useAuthStore();

const name = ref<string>('');
const email = ref<string>('');
const password = ref<string>('');
const orgName = ref<string>('');
const businessType = ref<RegisterPayload['businessType']>('core');

const isSubmitting = ref<boolean>(false);
const formError = ref<string | null>(null);

const businessTypeOptions: Array<{ value: RegisterPayload['businessType']; label: string }> = [
  { value: 'core', label: 'General / Other' },
  { value: 'shop', label: 'Shop / Retail' },
  { value: 'salon', label: 'Salon / Beauty' },
  { value: 'stays', label: 'Stays / Rental' },
  { value: 'market', label: 'Market Trader' },
];

function validate(): string | null {
  if (name.value.trim().length === 0) return 'Please enter your name';
  if (email.value.trim().length === 0) return 'Please enter your email';
  if (password.value.length < 8) return 'Password must be at least 8 characters';
  if (orgName.value.trim().length === 0) return 'Please enter your business name';
  return null;
}

async function handleSubmit(): Promise<void> {
  const validationError = validate();
  if (validationError) {
    formError.value = validationError;
    return;
  }

  isSubmitting.value = true;
  formError.value = null;

  try {
    await authStore.register({
      name: name.value.trim(),
      email: email.value.trim(),
      password: password.value,
      orgName: orgName.value.trim(),
      businessType: businessType.value,
    });

    await router.push('/');
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Registration failed';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="auth-screen">
    <div class="auth-card card">
      <h1 class="auth-title">Soko</h1>
      <p class="auth-subtitle text-muted">Create your business account</p>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <input
          v-model="name"
          type="text"
          autocomplete="name"
          placeholder="Your full name"
          class="input-field"
          :disabled="isSubmitting"
        />
        <input
          v-model="email"
          type="email"
          inputmode="email"
          autocomplete="email"
          placeholder="Email address"
          class="input-field"
          :disabled="isSubmitting"
        />
        <input
          v-model="password"
          type="password"
          autocomplete="new-password"
          placeholder="Password (min. 8 characters)"
          class="input-field"
          :disabled="isSubmitting"
        />
        <input
          v-model="orgName"
          type="text"
          placeholder="Business name"
          class="input-field"
          :disabled="isSubmitting"
        />
        <select v-model="businessType" class="input-field" :disabled="isSubmitting">
          <option
            v-for="option in businessTypeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>

        <p v-if="formError" class="form-error text-danger">{{ formError }}</p>

        <button type="submit" class="btn-primary" :disabled="isSubmitting">
          {{ isSubmitting ? 'Creating account…' : 'Create Account' }}
        </button>
      </form>

      <p class="auth-footer text-muted">
        Already have an account?
        <RouterLink to="/login">Log In</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-screen {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.auth-card {
  width: 100%;
  max-width: 400px;
}

.auth-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-teal);
  text-align: center;
}

.auth-subtitle {
  text-align: center;
  margin-top: 4px;
  margin-bottom: 24px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-error {
  font-size: 14px;
}

.auth-footer {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
}
</style>