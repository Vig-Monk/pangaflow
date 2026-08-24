<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/landing/FlagshipPillars.vue
// 3 Flagship Pillars Bento Grid: Online Storefront, Direct STK POS, & Madeni Ledger.
// =============================================================================

import {
  Globe,
  Zap,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  Lock,
} from 'lucide-vue-next';
</script>

<template>
  <section id="features" class="pillars-section">
    <!-- Section Title -->
    <div class="section-title-block" data-reveal="zoom">
      <span class="section-tag">Core Capabilities</span>
      <h2 class="section-heading">Three Flagship Tools. One Clean Counter.</h2>
      <p class="section-desc">Designed to solve the daily operational bottlenecks of Kenyan retail and commerce.</p>
    </div>

    <!-- 3-Pillar Bento Grid -->
    <div class="pillars-grid">
      <!-- PILLAR 1: READY E-COMMERCE STOREFRONT & BODA DISPATCH -->
      <div class="pillar-card card" data-reveal="left">
        <div class="pillar-top-badge">
          <Globe :size="13" class="text-teal" />
          <span>E-Commerce &amp; Boda Engine</span>
        </div>

        <h3 class="pillar-title">Ready Online Storefront &amp; Boda GPS Dispatch</h3>
        <p class="pillar-desc">
          Share your link on Instagram, TikTok, and WhatsApp. Shoppers drop their GPS pin on our map; delivery fees calculate live with 4-digit handover codes to prevent parcel theft.
        </p>

        <!-- Pure CSS Mini UI Art: Storefront & Boda Route -->
        <div class="mini-ui-art art-storefront">
          <div class="store-url-badge">
            <Globe :size="12" class="text-teal" />
            <span class="font-mono">kauntaos.co.ke/store/joy</span>
            <span class="live-pill">Live Shop</span>
          </div>

          <div class="route-calc-pill">
            <div class="route-loc">
              <MapPin :size="12" class="text-teal" />
              <span>Sarit Centre ➔ Kilimani (4.1 km)</span>
            </div>
            <span class="route-fee font-mono text-teal">Boda: KES 128</span>
          </div>

          <div class="handover-pin-box">
            <span class="pin-label">Anti-Theft Handover Code:</span>
            <strong class="font-mono text-brand">7 K 9 M</strong>
            <span class="verified-tag"><CheckCircle2 :size="11" /> Verified</span>
          </div>
        </div>
      </div>

      <!-- PILLAR 2: SMART POS & DIRECT-TO-TILL M-PESA STK -->
      <div class="pillar-card card" data-reveal="zoom">
        <div class="pillar-top-badge badge--green">
          <Zap :size="13" class="text-amber" />
          <span>Smart POS &amp; STK Push</span>
        </div>

        <h3 class="pillar-title">Direct M-Pesa STK Push. Zero Holding Accounts.</h3>
        <p class="pillar-desc">
          Send instant PIN prompts to customer phones at your counter or online. 100% of customer payments land immediately in your own Buy Goods Till or Paybill.
        </p>

        <!-- Pure CSS Mini UI Art: Simulated STK & Direct Pipe -->
        <div class="mini-ui-art art-pos">
          <div class="stk-mini-receipt">
            <div class="receipt-header-row">
              <span class="receipt-till font-mono">Till: 174379</span>
              <span class="receipt-paid-pill">PAID • 100% IN TILL</span>
            </div>
            <div class="receipt-amount-row">
              <span class="receipt-item">1x Leather Handbag</span>
              <strong class="font-mono text-teal">KES 2,500.00</strong>
            </div>
          </div>

          <div class="direct-pipe-indicator">
            <ShieldCheck :size="14" class="text-teal" />
            <span>Customer Phone ➔ Safaricom ➔ Your Till</span>
          </div>

          <div class="zero-custody-guarantee">
            <Lock :size="12" class="text-muted" />
            <span>KauntaOS never touches, delays, or holds your revenue.</span>
          </div>
        </div>
      </div>

      <!-- PILLAR 3: WHATSAPP MADENI LEDGER & REAL COGS P&L -->
      <div class="pillar-card card" data-reveal="right">
        <div class="pillar-top-badge badge--amber">
          <MessageSquare :size="13" class="text-amber" />
          <span>Madeni Chaser &amp; Financials</span>
        </div>

        <h3 class="pillar-title">1-Tap WhatsApp Debt Recovery &amp; True COGS</h3>
        <p class="pillar-desc">
          Replace wet counter books with an automated debt ledger. View debtors by aging buckets (0–7d, 8–30d, 30d+) and generate polite WhatsApp statement reminders in one click.
        </p>

        <!-- Pure CSS Mini UI Art: WhatsApp Statement Chaser -->
        <div class="mini-ui-art art-madeni">
          <div class="debtor-status-row">
            <div>
              <strong>Grace Njeri</strong>
              <span class="aging-tag font-mono">12 days overdue</span>
            </div>
            <strong class="font-mono text-clay">KES 3,500</strong>
          </div>

          <div class="wa-action-button-mock">
            <MessageSquare :size="13" /> Send WhatsApp Statement ↗
          </div>

          <div class="pnl-summary-pill">
            <span>Wholesale COGS: KES 82K</span>
            <span class="font-mono text-teal">Gross Margin: 44%</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pillars-section {
  max-width: 1240px;
  margin: 0 auto;
  padding: 40px 20px 60px;
}

.section-title-block {
  text-align: center;
  margin-bottom: 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.section-tag {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--brand-primary, #D91E4E);
  letter-spacing: 0.05em;
}

.section-heading {
  font-family: var(--font-display);
  font-size: clamp(24px, 2.5vw, 34px);
  font-weight: 800;
  color: #F3F6F4;
  letter-spacing: -0.02em;
}

.section-desc {
  font-size: 13px;
  color: #94A3B8;
  max-width: 600px;
}

/* 3-Card Grid */
.pillars-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}

@media (max-width: 960px) {
  .pillars-grid {
    grid-template-columns: 1fr;
  }
}

.pillar-card {
  background: var(--surface-panel, #111816);
  border: 1px solid var(--border-color, #1F2E29);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg, 16px);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: transform 150ms ease, border-color 150ms ease;
}

.pillar-card:hover {
  transform: translateY(-2px);
  border-color: #2F453E;
}

.pillar-top-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #34D399;
  background: rgba(52, 211, 153, 0.1);
  padding: 3px 8px;
  border-radius: 99px;
  width: fit-content;
}

.badge--green { color: #10B981; background: rgba(16, 185, 129, 0.1); }
.badge--amber { color: #F59E0B; background: rgba(245, 158, 11, 0.1); }

.pillar-title {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 700;
  color: #F3F6F4;
  line-height: 1.25;
}

.pillar-desc {
  font-size: 13px;
  color: #94A3B8;
  line-height: 1.5;
}

/* =========================================================================
   PURE CSS MINI-UI ART
   ========================================================================= */
.mini-ui-art {
  background: #090D0C;
  border: 1px solid #1F2E29;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
}

/* Card 1: Storefront Art */
.store-url-badge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #869E96;
  border-bottom: 1px solid #15201C;
  padding-bottom: 6px;
}

.live-pill {
  font-size: 9px;
  font-weight: 700;
  background: #16A34A;
  color: #FFFFFF;
  padding: 1px 6px;
  border-radius: 99px;
}

.route-calc-pill {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #E2E8F0;
}

.route-loc {
  display: flex;
  align-items: center;
  gap: 4px;
}

.handover-pin-box {
  background: #0E1614;
  border: 1px dashed #1F2E29;
  border-radius: 6px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  color: #869E96;
}

.verified-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  font-weight: 700;
  color: #34D399;
}

/* Card 2: POS Art */
.stk-mini-receipt {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-bottom: 1px solid #15201C;
  padding-bottom: 6px;
}

.receipt-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.receipt-till { font-size: 10px; color: #869E96; }
.receipt-paid-pill { font-size: 8px; font-weight: 800; background: #10B981; color: #000000; padding: 1px 5px; border-radius: 3px; }

.receipt-amount-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #E2E8F0;
}

.direct-pipe-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 600;
  color: #34D399;
}

.zero-custody-guarantee {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  color: #64748B;
}

/* Card 3: Madeni Art */
.debtor-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #F3F6F4;
}

.aging-tag {
  display: block;
  font-size: 9px;
  color: #F59E0B;
}

.wa-action-button-mock {
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
  gap: 6px;
}

.pnl-summary-pill {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: #869E96;
  border-top: 1px solid #15201C;
  padding-top: 4px;
}

.text-teal { color: #34D399; }
.text-amber { color: #F59E0B; }
.text-clay { color: #FB7185; }
.text-brand { color: var(--brand-primary, #D91E4E); }
</style>