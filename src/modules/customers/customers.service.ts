// =============================================================================
// src/modules/customers/customers.service.ts
// =============================================================================

import { z } from 'zod';
import { AppError } from '../../utils/error';
import { Customer } from '../../types/models';
import {
  CustomerWithBalance,
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomersOptions,
  PaginatedCustomers,
  archiveCustomer,
  createCustomer,
  deleteCustomer,
  getCustomerById,
  listCustomers,
  searchCustomers,
  updateCustomer,
} from './customers.queries';

export const CreateCustomerSchema = z.object({
  name:     z.string().min(1, 'Customer name is required').max(200),
  phone:    z.string().max(20).optional(),
  email:    z.string().email('Invalid email').optional().or(z.literal('')).transform(v => (v === '' ? undefined : v)),
  address:  z.string().max(500).optional(),
  notes:    z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateCustomerSchema = z.object({
  name:     z.string().min(1).max(200).optional(),
  phone:    z.string().max(20).nullable().optional(),
  email:    z.string().email('Invalid email').nullable().optional().or(z.literal('')).transform(v => (v === '' ? null : v)),
  address:  z.string().max(500).nullable().optional(),
  notes:    z.string().max(2000).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const ListCustomersQuerySchema = z.object({
  search:          z.string().optional(),
  page:            z.coerce.number().int().min(1).default(1),
  limit:           z.coerce.number().int().min(1).max(100).default(20),
  includeArchived: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
});

export const SearchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required').max(100),
});

export type CreateCustomerBody = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerBody = z.infer<typeof UpdateCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof ListCustomersQuerySchema>;

export async function list(
  orgId: string,
  rawQuery: unknown
): Promise<PaginatedCustomers> {
  const parsed = ListCustomersQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid query parameters', 400);
  }

  const options: ListCustomersOptions = {
    search:          parsed.data.search,
    page:            parsed.data.page,
    limit:           parsed.data.limit,
    includeArchived: parsed.data.includeArchived ?? false,
  };

  return listCustomers(orgId, options);
}

export async function getOne(
  orgId: string,
  customerId: string
): Promise<CustomerWithBalance> {
  const customer = await getCustomerById(orgId, customerId);
  if (!customer) {
    throw new AppError('Customer not found', 404);
  }
  return customer;
}

export async function create(
  orgId: string,
  rawBody: unknown
): Promise<Customer & { current_balance: string }> {
  const parsed = CreateCustomerSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
  }

  const data: CreateCustomerInput = parsed.data;
  const customer = await createCustomer(orgId, data);

  return { ...customer, current_balance: '0.00' };
}

export async function update(
  orgId: string,
  customerId: string,
  rawBody: unknown
): Promise<CustomerWithBalance> {
  const parsed = UpdateCustomerSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
  }

  const existing = await getCustomerById(orgId, customerId);
  if (!existing) {
    throw new AppError('Customer not found', 404);
  }

  const fields: Partial<UpdateCustomerInput> = parsed.data;
  const updated = await updateCustomer(orgId, customerId, fields);

  if (!updated) {
    throw new AppError('Customer not found', 404);
  }

  return updated;
}

export async function archive(
  orgId: string,
  customerId: string
): Promise<void> {
  const existing = await getCustomerById(orgId, customerId);
  if (!existing) {
    throw new AppError('Customer not found', 404);
  }

  if (existing.is_archived) {
    throw new AppError('Customer is already archived', 409);
  }

  await archiveCustomer(orgId, customerId);
}

export async function remove(
  orgId: string,
  customerId: string
): Promise<{ deleted: boolean; permanent: boolean }> {
  const existing = await getCustomerById(orgId, customerId);
  if (!existing) {
    throw new AppError('Customer not found', 404);
  }

  return deleteCustomer(orgId, customerId);
}

export async function search(
  orgId: string,
  rawQuery: unknown
): Promise<CustomerWithBalance[]> {
  const parsed = SearchQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid search query', 400);
  }

  return searchCustomers(orgId, parsed.data.q);
}