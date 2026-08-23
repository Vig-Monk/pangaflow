<script setup lang="ts">
// =============================================================================
// KauntaOS-frontend/src/components/landing/LandingNav.vue
// Sticky glassmorphic navigation with anchor scrolling and auth state handling.
// =============================================================================

import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { Store, Menu, X, ArrowRight, Sparkles } from 'lucide-vue-next';

const authStore = useAuthStore();
const isMobileMenuOpen = ref(false);

function scrollToSection(id: string): void {
  isMobileMenuOpen.value = false;
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
}
</script>

<template>
  <header class="landing-nav-wrap">
    <div class="nav-container">
      <!-- Brand Logo -->
      <a href="#" class="brand-block" @click.prevent="scrollToSection('hero')">
        <div class="brand-icon">
          <Store :size="18" />
        </div>
        <span class="brand-name">KauntaOS<span class="brand-dot">.</span></span>
      </a>

      <!-- Desktop Anchor Links -->
      <nav class="desktop-nav">
        <button type="button" class="nav-anchor" @click="scrollToSection('features')">Features</button>
        <button type="button" class="nav-anchor" @click="scrollToSection('architecture')">M-Pesa Architecture</button>
        <button type="button" class="nav-anchor" @click="scrollToSection('roi')">ROI Calculator</button>
        <button type="button" class="nav-anchor" @click="scrollToSection('pricing')">Pricing</button>
        <button type="button" class="nav-anchor" @click="scrollToSection('faq')">FAQ</button>
      </nav>

      <!-- Desktop Auth Actions -->
      <div class="nav-actions">
        <RouterLink v-if="authStore.isAuthenticated" :to="{ name: 'dashboard' }" class="btn-dashboard">
          <Sparkles :size="14" /> Open Dashboard
        </RouterLink>
        <template v-else>
          <RouterLink :to="{ name: 'login' }" class="login-link">Log In</RouterLink>
          <RouterLink :to="{ name: 'register' }" class="btn-cta">
            Start Free <ArrowRight :size="14" />
          </RouterLink>
        </template>

        <!-- Mobile Toggle Button -->
        <button
          type="button"
          class="mobile-toggle-btn"
          aria-label="Toggle navigation menu"
          @click="isMobileMenuOpen = !isMobileMenuOpen"
        >
          <component :is="isMobileMenuOpen ? X : Menu" :size="22" />
        </button>
      </div>
    </div>

    <!-- Mobile Drawer -->
    <div v-if="isMobileMenuOpen" class="mobile-drawer">
      <button type="button" class="mobile-nav-link" @click="scrollToSection('features')">Features</button>
      <button type="button" class="mobile-nav-link" @click="scrollToSection('architecture')">M-Pesa Architecture</button>
      <button type="button" class="mobile-nav-link" @click="scrollToSection('roi')">ROI Calculator</button>
      <button type="button" class="mobile-nav-link" @click="scrollToSection('pricing')">Pricing</button>
      <button type="button" class="mobile-nav-link" @click="scrollToSection('faq')">FAQ</button>
      <div class="mobile-drawer-auth">
        <RouterLink v-if="!authStore.isAuthenticated" :to="{ name: 'login' }" class="mobile-login-btn">Log In</RouterLink>
        <RouterLink :to="{ name: authStore.isAuthenticated ? 'dashboard' : 'register' }" class="mobile-cta-btn">
          {{ authStore.isAuthenticated ? 'Open Dashboard' : 'Create Free Store' }}
        </RouterLink>
      </div>
    </div>
  </header>
</template>

<style scoped>
.landing-nav-wrap {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(9, 13, 12, 0.85);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid #1A2622;
}

.nav-con