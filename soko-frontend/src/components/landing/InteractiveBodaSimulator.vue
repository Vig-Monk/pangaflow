<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/landing/InteractiveBodaSimulator.vue
// Interactive delivery distance, Haversine fee math & 4-digit handover verification toy.
// =============================================================================

import { ref, computed } from 'vue';
import {
  Bike,
  MapPin,
  KeyRound,
  CheckCircle2,
  Send,
  Navigation,
} from 'lucide-vue-next';

interface DestinationHub {
  id: string;
  name: string;
  lat: number;
  lng: number;
  sampleAddress: string;
}

// Fixed Merchant Base: Sarit Centre, Westlands
const MERCHANT_HUB = {
  name: 'Westlands Hub (Sarit Centre)',
  lat: -1.2683,
  lng: 36.8111,
};

const destinations: DestinationHub[] = [
  { id: '1', name: 'Kilimani (Chaka Rd)', lat: -1.2908, lng: 36.7828, sampleAddress: 'Kilimani, Chaka Place, Apt 4B' },
  { id: '2', name: 'South B (Plainsview)', lat: -1.3125, lng: 36.8372, sampleAddress: 'South B, Plainsview Estate, Gate 2' },
  { id: '3', name: 'Kasarani (Seasons)', lat: -1.2225, lng: 36.9033, sampleAddress: 'Kasarani, Seasons Area, House B4' },
  { id: '4', name: 'Rongai (Maasai Lodge)', lat: -1.3967, lng: 36.7578, sampleAddress: 'Ongata Rongai, Tuskys Stage' },
];

const selectedDest = ref<DestinationHub>(destinations[0]);
const dispatchState = ref<'ready' | 'assigned' | 'out' | 'delivered'>('ready');
const confirmationCode = ref('7K9M');

// Haversine Distance Calculation
const distanceKm = computed(() => {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(selectedDest.value.lat - MERCHANT_HUB.lat);
  const dLon = toRad(selectedDest.value.lng - MERCHANT_HUB.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(MERCHANT_HUB.lat)) * Math.cos(toRad(selectedDest.value.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
});

// Tiered Kenyan Delivery Fee: Base KES 100 (up to 3km) + KES 25/km beyond
const deliveryFee = computed(() => {
  const dist = distanceKm.value;
  const billable = Math.max(0, dist - 3);
  return Math.round(100 + billable * 25);
});

function handleDispatch(): void {
  dispatchState.value = 'assigned';
  setTimeout(() => {
    dispatchState.value = 'out';
  }, 800);
}

function handleVerifyHandover(): void {
  dispatchState.value = 'delivered';
}
</script>

<template>
  <div class="boda-simulator-card">
    <div class="simulator-header">
      <div class="boda-badge">
        <Bike :size="16" class="text-teal" />
        <span>Automated Boda Dispatch &amp; Handover Engine</span>
      </div>
      <span class="gps-active-tag font-mono"><Navigation :size="11" /> Haversine GPS</span>
    </div>

    <!-- Route Selector -->
    <div class="route-selector-box">
      <div class="origin-tag">
        <span class="dot origin-dot"></span>
        <span class="hub-text">From: <strong>{{ MERCHANT_HUB.name }}</strong></span>
      </div>

      <div class="destination-tabs">
        <button
          v-for="d in destinations"
          :key="d.id"
          type="button"
          class="dest-tab"
          :class="{ active: selectedDest.id === d.id }"
          @click="selectedDest = d; dispatchState = 'ready';"
        >
          <MapPin :size="12" />
          <span>{{ d.name }}</span>
        </button>
      </div>
    </div>

    <!-- Live Calculation Board -->
    <div class="delivery-metrics-grid">
      <div class="metric-card">
        <span class="metric-label">Road Distance</span>
        <span class="metric-val font-mono">{{ distanceKm }} km</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Calculated Rider Fee</span>
        <span class="metric-val font-mono text-teal">KES {{ deliveryFee }}</span>
      </div>

      <div class="metric-card metric-card--code">
        <span class="metric-label">4-Digit Security Code</span>
        <span class="metric-code font-mono">{{ confirmationCode }}</span>
      </div>
    </div>

    <!-- Live Handover Progression Bar -->
    <div class="dispatch-action-area">
      <div v-if="dispatchState === 'ready'" class="dispatch-ready-view">
        <p class="ready-hint">Calculated dynamically at checkout without costly Google Maps API billing.</p>
        <button type="button" class="btn-dispatch-sim" @click="handleDispatch">
          <Send :size="14" /> Dispatch Simulated Rider (Dennis)
        </button>
      </div>

      <div v-else-if="dispatchState === 'assigned' || dispatchState === 'out'" class="dispatch-transit-view">
        <div class="transit-status-row">
          <span class="transit-rider font-mono">🏍️ Rider: Dennis Mwangi (In Transit)</span>
          <span class="transit-pulse">Out for Delivery</span>
        </div>
        <button type="button" class="btn-verify-sim" @click="handleVerifyHandover">
          <KeyRound :size="14" /> Rider Enters '{{ confirmationCode }}' to Complete Handover
        </button>
      </div>

      <div v-else class="dispatch-delivered-view">
        <CheckCircle2 :size="18" class="text-teal" />
        <div class="delivered-copy">
          <strong>Handover Verified &amp; Completed!</strong>
          <span>Money deposited &amp; parcel theft prevented by 4-digit code.</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.boda-simulator-card {
  background: var(--surface-panel, #111816);
  border: 1px solid var(--border-color, #1F2E29);
  border-radius: var(--radius-lg, 16px);
  padding: var(--space-5, 20px);
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4);
}

.simulator-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.boda-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-paper, #F3F6F4);
  text-transform: uppercase;
}

.gps-active-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: #34D399;
  background: color-mix(in srgb, #1F9D55 15%, transparent);
  padding: 2px 6px;
  border-radius: 4px;
}

.route-selector-box {
  background: var(--color-bg, #090D0C);
  border: 1px solid var(--border-color, #1F2E29);
  border-radius: var(--radius-md, 10px);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.origin-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-muted, #869E96);
}

.origin-dot {
  width: 6px;
  height: 6px;
  background: #34D399;
  border-radius: 50%;
}

.hub-text strong {
  color: var(--text-paper, #F3F6F4);
}

.destination-tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.dest-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--surface-panel, #111816);
  border: 1px solid var(--border-color, #1F2E29);
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 11px;
  color: var(--text-paper, #F3F6F4);
  cursor: pointer;
  transition: all var(--duration-fast, 120ms) ease;
}

.dest-tab.active {
  border-color: #34D399;
  background: color-mix(in srgb, #1F9D55 15%, var(--surface-panel, #111816));
}

.delivery-metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.metric-card {
  background: var(--color-bg, #090D0C);
  border: 1px solid var(--border-color, #1F2E29);
  border-radius: var(--radius-md, 8px);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metric-card--code {
  border-color: var(--brand-primary, #D91E4E);
  background: color-mix(in srgb, var(--brand-primary, #D91E4E) 8%, var(--color-bg, #090D0C));
}

.metric-label {
  font-size: 9px;
  text-transform: uppercase;
  color: var(--color-text-muted, #869E96);
  font-weight: 700;
}

.metric-val {
  font-size: 14px;
  font-weight: 800;
  color: var(--text-paper, #F3F6F4);
}

.metric-code {
  font-size: 15px;
  font-weight: 800;
  color: var(--brand-primary, #D91E4E);
  letter-spacing: 0.1em;
}

.dispatch-action-area {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ready-hint {
  font-size: 10px;
  color: var(--color-text-muted, #869E96);
}

.btn-dispatch-sim {
  background: var(--surface-panel, #111816);
  color: var(--text-paper, #F3F6F4);
  border: 1px solid #1F9D55;
  padding: 10px;
  border-radius: var(--radius-md, 8px);
  font-weight: 700;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-verify-sim {
  background: #1F9D55;
  color: #FFFFFF;
  border: none;
  padding: 10px;
  border-radius: var(--radius-md, 8px);
  font-weight: 700;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.transit-status-row {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  margin-bottom: 4px;
}

.transit-pulse {
  color: #F59E0B;
  font-weight: 700;
}

.dispatch-delivered-view {
  display: flex;
  align-items: center;
  gap: 8px;
  background: color-mix(in srgb, #1F9D55 12%, var(--surface-panel, #111816));
  border: 1px solid #1F9D55;
  padding: 10px;
  border-radius: var(--radius-md, 8px);
}

.delivered-copy {
  display: flex;
  flex-direction: column;
}

.delivered-copy strong {
  font-size: 11px;
  color: var(--text-paper, #F3F6F4);
}

.delivered-copy span {
  font-size: 10px;
  color: var(--color-text-muted, #869E96);
}

.text-teal {
  color: #34D399;
}
</style>