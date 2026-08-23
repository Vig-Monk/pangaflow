<script setup lang="ts">
// =============================================================================
// KauntaOS-frontend/src/components/landing/ComparisonBento.vue
// Asymmetrical comparison matrix: Traditional Kenyan shop chaos vs KauntaOS OS.
// =============================================================================

import { XCircle, CheckCircle2 } from 'lucide-vue-next';

interface ComparisonRow {
  pain: string;
  solution: string;
}

const comparisonRows: ComparisonRow[] = [
  {
    pain: 'Fake "Nimetuma" SMS messages & fraudulent payment screenshots',
    solution: 'Direct Safaricom Daraja STK Push depositing straight into your Till',
  },
  {
    pain: 'Lost, soaked, or torn counter books with uncollected Madeni',
    solution: 'Permanent cloud debt ledger backed up with 1-tap WhatsApp statements',
  },
  {
    pain: 'Typing your Till number 50 times a day in WhatsApp/Instagram DMs',
    solution: 'Dedicated online storefront link (KauntaOS.app/store/yourname)',
  },
  {
    pain: 'Boda rider disputes, wrong drop-off estates, and stolen parcels',
    solution: '4-digit handover confirmation code required to complete delivery',
  },
  {
    pain: 'Guessing your real profit after stock costs and overhead expenses',
    solution: 'Real COGS tracking and automated True Gross Profit waterfall',
  },
];
</script>

<template>
  <section class="comparison-section">
    <div class="section-title-block" data-reveal="zoom">
      <span class="section-tag">Why Switch</span>
      <h2 class="section-heading">The Old Way vs. The KauntaOS Way</h2>
      <p class="section-desc">See the difference between running your store on memory and running it on KauntaOS.</p>
    </div>

    <div class="comparison-board card" data-reveal>
      <div class="board-header">
        <div class="header-col header-col--old">
          <span>❌ The Old Way (Counter Book &amp; Manual DMs)</span>
        </div>
        <div class="header-col header-col--KauntaOS">
          <span>✅ The KauntaOS Way (Automated Operating System)</span>
        </div>
      </div>

      <div class="board-rows-list">
        <div v-for="(row, idx) in comparisonRows" :key="idx" class="board-row">
          <div class="row-cell row-cell--old">
            <XCircle :size="16" class="text-clay" />
            <span>{{ row.pain }}</span>
          </div>

          <div class="row-cell row-cell--KauntaOS">
            <CheckCircle2 :size="16" class="text-teal" />
            <strong>{{ row.solution }}</strong>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.comparison-section {
  max-width: 1240px;
  margin: 0 auto;
  padding: 40px 20px 60px;
}

.section-title-block {
  text-align: center;
  margin-bottom: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.section-tag {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--brand-primary, #D91E4E);
}

.section-heading {
  font-family: var(--font-display);
  font-size: clamp(24px, 2.5vw, 32px);
  font-weight: 800;
  color: #F3F6F4;
}

.section-desc { font-size: 13px; color: #94A3B8; }

.comparison-board {
  background: var(--surface-panel, #111816);
  border: 1px solid var(--border-color, #1F2E29);
  border-radius: var(--radius-lg, 16px);
  overflow: hidden;
}

.board-header {
  display: grid;
  grid-template-columns: 1fr 1.1fr;
  background: #090D0C;
  border-bottom: 1px solid #1F2E29;
}

@media (max-width: 768px) {
  .board-header { display: none; }
}

.header-col {
  padding: 14px 20px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.header-col--old { color: #FB7185; }
.header-col--KauntaOS { color: #34D399; background: color-mix(in srgb, #1F9D55 8%, #090D0C); border-left: 1px solid #1F2E29; }

.board-rows-list { display: flex; flex-direction: column; }

.board-row {
  display: grid;
  grid-template-columns: 1fr 1.1fr;
  border-bottom: 1px solid #1A2824;
}

@media (max-width: 768px) {
  .board-row {
    grid-template-columns: 1fr;
  }
}

.board-row:last-child { border-bottom: none; }

.row-cell {
  padding: 14px 20px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  line-height: 1.4;
}

.row-cell--old { color: #94A3B8; background: #0E1614; }
.row-cell--KauntaOS { color: #F3F6F4; background: color-mix(in srgb, #1F9D55 4%, #111816); border-left: 1px solid #1F2E29; }

@media (max-width: 768px) {
  .row-cell--KauntaOS { border-left: none; border-top: 1px dashed #1F2E29; }
}

.text-clay { color: #FB7185; flex-shrink: 0; margin-top: 2px; }
.text-teal { color: #34D399; flex-shrink: 0; margin-top: 2px; }
</style>