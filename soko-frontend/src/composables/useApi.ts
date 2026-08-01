// =============================================================================
// src/composables/useApi.ts
// Typed generic composable — wraps any async function with reactive
// loading / error / data state. Used by views to avoid re-implementing
// the same try/isLoading/catch boilerplate in every <script setup> block.
// =============================================================================

import { ref, Ref } from 'vue';

export interface UseApiReturn<T, Args extends unknown[]> {
  data: Ref<T | null>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  execute: (...args: Args) => Promise<T | null>;
}

/**
 * Wraps an async function (typically an api/*.api.ts call) with reactive
 * state. `T` is the resolved data type, `Args` is the parameter tuple of
 * the wrapped function — both inferred at the call site, so callers get
 * full type safety on both the returned data and the execute() arguments.
 *
 * Usage:
 *   const { data: customer, isLoading, error, execute } =
 *     useApi(customersApi.getCustomer);
 *
 *   onMounted(() => execute(customerId));
 */
export function useApi<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>
): UseApiReturn<T, Args> {
  const data = ref<T | null>(null) as Ref<T | null>;
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function execute(...args: Args): Promise<T | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await fn(...args);
      data.value = result as T & {};
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Request failed';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  return { data, isLoading, error, execute };
}