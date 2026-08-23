<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/LandingView.vue
// Master Landing Page Container: Orchestrates Bento modules, scroll-reveal engine,
// and silent Render backend wake-up ping.
// =============================================================================

import { onMounted } from 'vue';
import { useScrollReveal } from '@/composables/useScrollAnimation';
import LandingNav from '@/components/landing/LandingNav.vue';
import HeroBento from '@/components/landing/HeroBento.vue';
import ComparisonBento from '@/components/landing/ComparisonBento.vue';
import ArchitectureFlow from '@/components/landing/ArchitectureFlow.vue';
import RoiCalculator from '@/components/landing/RoiCalculator.vue';
import FeatureBentoGrid from '@/components/landing/FeatureBentoGrid.vue';
import PricingBento from '@/components/landing/PricingBento.vue';
import FaqSection from '@/components/landing/FaqSection.vue';
import LandingFooter from '@/components/landing/LandingFooter.vue';

// Initialize native IntersectionObserver scroll reveal engine
useScrollReveal({
  threshold: 0.12,
  rootMargin: '0px 0px -40px 0px',
  staggerMs: 80,
});

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3000/api/v1';

onMounted(() => {
  // Silent background wake-up ping for Render cold-start mitigation
  fetch(`${API_BASE}/health`, { method: 'GET' }).catch(() => {});
});
</script>

<template>
  <div class="landing-view-root">
    <!-- 1. Sticky Navigation Bar -->
    <LandingNav />

    <main class="landing-main-content">
      <!-- 2. Asymmetrical 12-Column Hero Bento Grid -->
      <HeroBento />

      <!-- 3. Interactive Counter Book vs. Soko OS Comparison Board -->
      <ComparisonBento />

      <!-- 4. Zero-Custody M-Pesa Architecture Flow Section -->
      <section id="architecture" class="section-wrapper">
        <div class="section-inner" data-reveal="zoom">
          <ArchitectureFlow />
        </div>
      </section>

      <!-- 5. Lost Revenue & Loss Aversion ROI Calculator Section -->
      <section id="roi" class="section-wrapper">
        <div class="section-inner" data-reveal="zoom">
          <RoiCalculator />
        </div>
      </section>

      <!-- 6. Platform Pillars Feature Bento Grid -->
      <FeatureBentoGrid />

      <!-- 7. Commercial 4-Tier Pricing Grid -->
      <PricingBento />

      <!-- 8. FAQ Accordion & WhatsApp Concierge Callout -->
      <FaqSection />
    </main>

    <!-- 9. Footer & Trust Certifications -->
    <LandingFooter />
  </div>
</template>

<style scoped>
.landing-view-root {
  min-height: 100vh;
  background-color: var(--bg-canvas, #090D0C);
  color: var(--text-paper, #F3F6F4);
  font-family: var(--font-body, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  position: relative;
  overflow-x: hidden;
  background-image: radial-gradient(rgba(31, 46, 41, 0.4) 1px, transparent 1px);
  background-size: 28px 28px;
}

.landing-main-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-wrapper {
  max-width: 1240px;
  margin: 0 auto;
  padding: 20px 20px 40px;
  width: 100%;
}

.section-inner {
  width: 100%;
}
</style>