<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/storefront/StoreHero.vue
// Editorial brand introduction hero with generous whitespace and layout styles.
// =============================================================================

import type { StoreSettings } from '@/stores/store';

interface Props {
  settings: StoreSettings | null;
}

defineProps<Props>();
</script>

<template>
  <div class="store-hero" :class="`hero-layout--${settings?.hero_layout || 'editorial'}`">
    <!-- 1. EDITORIAL LAYOUT -->
    <template v-if="!settings?.hero_layout || settings.hero_layout === 'editorial'">
      <div class="editorial-container">
        <div
          v-if="settings?.cover_image_url"
          class="cover-banner-frame"
          :style="{ backgroundImage: `url(${settings.cover_image_url})` }"
        >
          <div class="cover-overlay"></div>
          <div class="cover-content">
            <h1 class="hero-title">{{ settings?.hero_headline || settings?.name || 'Welcome to our shop' }}</h1>
            <p v-if="settings?.hero_subheadline || settings?.description" class="hero-desc">
              {{ settings?.hero_subheadline || settings?.description }}
            </p>
          </div>
        </div>
        <div v-else class="editorial-text-only">
          <h1 class="hero-title">{{ settings?.hero_headline || settings?.name || 'Welcome to our shop' }}</h1>
          <p v-if="settings?.hero_subheadline || settings?.description" class="hero-desc">
            {{ settings?.hero_subheadline || settings?.description }}
          </p>
        </div>
      </div>
    </template>

    <!-- 2. SPLIT LAYOUT -->
    <template v-else-if="settings?.hero_layout === 'split'">
      <div class="split-container">
        <div class="split-content">
          <h1 class="hero-title">{{ settings?.hero_headline || settings?.name || 'Welcome to our shop' }}</h1>
          <p v-if="settings?.hero_subheadline || settings?.description" class="hero-desc">
            {{ settings?.hero_subheadline || settings?.description }}
          </p>
        </div>
        <div v-if="settings?.cover_image_url" class="split-image-frame">
          <img :src="settings.cover_image_url" :alt="settings.name" class="split-img" />
        </div>
      </div>
    </template>

    <!-- 3. MINIMAL LAYOUT -->
    <template v-else-if="settings?.hero_layout === 'minimal'">
      <div class="minimal-container">
        <h1 class="hero-title">{{ settings?.hero_headline || settings?.name || 'Welcome to our shop' }}</h1>
        <p v-if="settings?.hero_subheadline || settings?.description" class="hero-desc">
          {{ settings?.hero_subheadline || settings?.description }}
        </p>
      </div>
    </template>

    <!-- 4. PROMOTIONAL LAYOUT -->
    <template v-else-if="settings?.hero_layout === 'promotional'">
      <div
        class="promo-container"
        :style="settings?.cover_image_url ? { backgroundImage: `url(${settings.cover_image_url})` } : {}"
      >
        <div class="promo-content">
          <h1 class="hero-title">{{ settings?.hero_headline || settings?.name || 'Featured collection' }}</h1>
          <p v-if="settings?.hero_subheadline || settings?.description" class="hero-desc">
            {{ settings?.hero_subheadline || settings?.description }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.store-hero {
  width: 100%;
  border-bottom: 1px solid var(--store-border);
  background-color: var(--store-surface);
  transition: background-color 200ms ease, border-color 200ms ease;
}

.hero-title {
  font-family: var(--font-display, 'Fraunces', Georgia, serif);
  font-size: clamp(28px, 3.8vw, 44px);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.hero-desc {
  font-family: inherit;
  font-size: 15px;
  line-height: 1.55;
  max-width: 580px;
}

/* Editorial Style */
.editorial-container {
  max-width: 1240px;
  margin: 0 auto;
}

.cover-banner-frame {
  position: relative;
  min-height: 320px;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 48px 24px;
}

.cover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}

.cover-content {
  position: relative;
  z-index: 2;
  color: #FFFFFF;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.cover-content .hero-desc {
  color: rgba(255, 255, 255, 0.9);
}

.editorial-text-only {
  padding: 60px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.editorial-text-only .hero-desc {
  color: var(--store-text-secondary);
}

/* Split Style */
.split-container {
  max-width: 1240px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
}

@media (max-width: 768px) {
  .split-container { grid-template-columns: 1fr; }
}

.split-content {
  padding: 48px 32px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.split-content .hero-desc {
  color: var(--store-text-secondary);
}

.split-image-frame {
  height: 100%;
  min-height: 280px;
  overflow: hidden;
}

.split-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Minimal Style */
.minimal-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 56px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.minimal-container .hero-desc {
  color: var(--store-text-secondary);
}

/* Promo Style */
.promo-container {
  min-height: 280px;
  background-size: cover;
  background-position: center;
  background-color: var(--store-soft);
  display: flex;
  align-items: center;
  padding: 48px 32px;
}

.promo-content {
  max-width: 540px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.promo-content .hero-desc {
  color: var(--store-text-secondary);
}
</style>