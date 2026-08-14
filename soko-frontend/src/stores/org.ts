// =============================================================================
// src/stores/org.ts (REPLACE the entire file with this version)
// Adds a minimal state() block + requestUpgrade() — everything else
// (getters deriving from auth.ts) is unchanged from the original
// Phase 2 delivery.
// =============================================================================

import { defineStore } from 'pinia';
import { useAuthStore } from './auth';

export type PlanName = 'free' | 'pro' | 'business';

export interface LimitReachedDetails {
  currentPlan: PlanName;
  currentCount: number;
  limit: number;
  upgradeOptions: Array<{ plan: PlanName; label: string; price_kes: number }>;
}

export const useOrgStore = defineStore('org', {
  state: () => ({
    // NEW — tracks whether UpgradeModal should currently be open, and
    // what context it should render. Nothing else in this store holds
    // independent state; plan/org info is still derived via getters
    // below, exactly as in the original delivery.
    upgradeModalOpen: false,
    upgradeContext: null as LimitReachedDetails | null,
  }),

  getters: {
    org: () => useAuthStore().org,
    plan: (): PlanName | undefined => useAuthStore().org?.plan as PlanName | undefined,
    orgName: (): string | undefined => useAuthStore().org?.name,
    businessType: (): string | undefined => useAuthStore().org?.business_type,
  },

  actions: {
    /**
     * Placeholder per design.md's explicit instruction: "No write
     * actions yet — plan changes happen via the admin panel today, not
     * self-service." This does NOT call any billing/upgrade API — none
     * exists yet. It only opens UpgradeModal with contact-instruction
     * copy. Replace the body of this action (not its call sites) once
     * a real self-service billing endpoint exists.
     */
    requestUpgrade(context?: LimitReachedDetails): void {
      this.upgradeContext = context ?? null;
      this.upgradeModalOpen = true;
    },

    closeUpgradeModal(): void {
      this.upgradeModalOpen = false;
      this.upgradeContext = null;
    },
  },
});