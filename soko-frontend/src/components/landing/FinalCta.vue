<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/landing/FinalCta.vue
// Clean closing conversion CTA with single high-emphasis action.
// =============================================================================

import { ArrowRight } from 'lucide-vue-next';
</script>

<template>
  <section class="final-cta-section">
    <div class="final-cta-card">
      <h2 class="final-cta-heading">
        Ready to run your business differently?
      </h2>
      <p class="final-cta-subheading">
        Start selling, tracking and getting paid with Soko.
      </p>
      <RouterLink :to="{ name: 'register' }" class="btn-final-cta">
        Start for free <ArrowRight :size="16" />
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.final-cta-section {
  max-width: 1140px;
  margin: 0 auto;
  padding: 40px 24px 100px;
}

.final-cta-card {
  background: var(--landing-surface, #FFFFFF);
  border: 1px solid var(--landing-border, #E8E4E0);
  border-radius: 20px;
  padding: 64px 32px;
  text-align: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03), 0 8px 30px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

@media (max-width: 640px) {
  .final-cta-card { padding: 48px 20px; }
}

.final-cta-heading {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: clamp(28px, 3.5vw, 42px);
  font-weight: 600;
  color: var(--landing-text, #171514);
  letter-spacing: -0.02em;
}

.final-cta-subheading {
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 17px;
  color: var(--landing-muted, #6F6A67);
  max-width: 480px;
}

.btn-final-cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--landing-brand, #D91E4E);
  color: #FFFFFF;
  text-decoration: none;
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 16px;
  font-weight: 600;
  padding: 14px 32px;
  border-radius: 10px;
  margin-top: 8px;
  transition: opacity 150ms ease, transform 150ms ease;
  box-shadow: 0 4px 14px rgba(217, 30, 78, 0.25);
}

.btn-final-cta:hover {
  opacity: 0.94;
  transform: translateY(-1px);
}
	</style>