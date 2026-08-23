<script setup lang="ts">
// =============================================================================
// KauntaOS-frontend/src/components/landing/RoiCalculator.vue
// Interactive loss-aversion calculator quantifying forgotten Madeni & lost packages.
// =============================================================================

import { ref, computed } from 'vue';
import {
  TrendingDown,
  ArrowRight
} from 'lucide-vue-next';

// Sliders
const activeDebtorsCount = ref(15);
const weeklyDeliveriesCount = ref(20);

// Formulas calibrated for Kenyan SME shop realities:
// Avg uncollected/forgotten credit = KES 750 / debtor / month
// Avg lost/disputed boda delivery = KES 150 / delivery / month
const monthlyLostDebt = computed(() => activeDebtorsCount.value * 750);
const monthlyLostDeliveries = computed(() => weeklyDeliveriesCount.value * 4 * 150);
const totalEstimatedMonthlyLoss = computed(() => monthlyLostDebt.value + monthlyLostDeliveries.value);

const KauntaOSProCost = 1499;
const netAnnualSavings = computed(() => (totalEstimatedMonthlyLoss.value - KauntaOSProCost) * 12);
</script>

<template>
  <div class="roi-calculator-card card">
    <div class="roi-header">
      <div class="badge-row">
        <TrendingDown :size="16" class="text-clay" />
        <span class="roi-badge">Loss Aversion Calculator</span>
      </div>
      <h3 class="roi-title">How Much Money Are You Losing Every Month?</h3>
      <p class="roi-subtitle">
        Forgotten customer credit books and unverified boda deliveries cost the average Kenyan shopkeeper thousands of shillings in silent leakage.
      </p>
    </div>

    <div class="calculator-grid">
      <!-- Sliders Column -->
      <div class="sliders-column">
        <!-- Slider 1 -->
        <div class="slider-group">
          <div class="slider-top-label">
            <span>Credit Customers (Madeni)</span>
            <strong class="font-mono">{{ activeDebtorsCount }} customers</strong>
          </div>
          <input
            v-model.number="activeDebtorsCount"
            type="range"
            min="1"
            max="50"
            class="range-slider"
          />
          <span class="slider-hint">Avg. KES 750 lost per customer to delayed/forgotten follow-ups</span>
        </div>

        <!-- Slider 2 -->
        <div class="slider-group">
          <div class="slider-top-label">
            <span>Weekly Boda Deliveries</span>
            <strong class="font-mono">{{ weeklyDeliveriesCount }} deliveries / wk</strong>
          </div>
          <input
            v-model.number="weeklyDeliveriesCount"
            type="range"
            min="1"
            max="100"
            class="range-slider"
          />
          <span class="slider-hint">Avg. KES 150 lost to delivery disputes, wrong addresses &amp; theft</span>
        </div>
      </div>

      <!-- Live Loss & ROI Summary Column -->
      <div class="loss-summary-column">
        <div class="loss-card">
          <span class="loss-tag">Estimated Monthly Revenue Loss</span>
          <p class="loss-val font-mono text-clay">
            −KES {{ totalEstimatedMonthlyLoss.toLocaleString('en-KE') }}
          </p>
          <span class="loss-sub">KES {{ (totalEstimatedMonthlyLoss * 12).toLocaleString('en-KE') }} / year</span>
        </div>

        <div class="roi-comparison-box">
          <div class="comp-row">
            <span>KauntaOS Pro Subscription:</span>
            <strong class="font-mono text-teal">KES 1,499 / mo</strong>
          </div>
          <p class="comp-statement">
            KauntaOS pays for itself in your <strong>first 3 days</strong> of prevented leakage, saving you ~<strong>KES {{ netAnnualSavings.toLocaleString('en-KE') }}/year</strong>.
          </p>
          <RouterLink :to="{ name: 'register' }" class="btn-claim-savings">
            Protect Your Revenue Today <ArrowRight :size="14" />
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.roi-calculator-card {
  background: var(--surface-panel, #111816);
  border: 1px solid var(--border-color, #1F2E29);
  border-radius: var(--radius-lg, 16px);
  padding: var(--space-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--space-5, 20px);
}

.roi-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.badge-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-market-clay, #C2410C);
}

.roi-title {
  font-family: var(--font-display);
  font-size: var(--text-xl, 20px);
  font-weight: 700;
  color: var(--text-paper, #F3F6F4);
}

.roi-subtitle {
  font-size: var(--text-xs, 12px);
  color: var(--color-text-muted, #869E96);
  max-width: 640px;
  line-height: 1.5;
}

.calculator-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: var(--space-6, 24px);
}

@media (max-width: 768px) {
  .calculator-grid {
    grid-template-columns: 1fr;
  }
}

.sliders-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-5, 20px);
  justify-content: center;
}

.slider-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.slider-top-label {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs, 12px);
  color: var(--text-paper, #F3F6F4);
}

.range-slider {
  width: 100%;
  accent-color: var(--brand-primary, #D91E4E);
  height: 6px;
  border-radius: 99px;
  background: var(--color-bg, #090D0C);
  cursor: pointer;
}

.slider-hint { font-size: 10px; color: var(--color-text-muted, #869E96); }

.loss-summary-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.loss-card {
  background: color-mix(in srgb, var(--color-market-clay, #C2410C) 12%, var(--surface-panel, #111816));
  border: 1px solid var(--color-market-clay, #C2410C);
  border-radius: var(--radius-md, 10px);
  padding: 14px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.loss-tag { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--color-market-clay, #C2410C); }
.loss-val { font-size: var(--text-2xl, 24px); font-weight: 800; }
.loss-sub { font-size: 11px; color: var(--color-text-muted, #869E96); }

.roi-comparison-box {
  background: var(--color-bg, #090D0C);
  border: 1px solid var(--border-color, #1F2E29);
  border-radius: var(--radius-md, 10px);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comp-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-paper, #F3F6F4);
}

.comp-statement {
  font-size: 11px;
  color: var(--color-text-muted, #869E96);
  line-height: 1.4;
}

.comp-statement strong { color: var(--text-paper, #F3F6F4); }

.btn-claim-savings {
  background: var(--brand-primary, #D91E4E);
  color: #FFFFFF;
  text-decoration: none;
  font-size: 12px;
  font-weight: 700;
  padding: 10px;
  border-radius: var(--radius-md, 8px);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: opacity var(--duration-fast, 120ms) ease;
}
.btn-claim-savings:hover { opacity: 0.92; }

.text-clay { color: #FB7185; }
.text-teal { color: #34D399; }
</style>