<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/MpesaSetupView.vue
// =============================================================================

import { onMounted, onUnmounted, ref, reactive, computed } from 'vue';
import { useMpesaCredentialsStore } from '@/stores/mpesaCredentials';
import { useToast } from '@/composables/useToast';
import Button from '@/components/ui/Button.vue';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Phone,
  Key,
  Lock,
  RefreshCw,
} from 'lucide-vue-next';

const credsStore = useMpesaCredentialsStore();
const { push: pushToast } = useToast();

const form = reactive({
  tillType: 'till' as 'till' | 'paybill',
  shortcode: '',
  storeNumber: '',
  consumerKey: '',
  consumerSecret: '',
  passkey: '',
  environment: 'sandbox' as 'sandbox' | 'production',
});

const verifyPhone = ref('');
const isSaving = ref(false);
const isVerifying = ref(false);
const isPolling = ref(false);
let pollInterval: ReturnType<typeof setInterval> | undefined;

onMounted(async () => {
  await credsStore.fetchCredentials();
  if (credsStore.credentials) {
    form.tillType = credsStore.credentials.till_type;
    form.shortcode = credsStore.credentials.shortcode;
    form.storeNumber = credsStore.credentials.store_number ?? '';
    form.environment = credsStore.credentials.environment;
  }
});

onUnmounted(() => {
  stopPolling();
});

const isVerified = computed(() => credsStore.credentials?.status === 'verified');
const isFailed = computed(() => credsStore.credentials?.status === 'failed');

async function handleSave(): Promise<void> {
  if (!form.shortcode || !form.consumerKey || !form.consumerSecret || !form.passkey) {
    pushToast({ message: 'Please fill in all required credentials fields', variant: 'error' });
    return;
  }

  isSaving.value = true;
  try {
    await credsStore.saveCredentials({
      tillType: form.tillType,
      shortcode: form.shortcode.trim(),
      storeNumber: form.tillType === 'till' ? form.storeNumber.trim() || null : null,
      consumerKey: form.consumerKey.trim(),
      consumerSecret: form.consumerSecret.trim(),
      passkey: form.passkey.trim(),
      environment: form.environment,
    });
    pushToast({ message: 'Credentials saved. You can now test and verify payments.', variant: 'success' });
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Save failed', variant: 'error' });
  } finally {
    isSaving.value = false;
  }
}

async function handleStartVerification(): Promise<void> {
  if (!verifyPhone.value.trim()) {
    pushToast({ message: 'Enter your phone number to receive the test push', variant: 'error' });
    return;
  }

  isVerifying.value = true;
  try {
    const result = await credsStore.verifyCredentials(verifyPhone.value.trim());
    pushToast({ message: result.customerMessage || 'Test STK Push sent (KES 1). Enter PIN on your phone.', variant: 'info' });
    startPolling();
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Verification failed', variant: 'error' });
  } finally {
    isVerifying.value = false;
  }
}

function startPolling(): void {
  stopPolling();
  isPolling.value = true;
  let attempts = 0;

  pollInterval = setInterval(async () => {
    attempts++;
    await credsStore.fetchCredentials();

    if (credsStore.credentials?.status === 'verified') {
      stopPolling();
      pushToast({ message: 'M-Pesa Till verified and ready for live checkout!', variant: 'success' });
    } else if (credsStore.credentials?.status === 'failed') {
      stopPolling();
      pushToast({ message: credsStore.credentials.last_error || 'Verification attempt failed', variant: 'error' });
    } else if (attempts >= 20) {
      stopPolling();
      pushToast({ message: 'Verification timed out. Please try again.', variant: 'error' });
    }
  }, 3000);
}

function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = undefined;
  }
  isPolling.value = false;
}
</script>

<template>
  <div class="mpesa-setup-page">
    <header class="page-header">
      <div>
        <h1 class="page-title">Connect Your M-Pesa Account</h1>
        <p class="page-subtitle">Customers pay directly into your own Till or Paybill. Soko never holds your funds.</p>
      </div>

      <div class="status-indicator-badge">
        <span v-if="isVerified" class="status-pill status-pill--verified">
          <CheckCircle2 :size="16" /> Verified ({{ credsStore.credentials?.environment?.toUpperCase() }})
        </span>
        <span v-else-if="isFailed" class="status-pill status-pill--failed">
          <AlertTriangle :size="16" /> Verification Failed
        </span>
        <span v-else class="status-pill status-pill--pending">
          <RefreshCw :size="14" /> Setup Incomplete
        </span>
      </div>
    </header>

    <div class="setup-grid">
      <!-- Left Column: Form & Verification Test -->
      <div class="setup-form-column">
        <!-- 1. Till / Paybill Choice -->
        <section class="card setup-card">
          <h2 class="card-section-title">1. Select Account Type</h2>
          <div class="account-type-toggle">
            <label class="toggle-option" :class="{ active: form.tillType === 'till' }">
              <input type="radio" value="till" v-model="form.tillType" />
              <CreditCard :size="20" />
              <div>
                <strong>Buy Goods (Till Number)</strong>
                <p>Standard merchant retail till used for customer direct payments.</p>
              </div>
            </label>
            <label class="toggle-option" :class="{ active: form.tillType === 'paybill' }">
              <input type="radio" value="paybill" v-model="form.tillType" />
              <Key :size="20" />
              <div>
                <strong>Paybill Number</strong>
                <p>Business paybill with account number reconciliation.</p>
              </div>
            </label>
          </div>
        </section>

        <!-- 2. Credentials Form -->
        <section class="card setup-card">
          <div class="card-heading-row">
            <h2 class="card-section-title">2. Enter Daraja App Credentials</h2>
            <div class="env-toggle">
              <button
                type="button"
                class="env-btn"
                :class="{ active: form.environment === 'sandbox' }"
                @click="form.environment = 'sandbox'"
              >
                Sandbox
              </button>
              <button
                type="button"
                class="env-btn"
                :class="{ active: form.environment === 'production' }"
                @click="form.environment = 'production'"
              >
                Production
              </button>
            </div>
          </div>

          <div class="form-fields">
            <div class="form-group">
              <label class="form-label">{{ form.tillType === 'till' ? 'Till Number (Shortcode) *' : 'Paybill Number *' }}</label>
              <input v-model="form.shortcode" type="text" placeholder="e.g. 174379 or Till Number" class="form-input" />
            </div>

            <div v-if="form.tillType === 'till'" class="form-group">
              <label class="form-label">Store Number / Head Office Shortcode (Optional)</label>
              <input v-model="form.storeNumber" type="text" placeholder="If required by your Daraja app" class="form-input" />
            </div>

            <div class="form-group">
              <label class="form-label">Consumer Key *</label>
              <div class="input-with-icon">
                <Key :size="16" class="field-icon" />
                <input v-model="form.consumerKey" type="password" placeholder="From Safaricom My Apps" class="form-input" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Consumer Secret *</label>
              <div class="input-with-icon">
                <Lock :size="16" class="field-icon" />
                <input v-model="form.consumerSecret" type="password" placeholder="From Safaricom My Apps" class="form-input" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Online Passkey (STK Push) *</label>
              <textarea v-model="form.passkey" rows="2" placeholder="Passkey issued by Safaricom for this shortcode" class="form-textarea" />
            </div>
          </div>

          <div class="form-actions-right">
            <Button variant="primary" :loading="isSaving" @click="handleSave">Save Credentials</Button>
          </div>
        </section>

        <!-- 3. Test & Verification -->
        <section class="card setup-card verification-card">
          <h2 class="card-section-title">3. Test &amp; Verify Payment Pipe</h2>
          <p class="verification-desc">
            Soko will send an encrypted KES 1 test payment to your phone. Approving the prompt will verify your credentials and activate direct online checkout.
          </p>

          <div v-if="credsStore.credentials?.last_error" class="error-banner">
            <AlertTriangle :size="16" />
            <span>{{ credsStore.credentials.last_error }}</span>
          </div>

          <div class="verify-action-row">
            <div class="input-with-icon flex-1">
              <Phone :size="16" class="field-icon" />
              <input v-model="verifyPhone" type="tel" placeholder="07XXXXXXXX (Your Phone Number)" class="form-input" :disabled="isPolling" />
            </div>
            <Button variant="secondary" :loading="isVerifying || isPolling" @click="handleStartVerification">
              {{ isPolling ? 'Awaiting PIN...' : 'Send Test (KES 1)' }}
            </Button>
          </div>
        </section>
      </div>

      <!-- Right Column: Step-by-Step Instructions Guide -->
      <div class="guide-column">
        <div class="card guide-card">
          <div class="guide-header">
            <ShieldCheck :size="24" class="text-teal" />
            <h3>How to get your Daraja credentials</h3>
          </div>

          <ol class="guide-steps">
            <li>
              <strong>1. Create a Safaricom Developer Account</strong>
              <p>Go to <a href="https://developer.safaricom.co.ke" target="_blank" rel="noopener">developer.safaricom.co.ke <ExternalLink :size="12" /></a> and sign in or create an account.</p>
            </li>
            <li>
              <strong>2. Create a New App</strong>
              <p>Under <em>My Apps</em>, click <strong>Add App</strong>. Name your app (e.g. Soko Store) and enable <strong>Lipa Na M-Pesa Online (STK Push)</strong>.</p>
            </li>
            <li>
              <strong>3. Copy Consumer Key &amp; Secret</strong>
              <p>Your new app will generate a <em>Consumer Key</em> and <em>Consumer Secret</em>. Copy and paste them into the form.</p>
            </li>
            <li>
              <strong>4. Retrieve your Passkey</strong>
              <p>For sandbox testing, use the standard Safaricom test passkey. For production, request your passkey directly via the Daraja Portal or your relationship manager.</p>
            </li>
          </ol>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mpesa-setup-page {
  padding: var(--space-6);
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.page-title { font-size: var(--text-2xl); }
.page-subtitle { font-size: var(--text-sm); color: var(--color-text-muted); margin-top: 2px; }

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 700;
}
.status-pill--verified { background: color-mix(in srgb, var(--color-ledger-green) 15%, transparent); color: var(--color-ledger-green); }
.status-pill--failed { background: color-mix(in srgb, var(--color-market-clay) 15%, transparent); color: var(--color-market-clay); }
.status-pill--pending { background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text-muted); }

.setup-grid {
  display: flex;
  gap: var(--space-6);
  flex-direction: column;
}
@media (min-width: 900px) { .setup-grid { flex-direction: row; align-items: flex-start; } }

.setup-form-column { flex: 1.4; display: flex; flex-direction: column; gap: var(--space-6); }
.guide-column { flex: 1; position: sticky; top: var(--space-6); }

.setup-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.card-section-title { font-size: var(--text-base); font-weight: 700; font-family: var(--font-display); }

.account-type-toggle { display: flex; gap: var(--space-3); flex-direction: column; }
@media (min-width: 600px) { .account-type-toggle { flex-direction: row; } }

.toggle-option {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-standard);
}
.toggle-option.active { border-color: var(--color-ink); background: color-mix(in srgb, var(--color-ink) 5%, transparent); }
.toggle-option input { display: none; }
.toggle-option p { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px; }

.card-heading-row { display: flex; justify-content: space-between; align-items: center; }
.env-toggle { display: flex; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 2px; }
.env-btn { border: none; background: transparent; padding: 4px 10px; font-size: var(--text-xs); font-weight: 600; cursor: pointer; border-radius: var(--radius-sm); }
.env-btn.active { background: var(--color-ink); color: var(--color-text-inverse); }

.form-fields { display: flex; flex-direction: column; gap: var(--space-4); }
.form-group { display: flex; flex-direction: column; gap: var(--space-1); }
.form-label { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-muted); }

.input-with-icon { position: relative; display: flex; align-items: center; }
.field-icon { position: absolute; left: var(--space-3); color: var(--color-text-muted); pointer-events: none; }
.flex-1 { flex: 1; }

.form-input, .form-textarea {
  width: 100%; min-height: 44px; padding: 0 var(--space-4) 0 calc(var(--space-8) + var(--space-2));
  background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); font-size: var(--text-base); color: var(--color-text); outline: none;
}
.form-textarea { padding: var(--space-3) var(--space-4); resize: vertical; min-height: 70px; }

.form-actions-right { display: flex; justify-content: flex-end; margin-top: var(--space-2); }

.verification-desc { font-size: var(--text-sm); color: var(--color-text-muted); line-height: var(--leading-relaxed); }
.verify-action-row { display: flex; gap: var(--space-3); margin-top: var(--space-2); }

.error-banner {
  display: flex; align-items: center; gap: var(--space-2);
  background: color-mix(in srgb, var(--color-market-clay) 12%, transparent);
  color: var(--color-market-clay); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: 600;
}

.guide-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.guide-header { display: flex; align-items: center; gap: var(--space-3); }
.guide-header h3 { font-size: var(--text-base); font-weight: 600; }
.guide-steps { list-style: none; display: flex; flex-direction: column; gap: var(--space-4); padding: 0; margin: 0; }
.guide-steps li { font-size: var(--text-xs); line-height: var(--leading-relaxed); }
.guide-steps a { color: var(--color-ink); font-weight: 600; display: inline-flex; align-items: center; gap: 2px; }
.text-teal { color: var(--color-ledger-green); }
</style>