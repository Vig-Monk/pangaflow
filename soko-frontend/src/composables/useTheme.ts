// =============================================================================
// src/composables/useTheme.ts
// Reactive light/dark theme state. Persists to localStorage, defaults to
// the OS preference on first visit, applies the theme attribute
// immediately on module load to avoid a flash of the wrong theme.
// =============================================================================

import { ref, Ref } from 'vue';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'kauntaos-theme';

// ---------------------------------------------------------------------------
// Module-level, not per-component-instance state.
//
// Every component calling useTheme() must see and control the SAME theme,
// not an independent copy — the ThemeToggle in AppShell and the one in
// PlanView (design.md §4.6 explicitly wants both) need to stay in sync
// with each other. A ref created inside the composable function body
// would give each call site its own isolated state; declaring it at
// module scope, outside the function, means every import shares one
// reactive source.
// ---------------------------------------------------------------------------

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    // Guard against a non-browser environment — not currently relevant
    // (this is a client-only Vite SPA), but cheap to guard against.
    return 'light';
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

function applyTheme(value: Theme): void {
  document.documentElement.dataset.theme = value;
}

const theme: Ref<Theme> = ref(readInitialTheme());

// Apply immediately on module load — before any component mounts, before
// first paint. This is what actually prevents the flash: by the time
// Vue renders anything, document.documentElement already has the
// correct data-theme attribute set, so theme.css's [data-theme='dark']
// selector is already active.
if (typeof window !== 'undefined') {
  applyTheme(theme.value);
}

// ---------------------------------------------------------------------------
// useTheme
// ---------------------------------------------------------------------------

export interface UseThemeReturn {
  theme: Ref<Theme>;
  toggle: () => void;
  setTheme: (value: Theme) => void;
}

export function useTheme(): UseThemeReturn {
  function setTheme(value: Theme): void {
    theme.value = value;
    applyTheme(value);
    window.localStorage.setItem(STORAGE_KEY, value);
  }

  function toggle(): void {
    setTheme(theme.value === 'light' ? 'dark' : 'light');
  }

  return { theme, toggle, setTheme };
}