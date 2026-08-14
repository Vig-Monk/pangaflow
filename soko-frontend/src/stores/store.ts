// =============================================================================
// soko-frontend/src/stores/store.ts (UPDATED)
// Pinia store — Store configuration settings.
// =============================================================================

import { defineStore } from 'pinia';
import { apiGet, apiPatch } from '@/services/apiClient';

export interface StoreSettings {
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  location: string | null;
  delivery_info: string | null;
  status: 'draft' | 'published' | 'suspended';
  hero_layout?: 'editorial' | 'split' | 'minimal' | 'promotional';
  hero_headline?: string | null;
  hero_subheadline?: string | null;
  hero_cta_label?: string | null;
}

export const useStoreSettingsStore = defineStore('storeSettings', {
  state: () => ({
    settings: null as StoreSettings | null,
    isLoading: false,
    error: null as string | null,
  }),

  actions: {
    async fetchSettings(): Promise<void> {
      this.isLoading = true;
      this.error = null;
      try {
        this.settings = await apiGet<StoreSettings | null>('/store');
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to load store settings';
      } finally {
        this.isLoading = false;
      }
    },

    async saveSettings(body: StoreSettings): Promise<void> {
      this.isLoading = true;
      this.error = null;
      try {
        this.settings = await apiPatch<StoreSettings>('/store', body);
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to save store settings';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },
  },
});