<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/landing/CapabilitySection.vue
// Exactly 3 clean capability cards without bento clutter.
// =============================================================================

import { MapPin } from 'lucide-vue-next';
</script>

<template>
  <section id="capabilities" class="capabilities-section">
    <div class="section-container">
      <div class="cards-grid">
        <!-- 1. Sell Online -->
        <div class="capability-card">
          <div class="card-text">
            <h2 class="card-title">Sell online.</h2>
            <p class="card-desc">
              Create a branded storefront for your products and share it anywhere your customers already shop.
            </p>
          </div>
          <!-- Clean Storefront Visual -->
          <div class="card-visual">
            <div class="mini-store-bar">
              <span class="font-mono">soko.app/store/joy</span>
            </div>
            <div class="mini-store-body">
              <div class="item-line">
                <span>Safari Boots</span>
                <strong class="font-mono">KES 3,200</strong>
              </div>
              <div class="item-line">
                <span>Leather Handbag</span>
                <strong class="font-mono">KES 1,800</strong>
              </div>
              <div class="item-delivery">
                <MapPin :size="12" /> Delivery to Kilimani · KES 128
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Get Paid -->
        <div class="capability-card">
          <div class="card-text">
            <h2 class="card-title">Get paid.</h2>
            <p class="card-desc">
              Connect your M-Pesa payment flow and keep your business payments connected to your own Till.
            </p>
          </div>
          <!-- Clean Payment Visual -->
          <div class="card-visual">
            <div class="mini-pay-box">
              <div class="pay-top">
                <span>M-Pesa STK Push</span>
                <span class="badge-status-paid">Paid</span>
              </div>
              <p class="pay-amount font-mono">KES 3,200.00</p>
              <p class="pay-till font-mono">Deposited directly to Till 174379</p>
            </div>
          </div>
        </div>

        <!-- 3. Know Your Business -->
        <div class="capability-card">
          <div class="card-text">
            <h2 class="card-title">Know your business.</h2>
            <p class="card-desc">
              Track sales, stock, customers and outstanding balances without juggling separate books and spreadsheets.
            </p>
          </div>
          <!-- Clean Ledger Visual -->
          <div class="card-visual">
            <div class="mini-ledger-box">
              <div class="ledger-row">
                <div>
                  <strong>Grace Njeri</strong>
                  <span class="ledger-meta">12 days overdue</span>
                </div>
                <strong class="font-mono text-debt">KES 3,500</strong>
              </div>
              <div class="ledger-action">
                <span>Send WhatsApp statement</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.capabilities-section {
  max-width: 1140px;
  margin: 0 auto;
  padding: 120px 24px 60px;
}

@media (max-width: 768px) {
  .capabilities-section { padding: 80px 24px 40px; }
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
}

@media (max-width: 860px) {
  .cards-grid { grid-template-columns: 1fr; }
}

.capability-card {
  background: var(--landing-surface, #FFFFFF);
  border: 1px solid var(--landing-border, #E8E4E0);
  border-radius: 16px;
  padding: 32px 28px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03), 0 8px 30px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 28px;
}

.card-text {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-title {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: 26px;
  font-weight: 600;
  color: var(--landing-text, #171514);
}

.card-desc {
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 15px;
  color: var(--landing-muted, #6F6A67);
  line-height: 1.55;
}

.card-visual {
  background: var(--landing-bg, #FAFAF8);
  border: 1px solid var(--landing-border, #E8E4E0);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Visual 1: Store */
.mini-store-bar {
  font-size: 11px;
  color: var(--landing-muted, #6F6A67);
  border-bottom: 1px solid var(--landing-border, #E8E4E0);
  padding-bottom: 6px;
}
.mini-store-body { display: flex; flex-direction: column; gap: 6px; font-size: 12px; }
.item-line { display: flex; justify-content: space-between; color: var(--landing-text, #171514); }
.item-delivery { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--landing-muted, #6F6A67); margin-top: 4px; }

/* Visual 2: Pay */
.mini-pay-box { display: flex; flex-direction: column; gap: 6px; }
.pay-top { display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 500; }
.badge-status-paid {
  font-size: 11px;
  font-weight: 600;
  color: var(--landing-success, #168A52);
  background: rgba(22, 138, 82, 0.08);
  padding: 1px 7px;
  border-radius: 4px;
}
.pay-amount { font-size: 20px; font-weight: 600; color: var(--landing-text, #171514); }
.pay-till { font-size: 11px; color: var(--landing-muted, #6F6A67); }

/* Visual 3: Ledger */
.mini-ledger-box { display: flex; flex-direction: column; gap: 10px; }
.ledger-row { display: flex; justify-content: space-between; font-size: 12px; }
.ledger-row strong { color: var(--landing-text, #171514); }
.ledger-meta { display: block; font-size: 10px; color: var(--landing-muted, #6F6A67); }
.text-debt { color: var(--landing-brand, #D91E4E); }
.ledger-action {
  font-size: 11px;
  font-weight: 600;
  color: var(--landing-brand, #D91E4E);
  background: rgba(217, 30, 78, 0.06);
  padding: 6px 10px;
  border-radius: 6px;
  text-align: center;
}
</style>