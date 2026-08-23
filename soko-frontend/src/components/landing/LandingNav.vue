<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/landing/LandingNav.vue
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
        <span class="brand-name">SOKO<span class="brand-dot">.</span></span>
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

.nav-container {
  max-width: 1240px;
  margin: 0 auto;
  padding: 14px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
}

.brand-icon {
  width: 32px;
  height: 32px;
  background: var(--brand-primary, #D91E4E);
  color: #FFFFFF;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-name {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 800;
  color: #F3F6F4;
  letter-spacing: -0.02em;
}

.brand-dot { color: var(--brand-primary, #D91E4E); }

.desktop-nav {
  display: flex;
  align-items: center;
  gap: 24px;
}

@media (max-width: 860px) {
  .desktop-nav { display: none; }
}

.nav-anchor {
  background: transparent;
  border: none;
  font-size: 13px;
  font-weight: 600;
  color: #94A3B8;
  cursor: pointer;
  transition: color 120ms ease;
  padding: 0;
}
.nav-anchor:hover { color: #F3F6F4; }

.nav-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.login-link {
  font-size: 13px;
  font-weight: 600;
  color: #F3F6F4;
  text-decoration: none;
  transition: color 120ms ease;
}
.login-link:hover { color: var(--brand-primary, #D91E4E); }

.btn-cta, .btn-dashboard {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--brand-primary, #D91E4E);
  color: #FFFFFF;
  text-decoration: none;
  font-size: 13px;
  font-weight: 700;
  padding: 8px 16px;
  border-radius: 8px;
  transition: transform 120ms ease, opacity 120ms ease;
}
.btn-cta:hover, .btn-dashboard:hover {
  transform: translateY(-1px);
  opacity: 0.95;
}

.mobile-toggle-btn {
  display: none;
  background: transparent;
  border: none;
  color: #F3F6F4;
  cursor: pointer;
  padding: 4px;
}

@media (max-width: 860px) {
  .mobile-toggle-btn { display: flex; }
  .login-link, .btn-cta { display: none; }
}

.mobile-drawer {
  background: #0E1614;
  border-bottom: 1px solid #1A2622;
  padding: 16px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mobile-nav-link {
  background: transparent;
  border: none;
  color: #E2E8F0;
  font-size: 15px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  padding: 4px 0;
}

.mobile-drawer-auth {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid #1A2622;
}

.mobile-login-btn {
  text-align: center;
  color: #94A3B8;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  padding: 8px;
}

.mobile-cta-btn {
  background: var(--brand-primary, #D91E4E);
  color: #FFFFFF;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  padding: 12px;
  border-radius: 8px;
}
</style>