<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/PlanView.vue (PROMPT 16)
// Clean visual hierarchy for plan management and tiers.
// =============================================================================

import { computed, onMounted } from 'vue';
import { useOrgStore } from '@/stores/org';
import { useCustomersStore } from '@/stores/customers';
import { useTheme } from '@/composables/useTheme';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import UpgradeModal from '@/components/ledger/UpgradeModal.vue';
import type { PlanName } from '@/stores/org';
import { Sun, Moon, Check } from 'lucide-vue-next';

const orgStore = useOrgStore();
const customersStore = useCustomersStore();
const { theme, toggle } = useTheme();

onMounted(() => {
  customersStore.fetchList({ page: 1 });
});

interface PlanTier {
  name: PlanName;
  label: string;
  priceKes: number;
  customerLimit: number | null;
  features: string[];
}

const planTiers: PlanTier[] = [
  {
    name: 'free',
    label: 'Free',
    priceKes: 0,
    customerLimit: 10,
    features: ['Up to 10 customers', 'Credit ledger', 'M-Pesa payments'],
  },
  {
    name: 'pro',
    label: 'Pro',
    priceKes: 500,
    customerLimit: null,
    features: ['Unlimited customers', 'Expense tracking', 'Profit & loss reports'],
  },
  {
    name: 'business',
    label: 'Business',
    priceKes: 2499,
    customerLimit: null,
    features: ['Everything in Pro', 'Multi-user access', 'Priority support'],
  },
];

const currentPlan = computed<PlanName>(() => orgStore.plan ?? 'free');
const currentTier = computed<PlanTier>(
  () => planTiers.find((t) => t.name === currentPlan.value) ?? planTiers[0]
);

const usageCount = computed<number>(() => customersStore.total);
const usageLimit = computed<number | null>(() => currentTier.value.customerLimit);
const usagePercent = computed<number>(() => {
  if (usageLimit.value === null) return 0;
  return Math.min(100, (usageCount.value / usageLimit.value) * 100);
});

function formatPrice(priceKes: number): string {
  return priceKes === 0 ? 'Free' : `KES ${priceKes.toLocaleString('en-KE')}/mo`;
}

function handleUpgradeClick(): void {
  orgStore.requestUpgrade();
}
</script>

<template>
  <div class="plan-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Plan &amp; Settings</h1>
        <p class="page-subtitle">Manage subscription tiers and interface themes.</p>
      </div>
      <button
        class="theme-toggle"
        type="button"
        @click="toggle"
        :aria-label="`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`"
      >
        <Sun v-if="theme === 'dark'" :size="18" />
        <Moon v-else :size="18" />
      </button>
    </div>

    <div class="current-plan-card card">
      <div class="current-plan-card__header">
        <div>
          <span class="current-plan-card__label">Active Subscription Tier</span>
          <h2 class="current-plan-tier-name">{{ currentTier.label }} Plan</h2>
        </div>
        <Badge
          :variant="currentPlan === 'free' ? 'neutral' : 'gold'"
          :label="currentTier.label.toUpperCase()"
        />
      </div>

      <div v-if="usageLimit !== null" class="usage-block">
        <div class="usage-text-row">
          <span class="usage-title">Customer Capacity</span>
          <span class="usage-block__text tabular-figure">{{ usageCount }} / {{ usageLimit }} used</span>
        </div>
        <div class="usage-block__track">
          <div class="usage-block__fill" :style="{ width: `${usagePercent}%` }" />
        </div>
      </div>
      <p v-else class="usage-block__unlimited">✓ Unlimited customer capacity unlocked</p>
    </div>

    <section class="tiers-section">
      <h2 class="section-title">Compare Tiers</h2>
      <div class="tiers-grid">
        <div
          v-for="tier in planTiers"
          :key="tier.name"
          class="tier-card card"
          :class="{ 'tier-card--current': tier.name === currentPlan }"
        >
          <div class="tier-card__top">
            <h3 class="tier-card__name">{{ tier.label }}</h3>
            <p class="tier-card__price tabular-figure">{{ formatPrice(tier.priceKes) }}</p>
          </div>
          <ul class="tier-card__features">
            <li v-for="feature in tier.features" :key="feature">
              <Check :size="14" class="text-teal" /> {{ feature }}
            </li>
          </ul>
          <Button
            v-if="tier.name !== currentPlan"
            variant="primary"
            style="width: 100%"
            @click="handleUpgradeClick"
          >
            Upgrade Tier
          </Button>
          <Badge v-else variant="neutral" label="Current Plan" />
        </div>
      </div>
    </section>

    <UpgradeModal
      :open="orgStore.upgradeModalOpen"
      :details="orgStore.upgradeContext"
      @close="orgStore.closeUpgradeModal"
    />
  </div>
</template>

<style scoped>
.plan-page {
  padding: var(--space-6);
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.page-title { font-size: var(--text-2xl); }
.page-subtitle { font-size: var(--text-sm); color: var(--color-text-muted); margin-top: 2px; }

.theme-toggle {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  width: 44px;
  height: 44px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text);
}

.current-plan-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  margin-bottom: var(--space-8);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.current-plan-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.current-plan-card__label {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  font-weight: 600;
}

.current-plan-tier-name {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  margin-top: 2px;
}

.usage-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.usage-text-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
}

.usage-title { font-weight: 600; color: var(--color-text); }
.usage-block__text { color: var(--color-text-muted); }

.usage-block__track {
  height: 8px;
  background: var(--color-bg);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.usage-block__fill {
  height: 100%;
  background: var(--color-ink);
  border-radius: var(--radius-full);
  transition: width var(--duration-base) var(--ease-standard);
}

.usage-block__unlimited {
  font-size: var(--text-sm);
  color: var(--color-ledger-green);
  font-weight: 600;
}

.section-title {
  font-size: var(--text-lg);
  margin-bottom: var(--space-4);
}

.tiers-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}

@media (max-width: 768px) {
  .tiers-grid { grid-template-columns: 1fr; }
}

.tier-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.tier-card--current {
  border-color: var(--color-ink);
  border-width: 2px;
}

.tier-card__top {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.tier-card__name {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  color: var(--color-text);
}

.tier-card__price {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-ink);
}

.tier-card__features {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-25);
  flex: 1;
}

.tier-card__features li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.text-teal { color: var(--color-ledger-green); }
</style>