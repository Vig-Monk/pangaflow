<script setup lang="ts">
// =============================================================================
// KauntaOS-frontend/src/components/ledger/UpgradeModal.vue
// Manual M-Pesa upgrade modal with 1-tap WhatsApp verification relay.
// =============================================================================

import { ref, computed } from 'vue';
import { useOrgStore, type PlanName, type LimitReachedDetails } from '@/stores/org';
import { useToast } from '@/composables/useToast';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import {
  MessageSquare,
  Copy,
  Check,
  ShieldCheck,
  CreditCard,
} from 'lucide-vue-next';

interface Props {
  open: boolean;
  details?: LimitReachedDetails | null;
  initialPlan?: PlanName;
}

const props = withDefaults(defineProps<Props>(), {
  details: null,
  initialPlan: 'pro',
});

const emit = defineEmits<{ close: [] }>();

const orgStore = useOrgStore();
const { push: pushToast } = useToast();

const selectedPlan = ref<PlanName>(props.initialPlan === 'free' ? 'pro' : props.initialPlan);
const mpesaCodeInput = ref('');
const isPhoneCopied = ref(false);

// Owner Payment Details (Configurable)
const PAYMENT_PHONE = '0712345678';
const PAYMENT_NAME = 'KauntaOS Platform Operations';

interface TierOption {
  plan: PlanName;
  label: string;
  priceKes: number;
  period: string;
  badge?: string;
  desc: string;
}

const tierOptions: TierOption[] = [
  {
    plan: 'pro',
    label: 'Pro Tier',
    priceKes: 500,
    period: '/ month',
    badge: 'Popular',
    desc: 'Unlimited customers, unlimited products & storefront branding',
  },
  {
    plan: 'business',
    label: 'Business Tier',
    priceKes: 2499,
    period: '/ month',
    desc: 'Multi-user access, advanced delivery batching & custom domain support',
  },
  {
    plan: 'lifetime',
    label: 'Lifetime License',
    priceKes: 14999,
    period: 'one-time payment',
    badge: 'Best Value',
    desc: 'Perpetual unlimited access with zero recurring fees forever',
  },
];

const activeTier = computed(() => {
  return tierOptions.find((t) => t.plan === selectedPlan.value) || tierOptions[0];
});

function formatPrice(val: number): string {
  return `KES ${val.toLocaleString('en-KE')}`;
}

function copyPaymentPhone(): void {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(PAYMENT_PHONE);
    isPhoneCopied.value = true;
    pushToast({ message: 'M-Pesa phone number copied', variant: 'success' });
    setTimeout(() => {
      isPhoneCopied.value = false;
    }, 2000);
  }
}

// Pre-formatted 1-Tap WhatsApp Activation Link
const whatsappActivationUrl = computed(() => {
  const storeName = orgStore.orgName || 'My Store';
  const tierName = activeTier.value.label;
  const price = formatPrice(activeTier.value.priceKes);
  const code = mpesaCodeInput.value.trim().toUpperCase() || '[M-PESA REF CODE]';

  const message = [
    `*⭐ KauntaOS PLAN UPGRADE REQUEST*`,
    `--------------------------------`,
    `*Store:* ${storeName}`,
    `*Selected Plan:* ${tierName} (${price})`,
    `*Payment Method:* M-Pesa Send Money`,
    `*M-Pesa Ref Code:* ${code}`,
    `--------------------------------`,
    `_Please activate this account upon confirmation._`,
  ].join('\n');

  return `https://wa.me/254${PAYMENT_PHONE.slice(1)}?text=${encodeURIComponent(message)}`;
});
</script>

<template>
  <Modal :open="open" title="Upgrade Your KauntaOS Plan" @close="emit('close')">
    <div class="upgrade-modal-content">
      <!-- Plan Selector Tabs -->
      <div class="plan-tabs-row">
        <button
          v-for="opt in tierOptions"
          :key="opt.plan"
          type="button"
          class="plan-tab-btn"
          :class="{ 'plan-tab-btn--active': selectedPlan === opt.plan }"
          @click="selectedPlan = opt.plan"
        >
          <div class="tab-top">
            <span class="tab-label">{{ opt.label }}</span>
            <span v-if="opt.badge" class="tab-badge">{{ opt.badge }}</span>
          </div>
          <span class="tab-price tabular-figure">{{ formatPrice(opt.priceKes) }}</span>
        </button>
      </div>

      <!-- Active Tier Value Summary -->
      <div class="tier-summary-box card">
        <div class="summary-top">
          <div>
            <h3 class="tier-heading">{{ activeTier.label }}</h3>
            <p class="tier-desc">{{ activeTier.desc }}</p>
          </div>
          <div class="price-stack">
            <span class="price-number tabular-figure">{{ formatPrice(activeTier.priceKes) }}</span>
            <span class="price-period">{{ activeTier.period }}</span>
          </div>
        </div>
      </div>

      <!-- Step 1: Manual M-Pesa Payment Instructions -->
      <div class="instructions-card">
        <div class="section-title-row">
          <CreditCard :size="16" class="text-teal" />
          <h4>Step 1: Send Money via M-Pesa</h4>
        </div>

        <ol class="step-list">
          <li>Open <strong>M-Pesa</strong> on your phone and select <strong>Send Money</strong>.</li>
          <li>
            Send to recipient number:
            <div class="phone-copy-box">
              <span class="phone-number font-mono">{{ PAYMENT_PHONE }}</span>
              <span class="recipient-name">({{ PAYMENT_NAME }})</span>
              <button
                type="button"
                class="copy-btn"
                :class="{ 'copy-btn--copied': isPhoneCopied }"
                @click="copyPaymentPhone"
              >
                <component :is="isPhoneCopied ? Check : Copy" :size="13" />
                <span>{{ isPhoneCopied ? 'Copied' : 'Copy' }}</span>
              </button>
            </div>
          </li>
          <li>Enter exact amount: <strong>{{ formatPrice(activeTier.priceKes) }}</strong></li>
        </ol>
      </div>

      <!-- Step 2: Instant Activation via WhatsApp -->
      <div class="activation-card">
        <div class="section-title-row">
          <MessageSquare :size="16" class="text-teal" />
          <h4>Step 2: Send M-Pesa Code for Instant Activation</h4>
        </div>

        <div class="code-input-group">
          <label class="input-label">M-Pesa Transaction Code (Optional)</label>
          <input
            v-model="mpesaCodeInput"
            type="text"
            placeholder="e.g. SH12AB34CD"
            class="code-input font-mono"
          />
        </div>

        <a
          :href="whatsappActivationUrl"
          target="_blank"
          rel="noopener"
          class="whatsapp-activation-btn"
          @click="emit('close')"
        >
          <MessageSquare :size="18" /> Send M-Pesa Code via WhatsApp
        </a>

        <div class="trust-footer">
          <ShieldCheck :size="14" class="text-muted" />
          <span>Accounts are activated immediately upon payment receipt by the platform owner.</span>
        </div>
      </div>
    </div>

    <template #footer>
      <Button variant="ghost" @click="emit('close')">Maybe Later</Button>
    </template>
  </Modal>
</template>

<style scoped>
.upgrade-modal-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Plan Selection Tabs */
.plan-tabs-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}

@media (max-width: 600px) {
  .plan-tabs-row {
    grid-template-columns: 1fr;
  }
}

.plan-tab-btn {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
}

.plan-tab-btn:hover {
  border-color: var(--color-ink);
}

.plan-tab-btn--active {
  background: color-mix(in srgb, var(--brand-primary) 8%, var(--color-surface));
  border-color: var(--brand-primary);
}

.tab-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.tab-label {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-text);
}

.tab-badge {
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  background: var(--brand-primary);
  color: #FFFFFF;
  padding: 1px 4px;
  border-radius: var(--radius-sm);
}

.tab-price {
  font-size: var(--text-xs);
  font-weight: 800;
  color: var(--color-ink);
}

/* Active Summary */
.tier-summary-box {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.summary-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
}

.tier-heading {
  font-size: var(--text-base);
  font-weight: 700;
}

.tier-desc {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-top: 2px;
  max-width: 320px;
}

.price-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.price-number {
  font-size: var(--text-lg);
  font-weight: 800;
  color: var(--brand-primary);
}

.price-period {
  font-size: 10px;
  color: var(--color-text-muted);
}

/* Instructions */
.instructions-card,
.activation-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.section-title-row h4 {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text);
}

.step-list {
  list-style: decimal;
  padding-left: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text);
  margin: 0;
}

.phone-copy-box {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  margin-top: 4px;
  flex-wrap: wrap;
}

.phone-number {
  font-weight: 800;
  color: var(--color-ink);
}

.recipient-name {
  font-size: 11px;
  color: var(--color-text-muted);
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}
.copy-btn--copied {
  background: var(--color-ledger-green);
  color: #FFFFFF;
  border-color: var(--color-ledger-green);
}

/* Activation */
.code-input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.code-input {
  min-height: 40px;
  padding: 0 var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-text);
  outline: none;
}
.code-input:focus {
  border-color: var(--color-ink);
}

.whatsapp-activation-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background: var(--color-ledger-green);
  color: #FFFFFF;
  border-radius: var(--radius-md);
  padding: var(--space-3);
  font-size: var(--text-sm);
  font-weight: 700;
  text-decoration: none;
  transition: opacity var(--duration-fast) var(--ease-standard);
}
.whatsapp-activation-btn:hover {
  opacity: 0.92;
}

.trust-footer {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.text-teal { color: var(--color-ledger-green); }
</style>