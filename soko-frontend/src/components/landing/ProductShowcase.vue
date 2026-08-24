<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/landing/ProductShowcase.vue
// Clean, tangible overview of Soko's operational workspace.
// =============================================================================

import { CheckCircle2, ShieldCheck, Zap } from 'lucide-vue-next';
</script>

<template>
  <section id="showcase" class="showcase-section">
    <div class="showcase-container">
      <div class="showcase-header">
        <h2 class="showcase-heading">
          Everything your business needs.<br />Nothing you don't.
        </h2>
        <p class="showcase-subheading">
          Soko brings your daily operations into one simple workspace.
        </p>
      </div>

      <div class="showcase-card">
        <div class="showcase-pillars-row">
          <div class="pillar-point">
            <CheckCircle2 :size="18" class="text-success" />
            <div>
              <strong>Sales &amp; POS</strong>
              <p>Record cash, M-Pesa, and credit sales with running balances.</p>
            </div>
          </div>

          <div class="pillar-point">
            <Zap :size="18" class="text-brand" />
            <div>
              <strong>Instant Storefront</strong>
              <p>Publish your catalog and calculate delivery fees by distance.</p>
            </div>
          </div>

          <div class="pillar-point">
            <ShieldCheck :size="18" class="text-success" />
            <div>
              <strong>Direct to Till</strong>
              <p>M-Pesa funds land 100% in your business account.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.showcase-section {
  max-width: 1140px;
  margin: 0 auto;
  padding: 80px 24px;
}

.showcase-container {
  display: flex;
  flex-direction: column;
  gap: 48px;
}

.showcase-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.showcase-heading {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: clamp(32px, 4vw, 48px);
  font-weight: 600;
  line-height: 1.15;
  color: var(--landing-text, #171514);
  letter-spacing: -0.02em;
}

.showcase-subheading {
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 17px;
  color: var(--landing-muted, #6F6A67);
  max-width: 540px;
}

.showcase-card {
  background: var(--landing-surface, #FFFFFF);
  border: 1px solid var(--landing-border, #E8E4E0);
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03), 0 8px 30px rgba(0, 0, 0, 0.04);
}

.showcase-pillars-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
}

@media (max-width: 768px) {
  .showcase-pillars-row {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}

.pillar-point {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.pillar-point strong {
  display: block;
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 16px;
  font-weight: 600;
  color: var(--landing-text, #171514);
  margin-bottom: 4px;
}

.pillar-point p {
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 14px;
  color: var(--landing-muted, #6F6A67);
  line-height: 1.5;
}

.text-success { color: var(--landing-success, #168A52); flex-shrink: 0; margin-top: 2px; }
.text-brand { color: var(--landing-brand, #D91E4E); flex-shrink: 0; margin-top: 2px; }
</style>