<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/landing/MonolithHero.vue
// Minimalist, high-converting hero stage with pure CSS "UI-As-Art" dual viewport.
// =============================================================================

import { ref } from 'vue';
import {
  ArrowRight,
  MessageSquare,
  ShieldCheck,
  Zap,
  MapPin,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
} from 'lucide-vue-next';

// WhatsApp Concierge Link
const whatsappConciergeUrl =
  'https://wa.me/254700000000?text=' +
  encodeURIComponent("Hello KauntaOS Team, I run a shop in Kenya and want help setting up my online store, M-Pesa Till & Madeni tracker.");

//const activeTab = ref<'both' | 'store' | 'merchant'>('both');
</script>

<template>
  <section class="hero-stage">

    <!-- Ambient Lighting Atmosphere -->
    <div class="ambient-glow" aria-hidden="true"></div>

    <div class="hero-container">
      <!-- 1. HEADLINE & PUNCHY VALUE PROPOSITION -->
      <div class="hero-copy-block" data-reveal="zoom">
        <div class="kenya-pill">
          <span class="flag-icon">🇰🇪</span>
          <span>The Retail &amp; Counter OS for Kenya</span>
        </div>

        <h1 class="hero-title">
          The Online Storefront and Counter Operating System.
        </h1>

        <p class="hero-subtitle">
          Launch your branded online store in 2 minutes, get paid directly to your <strong>M-Pesa Till</strong>, track customer madeni on WhatsApp, and automate boda delivery dispatch.
        </p>

        <div class="hero-cta-group">
          <RouterLink :to="{ name: 'register' }" class="btn-primary-hero">
            Create Your Free Store <ArrowRight :size="16" />
          </RouterLink>
          <a :href="whatsappConciergeUrl" target="_blank" rel="noopener" class="btn-secondary-hero">
            <MessageSquare :size="16" class="text-teal" /> WhatsApp Concierge Setup
          </a>
        </div>

        <!-- Trust Badges -->
        <div class="trust-row">
          <div class="trust-item">
            <ShieldCheck :size="14" class="text-teal" />
            <span>Zero Custody (100% Direct to Till)</span>
          </div>
          <div class="trust-item">
            <Zap :size="14" class="text-amber" />
            <span>Instant Safaricom STK Push</span>
          </div>
          <div class="trust-item">
            <Layers :size="14" class="text-teal" />
            <span>Setup in 2 Minutes</span>
          </div>
        </div>
      </div>

      <!-- 2. "UI-AS-ART" MONOLITHIC DUAL VIEWPORT MOCKUP -->
      <div class="monolith-canvas card" data-reveal>
        <div class="canvas-window-bar">
          <div class="window-controls">
            <span class="window-dot dot-red"></span>
            <span class="window-dot dot-yellow"></span>
            <span class="window-dot dot-green"></span>
          </div>
          <div class="window-address-pill font-mono">
            <Lock :size="11" class="text-teal" />
            <span>kauntaos.co.ke/app</span>
          </div>
          <div class="till-live-status">
            <span class="live-pulse"></span>
            <span class="font-mono">Till: 174379 (Active)</span>
          </div>
        </div>

        <div class="monolith-viewports-split">
          <!-- SUB-VIEWPORT A: CUSTOMER STOREFRONT (Mobile Frame) -->
          <div class="viewport-customer">
            <div class="viewport-badge">
              <span>Customer Storefront</span>
              <span class="url-hint font-mono">/store/joys-boutique</span>
            </div>

            <!-- Customer Mock UI -->
            <div class="customer-app-frame">
              <div class="store-mini-hero">
                <div class="store-avatar">JB</div>
                <div class="store-title-block">
                  <strong>Joy's Boutique</strong>
                  <span>Westlands, Nairobi</span>
                </div>
              </div>

              <!-- Product Card -->
              <div class="product-item-card">
                <div class="product-info-col">
                  <span class="product-tag">Catalog Item</span>
                  <strong>Safari Boots (Leather)</strong>
                  <span class="product-price font-mono">KES 3,200</span>
                </div>
                <span class="badge-in-stock">In Stock</span>
              </div>

              <!-- GPS Checkout Drop & Boda Fee -->
              <div class="gps-checkout-block">
                <div class="gps-loc-row">
                  <MapPin :size="13" class="text-teal" />
                  <span>Delivery to: <strong>Kilimani, Chaka Rd</strong> (4.1 km)</span>
                </div>
                <div class="fee-calculated-row">
                  <span class="text-muted">Automated Boda Fee:</span>
                  <strong class="font-mono text-teal">KES 128</strong>
                </div>
              </div>

              <!-- Instant STK Prompt Banner -->
              <div class="stk-prompt-banner">
                <Zap :size="14" class="text-amber" />
                <span>M-Pesa STK Sent • Enter PIN on phone</span>
              </div>
            </div>
          </div>

          <!-- SUB-VIEWPORT B: MERCHANT KAUNTA OS (Counter & Till View) -->
          <div class="viewport-merchant">
            <div class="viewport-badge">
              <span>Merchant Counter OS</span>
              <span class="url-hint font-mono">Real-Time Ledger</span>
            </div>

            <!-- Merchant Mock UI -->
            <div class="merchant-app-frame">
              <!-- Live Cash Pulse -->
              <div class="merchant-kpi-block">
                <div class="kpi-micro-label">Today's Cash in Till (100% Yours)</div>
                <div class="kpi-main-val font-mono text-teal">KES 48,250.00</div>
                <div class="kpi-sub-row">
                  <span>Sales: KES 54,000</span>
                  <span>Unpaid Madeni: KES 12,400</span>
                </div>
              </div>

              <!-- Live Verified Order Handover Card -->
              <div class="live-dispatch-card">
                <div class="dispatch-top">
                  <span class="order-id font-mono">#7K9M • Safari Boots</span>
                  <span class="pill-paid">PAID IN TILL</span>
                </div>
                <div class="dispatch-details">
                  <span>Customer: <strong>Grace Njeri</strong> (Kilimani)</span>
                  <div class="security-code-tag">
                    <span>Handover PIN:</span>
                    <strong class="font-mono text-brand">7 K 9 M</strong>
                  </div>
                </div>
              </div>

              <!-- WhatsApp Madeni Statement Chaser Card -->
              <div class="madeni-chaser-card">
                <div class="chaser-info">
                  <strong>Kevin Ochieng</strong>
                  <span class="text-clay font-mono">Owes KES 2,400 (8d ago)</span>
                </div>
                <div class="wa-quick-link">
                  <MessageSquare :size="12" /> Send WhatsApp Statement ↗
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Feature Ribbon -->
        <div class="monolith-bottom-ribbon">
          <div class="ribbon-item">
            <Sparkles :size="14" class="text-teal" />
            <span>Storefront orders sync to your stock &amp; ledger instantly</span>
          </div>
          <div class="ribbon-item">
            <CheckCircle2 :size="14" class="text-teal" />
            <span>Zero holding accounts: Money lands in your Till</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero-stage {
  position: relative;
  padding: 60px 20px 80px;
  overflow: hidden;
}

.ambient-glow {
  position: absolute;
  top: 15%;
  left: 50%;
  transform: translateX(-50%);
  width: 700px;
  height: 450px;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.09) 0%, rgba(217, 30, 78, 0.03) 50%, transparent 80%);
  filter: blur(80px);
  pointer-events: none;
  z-index: 0;
}

.hero-container {
  max-width: 1200px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 48px;
}

/* Hero Copy */
.hero-copy-block {
  text-align: center;
  max-width: 860px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.kenya-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #FBBF24;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 99px;
}

.hero-title {
  font-family: var(--font-display);
  font-size: clamp(32px, 4.5vw, 54px);
  font-weight: 800;
  line-height: 1.12;
  color: #F3F6F4;
  letter-spacing: -0.03em;
}

.hero-subtitle {
  font-size: clamp(15px, 1.8vw, 17px);
  color: #94A3B8;
  line-height: 1.6;
  max-width: 680px;
}

.hero-subtitle strong {
  color: #F3F6F4;
}

.hero-cta-group {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 6px;
}

.btn-primary-hero {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--brand-primary, #D91E4E);
  color: #FFFFFF;
  text-decoration: none;
  font-size: 14px;
  font-weight: 700;
  padding: 13px 26px;
  border-radius: 10px;
  box-shadow: 0 8px 24px -4px rgba(217, 30, 78, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition: transform 120ms ease;
}
.btn-primary-hero:hover { transform: translateY(-2px); }

.btn-secondary-hero {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #0D1412;
  border: 1px solid #1F2E29;
  color: #F3F6F4;
  text-decoration: none;
  font-size: 14px;
  font-weight: 700;
  padding: 13px 22px;
  border-radius: 10px;
  transition: border-color 120ms ease;
}
.btn-secondary-hero:hover { border-color: #34D399; }

.trust-row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  justify-content: center;
  font-size: 12px;
  color: #869E96;
  font-weight: 600;
  margin-top: 8px;
}

.trust-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* =========================================================================
   MONOLITHIC HARDWARE CANVAS (Pure CSS UI-As-Art)
   ========================================================================= */
.monolith-canvas {
  width: 100%;
  max-width: 1060px;
  background: #090E0C;
  border: 1px solid #1A2622;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
}

.canvas-window-bar {
  background: #060908;
  border-bottom: 1px solid #15201C;
  padding: 12px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.window-controls { display: flex; gap: 6px; }
.window-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.dot-red { background: #EF4444; }
.dot-yellow { background: #F59E0B; }
.dot-green { background: #10B981; }

.window-address-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #0E1614;
  border: 1px solid #1D2C27;
  padding: 3px 14px;
  border-radius: 99px;
  font-size: 11px;
  color: #869E96;
}

.till-live-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #34D399;
}

.live-pulse {
  width: 7px;
  height: 7px;
  background: #10B981;
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.3); }
}

/* Dual Viewports Split */
.monolith-viewports-split {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  background: #090E0C;
}

@media (max-width: 860px) {
  .monolith-viewports-split {
    grid-template-columns: 1fr;
  }
}

.viewport-customer,
.viewport-merchant {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.viewport-customer {
  border-right: 1px solid #15201C;
  background: color-mix(in srgb, #0D1613 60%, transparent);
}

@media (max-width: 860px) {
  .viewport-customer { border-right: none; border-bottom: 1px solid #15201C; }
}

.viewport-badge {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: #869E96;
  letter-spacing: 0.05em;
}

.url-hint {
  font-size: 10px;
  color: #64748B;
  text-transform: none;
}

/* Sub-UI Frame: Customer Storefront */
.customer-app-frame,
.merchant-app-frame {
  background: #060908;
  border: 1px solid #1A2622;
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.store-mini-hero {
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #141E1B;
  padding-bottom: 10px;
}

.store-avatar {
  width: 32px;
  height: 32px;
  background: var(--brand-primary, #D91E4E);
  color: #FFFFFF;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 11px;
}

.store-title-block { display: flex; flex-direction: column; }
.store-title-block strong { font-size: 13px; color: #F3F6F4; }
.store-title-block span { font-size: 10px; color: #869E96; }

.product-item-card {
  background: #0E1614;
  border: 1px solid #1F2E29;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.product-info-col { display: flex; flex-direction: column; gap: 2px; }
.product-tag { font-size: 9px; text-transform: uppercase; color: #64748B; font-weight: 700; }
.product-info-col strong { font-size: 12px; color: #F3F6F4; }
.product-price { font-size: 12px; font-weight: 700; color: #34D399; }

.badge-in-stock {
  font-size: 9px;
  font-weight: 700;
  background: rgba(16, 185, 129, 0.15);
  color: #34D399;
  padding: 2px 6px;
  border-radius: 4px;
}

.gps-checkout-block {
  background: #0E1614;
  border: 1px dashed #1F2E29;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
}

.gps-loc-row { display: flex; align-items: center; gap: 6px; color: #E2E8F0; }
.fee-calculated-row { display: flex; justify-content: space-between; font-size: 11px; }

.stk-prompt-banner {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  color: #FBBF24;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Sub-UI Frame: Merchant Kaunta OS */
.merchant-kpi-block {
  background: #0E1614;
  border: 1px solid #1F2E29;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.kpi-micro-label { font-size: 9px; text-transform: uppercase; color: #869E96; font-weight: 700; letter-spacing: 0.05em; }
.kpi-main-val { font-size: 22px; font-weight: 800; line-height: 1.1; }

.kpi-sub-row {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #64748B;
  margin-top: 4px;
  border-top: 1px solid #15201C;
  padding-top: 4px;
}

.live-dispatch-card {
  background: #0E1614;
  border: 1px solid #1F2E29;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dispatch-top { display: flex; justify-content: space-between; align-items: center; }
.order-id { font-size: 11px; font-weight: 700; color: #F3F6F4; }
.pill-paid { font-size: 9px; font-weight: 800; background: #10B981; color: #000000; padding: 1px 6px; border-radius: 4px; }

.dispatch-details { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #94A3B8; }
.security-code-tag { display: flex; align-items: center; gap: 4px; font-size: 10px; }

.madeni-chaser-card {
  background: #0E1614;
  border: 1px solid #1F2E29;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chaser-info { display: flex; flex-direction: column; font-size: 11px; }
.chaser-info strong { color: #F3F6F4; }

.wa-quick-link {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid #10B981;
  color: #34D399;
  font-size: 10px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

/* Bottom Feature Ribbon */
.monolith-bottom-ribbon {
  background: #060908;
  border-top: 1px solid #15201C;
  padding: 12px 20px;
  display: flex;
  justify-content: space-around;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 11px;
  color: #94A3B8;
  font-weight: 600;
}

.ribbon-item { display: flex; align-items: center; gap: 6px; }

.text-teal { color: #34D399; }
.text-amber { color: #F59E0B; }
.text-clay { color: #FB7185; }
.text-brand { color: var(--brand-primary, #D91E4E); }
</style>