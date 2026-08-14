<script setup lang="ts">
// =============================================================================
// src/components/ui/EmptyState.vue
// =============================================================================

import type { Component } from 'vue';
import Button from './Button.vue';

interface Props {
  icon?: Component;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

defineProps<Props>();
</script>

<template>
  <div class="empty-state">
    <component :is="icon" v-if="icon" class="empty-state__icon" aria-hidden="true" />
    <h3 class="empty-state__title">{{ title }}</h3>
    <p v-if="description" class="empty-state__description">{{ description }}</p>
    <Button v-if="actionLabel && onAction" variant="primary" @click="onAction">
      {{ actionLabel }}
    </Button>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-16) var(--space-6);
}

.empty-state__icon {
  width: 48px;
  height: 48px;
  color: var(--color-text-muted);
  margin-bottom: var(--space-4);
}

.empty-state__title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: var(--space-2);
}

.empty-state__description {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  max-width: 360px;
  margin-bottom: var(--space-6);
  line-height: var(--leading-relaxed);
}
</style>