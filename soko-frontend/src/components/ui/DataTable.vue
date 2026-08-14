<script setup lang="ts">
// =============================================================================
// src/components/ui/DataTable.vue
// =============================================================================

import Skeleton from './Skeleton.vue';
import EmptyState from './EmptyState.vue';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  render?: (row: T) => string;
  cellClass?: (row: T) => string;
}

interface Props<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  loading?: boolean;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

withDefaults(defineProps<Props<Record<string, unknown>>>(), {
  loading: false,
  onRowClick: undefined,
  emptyTitle: 'No data',
  emptyDescription: undefined,
});

function cellValue(row: Record<string, unknown>, column: DataTableColumn<Record<string, unknown>>): string {
  if (column.render) return column.render(row);
  const value = row[column.key];
  return value === null || value === undefined ? '—' : String(value);
}
</script>

<template>
  <div class="data-table">
    <table class="data-table__table">
      <thead>
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
      
      <tbody v-if="loading">
        <tr v-for="n in 5" :key="`skeleton-${n}`">
          <td v-for="col in columns" :key="col.key" class="data-table__td">
            <Skeleton height="16px" />
          </td>
        </tr>
      </tbody>

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

    <EmptyState
      v-if="!loading && rows.length === 0"
      :title="emptyTitle"
      :description="emptyDescription"
    />
  </div>
</template>

<style scoped>
.data-table__table {
  width: 100%;
  border-collapse: collapse;
}

.data-table__th {
  text-align: left;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
}
.data-table__th--right { text-align: right; }

.data-table__row {
  border-bottom: 1px solid var(--color-border);
}
.data-table__row--clickable {
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-standard);
}
.data-table__row--clickable:hover {
  background: var(--color-bg);
}

.data-table__td {
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-text);
  vertical-align: middle;
}
.data-table__td--right { text-align: right; }

/* Smooth FLIP & Row transitions */
.table-row-move,
.table-row-enter-active,
.table-row-leave-active {
  transition: transform var(--duration-base) var(--ease-standard),
              opacity var(--duration-base) var(--ease-standard);
}

.table-row-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.table-row-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .table-row-move,
  .table-row-enter-active,
  .table-row-leave-active {
    transition: none;
  }
}
</style>