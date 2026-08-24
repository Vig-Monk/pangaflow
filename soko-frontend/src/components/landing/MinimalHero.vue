<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/landing/MinimalHero.vue
// Hero section with single promise, dual CTAs, and a clean monolithic product visual.
// =============================================================================

import { ArrowRight } from 'lucide-vue-next';

function scrollToCapabilities(): void {
  const el = document.getElementById('capabilities');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}
</script>

<template>
  <section id="hero" class="hero-section">
    <div class="hero-content">
      <!-- Eyebrow -->
      <span class="hero-eyebrow">Built for Kenyan businesses</span>

      <!-- Headline -->
      <h1 class="hero-headline">Run your business in one place.</h1>

      <!-- Subheadline -->
      <p class="hero-subheadline">
        Soko gives Kenyan businesses a simple way to sell online, manage stock, track customers and get paid through M-Pesa.
      </p>

      <!-- CTAs -->
      <div class="hero-cta-group">
        <RouterLink :to="{ name: 'register' }" class="btn-primary-hero">
          Start for free <ArrowRight :size="16" />
        </RouterLink>
        <button type="button" class="btn-secondary-hero" @click="scrollToCapabilities">
          See how it works
        </button>
      </div>

      <!-- Trust note -->
      <p class="hero-trust-note">
        No credit card required · Built for Kenyan businesses
      </p>
    </div>

    <!-- Monolithic Product Showcase Visual -->
    <div class="hero-mockup-frame">
      <div class="mockup-header">
        <div class="mockup-brand">
          <span class="mockup-title">Soko</span>
          <span class="mockup-badge">Live Till: 174379</span>
        </div>
        <div class="mockup-time font-mono">Today, 2:45 PM</div>
      </div>

      <!-- Core Metrics Row -->
      <div class="mockup-stats-grid">
        <div class="stat-box stat-box--main">
          <span class="stat-label">Today's sales</span>
          <span class="stat-value font-mono">KES 48,250</span>
          <span class="stat-sub">100% in your Till</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Orders</span>
          <span class="stat-value font-mono">18</span>
          <span class="stat-sub">4 to pack</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Customers</span>
          <span class="stat-value font-mono">126</span>
          <span class="stat-sub">+3 this week</span>
        </div>
        <div class="stat-box stat-box--debt">
          <span class="stat-label">Outstanding debt</span>
          <span class="stat-value font-mono">KES 12,400</span>
          <span class="stat-sub">5 debtors</span>
        </div>
      </div>

      <!-- Recent Sales List -->
      <div class="mockup-recent-block">
        <div class="recent-header">
          <span>Recent activity</span>
          <span class="font-mono text-muted">Auto-synced</span>
        </div>

        <div class="recent-row">
          <div class="row-left">
            <span class="status-dot status-dot--paid"></span>
            <div>
              <strong>Safari Boots (Leather)</strong>
              <span class="row-meta">Grace Njeri · Online Storefront</span>
            </div>
          </div>
          <div class="row-right">
            <span class="row-amount font-mono">KES 3,200</span>
            <span class="badge-paid">Paid</span>
          </div>
        </div>

        <div class="recent-row">
          <div class="row-left">
            <span class="status-dot status-dot--paid"></span>
            <div>
              <strong>Casual Linen Shirt</strong>
              <span class="row-meta">David Mwangi · Counter POS</span>
            </div>
          </div>
          <div class="row-right">
            <span class="row-amount font-mono">KES 1,800</span>
            <span class="badge-paid">Paid</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero-section {
  max-width: 1140px;
  margin: 0 auto;
  padding: 90px 24px 70px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 56px;
}

.hero-content {
  max-width: 780px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.hero-eyebrow {
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--landing-brand, #D91E4E);
}

.hero-headline {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: clamp(40px, 5.5vw, 68px);
  font-weight: 600;
  line-height: 1.08;
  color: var(--landing-text, #171514);
  letter-spacing: -0.03em;
}

.hero-subheadline {
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: clamp(17px, 2vw, 19px);
  color: var(--landing-muted, #6F6A67);
  line-height: 1.55;
  max-width: 660px;
}

.hero-cta-group {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 8px;
}

.btn-primary-hero {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--landing-brand, #D91E4E);
  color: #FFFFFF;
  text-decoration: none;
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 16px;
  font-weight: 600;
  padding: 14px 28px;
  border-radius: 10px;
  transition: opacity 150ms ease, transform 150ms ease;
  box-shadow: 0 4px 14px rgba(217, 30, 78, 0.25);
}
.btn-primary-hero:hover {
  opacity: 0.94;
  transform: translateY(-1px);
}

.btn-secondary-hero {
  background: var(--landing-surface, #FFFFFF);
  border: 1px solid var(--landing-border, #E8E4E0);
  color: var(--landing-text, #171514);
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 16px;
  font-weight: 600;
  padding: 14px 24px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}
.btn-secondary-hero:hover {
  background: #F4F2EE;
  border-color: #D6D0CA;
}

.hero-trust-note {
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 13px;
  color: var(--landing-muted, #6F6A67);
  margin-top: 4px;
}

/* Monolithic Dashboard Mockup */
.hero-mockup-frame {
  width: 100%;
  max-width: 960px;
  background: var(--landing-surface, #FFFFFF);
  border: 1px solid var(--landing-border, #E8E4E0);
  border-radius: 18px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03), 0 16px 48px rgba(0, 0, 0, 0.06);
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  text-align: left;
}

@media (max-width: 640px) {
  .hero-mockup-frame {
    padding: 20px 16px;
    gap: 18px;
  }
}

.mockup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--landing-border, #E8E4E0);
  padding-bottom: 16px;
}

.mockup-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mockup-title {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: 18px;
  font-weight: 600;
  color: var(--landing-text, #171514);
}

.mockup-badge {
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 11px;
  font-weight: 600;
  color: var(--landing-success, #168A52);
  background: rgba(22, 138, 82, 0.08);
  padding: 2px 8px;
  border-radius: 99px;
}

.mockup-time {
  font-size: 12px;
  color: var(--landing-muted, #6F6A67);
}

.mockup-stats-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1.2fr;
  gap: 16px;
}

@media (max-width: 768px) {
  .mockup-stats-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.stat-box {
  background: var(--landing-bg, #FAFAF8);
  border: 1px solid var(--landing-border, #E8E4E0);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 12px;
  color: var(--landing-muted, #6F6A67);
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--landing-text, #171514);
}

.stat-box--main .stat-value {
  color: var(--landing-text, #171514);
}

.stat-box--debt .stat-value {
  color: var(--landing-brand, #D91E4E);
}

.stat-sub {
  font-size: 11px;
  color: var(--landing-muted, #6F6A67);
}

.mockup-recent-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.recent-header {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--landing-muted, #6F6A67);
}

.recent-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: var(--landing-bg, #FAFAF8);
  border-radius: 8px;
  font-size: 13px;
}

.row-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot--paid {
  background: var(--landing-success, #168A52);
}

.row-meta {
  display: block;
  font-size: 11px;
  color: var(--landing-muted, #6F6A67);
}

.row-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.row-amount {
  font-weight: 600;
  color: var(--landing-text, #171514);
}

.badge-paid {
  font-size: 11px;
  font-weight: 600;
  color: var(--landing-success, #168A52);
  background: rgba(22, 138, 82, 0.08);
  padding: 1px 7px;
  border-radius: 4px;
}
</style>