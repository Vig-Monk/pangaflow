// =============================================================================
// src/stores/auth.store.ts
// Pinia store — authentication state. Typed state interface, no `any`.
// =============================================================================

import { defineStore } from 'pinia';
import * as authApi from '@/api/auth.api';
import { clearTokens, getAccessToken, setTokens } from '@/api';
import { AuthOrg, AuthUser, LoginPayload, RegisterPayload } from '@/types';

export interface AuthState {
  user: AuthUser | null;
  org: AuthOrg | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    org: null,
    // Initialised from localStorage synchronously — avoids a flash of
    // "logged out" UI on page refresh while an async check would still
    // be pending. This is optimistic: a dead/expired token still results
    // in isAuthenticated: true until the first API call 401s and the
    // Axios interceptor redirects to /login.
    isAuthenticated: getAccessToken() !== null,
    isLoading: false,
    error: null,
  }),

  getters: {
    userName: (state): string => state.user?.name ?? '',
    orgName: (state): string => state.org?.name ?? '',
  },

  actions: {
    async register(payload: RegisterPayload): Promise<void> {
      this.isLoading = true;
      this.error = null;

      try {
        const result = await authApi.register(payload);
        setTokens(result.tokens);
        this.user = result.user;
        this.org = result.org;
        this.isAuthenticated = true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Registration failed';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    async login(payload: LoginPayload): Promise<void> {
      this.isLoading = true;
      this.error = null;

      try {
        const result = await authApi.login(payload);
        setTokens(result.tokens);
        this.user = result.user;
        this.org = result.org;
        this.isAuthenticated = true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Login failed';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    async logout(): Promise<void> {
      const refreshToken = localStorage.getItem('soko_refresh_token');

      // Best-effort server-side revocation — logout proceeds locally
      // regardless of whether this call succeeds (e.g. offline logout
      // should still clear local state).
      if (refreshToken) {
        try {
          await authApi.logout(refreshToken);
        } catch {
          // Intentionally swallowed — local logout must not be blocked
          // by a network failure on the revocation call.
        }
      }

      clearTokens();
      this.user = null;
      this.org = null;
      this.isAuthenticated = false;
    },
  },
});