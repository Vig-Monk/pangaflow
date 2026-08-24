<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/landing/TrustStrip.vue
// Subtle, quiet 1-line trust indicators below the hero.
// =============================================================================
</script>

<template>
  <div class="trust-strip-container">
    <div class="trust-strip">
      <span>Built for Kenyan merchants</span>
      <span class="trust-bullet">·</span>
      <span>M-Pesa ready</span>
      <span class="trust-bullet">·</span>
      <span>Works on Android</span>
      <span class="trust-bullet">·</span>
      <span>Simple setup</span>
    </div>
  </div>
</template>

<style scoped>
.trust-strip-container {
  max-width: 1140px;
  margin: 0 auto;
  padding: 0 24px;
  border-top: 1px solid var(--landing-border, #E8E4E0);
  border-bottom: 1px solid var(--landing-border, #E8E4E0);
}

.trust-strip {
  padding: 20px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 13px;
  color: var(--landing-muted, #6F6A67);
  font-weight: 500;
}

.trust-bullet {
  color: var(--landing-border, #E8E4E0);
}
	</style>