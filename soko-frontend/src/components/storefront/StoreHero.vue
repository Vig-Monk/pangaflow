<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/storefront/StoreHero.vue
// =============================================================================

import type { StoreSettings } from '@/stores/store';

interface Props {
  settings: StoreSettings | null;
}

defineProps<Props>();
</script>

<template>
  <div class="store-hero" :class="`hero--${settings?.hero_layout ?? 'editorial'}`">
    
    <!-- 1. EDITORIAL LAYOUT -->
    <template v-if="!settings?.hero_layout || settings.hero_layout === 'editorial'">
      <div class="hero-banner-wrap">
        <div 
          v-if="settings?.cover_image_url" 
          class="hero-banner" 
          :style="{ backgroundImage: `url(${settings.cover_image_url})` }" 
        />
        <div v-else class="hero-banner hero-banner--default" />
        
        <div class="hero-branding">
          <h1 class="hero-headline">{{ settings?.hero_headline || settings?.name || 'Welcome to our Shop' }}</h1>
          <p class="hero-subheadline">{{ settings?.hero_subheadline || settings?.description || 'Explore our exclusive selection of verified items.' }}</p>
          <button v-if="settings?.hero_cta_label" class="hero-cta-btn" type="button">
            {{ settings.hero_cta_label }}
          </button>
        </div>
      </div>
    </template>

    <!-- 2. SPLIT LAYOUT -->
    <template v-else-if="settings?.hero_layout === 'split'">
      <div class="hero-split-container">
        <div class="hero-split-content">
          <h1 class="hero-headline">{{ settings?.hero_headline || settings?.name || 'Welcome to our Shop' }}</h1>
          <p class="hero-subheadline">{{ settings?.hero_subheadline || settings?.description || 'Explore our collection.' }}</p>
          <button v-if="settings?.hero_cta_label" class="hero-cta-btn" type="button">
            {{ settings.hero_cta_label }}
          </button>
        </div>
        <div class="hero-split-media">
          <img v-if="settings?.cover_image_url" :src="settings.cover_image_url" alt="Cover" class="split-img" />
          <div v-else class="split-placeholder">🏪</div>
        </div>
      </div>
    </template>

    <!-- 3. MINIMAL LAYOUT -->
    <template v-else-if="settings?.hero_layout === 'minimal'">
      <div class="hero-minimal-container">
        <h1 class="hero-headline">{{ settings?.hero_headline || settings?.name || 'Welcome to our Shop' }}</h1>
        <p class="hero-subheadline">{{ settings?.hero_subheadline || settings?.description || 'Explore our collection.' }}</p>
        <button v-if="settings?.hero_cta_label" class="hero-cta-btn hero-cta-btn--dark" type="button">
          {{ settings.hero_cta_label }}
        </button>
      </div>
    </template>

    <!-- 4. PROMOTIONAL LAYOUT -->
    <template v-else-if="settings?.hero_layout === 'promotional'">
      <div 
        class="hero-promo-container" 
        :style="settings?.cover_image_url ? { backgroundImage: `url(${settings.cover_image_url})` } : {}"
      >
        <div class="promo-overlay">
          <div class="promo-content">
            <span class="promo-badge">Featured Shop</span>
            <h1 class="hero-headline">{{ settings?.hero_headline || settings?.name || 'Welcome to our Shop' }}</h1>
            <p class="hero-subheadline">{{ settings?.hero_subheadline || settings?.description || 'Explore our collection.' }}</p>
            <button v-if="settings?.hero_cta_label" class="hero-cta-btn" type="button">
              {{ settings.hero_cta_label }}
            </button>
          </div>
        </div>
      </div>
    </template>

  </div>
</template>

<style scoped>
.store-hero {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  width: 100%;
}

.hero-banner-wrap {
  position: relative;
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.hero-banner {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  filter: brightness(0.65);
}

.hero-banner--default {
  background: linear-gradient(135deg, var(--color-ink) 0%, var(--color-border) 100%);
}

.hero-branding {
  position: relative;
  z-index: 2;
  max-width: 800px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.hero-headline {
  font-family: var(--font-display);
  font-size: var(--text-3xl);
  color: #FFFFFF;
  line-height: var(--leading-tight);
}

.hero-subheadline {
  font-size: var(--text-base);
  color: rgba(255, 255, 255, 0.9);
  max-width: 540px;
  line-height: var(--leading-relaxed);
}

.hero-cta-btn {
  background: var(--color-gold);
  color: var(--color-text-inverse, #FFFFFF);
  border: none;
  padding: var(--space-3) var(--space-8);
  border-radius: var(--radius-full);
  font-size: var(--text-base);
  font-weight: 700;
  cursor: pointer;
  margin-top: var(--space-2);
  transition: transform var(--duration-fast) var(--ease-standard);
}
.hero-cta-btn:hover { transform: translateY(-2px); }

.hero-split-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

@media (min-width: 768px) {
  .hero-split-container { flex-direction: row; min-height: 280px; }
}

.hero-split-content {
  flex: 1;
  padding: var(--space-8);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-3);
}

.hero-split-content .hero-headline {
  color: var(--color-text);
  font-size: var(--text-2xl);
}
.hero-split-content .hero-subheadline { color: var(--color-text-muted); }

.hero-split-media {
  flex: 1;
  min-height: 200px;
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.split-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.split-placeholder { font-size: 48px; }

.hero-minimal-container {
  max-width: 900px;
  margin: 0 auto;
  padding: var(--space-10) var(--space-4);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.hero-minimal-container .hero-headline { color: var(--color-text); font-size: var(--text-2xl); }
.hero-minimal-container .hero-subheadline { color: var(--color-text-muted); }

.hero-cta-btn--dark {
  background: var(--color-ink);
  color: var(--color-text-inverse);
}

.hero-promo-container {
  min-height: 280px;
  background-size: cover;
  background-position: center;
  background-color: var(--color-ink);
  position: relative;
}

.promo-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(15, 61, 62, 0.9) 0%, rgba(15, 61, 62, 0.4) 100%);
  display: flex;
  align-items: center;
  padding: var(--space-8);
}

.promo-content {
  max-width: 600px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
}

.promo-badge {
  background: var(--color-gold);
  color: var(--color-text-inverse, #FFFFFF);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px var(--space-3);
  border-radius: var(--radius-full);
}
.promo-content .hero-headline { font-size: var(--text-2xl); color: #FFFFFF; }
.promo-content .hero-subheadline { text-align: left; color: rgba(255, 255, 255, 0.85); }
</style>