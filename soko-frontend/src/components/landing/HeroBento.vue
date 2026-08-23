<script setup lang="ts">
// =============================================================================
// KauntaOS-frontend/src/components/landing/HeroBento.vue
// Asymmetrical 12-column Hero Bento grid orchestrating pain hooks & live toys.
// =============================================================================

import InteractivePosSimulator from './InteractivePosSimulator.vue';
import InteractiveBodaSimulator from './InteractiveBodaSimulator.vue';
import {
  ShieldCheck,
  Zap,
  MessageSquare,
  ArrowRight,
  Sparkles,
  Layers,
} from 'lucide-vue-next';

// WhatsApp Concierge Link
const whatsappConciergeUrl =
  'https://wa.me/254700000000?text=' +
  encodeURIComponent("Hello KauntaOS Team, I run a business in Kenya and want help setting up my store, M-Pesa Till & Madeni tracker.");
</script>

<template>
  <section id="hero" class="hero-bento-section">
    <div class="bento-12-grid">
      <!-- CELL 1: MAIN HOOK & DUAL CTAS (Span 7) -->
      <div class="bento-cell bento-cell--hero" data-reveal="left">
        <div class="kenya-pill">
          <span class="flag-icon">🇰🇪</span>
          <span>Built for Kenyan Shops, Boutiques &amp; Traders</span>
        </div>

        <h1 class="hero-headline">
          Stop Losing Money to Forgotten <span class="text-amber">Madeni</span> and Unverified Deliveries.
        </h1>

        <p class="hero-subheadline">
          The complete operating system for Kenyan commerce. Launch your branded storefront in 2 minutes, get paid directly to your <strong>M-Pesa Till</strong>, dispatch bodas with <strong>4-digit handover codes</strong>, and recover debt via <strong>1-tap WhatsApp statement chasers</strong>.
        </p>

        <div class="hero-cta-row">
          <RouterLink :to="{ name: 'register' }" class="btn-hero-primary">
            Create Your Free Store <ArrowRight :size="16" />
          </RouterLink>
          
          <a :href="whatsappConciergeUrl" target="_blank" rel="noopener" class="btn-hero-whatsapp">
            <MessageSquare :size="16" /> WhatsApp Concierge Setup
          </a>
        </div>

        <div class="trust-guarantees-row">
          <div class="trust-pill">
            <ShieldCheck :size="14" class="text-teal" />
            <span>Zero Custody (100% to Your Till)</span>
          </div>
          <div class="trust-pill">
            <Zap :size="14" class="text-amber" />
            <span>Instant Safaricom STK Push</span>
          </div>
          <div class="trust-pill">
            <Layers :size="14" class="text-teal" />
            <span>No Coding Required</span>
          </div>
        </div>
      </div>

      <!-- CELL 2: INTERACTIVE POS & STK SIMULATOR (Span 5) -->
      <div class="bento-cell bento-cell--pos" data-reveal="right">
        <InteractivePosSimulator />
      </div>

      <!-- CELL 3: INTERACTIVE BODA & VERIFICATION TOY (Span 5) -->
      <div class="bento-cell bento-cell--boda" data-reveal="left" data-reveal-delay="100">
        <InteractiveBodaSimulator />
      </div>

      <!-- CELL 4: MORNING STANDUP SPOTLIGHT & PULSE TICKER (Span 7) -->
      <div class="bento-cell bento-cell--standup" data-reveal="right" data-reveal-delay="100">
        <div class="standup-inner">
          <div class="standup-header">
            <div class="standup-title-row">
              <Sparkles :size="16" class="text-teal" />
              <h3>The 7:30 AM Morning Standup Engine</h3>
            </div>
            <span class="standup-tag font-mono">Real-Time Cockpit</span>
          </div>

          <p class="standup-desc">
            Open your dashboard every morning and know exactly: what cash was collected, which orders need packing, who owes you overdue madeni, and which stock items are running low.
          </p>

          <div class="standup-metrics-row">
            <div class="mini-kpi">
              <span class="mini-kpi-label">Cash Collected</span>
              <strong class="font-mono text-teal">Live to Till</strong>
            </div>
            <div class="mini-kpi">
              <span class="mini-kpi-label">Debt Velocity</span>
              <strong class="font-mono text-amber">0–7d • 8–30d • 30d+</strong>
            </div>
            <div class="mini-kpi">
              <span class="mini-kpi-label">Stockout Radar</span>
              <strong class="font-mono">Auto Alerts</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero-bento-section {
  max-width: 1240px;
  margin: 0 auto;
  padding: 40px 20px 60px;
}

.bento-12-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
}

@media (max-width: 960px) {
  .bento-12-grid {
    grid-template-columns: 1fr;
  }
}

.bento-cell {
  background: var(--surface-panel, #111816);
  border: 1px solid var(--border-color, #1F2E29);
  border-radius: var(--radius-lg, 16px);
  padding: 24px;
  display: flex;
  flex-direction: column;
}

.bento-cell--hero {
  grid-column: span 7;
  justify-content: center;
  gap: 18px;
  background: linear-gradient(135deg, #131E1B 0%, #0E1614 100%);
  border-color: #243832;
}

.bento-cell--pos {
  grid-column: span 5;
  padding: 0;
  background: transparent;
  border: none;
}

.bento-cell--boda {
  grid-column: span 5;
  padding: 0;
  background: transparent;
  border: none;
}

.bento-cell--standup {
  grid-column: span 7;
  justify-content: center;
  background: #0D1614;
  border: 1px solid #1A2824;
}

@media (max-width: 960px) {
  .bento-cell--hero,
  .bento-cell--pos,
  .bento-cell--boda,
  .bento-cell--standup {
    grid-column: span 1;
  }
}

.kenya-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #FBBF24;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 99px;
  width: fit-content;
}

.hero-headline {
  font-family: var(--font-display);
  font-size: clamp(26px, 3.2vw, 38px);
  font-weight: 800;
  line-height: 1.18;
  color: #F3F6F4;
  letter-spacing: -0.02em;
}

.hero-subheadline {
  font-size: 14px;
  color: #94A3B8;
  line-height: 1.6;
  max-width: 600px;
}

.hero-subheadline strong { color: #E2E8F0; }

.hero-cta-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn-hero-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--brand-primary, #D91E4E);
  color: #FFFFFF;
  text-decoration: none;
  font-size: 14px;
  font-weight: 700;
  padding: 12px 22px;
  border-radius: 10px;
  box-shadow: 0 8px 20px rgba(217, 30, 78, 0.35);
  transition: transform 120ms ease;
}
.btn-hero-primary:hover { transform: translateY(-2px); }

.btn-hero-whatsapp {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: color-mix(in srgb, #1F9D55 18%, transparent);
  border: 1px solid #1F9D55;
  color: #34D399;
  text-decoration: none;
  font-size: 14px;
  font-weight: 700;
  padding: 12px 20px;
  border-radius: 10px;
  transition: background 120ms ease;
}
.btn-hero-whatsapp:hover { background: #1F9D55; color: #FFFFFF; }

.trust-guarantees-row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  border-top: 1px solid #1F2E29;
  padding-top: 14px;
  margin-top: 4px;
}

.trust-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #869E96;
}

.standup-inner { display: flex; flex-direction: column; gap: 12px; }
.standup-header { display: flex; justify-content: space-between; align-items: center; }
.standup-title-row { display: flex; align-items: center; gap: 8px; }
.standup-title-row h3 { font-size: 15px; font-weight: 700; color: #F3F6F4; }
.standup-tag { font-size: 10px; background: #182622; color: #34D399; padding: 2px 6px; border-radius: 4px; }
.standup-desc { font-size: 12px; color: #94A3B8; line-height: 1.5; }

.standup-metrics-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  background: #090D0C;
  border: 1px solid #1F2E29;
  border-radius: 10px;
  padding: 10px;
}

.mini-kpi { display: flex; flex-direction: column; gap: 2px; }
.mini-kpi-label { font-size: 9px; text-transform: uppercase; color: #64748B; font-weight: 700; }
.mini-kpi strong { font-size: 12px; color: #F3F6F4; }

.text-teal { color: #34D399; }
.text-amber { color: #F59E0B; }
</style>