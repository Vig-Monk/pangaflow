<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/LandingView.vue
// Soko Minimal Professional Commerce Landing Page.
// Scoped strictly to the public landing page with zero global style leakage.
// =============================================================================

import { onMounted } from 'vue';
import LandingNav from '@/components/landing/LandingNav.vue';
import MinimalHero from '@/components/landing/MinimalHero.vue';
import TrustStrip from '@/components/landing/TrustStrip.vue';
import CapabilitySection from '@/components/landing/CapabilitySection.vue';
import ProductShowcase from '@/components/landing/ProductShowcase.vue';
import PricingClean from '@/components/landing/PricingClean.vue';
import FaqSection from '@/components/landing/FaqSection.vue';
import FinalCta from '@/components/landing/FinalCta.vue';
import LandingFooter from '@/components/landing/LandingFooter.vue';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3000/api/v1';

onMounted(() => {
  // Silent background wake-up ping for Render cold-start mitigation
  fetch(`${API_BASE}/health`, { method: 'GET' }).catch(() => {});
});
</script>

<template>
  <div class="landing-page-root">
    <!-- 1. Navigation -->
    <LandingNav />

    <!-- 2. Hero Section -->
    <MinimalHero />

    <!-- 3. Trust Strip -->
    <TrustStrip />

    <!-- 4. Three Core Capabilities -->
    <CapabilitySection />

    <!-- 5. Product Showcase -->
    <ProductShowcase />

    <!-- 6. Pricing -->
    <PricingClean />

    <!-- 7. FAQ -->
    <FaqSection />

    <!-- 8. Final CTA -->
    <FinalCta />

    <!-- 9. Footer -->
    <LandingFooter />
  </div>
</template>

<style scoped>
.landing-page-root {
  --landing-bg: #FAFAF8;
  --landing-surface: #FFFFFF;
  --landing-text: #171514;
  --landing-muted: #6F6A67;
  --landing-border: #E8E4E0;
  --landing-brand: #D91E4E;
  --landing-success: #168A52;

  min-height: 100vh;
  background-color: var(--landing-bg);
  color: var(--landing-text);
  font-family: var(--font-body, 'IBM Plex Sans', -apple-system, sans-serif);
  position: relative;
  overflow-x: hidden;
}
</style>