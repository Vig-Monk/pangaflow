// =============================================================================
// src/api/customers.api.ts
// Typed wrappers around /customers/* endpoints.
// =============================================================================

import { apiClient } from './index';
import {
  ApiResponse,
  CreateCustomerPayload,
  Customer,
  CustomerDetail,
  PaginatedApiResponse,
  PaginationMeta,
} from '@/types';

export interface ListCustomersParams {
  search?: string;
  page?: number;
  limit?: number;
  includeArchived?: boolean;
}

export interface ListCustomersResult {
  customers: Customer[];
  meta: PaginationMeta;
}

export async function listCustomers(
  params: ListCustomersParams = {}
): Promise<ListCustomersResult> {
  const response = await apiClient.get<PaginatedApiResponse<Customer[]>>(
    '/customers',
    { params }
  );

  if (!response.data.data) {
    throw new Error(response.data.error ?? 'Failed to load customers');
  }

  return {
    customers: response.data.data,
    meta: response.data.meta ?? { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
  };
}

export async function searchCustomers(q: string): Promise<Customer[]> {
  const response = await apiClient.get<ApiResponse<Customer[]>>('/customers/search', {
    params: { q },
  });

  return response.data.data ?? [];
}

export async function getCustomer(id: string): Promise<CustomerDetail> {
  const response = await apiClient.get<ApiResponse<CustomerDetail>>(
    `/customers/${id}`
  );

  if (!response.data.data) {
    throw new Error(response.data.error ?? 'Customer not found');
  }

  return response.data.data;
}

export async function createCustomer(
  payload: CreateCustomerPayload
): Promise<CustomerDetail> {
  const response = await apiClient.post<ApiResponse<CustomerDetail>>(
    '/customers',
    payload
  );

  if (!response.data.data) {
    throw new Error(response.data.error ?? 'Failed to create customer');
  }

  return response.data.data;
}

export async function updateCustomer(
  id: string,
  payload: Partial<CreateCustomerPayload>
): Promise<CustomerDetail> {
  const response = await apiClient.patch<ApiResponse<CustomerDetail>>(
    `/customers/${id}`,
    payload
  );

  if (!response.data.data) {
    throw new Error(response.data.error ?? 'Failed to update customer');
  }

  return response.data.data;
}

export async function archiveCustomer(id: string): Promise<void> {
  await apiClient.patch<ApiResponse<{ archived: boolean }>>(
    `/customers/${id}/archive`
  );
}

export async function deleteCustomer(id: string): Promise<void> {
  await apiClient.delete<ApiResponse<{ deleted: boolean }>>(`/customers/${id}`);
}