// =============================================================================
// src/composables/useToast.ts
// Reactive toast queue. Auto-dismisses after 4s, supports manual dismiss.
// Shared module-level state — every push() call, from any component,
// lands in one queue that ToastContainer.vue (Phase 1.3) renders.
// =============================================================================

import { ref, Ref } from 'vue';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

const AUTO_DISMISS_MS = 4000;

// ---------------------------------------------------------------------------
// Module-level queue — same reasoning as useTheme's module-level ref.
// A toast pushed from, say, the ledger store's record() action needs to
// render in the ONE ToastContainer mounted in App.vue, regardless of
// which component or store triggered it.
// ---------------------------------------------------------------------------

const toasts: Ref<Toast[]> = ref([]);

function generateId(): string {
  // Gracefully fallback to pseudorandom string if executed in unsecure or older context scopes
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11);
}

// ---------------------------------------------------------------------------
// useToast
// ---------------------------------------------------------------------------

export interface PushToastInput {
  message: string;
  variant: ToastVariant;
}

export interface UseToastReturn {
  toasts: Ref<Toast[]>;
  push: (input: PushToastInput) => string;
  dismiss: (id: string) => void;
}

export function useToast(): UseToastReturn {
  function dismiss(id: string): void {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  function push(input: PushToastInput): string {
    const id = generateId();

    toasts.value = [...toasts.value, { id, message: input.message, variant: input.variant }];

    setTimeout(() => {
      dismiss(id);
    }, AUTO_DISMISS_MS);

    return id;
  }

  return { toasts, push, dismiss };
}