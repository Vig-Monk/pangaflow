// =============================================================================
// soko-frontend/src/services/apiClient.ts
// =============================================================================

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './tokenStorage';

export interface AppErrorPayload {
  message: string;
  code?: string;
  details?: unknown;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: AppErrorPayload;
  meta?: PaginationMeta;
}

export interface PaginatedResult<T> {
  data: T;
  meta: PaginationMeta;
}

export async function apiGetPaginated<T>(
  url: string,
  params?: Record<string, any> | object
): Promise<PaginatedResult<T>> {
  try {
    const response = await apiClient.get<ApiResponse<T>>(url, { params });
    const envelope = response.data;
    if (!envelope.success || envelope.data === undefined || !envelope.meta) {
      const err = envelope.error;
      throw new ApiError(
        err?.message ?? 'Request failed',
        response.status,
        err?.code,
        err?.details
      );
    }
    return {
      data: envelope.data,
      meta: envelope.meta,
    };
  } catch (err) {
    throw normalizeError(err);
  }
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 80000,
  headers: { 'Content-Type': 'application/json' },
});

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

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function onRefreshed(newAccessToken: string): void {
  refreshQueue.forEach((cb) => cb(newAccessToken));
  refreshQueue = [];
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

function redirectToLoginIfNotStorefront(): void {
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/store/')) {
    window.location.href = '/login';
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>): Promise<unknown> => {
    const originalRequest = error.config as RetriableConfig | undefined;

    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (originalRequest.url?.includes('/auth/refresh')) {
      clearTokens();
      redirectToLoginIfNotStorefront();
      return Promise.reject(error);
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      redirectToLoginIfNotStorefront();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((newAccessToken: string) => {
          originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
          resolve(apiClient(originalRequest));
        });
      });
    }

    isRefreshing = true;

    try {
      const response = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
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
      redirectToLoginIfNotStorefront();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

function unwrap<T>(envelope: ApiResponse<T>): T {
  if (!envelope.success || envelope.data === undefined) {
    const err = envelope.error;
    throw new ApiError(
      err?.message ?? 'Request failed',
      0,
      err?.code,
      err?.details
    );
  }
  return envelope.data;
}

export async function apiGet<T>(url: string, params?: Record<string, any> | object): Promise<T> {
  try {
    const response = await apiClient.get<ApiResponse<T>>(url, { params });
    return unwrap(response.data);
  } catch (err) {
    throw normalizeError(err);
  }
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  try {
    const response = await apiClient.post<ApiResponse<T>>(url, body);
    return unwrap(response.data);
  } catch (err) {
    throw normalizeError(err);
  }
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  try {
    const response = await apiClient.patch<ApiResponse<T>>(url, body);
    return unwrap(response.data);
  } catch (err) {
    throw normalizeError(err);
  }
}

export async function apiDelete<T>(url: string): Promise<T> {
  try {
    const response = await apiClient.delete<ApiResponse<T>>(url);
    return unwrap(response.data);
  } catch (err) {
    throw normalizeError(err);
  }
}

function normalizeError(err: unknown): ApiError {
  if (err instanceof ApiError) {
    return err;
  }

  if (axios.isAxiosError<ApiResponse<unknown>>(err)) {
    const payload = err.response?.data?.error;
    return new ApiError(
      payload?.message ?? err.message ?? 'Network error',
      err.response?.status ?? 0,
      payload?.code,
      payload?.details
    );
  }

  return new ApiError('An unexpected error occurred', 0);
}