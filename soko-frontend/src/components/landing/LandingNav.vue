<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/landing/LandingNav.vue
// Minimal, clean navigation bar with logo, anchor links, and primary CTA.
// =============================================================================

import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { Menu, X, ArrowRight } from 'lucide-vue-next';

const authStore = useAuthStore();
const isMobileMenuOpen = ref(false);

function scrollToSection(id: string): void {
  isMobileMenuOpen.value = false;
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
}
</script>

<template>
  <header class="minimal-nav">
    <div class="nav-container">
      <!-- Brand Logo -->
      <a href="#" class="brand-link" @click.prevent="scrollToSection('hero')">
        <span class="brand-name">Soko</span>
      </a>

      <!-- Desktop Anchor Links -->
      <nav class="nav-links">
        <button type="button" class="nav-link" @click="scrollToSection('capabilities')">Features</button>
        <button type="button" class="nav-link" @click="scrollToSection('showcase')">Product</button>
        <button type="button" class="nav-link" @click="scrollToSection('pricing')">Pricing</button>
        <button type="button" class="nav-link" @click="scrollToSection('faq')">FAQ</button>
      </nav>

      <!-- Desktop Actions -->
      <div class="nav-actions">
        <RouterLink v-if="authStore.isAuthenticated" :to="{ name: 'dashboard' }" class="btn-primary-nav">
          Open dashboard <ArrowRight :size="14" />
        </RouterLink>
        <template v-else>
          <RouterLink :to="{ name: 'login' }" class="login-link">Log in</RouterLink>
          <RouterLink :to="{ name: 'register' }" class="btn-primary-nav">
            Get started
          </RouterLink>
        </template>

        <!-- Mobile Toggle Button -->
        <button
          type="button"
          class="mobile-toggle"
          aria-label="Toggle navigation menu"
          @click="isMobileMenuOpen = !isMobileMenuOpen"
        >
          <component :is="isMobileMenuOpen ? X : Menu" :size="22" />
        </button>
      </div>
    </div>

    <!-- Mobile Drawer -->
    <div v-if="isMobileMenuOpen" class="mobile-menu">
      <button type="button" class="mobile-link" @click="scrollToSection('capabilities')">Features</button>
      <button type="button" class="mobile-link" @click="scrollToSection('showcase')">Product</button>
      <button type="button" class="mobile-link" @click="scrollToSection('pricing')">Pricing</button>
      <button type="button" class="mobile-link" @click="scrollToSection('faq')">FAQ</button>
      <div class="mobile-actions">
        <RouterLink v-if="!authStore.isAuthenticated" :to="{ name: 'login' }" class="mobile-login">Log in</RouterLink>
        <RouterLink :to="{ name: authStore.isAuthenticated ? 'dashboard' : 'register' }" class="btn-primary-nav full-width">
          {{ authStore.isAuthenticated ? 'Open dashboard' : 'Get started' }}
        </RouterLink>
      </div>
    </div>
  </header>
</template>

<style scoped>
.minimal-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(250, 250, 248, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--landing-border, #E8E4E0);
}

.nav-container {
  max-width: 1140px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brand-link {
  text-decoration: none;
  display: flex;
  align-items: center;
}

.brand-name {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: 24px;
  font-weight: 600;
  color: var(--landing-text, #171514);
  letter-spacing: -0.02em;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 32px;
}

@media (max-width: 768px) {
  .nav-links { display: none; }
}

.nav-link {
  background: transparent;
  border: none;
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 14px;
  font-weight: 500;
  color: var(--landing-muted, #6F6A67);
  cursor: pointer;
  padding: 0;
  transition: color 150ms ease;
}
.nav-link:hover { color: var(--landing-text, #171514); }

.nav-actions {
  display: flex;
  align-items: center;
  gap: 20px;
}

.login-link {
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 14px;
  font-weight: 500;
  color: var(--landing-text, #171514);
  text-decoration: none;
  transition: color 150ms ease;
}
.login-link:hover { color: var(--landing-brand, #D91E4E); }

.btn-primary-nav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--landing-brand, #D91E4E);
  color: #FFFFFF;
  text-decoration: none;
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 14px;
  font-weight: 600;
  padding: 8px 18px;
  border-radius: 8px;
  transition: opacity 150ms ease, transform 150ms ease;
}
.btn-primary-nav:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}

.mobile-toggle {
  display: none;
  background: transparent;
  border: none;
  color: var(--landing-text, #171514);
  cursor: pointer;
  padding: 4px;
}

@media (max-width: 768px) {
  .mobile-toggle { display: flex; }
  .login-link, .nav-actions .btn-primary-nav { display: none; }
}

.mobile-menu {
  background: var(--landing-surface, #FFFFFF);
  border-bottom: 1px solid var(--landing-border, #E8E4E0);
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mobile-link {
  background: transparent;
  border: none;
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 16px;
  font-weight: 500;
  color: var(--landing-text, #171514);
  text-align: left;
  cursor: pointer;
  padding: 4px 0;
}

.mobile-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--landing-border, #E8E4E0);
}

.mobile-login {
  text-align: center;
  color: var(--landing-muted, #6F6A67);
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
  padding: 8px;
}

.full-width { width: 100%; }
</style>