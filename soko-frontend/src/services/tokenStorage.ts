// =============================================================================
// src/services/tokenStorage.ts
// Shared token storage — used by both the legacy api/index.ts and the
// new apiClient.ts during the transition, so there is exactly one
// implementation of "how tokens are read/written," not two.
// =============================================================================

const ACCESS_TOKEN_KEY = 'kauntaos_access_token';
const REFRESH_TOKEN_KEY = 'kauntaos_refresh_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: { accessToken: string; refreshToken: string }): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}