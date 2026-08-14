<script setup lang="ts">
// =============================================================================
// src/components/ui/SearchBar.vue
// Debounced 300ms. The debounce timer lives HERE, not in the store —
// design.md's explicit instruction, confirmed against customers.ts's
// search() action, which has no debounce logic of its own.
// =============================================================================

import { ref } from 'vue';

interface Props {
  placeholder?: string;
}

withDefaults(defineProps<Props>(), {
  placeholder: 'Search…',
});

const emit = defineEmits<{ search: [query: string] }>();

const query = ref('');
const isSearching = ref(false);
let debounceHandle: ReturnType<typeof setTimeout> | undefined;

const DEBOUNCE_MS = 300;

function handleInput(): void {
  if (debounceHandle) clearTimeout(debounceHandle);

  isSearching.value = true;
  debounceHandle = setTimeout(() => {
    emit('search', query.value.trim());
    isSearching.value = false;
  }, DEBOUNCE_MS);
}
</script>

<template>
  <div class="search-bar">
    <span class="search-bar__icon" aria-hidden="true">⌕</span>
    <input
      v-model="query"
      type="search"
      :placeholder="placeholder"
      class="search-bar__input"
      @input="handleInput"
    />
    <span v-if="isSearching" class="search-bar__spinner" aria-hidden="true" />
  </div>
</template>

<style scoped>
.search-bar {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 240px;
}

.search-bar__icon {
  position: absolute;
  left: var(--space-3);
  color: var(--color-text-muted);
  font-size: var(--text-lg);
  pointer-events: none;
}

.search-bar__input {
  width: 100%;
  min-height: 44px;
  padding: 0 var(--space-8) 0 var(--space-10);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: var(--text-base);
  color: var(--color-text);
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-standard);
}
.search-bar__input:focus { border-color: var(--color-ink); }

.search-bar__spinner {
  position: absolute;
  right: var(--space-3);
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-text-muted);
  border-right-color: transparent;
  border-radius: 50%;
  animation: search-spin var(--duration-slow) linear infinite;
}

@keyframes search-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .search-bar__spinner { animation: none; opacity: 0.5; }
}
</style>