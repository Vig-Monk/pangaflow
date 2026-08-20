// =============================================================================
// soko-frontend/src/stores/org.ts
// Organization & Plan Store — Supports Free, Pro, Business & Lifetime tiers.
// =============================================================================

import { defineStore } from 'pinia';
import { useAuthStore } from './auth';

export type PlanName = 'free' | 'pro' | 'business' | 'lifetime';

export interface LimitReachedDetails {
  currentPlan: PlanName;
  currentCount: number;
  limit: number;
  upgradeOptions: Array<{ plan: PlanName; label: string; price_kes: number }>;
}

export const useOrgStore = defineStore('org', {
  state: () => ({
    upgradeModalOpen: false,
    upgradeContext: null as LimitReachedDetails | null,
    selectedUpgradeTier: 'pro' as PlanName,
  }),

  getters: {
    org: () => useAuthStore().org,
    plan: (): PlanName => (useAuthStore().org?.plan as PlanName) || 'free',
    orgName: (): string => useAuthStore().org?.name || 'My Store',
    businessType: (): string | undefined => useAuthStore().org?.business_type,
    isLifetime: (): boolean => useAuthStore().org?.plan === 'lifetime',
  },

  actions: {
    requestUpgrade(context?: LimitReachedDetails, defaultTier: PlanName = 'pro'): void {
      this.upgradeContext = context ?? null;
      this.selectedUpgradeTier = defaultTier;
      this.upgradeModalOpen = true;
    },

    closeUpgradeModal(): void {
      this.upgradeModalOpen = false;
      this.upgradeContext = null;
    },
  },
});