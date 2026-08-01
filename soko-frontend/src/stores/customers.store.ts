// =============================================================================
// src/stores/customers.store.ts
// Pinia store — customer list state, typed.
// =============================================================================

import { defineStore } from 'pinia';
import * as customersApi from '@/api/customers.api';
import { Customer, CreateCustomerPayload, PaginationMeta } from '@/types';

export interface CustomersState {
customers: Customer[];
meta: PaginationMeta;
searchQuery: string;
isLoading: boolean;
error: string | null;
}

export const useCustomersStore = defineStore('customers', {
state: (): CustomersState => ({
customers: [],
meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
searchQuery: '',
isLoading: false,
error: null,
}),

getters: {
hasCustomers: (state): boolean => state.customers.length > 0,
totalOutstandingCount: (state): number =>
state.customers.filter((c) => parseFloat(c.current_balance) > 0).length,
},

actions: {
async fetchCustomers(page = 1): Promise < void > {
this.isLoading = true;
this.error = null;

try {
const result = await customersApi.listCustomers({
page,
limit: this.meta.limit,
search: this.searchQuery || undefined,
});
this.customers = result.customers;
this.meta = result.meta;
} catch (err) {
this.error = err instanceof Error ? err.message: 'Failed to load customers';
} finally {
this.isLoading = false;
}
},

async search(query: string): Promise < void > {
this.searchQuery = query;

if (query.trim().length === 0) {
await this.fetchCustomers(1);
return;
}

this.isLoading = true;
this.error = null;

try {
this.customers = await customersApi.searchCustomers(query);
} catch (err) {
this.error = err instanceof Error ? err.message: 'Search failed';
} finally {
this.isLoading = false;
}
},

async createCustomer(payload: CreateCustomerPayload): Promise < void > {
this.isLoading = true;
this.error = null;

try {
await customersApi.createCustomer(payload);
// Refresh page 1 so the new customer appears in the list —
// simpler and less error-prone than trying to splice the new
// row into the existing array at the correct sorted position.
await this.fetchCustomers(1);
} catch (err) {
this.error = err instanceof Error ? err.message: 'Failed to create customer';
throw err;
} finally {
this.isLoading = false;
}
},

async archiveCustomer(id: string): Promise < void > {
await customersApi.archiveCustomer(id);
this.customers = this.customers.filter((c) => c.id !== id);
},

async deleteCustomer(id: string): Promise < void > {
await customersApi.deleteCustomer(id);
this.customers = this.customers.filter((c) => c.id !== id);
},
},
});