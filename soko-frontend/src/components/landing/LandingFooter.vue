<script setup lang="ts">
// =============================================================================
// KauntaOS-frontend/src/components/landing/LandingFooter.vue
// Footer with Nairobi footprint, trust badges, legal links, and copyright.
// =============================================================================

import { Store, ShieldCheck} from 'lucide-vue-next';

const currentYear = new Date().getFullYear();
</script>

<template>
  <footer class="landing-footer">
    <div class="footer-container">
      <div class="footer-top">
        <div class="footer-brand-col">
          <div class="brand-block">
            <div class="brand-icon">
              <Store :size="16" />
            </div>
            <span class="brand-name">KauntaOS<span class="brand-dot">.</span></span>
          </div>
          <p class="brand-mission">
            The modern retail operating system built for Kenyan merchants, boutiques, and market traders.
          </p>
          <div class="location-tag">
            <span>📍 Nairobi, Kenya</span>
          </div>
        </div>

        <div class="footer-links-grid">
          <div class="footer-col">
            <h4 class="col-title">Product</h4>
            <a href="#features">Online Storefront</a>
            <a href="#hero">Smart POS &amp; STK</a>
            <a href="#features">Madeni Chaser</a>
            <a href="#architecture">M-Pesa Architecture</a>
          </div>

          <div class="footer-col">
            <h4 class="col-title">Commercial</h4>
            <a href="#pricing">Pricing Plans</a>
            <RouterLink :to="{ name: 'register', query: { plan: 'lifetime' } }">Lifetime License</RouterLink>
            <a href="https://wa.me/254700000000" target="_blank">WhatsApp Support</a>
          </div>

          <div class="footer-col">
            <h4 class="col-title">Account</h4>
            <RouterLink :to="{ name: 'login' }">Merchant Login</RouterLink>
            <RouterLink :to="{ name: 'register' }">Create Free Store</RouterLink>
          </div>
        </div>
      </div>

      <div class="footer-bottom">
        <div class="security-note">
          <ShieldCheck :size="14" class="text-teal" />
          <span>AES-256 Encrypted • Safaricom Daraja Direct Pipe • Zero Funds Custody</span>
        </div>
        <p class="copyright-text">
          &copy; {{ currentYear }} KauntaOS Technologies. Built with pride in Kenya.
        </p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.landing-footer {
  background: #060908;
  border-top: 1px solid #141E1B;
  padding: 48px 20px 32px;
}

.footer-container {
  max-width: 1240px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 36px;
}

.footer-top {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 32px;
}

.footer-brand-col {
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.brand-block { display: flex; align-items: center; gap: 8px; }
.brand-icon {
  width: 28px;
  height: 28px;
  background: var(--brand-primary, #D91E4E);
  color: #FFFFFF;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-name {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 800;
  color: #F3F6F4;
}

.brand-dot { color: var(--brand-primary, #D91E4E); }
.brand-mission { font-size: 12px; color: #869E96; line-height: 1.5; }
.location-tag { font-size: 11px; color: #64748B; font-weight: 600; }

.footer-links-grid {
  display: flex;
  gap: 48px;
  flex-wrap: wrap;
}

.footer-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.col-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: #E2E8F0;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.footer-col a {
  font-size: 12px;
  color: #869E96;
  text-decoration: none;
  transition: color 120ms ease;
}
.footer-col a:hover { color: #F3F6F4; }

.footer-bottom {
  border-top: 1px solid #141E1B;
  padding-top: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.security-note {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #869E96;
}

.copyright-text {
  font-size: 11px;
  color: #64748B;
}

.text-teal { color: #34D399; }
</style>