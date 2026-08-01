// =============================================================================
// src/api/index.ts
// Typed Axios instance — single source of truth for API communication.
//
// Interceptors:
//   Request:  attaches Authorization: Bearer <accessToken> from the auth store
//   Response: on 401, attempts one silent refresh-token retry before
//             giving up and redirecting to /login
// =============================================================================

import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import { ApiResponse, TokenPair } from '@/types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:3000/api/v1';

const ACCESS_TOKEN_KEY = 'soko_access_token';
const REFRESH_TOKEN_KEY = 'soko_refresh_token';

// ---------------------------------------------------------------------------
// Token storage helpers
// localStorage is used directly here (not Pinia) because the interceptor
// must read/write tokens synchronously outside of any component context,
// and to avoid a circular import between the api layer and the auth store
// (the store imports from api/auth.api.ts, which imports this file).
// ---------------------------------------------------------------------------

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: TokenPair): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Request interceptor — attach Bearer token
// ---------------------------------------------------------------------------

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = getAccessToken();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  },
  (error: AxiosError): Promise<never> => Promise.reject(error)
);

// ---------------------------------------------------------------------------
// Response interceptor — one silent refresh retry on 401
//
// isRefreshing + refreshQueue prevent a thundering herd: if five requests
// all 401 at once (e.g. dashboard load firing customers + transactions +
// summary in parallel), only the first triggers a refresh call; the other
// four wait on the same in-flight promise instead of each starting their
// own refresh.
// ---------------------------------------------------------------------------

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function onRefreshed(newAccessToken: string): void {
  refreshQueue.forEach((callback) => callback(newAccessToken));
  refreshQueue = [];
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>): Promise<unknown> => {
    const originalRequest = error.config as RetriableConfig | undefined;

    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // /auth/refresh itself returning 401 means the refresh token is dead —
    // do not attempt to refresh a refresh call, that would loop forever.
    if (originalRequest.url?.includes('/auth/refresh')) {
      clearTokens();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      // A refresh is already in flight — queue this request to retry once
      // the in-flight refresh resolves, instead of firing a second refresh.
      return new Promise((resolve) => {
        refreshQueue.push((newAccessToken: string) => {
          originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
          resolve(apiClient(originalRequest));
        });
      });
    }

    isRefreshing = true;

    try {
      const response = await axios.post<ApiResponse<TokenPair>>(
        `${API_BASE_URL}/auth/refresh`,
        { refreshToken }
      );

      const newTokens = response.data.data;

      if (!newTokens) {
        throw new Error('Refresh response contained no token data');
      }

      setTokens(newTokens);
      onRefreshed(newTokens.accessToken);

      originalRequest.headers.set('Authorization', `Bearer ${newTokens.accessToken}`);
      return apiClient(originalRequest);
    } catch (refreshError) {
      clearTokens();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);