// =============================================================================
// soko-frontend/src/composables/useStorefrontTheme.ts
// Customer-facing light/dark theme engine with localStorage persistence
// and prefers-color-scheme fallback.
// =============================================================================

import { ref, type Ref } from 'vue';

export type StorefrontTheme = 'light' | 'dark';

const STORAGE_KEY = 'soko-storefront-theme';

function getInitialTheme(): StorefrontTheme {
  if (typeof window === 'undefined') return 'light';

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

const theme: Ref<StorefrontTheme> = ref(getInitialTheme());

export function useStorefrontTheme() {
  function setTheme(newTheme: StorefrontTheme): void {
    theme.value = newTheme;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newTheme);
    }
  }

  function toggleTheme(): void {
    setTheme(theme.value === 'light' ? 'dark' : 'light');
  }

  return {
    theme,
    setTheme,
    toggleTheme,
  };
}