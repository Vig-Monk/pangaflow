// =============================================================================
// src/api/transactions.api.ts
// Typed wrappers around /transactions/* and /dashboard/* endpoints.
// =============================================================================

import { apiClient } from './index';
import {
  ApiResponse,
  CustomerLedgerResult,
  DashboardSummary,
  PaginatedApiResponse,
  PaginationMeta,
  RecordTransactionPayload,
  Transaction,
} from '@/types';

export interface LedgerParams {
  page?: number;
  limit?: number;
}

export interface LedgerResult extends CustomerLedgerResult {
  meta: PaginationMeta;
}

export async function recordTransaction(
  payload: RecordTransactionPayload
): Promise<Transaction> {
  const response = await apiClient.post<ApiResponse<Transaction>>(
    '/transactions',
    payload
  );

  if (!response.data.data) {
    throw new Error(response.data.error ?? 'Failed to record transaction');
  }

  return response.data.data;
}

export async function getCustomerLedger(
  customerId: string,
  params: LedgerParams = {}
): Promise<LedgerResult> {
  const response = await apiClient.get<PaginatedApiResponse<CustomerLedgerResult>>(
    `/transactions/${customerId}`,
    { params }
  );

  if (!response.data.data) {
    throw new Error(response.data.error ?? 'Failed to load ledger');
  }

  return {
    ...response.data.data,
    meta: response.data.meta ?? { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
  };
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const response = await apiClient.get<ApiResponse<DashboardSummary>>(
    '/dashboard/summary'
  );

  if (!response.data.data) {
    throw new Error(response.data.error ?? 'Failed to load dashboard summary');
  }

  return response.data.data;
}