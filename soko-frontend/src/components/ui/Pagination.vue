<script setup lang="ts">
// =============================================================================
// src/components/ui/Pagination.vue
// =============================================================================

interface Props {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

const props = defineProps<Props>();

function goPrev(): void {
  if (props.page > 1) {
    props.onChange(props.page - 1);
  }
}

function goNext(): void {
  if (props.page < props.totalPages) {
    props.onChange(props.page + 1);
  }
}
</script>

<template>
  <nav class="pagination" aria-label="Pagination">
    <button
      class="pagination__btn"
      type="button"
      :disabled="page <= 1"
      aria-label="Previous page"
      @click="goPrev"
    >
      ‹
    </button>

    <span class="pagination__indicator">Page {{ page }} of {{ totalPages }}</span>

    <button
      class="pagination__btn"
      type="button"
      :disabled="page >= totalPages"
      aria-label="Next page"
      @click="goNext"
    >
      ›
    </button>
  </nav>
</template>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
}

.pagination__btn {
  width: 40px;
  height: 40px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: var(--text-lg);
  cursor: pointer;
}

.pagination__btn:hover:not(:disabled) {
  background: var(--color-bg);
}

.pagination__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination__indicator {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}
</style>