// =============================================================================
// soko-frontend/src/stores/store.ts
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

export interface MerchantLocation {
  id?: string;
  org_id?: string;
  name: string;
  lat: number;
  lng: number;
  address_text: string | null;
  max_delivery_radius_km: number;
  base_delivery_fee: number;
  fee_per_km: number;
}

export const useStoreSettingsStore = defineStore('storeSettings', {
  state: () => ({
    settings: null as StoreSettings | null,
    location: null as MerchantLocation | null,
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

    async saveSettings(body: StoreSettings): Promise<StoreSettings> {
      this.isLoading = true;
      this.error = null;
      try {
        const result = await apiPatch<StoreSettings>('/store', body);
        this.settings = result;
        return result;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to save store settings';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    async fetchLocation(): Promise<void> {
      try {
        this.location = await apiGet<MerchantLocation | null>('/store/location');
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to load merchant location';
      }
    },

    async saveLocation(body: MerchantLocation): Promise<MerchantLocation> {
      this.isLoading = true;
      this.error = null;
      try {
        const result = await apiPatch<MerchantLocation>('/store/location', body);
        this.location = result;
        return result;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to save merchant location';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },
  },
});