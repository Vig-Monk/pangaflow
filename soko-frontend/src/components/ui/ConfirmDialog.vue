<script setup lang="ts">
// =============================================================================
// src/components/ui/ConfirmDialog.vue
// Built on Modal. Names exactly what will happen — per design.md §3's
// checklist: "Every destructive action requires a confirm dialog naming
// exactly what will happen."
// =============================================================================

import Modal from './Modal.vue';
import Button from './Button.vue';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
}

withDefaults(defineProps<Props>(), {
  danger: false,
});

const emit = defineEmits<{ confirm: []; cancel: [] }>();
</script>

<template>
  <Modal :open="open" :title="title" persistent @close="emit('cancel')">
    <p class="confirm-message">{{ message }}</p>

    <template #footer>
      <Button variant="ghost" @click="emit('cancel')">Cancel</Button>
      <Button :variant="danger ? 'danger' : 'primary'" @click="emit('confirm')">
        {{ confirmLabel }}
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
.confirm-message {
  color: var(--color-text);
  line-height: var(--leading-relaxed);
}
</style>