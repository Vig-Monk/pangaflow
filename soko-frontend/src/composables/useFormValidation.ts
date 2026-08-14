// =============================================================================
// src/composables/useFormValidation.ts
// Small, dependency-free validators. Not a form library — three plain
// functions, used directly in LoginView/RegisterView's own local state.
// =============================================================================

export function isRequired(value: string): string | null {
  return value.trim().length > 0 ? null : 'This field is required';
}

export function isValidEmail(value: string): string | null {
  if (value.trim().length === 0) return 'Email is required';
  // Deliberately simple — matches "name@domain.tld" shape, not a full
  // RFC 5322 implementation. A form-level email check exists to catch
  // an obvious typo before a network round-trip, not to be the
  // authoritative validator; the backend's own Zod schema
  // (z.string().email()) is the real source of truth either way.
  const simpleEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return simpleEmailPattern.test(value) ? null : 'Enter a valid email address';
}

export function minLength(value: string, min: number): string | null {
  return value.length >= min ? null : `Must be at least ${min} characters`;
}