<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/LandingView.vue
// Minimalist, high-converting master view aggregating the 4 core sections:
// 1. LandingNav (Sticky glassmorphic bar)
// 2. MonolithHero (Punchy copy + Pure CSS "UI-As-Art" dual viewport)
// 3. FlagshipPillars (3-Pillar Bento: Storefront, Direct STK POS, Madeni Ledger)
// 4. PricingClean (Minimalist 3-tier commercial matrix)
// 5. FaqConcierge (Direct FAQ + WhatsApp Concierge)
// 6. LandingFooter (Nairobi footprint, legal, and trust guarantees)
// =============================================================================

import { onMounted } from 'vue';
import { useScrollReveal } from '@/composables/useScrollAnimation';
import LandingNav from '@/components/landing/LandingNav.vue';
import MonolithHero from '@/components/landing/MonolithHero.vue';
import FlagshipPillars from '@/components/landing/FlagshipPillars.vue';
import PricingClean from '@/components/landing/PricingClean.vue';
import FaqConcierge from '@/components/landing/FaqConcierge.vue';
import LandingFooter from '@/components/landing/LandingFooter.vue';

// Initialize native IntersectionObserver scroll reveal engine
useScrollReveal({
  threshold: 0.12,
  rootMargin: '0px 0px -40px 0px',
  staggerMs: 80,
});

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3000/api/v1';

onMounted(() => {
  // Silent background wake-up ping to eliminate Render free tier's 50s cold start
  fetch(`${API_BASE}/health`, { method: 'GET' }).catch(() => {});
});
</script>

<template>
  <div class="landing-view-root">
    <!-- 1. Sticky Navigation Bar -->
    <LandingNav />

    <main class="landing-main-content">
      <!-- 2. Hero Section with "UI-As-Art" Monolith Centerpiece -->
      <MonolithHero />

      <!-- 3. The 3 Flagship Pillars Bento -->
      <FlagshipPillars />

      <!-- 4. Clean Commercial 3-Tier Pricing -->
      <PricingClean />

      <!-- 5. Direct FAQ & WhatsApp Concierge -->
      <FaqConcierge />
    </main>

    <!-- 6. Footer & Trust Guarantees -->
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
  background-image: radial-gradient(rgba(31, 46, 41, 0.35) 1px, transparent 1px);
  background-size: 32px 32px;
}

.landing-main-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
}
</style>