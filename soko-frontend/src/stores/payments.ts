// =============================================================================
// src/stores/payments.ts
//
// pollStatus() calls an endpoint that does NOT exist yet
// (GET /payments/mpesa/status/:checkoutRequestId) — confirmed against
// the real payments.routes.ts. Built against the expected shape per
// design.md's own explicit instruction; guarded so a 404 degrades to
// "we'll update this once confirmed" instead of throwing.
// =============================================================================

import { defineStore } from 'pinia';
import { apiPost, apiGet, ApiError } from '@/services/apiClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MpesaStatus = 'pending' | 'completed' | 'failed';

export interface CollectViaMpesaBody {
  customerId: string;
  amount: number;
  phone: string;
}

export interface CollectViaMpesaResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  customerMessage: string;
}

// Expected shape for the not-yet-existing status endpoint. If/when it's
// built, confirm this matches the real response before trusting it.
interface PollStatusResponse {
  status: MpesaStatus;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePaymentsStore = defineStore('payments', {
  state: () => ({
    // Keyed by checkoutRequestId, per design.md's exact spec.
    pending: new Map<string, MpesaStatus>(),
    error: null as string | null,
  }),

  actions: {
    async collectViaMpesa(body: CollectViaMpesaBody): Promise<CollectViaMpesaResult> {
      this.error = null;
      const result = await apiPost<CollectViaMpesaResult>('/payments/mpesa/stk', body);

      // A NEW Map is set, not a mutation of the existing one in place —
      // Pinia's reactivity tracks whole-property reassignment reliably
      // for a Map the same way it does for arrays/objects; this follows
      // the same explicit-reassignment discipline already used
      // throughout every other store in this delivery.
      const next = new Map(this.pending);
      next.set(result.checkoutRequestId, 'pending');
      this.pending = next;

      return result;
    },

    /**
     * NOTE: calls an endpoint that does not exist in the API yet.
     * Guarded explicitly: a 404 here means "not implemented," not
     * "payment failed" — the calling component must NOT treat a caught
     * error from this action as proof the payment failed. It should
     * show something like "we'll update this once confirmed" and keep
     * the entry in `pending` rather than removing it or marking it
     * 'failed'.
     */
    async pollStatus(checkoutRequestId: string): Promise<MpesaStatus | null> {
      try {
        const response = await apiGet<PollStatusResponse>(
          `/payments/mpesa/status/${checkoutRequestId}`
        );

        const next = new Map(this.pending);
        next.set(checkoutRequestId, response.status);
        this.pending = next;

        return response.status;
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 404) {
          // Endpoint genuinely doesn't exist — this is expected right
          // now, not a real error. Return null so the caller can
          // distinguish "we don't know yet" from an actual failure.
          return null;
        }
        // A real error (network failure, 500, etc.) — this DOES get
        // surfaced, since it's a genuine problem distinct from "the
        // endpoint isn't built yet."
        this.error = err instanceof Error ? err.message : 'Failed to check payment status';
        throw err;
      }
    },
  },
});