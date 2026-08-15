// =============================================================================
// soko-frontend/src/stores/mpesaCredentials.ts
// =============================================================================

import { defineStore } from 'pinia';
import { apiGet, apiPost } from '@/services/apiClient';

export interface MpesaCredentialsDto {
  id?: string;
  org_id?: string;
  till_type: 'till' | 'paybill';
  shortcode: string;
  store_number?: string | null;
  environment: 'sandbox' | 'production';
  status: 'pending' | 'verified' | 'failed';
  last_verified_at: string | null;
  last_error: string | null;
}

export interface SaveMpesaCredentialsInput {
  tillType: 'till' | 'paybill';
  shortcode: string;
  storeNumber?: string | null;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  environment: 'sandbox' | 'production';
}

export const useMpesaCredentialsStore = defineStore('mpesaCredentials', {
  state: () => ({
    credentials: null as MpesaCredentialsDto | null,
    isLoading: false,
    error: null as string | null,
  }),

  actions: {
    async fetchCredentials(): Promise<void> {
      this.isLoading = true;
      this.error = null;
      try {
        this.credentials = await apiGet<MpesaCredentialsDto | null>('/mpesa-credentials');
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to load M-Pesa credentials';
      } finally {
        this.isLoading = false;
      }
    },

    async saveCredentials(input: SaveMpesaCredentialsInput): Promise<MpesaCredentialsDto> {
      this.isLoading = true;
      this.error = null;
      try {
        const result = await apiPost<MpesaCredentialsDto>('/mpesa-credentials', input);
        this.credentials = result;
        return result;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to save credentials';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    async verifyCredentials(phone: string): Promise<{ checkoutRequestId: string; customerMessage: string }> {
      this.isLoading = true;
      this.error = null;
      try {
        return await apiPost<{ checkoutRequestId: string; customerMessage: string }>('/mpesa-credentials/verify', { phone });
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Verification failed';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },
  },
});