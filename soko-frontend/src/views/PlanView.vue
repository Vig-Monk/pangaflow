<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/PlanView.vue
// Merchant plan management: Free, Pro, Business & Lifetime perpetual tier.
// =============================================================================

import { computed, onMounted, ref } from 'vue';
import { useOrgStore, type PlanName } from '@/stores/org';
import { useCustomersStore } from '@/stores/customers';
import { useTheme } from '@/composables/useTheme';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import UpgradeModal from '@/components/ledger/UpgradeModal.vue';
import {
  Sun,
  Moon,
  Check,
  Sparkles,
  Crown,
  Store,
  ShieldCheck,
} from 'lucide-vue-next';

const orgStore = useOrgStore();
const customersStore = useCustomersStore();
const { theme, toggle } = useTheme();

const upgradeTargetPlan = ref<PlanName>('pro');

onMounted(() => {
  customersStore.fetchList({ page: 1 });
});

interface PlanTier {
  name: PlanName;
  label: string;
  priceKes: number;
  period: string;
  customerLimit: number | null;
  productLimit: number | null;
  features: string[];
  isPopular?: boolean;
}

const planTiers: PlanTier[] = [
  {
    name: 'free',
    label: 'Free Tier',
    priceKes: 0,
    period: 'forever',
    customerLimit: 10,
    productLimit: 20,
    features: ['Up to 10 customers', 'Up to 20 catalog products', 'Credit ledger & expenses', 'Manual M-Pesa payments'],
  },
  {
    name: 'pro',
    label: 'Pro Monthly',
    priceKes: 500,
    period: '/ mo',
    customerLimit: null,
    productLimit: null,
    features: ['Unlimited customers', 'Unlimited products', 'Storefront custom branding', 'Profit & loss reports', 'Priority support'],
    isPopular: true,
  },
  {
    name: 'business',
    label: 'Business Monthly',
    priceKes: 2499,
    period: '/ mo',
    customerLimit: null,
    productLimit: null,
    features: ['Everything in Pro', 'Multi-user staff access', 'Advanced delivery batching', 'Custom domain assistance'],
  },
  {
    name: 'lifetime',
    label: 'Lifetime License',
    priceKes: 14999,
    period: 'one-time',
    customerLimit: null,
    productLimit: null,
    features: [
      'Perpetual unlimited access',
      'No monthly renewal fees forever',
      'Unlimited customers & products',
      'White-label storefront options',
      'All future feature updates',
    ],
  },
];

const currentPlan = computed<PlanName>(() => orgStore.plan || 'free');
const currentTier = computed<PlanTier>(
  () => planTiers.find((t) => t.name === currentPlan.value) || planTiers[0]
);

const usageCount = computed<number>(() => customersStore.total);
const usageLimit = computed<number | null>(() => currentTier.value.customerLimit);
const usagePercent = computed<number>(() => {
  if (usageLimit.value === null) return 0;
  return Math.min(100, (usageCount.value / usageLimit.value) * 100);
});

function formatPrice(priceKes: number, period: string): string {
  if (priceKes === 0) return 'Free';
  return `KES ${priceKes.toLocaleString('en-KE')} ${period}`;
}

function handleUpgradeClick(plan: PlanName): void {
  upgradeTargetPlan.value = plan;
  orgStore.requestUpgrade(undefined, plan);
}
</script>

<template>
  <div class="plan-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Plan &amp; Subscription</h1>
        <p class="page-subtitle">Manage your business subscription tier and account capacity.</p>
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

    <!-- Active Plan Status Card -->
    <div class="current-plan-card card">
      <div class="current-plan-card__header">
        <div>
          <span class="current-plan-card__label">Active Subscription Tier</span>
          <div class="tier-title-row">
            <h2 class="current-plan-tier-name">{{ currentTier.label }}</h2>
            <component :is="currentPlan === 'lifetime' ? Crown : Sparkles" :size="20" class="text-gold" />
          </div>
        </div>

        <Badge
          :variant="currentPlan === 'lifetime' ? 'gold' : currentPlan === 'free' ? 'neutral' : 'success'"
          :label="currentPlan.toUpperCase()"
        />
      </div>

      <!-- Free Tier Capacity Meter -->
      <div v-if="usageLimit !== null" class="usage-block">
        <div class="usage-text-row">
          <span class="usage-title">Customer Directory Capacity</span>
          <span class="usage-block__text tabular-figure">{{ usageCount }} / {{ usageLimit }} customers used</span>
        </div>
        <div class="usage-block__track">
          <div class="usage-block__fill" :style="{ width: `${usagePercent}%` }" />
        </div>
      </div>

      <!-- Unlimited Unlocked Banner -->
      <div v-else class="unlimited-perks-row">
        <div class="perk-item">
          <ShieldCheck :size="16" class="text-teal" />
          <span>Unlimited Customer Accounts</span>
        </div>
        <div class="perk-item">
          <Store :size="16" class="text-teal" />
          <span>Unlimited Product Catalog</span>
        </div>
        <div v-if="currentPlan === 'lifetime'" class="perk-item perk-item--lifetime">
          <Crown :size="16" class="text-gold" />
          <span>Perpetual License (No Expiration)</span>
        </div>
      </div>
    </div>

    <!-- Tiers Comparison Section -->
    <section class="tiers-section">
      <h2 class="section-title">Available Business Tiers</h2>
      
      <div class="tiers-grid">
        <div
          v-for="tier in planTiers"
          :key="tier.name"
          class="tier-card card"
          :class="{
            'tier-card--current': tier.name === currentPlan,
            'tier-card--popular': tier.isPopular && tier.name !== currentPlan,
          }"
        >
          <div v-if="tier.isPopular && tier.name !== currentPlan" class="popular-ribbon">
            Recommended
          </div>

          <div class="tier-card__top">
            <div class="tier-name-row">
              <h3 class="tier-card__name">{{ tier.label }}</h3>
              <Crown v-if="tier.name === 'lifetime'" :size="18" class="text-gold" />
            </div>
            <p class="tier-card__price tabular-figure">
              {{ formatPrice(tier.priceKes, tier.period) }}
            </p>
          </div>

          <ul class="tier-card__features">
            <li v-for="feature in tier.features" :key="feature">
              <Check :size="14" class="text-teal" /> {{ feature }}
            </li>
          </ul>

          <div class="tier-card__footer">
            <Button
              v-if="tier.name !== currentPlan"
              :variant="tier.name === 'lifetime' || tier.isPopular ? 'primary' : 'secondary'"
              style="width: 100%"
              @click="handleUpgradeClick(tier.name)"
            >
              {{ tier.name === 'free' ? 'Downgrade' : tier.name === 'lifetime' ? 'Get Lifetime Access' : 'Upgrade Tier' }}
            </Button>
            <Badge v-else variant="neutral" label="Active Plan" />
          </div>
        </div>
      </div>
    </section>

    <!-- Manual M-Pesa & WhatsApp Activation Modal -->
    <UpgradeModal
      :open="orgStore.upgradeModalOpen"
      :initial-plan="upgradeTargetPlan"
      :details="orgStore.upgradeContext"
      @close="orgStore.closeUpgradeModal"
    />
  </div>
</template>

<style scoped>
.plan-page {
  padding: var(--space-6);
  max-width: 1080px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-6);
  gap: var(--space-4);
  flex-wrap: wrap;
}

.page-title { font-size: var(--text-2xl); }
.page-subtitle { font-size: var(--text-sm); color: var(--color-text-muted); margin-top: 2px; }

.theme-toggle {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  width: 40px;
  height: 40px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text);
}

/* Active Plan Card */
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
  font-weight: 700;
}

.tier-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: 2px;
}

.current-plan-tier-name {
  font-family: var(--font-display);
  font-size: var(--text-xl);
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

.usage-title { font-weight: 700; color: var(--color-text); }
.usage-block__text { color: var(--color-text-muted); }

.usage-block__track {
  height: 8px;
  background: var(--color-bg);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.usage-block__fill {
  height: 100%;
  background: var(--brand-primary);
  border-radius: var(--radius-full);
  transition: width var(--duration-base) var(--ease-standard);
}

.unlimited-perks-row {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.perk-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-text);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
}

.perk-item--lifetime {
  border-color: var(--color-gold);
  background: color-mix(in srgb, var(--color-gold) 8%, var(--color-surface));
}

/* Tiers Grid */
.section-title {
  font-size: var(--text-lg);
  margin-bottom: var(--space-4);
}

.tiers-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

@media (max-width: 960px) {
  .tiers-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .tiers-grid {
    grid-template-columns: 1fr;
  }
}

.tier-card {
  position: relative;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.tier-card--popular {
  border-color: var(--brand-primary);
}

.tier-card--current {
  border-color: var(--color-ink);
  border-width: 2px;
}

.popular-ribbon {
  position: absolute;
  top: -10px;
  right: var(--space-4);
  background: var(--brand-primary);
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  padding: 2px var(--space-3);
  border-radius: var(--radius-full);
}

.tier-card__top {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.tier-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tier-card__name {
  font-family: var(--font-display);
  font-size: var(--text-base);
  color: var(--color-text);
}

.tier-card__price {
  font-size: var(--text-lg);
  font-weight: 800;
  color: var(--color-ink);
}

.tier-card__features {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
  padding: 0;
  margin: 0;
}

.tier-card__features li {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: var(--leading-normal);
}

.tier-card__footer {
  margin-top: auto;
}

.text-teal { color: var(--color-ledger-green); }
.text-gold { color: var(--color-gold-hover); }
</style>