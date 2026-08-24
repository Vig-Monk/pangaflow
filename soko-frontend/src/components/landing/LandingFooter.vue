<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/landing/LandingFooter.vue
// Minimal 4-column footer with essential links and copyright.
// =============================================================================

const currentYear = new Date().getFullYear();
</script>

<template>
  <footer class="landing-footer">
    <div class="footer-container">
      <div class="footer-top">
        <div class="footer-brand">
          <span class="footer-logo font-display">Soko</span>
          <p class="footer-tagline">Simple tools for Kenyan businesses.</p>
        </div>

        <div class="footer-grid">
          <div class="footer-col">
            <h4>Product</h4>
            <a href="#capabilities">Features</a>
            <a href="#showcase">Showcase</a>
            <a href="#pricing">Pricing</a>
          </div>

          <div class="footer-col">
            <h4>Account</h4>
            <RouterLink :to="{ name: 'login' }">Log in</RouterLink>
            <RouterLink :to="{ name: 'register' }">Register</RouterLink>
          </div>

          <div class="footer-col">
            <h4>Support</h4>
            <a href="#faq">FAQ</a>
            <a href="https://wa.me/254700000000" target="_blank" rel="noopener">WhatsApp</a>
          </div>
        </div>
      </div>

      <div class="footer-bottom">
        <p>&copy; {{ currentYear }} Soko. Built for Kenya.</p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.landing-footer {
  border-top: 1px solid var(--landing-border, #E8E4E0);
  background: var(--landing-surface, #FFFFFF);
  padding: 56px 24px 36px;
}

.footer-container {
  max-width: 1140px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.footer-top {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 40px;
}

.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 280px;
}

.footer-logo {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: 22px;
  font-weight: 600;
  color: var(--landing-text, #171514);
}

.footer-tagline {
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 13px;
  color: var(--landing-muted, #6F6A67);
}

.footer-grid {
  display: flex;
  gap: 56px;
  flex-wrap: wrap;
}

.footer-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.footer-col h4 {
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--landing-text, #171514);
  margin-bottom: 2px;
}

.footer-col a {
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 13px;
  color: var(--landing-muted, #6F6A67);
  text-decoration: none;
  transition: color 150ms ease;
}

.footer-col a:hover {
  color: var(--landing-brand, #D91E4E);
}

.footer-bottom {
  border-top: 1px solid var(--landing-border, #E8E4E0);
  padding-top: 24px;
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 12px;
  color: var(--landing-muted, #6F6A67);
}
	</style>