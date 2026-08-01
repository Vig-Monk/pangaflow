// =============================================================================
// src/api/auth.api.ts
// Typed wrappers around POST /auth/* endpoints.
// =============================================================================

import { apiClient } from './index';
import {
  ApiResponse,
  AuthResult,
  LoginPayload,
  RegisterPayload,
  TokenPair,
} from '@/types';

export async function register(payload: RegisterPayload): Promise<AuthResult> {
  const response = await apiClient.post<ApiResponse<AuthResult>>(
    '/auth/register',
    payload
  );

  if (!response.data.data) {
    throw new Error(response.data.error ?? 'Registration failed');
  }

  return response.data.data;
}

export async function login(payload: LoginPayload): Promise<AuthResult> {
  const response = await apiClient.post<ApiResponse<AuthResult>>(
    '/auth/login',
    payload
  );

  if (!response.data.data) {
    throw new Error(response.data.error ?? 'Login failed');
  }

  return response.data.data;
}

export async function refresh(refreshToken: string): Promise<TokenPair> {
  const response = await apiClient.post<ApiResponse<TokenPair>>('/auth/refresh', {
    refreshToken,
  });

  if (!response.data.data) {
    throw new Error(response.data.error ?? 'Token refresh failed');
  }

  return response.data.data;
}

export async function logout(refreshToken: string): Promise<void> {
  await apiClient.post<ApiResponse<{ loggedOut: boolean }>>('/auth/logout', {
    refreshToken,
  });
}