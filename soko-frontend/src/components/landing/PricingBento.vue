<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/landing/PricingBento.vue
// Commercial pricing table with Free Sandbox, Pro (KES 1,499), Business & Lifetime.
// =============================================================================

import { ref } from 'vue';
import { Check, Crown, Sparkles, ArrowRight } from 'lucide-vue-next';

const isAnnual = ref(false);
</script>

<template>
  <section id="pricing" class="pricing-section">
    <div class="section-title-block" data-reveal="zoom">
      <span class="section-tag">Transparent Investment</span>
      <h2 class="section-heading">Simple, Transparent Pricing</h2>
      <p class="section-desc">No commission cuts on sales. No hidden transaction fees.</p>

      <!-- Billing Period Toggle -->
      <div class="billing-toggle">
        <button
          type="button"
          class="toggle-opt"
          :class="{ active: !isAnnual }"
          @click="isAnnual = false"
        >
          Monthly Billing
        </button>
        <button
          type="button"
          class="toggle-opt"
          :class="{ active: isAnnual }"
          @click="isAnnual = true"
        >
          Annual (2 Months Free)
        </button>
      </div>
    </div>

    <div class="pricing-grid">
      <!-- 1. Free Sandbox -->
      <div class="pricing-card card" data-reveal="left">
        <div class="card-header">
          <h3 class="tier-name">Free Sandbox</h3>
          <p class="tier-desc">Test your store and connect your Till.</p>
        </div>

        <div class="price-stack">
          <span class="price-val font-mono">KES 0</span>
          <span class="price-period">Forever</span>
        </div>

        <ul class="features-list">
          <li><Check :size="14" class="text-teal" /> Up to <strong>5 products</strong> in catalog</li>
          <li><Check :size="14" class="text-teal" /> Up to <strong>5 active debtors</strong></li>
          <li><Check :size="14" class="text-teal" /> Storefront link (kauntaos.co.ke/store/...)</li>
          <li><Check :size="14" class="text-teal" /> Manual M-Pesa record keeping</li>
        </ul>

        <RouterLink :to="{ name: 'register', query: { plan: 'free' } }" class="btn-tier btn-tier--secondary">
          Start Free Sandbox
        </RouterLink>
      </div>

      <!-- 2. Pro Tier (Featured Workhorse) -->
      <div class="pricing-card pricing-card--featured card" data-reveal="zoom">
        <div class="featured-ribbon">
          <Sparkles :size="12" /> Most Popular
        </div>

        <div class="card-header">
          <h3 class="tier-name">Pro Merchant</h3>
          <p class="tier-desc">The complete OS for solo boutiques &amp; shopkeepers.</p>
        </div>

        <div class="price-stack">
          <span class="price-val font-mono text-brand">
            {{ isAnnual ? 'KES 14,990' : 'KES 1,499' }}
          </span>
          <span class="price-period">{{ isAnnual ? '/ year' : '/ month' }}</span>
        </div>

        <ul class="features-list">
          <li><Check :size="14" class="text-teal" /> <strong>Unlimited</strong> products &amp; customers</li>
          <li><Check :size="14" class="text-teal" /> <strong>Live M-Pesa STK Push</strong> to your Till</li>
          <li><Check :size="14" class="text-teal" /> <strong>Boda Dispatch</strong> &amp; 4-digit handover codes</li>
          <li><Check :size="14" class="text-teal" /> <strong>WhatsApp Madeni</strong> statement chaser</li>
          <li><Check :size="14" class="text-teal" /> True Gross Margin &amp; COGS P&amp;L</li>
          <li><Check :size="14" class="text-teal" /> 7:30 AM Morning Standup Cockpit</li>
        </ul>

        <RouterLink :to="{ name: 'register', query: { plan: 'pro' } }" class="btn-tier btn-tier--primary">
          Start 14-Day Pro Trial <ArrowRight :size="14" />
        </RouterLink>
      </div>

      <!-- 3. Business Tier -->
      <div class="pricing-card card" data-reveal="right">
        <div class="card-header">
          <h3 class="tier-name">Business Scale</h3>
          <p class="tier-desc">For multi-staff shops, ghost kitchens &amp; wholesalers.</p>
        </div>

        <div class="price-stack">
          <span class="price-val font-mono">
            {{ isAnnual ? 'KES 39,990' : 'KES 3,999' }}
          </span>
          <span class="price-period">{{ isAnnual ? '/ year' : '/ month' }}</span>
        </div>

        <ul class="features-list">
          <li><Check :size="14" class="text-teal" /> Everything in Pro</li>
          <li><Check :size="14" class="text-teal" /> Up to <strong>5 Staff / Rider Logins</strong></li>
          <li><Check :size="14" class="text-teal" /> <strong>2km Proximity Order Clustering</strong></li>
          <li><Check :size="14" class="text-teal" /> Exportable CSV accounting reports</li>
          <li><Check :size="14" class="text-teal" /> Priority 24/7 WhatsApp VIP Support</li>
        </ul>

        <RouterLink :to="{ name: 'register', query: { plan: 'business' } }" class="btn-tier btn-tier--secondary">
          Get Business Plan
        </RouterLink>
      </div>

      <!-- 4. Lifetime License -->
      <div class="pricing-card pricing-card--gold card" data-reveal="right" data-reveal-delay="100">
        <div class="gold-ribbon"><Crown :size="12" /> Founder License</div>

        <div class="card-header">
          <h3 class="tier-name">Perpetual Lifetime</h3>
          <p class="tier-desc">Zero recurring monthly renewal fees forever.</p>
        </div>

        <div class="price-stack">
          <span class="price-val font-mono text-gold">KES 29,999</span>
          <span class="price-period">One-time payment</span>
        </div>

        <ul class="features-list">
          <li><Check :size="14" class="text-gold" /> Permanent unlimited access</li>
          <li><Check :size="14" class="text-gold" /> Zero monthly subscription fees</li>
          <li><Check :size="14" class="text-gold" /> All future platform feature updates</li>
          <li><Check :size="14" class="text-gold" /> 2 Staff member accounts</li>
          <li><Check :size="14" class="text-gold" /> Direct founder WhatsApp support</li>
        </ul>

        <RouterLink :to="{ name: 'register', query: { plan: 'lifetime' } }" class="btn-tier btn-tier--gold">
          Claim Lifetime License
        </RouterLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pricing-section {
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
  font-size: clamp(24px, 2.5vw, 32px);
  font-weight: 800;
  color: #F3F6F4;
}

.section-desc {
  font-size: 13px;
  color: #94A3B8;
}

.billing-toggle {
  display: flex;
  background: #090D0C;
  border: 1px solid #1F2E29;
  border-radius: 99px;
  padding: 3px;
  margin-top: 8px;
}

.toggle-opt {
  background: transparent;
  border: none;
  font-size: 11px;
  font-weight: 700;
  color: #94A3B8;
  padding: 6px 14px;
  border-radius: 99px;
  cursor: pointer;
  transition: all 120ms ease;
}

.toggle-opt.active {
  background: var(--brand-primary, #D91E4E);
  color: #FFFFFF;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 1080px) {
  .pricing-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .pricing-grid {
    grid-template-columns: 1fr;
  }
}

.pricing-card {
  background: var(--surface-panel, #111816);
  border: 1px solid var(--border-color, #1F2E29);
  border-radius: var(--radius-lg, 16px);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
}

.pricing-card--featured {
  border-color: var(--brand-primary, #D91E4E);
  background: color-mix(in srgb, var(--brand-primary, #D91E4E) 5%, var(--surface-panel, #111816));
  box-shadow: 0 16px 36px rgba(217, 30, 78, 0.15);
}

.pricing-card--gold {
  border-color: #F59E0B;
  background: color-mix(in srgb, #F59E0B 5%, var(--surface-panel, #111816));
}

.featured-ribbon {
  position: absolute;
  top: -10px;
  right: 18px;
  background: var(--brand-primary, #D91E4E);
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 99px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.gold-ribbon {
  position: absolute;
  top: -10px;
  right: 18px;
  background: #F59E0B;
  color: #000000;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 99px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tier-name {
  font-size: 16px;
  font-weight: 700;
  color: #F3F6F4;
}

.tier-desc {
  font-size: 11px;
  color: #94A3B8;
}

.price-stack {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.price-val {
  font-size: 24px;
  font-weight: 800;
  color: #F3F6F4;
}

.price-period {
  font-size: 11px;
  color: #94A3B8;
}

.features-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.features-list li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  color: #E2E8F0;
  line-height: 1.4;
}

.features-list li strong {
  color: #FFFFFF;
}

.btn-tier {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  margin-top: auto;
  transition: transform 120ms ease;
}

.btn-tier--primary {
  background: var(--brand-primary, #D91E4E);
  color: #FFFFFF;
}

.btn-tier--primary:hover {
  transform: translateY(-1px);
}

.btn-tier--secondary {
  background: #090D0C;
  border: 1px solid #1F2E29;
  color: #F3F6F4;
}

.btn-tier--secondary:hover {
  border-color: #F3F6F4;
  transform: translateY(-1px);
}

.btn-tier--gold {
  background: #F59E0B;
  color: #000000;
}

.btn-tier--gold:hover {
  transform: translateY(-1px);
}

.text-brand {
  color: var(--brand-primary, #D91E4E);
}

.text-gold {
  color: #F59E0B;
}

.text-teal {
  color: #34D399;
}
</style>