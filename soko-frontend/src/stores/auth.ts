// =============================================================================
// soko-frontend/src/stores/auth.ts (STEP 4 FIX)
// Auth store with explicit reactive authentication state tracking.
// =============================================================================

import { defineStore } from 'pinia';
import { apiPost } from '@/services/apiClient';
import { getAccessToken, setTokens, clearTokens } from '@/services/tokenStorage';

// ---------------------------------------------------------------------------
// Types — matching the REAL backend shapes (auth.service.ts's AuthResult).
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
}

export interface AuthOrg {
  id: string;
  name: string;
  slug: string;
  business_type: string;
  plan: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: AuthUser;
  org: AuthOrg;
  tokens: TokenPair;
}

export interface RegisterBody {
  name: string;
  email: string;
  password: string;
  orgName: string;
  businessType: 'core' | 'shop' | 'salon' | 'stays' | 'market';
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AuthUser | null,
    org: null as AuthOrg | null,
    // Explicit reactive boolean initialization prevents non-reactive localStorage caching bugs
    isAuthenticated: getAccessToken() !== null,
    isLoading: false,
    error: null as string | null,
  }),

  getters: {
    businessType: (state): string | undefined => state.org?.business_type,
  },

  actions: {
    async register(body: RegisterBody): Promise<void> {
      this.isLoading = true;
      this.error = null;
      try {
        const result = await apiPost<AuthResult>('/auth/register', body);
        setTokens(result.tokens);
        this.user = result.user;
        this.org = result.org;
        this.isAuthenticated = true; // Immediately update reactive auth state
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Registration failed';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    async login(email: string, password: string): Promise<void> {
      this.isLoading = true;
      this.error = null;
      try {
        const result = await apiPost<AuthResult>('/auth/login', { email, password });
        setTokens(result.tokens);
        this.user = result.user;
        this.org = result.org;
        this.isAuthenticated = true; // Immediately update reactive auth state
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Login failed';
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    async refresh(): Promise<void> {
      const { getRefreshToken } = await import('@/services/tokenStorage');
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        this.isAuthenticated = false;
        throw new Error('No refresh token available');
      }
      try {
        const tokens = await apiPost<TokenPair>('/auth/refresh', { refreshToken });
        setTokens(tokens);
        this.isAuthenticated = true;
      } catch (err) {
        this.isAuthenticated = false;
        clearTokens();
        throw err;
      }
    },

    async logout(): Promise<void> {
      const { getRefreshToken } = await import('@/services/tokenStorage');
      const refreshToken = getRefreshToken();

      if (refreshToken) {
        try {
          await apiPost('/auth/logout', { refreshToken });
        } catch {
          // Best-effort server-side revocation
        }
      }

      clearTokens();
      this.user = null;
      this.org = null;
      this.isAuthenticated = false; // Immediately update reactive auth state
    },
  },
});