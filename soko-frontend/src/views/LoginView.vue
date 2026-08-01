<script setup lang="ts">
// =============================================================================
// src/views/LoginView.vue
// =============================================================================

import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const email = ref<string>('');
const password = ref<string>('');
const isSubmitting = ref<boolean>(false);
const formError = ref<string | null>(null);

async function handleSubmit(): Promise<void> {
  if (email.value.trim().length === 0 || password.value.length === 0) {
    formError.value = 'Please enter both email and password';
    return;
  }

  isSubmitting.value = true;
  formError.value = null;

  try {
    await authStore.login({ email: email.value.trim(), password: password.value });

    const redirectPath =
      typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await router.push(redirectPath);
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Login failed';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="auth-screen">
    <div class="auth-card card">
      <h1 class="auth-title">Soko</h1>
      <p class="auth-subtitle text-muted">Log in to your account</p>

      <form class="auth-form" @submit.prevent="handleSubmit">
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
          autocomplete="current-password"
          placeholder="Password"
          class="input-field"
          :disabled="isSubmitting"
        />

        <p v-if="formError" class="form-error text-danger">{{ formError }}</p>

        <button type="submit" class="btn-primary" :disabled="isSubmitting">
          {{ isSubmitting ? 'Logging in…' : 'Log In' }}
        </button>
      </form>

      <p class="auth-footer text-muted">
        Don't have an account?
        <RouterLink to="/register">Register</RouterLink>
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