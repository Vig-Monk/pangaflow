<script setup lang="ts">
// =============================================================================
// src/views/RegisterView.vue
// =============================================================================

import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore, type RegisterBody } from '@/stores/auth';
import { isRequired, isValidEmail, minLength } from '@/composables/useFormValidation';
import Button from '@/components/ui/Button.vue';

const router = useRouter();
const authStore = useAuthStore();

const name = ref('');
const email = ref('');
const password = ref('');
const orgName = ref('');
const businessType = ref<RegisterBody['businessType']>('core');

const isSubmitting = ref(false);
const formError = ref<string | null>(null);

// Store the value, do not branch UI on it — per design.md's exact
// instruction. This array only controls what appears in the <select>;
// nothing else in this template reads businessType to change layout,
// fields, or copy.
const businessTypeOptions: Array<{ value: RegisterBody['businessType']; label: string }> = [
  { value: 'core', label: 'General / Other' },
  { value: 'shop', label: 'Shop / Retail' },
  { value: 'salon', label: 'Salon / Beauty' },
  { value: 'stays', label: 'Stays / Rental' },
  { value: 'market', label: 'Market Trader' },
];

function validate(): string | null {
  return (
    isRequired(name.value) ??
    isValidEmail(email.value) ??
    minLength(password.value, 8) ??
    isRequired(orgName.value)
  );
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
    await router.push({ name: 'dashboard' });
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Registration failed';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1 class="auth-title">Soko</h1>
      <p class="auth-subtitle">Create your business account</p>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <div class="field">
          <label class="field__label" for="name">Your name</label>
          <input id="name" v-model="name" type="text" autocomplete="name" class="field__input" :disabled="isSubmitting" />
        </div>

        <div class="field">
          <label class="field__label" for="email">Email</label>
          <input id="email" v-model="email" type="email" autocomplete="email" class="field__input" :disabled="isSubmitting" />
        </div>

        <div class="field">
          <label class="field__label" for="password">Password</label>
          <input id="password" v-model="password" type="password" autocomplete="new-password" class="field__input" :disabled="isSubmitting" />
        </div>

        <div class="field">
          <label class="field__label" for="orgName">Business name</label>
          <input id="orgName" v-model="orgName" type="text" class="field__input" :disabled="isSubmitting" />
        </div>

        <div class="field">
          <label class="field__label" for="businessType">Business type</label>
          <select id="businessType" v-model="businessType" class="field__input" :disabled="isSubmitting">
            <option v-for="opt in businessTypeOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <p v-if="formError" class="error-banner" role="alert">{{ formError }}</p>

        <Button type="submit" variant="primary" size="lg" :loading="isSubmitting" style="width: 100%">
          Create Account
        </Button>
      </form>

      <p class="auth-footer">
        Already have an account?
        <RouterLink :to="{ name: 'login' }">Log In</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Identical to LoginView.vue's <style> block — both auth views share
   the same card/field/error-banner treatment. Duplicated here rather
   than extracted into a shared class, since Vue's scoped styles don't
   share across files without a separate CSS module or global class;
   given it's ~35 lines of straightforward token-based styling, the
   duplication cost is low relative to the indirection cost of a shared
   partial for exactly two consumers. */

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