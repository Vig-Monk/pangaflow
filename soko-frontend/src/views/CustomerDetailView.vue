<script setup lang="ts">
// =============================================================================
// kauntaOS -frontend/src/views/CustomerDetailView.vue
// Customer credit ledger with SmartSaleModal, SettleDebtModal & Customer Deletion.
// =============================================================================

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useCustomersStore } from '@/stores/customers';
import { useLedgerStore } from '@/stores/ledger';
import { useToast } from '@/composables/useToast';
import Button from '@/components/ui/Button.vue';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import LedgerRow from '@/components/ledger/LedgerRow.vue';
import SmartSaleModal from '@/components/ledger/SmartSaleModal.vue';
import SettleDebtModal from '@/components/ledger/SettleDebtModal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import {
  AlertCircle,
  CheckCircle2,
  Share2,
  Plus,
  DollarSign,
  Trash2,
  ArrowLeft,
} from 'lucide-vue-next';

interface Props {
  id: string;
}

const props = defineProps<Props>();

const router = useRouter();
const customersStore = useCustomersStore();
const ledgerStore = useLedgerStore();
const { push: pushToast } = useToast();

const showSmartSaleModal = ref(false);
const showSettleModal = ref(false);
const showConfirmDelete = ref(false);
const isDeleting = ref(false);

onMounted(() => {
  customersStore.fetchOne(props.id);
  ledgerStore.fetchLedger(props.id, { page: 1 });
});

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `KES ${num.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const customer = computed(() => customersStore.current);
const balanceNumber = computed(() => parseFloat(customer.value?.current_balance ?? '0'));
const hasDebt = computed(() => balanceNumber.value > 0);

const whatsappStatementUrl = computed(() => {
  if (!customer.value) return '#';
  const cleanDigits = (customer.value.phone || '').replace(/\D/g, '');
  const phone = cleanDigits.startsWith('0') ? `254${cleanDigits.slice(1)}` : cleanDigits;

  const lines = [
    `*📋 kauntaOS  CUSTOMER STATEMENT — ${customer.value.name.toUpperCase()}*`,
    `--------------------------------`,
    `*Current Balance:* KES ${Math.abs(balanceNumber.value).toLocaleString('en-KE')} (${hasDebt.value ? 'OWES' : 'CLEARED / PAID UP'})`,
    `*Total Transactions:* ${ledgerStore.total}`,
    `--------------------------------`,
    `_Thank you for your business!_`,
  ].join('\n');

  return `https://wa.me/${phone}?text=${encodeURIComponent(lines)}`;
});

function refreshData(): void {
  ledgerStore.fetchLedger(props.id, { page: 1 });
  customersStore.fetchOne(props.id);
}

async function executeDelete(): Promise<void> {
  if (!customer.value) return;
  isDeleting.value = true;
  try {
    await customersStore.remove(customer.value.id);
    pushToast({ message: `Customer "${customer.value.name}" deleted`, variant: 'success' });
    router.push({ name: 'customers' });
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to delete customer', variant: 'error' });
  } finally {
    isDeleting.value = false;
  }
}
</script>

<template>
  <div class="detail-page">
    <header class="page-top-nav">
      <Button variant="ghost" @click="router.push({ name: 'customers' })">
        <ArrowLeft :size="16" /> Back to Customers
      </Button>
    </header>

    <template v-if="customer">
      <div class="detail-header card">
        <div class="header-top-row">
          <div>
            <div class="name-status-row">
              <h1 class="customer-name">{{ customer.name }}</h1>
              <span
                class="debt-status-pill"
                :class="hasDebt ? 'debt-status-pill--owed' : 'debt-status-pill--cleared'"
              >
                <component :is="hasDebt ? AlertCircle : CheckCircle2" :size="12" />
                {{ hasDebt ? `OWES ${formatCurrency(customer.current_balance)}` : 'CLEARED' }}
              </span>
            </div>
            <p v-if="customer.phone" class="customer-phone font-mono">{{ customer.phone }}</p>
          </div>

          <div class="top-action-links">
            <a
              v-if="customer.phone"
              :href="whatsappStatementUrl"
              target="_blank"
              rel="noopener"
              class="whatsapp-statement-btn"
            >
              <Share2 :size="14" /> Send Statement via WhatsApp
            </a>

            <button
              type="button"
              class="delete-cust-btn"
              title="Delete Customer"
              @click="showConfirmDelete = true"
            >
              <Trash2 :size="15" /> Delete
            </button>
          </div>
        </div>

        <div class="balance-block">
          <p class="balance-label">Current Balance</p>
          <p
            class="balance-value tabular-figure"
            :class="hasDebt ? 'balance-value--owed' : 'balance-value--credit'"
          >
            {{ formatCurrency(customer.current_balance) }}
          </p>
        </div>

        <div class="header-actions">
          <Button variant="primary" size="lg" @click="showSmartSaleModal = true">
            <Plus :size="16" /> Record Sale &amp; POS
          </Button>
          <Button
            v-if="hasDebt"
            variant="secondary"
            size="lg"
            @click="showSettleModal = true"
          >
            <DollarSign :size="16" /> Settle Debt (Lipa Deni)
          </Button>
        </div>
      </div>

      <section class="ledger-section">
        <h2 class="section-title">Transaction History</h2>

        <EmptyState
          v-if="!ledgerStore.loadingLedger && ledgerStore.entries.length === 0"
          title="No transactions yet"
        />

        <div v-else class="ledger-list">
          <LedgerRow
            v-for="tx in ledgerStore.entries"
            :key="tx.id"
            :customer-name="customer.name"
            :amount="formatCurrency(tx.amount)"
            :type="tx.type"
            :timestamp="formatTimestamp(tx.created_at)"
            :balance-after="formatCurrency(tx.balance_after)"
          />
        </div>

        <Pagination
          v-if="ledgerStore.entries.length > 0"
          :page="ledgerStore.page"
          :total-pages="Math.max(1, Math.ceil(ledgerStore.total / 20))"
          :on-change="(p) => ledgerStore.fetchLedger(id, { page: p })"
        />
      </section>
    </template>

    <!-- Delete Customer Confirmation Dialog -->
    <ConfirmDialog
      :open="showConfirmDelete"
      title="Delete Customer"
      :message="`Are you sure you want to delete customer '${customer?.name}'? If they have past transaction records, their history will be archived safely.`"
      confirm-label="Delete Customer"
      danger
      @confirm="executeDelete"
      @cancel="showConfirmDelete = false"
    />

    <!-- Smart Sale POS Modal -->
    <SmartSaleModal
      :open="showSmartSaleModal"
      :preselected-customer-id="props.id"
      @close="showSmartSaleModal = false"
      @success="refreshData"
    />

    <!-- Settle Debt Modal -->
    <SettleDebtModal
      :open="showSettleModal"
      :customer="customer"
      @close="showSettleModal = false"
      @success="refreshData"
    />
  </div>
</template>

<style scoped>
.detail-page {
  padding: var(--space-6);
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.page-top-nav {
  margin-bottom: var(--space-1);
}

.detail-header {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.header-top-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.name-status-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.customer-name {
  font-size: var(--text-2xl);
  font-weight: 700;
}

.customer-phone {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  margin-top: 2px;
}

.debt-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.debt-status-pill--owed {
  background: color-mix(in srgb, var(--color-market-clay) 12%, transparent);
  color: var(--color-market-clay);
  border: 1px solid color-mix(in srgb, var(--color-market-clay) 30%, transparent);
}

.debt-status-pill--cleared {
  background: color-mix(in srgb, var(--color-ledger-green) 12%, transparent);
  color: var(--color-ledger-green);
}

.top-action-links {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.whatsapp-statement-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: color-mix(in srgb, var(--color-ledger-green) 10%, transparent);
  border: 1px solid var(--color-ledger-green);
  color: var(--color-ledger-green);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: 700;
  text-decoration: none;
  transition: all var(--duration-fast) var(--ease-standard);
}
.whatsapp-statement-btn:hover {
  background: var(--color-ledger-green);
  color: #FFFFFF;
}

.delete-cust-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  color: var(--color-market-clay);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: 700;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
}
.delete-cust-btn:hover {
  background: var(--color-market-clay);
  color: #FFFFFF;
  border-color: var(--color-market-clay);
}

.balance-block {
  margin: var(--space-2) 0;
}

.balance-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.balance-value {
  font-size: var(--text-4xl);
  font-weight: 800;
}

.balance-value--owed { color: var(--color-market-clay); }
.balance-value--credit { color: var(--color-ledger-green); }

.header-actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.section-title {
  font-size: var(--text-lg);
  margin-bottom: var(--space-3);
}

.ledger-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}
</style>