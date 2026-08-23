<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/landing/InteractivePosSimulator.vue
// =============================================================================

import { ref, computed } from 'vue';
import {
  User,
  Zap,
  Banknote,
  Clock,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  MessageSquare,
} from 'lucide-vue-next';

type DemoPaymentMode = 'credit' | 'cash' | 'mpesa_stk';

interface CartItem {
  id: string;
  name: string;
  price: number;
}

const customerName = ref('Grace Njeri');
const customerPhone = ref('0712 345 678');
const currentDebt = ref(1500);

const catalogItems: CartItem[] = [
  { id: '1', name: 'Leather Boots', price: 3200 },
  { id: '2', name: 'Handbag (Brown)', price: 1800 },
  { id: '3', name: 'Casual Shirt', price: 1200 },
];

const selectedItem = ref<CartItem>(catalogItems[0]);
const paymentMode = ref<DemoPaymentMode>('credit');
const isSimulating = ref(false);
const showStkPrompt = ref(false);
const stkPinInput = ref('');
const saleCompleted = ref(false);
const showWhatsAppCard = ref(false);
const recentTxType = ref<DemoPaymentMode>('credit');

const totalToPay = computed(() => selectedItem.value.price);

const simulatedWhatsAppText = computed(() => {
  const newBal = (currentDebt.value).toLocaleString('en-KE');
  return `*📋 SOKO STATEMENT — JOY'S BOUTIQUE*\n--------------------------------\nCustomer: Grace Njeri\nRecent Item: ${selectedItem.value.name} (KES ${selectedItem.value.price.toLocaleString('en-KE')})\n*Total Outstanding Balance:* KES ${newBal}\n--------------------------------\n_Kindly arrange payment via Till 174379. Thank you!_`;
});

function handleExecuteSale(): void {
  isSimulating.value = true;
  saleCompleted.value = false;
  showWhatsAppCard.value = false;

  if (paymentMode.value === 'mpesa_stk') {
    setTimeout(() => {
      isSimulating.value = false;
      showStkPrompt.value = true;
      stkPinInput.value = '';
    }, 600);
    return;
  }

  setTimeout(() => {
    isSimulating.value = false;
    saleCompleted.value = true;
    recentTxType.value = paymentMode.value;

    if (paymentMode.value === 'credit') {
      currentDebt.value += selectedItem.value.price;
      showWhatsAppCard.value = true;
    }
  }, 700);
}

function handleConfirmPin(): void {
  showStkPrompt.value = false;
  isSimulating.value = true;

  setTimeout(() => {
    isSimulating.value = false;
    saleCompleted.value = true;
    recentTxType.value = 'mpesa_stk';
  }, 900);
}

function handleReset(): void {
  currentDebt.value = 1500;
  saleCompleted.value = false;
  showWhatsAppCard.value = false;
  showStkPrompt.value = false;
  selectedItem.value = catalogItems[0];
  paymentMode.value = 'credit';
}
	  </script>

<template>
  <div class="pos-simulator-card">
    <div class="simulator-top-bar">
      <div class="terminal-badge">
        <span class="live-pulse"></span>
        <span>Interactive Smart POS Simulator</span>
      </div>
      <button type="button" class="reset-link" @click="handleReset" title="Reset simulator">
        <RefreshCw :size="12" /> Reset
      </button>
    </div>

    <!-- Active Customer Profile Header -->
    <div class="simulator-customer-header">
      <div class="cust-avatar">
        <User :size="16" />
      </div>
      <div class="cust-info">
        <div class="name-row">
          <strong>{{ customerName }}</strong>
          <span class="cust-phone font-mono">{{ customerPhone }}</span>
        </div>
        <div class="balance-tag">
          <span>Current Debt:</span>
          <strong class="font-mono text-amber">KES {{ currentDebt.toLocaleString('en-KE') }}</strong>
        </div>
      </div>
    </div>

    <!-- Step 1: Select Item -->
    <div class="simulator-step">
      <label class="sim-label">1. Select Product to Sell</label>
      <div class="catalog-chip-grid">
        <button
          v-for="item in catalogItems"
          :key="item.id"
          type="button"
          class="catalog-chip"
          :class="{ active: selectedItem.id === item.id }"
          @click="selectedItem = item; saleCompleted = false; showWhatsAppCard = false;"
        >
          <span class="chip-name">{{ item.name }}</span>
          <span class="chip-price font-mono">KES {{ item.price.toLocaleString('en-KE') }}</span>
        </button>
      </div>
    </div>

    <!-- Step 2: Payment Mode Selection -->
    <div class="simulator-step">
      <label class="sim-label">2. Select Settlement Channel</label>
      <div class="mode-pills-row">
        <button
          type="button"
          class="mode-pill mode-pill--credit"
          :class="{ active: paymentMode === 'credit' }"
          @click="paymentMode = 'credit'; saleCompleted = false;"
        >
          <Clock :size="14" />
          <span>Sell on Credit</span>
        </button>

        <button
          type="button"
          class="mode-pill mode-pill--stk"
          :class="{ active: paymentMode === 'mpesa_stk' }"
          @click="paymentMode = 'mpesa_stk'; saleCompleted = false;"
        >
          <Zap :size="14" />
          <span>M-Pesa STK</span>
        </button>

        <button
          type="button"
          class="mode-pill mode-pill--cash"
          :class="{ active: paymentMode === 'cash' }"
          @click="paymentMode = 'cash'; saleCompleted = false;"
        >
          <Banknote :size="14" />
          <span>Cash in Hand</span>
        </button>
      </div>
    </div>

    <!-- Step 3: Trigger Action Button -->
    <button
      type="button"
      class="simulate-submit-btn"
      :disabled="isSimulating"
      @click="handleExecuteSale"
    >
      <span v-if="isSimulating" class="btn-spinner"></span>
      <span v-else>
        {{
          paymentMode === 'credit'
            ? `Record KES ${totalToPay.toLocaleString('en-KE')} to Grace's Debt`
            : paymentMode === 'mpesa_stk'
              ? `Send STK PIN Prompt (KES ${totalToPay.toLocaleString('en-KE')})`
              : `Record KES ${totalToPay.toLocaleString('en-KE')} Cash Sale`
        }}
      </span>
    </button>

    <!-- Modal: Simulated Safaricom STK PIN Dialog -->
    <div v-if="showStkPrompt" class="stk-overlay">
      <div class="stk-dialog">
        <div class="stk-dialog-header">
          <span class="sim-brand">SIM Toolkit • M-Pesa</span>
        </div>
        <p class="stk-dialog-body">
          Do you want to pay <strong>KES {{ totalToPay.toLocaleString('en-KE') }}</strong> to <strong>JOY'S BOUTIQUE</strong> (Till 174379)?
        </p>
        <div class="pin-box">
          <input
            v-model="stkPinInput"
            type="password"
            maxlength="4"
            placeholder="••••"
            class="pin-input font-mono"
            autofocus
            @keyup.enter="handleConfirmPin"
          />
        </div>
        <div class="stk-dialog-actions">
          <button type="button" class="stk-btn-cancel" @click="showStkPrompt = false">Cancel</button>
          <button type="button" class="stk-btn-send" @click="handleConfirmPin">Send</button>
        </div>
      </div>
    </div>

    <!-- Success Outcome Notification -->
    <!-- Success Outcome Notification -->
    <div v-if="saleCompleted" class="success-outcome-box">
      <CheckCircle2 :size="16" class="text-teal" />
      <div class="outcome-text">
        <strong v-if="recentTxType === 'credit'">Recorded on Credit. Grace's new balance: KES {{ currentDebt.toLocaleString('en-KE') }}</strong>
        <strong v-else-if="recentTxType === 'mpesa_stk'">M-Pesa STK Confirmed! KES {{ totalToPay.toLocaleString('en-KE') }} deposited directly to Till.</strong>
        <strong v-else>Cash Sale Settled. Stock and financial ledger updated.</strong>
      </div>
    </div>
    <!-- WhatsApp Statement Preview Card (Triggered on Credit Sale) -->
    <div v-if="showWhatsAppCard" class="whatsapp-relay-card">
      <div class="wa-card-header">
        <MessageSquare :size="14" class="text-teal" />
        <span>1-Tap WhatsApp Statement Chaser</span>
      </div>
      <pre class="wa-message-preview">{{ simulatedWhatsAppText }}</pre>
      <div class="wa-card-footer">
        <span class="wa-hint"><ShieldCheck :size="12" /> Generates with 1 click in your real dashboard</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pos-simulator-card {
  background: var(--surface-panel, #111816);
  border: 1px solid var(--border-color, #1F2E29);
  border-radius: var(--radius-lg, 16px);
  padding: var(--space-5, 20px);
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
  position: relative;
  overflow: hidden;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4);
}

.simulator-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.terminal-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-paper, #F3F6F4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.live-pulse {
  width: 7px;
  height: 7px;
  background: var(--safari-green, #1F9D55);
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.3); }
}

.reset-link {
  background: transparent;
  border: none;
  color: var(--color-text-muted, #869E96);
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.reset-link:hover { color: var(--text-paper, #F3F6F4); }

.simulator-customer-header {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  background: color-mix(in srgb, var(--surface-panel, #111816) 60%, black);
  border: 1px solid var(--border-color, #1F2E29);
  padding: var(--space-3, 12px);
  border-radius: var(--radius-md, 10px);
}

.cust-avatar {
  width: 36px;
  height: 36px;
  background: var(--brand-primary, #D91E4E);
  color: #FFFFFF;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cust-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.name-row { display: flex; flex-direction: column; }
.name-row strong { font-size: var(--text-xs, 12px); color: var(--text-paper, #F3F6F4); }
.cust-phone { font-size: 10px; color: var(--color-text-muted, #869E96); }

.balance-tag {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 10px;
  color: var(--color-text-muted, #869E96);
}
.balance-tag strong { font-size: 12px; }

.simulator-step {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sim-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-text-muted, #869E96);
  letter-spacing: 0.05em;
}

.catalog-chip-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.catalog-chip {
  background: var(--color-bg, #090D0C);
  border: 1px solid var(--border-color, #1F2E29);
  border-radius: var(--radius-md, 8px);
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  text-align: left;
  transition: all var(--duration-fast, 120ms) ease;
}

.catalog-chip.active {
  border-color: var(--brand-primary, #D91E4E);
  background: color-mix(in srgb, var(--brand-primary, #D91E4E) 12%, var(--surface-panel, #111816));
}

.chip-name { font-size: 11px; font-weight: 600; color: var(--text-paper, #F3F6F4); }
.chip-price { font-size: 10px; color: var(--color-text-muted, #869E96); }

.mode-pills-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.mode-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: var(--color-bg, #090D0C);
  border: 1px solid var(--border-color, #1F2E29);
  padding: 8px 4px;
  border-radius: var(--radius-md, 8px);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-paper, #F3F6F4);
  cursor: pointer;
  transition: all var(--duration-fast, 120ms) ease;
}

.mode-pill.active {
  border-color: var(--brand-primary, #D91E4E);
  background: color-mix(in srgb, var(--brand-primary, #D91E4E) 12%, var(--surface-panel, #111816));
}

.mode-pill--credit.active { border-color: var(--ledger-gold, #F59E0B); }
.mode-pill--stk.active { border-color: var(--safari-green, #1F9D55); }

.simulate-submit-btn {
  background: var(--brand-primary, #D91E4E);
  color: #FFFFFF;
  border: none;
  padding: 12px;
  border-radius: var(--radius-md, 10px);
  font-weight: 700;
  font-size: var(--text-xs, 12px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  box-shadow: 0 4px 14px rgba(217, 30, 78, 0.35);
  transition: transform var(--duration-fast, 120ms) ease;
}
.simulate-submit-btn:hover:not(:disabled) { transform: translateY(-1px); }

/* Simulated Safaricom PIN Dialog */
.stk-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 16px;
  backdrop-filter: blur(3px);
}

.stk-dialog {
  background: #FFFFFF;
  color: #000000;
  border-radius: 12px;
  padding: 16px;
  width: 100%;
  max-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  animation: popIn 0.2s ease-out;
}

@keyframes popIn {
  from { transform: scale(0.92); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.sim-brand { font-size: 11px; font-weight: 700; color: #16A34A; }
.stk-dialog-body { font-size: 12px; line-height: 1.4; color: #1F2937; }

.pin-box { display: flex; justify-content: center; }
.pin-input {
  width: 100%;
  letter-spacing: 0.5em;
  text-align: center;
  font-size: 20px;
  padding: 6px;
  border: 1px solid #D1D5DB;
  border-radius: 6px;
  outline: none;
}

.stk-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
.stk-btn-cancel { background: transparent; border: none; font-weight: 600; font-size: 12px; color: #6B7280; cursor: pointer; padding: 4px 8px; }
.stk-btn-send { background: #16A34A; color: #FFFFFF; border: none; font-weight: 700; font-size: 12px; border-radius: 6px; padding: 6px 14px; cursor: pointer; }

/* Success Box */
.success-outcome-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: color-mix(in srgb, var(--safari-green, #1F9D55) 12%, var(--surface-panel, #111816));
  border: 1px solid var(--safari-green, #1F9D55);
  padding: 10px 12px;
  border-radius: var(--radius-md, 8px);
  font-size: 11px;
  color: var(--text-paper, #F3F6F4);
}

/* WhatsApp Relay Card */
.whatsapp-relay-card {
  background: #0B1E19;
  border: 1px solid #144A3D;
  border-radius: var(--radius-md, 8px);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wa-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  color: #34D399;
  text-transform: uppercase;
}

.wa-message-preview {
  background: #061310;
  border: 1px solid #0E352B;
  border-radius: 6px;
  padding: 8px;
  font-size: 10px;
  color: #E2E8F0;
  white-space: pre-wrap;
  font-family: inherit;
  line-height: 1.35;
  margin: 0;
}

.wa-card-footer {
  font-size: 9px;
  color: #94A3B8;
}

.text-teal { color: #34D399; }
.text-amber { color: #F59E0B; }
</style>