<script setup lang="ts" generic="T extends object">
// =============================================================================
// soko-frontend/src/components/ui/DataTable.vue
// Sticky headers with backdrop blur, horizontal containment, and accessible contrast.
// =============================================================================

import Skeleton from './Skeleton.vue';
import EmptyState from './EmptyState.vue';

export interface DataTableColumn<T = any> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  render?: (row: T) => string;
  cellClass?: (row: T) => string;
}

interface Props<T = any> {
  columns: DataTableColumn<T>[];
  rows: T[];
  loading?: boolean;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

withDefaults(defineProps<Props<T>>(), {
  loading: false,
  onRowClick: undefined,
  emptyTitle: 'No data found',
  emptyDescription: undefined,
});

function cellValue(row: T, column: DataTableColumn<T>): string {
  if (column.render) return column.render(row);
  const value = (row as Record<string, unknown>)[column.key];
  return value === null || value === undefined ? '—' : String(value);
}
</script>

<template>
  <div class="data-table-wrapper">
    <div class="data-table-scroll-container">
      <table class="data-table__table">
        <thead class="data-table__thead">
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              class="data-table__th"
              :class="{ 'data-table__th--right': col.align === 'right' }"
            >
              {{ col.label }}
            </th>
          </tr>
        </thead>

        <!-- Shimmer Skeleton Loading Rows -->
        <tbody v-if="loading">
          <tr v-for="n in 5" :key="`skeleton-${n}`" class="data-table__skeleton-row">
            <td v-for="col in columns" :key="col.key" class="data-table__td">
              <Skeleton height="15px" radius="4px" />
            </td>
          </tr>
        </tbody>

        <!-- Data Rows -->
        <TransitionGroup v-else name="table-row" tag="tbody">
          <tr
            v-for="row in rows"
            :key="rowKey(row)"
            class="data-table__row"
            :class="{ 'data-table__row--clickable': !!onRowClick }"
            @click="onRowClick?.(row)"
          >
            <td
              v-for="col in columns"
              :key="col.key"
              class="data-table__td"
              :class="[col.align === 'right' ? 'data-table__td--right' : '', col.cellClass?.(row)]"
            >
              <slot :name="`cell-${col.key}`" :row="row">
                {{ cellValue(row, col) }}
              </slot>
            </td>
          </tr>
        </TransitionGroup>
      </table>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-if="!loading && rows.length === 0"
      :title="emptyTitle"
      :description="emptyDescription"
    />
  </div>
</template>

<style scoped>
.data-table-wrapper {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  position: relative;
}

.data-table-scroll-container {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.data-table__table {
  width: 100%;
  min-width: 600px;
  border-collapse: collapse;
  text-align: left;
}

.data-table__thead {
  position: sticky;
  top: 0;
  z-index: 10;
}

.data-table__th {
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  backdrop-filter: blur(8px);
  white-space: nowrap;
}
.data-table__th--right { text-align: right; }

.data-table__row {
  border-bottom: 1px solid var(--color-border);
  transition: background var(--duration-fast) var(--ease-standard);
}
.data-table__row:last-child {
  border-bottom: none;
}

.data-table__row--clickable {
  cursor: pointer;
}
.data-table__row--clickable:hover {
  background: var(--color-surface-hover);
}

.data-table__skeleton-row {
  border-bottom: 1px solid var(--color-border);
}

.data-table__td {
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-text);
  vertical-align: middle;
}
.data-table__td--right { text-align: right; }

:deep(.table-actions),
:deep(.status-badge),
:deep(.status-pill),
:deep(.payment-pill) {
  white-space: nowrap;
}

/* Horizontal Scrollbar */
.data-table-scroll-container::-webkit-scrollbar {
  height: 5px;
}
.data-table-scroll-container::-webkit-scrollbar-track {
  background: var(--color-bg);
}
.data-table-scroll-container::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: var(--radius-full);
}

/* FLIP Animations */
.table-row-move,
.table-row-enter-active,
.table-row-leave-active {
  transition: transform var(--duration-base) var(--ease-standard),
              opacity var(--duration-base) var(--ease-standard);
}

.table-row-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}

.table-row-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .table-row-move,
  .table-row-enter-active,
  .table-row-leave-active {
    transition: none;
  }
}
</style>