<script setup lang="ts">
// =============================================================================
// src/views/LoginView.vue
// =============================================================================

import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { isRequired, isValidEmail } from '@/composables/useFormValidation';
import Button from '@/components/ui/Button.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const isSubmitting = ref(false);
const formError = ref<string | null>(null);

function validate(): string | null {
  return isValidEmail(email.value) ?? isRequired(password.value);
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
    await authStore.login(email.value.trim(), password.value);
    const redirectPath = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard';
    await router.push(redirectPath);
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Login failed';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1 class="auth-title">KauntaOS</h1>
      <p class="auth-subtitle">Log in to your account</p>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <div class="field">
          <label class="field__label" for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="email"
            class="field__input"
            :disabled="isSubmitting"
          />
        </div>

        <div class="field">
          <label class="field__label" for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="field__input"
            :disabled="isSubmitting"
          />
        </div>

        <p v-if="formError" class="error-banner" role="alert">{{ formError }}</p>

        <Button type="submit" variant="primary" size="lg" :loading="isSubmitting" style="width: 100%">
          Log In
        </Button>
      </form>

      <p class="auth-footer">
        Don't have an account?
        <RouterLink :to="{ name: 'register' }">Register</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  padding: var(--space-4);
}

.auth-card {
  width: 100%;
  max-width: 420px;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--space-8);
}

.auth-title {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 500;
  color: var(--color-ink);
  text-align: center;
}

.auth-subtitle {
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  margin-top: var(--space-1);
  margin-bottom: var(--space-6);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.field__label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--space-1);
}

.field__input {
  width: 100%;
  min-height: 44px;
  padding: 0 var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: var(--text-base);
  color: var(--color-text);
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-standard);
}
.field__input:focus { border-color: var(--color-ink); }

.error-banner {
  background: color-mix(in srgb, var(--color-market-clay) 10%, transparent);
  color: var(--color-market-clay);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.auth-footer {
  text-align: center;
  margin-top: var(--space-6);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.auth-footer a {
  color: var(--color-ink);
  font-weight: 600;
}
</style>