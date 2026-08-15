<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/AgentDashboardView.vue
// =============================================================================

import { onMounted, ref } from 'vue';
import { apiClient } from '@/services/apiClient';

interface AgentClient {
  id: string;
  name: string;
  phone: string;
  delivery_address: string;
  regular_items: unknown[];
  notes: string | null;
}

type AgentOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'buying'
  | 'delivering'
  | 'done'
  | 'cancelled';

interface AgentOrder {
  id: string;
  client_id: string;
  items: unknown[];
  service_fee: string;
  produce_cost: string;
  markup_total: string;
  total_collected: string;
  status: AgentOrderStatus;
  delivery_address: string;
  special_notes: string | null;
  order_date: string;
}

interface AgentDashboard {
  today_earnings: string;
  pending_orders: number;
  weekly_total: string;
  monthly_revenue: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

const clients = ref<AgentClient[]>([]);
const orders = ref<AgentOrder[]>([]);
const summary = ref<AgentDashboard | null>(null);
const isLoading = ref<boolean>(true);
const loadError = ref<string | null>(null);

const showAddClient = ref<boolean>(false);
const newClientName = ref<string>('');
const newClientPhone = ref<string>('');
const newClientAddress = ref<string>('');
const isSavingClient = ref<boolean>(false);
const clientFormError = ref<string | null>(null);

const showAddOrder = ref<boolean>(false);
const newOrderClientId = ref<string>('');
const newOrderItemsText = ref<string>('');
const newOrderServiceFee = ref<string>('');
const newOrderAddress = ref<string>('');
const isSavingOrder = ref<boolean>(false);
const orderFormError = ref<string | null>(null);

const statusUpdating = ref<Set<string>>(new Set());

async function loadAll(): Promise<void> {
  isLoading.value = true;
  loadError.value = null;

  try {
    const [clientsRes, ordersRes, dashboardRes] = await Promise.all([
      apiClient.get<ApiEnvelope<AgentClient[]>>('/agent/clients'),
      apiClient.get<ApiEnvelope<AgentOrder[]>>('/agent/orders/today'),
      apiClient.get<ApiEnvelope<AgentDashboard>>('/agent/dashboard'),
    ]);

    clients.value = clientsRes.data.data ?? [];
    orders.value = ordersRes.data.data ?? [];
    summary.value = dashboardRes.data.data;
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Failed to load agent data';
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadAll();
});

async function handleAddClient(): Promise<void> {
  if (
    newClientName.value.trim().length === 0 ||
    newClientPhone.value.trim().length === 0 ||
    newClientAddress.value.trim().length === 0
  ) {
    clientFormError.value = 'Name, phone, and delivery address are required';
    return;
  }

  isSavingClient.value = true;
  clientFormError.value = null;

  try {
    await apiClient.post('/agent/clients', {
      name: newClientName.value.trim(),
      phone: newClientPhone.value.trim(),
      deliveryAddress: newClientAddress.value.trim(),
    });

    newClientName.value = '';
    newClientPhone.value = '';
    newClientAddress.value = '';
    showAddClient.value = false;

    await loadAll();
  } catch (err) {
    clientFormError.value = err instanceof Error ? err.message : 'Failed to add client';
  } finally {
    isSavingClient.value = false;
  }
}

function parseItemsText(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function handleAddOrder(): Promise<void> {
  const items = parseItemsText(newOrderItemsText.value);
  const serviceFee = parseFloat(newOrderServiceFee.value);

  if (newOrderClientId.value.length === 0) {
    orderFormError.value = 'Select a client';
    return;
  }
  if (items.length === 0) {
    orderFormError.value = 'Enter at least one item';
    return;
  }
  if (isNaN(serviceFee) || serviceFee < 0) {
    orderFormError.value = 'Enter a valid service fee';
    return;
  }
  if (newOrderAddress.value.trim().length === 0) {
    orderFormError.value = 'Delivery address is required';
    return;
  }

  isSavingOrder.value = true;
  orderFormError.value = null;

  try {
    await apiClient.post('/agent/orders', {
      clientId: newOrderClientId.value,
      items,
      serviceFee,
      deliveryAddress: newOrderAddress.value.trim(),
    });

    newOrderClientId.value = '';
    newOrderItemsText.value = '';
    newOrderServiceFee.value = '';
    newOrderAddress.value = '';
    showAddOrder.value = false;

    await loadAll();
  } catch (err) {
    orderFormError.value = err instanceof Error ? err.message : 'Failed to add order';
  } finally {
    isSavingOrder.value = false;
  }
}

const STATUS_FLOW: AgentOrderStatus[] = [
  'pending',
  'confirmed',
  'buying',
  'delivering',
  'done',
];

function nextStatus(current: AgentOrderStatus): AgentOrderStatus | null {
  const index = STATUS_FLOW.indexOf(current);
  if (index === -1 || index === STATUS_FLOW.length - 1) {
    return null;
  }
  return STATUS_FLOW[index + 1];
}

function statusLabel(status: AgentOrderStatus): string {
  const labels: Record<AgentOrderStatus, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    buying: 'Buying',
    delivering: 'Delivering',
    done: 'Done',
    cancelled: 'Cancelled',
  };
  return labels[status];
}

async function advanceStatus(order: AgentOrder): Promise<void> {
  const next = nextStatus(order.status);
  if (!next) return;

  statusUpdating.value.add(order.id);

  try {
    await apiClient.patch(`/agent/orders/${order.id}/status`, { status: next });
    await loadAll();
  } catch {
    await loadAll();
  } finally {
    statusUpdating.value.delete(order.id);
  }
}

function clientName(clientId: string): string {
  return clients.value.find((c) => c.id === clientId)?.name ?? 'Unknown client';
}

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
</script>

<template>
  <div class="agent-page">
    <header class="agent-header">
      <h1 class="agent-title">Wakulima Errands</h1>
      <p class="agent-subtitle">Today's procurement runs</p>
    </header>

    <div v-if="isLoading" class="state-message">Loading…</div>

    <div v-else-if="loadError" class="state-message error">
      {{ loadError }}
      <button class="btn-secondary" @click="loadAll">Retry</button>
    </div>

    <template v-else>
      <div v-if="summary" class="summary-grid">
        <div class="summary-card">
          <p class="summary-label">Today</p>
          <p class="summary-value">{{ formatCurrency(summary.today_earnings) }}</p>
        </div>
        <div class="summary-card">
          <p class="summary-label">Pending</p>
          <p class="summary-value">{{ summary.pending_orders }}</p>
        </div>
        <div class="summary-card">
          <p class="summary-label">This Week</p>
          <p class="summary-value">{{ formatCurrency(summary.weekly_total) }}</p>
        </div>
        <div class="summary-card">
          <p class="summary-label">This Month</p>
          <p class="summary-value">{{ formatCurrency(summary.monthly_revenue) }}</p>
        </div>
      </div>

      <div class="action-row">
        <button class="btn-primary" @click="showAddOrder = true">+ New Order</button>
        <button class="btn-secondary" @click="showAddClient = true">+ New Client</button>
      </div>

      <div v-if="showAddClient" class="form-card">
        <h2 class="form-title">New Client</h2>
        <input v-model="newClientName" type="text" placeholder="Client name" class="input-field" :disabled="isSavingClient" />
        <input v-model="newClientPhone" type="tel" inputmode="tel" placeholder="Phone" class="input-field" :disabled="isSavingClient" />
        <input v-model="newClientAddress" type="text" placeholder="Delivery address" class="input-field" :disabled="isSavingClient" />
        <p v-if="clientFormError" class="form-error">{{ clientFormError }}</p>
        <div class="form-actions">
          <button class="btn-secondary" :disabled="isSavingClient" @click="showAddClient = false">Cancel</button>
          <button class="btn-primary" :disabled="isSavingClient" @click="handleAddClient">
            {{ isSavingClient ? 'Saving…' : 'Save Client' }}
          </button>
        </div>
      </div>

      <div v-if="showAddOrder" class="form-card">
        <h2 class="form-title">New Order</h2>
        <select v-model="newOrderClientId" class="input-field" :disabled="isSavingOrder">
          <option value="" disabled>Select client</option>
          <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <textarea
          v-model="newOrderItemsText"
          placeholder="Items — one per line (e.g. 2kg tomatoes)"
          class="input-field textarea-field"
          rows="4"
          :disabled="isSavingOrder"
        ></textarea>
        <input v-model="newOrderServiceFee" type="number" inputmode="decimal" placeholder="Service fee (KES)" class="input-field" :disabled="isSavingOrder" />
        <input v-model="newOrderAddress" type="text" placeholder="Delivery address" class="input-field" :disabled="isSavingOrder" />
        <p v-if="orderFormError" class="form-error">{{ orderFormError }}</p>
        <div class="form-actions">
          <button class="btn-secondary" :disabled="isSavingOrder" @click="showAddOrder = false">Cancel</button>
          <button class="btn-primary" :disabled="isSavingOrder" @click="handleAddOrder">
            {{ isSavingOrder ? 'Saving…' : 'Save Order' }}
          </button>
        </div>
      </div>

      <section class="orders-section">
        <h2 class="section-title">Today's Orders</h2>
        <div v-if="orders.length === 0" class="empty-state">No orders for today yet.</div>
        <ul v-else class="order-list">
          <li v-for="order in orders" :key="order.id" class="order-card">
            <div class="order-top">
              <span class="order-client">{{ clientName(order.client_id) }}</span>
              <span class="order-status" :class="`status-${order.status}`">
                {{ statusLabel(order.status) }}
              </span>
            </div>
            <p class="order-address">{{ order.delivery_address }}</p>
            <div class="order-financials">
              <span>Fee: {{ formatCurrency(order.service_fee) }}</span>
              <span v-if="parseFloat(order.produce_cost) > 0">
                Cost: {{ formatCurrency(order.produce_cost) }}
              </span>
            </div>
            <button
              v-if="nextStatus(order.status)"
              class="btn-primary advance-btn"
              :disabled="statusUpdating.has(order.id)"
              @click="advanceStatus(order)"
            >
              {{ statusUpdating.has(order.id) ? 'Updating…' : `Mark ${statusLabel(nextStatus(order.status)!)}` }}
            </button>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.agent-page {
  min-height: 100vh;
  background: #0F172A;
  color: #F8FAFC;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  padding: 16px;
  padding-bottom: 40px;
}
.agent-header { margin-bottom: 20px; }
.agent-title { font-size: 22px; font-weight: 700; }
.agent-subtitle { font-size: 13px; color: #94A3B8; margin-top: 2px; }
.state-message { text-align: center; padding: 40px 16px; color: #94A3B8; }
.state-message.error { color: #DC2626; }
.summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
.summary-card { background: #1E293B; border-radius: 12px; padding: 14px; }
.summary-label { font-size: 12px; color: #94A3B8; }
.summary-value { font-size: 20px; font-weight: 700; margin-top: 2px; }
.action-row { display: flex; gap: 8px; margin-bottom: 16px; }
.action-row button { flex: 1; min-height: 48px; border: none; border-radius: 12px; font-weight: 600; }
.btn-primary { background: #0D9488; color: #F8FAFC; min-height: 48px; border: none; border-radius: 12px; font-weight: 600; padding: 0 16px; }
.btn-secondary { background: #334155; color: #F8FAFC; min-height: 48px; border: none; border-radius: 12px; font-weight: 500; padding: 0 16px; }
.btn-primary:disabled, .btn-secondary:disabled { opacity: 0.5; }
.form-card { background: #1E293B; border-radius: 12px; padding: 16px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 10px; }
.form-title { font-size: 16px; font-weight: 600; }
.input-field { background: #334155; border: 1px solid transparent; border-radius: 10px; color: #F8FAFC; padding: 12px; width: 100%; min-height: 48px; font-size: 15px; }
.textarea-field { min-height: 90px; resize: vertical; font-family: inherit; }
.form-error { color: #DC2626; font-size: 13px; }
.form-actions { display: flex; gap: 8px; justify-content: flex-end; }
.section-title { font-size: 16px; font-weight: 600; margin-bottom: 10px; }
.empty-state { text-align: center; padding: 24px; color: #94A3B8; }
.order-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
.order-card { background: #1E293B; border-radius: 12px; padding: 14px; }
.order-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.order-client { font-weight: 600; }
.order-status { font-size: 12px; font-weight: 600; padding: 3px 8px; border-radius: 6px; }
.status-pending { background: rgba(148, 163, 184, 0.2); color: #94A3B8; }
.status-confirmed { background: rgba(13, 148, 136, 0.2); color: #0D9488; }
.status-buying { background: rgba(217, 119, 6, 0.2); color: #D97706; }
.status-delivering { background: rgba(217, 119, 6, 0.2); color: #D97706; }
.status-done { background: rgba(13, 148, 136, 0.2); color: #0D9488; }
.status-cancelled { background: rgba(220, 38, 38, 0.2); color: #DC2626; }
.order-address { font-size: 13px; color: #94A3B8; margin-bottom: 6px; }
.order-financials { display: flex; gap: 12px; font-size: 13px; margin-bottom: 10px; }
.advance-btn { width: 100%; min-height: 44px; border: none; border-radius: 10px; font-weight: 600; }
</style>