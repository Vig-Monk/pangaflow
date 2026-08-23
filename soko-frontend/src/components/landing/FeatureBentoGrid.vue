<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/landing/FeatureBentoGrid.vue
// Asymmetrical 4-Card Bento Grid highlighting Soko's core operational pillars.
// =============================================================================

import {
  Globe,
  MessageSquare,
  TrendingUp,
  MapPin,
  CheckCircle2,
  Lock,
  ShieldCheck,
} from 'lucide-vue-next';
</script>

<template>
  <section id="features" class="features-section">
    <div class="section-title-block" data-reveal="zoom">
      <span class="section-tag">Platform Pillars</span>
      <h2 class="section-heading">Everything You Need to Run Your Shop</h2>
      <p class="section-desc">Designed with Kenyan merchants to automate retail, online sales, and credit tracking.</p>
    </div>

    <div class="features-bento-grid">
      <!-- BENTO 1: Instant Storefront (Span 7) -->
      <div class="bento-card bento-card--storefront" data-reveal="left">
        <div class="card-badge"><Globe :size="14" /> Online Storefront</div>
        <h3 class="card-title">A Branded Online Shop in 2 Minutes</h3>
        <p class="card-desc">
          Share <code>soko.app/store/yourname</code> on your Instagram bio and WhatsApp status. Shoppers drop their GPS delivery pin on our zero-cost map and pay directly to your till.
        </p>

        <div class="preview-mini-storefront">
          <div class="store-top-bar">
            <span class="store-url font-mono">soko.app/store/joys-boutique</span>
            <span class="live-pill">Live</span>
          </div>
          <div class="store-mock-body">
            <div class="mock-item"><span>Safari Boots</span><strong class="font-mono">KES 3,200</strong></div>
            <div class="mock-item"><span>Leather Handbag</span><strong class="font-mono">KES 1,800</strong></div>
            <div class="mock-delivery"><MapPin :size="12" /> Kilimani • Boda Fee: KES 128</div>
          </div>
        </div>
      </div>

      <!-- BENTO 2: WhatsApp Madeni Chaser (Span 5) -->
      <div class="bento-card bento-card--madeni" data-reveal="right">
        <div class="card-badge card-badge--amber"><MessageSquare :size="14" /> Madeni Chaser</div>
        <h3 class="card-title">1-Tap WhatsApp Statement Reminders</h3>
        <p class="card-desc">
          Never write customer debt in a wet book. View debtors by aging duration (0–7d, 8–30d, 30d+) and generate polite WhatsApp statements with one tap.
        </p>

        <div class="debt-chaser-preview">
          <div class="debtor-pill">
            <div><strong>Grace Njeri</strong><span class="debt-days font-mono">12 days overdue</span></div>
            <span class="debt-amt font-mono">KES 3,500</span>
          </div>
          <div class="action-btn-mock">
            <MessageSquare :size="12" /> Send WhatsApp Statement ↗
          </div>
        </div>
      </div>

      <!-- BENTO 3: True COGS & Gross Profit Margin (Span 5) -->
      <div class="bento-card bento-card--cogs" data-reveal="left" data-reveal-delay="100">
        <div class="card-badge card-badge--teal"><TrendingUp :size="14" /> True Financials</div>
        <h3 class="card-title">Real Gross Profit &amp; COGS P&amp;L</h3>
        <p class="card-desc">
          Soko tracks your true wholesale stock purchase costs (Cost of Goods Sold) and overhead expenses to show you what your business actually keeps.
        </p>

        <div class="pnl-waterfall-preview">
          <div class="pnl-row"><span>Billed Revenue</span><strong class="font-mono text-teal">KES 148,000</strong></div>
          <div class="pnl-row"><span>− Stock Cost (COGS)</span><span class="font-mono text-clay">−KES 82,000</span></div>
          <div class="pnl-row pnl-row--net"><span>= Real Gross Profit</span><strong class="font-mono text-teal">KES 66,000 (44%)</strong></div>
        </div>
      </div>

      <!-- BENTO 4: Direct-to-Till Zero Custody (Span 7) -->
      <div class="bento-card bento-card--security" data-reveal="right" data-reveal-delay="100">
        <div class="card-badge card-badge--green"><ShieldCheck :size="14" /> Daraja Pipe</div>
        <h3 class="card-title">Direct Safaricom Lipa Na M-Pesa</h3>
        <p class="card-desc">
          Connect your existing Buy Goods Till or Paybill in 3 minutes. Customer payments never touch Soko servers—they land 100% in your own business till immediately.
        </p>

        <div class="security-highlights-grid">
          <div class="sec-item"><Lock :size="16" class="text-teal" /><span>AES-256 Encrypted Credentials</span></div>
          <div class="sec-item"><CheckCircle2 :size="16" class="text-teal" /><span>Zero Transaction Holds</span></div>
          <div class="sec-item"><CheckCircle2 :size="16" class="text-teal" /><span>Instant STK Push Prompt</span></div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.features-section {
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

.features-bento-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
}

@media (max-width: 960px) {
  .features-bento-grid { grid-template-columns: 1fr; }
}

.bento-card {
  background: var(--surface-panel, #111816);
  border: 1px solid var(--border-color, #1F2E29);
  border-radius: var(--radius-lg, 16px);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bento-card--storefront { grid-column: span 7; }
.bento-card--madeni { grid-column: span 5; }
.bento-card--cogs { grid-column: span 5; }
.bento-card--security { grid-column: span 7; }

@media (max-width: 960px) {
  .bento-card--storefront,
  .bento-card--madeni,
  .bento-card--cogs,
  .bento-card--security {
    grid-column: span 1;
  }
}

.card-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--brand-primary, #D91E4E);
  background: color-mix(in srgb, var(--brand-primary, #D91E4E) 12%, transparent);
  padding: 3px 8px;
  border-radius: 99px;
  width: fit-content;
}

.card-badge--amber { color: #F59E0B; background: rgba(245, 158, 11, 0.12); }
.card-badge--teal { color: #34D399; background: rgba(52, 211, 153, 0.12); }
.card-badge--green { color: #10B981; background: rgba(16, 185, 129, 0.12); }

.card-title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  color: #F3F6F4;
}

.card-desc {
  font-size: 13px;
  color: #94A3B8;
  line-height: 1.5;
}

.preview-mini-storefront {
  background: #090D0C;
  border: 1px solid #1F2E29;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
}

.store-top-bar { display: flex; justify-content: space-between; align-items: center; font-size: 11px; }
.store-url { color: #869E96; }
.live-pill { font-size: 9px; font-weight: 700; background: #16A34A; color: #fff; padding: 1px 6px; border-radius: 99px; }

.store-mock-body { display: flex; flex-direction: column; gap: 4px; }
.mock-item { display: flex; justify-content: space-between; font-size: 11px; color: #E2E8F0; }
.mock-delivery { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #34D399; margin-top: 4px; }

.debt-chaser-preview {
  background: #090D0C;
  border: 1px solid #1F2E29;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
}

.debtor-pill { display: flex; justify-content: space-between; align-items: center; font-size: 11px; }
.debtor-pill strong { color: #F3F6F4; }
.debt-days { display: block; font-size: 9px; color: #F59E0B; }
.debt-amt { font-weight: 700; color: #FB7185; }

.action-btn-mock {
  background: color-mix(in srgb, #1F9D55 15%, transparent);
  border: 1px solid #1F9D55;
  color: #34D399;
  font-size: 10px;
  font-weight: 700;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.pnl-waterfall-preview {
  background: #090D0C;
  border: 1px solid #1F2E29;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: auto;
  font-size: 11px;
}

.pnl-row { display: flex; justify-content: space-between; color: #94A3B8; }
.pnl-row--net { border-top: 1px solid #1F2E29; padding-top: 4px; margin-top: 2px; color: #F3F6F4; }

.security-highlights-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: auto;
}

@media (max-width: 600px) {
  .security-highlights-grid { grid-template-columns: 1fr; }
}

.sec-item {
  background: #090D0C;
  border: 1px solid #1F2E29;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #E2E8F0;
}

.text-teal { color: #34D399; }
.text-clay { color: #FB7185; }
</style>