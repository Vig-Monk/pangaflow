// src/types/health.ts
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  db: 'connected' | 'error';
  timestamp: string;
}