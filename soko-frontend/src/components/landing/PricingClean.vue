<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/landing/PricingClean.vue
// Clean white pricing cards matching Soko's supported plan structure.
// =============================================================================

import { ref } from 'vue';

const isAnnual = ref(false);
</script>

<template>
  <section id="pricing" class="pricing-section">
    <div class="pricing-container">
      <div class="pricing-header">
        <h2 class="pricing-heading">Simple pricing.</h2>
        <p class="pricing-subheading">Choose the plan that fits your business stage.</p>

        <!-- Toggle -->
        <div class="billing-switcher">
          <button
            type="button"
            class="switch-btn"
            :class="{ active: !isAnnual }"
            @click="isAnnual = false"
          >
            Monthly
          </button>
          <button
            type="button"
            class="switch-btn"
            :class="{ active: isAnnual }"
            @click="isAnnual = true"
          >
            Annual (2 months free)
          </button>
        </div>
      </div>

      <div class="pricing-grid">
        <!-- Free -->
        <div class="price-card">
          <div class="price-card-header">
            <h3 class="tier-title">Free</h3>
            <p class="tier-desc">For testing your setup.</p>
          </div>
          <div class="price-amount">
            <span class="amount font-mono">KES 0</span>
            <span class="period">forever</span>
          </div>
          <ul class="features-list">
            <li>Up to 5 products</li>
            <li>Up to 5 debtors</li>
            <li>Online storefront link</li>
            <li>Manual record keeping</li>
          </ul>
          <RouterLink :to="{ name: 'register', query: { plan: 'free' } }" class="btn-price btn-price--secondary">
            Get started
          </RouterLink>
        </div>

        <!-- Pro (Highlighted) -->
        <div class="price-card price-card--featured">
          <div class="recommended-badge">Recommended</div>
          <div class="price-card-header">
            <h3 class="tier-title">Pro</h3>
            <p class="tier-desc">For active shops and boutiques.</p>
          </div>
          <div class="price-amount">
            <span class="amount font-mono text-brand">
              {{ isAnnual ? 'KES 14,990' : 'KES 1,499' }}
            </span>
            <span class="period">{{ isAnnual ? '/ year' : '/ month' }}</span>
          </div>
          <ul class="features-list">
            <li><strong>Unlimited</strong> products &amp; customers</li>
            <li><strong>Live M-Pesa STK Push</strong> to your Till</li>
            <li><strong>Boda dispatch</strong> with 4-digit codes</li>
            <li><strong>WhatsApp debt statements</strong></li>
            <li>True gross margin P&amp;L</li>
          </ul>
          <RouterLink :to="{ name: 'register', query: { plan: 'pro' } }" class="btn-price btn-price--primary">
            Start free trial
          </RouterLink>
        </div>

        <!-- Lifetime -->
        <div class="price-card">
          <div class="price-card-header">
            <h3 class="tier-title">Lifetime</h3>
            <p class="tier-desc">Pay once, own it forever.</p>
          </div>
          <div class="price-amount">
            <span class="amount font-mono">KES 29,999</span>
            <span class="period">one-time</span>
          </div>
          <ul class="features-list">
            <li>All Pro features included</li>
            <li>Zero renewal fees</li>
            <li>2 staff logins</li>
            <li>All future updates</li>
          </ul>
          <RouterLink :to="{ name: 'register', query: { plan: 'lifetime' } }" class="btn-price btn-price--secondary">
            Get lifetime
          </RouterLink>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pricing-section {
  max-width: 1140px;
  margin: 0 auto;
  padding: 80px 24px;
}

.pricing-container {
  display: flex;
  flex-direction: column;
  gap: 48px;
}

.pricing-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.pricing-heading {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: clamp(32px, 4vw, 44px);
  font-weight: 600;
  color: var(--landing-text, #171514);
}

.pricing-subheading {
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 16px;
  color: var(--landing-muted, #6F6A67);
}

.billing-switcher {
  display: flex;
  background: var(--landing-surface, #FFFFFF);
  border: 1px solid var(--landing-border, #E8E4E0);
  border-radius: 99px;
  padding: 3px;
  margin-top: 8px;
}

.switch-btn {
  background: transparent;
  border: none;
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 12px;
  font-weight: 600;
  color: var(--landing-muted, #6F6A67);
  padding: 6px 14px;
  border-radius: 99px;
  cursor: pointer;
  transition: all 150ms ease;
}

.switch-btn.active {
  background: var(--landing-text, #171514);
  color: #FFFFFF;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  align-items: stretch;
}

@media (max-width: 860px) {
  .pricing-grid { grid-template-columns: 1fr; }
}

.price-card {
  background: var(--landing-surface, #FFFFFF);
  border: 1px solid var(--landing-border, #E8E4E0);
  border-radius: 16px;
  padding: 36px 28px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03), 0 8px 30px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: relative;
}

.price-card--featured {
  border: 2px solid var(--landing-brand, #D91E4E);
}

.recommended-badge {
  position: absolute;
  top: -11px;
  right: 24px;
  background: var(--landing-brand, #D91E4E);
  color: #FFFFFF;
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 99px;
}

.price-card-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tier-title {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: 20px;
  font-weight: 600;
  color: var(--landing-text, #171514);
}

.tier-desc {
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 13px;
  color: var(--landing-muted, #6F6A67);
}

.price-amount {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.amount {
  font-size: 28px;
  font-weight: 600;
  color: var(--landing-text, #171514);
}

.text-brand { color: var(--landing-brand, #D91E4E); }

.period {
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 13px;
  color: var(--landing-muted, #6F6A67);
}

.features-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 13px;
  color: var(--landing-text, #171514);
  flex: 1;
}

.features-list li::before {
  content: '✓';
  margin-right: 8px;
  color: var(--landing-success, #168A52);
  font-weight: 600;
}

.btn-price {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border-radius: 8px;
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: all 150ms ease;
  margin-top: auto;
}

.btn-price--primary {
  background: var(--landing-brand, #D91E4E);
  color: #FFFFFF;
}
.btn-price--primary:hover { opacity: 0.92; }

.btn-price--secondary {
  background: var(--landing-bg, #FAFAF8);
  border: 1px solid var(--landing-border, #E8E4E0);
  color: var(--landing-text, #171514);
}
.btn-price--secondary:hover {
  background: #F4F2EE;
}
</style>